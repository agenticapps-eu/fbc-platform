# FBC Plattform (Fair Business Club)

## What This Is

Die Fair-Business-Club-Plattform ist ein soziales Business-Netzwerk mit gestuften
Mitgliedschaften: Mitglieder pflegen Profile, entdecken Formate (Kompass, Academy,
Events, Community …) und finden über Suche ⇄ Biete / Matching zueinander. Der Prototyp
(Phase 1 der Produktvision) baut **Ebene 1 – FBC Community**; die Ebenen 2 (Potential
Ecosystem) und 3 (DKRI) sind architektonisch vorbereitet, aber noch nicht implementiert.

## Core Value

Sichtbarkeit und Rechte richten sich nach der Mitgliedsstufe — und das wird **in der DB
per RLS erzwungen**, nicht nur im Frontend. Wenn nur eine Sache funktionieren muss: die
stufenbasierte Zugriffskontrolle hält unabhängig vom Client.

## Requirements

### Validated

<!-- Shipped und in Prod bestätigt. -->

- [x] Stufenmodell (6 Level: basic, connect, discover, exchange, focus, impact) als RLS (AGE-311)
- [x] Stripe Self-Service-Upgrade (Test-Mode), Webhook = Wahrheit für `profiles.tier` (AGE-259)
- [x] Neutrale öffentliche Startseite + persönliches Mitglieder-Dashboard (AGE-290)
- [x] QM-Feedback-MVP (Sterne + 3 Fragen + Route-Kontext) + Admin-Sicht (AGE-300, AGE-358)

### Active

<!-- Aktueller Scope. Siehe ROADMAP.md für die Phasen-Zuordnung. -->

- [ ] Monetarisierung & Lifecycle abschließen (EasyBill, Lifecycle-Mails, DSGVO) — Phase 2
- [ ] CRM, Matching v2 (Provision + Tier-Gate) & Admin-Bereich — Phase 3
- [ ] Ökosystem & Ventures (Capital Parks, gemeinsame Ventures) — Phase 4

### Out of Scope

- Ebene 2 (Potential Ecosystem) & Ebene 3 (DKRI) Implementierung — im Prototyp nur
  architektonisch vorbereitet, nicht gebaut.
- Automatische Freigabe von Kontaktdaten — Offenlegung erfordert immer explizite Aktion/Zustimmung.

## Context

- **Tech**: React + Vite + TypeScript (strict), Supabase (Postgres + RLS + Edge Functions),
  Stripe (Test-Mode), Cloudflare Pages. pnpm, Conventional Commits.
- **Prod**: Supabase-Ref `foelowldexkcqzewvrcf`; `env=dev` teilt sich die Prod-DB (lokale
  Schreibvorgänge treffen die Live-DB). CI (`deploy.yml`) deployt NUR das Cloudflare-Pages-
  Frontend — Edge Functions und Prod-Migrationen werden **manuell** deployed.
- **Stufen ↔ Formate** (Roadmap-Preise): Kompass 0 € → Library 150 → Academy 300 →
  Events 600 → Community/Prime 1.200 → Matching 2.400 (echtes Matching) → Projekte 4.800.

## Constraints

- **Security**: Jede Zugriffsregel MUSS als Supabase-RLS-Policy existieren; Frontend ist Komfort, keine Sicherheitsgrenze.
- **Tracking**: Jede Commit-Message referenziert das Linear-Issue (z. B. `AGE-259`); Issue-Status wird in Linear gepflegt.
- **Branches**: Immer Feature-Branch + PR nach `main`, nie direkt auf `main`. Branch-Format `<owner>/<issue>-<kurz>`.

## Linear-Sync-Konvention (GSD ⇄ Linear)

Diese `.planning/`-Struktur wurde am 2026-07-18 nachträglich über ein bestehendes,
Linear-getriebenes Projekt gelegt. **Linear bleibt die Quelle der Wahrheit für Issue-Status.**

- **GSD-Phase = Linear-Milestone** im Projekt „FBC Plattform – Roadmap (Phasen 1–4)".
- **Plan-Zeile in ROADMAP.md = Linear-Issue (AGE-xxx)** — die AGE-ID ist der Anker, nicht die GSD-Plan-Nummer.
- Status-Marker in ROADMAP.md (✅ done / 🟡 partial / ⬜ todo) spiegeln Linear; bei Abweichung gewinnt Linear.
- GSD-`/plan-phase` / `/execute-phase` werden für die konkrete Umsetzung genutzt, wenn ein
  Issue tatsächlich gebaut wird; der Issue-Status wird parallel in Linear aktualisiert.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| GSD adoptieren, Linear behalten | Roadmap-Struktur + Plan/Execute-Disziplin von GSD, Issue-Tracking bleibt in Linear | — Pending (Setup 2026-07-18) |
| Webhook = Wahrheit für `tier` | `tier` client-seitig schreibgeschützt, damit RLS-Stufenmodell nicht umgangen wird | ✓ Good (AGE-259) |
| 6-Level-Modell statt alter Discover/Prime/Legacy | Detlev bestätigt 15.07.2026; `circle`/`legacy` entfallen | ✓ Good (AGE-311) |

---
*Last updated: 2026-07-18 after GSD-Adoption + Open-Issue-Reconciliation-Audit*
