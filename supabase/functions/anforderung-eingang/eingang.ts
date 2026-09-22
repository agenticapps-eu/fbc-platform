// Der Ablauf des Anforderungseingangs (AGE-830), ohne echte Abhängigkeiten.
//
// Reihenfolge, und sie ist die Sicherung:
//
//   Methode → Secrets → Schlüssel → JSON → Rumpf → Drossel → Dateien →
//   issueCreate → Zähler → Antwort
//
// Alles vor der Drossel kostet keinen Datenbankzugriff, alles vor den Dateien
// keinen Download, und nichts vor dem Schlüssel berührt irgendetwas. Gezählt
// wird erst, wenn Linear das Issue bestätigt hat (design.md, Entscheidung 5).
//
// Jede Antwort ab 400 ist `{ fehler }` in ganzen Sätzen: der GPT liest sie
// Detlev vor. Das Log trägt keine Inhalte — keinen Text, keinen Namen, keinen
// Link, keinen Schlüssel (Spec „Das Log trägt keine Inhalte").

import { baueBeschreibung } from "./beschreibung.ts";
import { uebernehmeDateien } from "./dateien.ts";
import { ladeHoch, legeIssueAn, LinearFehler } from "./linear.ts";
import { type Art, pruefeAnforderung } from "./pruefung.ts";

/** Fest verdrahtet, am 22.09. gegen Linear geprüft (design.md, Entscheidung 8). */
export const LINEAR_ZIEL = {
  teamId: "edf1f698-4f91-4caf-b87e-d129419a90c5", // AgenticApps
  projectId: "b815c05b-f6ed-413c-95a2-755cde30e916", // eff.bee.zee — Backlog (nach Go-Live)
  stateId: "ee8d6b49-8806-4e92-9878-7238f5421632", // Triage
  labels: {
    vonDetlev: "ec4878f0-7a29-42e1-b294-8ab40ef9d1d6",
    fehler: "c7e397f3-ae8e-4cb0-8ac3-3fcd471af0e7", // Bug
    aenderung: "dd58d928-d4ec-4b45-b092-39d2f7a51edd", // Improvement
    funktion: "53ebd9d4-5ed8-44b4-851e-5818336af38c", // Feature
    idee: "1eceb218-58a8-4739-a643-7eeca6583eff", // Idee
  } satisfies Record<Art | "vonDetlev", string>,
} as const;

/** 25 s + 8 s bleiben unter ChatGPTs 45 s (OpenAI-Doku, actions/production). */
const FRISTEN = { jeDateiMs: 12_000, gesamtMs: 25_000, issueMs: 8_000 };

const MAX_SCHLUESSEL = 512;

export type Log = (level: "info" | "warn" | "error", event: string, felder?: Record<string, unknown>) => void;

export interface EingangDeps {
  env: { schluessel?: string; linearApiKey?: string; probelauf: boolean };
  fetch: typeof fetch;
  anforderungFrei: () => Promise<boolean>;
  anforderungVermerken: () => Promise<void>;
  jetzt: () => Date;
  log: Log;
  fristen?: typeof FRISTEN;
}

function fehler(status: number, text: string): Response {
  return Response.json({ fehler: text }, { status });
}

async function digest(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}

/** Konstant ist der Vergleich der 32-Byte-Digests, nicht das Hashen (design.md, Entscheidung 2). */
async function schluesselStimmt(gegeben: string, erwartet: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(gegeben), digest(erwartet)]);
  let unterschied = 0;
  for (let i = 0; i < a.length; i++) unterschied |= a[i] ^ b[i];
  return unterschied === 0;
}

