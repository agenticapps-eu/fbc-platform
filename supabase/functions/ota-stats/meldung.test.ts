// deno test  (aus supabase/functions/ota-stats/)
//
// Die Zusagen stehen gegen das ECHTE Drahtformat beider Schalen, nicht gegen
// den Kopfkommentar der Funktion. Der behauptete bis 02.09., der Rumpf sei
// `createInfoObject()` plus `action` — das ist die Form EINES Ereignisses, aber
// nicht die, in der die Schalen es senden.
//
// Gemessen an @capgo/capacitor-updater 8.51.15:
//
//   Stapel (der Normalfall, seit die Statistik gepuffert wird)
//     iOS      CapgoUpdater.swift:3300  `parameters: eventsToSend`  -> JSON-Array
//     Android  CapgoUpdater.java:3084   `new JSONArray()`           -> JSON-Array
//
//   Einzelobjekt (bleibt daneben bestehen)
//     iOS      CapgoUpdater.swift:664       sendRateLimitStatistic
//     Android  CapgoUpdater.java:2199       sendRateLimitStatistic
//     Android  DownloadService.java:414     sendStatsAsync (Download-Fortschritt)
//
// Beide Formen sind echt, also nimmt der Endpunkt beide. Und die Lehre aus dem
// `session_key`-Fall gilt weiter: eine Aussage uebers Drahtformat braucht
// BEIDE Schalen — hier decken sie sich, das ist gemessen und nicht vermutet.

import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { ACTION_GRENZE, MAX_EREIGNISSE, RUMPF_GRENZE, werteRumpf } from "./meldung.ts";

/** Ein Ereignis in der Form, die StatsEvent (iOS) auf die Leitung legt. */
function ereignis(action: string) {
  return {
    platform: "ios",
    device_id: "F1A2B3C4-D5E6-4789-A0B1-C2D3E4F5A6B7",
    app_id: "com.effbeezee.app",
    custom_id: "",
    version_build: "0.0.0+c1ea4ed1",
    version_code: "1",
    version_os: "18.6.2",
    version_name: "0.0.0+c1ea4ed1",
    old_version_name: "0.0.0+d398500ba829",
    plugin_version: "8.51.15",
    is_emulator: false,
    is_prod: true,
    install_source: "app_store",
    action,
    channel: "production",
    defaultChannel: "production",
    key_id: "",
    metadata: null,
    timestamp: 1756819200000,
  };
}

Deno.test("RED: ein Stapel wird Ereignis fuer Ereignis gelesen, nicht als ein Objekt", () => {
  // Genau der Fall, den das Geraet am 02.09. sendete: `Sent 9 events`.
  // Bis hierher las der Endpunkt `rumpf.action` an einem Array — undefined —
  // und schrieb `ohne`. Damit fielen die Aktionen auf den Boden, die Probe 2
  // belegen soll.
  const roh = JSON.stringify(["download_complete", "update_fail", "set"].map(ereignis));
  const m = werteRumpf(roh);

  assertEquals(m.event, "gemeldet");
  assertEquals(m.status, 200);
  assertEquals(
    m.event === "gemeldet" ? m.actions : null,
    ["download_complete", "update_fail", "set"],
  );
});

Deno.test("RED: ein voller Stapel passt durch die Rumpfgrenze", () => {
  // MAX_PENDING_STATS ist 200 in BEIDEN Schalen
  // (CapgoUpdater.swift:81, CapgoUpdater.java:141). Gemessen sind das ~94 KiB.
  //
  // Und ein zu grosser Rumpf ist hier NICHT folgenlos: 413 gilt keiner Schale
  // als voruebergehend — `isTransientStatsFailure` kennt nur 429, 408 und >=500
  // (CapgoUpdater.swift:3243, CapgoUpdater.java) — das Geraet verwirft den
  // Stapel also ENDGUELTIG. Eine zu enge Grenze ist stiller Verlust.
  const roh = JSON.stringify(Array.from({ length: 200 }, () => ereignis("update_fail")));

  // Die Messung, die die Grenze begruendet, steht als Zusage da:
  if (roh.length <= 8 * 1024) throw new Error("Annahme kaputt: 200 Ereignisse waeren <= 8 KiB");

  const m = werteRumpf(roh);
  assertEquals(m.event, "gemeldet");
  assertEquals(m.event === "gemeldet" ? m.actions.length : -1, 200);
});

