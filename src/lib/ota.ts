import { CapacitorUpdater } from "@capgo/capacitor-updater";

/**
 * Die Startbestätigung des Luftwegs (AGE-642, Phase D4) — der Rückweg.
 *
 * **Ein Nebenwirkungs-Modul, kein Export.** Es wird in `main.tsx` importiert
 * und sonst nirgends, genau wie `./instrument`. Der Import IST der Aufruf.
 * Damit gibt es keine Stelle, an der jemand vergessen kann, eine Funktion zu
 * rufen — und „vergessen" ist hier kein Schönheitsfehler, sondern der teuerste
 * Fehler dieses Changes: ohne Bestätigung rollt JEDES Gerät jedes Bündel
 * zurück, auch die heilen.
 *
 * **Warum es das überhaupt gibt.** Die Prüfsumme aus D3 schützt gegen ein
 * *fremdes* Bündel. Gegen ein *eigenes, kaputtes* schützt sie nicht: ein
 * gültig signiertes Bündel, das startet und dann weiß bleibt, bräche jedes
 * Gerät dauerhaft — bis eine neue Schale durch den Store geht, also ein bis
 * drei Tage, und das für genau die Menschen, die am wenigsten davon verstehen.
 * Deshalb bestätigt die Anwendung ihren Start ausdrücklich; bleibt die
 * Bestätigung aus, geht die vorige Fassung wieder in Betrieb
 * (`CapacitorUpdaterPlugin.swift:3353`, `.java:5140` — `checkRevert`).
 *
 * **Die Frist läuft ab dem Start der Schale, nicht ab diesem Aufruf:**
 * `appReadyTimeout`, 10 000 ms per Vorgabe (`.swift:284`, `.java:876`). Das
 * Modul gehört deshalb an den Anfang von `main.tsx` und VOR alles, was auf
 * das Netz wartet. Das Plugin sagt dasselbe in `definitions.d.ts:433`:
 * „Call this BEFORE any network requests."
 *
 * **Ohne Plattform-Bedingung.** Im Web ist der Aufruf ein
 * `return { bundle: BUNDLE_BUILTIN }` (`dist/esm/web.js:172`) — er kostet
 * nichts, warnt nicht und kann nicht scheitern. Ein `if (nativ)` spart also
 * nichts und fügt eine Stelle hinzu, an der die Bestätigung ausbleiben kann.
 *
 * **Und ohne `await`.** Ein top-level `await` machte aus einer hakenden
 * Brücke einen Startfehler — genau den Zustand, gegen den dieses Modul steht.
 * Der Fehlerzweig protokolliert nur; er darf den Start nicht anhalten.
 */
CapacitorUpdater.notifyAppReady().catch((e: unknown) => {
  console.error("[ota] Startbestätigung nicht abgesetzt:", (e as Error).message);
});
