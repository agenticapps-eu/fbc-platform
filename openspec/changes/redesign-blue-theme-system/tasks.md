# Tasks

Ordering is deliberate. Task 1 is a pure rename with **no behavioural change** and
must land as its own commit — mixed into the recolour it becomes unreviewable, and
a reviewer cannot tell a missed utility string from an intended one. Everything
after it assumes the new names.

## 1. Mechanical rename — `gold` → `accent`, `night` → `chrome` (no behaviour change)

Scope: 237 `gold` occurrences in 57 files, 55 `night` occurrences in 15 files.
Nothing else. Colours stay gold on screen at the end of this task — that is the
point: any visual difference here is a mistake.

- [x] 1.1 Delete `--accent2` **first** (definition `src/index.css:21`, overrides
      `:199,:222`, readers `:578-580`, `designVariants.ts:32,153,165`,
      `StyleguidePage.tsx:196-200`) — it occupies the `accent` namespace the rename
      needs. The `data-card-style="glass"` hover block that reads it goes with it.
- [x] 1.2 Rename `--color-gold` → `--color-accent`, `--color-gold-strong` →
      `--color-accent-strong`, `--color-gold-soft` → `--color-accent-soft` and every
      utility built on them (`text-`, `bg-`, `border-`, `ring-`, `from-`, `to-`,
      `fill-`, `stroke-`, `shadow-`, `divide-`, `outline-`, `decoration-`)
- [x] 1.3 Fix the two `accent-color` collisions by hand — `OnboardingPage.tsx:213`
      (`accent-gold`) and `AvatarCropper.tsx:149` (`accent-gold-strong`). A blind
      substitution yields `accent-accent`, which resolves to nothing and fails
      silently: the range input just loses its thumb colour.
- [x] 1.4 Rename the identifier `goldMix()` → `accentMix()`
      (`src/config/membershipVisuals.ts:10,27`) and update
      `membershipVisuals.test.ts`
- [x] 1.5 Rename `--color-night` → `--color-chrome`, `--color-night-elevated` →
      `--color-chrome-elevated`, `--color-night-border` → `--color-chrome-border`,
      `--color-on-night` → `--color-on-chrome`, `--color-on-night-muted` →
      `--color-on-chrome-muted`, plus every utility. Heaviest file:
      `OnboardingPage.tsx` (27).
- [x] 1.6 Rewrite every comment and label that names Gold as a colour — ~55
      capitalised "Gold" mentions across 10 files, heaviest `src/index.css` (25),
      `StyleguidePage.tsx` (12), `designVariants.ts` (8). Includes the visible
      strings `"Mit Goldakzent"` / `"Feine Goldlinie …"` (`StyleguidePage.tsx:422-423`)
      and the `TierBadge.tsx:5` rationale.
- [x] 1.7 **Verification for this task alone**: `grep -rni "gold" src/` → 0, and
      `pnpm lint && pnpm typecheck && pnpm test` green. Commit before task 2.

## 2. Token block — blue ramp, two themes

Source of truth: the `@theme` block in `docs/design-system.html:565-594`. Its
`--surface` maps to the repo's `--color-canvas` (cards) and its `--canvas` /
`--surface-2` to `--color-soft` (app background). That mapping is deliberate;
AGE-492 keeps the repo's confusing names rather than run a third mass rename.

- [x] 2.1 Replace the `@theme` block in `src/index.css` — blue ramp
      `--color-blue-50…950`, layer tokens at their **hell** values, semantic
      `success`/`warning`/`danger`, `--radius-card: 14px`, `--shadow-soft`
- [x] 2.2 Add `--color-accent-ink` (text on an accent surface): `#FFFFFF` hell,
      `#081527` navy. Buttons need it; the current tree has no such token.
- [x] 2.3 Add the single override block `html[data-variant="navy"]` — only the
      layer tokens change, per the template
- [x] 2.4 Set `--font-display: "Fraunces", Georgia, serif`; body copy stays
      anthracite `#1E2A3A`, never pure black
- [x] 2.5 Delete the seven `--color-fmt-*` tokens (`src/index.css:40-46`) — zero
      readers, verified
