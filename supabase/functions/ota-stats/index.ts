// ota-stats — der `statsUrl`-Endpunkt (AGE-642, Phase D3).
//
// ══ EIN SENKE, KEIN DIENST ══════════════════════════════════════════════════
// Diese Function nimmt entgegen und speichert nichts. Sie existiert aus
// demselben Grund wie ota-channel: eine leere `statsUrl` schaltet die Statistik
// nicht ab, sondern schickt sie an `https://plugin.capgo.app/stats`
// (`CapacitorUpdaterPlugin.java`, `statsUrlDefault`).
//
// **Diese Datei entscheidet nichts.** Welche Form der Rumpf hat, welche Grenzen
// gelten, was ins Log geht und welcher Status hinausgeht — alles steht in
// `meldung.ts` und wird dort ausfuehrbar geprueft. Hier stehen nur die zwei
// echten Abhaengigkeiten: der Server und die Konsole.
//
// ══ EIN OFFENER ENDPUNKT IST EINE OFFENE SENKE ══════════════════════════════
// `verify_jwt = false` heisst: jeder kann hier POSTen, nicht nur unsere Geräte.
// Der Fremd-Review hat daraus zu Recht einen Befund gemacht (MEDIUM, 31.08.):
// die erste Fassung schrieb `action` UNBESCHNITTEN ins Log. Ein Megabyte je
// Anfrage, so oft jemand mag — Kosten und Rauschen, ohne dass irgendetwas
// kaputtgeht, das auffiele.
//
// Drei Grenzen, alle in `meldung.ts`: `RUMPF_GRENZE`, `ACTION_GRENZE` je
// Ereignis, und `MAX_EREIGNISSE` Aktionen je Zeile.
//
// **Was sie NICHT leisten:** `req.text()` puffert den Rumpf vollstaendig, bevor
// irgendetwas ihn messen kann, und eine Ratenbegrenzung gibt es nicht. Wer den
// Speicher oder die Anfragezahl deckeln will, braucht das Gateway — beide
// Fremd-Reviews haben das bestaetigt, und keine Zeile hier aendert es. Bis
// 02.09. behauptete der Kommentar an dieser Stelle das Gegenteil.
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

import { behandleAnfrage } from "./meldung.ts";

Deno.serve((req) =>
  behandleAnfrage(req, (level, zeile) => (level === "warn" ? console.warn : console.log)(zeile))
);
