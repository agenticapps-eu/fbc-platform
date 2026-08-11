// deno test --allow-none  (aus supabase/functions/admin-change-email/)
import { assertEquals } from "jsr:@std/assert@1";
import { parseChangeEmailRequest, summarizeOutcome } from "./change-email.ts";

const ZIEL = "c6c6c6c6-0000-0000-0000-0000000000b1";

Deno.test("gültiger Rumpf wird angenommen und die Adresse getrimmt", () => {
  assertEquals(parseChangeEmailRequest({ target: ZIEL, email: "  neu@fbc.de " }), {
    target: ZIEL,
    email: "neu@fbc.de",
  });
});

Deno.test("eine Ziel-ID, die keine UUID ist, wird abgelehnt", () => {
  assertEquals(parseChangeEmailRequest({ target: "irgendwer", email: "neu@fbc.de" }), null);
});

Deno.test("eine Adresse ohne @ wird abgelehnt", () => {
  assertEquals(parseChangeEmailRequest({ target: ZIEL, email: "neu.fbc.de" }), null);
});

Deno.test("eine leere Adresse wird abgelehnt", () => {
  assertEquals(parseChangeEmailRequest({ target: ZIEL, email: "   " }), null);
});

Deno.test("fehlende Felder werden abgelehnt", () => {
  assertEquals(parseChangeEmailRequest({ target: ZIEL }), null);
  assertEquals(parseChangeEmailRequest(null), null);
  assertEquals(parseChangeEmailRequest("neu@fbc.de"), null);
});

// Der Fall, den das Fremd-Review benannt hat: die Adresse IST geändert, nur die
// Sitzungen sind noch da. Als Gesamtfehler gemeldet, wiederholte der Admin eine
// Änderung, die längst gilt.
Deno.test("gescheitertes Sitzungs-Widerrufen ist ein eigener Zustand, kein Fehler", () => {
  assertEquals(summarizeOutcome(null), { status: "ok" });
  assertEquals(summarizeOutcome("timeout"), {
    status: "sessions_not_revoked",
    detail: "timeout",
  });
});
