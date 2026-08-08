// deno test  (aus supabase/functions/send-activation/)
import { assertEquals } from "jsr:@std/assert@1";
import { ausgangNachRpc } from "./rpc-ausgang.ts";

Deno.test("ein ausgegebenes Token wird versendet — beide Zwecke", () => {
  assertEquals(ausgangNachRpc(undefined, "issued"), "versenden");
  assertEquals(ausgangNachRpc(undefined, "issued_reset"), "versenden");
});

Deno.test("die nicht-ausgebenden Ausgänge werden still angenommen", () => {
  for (const status of ["unknown", "rate_limited", "pending", "rate_limited_day"]) {
    assertEquals(ausgangNachRpc(undefined, status), "still_angenommen", status);
  }
});

Deno.test(
  "der Verlierer eines gleichzeitigen Wettlaufs wird still angenommen, nicht 502 (Befund 8.1)",
  () => {
    // Der Kern: für eine UNBEKANNTE Adresse endet eine Doppelanfrage zweimal
    // mit 202. Bliebe der Verlierer bei 502, unterschiede ein einziges
    // Anfragenpaar Mitglied von Nicht-Mitglied — und die Immer-202-Konstruktion
    // wäre umgangen.
    assertEquals(ausgangNachRpc("23505", undefined), "still_angenommen");
  },
);

Deno.test("jeder ANDERE Fehler bleibt ein Serverfehler", () => {
  // Ein echter Ausfall darf nicht in der Anti-Aufzählung verschwinden:
  // „hat nicht geklappt" ist nicht dasselbe wie „gibt es nicht".
  assertEquals(ausgangNachRpc("42501", undefined), "serverfehler"); // insufficient_privilege
  assertEquals(ausgangNachRpc("57014", undefined), "serverfehler"); // query_canceled
  assertEquals(ausgangNachRpc("PGRST202", undefined), "serverfehler");
});

Deno.test("ein Fehler schlägt einen mitgelieferten Status", () => {
  // PostgREST kann bei einem Fehler trotzdem einen Rumpf mitliefern. Der Fehler
  // entscheidet, nicht der Status — sonst würde ein Ausfall als Versand gelesen.
  assertEquals(ausgangNachRpc("42501", "issued"), "serverfehler");
  assertEquals(ausgangNachRpc("23505", "issued"), "still_angenommen");
});
