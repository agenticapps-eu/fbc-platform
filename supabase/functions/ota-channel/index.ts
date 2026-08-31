// ota-channel — der `channelUrl`-Endpunkt (AGE-642, Phase D3).
//
// ══ WARUM ES DIESE FUNCTION ÜBERHAUPT GIBT ══════════════════════════════════
// Wir haben keine Kanäle und wollen keine. Diese Function existiert trotzdem,
// und der Grund ist gemessen, nicht vermutet: bleibt `channelUrl` in
// `capacitor.config.ts` leer, setzt das Plugin NICHT die Funktion aus, sondern
// seine eigene Vorgabe — `https://plugin.capgo.app/channel_self`
// (`CapacitorUpdaterPlugin.java:100`, gleichlautend in `.swift`). Dasselbe gilt
// für `updateUrl` (`/updates`) und `statsUrl` (`/stats`).
//
// Der Rumpf, den das Plugin dorthin schickte, ist `createInfoObject()`
// (`CapgoUpdater.java:1992`): `device_id`, `app_id`, `custom_id`,
// `version_build`, `version_name`, `platform`, `is_emulator` und weitere. Eine
// leere Zeile in der Konfiguration wäre also kein „aus", sondern ein stiller
// Abfluss von Geräteangaben unserer Mitglieder an einen Dritten — und zwar
// einer, der in keinem Diff steht, weil er aus einer Abwesenheit entsteht.
//
// Also: alle drei Endpunkte gehören uns, auch der, den niemand aufruft.
//
// ── Warum verify_jwt = false ────────────────────────────────────────────────
// Wie bei ota-update: ein Gerät hat kein JWT. Ohne den `config.toml`-Block
// gälte `true` und das Gateway antwortete mit 401, bevor dieser Handler läuft.

/**
 * Drei Methoden, ein Endpunkt, und die dritte ist nicht die naheliegende: das
 * Plugin ruft dieselbe URL mit POST (`setChannel`, über `makeJsonRequest`,
 * `CapgoUpdater.java:2246`), PUT (`getChannel`, `:2547`) und GET
 * (`listChannels`, `:2705` — mit den Geräteangaben als Abfrageparametern statt
 * im Rumpf). Ein DELETE gibt es NICHT: `unsetChannel` (`:2408`) reicht an
 * `setChannel` mit leerem Namen weiter, ist also auch ein POST.
 *
 * Unsere Web-Schicht ruft keine davon; die Antwort ist für alle drei dieselbe.
 */
const ERLAUBT = ["POST", "PUT", "GET"];

Deno.serve((req) => {
  if (!ERLAUBT.includes(req.method)) {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Kein Feld aus der Anfrage im Log — nur die Methode, und die ist eines von
  // drei Wörtern. Der Rumpf wird gar nicht erst gelesen: für die Antwort ist er
  // ohne Belang, und ein offener Endpunkt, der Fremdes protokolliert, ist eine
  // Senke, die jeder befüllen kann (Befund Fremd-Review, MEDIUM).
  console.log(JSON.stringify({ fn: "ota-channel", event: "kanal_abgelehnt", methode: req.method }));

  // `error` und `message` sind die Felder, die die Kanal-Pfade des Plugins
  // lesen (`CapgoUpdater.java:2512 ff.`). Die Antwort ist damit für das Gerät
  // eine verständliche Absage und kein Formatfehler.
  return new Response(
    JSON.stringify({
      error: "channel_not_supported",
      message: "Dieser Dienst kennt keine Kanaele; es gibt genau einen Auslieferungsweg.",
    }),
    { status: 400, headers: { "content-type": "application/json" } },
  );
});
