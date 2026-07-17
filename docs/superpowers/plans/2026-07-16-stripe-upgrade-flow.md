# Stripe Test-Mode Upgrade-Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mitglieder können ihre Stufe im Stripe-Test-Mode upgraden — Pricing-Screen → Checkout (Jahr/Monat) → Webhook setzt `profiles.tier` → gesperrter Inhalt wird sichtbar.

**Architecture:** Zwei Supabase-Edge-Functions (Deno): `create-checkout-session` (auth, erstellt eine Subscription-Checkout-Session per Stripe-REST) und `stripe-webhook` (`verify_jwt=false`, verifiziert die Stripe-Signatur per HMAC und ruft die service-role-only RPC `apply_upgrade`). Der Tier wird ausschließlich im Webhook gesetzt (Webhook = Wahrheit); die RLS-Rechte-Matrix (bereits gebaut) greift danach automatisch. Frontend: ein `/mitgliedschaft`-Screen mit Jahr/Monat-Toggle plus ein Upgrade-CTA in der `MembershipGate`-Wand.

**Tech Stack:** TypeScript strict · React 19 + react-router 7 · Vitest + Testing Library · Supabase (Postgres, RLS, pgTAP) · Deno Edge Functions · Stripe REST (Test-Mode).

## Global Constraints

- Branch: `donald/age-259-stripe-upgrade-flow` (bereits angelegt). Nie auf `main` committen.
- Conventional Commits, jede Message referenziert **AGE-259**.
- Keine Secrets im Repo. Stripe-Keys/Preis-IDs leben **nur** in der Edge-Function-Env (Infisical → `supabase secrets`), nie im Client-Bundle.
- `profiles.tier` ist clientseitig **nicht** schreibbar (Spalten-Grant-Modell) — nie aufweichen. Der Webhook schreibt via Service-Role.
- Nur **Upgrade** diese Woche: `apply_upgrade` setzt `tier` nur, wenn der Ziel-Rang höher ist; die UI zeigt keine Downgrade-Aktion.
- Preise/Labels sind Config (`src/config/levels.ts`), die Upgrade-Mechanik bleibt modell-agnostisch.
- Neue Migrationen/RPCs erben **keine** Grants (AGE-312) — Grants explizit aussprechen.
- pgTAP: `alike()` statt `like()`; `try_as()` meldet jeden Fehler als `DENIED:<err>`.
- **Execution-Grenze:** Der echte End-to-End-Checkout (Task 7-Runbook) ist blockiert, bis Donald die 4 Test-Produkte (je Jahres- + Monatspreis → 8 Preis-IDs) + Keys in Infisical anlegt. Tasks 1–6 sind ohne Live-Keys baubar und per Unit-Test grün zu bekommen.

**Level-Ränge (überall identisch):** `basic`=1 `connect`=2 `discover`=3 `exchange`=4 `focus`=5 `impact`=6. Zahlende Stufen: `discover|exchange|focus|impact`.

---

### Task 1: `apply_upgrade` RPC + pgTAP

**Files:**
- Create: `supabase/migrations/20260716120000_stripe_upgrade.sql`
- Test/Modify: `supabase/tests/rls_test.sql` (Plan `44` → `53`; 9 neue Assertions vor `finish()`)

**Interfaces:**
- Produces: `public.apply_upgrade(p_user_id uuid, p_level text) returns text` — SECURITY DEFINER, service-role-only. Setzt `profiles.tier = p_level`, wenn der Ziel-`level_rank` höher ist als der aktuelle; sonst No-op. Gibt den effektiven Tier zurück. Wirft `22023` bei unbekanntem Level.

- [ ] **Step 1: Failing pgTAP-Tests schreiben.** In `supabase/tests/rls_test.sql` `select plan(44);` → `select plan(53);` ändern und direkt **vor** `select * from finish();` einfügen:

