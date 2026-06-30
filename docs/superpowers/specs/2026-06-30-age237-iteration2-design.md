# AGE-237 — UI/UX Iteration 2 (Design Spec)

**Status**: Approved (2026-06-30) · **Linear**: AGE-237 · **Branch**: `donald/age-237-home-identity-heroes`

Iteration after Detlev's review (2026-06-29). Leitbild bleibt „LinkedIn × Facebook,
hell & elegant". Design-Switcher A–G bleibt für die Review aktiv; „Blend" (Variante `d`)
bleibt Default. Look hell halten, AA-Kontrast, responsive (Sidebar <1024px off-canvas).

## Decisions locked with user (deviations from the written prompt noted)

- **Branch base**: #51 (E/F/G) already merged to `main` (`ffcceb1`) — branch off `main`. All A–G live.
- **Personal entry label**: keep **„Mein Bereich"** for now (overrides prompt point 5's rename;
  the *label* stays, the *menu-swap* is still removed and it becomes the accordion anchor).
- **Accordion scope**: include **„Meine Events" → gebuchte / eingestellte** (richer hub; accepts
  the slight overlap with the Events format).
- **„Compass" label** stays „Compass" (no silent rename to „Kompass").
- **Demo avatars** (added by user): give all demo profiles fake profile pictures.

## Work items

### 1. Header logo + sidebar identity block
- Crown logo (full lockup) moves to the **top-left of the header** (`AppShell.tsx` header ~`:239`).
  Logged-out: header shows logo + Login (existing right-side login stays).
- **Sidebar top** = member block (replaces the current sidebar logo at `AppShell.tsx:185-191`):
  `Avatar` + name + small `TierBadge`, clickable → `/profil`. Logged-out: a quiet „Anmelden" hint
  card (no member block).

### 2. Public HomePage at `/`
- New `src/pages/HomePage.tsx`. `/` renders it directly. `HomeRedirect` is retired for the default
  case; the onboarding redirect is preserved **only** for a fresh logged-in user with no compass
  responses (otherwise → Home).
- Content for everyone incl. anon: new events, new public posts (anon authors masked — §3),
  testimonials/Erfolgsberichte (static placeholders for the prototype), KPIs (member + event counts),
  CTAs „Kompass kostenlos starten" / „Mitglied werden".
- Reuses existing `events` / `feed` libs. Community stays the deeper feed/directory level — Home ≠ Community.

### 3. Anon name-masking — display only
- New **pure helper** `displayAuthor(author, isLoggedIn)` (TDD'd): anon → name `"Ein Mitglied"` +
  masked avatar (generic gold disc, no initials); logged-in → real name + avatar.
- Applied in feed `PostCard` (`CommunityFeed.tsx:280-301`, comments `:466-484`) and HomePage post previews.
- **RLS unchanged** — which posts are fetched stays RLS-governed; this masks only the displayed name/avatar.
- Committed interpretation: anon = masked, any logged-in tier = revealed. Full per-tier progressive
  reveal is a noted follow-up, not built (Simplicity First).

### 4. Roll back menu-swap → stable menu + inline accordion
- Remove the `inMeinBereich` swap (`AppShell.tsx:208`, `:192-196`) and the „← Hauptmenü" button;
  retire `src/components/ui/MeinBereichSubnav.tsx`.
- Formats always visible. **„Mein Bereich"** = last sidebar entry, an **inline accordion**
  (max 1 nesting level): Mein Profil · **Meine Events → gebuchte / eingestellte** · Meine Kontakte ·
  Meine Investitionen · Newsletter/Einstellungen.

### 5. Menu cleanup
- Remove section labels „Formate"/„Konto" (`AppShell.tsx:16-19`). Flat order, top→bottom:
  **member block → Start → Compass → Library → Academy → Events → Community → Matching → Projekte →
  Mein Bereich (accordion)**.

### 6. Halve sidebar↔content gap
- `AppShell.tsx:293` `gap-8` → `gap-4`.

### 7. Per-format hero headers
- New `FormatHero` component: title + short claim + placeholder gold/anthracite gradient + format icon,
  swappable per format (config beside `nav.ts`). Rendered atop Compass, Library, Academy, Events,
  Community, Matching, Projekte.

### 8. Profile header rework
- `ProfilPage` + `PublicProfilePage`: adjustable banner (default gradient, **not** full black; banner
  image-URL field prepared — storage upload itself out of scope). Avatar placed **separated
  below/beside** the banner (no overlap). Tier badge positioned cleanly.

### 9. Demo profile pictures (added)
- All 18 demo personas currently have `avatar_url = NULL`. Set fake pictures via the two seed files:
  `supabase/seed/demo_personas.sql` (17) + `supabase/seed/demo_legacy_profile.sql` (1).
- Approach: deterministic remote portrait URLs (e.g. `https://i.pravatar.cc/300?u=<uuid>`) so each
  persona is stable. No frontend change needed — `Avatar` renders `src` automatically.
- Caveat to flag in review: pravatar faces are random by seed and may not match name gender; acceptable
  for a demo. Re-run seed is guarded by `DEMO_SEED_CONFIRM=fbc-demo`. NB: dev shares prod's Supabase ref.

## Quality / DoD
- Light look, Blend default, switcher on. AA contrast. Responsive (off-canvas <1024px stays).
- Update `/styleguide` + `docs/design-system.md` (new „Start" route above formats; section labels removed).
- typecheck + lint + tests + build green. `/browse` screenshots for evidence (Home, identity sidebar,
  a format hero, reworked profile, masked anon feed).

## Out of scope (deferred)
- Optional „Blogs as 3rd Community tab" — explicitly nice-to-have / second commit.
- Real banner/avatar upload backend (UI affordance prepared only).
- Full per-tier progressive name reveal.

## Files touched (anticipated)
- `src/components/AppShell.tsx` (header logo, member block, remove swap + section labels, gap)
- `src/config/nav.ts` (+ Start; accordion structure config) · `src/components/ui/SidebarNav.tsx` (accordion)
- retire `src/components/ui/MeinBereichSubnav.tsx`
- `src/pages/HomePage.tsx` (new) · `src/App.tsx` + `src/components/HomeRedirect.tsx` (route to Home)
- `src/lib/displayAuthor.ts` (new, + test) · `src/components/community/CommunityFeed.tsx`
- `src/components/ui/FormatHero.tsx` (new) + format pages (Compass/Library/Academy/Events/Community/Matching/Projekte)
- `src/pages/ProfilPage.tsx` · `src/pages/PublicProfilePage.tsx` · profile hero component
- `supabase/seed/demo_personas.sql` · `supabase/seed/demo_legacy_profile.sql`
- `src/pages/StyleguidePage.tsx` · `docs/design-system.md`
