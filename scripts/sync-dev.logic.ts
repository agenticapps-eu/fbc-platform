/**
 * Der Wächter des Spiegels DEV ← PROD (AGE-576).
 *
 * Reine Funktionen, kein I/O. Er steht bewusst VOR dem Werkzeug: ein Spiegel,
 * dessen Zielprüfung nachgereicht wird, hat ein Zeitfenster, in dem ein
 * Tippfehler PROD leert.
 *
 * DREI SÄTZE, DIE DIE FORM ERKLÄREN.
 *
 * 1. **Der Host taugt nicht als Unterscheidung.** Er benennt den Pooler-Cluster
 *    und die Region, nicht das Projekt. Gemessen am 2026-08-20 liegen PROD und
 *    DEV zwar auf verschiedenen Clustern (`aws-0` bzw. `aws-1`) — sich darauf
 *    zu stützen wäre trotzdem falsch, weil beide morgen auf demselben liegen
 *    können. Die Kennung steht im Benutzernamen: `postgres.<ref>`.
 *
 * 2. **Die Datenbank-URL allein reicht nicht.** Datenbank, API/Ablage und
 *    Service-Key sind drei getrennte projektgebundene Werte. Eine
 *    DEV-Datenbank-URL neben einem PROD-Service-Key leert PROD-Buckets, während
 *    die Datenbankprüfung grün meldet. Das ist hier keine Sorge, sondern der
 *    heutige Zustand: in Infisical `prod` zeigen `VITE_SUPABASE_URL` und
 *    `VITE_SUPABASE_ANON_KEY` nachweislich auf DEV.
 *
 * 3. **Auch die Quelle wird geprüft.** Ein Entwurf, der nur das Ziel prüft,
 *    lässt eine vertauschte Quelle durch — im schlimmsten Fall spiegelt DEV auf
 *    sich selbst, und der Bestand ist weg, ohne dass ein Auszug entstand, der
 *    ihn trüge.
 */

import { extractProjectRef } from "./db-push-prod.logic";

/** Ein Supabase-Projekt-Ref sind genau 20 Kleinbuchstaben. */
const REF = /^[a-z]{20}$/;

export type Zugang = {
  dbUrl?: string;
  apiUrl?: string;
  serviceKey?: string;
};

export type ZugangErgebnis = { kind: "ok"; ref: string } | { kind: "abbruch"; grund: string };

export type LaufErgebnis =
  | { kind: "frei"; quelleRef: string; zielRef: string }
  | { kind: "abbruch"; grund: string };

/** `https://<ref>.supabase.co[/…]` — die Ablage hängt an derselben Kennung. */
export function refAusApiUrl(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  const treffer = host.match(/^([a-z]{20})\.supabase\.(co|in)$/);
  return treffer ? treffer[1] : null;
}

/**
 * Legacy-Service-Keys sind JWTs und tragen `ref` in der Nutzlast. Die neuen
 * `sb_secret_…`-Schlüssel tragen ihn NICHT — dann gibt es hier `null`, und der
 * Aufrufer bricht ab, statt die Kennung zu raten. Lieber ein Lauf, der eine
 * Umstellung meldet, als einer, der ungeprüft schreibt.
 */
export function refAusServiceKey(key: string): string | null {
  const ref = nutzlast(key)?.ref;
  return typeof ref === "string" && REF.test(ref) ? ref : null;
}

/**
 * Die Kennung allein genügt nicht: der anon-Schlüssel desselben Projekts trägt
 * dieselbe. Er käme durch den Wächter und scheiterte erst zur Laufzeit — und
 * weil `service_role` hier auf keiner Tabelle in `public` ein Recht hält, sähe
 * der Fehler nach einem RLS-Problem aus statt nach einem falschen Schlüssel.
 */
export function rolleAusServiceKey(key: string): string | null {
  const rolle = nutzlast(key)?.role;
  return typeof rolle === "string" ? rolle : null;
}

function nutzlast(key: string): { ref?: unknown; role?: unknown } | null {
  const teile = key.split(".");
  if (teile.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(teile[1], "base64url").toString("utf8")) as {
      ref?: unknown;
      role?: unknown;
    };
  } catch {
    return null;
  }
}

const FELDER = [
  { name: "dbUrl", lies: extractProjectRef },
  { name: "apiUrl", lies: refAusApiUrl },
  { name: "serviceKey", lies: refAusServiceKey },
] as const;

/**
 * Prüft ein Wertepaar-Tripel einer Seite: jeder Wert vorhanden, jeder Wert
 * auflösbar, und alle drei auf dasselbe Projekt.
 */