```sql
-- ── apply_upgrade: nur-Upgrade, idempotent, service-role-only (§3.3/§3.4) ─────
-- Läuft am Ende, weil es Fixture-Tiers mutiert; frühere Assertions sind durch.
select is(public.apply_upgrade('11111111-1111-1111-1111-111111111111', 'discover'),
  'discover', 'apply_upgrade Basic→Discover gibt den neuen Tier zurück');
select is((select tier from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'discover', 'profiles.tier steht danach auf discover');
select is(public.apply_upgrade('11111111-1111-1111-1111-111111111111', 'discover'),
  'discover', 'Wiederholung ist idempotent — kein Fehler, gleicher Tier');
select is(public.apply_upgrade('66666666-6666-6666-6666-666666666666', 'discover'),
  'impact', 'Ein tieferes Ziel downgradet NICHT — Impact bleibt Impact');
select throws_ok(
  $$ select public.apply_upgrade('11111111-1111-1111-1111-111111111111'::uuid, 'bogus') $$,
  '22023', 'unknown level: bogus', 'Unbekanntes Level wirft 22023');
select is(has_function_privilege('anon', 'public.apply_upgrade(uuid, text)', 'execute'),
  false, 'anon darf apply_upgrade nicht ausführen');
select is(has_function_privilege('authenticated', 'public.apply_upgrade(uuid, text)', 'execute'),
  false, 'authenticated darf apply_upgrade nicht ausführen');
select is(has_function_privilege('service_role', 'public.apply_upgrade(uuid, text)', 'execute'),
  true, 'service_role darf apply_upgrade ausführen (der Webhook-Weg)');
select alike(
  pg_temp.try_as('11111111-1111-1111-1111-111111111111',
    'update public.profiles set tier = ''impact'' where id = ''11111111-1111-1111-1111-111111111111'''),
  'DENIED:%', 'authenticated kann profiles.tier NICHT selbst schreiben (Spalten-Grant)');
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen.**

Run: `supabase test db supabase/tests/grants_test.sql supabase/tests/rls_test.sql`
Expected: FAIL (`function public.apply_upgrade(uuid, text) does not exist`).

- [ ] **Step 3: Migration schreiben.** `supabase/migrations/20260716120000_stripe_upgrade.sql`:

```sql
-- Stripe Test-Mode Upgrade-Flow (AGE-259). Forward-only.
-- Spec: docs/superpowers/specs/2026-07-16-stripe-upgrade-flow-design.md §3.3/§3.4
--
-- apply_upgrade ist der EINZIGE Weg, auf dem ein Tier steigt: der stripe-webhook
-- ruft ihn per Service-Role nach `checkout.session.completed`. Die Regel (nur höher)
-- lebt hier, nicht im Webhook — so ist sie in pgTAP prüfbar und der Webhook bleibt
-- ein dünner Adapter. „Nur höher" macht den Aufruf idempotent (Stripe-Retries) UND
-- immun gegen ein verspätetes/wiederholtes tieferes Event (kein stiller Downgrade).
create or replace function public.apply_upgrade(p_user_id uuid, p_level text)
  returns text
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_target_rank  int;
  v_current_rank int;
begin
  select level_rank into v_target_rank
    from public.membership_tiers where key = p_level;
  if v_target_rank is null then
    raise exception 'unknown level: %', p_level using errcode = '22023';
  end if;

  select mt.level_rank into v_current_rank
    from public.profiles p
    join public.membership_tiers mt on mt.key = p.tier
   where p.id = p_user_id;
  if v_current_rank is null then
    raise exception 'unknown user or tier: %', p_user_id using errcode = 'P0002';
  end if;

  if v_target_rank > v_current_rank then
    update public.profiles set tier = p_level where id = p_user_id;
    return p_level;
  end if;

  -- Gleichstand oder tiefer: nie downgraden.
  return (select tier from public.profiles where id = p_user_id);
end;
$$;

comment on function public.apply_upgrade(uuid, text) is
  'Hebt profiles.tier auf p_level, wenn dessen level_rank höher ist als der aktuelle '
  '(sonst No-op). Gibt den effektiven Tier zurück. SECURITY DEFINER, service-role-only — '
  'der einzige Schreibweg für den Tier, aufgerufen vom stripe-webhook (AGE-259).';

