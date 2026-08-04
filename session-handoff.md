# Session Handoff — 2026-08-04

## Accomplished

Change C1 des eff.bee.zee-Go-Live (**AGE-492**) vollständig implementiert, auf
Branch `donald/age-492-c1-design-system-blau-statt-gold`, 6 Commits.

- OpenSpec-Change `redesign-blue-theme-system` angelegt: proposal.md, tasks.md,
  neue Capability `design-system` (6 Requirements), `member-profiles` erweitert.
  `openspec validate --all` grün (25/25).
- **Umbenennung** gold→accent (237 Treffer/57 Dateien) und night→chrome
  (55/15) als eigener, verhaltensneutraler erster Commit.
- **Blau-Token-System**, zwei Themes (hell/navy), `index.css` 661→165 Zeilen
  (+ Font-Block). Zwölf Varianten, Backdrops, Glow-Effekte, `--accent2`,
  `--color-fmt-*` entfernt.
- **`member_settings.theme`** (Migration + 6 pgTAP-Assertions), Theme-Auflösung
  über localStorage + Server, Umschalter in den Einstellungen.
- **Marke:** `CompassMark` ersetzt `CrownMark`, Logo ohne `tone`/PNG, neues
  Favicon. Kronen-Assets gelöscht.
- **Fonts selbst gehostet** (4 woff2, 260 kB) — kein Fremd-CDN mehr.
- **CI-Gate** für beide grep-Kriterien, per Sonde als wirksam belegt.
- **WCAG AA gemessen** in beiden Themes; zwei echte Kontrastfehler gefunden
  und behoben.

283 Tests grün, lint/typecheck/build grün.

## Decisions

- **night→chrome mitumbenannt** — auf Donalds Entscheidung, bewusst gegen
  AGE-492s „ein Massen-Rename reicht". Grund: `--color-night` bedeutet im hellen
  Theme Weiß.
- **`linkedin` ganz entfernt** statt „unerreichbar behalten" (AGE-492 §3) — ohne
  CSS-Block, Route und Vision-App wäre es ein toter Enum-Wert.
- **Theme hat einen eigenen schmalen Schreibpfad**, nicht ein Feld in
  `MemberSettings`: `saveMemberSettings` upsertet alle Präferenzen und würde das
  Theme mit einem veralteten Cache-Wert überschreiben (Lehre aus AGE-313).
- **Server-Write hängt an der Handlung** (`EinstellungenPage`), nicht an einem
  Effect über `variant`. Aus einem Effect abgeleitet überschrieb die lokale Wahl
  beim Login den Serverwert — der Test hat das gefunden, nicht ein Review.
- **`ThemeServerSync` sitzt neben dem Provider**, nicht darin: Auth+Query im
  Provider zwangen jeden Seitentest, beide mitzubringen.
- **TierBadge behält 3 Gewichte** statt der 6 `--tier-*` der Vorlage — die
  bestehende Entscheidung ist im Code begründet, und niemand hat sie infrage
  gestellt.

## Files modified

- `src/index.css` — komplett neu (Tokens, navy-Override, @font-face)
- `src/config/designVariants.ts`, `src/providers/{DesignVariantProvider,design-variant-context}` — auf zwei Themes reduziert
- `src/providers/ThemeServerSync.tsx` (+ Test) — neu
- `src/components/ui/`: `CompassMark.tsx` neu, `Logo.tsx` neu geschrieben, `CrownMark.tsx` gelöscht
- `src/pages/{EinstellungenPage,StyleguidePage}.tsx`
- `supabase/migrations/20260804120000_member_settings_theme.sql`, `supabase/tests/rls_test.sql`
- `index.html`, `.github/workflows/ci.yml`, `docs/design-system.md`
- `public/fonts/*` (4 neu), `public/brand/*` (Krone raus, Kompass rein)

## Next session: start here

**Zuerst die pgTAP-Suite laufen lassen** — sie ist der einzige ungeprüfte Teil.
Port 54322 war von cparx belegt, deshalb konnte `supabase start` hier nicht
booten. Also: cparx-Stack stoppen (`supabase stop --project-id cparx`) oder in
`supabase/config.toml` einen anderen Port setzen, dann
`supabase test db supabase/tests/grants_test.sql supabase/tests/rls_test.sql`.
Besonders `grants_test.sql` — dessen Golden-Snapshot ist bei Schema-Ergänzungen
schon einmal gebrochen (AGE-455). Danach PR öffnen.

## Open questions

- **`docs/design-system.html` ist untracked** (Rechte 0600) und wird von
  proposal.md, tasks.md und `docs/design-system.md` als verbindliche Vorlage
  referenziert. Soll sie ins (öffentliche) Repo? Bewusst nicht eingecheckt.
- **Zwei Hook-Overrides** waren nötig: `design-shotgun-gate` und
  `database-sentinel`. Beide verlangen ein Sentinel unter `.planning/`, das die
  globale CLAUDE.md als schreibverboten führt; der zweite verweist zusätzlich
  auf `/gsd-discuss-phase`, das es nicht mehr gibt. Als **AGE-493** gemeldet.
- **`run-plan-review.sh` lief nicht** — der Spec-Delta ging ungeprüft in die
  Umsetzung (Stage 2 ist seit Gate 2.0.0 nicht erzwungen).
- **`DesignSwitcher` ist jetzt totes Gewicht**: nicht gemountet, für zwei Themes
  umgebaut, Funktion von den Einstellungen übernommen. Löschkandidat für C2.
- Der alte `CrownIcon` (Rang-Symbol in `profil-widgets`/`ProfileHero`) ist
  geblieben — gehört nicht zum Logo, aber eine Krone passt nach dem Rebrand
  nicht mehr. Kandidat für C2/C6.
