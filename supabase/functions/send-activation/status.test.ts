// deno test  (aus supabase/functions/send-activation/)
import { assertEquals } from "jsr:@std/assert@1";
import { versandArt } from "./status.ts";

// Die Liste stammt aus dem `comment on function` von issue_activation_token
// (20260807200000): unknown | rate_limited | pending | rate_limited_day |
// issued | issued_reset. Wer dort einen Status hinzufügt, muss hier vorbei.
Deno.test("die beiden Erfolgsfälle werden auseinandergehalten", () => {
  assertEquals(versandArt("issued"), "aktivierung");
  assertEquals(versandArt("issued_reset"), "reset");
});

Deno.test("die vier stillen Ausgänge senden nichts und sind trotzdem erwartet", () => {
  assertEquals(versandArt("unknown"), "kein_versand");
  assertEquals(versandArt("rate_limited"), "kein_versand");
  assertEquals(versandArt("pending"), "kein_versand");
  assertEquals(versandArt("rate_limited_day"), "kein_versand");
});

/**
 * Befund 8.5 aus Review 5.4. Vorher fiel ALLES Unbekannte in denselben
 * `info`-Zweig wie die stillen Ausgänge. Der genannte Ablauf: Function deployt,
 * Migration nicht — die Datenbank antwortet weiter `already_activated`, kein
 * Mitglied bekommt je eine Reset-Mail, und das einzige Signal im Protokoll
 * sieht aus wie der Normalfall.
 */
Deno.test("ein unerwarteter Status ist NICHT dasselbe wie ein stiller Ausgang", () => {
  assertEquals(versandArt("already_activated"), "unerwartet");
  assertEquals(versandArt("tippfehler"), "unerwartet");
  assertEquals(versandArt(""), "unerwartet");
  // Kommt die Zeile ohne `status` zurück, ist das derselbe Fall: etwas stimmt
  // nicht mit der Datenbankseite, und niemand darf das für Normalbetrieb halten.
  assertEquals(versandArt(undefined), "unerwartet");
});
