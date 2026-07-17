# Session Handoff — 2026-07-16 (AGE-300 + AGE-358, zwei PRs offen)

## Accomplished

Zwei zusammenhängende Features gebaut, beide mit offenem PR, beide grün und browser-verifiziert.

**AGE-358 (Admin liest QM-Feedback)** — **PR #72**, gestapelt auf #71 (Branch
`donald/age-358-admin-liest-qm-feedback-seed-sicht`, von AGE-300 abgezweigt). Gibt der
`feedback_admin_read`-Policy einen Nutzer + Oberfläche. Teil A: `supabase/seed/admin_roles.sql`
(weist admin per E-Mail-Lookup zu, KEINE Accounts/Passwörter, E-Mail-Platzhalter, manuell,
ADR-0002). Teil B: RPC `admin_list_feedback()` (SECURITY DEFINER, Feedback + Autor-Name nur wenn
is_admin — RPC statt Join, weil die profiles-RLS sonst Autor-Namen verbärge) + `<Card>` „QM-Feedback"
in /einstellungen, nur für `staffRole === 'admin'`. pgTAP 47/47, Frontend 193/193. **Browser
end-to-end belegt:** Admin sieht die Card mit Eintrag (★★★★☆, Texte, „QA Tester · /compass",
Datum); nach Entzug der admin-Rolle verschwindet die Card beim selben Nutzer (Gating greift live).
**Wichtig:** GitHub richtet #72 nach dem Merge von #71 automatisch auf `main` um — **#71 zuerst mergen**.

**AGE-300 (QM-Feedback-MVP)** — **PR #71**, Branch
`donald/age-300-qm-feedback-mvp-sterne-3-fragen-route-kontext`, 9 Commits (inkl. Button-Fix:
Feedback-Button höher, weicht dem Design-Switcher aus — aus der Browser-Abnahme). Erster Schritt
aus Spec §3.5 des 6-Level-Upgrade-Specs — Stripe (§3.1-3.4) bleibt offen.

Ablauf: Brainstorming → Design-Spec → Plan → 5 Tasks subagent-getrieben, jeder mit eigenem
Task-Review (opus), dann Gesamt-Review über den Branch. Ledger: `.superpowers/sdd/progress.md`.

**Was das Feature tut:** Schwebender „Feedback"-Button (nur für eingeloggte Nutzer, überall
im AppShell), öffnet einen Dialog mit ⭐-Bewertung + drei Fragen (gefällt/fehlt/Idee). Route
wird automatisch mitgeschrieben. Ein `admin` liest alles, jeder andere nur sein eigenes.

**Stand:** pgTAP 41/41 · Score-Probe alle Spalten grün · Frontend 187/187 · typecheck sauber
· lint 0 Fehler. Lokales Supabase läuft.

## Decisions

- **Plattformweit statt aktionsgebunden** — die `feedback`-Tabelle (AGE-234) ist auf
  event/match/course gebaut, §3.5 fragt aber die Plattform ab. `ref_type`/`ref_id` bleiben
  bei diesen Zeilen NULL. Vier Spalten additiv (`likes/misses/idea/route`), keine zweite Tabelle.
- **`is_admin()` eng auf `role='admin'`**, nicht `is_matching_manager()` mitbenutzt: QM ist
  nicht die Deal-Queue (ADR-0002). Quelle bleibt `staff_roles`, nie das member-writable
  `profiles.roles`.
- **Score-Bug mitgefixt** (kein eigener Task ursprünglich): `recompute_potential_score()`
  mittelte `avg(rating)` über `feedback.profile_id` OHNE `ref_type`-Filter — ein Gast hätte
  mit seiner Plattform-Bewertung seinen EIGENEN Potenzial-Score verstellt. `and ref_type is
not null` ergänzt. Die bestehende `probe_potential_score.sql` hat den Bug die ganze Zeit
  dokumentiert (Fixture ohne ref_type, erwartet 54); Probe scharf gestellt: ohne Fix 50, mit 54.
- **is_admin()-Lockdown** (Gesamt-Review-Fund): `revoke execute from public, anon` fehlte —
  jede Schwesterfunktion hat es (AGE-312-Klasse). Nachgezogen + pgTAP-Assertion.
