# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-18)

**Core value:** Stufenbasierte Sichtbarkeit/Rechte, per RLS in der DB erzwungen — nicht nur im Frontend.
**Current focus:** Phase 2 — Monetarisierung & Lifecycle

## Current Position

Phase: 2 of 4 (Monetarisierung & Lifecycle)
Plan: — (Linear-getrieben; nächste offene Issues siehe ROADMAP.md Phase 2)
Status: In progress
Last activity: 2026-07-18 — GSD-Adoption + Reconciliation-Audit aller offenen Linear-Issues; AGE-259 (Stripe-Checkout-Fix) gemerged & auf Prod bestätigt.

Progress: [██████░░░░] Phase 1: 5/9 · Phase 2: 5/12 · Phase 3: 0/7 · Phase 4: 0/2

## Accumulated Context

### Decisions

Decisions sind in PROJECT.md → Key Decisions gelistet. Für die aktuelle Arbeit relevant:

- GSD adoptiert, Linear bleibt Quelle der Wahrheit für Issue-Status (Sync-Konvention in PROJECT.md).
- Reconciliation-Audit 2026-07-18: 5 Issues (AGE-289/290/294/295/296) waren bereits umgesetzt → auf Done; 7 Partials kommentiert (built vs remaining).
- Checkout: `tier` client-schreibgeschützt, Webhook = Wahrheit; Edge-Function-Auth liest `sub` aus dem Gateway-verifizierten JWT (ES256-Fix, AGE-259).

### Pending Todos

Nicht als GSD-Todos geführt — offene Arbeit lebt in Linear (Projekt „FBC Plattform – Roadmap (Phasen 1–4)").

Nächste natürliche Kandidaten (Phase 2, offen): AGE-261 (Onboarding verbindlich machen),
AGE-299 (Lifecycle-Mail-System + Glocke verdrahten), AGE-298 (EasyBill), AGE-260 (DSGVO).

### Blockers/Concerns

- **Deploy-Falle**: Merge auf `main` deployt nur das Cloudflare-Pages-Frontend. Edge Functions
  und Prod-Migrationen werden **manuell** deployed (`supabase functions deploy … --project-ref foelowldexkcqzewvrcf`).
- **dev == prod DB**: `env=dev` teilt sich die Prod-Supabase; lokale Schreibvorgänge treffen die Live-DB.
- **Linear-Milestone-Zuordnung**: kürzlich gemergte UI-/Design-Arbeit (AGE-237, AGE-360/361/362)
  hängt an separaten Issues außerhalb der Phase-1.5-Milestone — Milestone-Progress in Linear untertreibt daher.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| UI | Phase-1 Partials (AGE-291/292/293) + AGE-258 | Offen, niedrige Prio | 2026-07-18 |
| Infra | AGE-256 Custom Domain (blockiert) | Offen | 2026-07-18 |

## Session Continuity

Last session: 2026-07-18
Stopped at: GSD-`.planning/`-Struktur (PROJECT/ROADMAP/STATE) über das Linear-getriebene Projekt gelegt; Reconciliation-Audit in Linear eingetragen.
Shell cwd was reset to /Users/donald/Sourcecode/factiv/fbc-platform
