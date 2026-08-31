// ota-stats — der `statsUrl`-Endpunkt (AGE-642, Phase D3).
//
// ══ EIN SENKE, KEIN DIENST ══════════════════════════════════════════════════
// Diese Function nimmt entgegen und speichert nichts. Sie existiert aus
// demselben Grund wie ota-channel: eine leere `statsUrl` schaltet die Statistik
// nicht ab, sondern schickt sie an `https://plugin.capgo.app/stats`
// (`CapacitorUpdaterPlugin.java:99`). Der Rumpf ist `createInfoObject()` plus
// `action`, `version_name`, `old_version_name` und `timestamp`
// (`CapgoUpdater.java:2850-2853`) — er trägt `device_id` und `app_id`.
//
// ══ WAS NICHT INS LOG GEHT, UND WARUM ═══════════════════════════════════════
// Protokolliert wird `action` und sonst nichts. `device_id` ist eine je
// Installation stabile Kennung, also ein Personenbezug im Sinne der DSGVO,
// sobald er neben irgendetwas anderem steht. Ein Log ist der bequemste Ort, an
// dem so etwas jahrelang liegen bleibt, ohne dass es je jemand beschlossen hat.
// `action` allein sagt, ob der Luftweg überhaupt arbeitet, und das ist der
// ganze Zweck dieser Zeile.
//
// Sollte je eine echte Auswertung gewünscht sein, ist das eine eigene
// Entscheidung mit einer eigenen Tabelle — nicht eine Erweiterung dieser Zeile.
//
// ── Warum verify_jwt = false ────────────────────────────────────────────────
// Wie bei ota-update: ein Gerät hat kein JWT. Ohne den `config.toml`-Block
// gälte `true` und das Gateway antwortete mit 401, bevor dieser Handler läuft.

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let action = "unbekannt";
  try {
    const rumpf = await req.json();
    if (typeof rumpf?.action === "string") action = rumpf.action;
  } catch {
    // Ein unlesbarer Rumpf ist hier kein Fehlerfall: das Gerät erwartet auf
    // Statistik keine Antwort, die es auswertet, und ein 400 loeste bei ihm
    // eine Wiederholung aus, die nichts besser machte.
  }

  console.log(JSON.stringify({ fn: "ota-stats", event: "gemeldet", action }));
  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { "content-type": "application/json" },
  });
});