-- Erbt nichts (AGE-312): Grants explizit. Nur die Service-Role (Webhook) darf aufrufen.
revoke execute on function public.apply_upgrade(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_upgrade(uuid, text) to service_role;
```

- [ ] **Step 4: Tests laufen lassen — müssen grün sein.**

Run: `supabase test db supabase/tests/grants_test.sql supabase/tests/rls_test.sql`
Expected: PASS (`ok 53`).

- [ ] **Step 5: Commit.**

```bash
git add supabase/migrations/20260716120000_stripe_upgrade.sql supabase/tests/rls_test.sql
git commit -m "feat(stripe): apply_upgrade RPC — nur-Upgrade, service-role-only (AGE-259)"
```

---

### Task 2: `create-checkout-session` Edge Function

**Files:**
- Create: `supabase/functions/create-checkout-session/checkout.ts` (reine Helfer)
- Create: `supabase/functions/create-checkout-session/checkout.test.ts`
- Create: `supabase/functions/create-checkout-session/index.ts`
- Create: `supabase/functions/create-checkout-session/README.md`
- Modify: `supabase/config.toml` (Function-Block)

**Interfaces:**
- Consumes: keine (eigenständig; Env-getrieben).
- Produces: HTTP-Endpoint `POST /functions/v1/create-checkout-session`, Body `{ level, interval }`, Antwort `{ url }`. Helfer `parseUpgradeRequest`, `priceEnvKey`.

- [ ] **Step 1: Failing Deno-Tests.** `checkout.test.ts`:

```ts
// deno test --allow-none  (aus supabase/functions/create-checkout-session/)
import { assertEquals } from "jsr:@std/assert@1";
import { parseUpgradeRequest, priceEnvKey } from "./checkout.ts";

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
```

- [ ] **Step 2: Fehlschlag prüfen.** Run: `deno test --allow-none supabase/functions/create-checkout-session/checkout.test.ts` → FAIL (`Module not found ./checkout.ts`).

- [ ] **Step 3: Helfer implementieren.** `checkout.ts`:

```ts
export const PAID_LEVELS = ["discover", "exchange", "focus", "impact"] as const;
export type PaidLevel = (typeof PAID_LEVELS)[number];
export type Interval = "month" | "year";

export const LEVEL_RANK: Record<string, number> = {
  basic: 1, connect: 2, discover: 3, exchange: 4, focus: 5, impact: 6,
};

export interface UpgradeRequest { level: PaidLevel; interval: Interval; }
type ParseResult = { ok: true; value: UpgradeRequest } | { ok: false; error: string };

export function parseUpgradeRequest(body: unknown, currentRank: number): ParseResult {
  const b = body as Record<string, unknown> | null;
  const level = b?.level;
  const interval = b?.interval;
  if (typeof level !== "string" || !(PAID_LEVELS as readonly string[]).includes(level)) {
    return { ok: false, error: "invalid_level" };
  }
  if (interval !== "month" && interval !== "year") {
    return { ok: false, error: "invalid_interval" };
  }
  if (LEVEL_RANK[level] <= currentRank) {
    return { ok: false, error: "not_an_upgrade" };
  }
  return { ok: true, value: { level: level as PaidLevel, interval } };
}

export function priceEnvKey(level: PaidLevel, interval: Interval): string {
  return `STRIPE_PRICE_${level.toUpperCase()}_${interval === "year" ? "YEAR" : "MONTH"}`;
}
```

- [ ] **Step 4: Tests grün.** Run: `deno test --allow-none supabase/functions/create-checkout-session/checkout.test.ts` → PASS.

- [ ] **Step 5: `index.ts` (Integrationsschicht, kein Netz-Unit-Test).**

```ts
// create-checkout-session — erstellt eine Stripe-Checkout-Session (Subscription,
// Test-Mode) für ein Level-Upgrade. Der Tier wird NICHT hier gesetzt, sondern vom
// stripe-webhook nach checkout.session.completed (Webhook = Wahrheit, AGE-259).
//
// Auth: verify_jwt=true — der Client ruft mit seinem User-JWT. Wir lesen den User
// und seine aktuelle Stufe, validieren, dass es ein Upgrade ist, und erzeugen die
// Session per Stripe-REST (kein SDK, wie Resend in notify-contact-request).
//
// Secrets (Infisical → supabase secrets): STRIPE_SECRET_KEY,
//   STRIPE_PRICE_{DISCOVER,EXCHANGE,FOCUS,IMPACT}_{YEAR,MONTH}, APP_URL.
//   SUPABASE_URL + SUPABASE_ANON_KEY sind plattform-injiziert.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { LEVEL_RANK, parseUpgradeRequest, priceEnvKey } from "./checkout.ts";

const CORS = { "content-type": "application/json" };
const log = (level: "info" | "warn" | "error", event: string, f: Record<string, unknown> = {}) =>
  console[level === "info" ? "log" : level](JSON.stringify({ fn: "create-checkout-session", event, ...f }));

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { authorization: authHeader } } },
  );
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: CORS });

  const { data: profile } = await supabase
    .from("profiles").select("tier, membership_tiers(level_rank)").eq("id", user.id).single();
  const currentRank = (profile?.membership_tiers as { level_rank?: number } | null)?.level_rank ?? 0;

  let body: unknown;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "bad_request" }), { status: 400, headers: CORS }); }

  const parsed = parseUpgradeRequest(body, currentRank);
  if (!parsed.ok) {
    log("warn", "rejected", { error: parsed.error, currentRank });
    return new Response(JSON.stringify({ error: parsed.error }), { status: 400, headers: CORS });
  }
  const { level, interval } = parsed.value;

  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const priceId = Deno.env.get(priceEnvKey(level, interval));
  const appUrl = Deno.env.get("APP_URL")?.trim() || "http://localhost:5173";
  if (!secretKey || !priceId) {
    log("error", "misconfigured", { hasKey: !!secretKey, priceEnv: priceEnvKey(level, interval), hasPrice: !!priceId });
    return new Response(JSON.stringify({ error: "server_misconfigured" }), { status: 500, headers: CORS });
  }

  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", `${appUrl}/mitgliedschaft?status=success`);
  params.set("cancel_url", `${appUrl}/mitgliedschaft?status=cancel`);
  params.set("client_reference_id", user.id);
  params.set("metadata[user_id]", user.id);
  params.set("metadata[level]", level); // Interval fließt NICHT in den Tier ein.

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${secretKey}`, "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) {
    log("error", "stripe_failed", { status: res.status });
    return new Response(JSON.stringify({ error: "stripe_error" }), { status: 502, headers: CORS });
  }
  const session = (await res.json()) as { url?: string };
  log("info", "session_created", { level, interval });
  return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: CORS });
});
```