- **Kein Nav-Eintrag** — `nav.test.ts` nagelt 6+5+1 an Spec §2; schwebender Button statt Menü.

## Files modified

- `supabase/migrations/20260716070000_platform_feedback.sql` — 4 Spalten, `is_admin()`,
  `feedback_admin_read`, Score-Filter, Lockdown.
- `supabase/tests/rls_test.sql` — Admin-Lesetests + anon-Lockdown-Test (plan 31→38).
- `supabase/tests/probe_potential_score.sql` — Fixture auf `ref_type='event'` + Plattform-Zeile.
- `src/lib/feedback.ts` (+test), `src/lib/database.types.ts` (4 Spalten von Hand ergänzt).
- `src/components/feedback/FeedbackButton.tsx` (+test), `src/components/AppShell.tsx`,
  `src/App.test.tsx` (ToastProvider-Harness-Fix).
- Doku: `docs/superpowers/specs/2026-07-16-qm-feedback-design.md`,
  `docs/superpowers/plans/2026-07-16-qm-feedback.md`.

## Next session: start here

**Zwei gestapelte PRs mergen — Reihenfolge zählt.** Erst **#71 (AGE-300)**, dann **#72
(AGE-358)** (GitHub richtet #72 nach dem #71-Merge automatisch auf `main` um). Merge braucht
hier je eine Freigabe, die den PR beim Namen nennt (öffentliches Repo, Sicherheits-Klassifikator).
Nach jedem Merge die **Prod-Migration von Hand anwenden** (CI zieht nicht nach): erst
`20260716070000_platform_feedback.sql`, dann `20260716103000_admin_feedback_rpc.sql`.
Danach AGE-300 und AGE-358 auf Done.

**Admins scharf schalten** (fürs Sommerfest): `supabase/seed/admin_roles.sql` mit den ECHTEN
E-Mails von Detlev und Donald gegen die Prod-DB fahren (SQL-Editor oder psql -v). Wirkt erst,
wenn die beiden sich registriert haben.

## Open questions

- **Beide Browser-Abnahmen ERLEDIGT** (2026-07-16, localhost gegen die LOKALE DB — Infisical
  umgangen, indem vite direkt mit den lokalen VITE*SUPABASE*\*-Werten gestartet wurde).
  AGE-300: Button rendert, Dialog mit Sternen + drei Fragen, Absenden ohne Sterne gesperrt →
  nach 4 Sternen aktiv, DB-Zeile trägt rating=4, die drei Texte, route, ref_type NULL. AGE-358:
  Admin sieht die QM-Feedback-Card mit Eintrag inkl. Autor; nach Rollen-Entzug verschwindet sie.
- **Button-Overlap GELÖST** (AGE-300, Button-Fix-Commit): Feedback-Button auf `bottom-20`
  gesetzt, sitzt jetzt klar über dem AGE-237-Design-Switcher. Browser-bestätigt.
- **`admin` in `staff_roles` GELÖST** (AGE-358): `admin_roles.sql` schaltet Admins frei. Muss
  nur noch mit echten E-Mails gegen Prod gefahren werden (s. „Next session").
- **Prod-Migration** muss ein Mensch anwenden (CI zieht nicht nach) — jetzt ZWEI Migrationen.
- **Follow-ups** (nicht in diesem Branch): UPDATE-Pfad auf `feedback` ungetestet; Score-Probe
  läuft nicht in CI (kein Regressionsschutz für den Filter); `database.types.ts` divergiert
  generell von der CLI (Team-Backlog).
- **AGE-311-Doku-Altlast** unverändert offen: `demo-script.md`, `tier-testing.md`,
  `demo-zugang.md` beschreiben noch „Discover → Prime → Legacy". Immer noch ohne Issue.
- **Branch `donald/age-314-nav-ia-umbau`** liegt weiter lokal + auf origin, obwohl #67 gemergt.
- Ältere Ränder aus dem AGE-314-Handoff unverändert (`.planning/` nicht gitignored im public
  Repo, `is_public` Default true, TLS beim Seed, Design-Variant-Switcher).