export function pruefeZugang(zugang: Zugang): ZugangErgebnis {
  const gelesen: { name: string; ref: string }[] = [];

  for (const feld of FELDER) {
    const wert = zugang[feld.name];
    if (!wert) return { kind: "abbruch", grund: `${feld.name} fehlt.` };

    const ref = feld.lies(wert);
    if (!ref) {
      return {
        kind: "abbruch",
        grund: `${feld.name} trägt keine erkennbare Projektkennung. Ein nicht auflösbarer Wert ist ein Abbruchgrund, kein "kein Treffer".`,
      };
    }
    gelesen.push({ name: feld.name, ref });
  }

  const rolle = rolleAusServiceKey(zugang.serviceKey as string);
  if (rolle !== "service_role") {
    return {
      kind: "abbruch",
      grund: `serviceKey trägt die Rolle "${rolle ?? "(keine)"}", gebraucht wird service_role.`,
    };
  }

  // Die Datenbank-URL ist der Anker, gegen den die anderen gehalten werden.
  const anker = gelesen[0];
  const abweichend = gelesen.filter((g) => g.ref !== anker.ref);
  if (abweichend.length > 0) {
    const liste = abweichend.map((g) => `${g.name} → ${g.ref}`).join(", ");
    return {
      kind: "abbruch",
      grund: `Gemischte Zugangsdaten: ${anker.name} → ${anker.ref}, aber ${liste}.`,
    };
  }

  return { kind: "ok", ref: anker.ref };
}

/**
 * Die Richtung ist fest verdrahtet: `quelle` MUSS PROD sein, `ziel` MUSS DEV
 * sein. Es gibt keinen Parameter, der das umdreht — wer die Argumente
 * vertauscht, bekommt einen Abbruch an beiden Seiten, keinen Rücklauf.
 */
export function pruefeLauf(input: {
  quelle: Zugang;
  ziel: Zugang;
  prodRef: string;
  devRef: string;
}): LaufErgebnis {
  const { quelle, ziel, prodRef, devRef } = input;

  for (const [name, wert] of [
    ["prodRef", prodRef],
    ["devRef", devRef],
  ] as const) {
    if (!REF.test(wert)) {
      return {
        kind: "abbruch",
        grund: `Sollwert ${name} ist keine Projektkennung ("${wert}"). Gegen nichts wird nicht geprüft.`,
      };
    }
  }
  if (prodRef === devRef) {
    return {
      kind: "abbruch",
      grund: `Quelle und Ziel wären dasselbe Projekt (${prodRef}). Ein Spiegel auf sich selbst löscht den Bestand, ohne einen Auszug zu hinterlassen.`,
    };
  }

  // Beide Seiten werden IMMER geprüft, bevor eine Meldung entsteht: wer die
  // Argumente vertauscht, soll beide Hälften des Fehlers sehen, nicht die
  // erste und danach raten.
  const gruende: string[] = [];

  const q = pruefeZugang(quelle);
  if (q.kind === "abbruch") gruende.push(`Quelle: ${q.grund}`);
  else if (q.ref !== prodRef) gruende.push(`Quelle trägt ${q.ref}, erwartet ist PROD (${prodRef}).`);

  const z = pruefeZugang(ziel);
  if (z.kind === "abbruch") gruende.push(`Ziel: ${z.grund}`);
  else if (z.ref !== devRef) gruende.push(`Ziel trägt ${z.ref}, erwartet ist DEV (${devRef}).`);

  if (gruende.length > 0) return { kind: "abbruch", grund: gruende.join(" ") };

  return {
    kind: "frei",
    quelleRef: (q as { kind: "ok"; ref: string }).ref,
    zielRef: (z as { kind: "ok"; ref: string }).ref,
  };
}

/**
 * Sucht den ersten Namen, der einen Wert trägt, und gibt **beides** zurück.
 *
 * Der zurückgegebene Name ist der Punkt, nicht nur der Wert: der PROD-Schlüssel
 * liegt unter dem etablierten Namen `SUPABASE_SERVICE_ROLE_KEY` (den auch der
 * WordPress-Import liest), und ihn für den Spiegel unter `…_PROD` zu
 * verdoppeln hiesse, zwei Vollzugriffs-Schlüssel zu führen, von denen eine
 * Rotation nur einen erwischt. Also wird der vorhandene gelesen — aber der
 * Lauf schreibt hin, welchen, statt es stillschweigend zu tun.
 */
export function wertMitNamen(
  env: Record<string, string | undefined>,
  kandidaten: string[],
): { name: string; wert: string } | null {
  for (const name of kandidaten) {
    const wert = env[name];
    if (wert) return { name, wert };
  }
  return null;
}