- [ ] **Step 6: `config.toml` + `README.md`.** In `supabase/config.toml` nach dem `notify-contact-request`-Block:

```toml
[functions.create-checkout-session]
enabled = true
verify_jwt = true
```

`README.md`: kurz beschreiben (Zweck, Env-Vars, `supabase functions deploy create-checkout-session`).

- [ ] **Step 7: Typecheck + Commit.**

```bash
pnpm typecheck:functions
deno test --allow-none supabase/functions/create-checkout-session/checkout.test.ts
git add supabase/functions/create-checkout-session supabase/config.toml
git commit -m "feat(stripe): create-checkout-session Edge Function (AGE-259)"
```

---

### Task 3: `stripe-webhook` Edge Function

**Files:**
- Create: `supabase/functions/stripe-webhook/webhook.ts` (reine Helfer: Signatur + Event-Parsing)
- Create: `supabase/functions/stripe-webhook/webhook.test.ts`
- Create: `supabase/functions/stripe-webhook/index.ts`
- Create: `supabase/functions/stripe-webhook/README.md`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: `public.apply_upgrade(uuid, text)` (Task 1) via Service-Role-RPC.
- Produces: HTTP-Endpoint `POST /functions/v1/stripe-webhook`. Helfer `computeSignature`, `verifyStripeSignature`, `parseCheckoutCompleted`.

- [ ] **Step 1: Failing Deno-Tests.** `webhook.test.ts`:

```ts
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
  const ok = await verifyStripeSignature(BODY, `t=${T},v1=${v1}`, "whsec_other", { nowSec: T + 10 });
  assertEquals(ok, false);
});
Deno.test("veralteter Zeitstempel scheitert (Toleranz)", async () => {
  const v1 = await computeSignature(BODY, T, SECRET);
  const ok = await verifyStripeSignature(BODY, `t=${T},v1=${v1}`, SECRET, { nowSec: T + 10_000 });
  assertEquals(ok, false);
});
Deno.test("parseCheckoutCompleted liefert user_id + level", () => {
  const ev = { type: "checkout.session.completed", data: { object: { metadata: { user_id: "u1", level: "exchange" } } } };
  assertEquals(parseCheckoutCompleted(ev), { userId: "u1", level: "exchange" });
});
Deno.test("anderer Event-Typ → null", () => {
  assertEquals(parseCheckoutCompleted({ type: "invoice.paid", data: { object: {} } }), null);
});
Deno.test("fehlende Metadaten → null", () => {
  assertEquals(parseCheckoutCompleted({ type: "checkout.session.completed", data: { object: { metadata: {} } } }), null);
});
```

- [ ] **Step 2: Fehlschlag prüfen.** Run: `deno test --allow-none supabase/functions/stripe-webhook/webhook.test.ts` → FAIL.

- [ ] **Step 3: Helfer implementieren.** `webhook.ts`:

```ts
const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

/** Stripe-Signatur über `${t}.${body}` (dokumentierter Algorithmus). */
export function computeSignature(rawBody: string, t: number, secret: string): Promise<string> {
  return hmac(secret, `${t}.${rawBody}`);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyStripeSignature(
  rawBody: string,
  sigHeader: string | null,
  secret: string,
  opts?: { toleranceSec?: number; nowSec?: number },
): Promise<boolean> {
  if (!sigHeader) return false;
  const parts: Record<string, string> = {};
  for (const kv of sigHeader.split(",")) {
    const [k, v] = kv.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const tolerance = opts?.toleranceSec ?? 300;
  const now = opts?.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - t) > tolerance) return false;
  const expected = await computeSignature(rawBody, t, secret);
  return timingSafeEqualHex(expected, v1);
}

export function parseCheckoutCompleted(event: unknown): { userId: string; level: string } | null {
  const e = event as { type?: string; data?: { object?: { metadata?: Record<string, string> } } };
  if (e?.type !== "checkout.session.completed") return null;
  const md = e.data?.object?.metadata;
  if (!md?.user_id || !md?.level) return null;
  return { userId: md.user_id, level: md.level };
}
```

