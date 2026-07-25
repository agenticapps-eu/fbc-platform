# AGE-237 — UI/UX Refresh nach Detlev-Review

**Branch:** `donald/age-237-ui-ux-refresh` · **Liefermodus:** alle 6 Punkte in einem PR.
**Design-Vertrag:** der eingefügte Prompt (Detlev-Review) + `docs/design-system.md`.

## Entscheidungen
- Nav-Reihenfolge: **Events vor Community** (neu, überschreibt bestehende AGE-237-Doku).
- Marke bleibt Schwarz & Gold; Inhaltsbereich heller. Kein Pink, kein Vollschwarz im Content.
- `dev` läuft gegen **prod-Supabase** → Screenshots nur lesend (Demo-Login), keine Writes.

## Arbeitspakete (verifizierbar)
1. **Theme heller** (`src/index.css`): `--color-night` `#0e0f12`→`#1b1c20`, `--color-soft`→`#f4f3ee`;
   in-Content-Schwarzflächen (DashboardHeader, ProfileHeader, ImpactWidget, Compass-Card) abmildern.
   DoD: App-Canvas warm hell, Sidebar weiches Anthrazit, Gold-Aktiv erhalten.
2. **Layout schmal & zentriert** (`AppShell.tsx`): zentrierter Shell max ~1120px, Sidebar an
   Container-Kante angedockt; einspaltige Seiten ~700px, mehrspaltige ~1100px; `<1024px` Off-Canvas.
   DoD: ruhige Ränder auf breiten Monitoren, Off-Canvas mit Hamburger unter 1024px.
3. **Nav-Reihenfolge** (`nav.ts` + `design-system.md §5`): Compass, Library, Academy, Events,
   Community, Matching, Projekte. DoD: Sidebar + Doku stimmen überein.
4. **Mein-Bereich = EINE Sidebar** (`AppShell.tsx`, neue Subnav-Config, `MeinBereichPage.tsx`):
   auf `/mein-bereich` ersetzt die bestehende Sidebar IN PLACE die Subnav (Gruppen aus profile-spec §4)
   mit `← Hauptmenü`-Eintrag; zweite Spalte/Sidebar entfällt. DoD: nur eine Sidebar, umschaltbar.
5. **Profil-Hero** (neue `ProfileHero`-Komponente; `PublicProfilePage`, `DashboardHeader`):
   Cover-Banner (Gold/Anthrazit-Verlauf-Default) + überlappendes großes rundes Bild, Name/Rollen/Tier.
   DoD: Hero auf öffentlichem Profil + „Mein Profil"/Dashboard-Kopf.
6. **Performance**: Skeleton-Loader statt „… wird geladen" (Dashboard/Profil/PublicProfile);
   Route-Komponenten lazy (`App.tsx`/`nav.ts`); Bilder `loading="lazy"`.
   DoD: keine nackten Lade-Texte; Routen code-split. (fetchDashboard ist bereits `Promise.all`.)

## Gates
lint + typecheck + test grün · `/browse`-Screens desktop & <1024px (before/after) ·
`/review` · design-system.md §5/§7 + `/styleguide` aktualisiert.
