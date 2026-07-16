// deno test --allow-none  (aus supabase/functions/create-checkout-session/)
import { assertEquals } from "jsr:@std/assert@1";
import { parseUpgradeRequest, priceEnvKey, resolveReturnBase } from "./checkout.ts";

Deno.test("gültiges Upgrade wird akzeptiert", () => {
  const r = parseUpgradeRequest({ level: "exchange", interval: "year" }, 1); // Aufrufer basic(1)
  assertEquals(r, { ok: true, value: { level: "exchange", interval: "year" } });
});
Deno.test("freie Stufe ist kein Checkout", () => {
  assertEquals(parseUpgradeRequest({ level: "connect", interval: "year" }, 1).ok, false);
});
Deno.test("unbekanntes Level wird abgelehnt", () => {
  assertEquals(parseUpgradeRequest({ level: "gold", interval: "year" }, 1).ok, false);
});
Deno.test("ungültiges Interval wird abgelehnt", () => {
  assertEquals(parseUpgradeRequest({ level: "focus", interval: "weekly" }, 1).ok, false);
});
Deno.test("Downgrade/Gleichstand wird abgelehnt", () => {
  assertEquals(parseUpgradeRequest({ level: "discover", interval: "year" }, 3).ok, false); // schon discover(3)
  assertEquals(parseUpgradeRequest({ level: "connect", interval: "year" }, 4).ok, false);
});
Deno.test("priceEnvKey mappt Level+Interval", () => {
  assertEquals(priceEnvKey("exchange", "year"), "STRIPE_PRICE_EXCHANGE_YEAR");
  assertEquals(priceEnvKey("impact", "month"), "STRIPE_PRICE_IMPACT_MONTH");
});

const ALLOWED = ["http://localhost:5173", "https://fbc-platform.pages.dev"];
Deno.test("resolveReturnBase: erlaubte Origin wird zurückgegeben", () => {
  assertEquals(
    resolveReturnBase("https://fbc-platform.pages.dev", ALLOWED),
    "https://fbc-platform.pages.dev",
  );
  assertEquals(resolveReturnBase("http://localhost:5173", ALLOWED), "http://localhost:5173");
});
Deno.test(
  "resolveReturnBase: fremde Origin fällt auf den ersten Eintrag zurück (kein Open-Redirect)",
  () => {
    assertEquals(resolveReturnBase("https://evil.example", ALLOWED), "http://localhost:5173");
  },
);
Deno.test("resolveReturnBase: fehlende Origin fällt zurück", () => {
  assertEquals(resolveReturnBase(null, ALLOWED), "http://localhost:5173");
});
Deno.test("resolveReturnBase: normalisiert trailing slashes", () => {
  assertEquals(
    resolveReturnBase("https://fbc-platform.pages.dev/", ["https://fbc-platform.pages.dev"]),
    "https://fbc-platform.pages.dev",
  );
});