Deno.test("Ein Einzelobjekt bleibt lesbar (rate_limit_reached, Download-Fortschritt)", () => {
  // Diese Form verschwindet nicht: sendRateLimitStatistic sendet sie in beiden
  // Schalen, Androids DownloadService zusaetzlich fuer den Fortschritt.
  const m = werteRumpf(JSON.stringify(ereignis("rate_limit_reached")));
  assertEquals(m.event === "gemeldet" ? m.actions : null, ["rate_limit_reached"]);
});

Deno.test("Ein Ereignis ohne brauchbares action heisst weiterhin 'ohne'", () => {
  const roh = JSON.stringify([ereignis("set"), { timestamp: 1 }, { action: 42 }]);
  const m = werteRumpf(roh);
  assertEquals(m.event === "gemeldet" ? m.actions : null, ["set", "ohne", "ohne"]);
});

Deno.test("action bleibt beschnitten — auch im Stapel", () => {
  // Der Befund des Fremd-Reviews (MEDIUM, 31.08.) galt dem Einzelfall. Ein
  // Stapel ist derselbe Befund mal 200, also muss die Grenze je Ereignis
  // greifen und nicht nur am ersten.
  const lang = "x".repeat(500);
  const m = werteRumpf(JSON.stringify([ereignis(lang), ereignis(lang)]));
  const actions = m.event === "gemeldet" ? m.actions : [];
  assertEquals(actions.length, 2);
  for (const a of actions) assertEquals(a.length, ACTION_GRENZE);
});

Deno.test("RED: die Zahl der protokollierten Aktionen ist gedeckelt", () => {
  // Sonst wird die angehobene Rumpfgrenze zum Verstaerker: der Endpunkt steht
  // offen (`verify_jwt = false`), und viele winzige Objekte in einem grossen
  // Rumpf ergaeben eine Logzeile, die keiner bestellt hat. 200 ist die
  // Obergrenze, die die Schalen selbst einhalten — mehr ist nie echt.
  const viele = JSON.stringify(Array.from({ length: MAX_EREIGNISSE + 50 }, () => ({ action: "set" })));
  const m = werteRumpf(viele);
  assertEquals(m.event === "gemeldet" ? m.actions.length : -1, MAX_EREIGNISSE);
});

Deno.test("Ein unlesbarer Rumpf bleibt 200 mit 'discarded'", () => {
  const m = werteRumpf("{kein json");
  assertEquals(m.event, "rumpf_unlesbar");
  assertEquals(m.status, 200);
});

Deno.test("Ein wirklich zu grosser Rumpf bleibt 413", () => {
  const m = werteRumpf("x".repeat(RUMPF_GRENZE + 1));
  assertEquals(m.event, "rumpf_zu_gross");
  assertEquals(m.status, 413);
});

Deno.test("Der Deckel bleibt sichtbar: gesamt zaehlt das Gesendete, nicht das Protokollierte", () => {
  // Ohne diese Zusage waere der Deckel selbst eine stille Kuerzung — dieselbe
  // Sorte Fehler, gegen die diese Datei geschrieben ist.
  const m = werteRumpf(JSON.stringify(Array.from({ length: 250 }, () => ({ action: "set" }))));
  assertEquals(m.event === "gemeldet" ? m.gesamt : -1, 250);
  assertEquals(m.event === "gemeldet" ? m.actions.length : -1, MAX_EREIGNISSE);
});

Deno.test("Bei einem gewoehnlichen Stapel sind gesamt und actions gleich lang", () => {
  const m = werteRumpf(JSON.stringify([{ action: "set" }, { action: "delete" }]));
  assertEquals(m.event === "gemeldet" ? m.gesamt : -1, 2);
  assertEquals(m.event === "gemeldet" ? m.actions.length : -1, 2);
});

Deno.test("Verdrahtung: `index.ts` wertet den Rumpf wirklich hier aus", async () => {
  // Ohne diese Zusage waere `werteRumpf` tot und alles gruen: `deno test`
  // typprueft nur, was ein Test importiert, und das ist `index.ts` gerade
  // nicht. Gleiches Muster wie `send-push/anbieter.test.ts`.
  const quelle = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const kompakt = quelle.replace(/\s+/g, " ");

  // Auf den AUFRUF geprueft, nicht auf den blossen Namen — der stuende sonst
  // schon durch den Import da.
  assertStringIncludes(kompakt, "werteRumpf(await req.text())");

  // Und der Rumpf darf die Grenze nicht ein zweites Mal selbst ziehen: genau
  // diese Doppelung war der Fehler, denn die eine Fassung wurde repariert und
  // die andere nicht.
  assertEquals(kompakt.includes("RUMPF_GRENZE ="), false);
});