- [x] 2.6 Re-point the tier badge colours at the blue ramp
      (`--tier-*` in the template). Note the template names the lowest tier
      `boost`; this repo's six-level model calls it **`basic`** (AGE-311) — use the
      repo name, take the value.

## 3. Variant teardown

- [x] 3.1 `designVariants.ts`: `DesignVariantId` becomes `'hell' | 'navy'`,
      `DEFAULT_VARIANT = 'hell'`, `DesignVariant` collapses to
      `{ id, label, description }`. Drop `MotionIntensity`, `HeroStyle`,
      `HeadlineFont`, `BackdropStyle`, `CardStyle` and `SWITCHER_VARIANT_IDS`.
- [x] 3.2 Remove the twelve `html[data-variant=…]` blocks from `src/index.css`
      (`a`–`i`, `sommerfest`, `blau`, `blau-slate`, `blau-navy`) and their
      `.fbc-sidebar-surface` sub-overrides
- [x] 3.3 Delete `VariantBackdrop`, `.fbc-backdrop*`, `data-backdrop` and
      `data-card-style` end to end (component, CSS, DOM writes in
      `DesignVariantProvider`, the `flags` map in `index.html`)
- [x] 3.4 Delete `.fbc-sheen`, `.fbc-hero-shimmer`, `.fbc-tier-pulse` and their
      keyframes plus every class reference; keep `.fbc-card` hover and the
      `prefers-reduced-motion` block
- [x] 3.5 Remove the `linkedin` variant, the `EffBeeZeeApp` import
      (`src/App.tsx:9`) and the staff escape hatch in `AppInner` that renders the
      vision app instead of the real one. `src/vision/` stays on disk, imported by
      nothing — confirm with `grep -rn "vision/" src/`.
- [x] 3.6 Stop mounting `<DesignSwitcher />` in `src/App.tsx`. The component and
      its logic stay in the tree (AGE-492 §4); only the mount point goes.
- [x] 3.7 Simplify `DesignVariantProvider` — drop `cycleVariant`, the motion preset
      and the `?variant=` URL sync. `usePrefersReducedMotion` stays (the CSS still
      honours it); `getMotionPreset` and its test go if nothing else reads them.

## 4. Theme before first paint (pitfall 1)

The inline script in `index.html` already exists and already prevents the flash for
`data-variant`. It is being reduced, and its precedence rule now has a third source.

- [x] 4.1 **tdd** Test first: `resolveInitialVariant` returns `hell` for a stored
      `sommerfest`, for `?variant=blau`, for `null`, and for garbage; returns
      `navy` only for a stored or requested `navy`
- [x] 4.2 Reduce the inline script — `ok`/`offered` become `["hell","navy"]`,
      default `hell`, drop the `flags` map and both `dataset` writes for
      `cardStyle`/`backdrop`. Keep the `try/catch` (private mode).
- [x] 4.3 Change the `<html data-variant="sommerfest">` attribute in `index.html`
      to `hell`, so the pre-script markup is already correct
- [x] 4.4 Set `<meta name="theme-color">` per theme (`#FFFFFF` / `#081527`)

## 5. `member_settings.theme` (migration)

- [x] 5.1 New migration: `alter table public.member_settings add column theme text
  not null default 'hell' check (theme in ('hell','navy'))`. No new policy and
      no new grant — `member_settings_own` is `for all` and the table grants
      already cover `authenticated`. Record that reasoning in the migration header,
      per this repo's convention.
- [x] 5.2 **tdd** pgTAP: the owner reads and writes their own `theme`; another
      member cannot; an invalid value is rejected by the check constraint
- [x] 5.3 Confirm `supabase/tests/grants_test.sql` still passes — a new **column**
      on a table that already carries table-level grants should not move the golden
      snapshot, but the snapshot has broken on schema additions before, so check
      rather than assume
- [x] 5.4 Extend `DEFAULT_MEMBER_SETTINGS` and the `MemberSettings` type in
      `src/lib/member-settings.ts`

## 6. Theme resolution across login (pitfall 2)

- [x] 6.1 **tdd** Test first, all four states: logged out → `localStorage` only,
      default `hell` · logged in → `member_settings.theme` wins and overwrites
      `localStorage` · switching while logged in → server write **and**
      `localStorage` · logout → the last value survives as the anonymous default
