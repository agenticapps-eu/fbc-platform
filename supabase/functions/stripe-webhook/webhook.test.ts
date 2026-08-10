// deno test --allow-none  (aus supabase/functions/stripe-webhook/)
import { assertEquals } from "jsr:@std/assert@1";
import { computeSignature, verifyStripeSignature, parseCheckoutCompleted } from "./webhook.ts";

const SECRET = "whsec_test";
const BODY = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
const T = 1_700_000_000;

Deno.test("gültige Signatur verifiziert", async () => {
  const v1 = await computeSignature(BODY, T, SECRET);
  const ok = await verifyStripeSignature(BODY, `t=${T},v1=${v1}`, SECRET, { nowSec: T + 10 });
  assertEquals(ok, true);
});
Deno.test("manipulierter Body scheitert", async () => {
  const v1 = await computeSignature(BODY, T, SECRET);
  const ok = await verifyStripeSignature(BODY + "x", `t=${T},v1=${v1}`, SECRET, { nowSec: T + 10 });
  assertEquals(ok, false);
});
Deno.test("falsches Secret scheitert", async () => {
  const v1 = await computeSignature(BODY, T, SECRET);
  const ok = await verifyStripeSignature(BODY, `t=${T},v1=${v1}`, "whsec_other", {
    nowSec: T + 10,
  });
  assertEquals(ok, false);
});
Deno.test("veralteter Zeitstempel scheitert (Toleranz)", async () => {
  const v1 = await computeSignature(BODY, T, SECRET);
  const ok = await verifyStripeSignature(BODY, `t=${T},v1=${v1}`, SECRET, { nowSec: T + 10_000 });
  assertEquals(ok, false);
});
Deno.test("parseCheckoutCompleted liefert user_id + level", () => {
  const ev = {
    type: "checkout.session.completed",
    data: {
      object: { payment_status: "paid", metadata: { user_id: "u1", level: "exchange" } },
    },
  };
  assertEquals(parseCheckoutCompleted(ev), { userId: "u1", level: "exchange" });
});
Deno.test("anderer Event-Typ → null", () => {
  assertEquals(parseCheckoutCompleted({ type: "invoice.paid", data: { object: {} } }), null);
});
Deno.test("fehlende Metadaten → null", () => {
  assertEquals(
    parseCheckoutCompleted({
      type: "checkout.session.completed",
      data: { object: { metadata: {} } },
    }),
    null,
  );
});

// Der Kern des Audit-Befunds: `checkout.session.completed` bedeutet NICHT
// „bezahlt". Bei verzoegerten Zahlungsarten (SEPA-Lastschrift, Ueberweisung)
// feuert Stripe dieses Event mit `payment_status: "unpaid"` und schickt erst
// spaeter `checkout.session.async_payment_succeeded`. Ohne diese Pruefung
// bekaeme jemand die Stufe in dem Moment, in dem er den Kauf ANSTOESST.
Deno.test("unbezahlte Session → null (verzoegerte Zahlungsart)", () => {
  assertEquals(
    parseCheckoutCompleted({
      type: "checkout.session.completed",
      data: {
        object: { payment_status: "unpaid", metadata: { user_id: "u1", level: "impact" } },
      },
    }),
    null,
  );
});

Deno.test("kostenfreie Session (no_payment_required) → gilt", () => {
  assertEquals(
    parseCheckoutCompleted({
      type: "checkout.session.completed",
      data: {
        object: {
          payment_status: "no_payment_required",
          metadata: { user_id: "u1", level: "connect" },
        },
      },
    }),
    { userId: "u1", level: "connect" },
  );
});

// Ein fehlendes Feld ist kein Freibrief: Stripe schickt `payment_status` bei
// jeder Session. Fehlt es, ist das kein Stripe-Ereignis, wie wir es kennen.
Deno.test("fehlendes payment_status → null", () => {
  assertEquals(
    parseCheckoutCompleted({
      type: "checkout.session.completed",
      data: { object: { metadata: { user_id: "u1", level: "impact" } } },
    }),
    null,
  );
});