- [ ] **Step 4: Tests grün.** Run: `deno test --allow-none supabase/functions/stripe-webhook/webhook.test.ts` → PASS.

- [ ] **Step 5: `index.ts`.**

```ts
// stripe-webhook — Wahrheit für den Tier-Upgrade (AGE-259). verify_jwt=false: Stripe
// trägt kein User-JWT. Schutz ist die Stripe-SIGNATUR (STRIPE_WEBHOOK_SECRET), NICHT
// ein Shared-Secret. Auf checkout.session.completed → apply_upgrade per Service-Role.
// Idempotent (apply_upgrade ist nur-höher); 400 bei ungültiger Signatur.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { parseCheckoutCompleted, verifyStripeSignature } from "./webhook.ts";

const log = (level: "info" | "warn" | "error", event: string, f: Record<string, unknown> = {}) =>
  console[level === "info" ? "log" : level](JSON.stringify({ fn: "stripe-webhook", event, ...f }));

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) { log("error", "missing_webhook_secret"); return new Response("Server misconfigured", { status: 500 }); }

  const rawBody = await req.text(); // Roh-Body für die Signaturprüfung — NICHT vorher parsen.
  const valid = await verifyStripeSignature(rawBody, req.headers.get("stripe-signature"), secret);
  if (!valid) { log("warn", "bad_signature"); return new Response("Bad signature", { status: 400 }); }

  let event: unknown;
  try { event = JSON.parse(rawBody); } catch { return new Response("Bad Request", { status: 400 }); }

  const upgrade = parseCheckoutCompleted(event);
  if (!upgrade) return new Response(JSON.stringify({ skipped: true }), { status: 200, headers: { "content-type": "application/json" } });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await supabase.rpc("apply_upgrade", { p_user_id: upgrade.userId, p_level: upgrade.level });
  if (error) {
    log("error", "apply_upgrade_failed", { code: error.code, level: upgrade.level });
    return new Response("Upgrade failed", { status: 500 }); // Stripe retryt; apply_upgrade ist idempotent.
  }
  log("info", "upgraded", { level: upgrade.level, effective: data });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
});
```

- [ ] **Step 6: `config.toml` + `README.md`.**

```toml
[functions.stripe-webhook]
enabled = true
verify_jwt = false
```

- [ ] **Step 7: Typecheck + Commit.**

```bash
pnpm typecheck:functions
deno test --allow-none supabase/functions/stripe-webhook/webhook.test.ts
git add supabase/functions/stripe-webhook supabase/config.toml
git commit -m "feat(stripe): stripe-webhook Edge Function — Signatur + apply_upgrade (AGE-259)"
```

---

### Task 4: Pricing-Screen `/mitgliedschaft`

**Files:**
- Modify: `src/config/levels.ts` (Feld `priceMonth`)
- Create: `src/pages/MitgliedschaftPage.tsx`
- Create: `src/pages/MitgliedschaftPage.test.tsx`
- Modify: `src/config/nav.ts` (Sub-Route, kein Menüeintrag)

**Interfaces:**
- Consumes: `LEVELS`, `LEVEL_ORDER`, `LEVEL_RANK`, `MembershipLevel` (`src/config/levels.ts`); `useAuth().tier/levelRank`; `supabase.functions.invoke`.
- Produces: Route `/mitgliedschaft` (Sub-Item, `requiresAuth`).

