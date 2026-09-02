// Die Torwaechter von `send-push`, getrennt vom Rumpf (AGE-641; nachgezogen 02.09.).
//
// ══ WARUM DIESE DATEI EXISTIERT ═════════════════════════════════════════════
// Sie stand als Rumpf in `index.ts` — und `index.ts` importiert kein Test, denn
// `deno test` typprueft nur, was ein Test anfasst. Damit war KEINE dieser
// Entscheidungen gedeckt: der 405-Waechter, das fehlende Secret, der
// Zeitvergleich des Webhook-Geheimnisses (401), der unlesbare Rumpf und die
// Weiche zwischen Webhook und Wiederholungslauf.
//
// Eine Zusage las stattdessen `index.ts` als TEXT und grepte auf Aufrufe. Im
// Fremd-Review zu `ota-stats` (02.09.) hat sich gezeigt, was das wert ist:
// dort blieben SECHS von sieben Mutationen an der Verdrahtung gruen, ein
// Datenleck eingeschlossen. Ein Grep belegt, dass ein Name dasteht — nicht,
// welchen Status die Antwort traegt.
//
// **Die Antwort wird hier gebaut, nicht nur beschrieben.** Gaebe diese Datei
// nur einen Statuscode zurueck und `index.ts` setzte ihn selbst, waere die
// Doppelung wieder da, die bei `ota-stats` der eigentliche Defekt war.

import { timingSafeEqual } from "jsr:@std/crypto@1/timing-safe-equal";

/** Was der Webhook schickt: eine Kennung, oder den Wiederholungslauf. */
interface WebhookAufruf {
  record?: { id?: string } | null;
  modus?: string;
}

export type Aufrufpruefung =
  /** Der Aufruf ist echt und benennt einen Weg. */
  | { weiter: true; hinweisId: string | undefined; faellig: boolean }
  /** Der Aufruf ist es nicht — die fertige Antwort steht hier, samt Logzeile. */
  | {
    weiter: false;
    antwort: Response;
    log: { level: "warn" | "error"; event: string } | null;
  };

/**
 * Prueft Verfahren, Geheimnis und Rumpf — und baut im Ablehnungsfall die Antwort.
 *
 * `erwartet` kommt aus der Umgebung und wird HEREINGEREICHT, nicht hier gelesen:
 * sonst braeuchte jede Zusage `--allow-env` und muesste den Prozess umkonfigurieren,
 * um den 500er ueberhaupt zu erreichen.
 */
export async function pruefeAufruf(
  req: Request,
  erwartet: string | undefined,
): Promise<Aufrufpruefung> {
  if (req.method !== "POST") {
    return {
      weiter: false,
      antwort: new Response("Method Not Allowed", { status: 405 }),
      log: null,
    };
  }

  if (!erwartet) {
    // 500 und nicht 401: nicht der Anrufer ist falsch, wir sind es. Als 401
    // beantwortet, suchte man den Fehler beim Webhook statt in den Secrets.
    return {
      weiter: false,
      antwort: new Response("Server misconfigured", { status: 500 }),
      log: { level: "error", event: "missing_webhook_secret" },
    };
  }

  // Zeitunabhaengiger Vergleich: ein `===` verriete ueber die Laufzeit, wie
  // viele Zeichen stimmen. `timingSafeEqual` verlangt gleiche Laenge, deshalb
  // steht der Laengenvergleich davor — er ist selbst kein Geheimnis, die Laenge
  // des Praefix `Bearer ` ist bekannt.
  const enc = new TextEncoder();
  const gegeben = enc.encode(req.headers.get("authorization") ?? "");
  const gewollt = enc.encode(`Bearer ${erwartet}`);
  if (gegeben.byteLength !== gewollt.byteLength || !timingSafeEqual(gegeben, gewollt)) {
    return {
      weiter: false,
      antwort: new Response("Unauthorized", { status: 401 }),
      log: { level: "warn", event: "unauthorized" },
    };
  }

  let aufruf: WebhookAufruf;
  try {
    aufruf = await req.json();
  } catch {
    return { weiter: false, antwort: new Response("Bad Request", { status: 400 }), log: null };
  }

  // Zwei Wege in dieselbe Zustellung: der Webhook nennt eine Kennung, der
  // Wiederholungslauf nennt keine.
  const hinweisId = aufruf?.record?.id;
  const faellig = aufruf?.modus === "faellig";
  if (!hinweisId && !faellig) {
    return {
      weiter: false,
      antwort: new Response("Bad Request", { status: 400 }),
      log: { level: "warn", event: "kein_hinweis_und_kein_modus" },
    };
  }

  return { weiter: true, hinweisId, faellig };
}
