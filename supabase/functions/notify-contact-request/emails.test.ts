// deno test --allow-none  (run from supabase/functions/notify-contact-request/)
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  escapeHtml,
  renderAccepted,
  renderDeclined,
  renderNewRequest,
  selectNotification,
  passtZurDatenbank,
  type ContactRequestRow,
  type WebhookPayload,
} from "./emails.ts";

const row = (over: Partial<ContactRequestRow> = {}): ContactRequestRow => ({
  id: "req-1",
  from_id: "A",
  to_id: "B",
  match_id: "m-1",
  message: null,
  status: "pending",
  created_at: "2026-06-14T00:00:00Z",
  ...over,
});

const payload = (over: Partial<WebhookPayload>): WebhookPayload => ({
  type: "INSERT",
  table: "contact_requests",
  schema: "public",
  record: row(),
  old_record: null,
  ...over,
});

Deno.test("INSERT → new_request, recipient is to_id, other is from_id", () => {
  const d = selectNotification(
    payload({ type: "INSERT", record: row({ from_id: "A", to_id: "B" }) }),
  );
  assertEquals(d?.kind, "new_request");
  assertEquals(d?.recipientId, "B");
  assertEquals(d?.otherId, "A");
});

Deno.test("UPDATE→accepted → sender (from_id) is notified about to_id", () => {
  const d = selectNotification(
    payload({
      type: "UPDATE",
      record: row({ status: "accepted" }),
      old_record: row({ status: "pending" }),
    }),
  );
  assertEquals(d?.kind, "accepted");
  assertEquals(d?.recipientId, "A");
  assertEquals(d?.otherId, "B");
});

Deno.test("UPDATE→declined → sender is notified", () => {
  const d = selectNotification(
    payload({
      type: "UPDATE",
      record: row({ status: "declined" }),
      old_record: row({ status: "pending" }),
    }),
  );
  assertEquals(d?.kind, "declined");
  assertEquals(d?.recipientId, "A");
});

Deno.test("UPDATE with unchanged status → no email", () => {
  const d = selectNotification(
    payload({
      type: "UPDATE",
      record: row({ status: "accepted" }),
      old_record: row({ status: "accepted" }),
    }),
  );
  assertEquals(d, null);
});

Deno.test("DELETE and null record → no email", () => {
  assertEquals(
    selectNotification(payload({ type: "DELETE", record: null, old_record: row() })),
    null,
  );
  assertEquals(selectNotification(payload({ type: "INSERT", record: null })), null);
});

Deno.test("INSERT of a non-pending row → no email", () => {
  assertEquals(
    selectNotification(payload({ type: "INSERT", record: row({ status: "accepted" }) })),
    null,
  );
});

Deno.test("UPDATE without old_record → no email (fail closed)", () => {
  assertEquals(
    selectNotification(
      payload({ type: "UPDATE", record: row({ status: "accepted" }), old_record: null }),
    ),
    null,
  );
});

Deno.test("escapeHtml neutralizes injection", () => {
  assertEquals(escapeHtml('<script>"x"</script>'), "&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
});

Deno.test("renderNewRequest: subject has name, message escaped, CTA only with appUrl", () => {
  const e = renderNewRequest({
    fromName: "Max <b>",
    message: "Hallo & willkommen",
    appUrl: "https://app.test",
  });
  assertEquals(e.subject, "Neue Kontaktanfrage von Max <b>");
  assertStringIncludes(e.html, "Max &lt;b&gt;");
  assertStringIncludes(e.html, "Hallo &amp; willkommen");
  assertStringIncludes(e.html, "https://app.test");
  assert(!renderNewRequest({ fromName: "X", message: null }).html.includes('href="undefined"'));
});

Deno.test("renderAccepted: chat CTA appears with appUrl", () => {
  const e = renderAccepted({ toName: "Erika", appUrl: "https://app.test" });
  assertStringIncludes(e.subject, "angenommen");
  assertStringIncludes(e.html, "Zum Chat");
  assertStringIncludes(e.text, "https://app.test");
});

Deno.test("renderDeclined: no contact data shared", () => {
  const e = renderDeclined({ toName: "Erika" });
  assertStringIncludes(e.subject, "nicht angenommen");
  assertStringIncludes(e.text, "keine Kontaktdaten");
});

Deno.test("empty names fall back to neutral wording", () => {
  assertEquals(
    renderNewRequest({ fromName: "  ", message: null }).subject,
    "Neue Kontaktanfrage von Ein Mitglied",
  );
  assertStringIncludes(renderAccepted({ toName: "" }).html, "Das Mitglied");
});

// ── Der Befund aus 8.6: `record` wurde nie gegen die Tabelle geprüft ─────────
// Der Endpunkt steht hinter einem Shared Secret, aber das Secret sagt nur „der
// Aufruf kommt vom Webhook", nicht „diese Zeile existiert". Wer es hat, schickt
// eine erfundene Zeile — beliebiger Empfänger, beliebiger Absendername,
// beliebiger Text — und die Mail geht unter der Absenderadresse des Clubs raus.

Deno.test("passtZurDatenbank: die echte Zeile passt", () => {
  assertEquals(passtZurDatenbank(row(), row()), true);
});

Deno.test("passtZurDatenbank: keine Zeile in der Tabelle → nein", () => {
  assertEquals(passtZurDatenbank(row(), null), false);
});

Deno.test("passtZurDatenbank: umgelenkter Empfänger → nein", () => {
  assertEquals(passtZurDatenbank(row({ to_id: "Opfer" }), row()), false);
});

Deno.test("passtZurDatenbank: erfundener Status → nein", () => {
  assertEquals(passtZurDatenbank(row({ status: "accepted" }), row()), false);
});
