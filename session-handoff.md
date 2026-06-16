# Session Handoff — 2026-06-16 (W4-Abnahme abgeschlossen, AGE-255)

## Accomplished

- **AGE-255 Finale Abnahme — 8/8 Akzeptanzkriterien grün**, live gegen `fbc-platform.pages.dev`
  (Supabase `foelowldexkcqzewvrcf`, EU `eu-central-1`). Zweigleisig: RLS DB-seitig
  (Rollen-Impersonation, contact_request-/message_thread-INSERT als Unberechtigter → `42501`,
  Kontaktdaten erst nach `accepted`, Legacy-Inhalte stufen-gegated) + UI live als
  Discover/Prime/Legacy (Like + Event-Anmeldung reversibel getestet).
- **`docs/w4-acceptance.md`** (8/8 + Nebenbefunde + Phase-2-Ausblick) und **`docs/demo-script.md`**
  (Drehbuch für Detlev) — **PR #46 squash-gemergt** (`968e0de`).
- **`docs/demo-zugang.md`** (fertiger Detlev-Nachrichtentext: 3 Logins, Passwort `Test1234!`,
  3-Schritte-Anleitung) — **PR #47 squash-gemergt** (`37ab6bb`).
- 9 Screenshots unter `.planning/qa-screens/w4-*` (lokal, nicht committed — Konvention wie Vorphasen).

## Linear

- **AGE-255 → Done**, **AGE-253 → Done** (Default-Domain-Deploy erledigt; Custom-Domain-Rest = AGE-256).
  250/251/252/254 waren bereits Done → **Meilenstein „W4 · Community & Demo" = 100 %**, „Abgenommen 2026-06-16".
- **AGE-256** (Custom-Domain, DNS-blockiert) + **AGE-257** (Migrations-Automatisierung/Drift) aus W4
  in **neues Meilenstein „Phase 2 · Skalierung, Monetarisierung & Compliance"** verschoben.
- **5 neue Phase-2-Issues** (alle im Phase-2-Meilenstein, mit Scope/Akzeptanzkriterien):
  **AGE-259** Stripe/Bezahlung+Stufen-Upgrade · **AGE-260** DSGVO-Paket · **AGE-261** Onboarding-Vollausbau ·
  **AGE-262** Academy/Library echte Inhalte · **AGE-263** Odoo-Anbindung.

## Decisions

- Screenshots NICHT committed (Vorphasen-Konvention; nur `.planning/config.json` getrackt).
- W4 „erledigt" = alle Issues Done (100 %) + dated „Abgenommen"-Summary (wie W3). 256/257 sind
  bewusst Phase-2-Carry-over, nicht künstlich auf Done gesetzt.
- Phase-2-Themen als eigenes Meilenstein im bestehenden Projekt angelegt (ggf. später eigenes
  Linear-Projekt „FBC Plattform – Phase 2").

## Files modified (committed auf main)

- `docs/w4-acceptance.md`, `docs/demo-script.md` (PR #46).
- `docs/demo-zugang.md` (PR #47).
- `session-handoff.md` (dieser Stand).

## Next session: start here

**Phase 1 ist abgeschlossen und vorführbar.** Detlev kann mit den drei Logins
(`discover@`/`prime@`/`legacy@fbcdemo.com`, PW `Test1234!`) reviewen (`docs/demo-zugang.md`).
Erste sinnvolle Phase-2-Schritte: **AGE-260 DSGVO** (vor echten Daten) und **AGE-259 Stripe**
(Monetarisierung) sind High; **AGE-257** (Migrations-Deploy automatisieren) sollte vor weiteren
DDL-Schritten kommen, um Repo↔prod-Drift zu stoppen. **AGE-256** (Custom-Domain) bleibt blockiert,
bis DNS-Delegation für `fairbusinessclub.de` vorliegt.

## Open questions / Altlasten

- **Test-Residuum bleibt drin** (User-Entscheidung): eine `cancelled`-Zeile in
  `event_registrations` (Carla/Leadership-Workshop) aus dem reversiblen Anmelde-Test;
  harmlos, per `pnpm demo:reset` normalisierbar.
- Bekannte Härtungen ohne Meilenstein: `regs_write_own` RLS-Bypass; `SECURITY DEFINER`-RPC-Grants
  für `anon`/`authenticated` (Advisor-WARN); „leaked password protection" aus; **AGE-258**
  QueryClient-Cache beim Logout leeren.
- Mehrere parallele Tester teilen sich die drei Demo-Accounts (geteilter Zustand) → bei Bedarf
  eigene Accounts pro Person anlegen.
