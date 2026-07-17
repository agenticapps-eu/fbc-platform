// deno test --allow-none  (aus supabase/functions/create-checkout-session/)
import { assertEquals } from "jsr:@std/assert@1";
import { jwtSub, parseUpgradeRequest, priceEnvKey, resolveReturnBase } from "./checkout.ts";

// base64url-kodierter JWT-Payload (ohne Signaturprüfung — die macht das Gateway).
function makeJwt(payload: Record<string, unknown>): string {
  const b64url = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "ES256", typ: "JWT" })}.${b64url(payload)}.sig`;
}

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

Deno.test("jwtSub: liest sub aus einem ES256-Token (base64url mit Padding)", () => {
  const sub = "7762d095-1111-2222-3333-444455556666";
  assertEquals(jwtSub(makeJwt({ sub, role: "authenticated" })), sub);
});
Deno.test("jwtSub: undefined bei fehlendem sub", () => {
  assertEquals(jwtSub(makeJwt({ role: "authenticated" })), undefined);
});
Deno.test("jwtSub: undefined bei nicht-String sub", () => {
  assertEquals(jwtSub(makeJwt({ sub: 123 })), undefined);
});
Deno.test("jwtSub: undefined bei kaputtem Token", () => {
  assertEquals(jwtSub("nicht.ein.jwt"), undefined);
  assertEquals(jwtSub(""), undefined);
  assertEquals(jwtSub("onlyonesegment"), undefined);
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
