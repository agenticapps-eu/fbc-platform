// Die Entscheidung hinter `ota-stats`, getrennt vom Rumpf (AGE-642, Phase D3).
//
// Aufbau wie bei `ota-update`: was zu entscheiden ist, steht hier und wird mit
// `deno test` geprueft; `index.ts` reicht nur noch `Deno.serve` und die Konsole
// herein. Der Handler liegt MIT in dieser Datei, damit er ausfuehrbar geprueft
// werden kann — `index.ts` selbst ist nicht importierbar, ohne einen Server zu
// starten, und ein Test, der nur seinen Quelltext liest, hat die HTTP-Status
// nie angefasst. Genau daran haengt hier alles (siehe RUMPF_GRENZE).
//
// Belegstellen sind mit SYMBOLNAMEN angegeben, nicht mit Zeilennummern: die
// Nummern in der ersten Fassung waren um 1 bis 118 Zeilen daneben, obwohl jede
// Aussage stimmte. Ein Verweis, der ins Leere zeigt, laesst einen richtigen
// Kommentar falsch aussehen. Alle Angaben gegen @capgo/capacitor-updater 8.51.15.
//
// ══ DER RUMPF IST EIN ARRAY, NICHT EIN OBJEKT ═══════════════════════════════
// Die Statistik ist gepuffert: die Schalen sammeln Ereignisse und senden sie im
// Sekundentakt als Stapel. Auf der Leitung steht darum ein JSON-ARRAY —
//   iOS      CapgoUpdater.swift    `flushStatsQueue` -> `parameters: eventsToSend`
//   Android  CapgoUpdater.java     `flushStatsQueue` -> `new JSONArray()`
// Die erste Fassung dieser Funktion las `rumpf.action` an genau diesem Array,
// bekam `undefined` und protokollierte `ohne`. Sie war die ganze Zeit blind,
// ohne dass es auffiel: `200 ok` sieht von aussen aus wie Erfolg.
//
// Daneben bleibt die EINZELFORM echt und muss weiter gelesen werden:
//   iOS      CapgoUpdater.swift    `sendRateLimitStatistic`
//   Android  CapgoUpdater.java     `sendRateLimitStatistic`
//   Android  DownloadService.java  `sendStatsAsync` (Download-Fortschritt)
// Deshalb nimmt der Endpunkt beide Formen — das ist gemessen, nicht vorsorglich.
//
// ══ WARUM DIE RUMPFGRENZE SO GROSS IST ══════════════════════════════════════
// Sie war 8 KiB. Ein voller Stapel sind 200 Ereignisse (`maxPendingStats` bzw.
// `MAX_PENDING_STATS`, in beiden Schalen 200), gemessen rund 94 KiB — es passten
// also 17 von 200 hindurch.
//
// Und das war nicht folgenlos: `413` gilt KEINER Schale als voruebergehend
// (`isTransientStatsFailure` kennt nur 429, 408 und >= 500), das Geraet
// verwirft den Stapel also endgueltig und protokolliert `Dropping stats batch
// after permanent error`. Eine zu enge Grenze ist damit stiller Verlust, kein
// Schutz. 256 KiB liegen bequem ueber dem echten Maximum und lassen Luft fuer
// `metadata`, das je Ereignis frei belegbar ist.

/**
 * Ueber dem gemessenen Maximum eines vollen Stapels (~94 KiB), mit Luft fuer `metadata`.
 *
 * Gezaehlt werden UTF-16-Codeeinheiten, NICHT Bytes: bei durchweg dreibyteigem
 * UTF-8 sind das bis zu 768 KiB auf der Leitung. Das ist Absicht und kein
 * Schutzloch — `req.text()` hat den Rumpf da laengst vollstaendig gepuffert,
 * die Grenze schuetzt also ohnehin nie den Speicher, sondern nur das Parsen und
 * das Log dahinter. Mit `TextEncoder` nachzumessen legte eine ZWEITE volle
 * Kopie an und machte gerade das schlimmer.
 */
export const RUMPF_GRENZE = 256 * 1024;
/** `action` ist ein kurzes Schluesselwort (`set`, `delete`, `update_fail`, …). */
export const ACTION_GRENZE = 64;
/**
 * So viele Aktionen wandern hoechstens in eine Logzeile.
 *
 * Ohne diesen Deckel machte die angehobene Rumpfgrenze den offenen Endpunkt
 * (`verify_jwt = false`) zum Verstaerker: viele winzige Objekte in einem
 * grossen Rumpf ergaeben eine Logzeile, die niemand bestellt hat. 200 ist die
 * Obergrenze, die die Schalen selbst einhalten — mehr ist nie echt.
 */
export const MAX_EREIGNISSE = 200;

