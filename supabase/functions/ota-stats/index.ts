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
// ══ EIN OFFENER ENDPUNKT IST EINE OFFENE SENKE ══════════════════════════════
// `verify_jwt = false` heisst: jeder kann hier POSTen, nicht nur unsere Geräte.
// Der Fremd-Review hat daraus zu Recht einen Befund gemacht (MEDIUM, 31.08.):
// die erste Fassung las `action` aus dem Rumpf und schrieb es UNBESCHNITTEN ins
// Log. Ein Megabyte je Anfrage, so oft jemand mag — Kosten und Rauschen, ohne
// dass irgendetwas kaputtgeht, das auffiele.
//
// Zwei Grenzen, beide vor dem Parsen bzw. vor dem Log: der Rumpf wird nur bis
// `RUMPF_GRENZE` gelesen, und `action` nur bis `ACTION_GRENZE` protokolliert.
// Ratenbegrenzung gehört ans Gateway und ist hier ausdrücklich NICHT gelöst.
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

/** Grosszügig über jedem echten Rumpf des Plugins und weit unter allem, was wehtut. */
const RUMPF_GRENZE = 8 * 1024;
/** `action` ist ein kurzes Schlüsselwort (`set`, `delete`, `update_fail`, …). */
const ACTION_GRENZE = 64;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const roh = await req.text();
  if (roh.length > RUMPF_GRENZE) {
    console.warn(JSON.stringify({ fn: "ota-stats", event: "rumpf_zu_gross", laenge: roh.length }));
    return new Response("Payload Too Large", { status: 413 });
  }

  let action: string;
  try {
    const rumpf = JSON.parse(roh);
    action = typeof rumpf?.action === "string" ? rumpf.action.slice(0, ACTION_GRENZE) : "ohne";
  } catch {
    // Weiterhin 200, aber nicht mehr `ok`: das Gerät wertet die Antwort auf
    // Statistik nicht aus, und ein 4xx löste nur eine Wiederholung aus, die
    // nichts besser machte. Ein `ok` auf einen verworfenen Rumpf machte
    // allerdings Zustellung und Verlust ununterscheidbar (Befund Fremd-Review,
    // LOW) — deshalb sagt die Antwort jetzt, was wirklich passiert ist.
    console.warn(JSON.stringify({ fn: "ota-stats", event: "rumpf_unlesbar" }));
    return new Response(JSON.stringify({ status: "discarded" }), {
      headers: { "content-type": "application/json" },
    });
  }

  console.log(JSON.stringify({ fn: "ota-stats", event: "gemeldet", action }));
  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { "content-type": "application/json" },
  });
});
