import { CapacitorUpdater } from "@capgo/capacitor-updater";

/**
 * Die Startbestätigung des Luftwegs (AGE-642, Phase D4) — der Rückweg.
 *
 * **Ein Nebenwirkungs-Modul, kein Export.** Es wird in `main.tsx` importiert
 * und sonst nirgends, genau wie `./instrument`. Der Import IST der Aufruf.
 * Damit gibt es keine Stelle, an der jemand vergessen kann, eine Funktion zu
 * rufen — und „vergessen" ist hier kein Schönheitsfehler, sondern der teuerste
 * Fehler dieses Changes: ohne Bestätigung rollt JEDES Gerät jedes Bündel
 * zurück, auch die heilen. Bewacht wird die Stelle trotzdem, von
 * `ota.test.ts` („wird von `main.tsx` als zweiter Import eingebunden").
 *
 * **Warum es das überhaupt gibt.** Die Prüfsumme aus D3 schützt gegen ein
 * *fremdes* Bündel. Gegen ein *eigenes, kaputtes* schützt sie nicht: ein
 * gültig signiertes Bündel, das startet und dann weiß bleibt, bräche jedes
 * Gerät dauerhaft — bis eine neue Schale durch den Store geht, also ein bis
 * drei Tage, und das für genau die Menschen, die am wenigsten davon verstehen.
 * Deshalb bestätigt die Anwendung ihren Start ausdrücklich; bleibt die
 * Bestätigung aus, geht die vorige Fassung wieder in Betrieb
 * (`CapacitorUpdaterPlugin.swift:3353`, `.java:5141` — `checkRevert`).
 *
 * **Und deshalb bestätigt sie NICHT sofort.** Bis zum 31.08. stand der Aufruf
 * blank im Modulrumpf und ging damit ab, bevor überhaupt ein Bild stand — vor
 * `AuthProvider`, vor `src/lib/supabase.ts:10`, das bei fehlender Konfiguration
 * wirft, und vor dem ersten Rendern. Ein Bündel, das lädt und dann weiß bleibt,
 * war so bereits als erfolgreich gestempelt: der Rückweg deckte genau das
 * Szenario nicht ab, für das es ihn gibt. Gefunden im Diff-Review, Runde 6.
 *
 * Das Zeichen, auf das er stattdessen wartet, ist das einzige, das „die
 * Oberfläche steht" bedeutet, ohne etwas über sie zu wissen: der erste
 * Element-Knoten unter `#root`. Er kommt aus Reacts erstem Commit. Kommt er
 * nicht, ist der Bildschirm leer — und dann SOLL die Bestätigung ausbleiben.
 *
 * **Was das nicht abdeckt, mit Absicht:** greift die oberste `ErrorBoundary`,
 * steht mit `ErrorFallback` ebenfalls ein Bild — das zählt hier als
 * „gestartet". Ein Rückfall auf jeden abgefangenen Renderfehler wäre zu grob;
 * die Fläche hat einen eigenen Weg zurück und meldet nach Sentry.
 *
 * **Die Frist läuft ab dem Start der Schale, nicht ab diesem Modul:**
 * `appReadyTimeout`, 10 000 ms per Vorgabe (`.swift:284`, `.java:876`) — auf
 * Android für ein noch nicht bestätigtes Bündel mindestens 30 000 ms
 * (`PENDING_BUNDLE_APP_READY_MIN_TIMEOUT_MS`, `.java:134`, angewandt in
 * `resolveAppReadyCheckTimeoutMs()`, `.java:1043-1055`). Für einen Commit aus
 * lokal liegenden Web-Assets ist das reichlich; `AuthProvider` hält das erste
 * Bild nicht auf, es reicht seine Kinder unverzüglich durch
 * (`AuthProvider.tsx:358`), das Warten auf die Sitzung geschieht dahinter.
 *
 * **Ohne Plattform-Bedingung.** Im Web ist der Aufruf ein
 * `return { bundle: BUNDLE_BUILTIN }` (`dist/esm/web.js:172-173`) — er kostet
 * nichts, warnt nicht und kann nicht scheitern. Ein `if (nativ)` spart also
 * nichts und fügt eine Stelle hinzu, an der die Bestätigung ausbleiben kann.
 *
 * **Und ohne `await`.** Ein top-level `await` machte aus einer hakenden
 * Brücke einen Startfehler — genau den Zustand, gegen den dieses Modul steht.
 * Der Fehlerzweig protokolliert nur; er darf den Start nicht anhalten.
 */
function bestaetigeStart(): void {
  CapacitorUpdater.notifyAppReady().catch((fehler: unknown) => {
    // `instanceof`, nicht `as Error`: eine Ablehnung mit einem String oder einem
    // schlichten Objekt hätte sonst `undefined` protokolliert — und bei `null`
    // würfe der Fehlerzweig selbst.
    console.error(
      "[ota] Startbestätigung nicht abgesetzt:",
      fehler instanceof Error ? fehler.message : String(fehler),
    );
  });
}

const wurzel = document.getElementById("root");

if (wurzel?.firstElementChild) {
  // Steht schon ein Bild, ist nichts mehr abzuwarten. Heute unerreichbar —
  // dieses Modul wird vor `createRoot` ausgewertet —, aber ohne den Zweig
  // bliebe die Bestätigung fuer immer aus, wenn der Import je nach hinten
  // rutscht. Und „bleibt aus" heisst hier: jedes Geraet rollt jedes Buendel
  // zurueck.
  bestaetigeStart();
} else if (wurzel) {
  const beobachter = new MutationObserver(() => {
    if (!wurzel.firstElementChild) return;
    beobachter.disconnect();
    bestaetigeStart();
  });
  beobachter.observe(wurzel, { childList: true });
}
// Kein `#root`: dann wirft `main.tsx` unmittelbar danach, der Bildschirm bleibt
// leer, und der Rueckfall ist die richtige Antwort. Also ausdruecklich nichts.
