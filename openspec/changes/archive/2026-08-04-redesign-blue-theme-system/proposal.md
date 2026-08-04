# Blue theme system: two themes, one accent, member-chosen

## Why

The platform ships as "Schwarz & Gold" (AGE-237) with twelve live design variants
layered on top (AGE-439, AGE-441). The eff.bee.zee go-live replaces that with one
blue accent family and exactly two themes — **hell** and **navy** — per the binding
template `docs/design-system.html`.

The substance is not CSS. `gold` is a **Tailwind utility name** in this repo:
`text-gold`, `bg-gold`, `border-gold-strong`, `bg-gold-soft`. Measured on
2026-08-04: **237 occurrences across 57 files**, of which `src/index.css` holds 49
and the other 208 are utility strings spread across components. TypeScript checks
none of them, because they are strings. Recolouring the tokens takes minutes; the
rename is the work, and its acceptance is therefore a `grep`, not a typecheck.

Decided: **rename, do not alias.** An alias would mean `text-gold` permanently
renders blue.

Linear: **AGE-492**. Supersedes AGE-237, AGE-439, AGE-441.

## What Changes

**Tokens.** `--color-gold{,-strong,-soft}` become `--color-accent{,-strong,-soft}`
carrying the blue ramp. Layer tokens (`canvas`, `soft`, `line`, `ink`, `muted`,
`sidebar-surface`, `hero-bg`) keep their names and get per-theme values. The
`night` chrome family is renamed to `chrome` in the same pass — after the rebuild
`--color-night` means white in the hell theme, and a name that says the opposite of
its value is a trap for C2–C6.

**Deletions.** The seven `--color-fmt-*` tokens (verified: zero uses), `--accent2`,
the twelve variants `a b c d e f g h i sommerfest blau blau-slate` with their
`html[data-variant=…]` blocks, the `data-card-style` / `data-backdrop` mechanism
with `VariantBackdrop` and `.fbc-backdrop*`, and the glow effects `.fbc-sheen`,
`.fbc-hero-shimmer`, `.fbc-tier-pulse` — glow contradicts "ruhig und seriös".
`DesignVariant` collapses to `{ id, label, description }`; `MotionIntensity`,
`HeroStyle`, `HeadlineFont`, `BackdropStyle` and `CardStyle` lose their purpose
when two themes share one typography.

**Theme becomes a member setting.** `member_settings.theme` (`'hell' | 'navy'`,
default `'hell'`) plus `localStorage`. Logged out, `localStorage` alone governs and
the default is `hell`. On login the server value wins and overwrites
`localStorage`. The switch is a `ToggleRow` in `EinstellungenPage`. The
`DesignSwitcher` stops being mounted; the component stays in the tree.

**Brand.** `CompassMark.tsx` (four-point compass star in a thin ring,
`fill="currentColor"`) replaces `CrownMark.tsx`. `Logo.tsx` loses `tone`,
`DARK_CHROME_VARIANTS` and the second asset, resolving the open note it carries.

**Fonts self-hosted.** The Google Fonts `@import` on line 1 of `src/index.css` is
an Abmahnung risk in Germany. Fraunces and Inter move to `public/fonts/` as woff2.
Cormorant Garamond is dropped.

## Impact

- **New capability `design-system`** — the platform had no spec for theming; twelve
  variants existed as code with no stated truth. This change creates that truth.
- **`member-profiles` modified** — the `member_settings` requirement is extended to
  name `theme` as a persisted preference under the existing owner-only RLS.
- No new table, policy or grant: `theme` is a column on `member_settings`, which
  already holds `member_settings_own` (`for all`, `profile_id = auth.uid()`) and
  table grants `select, insert, update` to `authenticated`.

## Decisions taken during scoping

Four assumptions in AGE-492 were checked against the tree before planning. Three
held; one did not, and two gaps were resolved by the requester on 2026-08-04.