- [x] 6.2 Implement the resolution in `DesignVariantProvider`. The server value
      arrives after first paint by definition, so it must be applied without a
      visible second flash — if it differs from the pre-paint value the transition
      is a deliberate one, not a flicker.
- [x] 6.3 On logout, do not reset the theme to `hell`; leave what the member chose.
      (`AGE-258` clears the query cache on logout — make sure this survives it.)

## 7. Theme switch in the settings

- [x] 7.1 `ToggleRow` for hell/navy in `EinstellungenPage`, wired to the existing
      `save` mutation with its optimistic update and rollback
- [x] 7.2 The switch takes effect immediately, not on save-confirm
- [x] 7.3 Extend `EinstellungenPage.test.tsx`

## 8. Brand

- [x] 8.1 New `src/components/ui/CompassMark.tsx` — four-point star in a thin ring,
      `fill="currentColor"`, path from `docs/design-system.html:252`
- [x] 8.2 Rewrite `Logo.tsx`: drop `tone`, `DARK_CHROME_VARIANTS` and the PNG
      branch. `lockup="full"` → mark and wordmark **side by side** (not stacked like
      the old PNG); `lockup="mark"` → the compass alone. Wordmark `eff.bee.zee`,
      all lowercase, dots in `--color-accent`. This closes the open note in the
      component's own docstring.
- [x] 8.3 Every `alt` and `title` becomes `eff.bee.zee`
- [x] 8.4 Delete `CrownMark.tsx`, `public/brand/fbc-logo-crown.png`,
      `public/brand/crown-favicon.svg`
- [x] 8.5 New `public/brand/compass-favicon.svg`, ring thickened to 2px at 16px;
      update both `<link rel>` tags in `index.html`

## 9. Self-hosted fonts

- [x] 9.1 Remove the `@import url("https://fonts.googleapis.com/…")` at
      `src/index.css:1`
- [x] 9.2 Fraunces (400, 500) and Inter (400, 500, 600, 700) as woff2 in
      `public/fonts/`. Cormorant Garamond is dropped — Fraunces is decided.
- [x] 9.3 `@font-face` with `font-display: swap` and `unicode-range` for latin +
      latin-ext
- [x] 9.4 Verify: `grep -rn "fonts.googleapis" src/ index.html` → 0, **and** no
      request to a Google host in the network tab on load

## 10. Styleguide and docs

- [x] 10.1 Rebuild `src/pages/StyleguidePage.tsx` (dev-only, `/styleguide`) as the
      living form of the design system: token table, colour ramp, type scale, every
      UI primitive, both themes switchable. One truth in code.
- [x] 10.2 Rewrite `docs/design-system.md` to the new direction, pointing at
      `docs/design-system.html`

## 11. CI gate and acceptance

The greps are the acceptance criterion because TypeScript does not check Tailwind
class names. A criterion that only a human runs is one that C2–C6 will quietly
break, so it goes into CI where it can go red.

- [x] 11.1 Add a CI step to `.github/workflows/ci.yml` (`verify` job) that fails on
      `grep -rni "gold" src/` or `grep -rn "fonts.googleapis" src/ index.html`
      returning anything
- [x] 11.2 `?variant=sommerfest`, `?variant=b`, `?variant=linkedin` fall back to
      `hell` without crashing
- [x] 11.3 Theme switch takes effect immediately, survives reload, and survives
      logout/login
- [x] 11.4 No flash on load in either theme — capture it, do not assert it
- [ ] 11.5 Both themes clicked through: Start · Kompass · Academy · Events ·
      Mitglieder · Aktivität · Profil · Einstellungen · Login
- [x] 11.6 WCAG AA contrast in both themes, tier badges and tags included —
      measured in-browser over 99 text nodes on `/styleguide` per theme (it
      renders every primitive on one page), contrast computed from composited
      colours with explicit oklab conversion. Two real defects found and fixed:
      `--color-muted` missed AA on `--color-soft` by 0.03 in the light theme, and
      the semantic colours had no navy override at all (green 3.12, red 2.82 on
      dark). Both now clear AA on every surface. Caveat: this covers the
      styleguide's rendering of each primitive, not every page state — 11.5 and
      11.8 remain the human check.
- [x] 11.7 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green
- [ ] 11.8 Preview deploy signed off by Detlev
