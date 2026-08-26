## Reviewer: gemini

_generated 2026-07-26T08:53:36Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- **PII Data Flow**: The spec does not state what customer PII (e.g., name, address, tax ID) is sent to EasyBill to generate a legally compliant invoice. Please specify the data payload and confirm that we are compliant in storing and transmitting this data.
- **Missing Credit Note Scenario**: The spec omits the legal requirement to issue a credit note if a payment is refunded or disputed after an invoice has been generated. This is a critical accounting and legal scenario.
- **Undefined Retry Mechanism**: The "retryable" mechanism for failed invoice generation is not defined. The spec should detail how the system guarantees an invoice is eventually created (e.g., via a durable job queue, a sweeper process, etc.) and what happens after repeated failures.
- **Proration Authority**: It's unclear if our system calculates the proration or if this is delegated to Stripe. The spec should explicitly state that the implementation will rely on Stripe's built-in subscription proration capabilities.
- **Out of Scope Clarification**: The spec focuses on upgrades. Please clarify how downgrades are handled. If they are out of scope for this change, it should be explicitly mentioned.
  Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
  Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 14ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
  Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/factiv/fbc-platform)
  Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 15ms

## Reviewer: codex

_generated 2026-07-26T08:54:37Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- “Legally-correct invoice” is not specified: required customer/address data, invoice numbering/date, line items, currency, VAT/tax treatment, payment reference, finalization, and immutable PDF retention are absent.
- No idempotency requirement covers duplicate Stripe webhooks or the crash window where EasyBill succeeds but persistence fails; retries could issue duplicate invoices.
- Proration is underspecified. Define the authoritative billing period, exact formula, time precision/timezone, minor-unit rounding, taxes, discounts, price changes, and expected amount in the halfway scenario.
- “Completed upgrade payment” must identify the qualifying Stripe event/status, especially for asynchronous payment methods, and exclude failed, pending, canceled, or unrelated payments.
- Retry behavior lacks a durable state model, attempt tracking, backoff/dead-letter handling, and an operator-visible reconciliation path.
- Refunds, reversals, and disputes are missing; legally correct accounting may require an EasyBill cancellation or credit note linked to the original invoice.
- The EasyBill PII boundary is unspecified: enumerate transmitted member fields, data minimization, retention/deletion rules, access control for retrieval, and prevention of PII/API credentials entering logs.
- “Reference persisted with the payment” is too vague: define uniqueness, document ID versus PDF location, retrieval authorization, and behavior when EasyBill or stored PDFs later become unavailable.

## Reviewer: opencode

_generated 2026-07-26T08:57:18Z · timeout 180s_

I'll review this against the actual codebase and specs to ground the critique.
Grounded review complete. Verdict and issues below.

VERDICT: REQUEST-CHANGES

- **Spec delta is structurally broken — it ADDs requirements that directly contradict an existing requirement without REMOVING it.** The current spec has "Invoicing and proration are not implemented" (`openspec/specs/billing-upgrades/spec.md:116-127`) explicitly stating EasyBill/proration are out of scope and "no EasyBill invoice… and applies no proration." This change only has an `ADDED` block; there is no `REMOVED`/`MODIFIED` entry for that requirement, so merging the delta produces a self-contradicting capability spec. The change must remove or supersede it.

- **Idempotency gap — the highest-risk issue.** The existing capability is architected around Stripe webhook idempotency (`apply_upgrade` no-ops on lower/equal ranks; serialized with `for update`). The new invoice requirement adds no idempotency key or dedup. If `checkout.session.completed` is retried by Stripe (which it does), an invoice may already have been issued on the first attempt while the webhook later returns non-200 — producing duplicate EasyBill invoices. There must be a scenario asserting dedup-by-payment-intent/checkout-session-id before EasyBill creation.

- **"Retryable on failure" is undefined mechanism.** The scenario says the failed invoice "is retryable" and "the payment is never silently dropped," but tasks/design specify no retry path (no queue, no dead-letter, no admin UI). The existing architecture is a single sync edge function. Either define the retry mechanism or scope this scenario out.

