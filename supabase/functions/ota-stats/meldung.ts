// Die Entscheidung hinter `ota-stats`, getrennt vom Rumpf (AGE-642, Phase D3).
//
// Aufbau wie bei `ota-update`: was zu entscheiden ist, steht hier und wird mit
// `deno test` geprueft; `index.ts` baut nur noch die echten Abhaengigkeiten.
//
// ══ DER RUMPF IST EIN ARRAY, NICHT EIN OBJEKT ═══════════════════════════════
// Die Statistik ist gepuffert: die Schalen sammeln Ereignisse und senden sie im
// Sekundentakt als Stapel. Auf der Leitung steht darum ein JSON-ARRAY —
//   iOS      CapgoUpdater.swift:3300  `parameters: eventsToSend`
//   Android  CapgoUpdater.java:3084   `new JSONArray()`
// Die erste Fassung dieser Funktion las `rumpf.action` an genau diesem Array,
// bekam `undefined` und protokollierte `ohne`. Sie war die ganze Zeit blind,
// ohne dass es auffiel: `200 ok` sieht von aussen aus wie Erfolg.
//
// Daneben bleibt die EINZELFORM echt und muss weiter gelesen werden:
//   iOS      CapgoUpdater.swift:664     sendRateLimitStatistic
//   Android  CapgoUpdater.java:2199     sendRateLimitStatistic
//   Android  DownloadService.java:414   sendStatsAsync (Download-Fortschritt)
// Deshalb nimmt der Endpunkt beide Formen — das ist gemessen, nicht vorsorglich.
//
// ══ WARUM DIE RUMPFGRENZE SO GROSS IST ══════════════════════════════════════
// Sie war 8 KiB. Ein voller Stapel sind 200 Ereignisse (`maxPendingStats`,
// CapgoUpdater.swift:81 == `MAX_PENDING_STATS`, CapgoUpdater.java:141), gemessen
// rund 94 KiB — es passten also 17 von 200 hindurch.
//
// Und das war nicht folgenlos: `413` gilt KEINER Schale als voruebergehend
// (`isTransientStatsFailure` kennt nur 429, 408 und >= 500), das Geraet
// verwirft den Stapel also endgueltig und protokolliert `Dropping stats batch
// after permanent error`. Eine zu enge Grenze ist damit stiller Verlust, kein
// Schutz. 256 KiB liegen bequem ueber dem echten Maximum und lassen Luft fuer
// `metadata`, das je Ereignis frei belegbar ist.

/** Ueber dem gemessenen Maximum eines vollen Stapels (~94 KiB), mit Luft fuer `metadata`. */
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
