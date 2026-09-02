// ota-stats — der `statsUrl`-Endpunkt (AGE-642, Phase D3).
//
// ══ EIN SENKE, KEIN DIENST ══════════════════════════════════════════════════
// Diese Function nimmt entgegen und speichert nichts. Sie existiert aus
// demselben Grund wie ota-channel: eine leere `statsUrl` schaltet die Statistik
// nicht ab, sondern schickt sie an `https://plugin.capgo.app/stats`
// (`CapacitorUpdaterPlugin.java:99`).
//
// Welche Form der Rumpf hat — ein Stapel als Array, daneben die Einzelform —
// steht mit den Belegstellen beider Schalen in `meldung.ts`. Dort wird sie auch
// geprueft; dieser Rumpf baut nur noch die Abhaengigkeiten.
//
// ══ EIN OFFENER ENDPUNKT IST EINE OFFENE SENKE ══════════════════════════════
// `verify_jwt = false` heisst: jeder kann hier POSTen, nicht nur unsere Geräte.
// Der Fremd-Review hat daraus zu Recht einen Befund gemacht (MEDIUM, 31.08.):
// die erste Fassung las `action` aus dem Rumpf und schrieb es UNBESCHNITTEN ins
// Log. Ein Megabyte je Anfrage, so oft jemand mag — Kosten und Rauschen, ohne
// dass irgendetwas kaputtgeht, das auffiele.
//
// Drei Grenzen, alle in `meldung.ts`: der Rumpf wird oberhalb von
// `RUMPF_GRENZE` verworfen, je Ereignis geht `action` nur bis `ACTION_GRENZE`
// ins Log, und hoechstens `MAX_EREIGNISSE` Aktionen kommen in eine Zeile.
// Ratenbegrenzung gehört ans Gateway und ist hier ausdrücklich NICHT gelöst.
//
// Die Grenze greift NACH dem Lesen: `req.text()` puffert den Rumpf vollstaendig,
// bevor irgendetwas ihn messen kann. Wer den Speicher davor schuetzen will,
// braucht das Gateway, nicht diese Zeile — bis 02.09. behauptete der Kommentar
// an dieser Stelle das Gegenteil.
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

import { werteRumpf } from "./meldung.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const meldung = werteRumpf(await req.text());

  if (meldung.event === "rumpf_zu_gross") {
    console.warn(JSON.stringify({ fn: "ota-stats", event: meldung.event, laenge: meldung.laenge }));
    return new Response("Payload Too Large", { status: 413 });
  }

  if (meldung.event === "rumpf_unlesbar") {
    // Weiterhin 200, aber nicht mehr `ok`: das Gerät wertet die Antwort auf
    // Statistik nicht aus, und ein 4xx löste nur eine Wiederholung aus, die
    // nichts besser machte. Ein `ok` auf einen verworfenen Rumpf machte
    // allerdings Zustellung und Verlust ununterscheidbar (Befund Fremd-Review,
    // LOW) — deshalb sagt die Antwort jetzt, was wirklich passiert ist.
    console.warn(JSON.stringify({ fn: "ota-stats", event: meldung.event }));
    return new Response(JSON.stringify({ status: "discarded" }), {
      headers: { "content-type": "application/json" },
    });
  }

  // `gesamt` ist das GESENDETE, `actions` das protokollierte. Weichen sie ab,
  // hat `MAX_EREIGNISSE` gegriffen — und das steht dann da, statt still zu
  // passieren.
  console.log(JSON.stringify({
    fn: "ota-stats",
    event: meldung.event,
    gesamt: meldung.gesamt,
    actions: meldung.actions,
  }));
  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { "content-type": "application/json" },
  });
});