1. **`--color-fmt-*` is dead** — confirmed, 7 definitions, 0 uses. Deleted
   outright. Note that `docs/design-system.html:601` says "auf die Blau-Rampe
   umstellen oder auf Neutral reduzieren"; the measurement supersedes it, because
   there is nothing to convert.
2. **`--accent2` is unused — false.** It is read in three places:
   `src/index.css:578-580` (`data-card-style="glass"` hover, three `color-mix()`
   calls), `src/config/designVariants.ts:32,153,165`, and
   `src/pages/StyleguidePage.tsx:196-200`. All three hang off things this change
   deletes anyway, so `--accent2` still goes — but it must fall **in the same task
   as `data-card-style`**, not as an isolated line, or the styleguide breaks.
3. **`--color-positive` and `--color-night-elevated` are still used** — both are.
   `positive` at `aktivitaet-portfolio.tsx:39,80` and `building-blocks.tsx:121`;
   `night-elevated` at `Button.tsx:22` and four spots in `OnboardingPage.tsx`.
   Neither is deleted.
4. **`src/vision/` has exactly one external import** — `src/App.tsx:9`. Confirmed.
5. **The anti-flash script already exists.** `index.html` has carried an inline
   pre-paint script since AGE-361 that sets `data-variant`, `data-card-style` and
   `data-backdrop` with the same precedence as the provider. Pitfall 1 is therefore
   a **teardown**, not a build: the variant list shrinks to `hell`/`navy`, the
   default becomes `hell`, and both flag attributes go. The script's own comment
   records that its list must match `resolveInitialVariant` or it causes exactly
   the flash it prevents — adding the server layer makes that coupling three-way,
   which is why it gets a dedicated task and a test.
6. **`linkedin` is removed entirely** (requester, 2026-08-04). AGE-492 §3 wanted it
   kept but unreachable. After removing the `EffBeeZeeApp` import and every entry
   path it would be a type entry with no CSS block (it never had one), no route and
   no colour — a stumbling block for C2. `DesignVariantId` becomes exactly
   `'hell' | 'navy'`. `src/vision/` stays on disk, imported by nothing.
7. **The `night` family is renamed, not re-valued** (requester, 2026-08-04). This
   is knowingly a second mass rename in one change, against AGE-492's own "einer zu
   viel" rule for `canvas`/`soft`. It is 55 occurrences in 15 files (27 of them in
   `OnboardingPage.tsx`) and it is mechanical, where re-pointing the call sites at
   `accent`/`surface` would be design work. `canvas`/`soft` keep their confusing
   semantics (`canvas` = cards, `soft` = app background) exactly as AGE-492 directs;
   the design-system HTML calls them surface/canvas and is mapped on the way in.

## Rename hazards (why task 1 is not a `sed`)

A naive `gold` → `accent` substitution is wrong in four ways, all verified:

- **`accent-gold` is Tailwind's `accent-color` utility.** `OnboardingPage.tsx:213`
  (`accent-gold`) and `AvatarCropper.tsx:149` (`accent-gold-strong`) would become
  `accent-accent` and `accent-accent-strong`, which resolve to nothing. Both must
  become `accent-accent`→`accent-[var(--color-accent)]` or the equivalent named
  utility.
- **`--accent2` already occupies the `accent` namespace** and must be deleted
  before or with the rename, not after.
- **`goldMix()`** in `src/config/membershipVisuals.ts:10` is an identifier, not a
  class.
- **~55 prose mentions of "Gold"** (capitalised) sit in comments across 10 files.
  Lowercase `grep` misses them, and after the rebuild they assert something false.

The acceptance grep is therefore case-insensitive: **`grep -rni "gold" src/` → 0**.

## Non-goals

Navigation and scope (→ C2) · the Compass→Kompass rename (→ C2) · new pages or
data fields (→ C6) · resolving the `canvas`/`soft` naming confusion · removing the
`DesignSwitcher` component itself (it is unmounted, not deleted).