- [ ] **Step 1: `priceMonth` in `levels.ts`.** In `LevelConfig` ergänzen und pro Level setzen. Monatswerte sind Anzeige-Defaults (≈ Jahr/10, „2 Monate gratis"-Rabatt) — Donald bestätigt sie bei der Produkt-Anlage:

```ts
export interface LevelConfig {
  key: MembershipLevel;
  label: string;
  priceYear: number;
  /** Monatspreis in Euro (Anzeige; Stripe-Preis-ID lebt server-seitig). 0 = gratis. */
  priceMonth: number;
  rank: number;
  summary: string;
}
```
Je Level `priceMonth` einfügen: `basic` 0, `connect` 0, `discover` 15, `exchange` 30, `focus` 60, `impact` 120.

- [ ] **Step 2: Failing Test.** `MitgliedschaftPage.test.tsx`:

```tsx
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import MitgliedschaftPage from "./MitgliedschaftPage";

const invoke = vi.fn();
vi.mock("../lib/supabase", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock("../providers/auth-context", () => ({ useAuth: () => ({ tier: "discover", levelRank: 3 }) }));

function renderPage() {
  return render(<MemoryRouter><MitgliedschaftPage /></MemoryRouter>);
}

describe("MitgliedschaftPage", () => {
  beforeEach(() => { invoke.mockReset(); invoke.mockResolvedValue({ data: { url: "https://stripe.test/x" }, error: null }); });

  it("zeigt alle 6 Stufen", () => {
    renderPage();
    for (const l of ["Basic", "Connect", "Discover", "Exchange", "Focus", "Impact"])
      expect(screen.getByText(l)).toBeInTheDocument();
  });

  it("markiert die aktuelle Stufe und bietet nur höhere zahlende Stufen zum Upgrade", () => {
    renderPage();
    expect(screen.getByTestId("level-discover")).toHaveAttribute("data-current", "true");
    // Höher + zahlend → Button
    expect(within(screen.getByTestId("level-exchange")).getByRole("button", { name: /upgrade/i })).toBeEnabled();
    // Aktuell/niedriger → kein Upgrade-Button
    expect(within(screen.getByTestId("level-discover")).queryByRole("button", { name: /upgrade/i })).toBeNull();
    expect(within(screen.getByTestId("level-connect")).queryByRole("button", { name: /upgrade/i })).toBeNull();
  });

  it("zeigt den Testzahlung-Hinweis", () => {
    renderPage();
    expect(screen.getAllByText(/Testzahlung · Demo/i).length).toBeGreaterThan(0);
  });

  it("schaltet mit dem Jahr/Monat-Toggle die Beträge", () => {
    renderPage();
    expect(within(screen.getByTestId("level-exchange")).getByText(/300/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /monatlich/i }));
    expect(within(screen.getByTestId("level-exchange")).getByText(/30/)).toBeInTheDocument();
  });

  it("ruft create-checkout-session mit level + interval", () => {
    renderPage();
    fireEvent.click(within(screen.getByTestId("level-focus")).getByRole("button", { name: /upgrade/i }));
    expect(invoke).toHaveBeenCalledWith("create-checkout-session", { body: { level: "focus", interval: "year" } });
  });
});
```

- [ ] **Step 3: Fehlschlag prüfen.** Run: `pnpm test -- MitgliedschaftPage` → FAIL (Modul fehlt).

- [ ] **Step 4: `MitgliedschaftPage.tsx` implementieren.**

```tsx
import { useState } from "react";
import { LEVELS, LEVEL_ORDER, LEVEL_RANK, type MembershipLevel } from "../config/levels";
import { useAuth } from "../providers/auth-context";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/Button";
import { Card, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { cn } from "../lib/cn";

type Interval = "month" | "year";
const PAID: MembershipLevel[] = ["discover", "exchange", "focus", "impact"];

export default function MitgliedschaftPage() {
  const { tier, levelRank } = useAuth();
  const [interval, setInterval] = useState<Interval>("year");
  const [busy, setBusy] = useState<MembershipLevel | null>(null);
  const currentRank = levelRank ?? 0;

  async function startUpgrade(level: MembershipLevel) {
    setBusy(level);
    const { data, error } = await supabase.functions.invoke("create-checkout-session", { body: { level, interval } });
    setBusy(null);
    if (error || !data?.url) return; // Fehler-Toast optional; MVP: kein Redirect
    window.location.assign(data.url as string);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Mitgliedschaft</h1>
        <div className="flex gap-1 rounded-full border border-line p-1">
          <button type="button" onClick={() => setInterval("year")}
            className={cn("rounded-full px-3 py-1 text-sm", interval === "year" && "bg-gold-strong text-canvas")}>
            Jährlich
          </button>
          <button type="button" onClick={() => setInterval("month")}
            className={cn("rounded-full px-3 py-1 text-sm", interval === "month" && "bg-gold-strong text-canvas")}>
            Monatlich
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LEVEL_ORDER.map((key) => {
          const lvl = LEVELS[key];
          const isCurrent = tier === key;
          const canUpgrade = PAID.includes(key) && LEVEL_RANK[key] > currentRank;
          const price = interval === "year" ? lvl.priceYear : lvl.priceMonth;
          return (
            <Card key={key} data-testid={`level-${key}`} data-current={isCurrent}
              className={cn("flex flex-col gap-3", isCurrent && "border-gold-strong")}>
              <div className="flex items-center justify-between">
                <CardTitle>{lvl.label}</CardTitle>
                {isCurrent && <Badge variant="strong">Aktuell</Badge>}
              </div>
              <p className="text-sm text-muted">{lvl.summary}</p>
              <p className="text-lg font-semibold text-ink">
                {price === 0 ? "Gratis" : `${price} € / ${interval === "year" ? "Jahr" : "Monat"}`}
              </p>
              {canUpgrade && (
                <div className="mt-auto flex flex-col gap-1">
                  <Button variant="primary" size="sm" disabled={busy === key} onClick={() => startUpgrade(key)}>
                    Upgrade
                  </Button>
                  <span className="text-center text-xs text-muted">Testzahlung · Demo</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Route registrieren.** In `src/config/nav.ts` `MitgliedschaftPage` importieren und als Sub-Item (kein Menüeintrag, nicht in den 6+5+1-Zählungen) ergänzen — direkt vor dem Chat-Eintrag:

```ts
import MitgliedschaftPage from "../pages/MitgliedschaftPage";
// ...
  { path: "/mitgliedschaft", label: "Mitgliedschaft", Component: MitgliedschaftPage, section: "sub", requiresAuth: true },
```

- [ ] **Step 6: Tests grün.** Run: `pnpm test -- MitgliedschaftPage` → PASS. Dann `pnpm test -- nav` (die 6+5+1-Zählung bleibt grün, weil `sub` nicht gezählt wird).

- [ ] **Step 7: Commit.**

```bash
git add src/config/levels.ts src/config/nav.ts src/pages/MitgliedschaftPage.tsx src/pages/MitgliedschaftPage.test.tsx
git commit -m "feat(stripe): Pricing-Screen /mitgliedschaft mit Jahr/Monat-Toggle (AGE-259)"
```

---

### Task 5: Upgrade-Einstiege (MembershipGate-Wand + Einstellungen)

**Files:**
- Modify: `src/components/MembershipGate.tsx` (CTA für „eingeloggt, aber zu niedrig")
- Modify: `src/components/MembershipGate.test.tsx`
- Modify: `src/pages/EinstellungenPage.tsx` (Button in der bestehenden „Mitgliedschaft"-Card)

**Interfaces:**
- Consumes: Route `/mitgliedschaft` (Task 4).

- [ ] **Step 1: Failing Test.** In `src/components/MembershipGate.test.tsx` einen Fall ergänzen: eingeloggter Nutzer mit zu niedriger Stufe sieht einen „Upgrade"-Button, der nach `/mitgliedschaft` navigiert. (Vorhandenes Mock-/Render-Setup der Datei wiederverwenden; `useAuth` liefert `user` gesetzt, `levelRank` unter `min`.)

```tsx
it("bietet eingeloggten Nutzern mit zu niedriger Stufe einen Upgrade-Weg", () => {
  // useAuth-Mock: user vorhanden, levelRank 1 (basic), min = "discover"
  renderGate({ min: "discover", levelRank: 1, user: { id: "u1" } });
  const btn = screen.getByRole("button", { name: /upgrade/i });
  fireEvent.click(btn);
  expect(mockNavigate).toHaveBeenCalledWith("/mitgliedschaft");
});
```

- [ ] **Step 2: Fehlschlag prüfen.** Run: `pnpm test -- MembershipGate` → FAIL.

- [ ] **Step 3: CTA implementieren.** In `MembershipGate.tsx`, im `MembershipWall`-Button-Block, für den eingeloggten Fall einen Primär-Button ergänzen:

```tsx
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {loggedIn ? (
            <Button variant="primary" onClick={() => navigate("/mitgliedschaft")}>
              Upgrade
            </Button>
          ) : (
            <Button variant="primary" onClick={() => navigate("/login")}>
              Mitglied werden
            </Button>
          )}
          <Button variant="ghost" onClick={() => navigate("/")}>
            Zur Startseite
          </Button>
        </div>
```

- [ ] **Step 4: Test grün.** Run: `pnpm test -- MembershipGate` → PASS.

- [ ] **Step 5: Einstellungen-Link.** In `src/pages/EinstellungenPage.tsx`, in der bestehenden „Mitgliedschaft"-Card (aktuell nur TierBadge + Label), einen Button ergänzen:

```tsx
      <Card className="flex flex-col gap-4">
        <CardTitle>Mitgliedschaft</CardTitle>
        <div className="flex items-center gap-2">
          <TierBadge tier={tier ?? DEFAULT_LEVEL} />
          <span className="text-sm text-muted">{levelLabel(tier ?? DEFAULT_LEVEL)}-Mitglied</span>
        </div>
        <Button variant="secondary" size="sm" className="self-start"
          onClick={() => navigate("/mitgliedschaft")}>
          Stufe ansehen &amp; upgraden
        </Button>
      </Card>
```

- [ ] **Step 6: Voll-Suite + Commit.**

```bash
pnpm test
pnpm typecheck && pnpm lint
git add src/components/MembershipGate.tsx src/components/MembershipGate.test.tsx src/pages/EinstellungenPage.tsx
git commit -m "feat(stripe): Upgrade-Einstiege in Wand + Einstellungen (AGE-259)"
```

---

### Task 6: Secrets-Doku + Setup-Runbook (Execution-Grenze)

**Files:**
- Modify: `docs/secrets.md`

**Interfaces:** keine (Doku).

- [ ] **Step 1: `docs/secrets.md` ergänzen** — die 10 Env-Werte + das Setup, das ein Mensch ausführt:

```markdown
## Stripe Test-Mode Upgrade-Flow (AGE-259)

Edge-Function-Secrets (Infisical → `supabase secrets set`):
- `STRIPE_SECRET_KEY`  — Test-Mode Secret Key (`sk_test_…`)
- `STRIPE_WEBHOOK_SECRET` — aus dem Stripe-Webhook-Endpoint (`whsec_…`)
- `STRIPE_PRICE_DISCOVER_YEAR` / `_MONTH`
- `STRIPE_PRICE_EXCHANGE_YEAR` / `_MONTH`
- `STRIPE_PRICE_FOCUS_YEAR` / `_MONTH`
- `STRIPE_PRICE_IMPACT_YEAR` / `_MONTH`
- `APP_URL` — Basis-URL für success/cancel (z. B. `http://localhost:5173`)

Plattform-injiziert: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### Einmal-Setup (Mensch, Test-Mode)
1. 4 Produkte in Stripe (Test-Mode): Discover/Exchange/Focus/Impact.
   Je Produkt **zwei wiederkehrende Preise**: jährlich (150/300/600/1.200 €) + monatlich.
2. Die 8 Price-IDs (`price_…`) + `sk_test_…` als Secrets setzen (s. o.).
3. Functions deployen: `supabase functions deploy create-checkout-session stripe-webhook`.
4. Stripe-Webhook-Endpoint auf `…/functions/v1/stripe-webhook` anlegen,
   Event `checkout.session.completed` abonnieren, das `whsec_…` als
   `STRIPE_WEBHOOK_SECRET` setzen.
5. Migration anwenden: `pnpm db:push` (setzt `apply_upgrade`).
```

- [ ] **Step 2: Commit.**

```bash
git add docs/secrets.md
git commit -m "docs(stripe): Secrets + Test-Mode Setup-Runbook (AGE-259)"
```

---

## Verification (nach Execution)

- pgTAP: `supabase test db supabase/tests/grants_test.sql supabase/tests/rls_test.sql` → `ok 53`.
- Deno: `deno test --allow-none supabase/functions/create-checkout-session/checkout.test.ts supabase/functions/stripe-webhook/webhook.test.ts` → alle grün.
- Frontend: `pnpm test` grün; `pnpm typecheck && pnpm lint` sauber.
- **Browser (blockiert bis Keys)**: als Basic-Nutzer auf ein gesperrtes Format → Wand → „Upgrade" → `/mitgliedschaft` → „Upgrade auf Exchange" → Stripe Checkout `4242 4242 4242 4242` → Rückkehr → `profiles.tier='exchange'` (Webhook) → das zuvor gesperrte Format ist sichtbar. Das ist der §3.3-Wow-Moment.

## Self-Review

**Spec coverage:** §3.1 (Config + server-seitige Preis-IDs) → Task 2/6; §3.2 (Pricing-Screen, aktuelle Stufe, kein Downgrade, „Testzahlung · Demo") → Task 4; §3.3 (Checkout + Webhook = Wahrheit, idempotent, tier nicht client-schreibbar) → Task 1/2/3; §3.4 (Start `basic` + Upgrade-Pfad sichtbar) → Task 4/5 (Default `basic` existiert bereits; Einstiege ergänzt). Alle §3.1–3.4 abgedeckt.

**Type consistency:** `apply_upgrade(uuid, text)` identisch in Task 1 (Definition), Task 3 (`supabase.rpc("apply_upgrade", { p_user_id, p_level })`). `parseUpgradeRequest`/`priceEnvKey` in Task 2 Definition == Test. `verifyStripeSignature`/`computeSignature`/`parseCheckoutCompleted` in Task 3 Definition == Test. `create-checkout-session`-Body `{ level, interval }` identisch in Task 2 (index), Task 4 (invoke) und Test. `priceMonth` in Task 4 Definition == Consumer.

**Placeholder scan:** keine offenen TBD/TODO. Monatsbeträge sind konkrete Anzeige-Defaults mit Begründung (Donald bestätigt bei Produkt-Anlage) — kein Platzhalter-Token.