export async function verarbeite(req: Request, deps: EingangDeps): Promise<Response> {
  const fristen = deps.fristen ?? FRISTEN;

  if (req.method !== "POST") {
    return fehler(405, "Diese Adresse nimmt Anforderungen nur per POST entgegen.");
  }

  const { schluessel, linearApiKey, probelauf } = deps.env;
  if (!schluessel || !linearApiKey) {
    deps.log("error", "secret_fehlt", {
      schluessel: Boolean(schluessel),
      linear: Boolean(linearApiKey),
    });
    return fehler(500, "Der Eingang ist nicht vollständig eingerichtet. Bitte sag Donald Bescheid.");
  }

  const gegeben = req.headers.get("x-anforderung-schluessel") ?? "";
  if (!gegeben || gegeben.length > MAX_SCHLUESSEL || !(await schluesselStimmt(gegeben, schluessel))) {
    deps.log("warn", "schluessel_abgelehnt");
    return fehler(401, "Der Schlüssel fehlt oder stimmt nicht. Bitte prüfe die Einstellungen der Action.");
  }

  let rumpf: unknown;
  try {
    rumpf = JSON.parse(await req.text());
  } catch {
    return fehler(400, "Die Anfrage war nicht lesbar.");
  }

  const pruefung = pruefeAnforderung(rumpf);
  if (!pruefung.ok) {
    deps.log("info", "abgelehnt_400");
    return fehler(400, pruefung.fehler);
  }
  const anforderung = pruefung.anforderung;

  try {
    if (!(await deps.anforderungFrei())) {
      deps.log("warn", "gedrosselt");
      return fehler(
        429,
        "Es sind gerade zu viele Anforderungen eingegangen. Bitte versuche es in einer Stunde noch einmal.",
      );
    }
  } catch (e) {
    deps.log("error", "drossel_fehler", { fehler: e instanceof Error ? e.message : String(e) });
    return fehler(500, "Der Eingang ist gerade gestört. Bitte versuche es in einigen Minuten noch einmal.");
  }

  const linear = { fetch: deps.fetch, apiKey: linearApiKey };
  const uebernahmen = await uebernehmeDateien(anforderung.dateien, {
    fetch: deps.fetch,
    hochladen: probelauf ? null : (d, signal) => ladeHoch(linear, d, signal),
    fristJeDateiMs: fristen.jeDateiMs,
    fristGesamtMs: fristen.gesamtMs,
  });
  const protokoll = uebernahmen.map((u) => u.protokoll);
  const nichtUebertragen = uebernahmen.filter((u) => "grund" in u.ergebnis).length;
  const beschreibung = baueBeschreibung(anforderung, uebernahmen.map((u) => u.ergebnis), deps.jetzt());

  if (probelauf) {
    deps.log("info", "probelauf", {
      art: anforderung.art,
      dateien: protokoll,
      beschreibung_zeichen: beschreibung.length,
    });
    return Response.json({
      probelauf: true,
      hinweis: "Das war ein Probelauf. Es wurde nichts angelegt.",
    }, { status: 200 });
  }

  let nummer: string;
  try {
    nummer = await legeIssueAn(linear, {
      teamId: LINEAR_ZIEL.teamId,
      projectId: LINEAR_ZIEL.projectId,
      stateId: LINEAR_ZIEL.stateId,
      labelIds: [LINEAR_ZIEL.labels.vonDetlev, LINEAR_ZIEL.labels[anforderung.art]],
      title: anforderung.titel,
      description: beschreibung,
    }, AbortSignal.timeout(fristen.issueMs));
  } catch (e) {
    if (!(e instanceof LinearFehler)) throw e;
    deps.log("error", "issue_nicht_bestaetigt", { grund: e.message, art: anforderung.art, dateien: protokoll });
    return fehler(
      502,
      "Die Übergabe an Donald konnte nicht bestätigt werden. Sie ist vielleicht trotzdem angekommen. " +
        "Bitte sag Donald Bescheid, statt sie sofort noch einmal zu schicken.",
    );
  }

  // Das Issue existiert. Scheitert das Zählen, bleibt die Antwort 201 — sonst
  // schickte der GPT eine Anforderung erneut, die schon angekommen ist.
  try {
    await deps.anforderungVermerken();
  } catch (e) {
    deps.log("error", "vermerken_fehler", { nummer, fehler: e instanceof Error ? e.message : String(e) });
  }

  deps.log("info", "angelegt", { nummer, art: anforderung.art, dateien: protokoll });

  let hinweis = "Donald sieht die Anforderung durch und entscheidet binnen einer Woche, ob daraus eine Aufgabe wird.";
  if (nichtUebertragen > 0) {
    hinweis += nichtUebertragen === 1
      ? " 1 Datei konnte nicht übertragen werden, sie ist im Eintrag vermerkt."
      : ` ${nichtUebertragen} Dateien konnten nicht übertragen werden, sie sind im Eintrag vermerkt.`;
  }
  return Response.json({ nummer, hinweis }, { status: 201 });
}
