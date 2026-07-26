# Roadmap: FBC Plattform

## Overview

Vier Phasen aus dem Review-Call vom 29.06.2026 (Detlev, Donald, Patrick): von UI-Politur
über Monetarisierung & Lifecycle zu CRM/Matching v2/Admin und schließlich Ökosystem &
Ventures. Diese Roadmap **spiegelt die Linear-Milestones** im Projekt „FBC Plattform –
Roadmap (Phasen 1–4)" — jede Plan-Zeile ist ein Linear-Issue (AGE-xxx); Status siehe
Marker (✅ done / 🟡 partial / ⬜ todo). **Linear ist die Quelle der Wahrheit** (siehe
PROJECT.md → Linear-Sync-Konvention).

Status verankert durch den Reconciliation-Audit vom 2026-07-18 (Verifikation gegen den
Code, nicht gegen Issue-Text).

## Phases

**Phase Numbering:** Integer-Phasen 1–4 = die vier Linear-Milestones (Linears „Phase 1.5"
ist hier GSD-Phase 1).

- [ ] **Phase 1: UI-Politur** — Identität/Logo, neutrale Startseite, Nav-Aufräumen, Hero-/Profil-Header (5/9 done)
- [ ] **Phase 2: Monetarisierung & Lifecycle** — Stripe, EasyBill, Lifecycle-Mails, QM, DSGVO, Pricing-/Design-Politur (5/12 done) ← **CURRENT**
- [ ] **Phase 3: CRM, Matching v2 & Admin** — In-Plattform-CRM, Matching v2 + Provision, Admin-Bereich (0/7 done, 2 partial)
- [ ] **Phase 4: Ökosystem & Ventures** — Capital-Parks-Anbindung, gemeinsame Ventures (0/2 done)

## Phase Details

### Phase 1: UI-Politur
**Goal**: Neutrale, markenkonforme Oberfläche über den Formaten; aufgeräumte Navigation und Profil-/Hero-Header.
**Depends on**: Nothing (erste Phase)
**Linear-Milestone**: „Phase 1.5 – UI-Politur"
**Success Criteria** (what must be TRUE):
  1. Öffentliche Startseite zeigt kuratiertes Dashboard für alle (auch anon). ✅
  2. Mitglieds-Identität + Logo in Sidebar/Header; Profil-/Hero-Header vorhanden. ✅
  3. Navigation aufgeräumt (Menü-Swap zurückgebaut, Labels/Benennung sauber). 🟡
**Plans**: 9 Issues (Linear-getrieben)

Plans:
- [x] 01-01: ✅ AGE-289 — Identität oben links + Krone-Logo in Top-Nav
- [x] 01-02: ✅ AGE-290 — Neutrale öffentliche Startseite über den Formaten
- [x] 01-03: ✅ AGE-294 — Abstand Sidebar ↔ Content halbieren
- [x] 01-04: ✅ AGE-295 — Hero-Header je Format-Seite
- [x] 01-05: ✅ AGE-296 — Profil-Header anpassbar; Avatar nicht überlappen
- [ ] 01-06: 🟡 AGE-291 — Namen verschleiern (anon done; tiered resolution fehlt)
- [ ] 01-07: 🟡 AGE-292 — Mein-Bereich Inline-Accordion (Menü-Swap weg; Accordion fehlt)
- [ ] 01-08: 🟡 AGE-293 — Menü aufräumen (umbenannt; Sektions-Labels noch da)
- [ ] 01-09: ⬜ AGE-258 — QueryClient beim Logout leeren (nicht umgesetzt)

### Phase 2: Monetarisierung & Lifecycle
**Goal**: Bezahlte Self-Service-Upgrades, korrekte Rechnungen, Lifecycle-Kommunikation, QM und DSGVO-Grundausstattung.
**Depends on**: Phase 1
**Linear-Milestone**: „Phase 2 – Monetarisierung & Lifecycle"
**Success Criteria** (what must be TRUE):
  1. Mitglied kann kostenpflichtig upgraden; Stripe-Webhook setzt `tier`. ✅
  2. Mitglieder erhalten korrekte Rechnungen (inkl. Proration). ⬜
  3. Lifecycle-/Nudge-Mails + Benachrichtigungen erreichen Nutzer. 🟡
  4. DSGVO-Grundausstattung (Rechtstexte, Consent, Betroffenenrechte) steht. ⬜
  5. Pricing-/Mitgliedschafts-UI und Dashboard-Politur sitzen. ✅
**Plans**: 12 Issues (AGE-297 = Duplicate, ausgeschlossen)