export type Meldung =
  | { status: 413; event: "rumpf_zu_gross"; laenge: number }
  | { status: 200; event: "rumpf_unlesbar" }
  | { status: 200; event: "gemeldet"; actions: string[]; gesamt: number };

/** `action` eines einzelnen Ereignisses, beschnitten; alles Unbrauchbare heisst `ohne`. */
function action(ereignis: unknown): string {
  const roh = (ereignis as { action?: unknown })?.action;
  return typeof roh === "string" ? roh.slice(0, ACTION_GRENZE) : "ohne";
}

export function werteRumpf(roh: string): Meldung {
  if (roh.length > RUMPF_GRENZE) {
    return { status: 413, event: "rumpf_zu_gross", laenge: roh.length };
  }

  let rumpf: unknown;
  try {
    rumpf = JSON.parse(roh);
  } catch {
    return { status: 200, event: "rumpf_unlesbar" };
  }

  const alle = Array.isArray(rumpf) ? rumpf : [rumpf];
  return {
    status: 200,
    event: "gemeldet",
    actions: alle.slice(0, MAX_EREIGNISSE).map(action),
    // Die GESENDETE Zahl, nicht die protokollierte. Ohne sie waere der
    // Deckel unsichtbar und 200 von 250 saehen aus wie 200 von 200 — also
    // genau die stille Kuerzung, gegen die dieser Endpunkt gerade repariert
    // wurde, eine Ebene hoeher.
    gesamt: alle.length,
  };
}

/**
 * Was in eine Logzeile geht — und nichts sonst.
 *
 * Die Datenschutz-Zusage des Endpunkts haengt an dieser Funktion: `device_id`
 * hat hier keinen Weg hinaus, weil `Meldung` gar kein Feld dafuer traegt. Der
 * angreifergesteuerte `action`-Text geht durch `JSON.stringify`, Zeilenumbrueche
 * sind damit escaped und eine Log-Injektion ausgeschlossen.
 */
function protokoll(meldung: Meldung): { level: "log" | "warn"; zeile: string } {
  if (meldung.event === "rumpf_zu_gross") {
    return {
      level: "warn",
      zeile: JSON.stringify({ fn: "ota-stats", event: meldung.event, laenge: meldung.laenge }),
    };
  }
  if (meldung.event === "rumpf_unlesbar") {
    return { level: "warn", zeile: JSON.stringify({ fn: "ota-stats", event: meldung.event }) };
  }
  // `gesamt` ist das GESENDETE, `actions` das protokollierte. Weichen sie ab,
  // hat `MAX_EREIGNISSE` gegriffen — und das steht dann da, statt still zu
  // passieren.
  return {
    level: "log",
    zeile: JSON.stringify({
      fn: "ota-stats",
      event: meldung.event,
      gesamt: meldung.gesamt,
      actions: meldung.actions,
    }),
  };
}

/**
 * Der ganze Endpunkt, ohne `Deno.serve` — damit er ausfuehrbar geprueft werden kann.
 *
 * Der Status kommt aus `meldung.status` und wird NICHT ein zweites Mal
 * hingeschrieben. Die erste Fassung hartkodierte ihn im Rumpf, waehrend die
 * Zusagen das Feld pruefen: beide Fremd-Reviews fanden unabhaengig, dass man
 * den `413`-Zweig auf `200` drehen konnte, ohne dass eine der elf Zusagen rot
 * wurde. Ausgerechnet dieser Status entscheidet, ob das Geraet wiederholt oder
 * endgueltig verwirft — also genau der Fehler, gegen den dieser Endpunkt
 * gerade repariert wurde, eine Ebene hoeher.
 */
export async function behandleAnfrage(
  req: Request,
  log: (level: "log" | "warn", zeile: string) => void,
): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const meldung = werteRumpf(await req.text());
  const { level, zeile } = protokoll(meldung);
  log(level, zeile);

  if (meldung.event === "rumpf_zu_gross") {
    return new Response("Payload Too Large", { status: meldung.status });
  }

  // Weiterhin 200, aber nicht `ok`: das Geraet wertet die Antwort auf Statistik
  // nicht aus, und ein 4xx loeste nur eine Wiederholung aus, die nichts besser
  // machte. Ein `ok` auf einen verworfenen Rumpf machte allerdings Zustellung
  // und Verlust ununterscheidbar (Befund Fremd-Review, LOW) — deshalb sagt die
  // Antwort, was wirklich passiert ist.
  const koerper = meldung.event === "rumpf_unlesbar" ? "discarded" : "ok";
  return new Response(JSON.stringify({ status: koerper }), {
    status: meldung.status,
    headers: { "content-type": "application/json" },
  });
}
