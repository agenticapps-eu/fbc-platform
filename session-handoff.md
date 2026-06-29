# Session Handoff — 2026-06-29 (AGE-237 Folge: Live-Design-Switcher A/B/C/D)

## Accomplished

Branch `donald/age-237-design-variants-switcher` (4 Commits, NICHT gemergt). Alles in einem PR geplant.

- **Varianten-System**: `src/config/designVariants.ts` (A/B/C/D, Default D, Flags motion/hero/font),
  `src/providers/DesignVariantProvider.tsx` setzt `html[data-variant]`; Precedence URL `?variant=` >
  localStorage `fbc.designVariant` > Default `d`; persistiert + `replaceState`. TDD: 13 Tests grün.
- **Token-Overrides** je Variante in `src/index.css` (`html[data-variant=...]`), inkl. `--sidebar-surface`/
  `--hero-bg`. CSS-Animations-Utilities (sheen, hero-shimmer, card-glow, tier-pulse) — alle
  `prefers-reduced-motion`-gated.
- **Live-Switcher** `src/components/DesignSwitcher.tsx` (Flag `VITE_DESIGN_SWITCHER`, default on; Shift+D
  cycelt; app-weit via `App.tsx`). Deep-Links `?variant=a|b|c|d` funktionieren.
- **Krone-Logo**: `Logo.tsx` neu — echtes PNG-Lockup auf hellen Flächen (mit `mix-blend-multiply`),
  rebuilt Gold-`CrownMark.tsx` SVG + Gold-Wortmarke auf dunklen; Favicon `public/brand/crown-favicon.svg`.
- **Motion-Primitives** `src/components/ui/Motion.tsx` (RouteTransition/Stagger/StaggerItem/CountUp),
  Presets `src/lib/motion.ts`. Angewandt: Seitenübergänge (AppShell), Stagger (Feed/Verzeichnis/Matching),
  Count-up (Impact/Match-Score/Stat-Tiles), Sidebar-Slide-Indicator (layoutId), animierte Match-Score-Balken,
  Hero-Shimmer (Login/Profil/Matching-Header), Button-Sheen, Tier-Puls.
- **/styleguide**: neue „Design-Varianten"-Section mit Live-Switch-Karten + Count-up/Tier/Sheen-Demo.
- Verifiziert: typecheck + lint + 145 Tests grün, `pnpm build` grün; visuell A/B/D + Styleguide + Shell
  per Chrome-DevTools-Screenshots (alle korrekt).

## Decisions

- Logo dunkel als **eigenes Gold-SVG nachgebaut** (User-Entscheidung) statt PNG freistellen — kein
  ImageMagick, PNG-BG ist Creme-Verlauf + grüne Wortmarke.
- **Alles in einem PR** (User-Entscheidung), keine Slices.
- `text-gold` (nicht `gold-soft`) für dunkle Wortmarke — `gold-soft` ist in Variante B dunkel.
- Tests laufen deterministisch mit **reduced-motion=true** (setup.ts Stubs für IntersectionObserver/matchMedia).
- Leaf-/Motion-Komponenten nutzen nicht-werfendes `useDesignVariantValue()`, damit Page-Tests ohne
  Provider rendern; Switcher nutzt striktes `useDesignVariant()`. Provider in `App.tsx` (nicht main) → App.test grün.

## Files modified

Neu: `config/designVariants.ts(.test)`, `lib/motion.ts(.test)`, `providers/design-variant-context.ts`,
`providers/DesignVariantProvider.tsx`, `hooks/usePrefersReducedMotion.ts`, `components/DesignSwitcher.tsx`,
`components/ui/CrownMark.tsx`, `components/ui/Motion.tsx`, `public/brand/crown-favicon.svg`.
Geändert: `index.css`, `index.html`, `main.tsx`(revert), `App.tsx`, `vite-env.d.ts`, `test/setup.ts`,
`components/AppShell.tsx`, `components/ui/{Logo,SidebarNav,Button,Card,TierBadge}.tsx`,
`components/profile/ProfileHero.tsx`, `components/community/{CommunityFeed,MemberDirectory}.tsx`,
`pages/{LoginPage,MatchingPage,StyleguidePage}.tsx`.

## Next session: start here

PR öffnen (`gh pr create`, Titel `feat: live design-variant switcher (A/B/C/D) with animations + crown logo (AGE-237)`)
und die Review-Gates fahren (`/review` Spec-Compliance → `superpowers:requesting-code-review`). Danach Detlev
die vier `?variant=`-Deep-Links schicken. KEIN `/cso` nötig (kein auth/storage/api/llm).

## Open questions / Altlasten

- **Logo-PNG hat Creme-Hintergrund** (nicht transparent) → `mix-blend-multiply` mildert die Box, aber
  Detlev sollte das offizielle **transparente SVG** liefern (TODO).
- **Nicht umgesetzte Spec-Animationen** (bewusst, als Follow-up): Skeleton→Inhalt-Cross-Fade;
  Gold-Funken-Mikrofeedback bei Kontaktanfrage-Annahme (nur b/d); „Warum dieses Match?" nutzt natives
  `<details>` ohne animiertes Auf-/Zuklappen.
- Nach Detlevs Entscheidung: `VITE_DESIGN_SWITCHER=off`, gewählte Variante als einzige, ungenutzte
  Variant-Blöcke entfernen (siehe Memory `design-variant-switcher`).
