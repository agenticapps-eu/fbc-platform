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
    data: { object: { metadata: { user_id: "u1", level: "exchange" } } },
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