Plans:
- [x] 02-01: ✅ AGE-259 — Stripe Self-Service-Upgrade (Test-Mode)
- [x] 02-02: ✅ AGE-300 — QM-Feedback MVP (Sterne + 3 Fragen + Route)
- [x] 02-03: ✅ AGE-360 — Pricing-Karten-Redesign + Mitgliedschafts-Home
- [x] 02-04: ✅ AGE-361 — Design-Varianten: sommerfest (Dashboard) + eff.bee.zee-Vision-Dummy
- [x] 02-05: ✅ AGE-362 — Nav-IA-Cleanups: Impact Score ausblenden + veraltete Tier-Texte
- [ ] 02-06: 🟡 AGE-261 — Onboarding-Vollausbau (Score da; noch überspringbar)
- [ ] 02-07: 🟡 AGE-299 — Lifecycle-Mails via Resend (1 Mail + notifications-Tabelle; kein Nudge-System, Glocke nicht verdrahtet)
- [ ] 02-08: ⬜ AGE-298 — Rechnungsstellung via EasyBill
- [ ] 02-09: ⬜ AGE-260 — DSGVO-Paket (Rechtstexte, Consent, Betroffenenrechte, Audit-Log)
- [ ] 02-10: ⬜ AGE-262 — Academy & Library: echte Inhalte statt Platzhalter
- [ ] 02-11: ⬜ AGE-257 — Migrations-Deploy auf Prod automatisieren (CI)
- [ ] 02-12: ⬜ AGE-256 — Custom Domain app.fairbusinessclub.de (Infra, blockiert)

<sub>Hinweis: AGE-237 (Design-System Schwarz & Gold) gehört zum abgeschlossenen Projekt
„FBC Plattform – Prototyp" (Milestone W1 · Fundament) und bleibt dort — Fundament-Arbeit, nicht Phase 2.</sub>

### Phase 3: CRM, Matching v2 & Admin
**Goal**: In-Plattform-CRM statt Odoo, Matching v2 über Entitätstypen + Manager + Provision, autarker DKRI-Funnel, Admin-Bereich, Newsletter. Mit Patrick.
**Depends on**: Phase 2
**Linear-Milestone**: „Phase 3 – CRM, Matching v2 & Admin"
**Success Criteria** (what must be TRUE):
  1. Matching v2 gated auf bezahlte Matching-Stufe, mit Provisions-Logik. 🟡
  2. Admin-Bereich: Nutzerliste, Massen-Mail, Newsletter-Aktionen. 🟡
  3. In-Plattform-CRM (Kontaktliste, Filter, Outreach) ersetzt Odoo. ⬜
**Plans**: 7 Issues

Plans:
- [ ] 03-01: 🟡 AGE-302 — Matching v2 (Engine + Manager-Rolle da; Provision + 2400€-Gate fehlen)
- [ ] 03-02: 🟡 AGE-304 — Admin-Rollen + interner Bereich (staff_roles + Feedback/Routing da; Nutzerliste/Massen-Mail fehlen)
- [ ] 03-03: ⬜ AGE-301 — In-Plattform-CRM (Kontaktliste statt Odoo)
- [ ] 03-04: ⬜ AGE-303 — Standalone-DKRI-Matching-Funnel (autark vom FBC)
- [ ] 03-05: ⬜ AGE-305 — Themen-Newsletter (Opt-in/Opt-out)
- [ ] 03-06: ⬜ AGE-263 — Odoo-Anbindung / -Migration
- [ ] 03-07: ⬜ AGE-306 — DSGVO/UWG-Check: Adress-Strategie & Kalt-Outreach (Legal-Watch-Item)

### Phase 4: Ökosystem & Ventures
**Goal**: Capital-Parks-Ankaufsprofil ins Matching einspeisen; gemeinsame Ventures aus Plattform-Projekten.
**Depends on**: Phase 3
**Linear-Milestone**: „Phase 4 – Ökosystem & Ventures"
**Success Criteria** (what must be TRUE):
  1. Capital-Parks-Ankaufsprofil fließt ins Matching. ⬜
  2. Prozess für gemeinsame Ventures existiert. ⬜
**Plans**: 2 Issues

Plans:
- [ ] 04-01: ⬜ AGE-307 — Capital-Parks-Anbindung (Ankaufsprofil ins Matching)
- [ ] 04-02: ⬜ AGE-308 — Gemeinsame Ventures aus Plattform-Projekten

## Progress

**Execution Order:** Phasen laufen numerisch: 1 → 2 → 3 → 4. Phasen 1 und 2 laufen faktisch
parallel (beide „In progress"); aktiver Fokus ist Phase 2.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. UI-Politur | 5/9 | In progress | - |
| 2. Monetarisierung & Lifecycle | 5/12 | In progress | - |
| 3. CRM, Matching v2 & Admin | 0/7 | Not started (2 partial) | - |
| 4. Ökosystem & Ventures | 0/2 | Not started | - |

<sub>Statuswerte gespiegelt aus Linear (Reconciliation-Audit 2026-07-18). 🟡-Partials zählen
nicht als „complete"; Details je Issue als Linear-Kommentar.</sub>
