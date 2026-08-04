# Session Handoff — 2026-08-04 (3. Session)

## Accomplished

**AGE-492 (C1) ist durch:** Plan-Review eingearbeitet, PR #106 gemerged, main
deployed, Theme-Migration manuell nach Prod gepusht (`supabase db push`) und
gegen Prod verifiziert (Spalte da, CHECK greift). Change archiviert →
`openspec/specs/design-system/` existiert jetzt.

**AGE-499 (C1a) auf Branch `donald/age-499-c1a-shell-layout`, 5 Commits,
noch kein PR.** Vier Befunde aus Donalds visueller Abnahme:

- **Sidebar sitzt am Rand** statt zu schweben (die Vorlage sagte das von Anfang
  an: „sitzt am Rand, nicht schwebend"). Logo im Sidebar-Kopf, Topbar rechts.
- **Volle Breite bis 1440 px.** `WIDE_ROUTES` → `NARROW_ROUTES`; der alte
  720-px-Default hatte `lg:grid-cols-3`/`xl:grid-cols-4` im Dashboard stillgelegt.
- **`navy` färbt nur noch das Chrome** — Richtungswechsel gegen Vorlage und
  gemergte Spec. Kein Dark-Reading-Mode mehr; steht so im Delta.
- **Seitenköpfe mit Bild** (`PageHero` + `FormatHero`), neun selbst gehostete
  Unsplash-Motive je Route.
- Dazu: Icons je Eintrag (aktiv gefüllt), einklappbare Sidebar, Kompass-Zacken
  brechen aus dem Ring aus (Favicon mitgezogen), `--color-scrim`.

284 Tests, lint, typecheck, build, `openspec validate --all` (26/26) grün.

## Decisions

- **Kein Dark-Reading-Mode mehr** (Donald). Der Preis steht ausdrücklich im
  Delta, damit ihn niemand später als Versehen liest.
- **Bilder heruntergeladen statt per CDN** — ein `images.unsplash.com`-Request
  wäre derselbe Fremdabruf, den AGE-492 für die Fonts entfernt hat.
- **Nur EIN Anmelde-Weg im Rahmen** (Topbar). Der Sidebar-Block war eine
  Wiederholung; ein zusätzliches „Mitglied werden" oben wäre die dritte Kopie
  gewesen — zwei Tests haben genau das gemeldet.
- **Formularseiten ohne Bildkopf** (Login, Onboarding, Einstellungen,
  Profil-Editor).
- **Icons selbst gezeichnet**, keine Bibliothek, keine Namensnennungspflicht.

## Files modified

- `src/index.css` — Chrome-Aktiv-Tokens, `--color-scrim`, navy auf Chrome
  reduziert, Shell-Geometrie-Klassen
- `src/components/AppShell.tsx` — komplette Shell-Struktur · `ui/NavIcon.tsx`,
  `ui/PageHero.tsx` neu · `ui/SidebarNav.tsx`, `ui/FormatHero.tsx`,
  `ui/Logo.tsx`, `ui/CompassMark.tsx`
- `src/config/formatHero.ts` — Motiv je Route · vier Seiten mit Kopf nachgerüstet
- `public/images/*` (9 webp + CREDITS.md), `public/brand/compass-favicon.svg`
- `openspec/changes/refine-shell-and-page-heads/` neu; C1 nach
  `openspec/changes/archive/2026-08-04-redesign-blue-theme-system/`

## Next session: start here

**Branch pushen und PR öffnen** (`donald/age-499-c1a-shell-layout` → main), falls
in dieser Session nicht mehr geschehen. Danach gilt wie bei C1: der Merge
deployt nur das Frontend — **hier ist das unkritisch, AGE-499 hat keine
Migration**.

Vorher offen aus `tasks.md`: **7.4** den Dashboard-Hero eingeloggt ansehen (bisher
nur über `/styleguide` geprüft, weil die lokale Abnahme ohne Login lief) und
**7.5** `docs/design-system.html` nachziehen — Navy-Umfang und Bildköpfe sind
dort überholt.

## Open questions

- **Fotografennamen fehlen** in `public/images/CREDITS.md`; über die CDN-Kennung
  nicht auflösbar. Lizenzkonform, aber unhöflich.
- **AGE-492s Abnahmeliste ist nicht leer** — die Preview-Abnahme durch Detlev und
  das Durchklicken beider Themes stehen aus; der Archivlauf hat die zwei offenen
  Aufgaben gemeldet und trotzdem archiviert (`--yes`).
- Neue Regel, dauerhaft gemerkt: **bei Design-Änderungen erst eine laufende
  lokale Version zeigen, dann committen.**