- **Webhook response-code ambiguity.** The existing spec says the webhook 200s on success and 400s on bad signature. The new requirement creates a side effect in the same handler whose failure must not break the upgrade — but it's unspecified whether the webhook still returns 200 on invoice failure. If it returns 500, Stripe retries → duplicate invoice risk (see above). Must state the webhook returns 200 independently of invoice outcome.

- **PII / third-party data transfer is unaddressed.** EasyBill invoices require member name, address, and (for DACH legality) tax ID. This is a PII transfer to an external processor, in an EU/DACH product. No consent, no data-protection, no GDPR/Art. 28 processor requirement, no minimization rule. Given the CLAUDE.md DACH context and the `invoice-de` Kleinunternehmer §19 conventions, this is a real gap.

- **"Legally-correct invoice" is asserted but not specified.** The proposal invokes legal correctness, but no requirement pins compliance to §14 UStG (sequential numbering, invoice date, tax rate, issuer tax ID, §19 Kleinuntersteller treatment vs. USt-pflichtig). If EasyBill does the rendering, the spec should still assert the data it receives is sufficient for a compliant invoice; otherwise the "legally correct" claim is unsupported.

- **Proration authorship is ambiguous.** Stripe Checkout runs in `mode=subscription`; Stripe itself prorates subscription upgrades when `proration_behavior` is set. The proposal and task 2.2 ("Apply the prorated amount at checkout") imply platform-side computation, but never say whether proration is delegated to Stripe (`proration_behavior=create_prorations`/`always_invoice`) or computed by FBC. These have very different failure modes and trust boundaries. Pick one and state it.

- **No data-model delta for the invoice reference.** The requirement demands "a reference… persisted with the payment record," but the existing capability spec has no documented `payments` table — `apply_upgrade` only writes `profiles.tier`. The change implies a new column/table (EasyBill document id, foreign key) but specifies none. Data-model is the migrations source of truth per CLAUDE.md; a spec requirement over storage with no schema delta is unverifiable.

- **Proration scenarios miss the real cases.** Only "half a period elapsed" is covered. Missing: upgrade from a free tier (`basic`/`connect`) where there is nothing to credit; upgrade at the period boundary (no credit); yearly-interval proration (Stripe uses daily proration incl. leap years); upgrade on the same day; downgrade-then-reupgrade; refund/cancellation interaction; renewal boundary.

- **"Every completed upgrade payment" event ambiguity.** For subscriptions, `checkout.session.completed` fires at checkout completion, not necessarily at payment — Stripe also emits `invoice.paid`. The trigger event for invoice creation is named inconsistently with the existing spec (which keys off `checkout.session.completed`). Pin the exact event.

- **Scope drift in "every paid upgrade."** The existing flow is a subscription checkout, i.e. always "mid-cycle" in the sense that the first subscription from a free tier has no prior paid period — yet the requirement says every upgrade is invoiced and "mid-cycle upgrades are prorated." Initial free→paid upgrades have no remainder to credit; the proration scenario should explicitly exclude them to avoid an unverifiable assertion.

- **Security: EasyBill credential handling not specified.** Task 1.1 says "env only, no secrets in repo," but no requirement covers credential rotation, scope-limiting the EasyBill API token, or where the token runs (edge function vs. service). The change introduces a new privileged outbound writer; the spec should assert the credential boundary.

- **VAT/tax treatment unstated.** Proration of net vs. gross amounts, and whether the proration credit is VAT-aware, is unspecified — material for a "legally correct invoice" claim in a DACH context.

- **Migration/rollback silent.** No requirement that existing already-upgraded members (Stripe test mode history) be handled, nor that the new invoice-path failure doesn't regress the current working flow. Given the spec gate (`§18`), this should at least be acknowledged as out-of-scope or a migration step.
