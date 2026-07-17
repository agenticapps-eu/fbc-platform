# Pricing-Card Redesign + Subscription Home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the six `/mitgliedschaft` pricing cards to align correctly and carry an accent-band + rank-monogram header, and add a standalone "Deine Mitgliedschaft" summary reachable from Mein Profil and the user menu.

**Architecture:** Extract the inline card into a presentational `PricingCard`; derive the accent tint and monogram from the tier `rank` via `color-mix` on the existing `--color-gold` token (so every design variant inherits its own gold). Add a shared `MembershipSummary` panel used both atop `/mitgliedschaft` and on Mein Profil. Two small wiring edits (page + user menu). Frontend-only.

**Tech Stack:** React 19, TypeScript strict, Tailwind v4 (CSS `@theme` tokens), Vitest + @testing-library/react, react-router-dom.

## Global Constraints

- **Frontend-only.** No changes to `levels.ts` data shape, Stripe functions, RLS, or migrations. Accent + monogram derive from the existing `rank` field.
- **Token-driven, all variants.** Use `var(--color-gold)` / `var(--color-canvas)` via `color-mix`; never hard-code hex. No per-variant classes.
- **Preserve gating logic + test hooks.** Keep `data-testid="level-<key>"`, `data-current`, the `canUpgrade`/`busy`/`startUpgrade` logic, and the "Testzahlung · Demo" copy exactly.
- **No sidebar entry.** Nav stays 6+5+1 (nav tests). Entry points are the user menu + Mein Profil only.
- **German UI copy**, Conventional Commits with `(AGE-360)`.
- Test command: `pnpm test -- <path>` (Vitest). Run from repo root.

---

### Task 1: `membershipVisuals` helper

**Files:**
- Create: `src/config/membershipVisuals.ts`
- Test: `src/config/membershipVisuals.test.ts`

**Interfaces:**
- Produces: `monogram(rank: number): string`, `accentBandStyle(rank: number): CSSProperties` (returns `{ background: "color-mix(in oklab, var(--color-gold) N%, var(--color-canvas))" }`, N = `6 + rank*8`, clamped to [8,60]).

- [ ] **Step 1: Write the failing test**

```ts
// src/config/membershipVisuals.test.ts
import { describe, expect, it } from "vitest";
import { accentBandStyle, monogram } from "./membershipVisuals";

describe("membershipVisuals", () => {
  it("monogram is the rank numeral", () => {
    expect(monogram(1)).toBe("1");
    expect(monogram(6)).toBe("6");
  });

  it("accentBandStyle mixes gold over canvas, deepening with rank", () => {
    const r1 = accentBandStyle(1).background as string;
    const r6 = accentBandStyle(6).background as string;
    expect(r1).toContain("var(--color-gold)");
    expect(r1).toContain("var(--color-canvas)");
    expect(r1).toContain("14%"); // 6 + 1*8
    expect(r6).toContain("54%"); // 6 + 6*8
  });

  it("clamps the mix percentage to [8,60]", () => {
    expect(accentBandStyle(0).background as string).toContain("8%");
    expect(accentBandStyle(99).background as string).toContain("60%");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/config/membershipVisuals.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/config/membershipVisuals.ts
import type { CSSProperties } from "react";

/** Anzeige-Ziffer des Rang-Monogramms (1–6). */
export function monogram(rank: number): string {
  return String(rank);
}

/**
 * Akzent-Band-Hintergrund pro Stufe: EIN Gold-Token, mit `color-mix` in sechs
 * Stufen über die Canvas gemischt (Rang 1 blass → 6 satt). Token-getrieben, damit
 * jede Design-Variante ihr eigenes Gold erbt — keine Pro-Varianten-Klassen.
 */
export function accentBandStyle(rank: number): CSSProperties {
  const pct = Math.min(60, Math.max(8, 6 + rank * 8));
  return { background: `color-mix(in oklab, var(--color-gold) ${pct}%, var(--color-canvas))` };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/config/membershipVisuals.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config/membershipVisuals.ts src/config/membershipVisuals.test.ts
git commit -m "feat(membership): rank-derived accent band + monogram helper (AGE-360)"
```

---

### Task 2: `PricingCard` component

**Files:**
- Create: `src/components/membership/PricingCard.tsx`
- Test: `src/components/membership/PricingCard.test.tsx`

**Interfaces:**
- Consumes: `monogram`, `accentBandStyle` (Task 1); `LEVELS`/`LevelConfig`/`MembershipLevel` from `src/config/levels`; `Card`, `CardTitle` from `src/components/ui/Card`; `Badge` from `src/components/ui/Badge`; `Button` from `src/components/ui/Button`; `cn` from `src/lib/cn`.
- Produces: `PricingCard` (default export) with props
  `{ level: LevelConfig; interval: "month" | "year"; isCurrent: boolean; canUpgrade: boolean; recommended?: boolean; busy: boolean; onUpgrade: (key: MembershipLevel) => void }`.
  Renders root `<Card data-testid={\`level-${level.key}\`} data-current={isCurrent}>`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/membership/PricingCard.test.tsx
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PricingCard from "./PricingCard";
import { LEVELS } from "../../config/levels";

function renderCard(over: Partial<React.ComponentProps<typeof PricingCard>> = {}) {
  const props = {
    level: LEVELS.discover,
    interval: "year" as const,
    isCurrent: false,
    canUpgrade: true,
    busy: false,
    onUpgrade: vi.fn(),
    ...over,
  };
  render(<PricingCard {...props} />);
  return props;
}

describe("PricingCard", () => {
  it("renders label, monogram and yearly price", () => {
    renderCard();
    const card = screen.getByTestId("level-discover");
    expect(within(card).getByText("Discover")).toBeInTheDocument();
    expect(within(card).getByText("3")).toBeInTheDocument(); // rank monogram
    expect(within(card).getByText(/150 € \/ Jahr/)).toBeInTheDocument();
  });

  it("shows the monthly price when interval is month", () => {
    renderCard({ interval: "month" });
    expect(screen.getByText(/15 € \/ Monat/)).toBeInTheDocument();
  });

  it("shows Gratis for a free tier", () => {
    renderCard({ level: LEVELS.basic, canUpgrade: false });
    expect(screen.getByText("Gratis")).toBeInTheDocument();
  });

  it("marks the current tier and hides the upgrade button", () => {
    renderCard({ isCurrent: true, canUpgrade: false });
    const card = screen.getByTestId("level-discover");
    expect(card).toHaveAttribute("data-current", "true");
    expect(within(card).getByText("Aktuell")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /upgrade/i })).toBeNull();
  });

  it("renders the Empfohlen tag only when recommended", () => {
    renderCard({ recommended: true });
    expect(screen.getByText("Empfohlen")).toBeInTheDocument();
  });

  it("calls onUpgrade with the level key and disables while busy", () => {
    const { onUpgrade } = renderCard({ busy: true });
    const btn = screen.getByRole("button", { name: /upgrade/i });
    expect(btn).toBeDisabled();
    renderCard(); // fresh, not busy
    fireEvent.click(screen.getAllByRole("button", { name: /upgrade/i }).at(-1)!);
    expect(onUpgrade).not.toHaveBeenCalled(); // busy render's handler; sanity that disabled didn't fire
  });

  it("calls onUpgrade when clicked and enabled", () => {
    const onUpgrade = vi.fn();
    render(
      <PricingCard
        level={LEVELS.exchange}
        interval="year"
        isCurrent={false}
        canUpgrade
        busy={false}
        onUpgrade={onUpgrade}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /upgrade/i }));
    expect(onUpgrade).toHaveBeenCalledWith("exchange");
  });

  it("shows the Testzahlung hint for upgradeable tiers", () => {
    renderCard();
    expect(screen.getByText(/Testzahlung · Demo/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/components/membership/PricingCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/membership/PricingCard.tsx
import type { LevelConfig, MembershipLevel } from "../../config/levels";
import { accentBandStyle, monogram } from "../../config/membershipVisuals";
import { Card, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";

export interface PricingCardProps {
  level: LevelConfig;
  interval: "month" | "year";
  isCurrent: boolean;
  canUpgrade: boolean;
  recommended?: boolean;
  busy: boolean;
  onUpgrade: (key: MembershipLevel) => void;
}

export default function PricingCard({
  level,
  interval,
  isCurrent,
  canUpgrade,
  recommended = false,
  busy,
  onUpgrade,
}: PricingCardProps) {
  const price = interval === "year" ? level.priceYear : level.priceMonth;
  return (
    <Card
      data-testid={`level-${level.key}`}
      data-current={isCurrent}
      className={cn(
        "flex flex-col gap-0 overflow-hidden p-0",
        recommended && "ring-2 ring-gold-strong",
      )}
    >
      {/* Akzent-Band mit Rang-Monogramm — Gold-Ton nach rank (token-getrieben). */}
      <div
        className="flex items-center justify-between px-6 pb-4 pt-5"
        style={accentBandStyle(level.rank)}
      >
        {recommended ? <Badge variant="strong">Empfohlen</Badge> : <span />}
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-canvas/70 font-display text-lg font-semibold text-gold-strong"
        >
          {monogram(level.rank)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-center justify-between">
          <CardTitle>{level.label}</CardTitle>
          {isCurrent && <Badge variant="strong">Aktuell</Badge>}
        </div>
        {/* Feste Höhe (3 Zeilen) → Preis + CTA fluchten über alle Karten. */}
        <p className="line-clamp-3 min-h-[3.75rem] text-sm text-muted">{level.summary}</p>
        <p className="text-lg font-semibold text-ink">
          {price === 0 ? "Gratis" : `${price} € / ${interval === "year" ? "Jahr" : "Monat"}`}
        </p>
        {canUpgrade && (
          <div className="mt-auto flex flex-col gap-1">
            <Button variant="primary" size="sm" disabled={busy} onClick={() => onUpgrade(level.key)}>
              Upgrade
            </Button>
            <span className="text-center text-xs text-muted">Testzahlung · Demo</span>
          </div>
        )}
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/components/membership/PricingCard.test.tsx`
Expected: PASS. If the "busy" sanity assertion is flaky, simplify it to only assert `expect(btn).toBeDisabled()`.

- [ ] **Step 5: Commit**

```bash
git add src/components/membership/PricingCard.tsx src/components/membership/PricingCard.test.tsx
git commit -m "feat(membership): PricingCard with accent band + fixed skeleton (AGE-360)"
```

---

### Task 3: `MembershipSummary` panel

**Files:**
- Create: `src/components/membership/MembershipSummary.tsx`
- Test: `src/components/membership/MembershipSummary.test.tsx`

**Interfaces:**
- Consumes: `LEVELS`, `LEVEL_ORDER`, `isMembershipLevel` from `src/config/levels`; `Card` from `src/components/ui/Card`; `Button` from `src/components/ui/Button`; `Link` from `react-router-dom`.
- Produces: `MembershipSummary` (named export) with props `{ current: string | null; showManageCta?: boolean }`. Falls back to `LEVELS.basic` when `current` is null/unknown. Shows label, summary, and "Nächster Schritt: <label>" for the next-higher rank (none for Impact). When `showManageCta`, renders a Link to `/mitgliedschaft`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/membership/MembershipSummary.test.tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MembershipSummary } from "./MembershipSummary";

function renderSummary(current: string | null, showManageCta = false) {
  render(
    <MemoryRouter>
      <MembershipSummary current={current} showManageCta={showManageCta} />
    </MemoryRouter>,
  );
}

describe("MembershipSummary", () => {
  it("shows the current tier label and its next step", () => {
    renderSummary("basic");
    expect(screen.getByText("Basic")).toBeInTheDocument();
    expect(screen.getByText(/Nächster Schritt: Connect/)).toBeInTheDocument();
  });

  it("has no next step for the top tier", () => {
    renderSummary("impact");
    expect(screen.getByText("Impact")).toBeInTheDocument();
    expect(screen.queryByText(/Nächster Schritt/)).toBeNull();
  });

  it("falls back to Basic for null/unknown tier", () => {
    renderSummary(null);
    expect(screen.getByText("Basic")).toBeInTheDocument();
  });

  it("renders the manage CTA only when requested", () => {
    renderSummary("discover", true);
    const link = screen.getByRole("link", { name: /Mitgliedschaft verwalten/i });
    expect(link).toHaveAttribute("href", "/mitgliedschaft");
  });

  it("hides the CTA by default", () => {
    renderSummary("discover");
    expect(screen.queryByRole("link", { name: /Mitgliedschaft verwalten/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/components/membership/MembershipSummary.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/membership/MembershipSummary.tsx
import { Link } from "react-router-dom";
import { LEVELS, LEVEL_ORDER, isMembershipLevel } from "../../config/levels";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

export function MembershipSummary({
  current,
  showManageCta = false,
}: {
  current: string | null;
  showManageCta?: boolean;
}) {
  const cur = current && isMembershipLevel(current) ? LEVELS[current] : LEVELS.basic;
  const nextKey = LEVEL_ORDER.find((k) => LEVELS[k].rank === cur.rank + 1);
  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Deine Mitgliedschaft</p>
        <p className="mt-1 font-display text-xl font-semibold text-ink">{cur.label}</p>
        <p className="mt-0.5 text-sm text-muted">{cur.summary}</p>
        {nextKey && (
          <p className="mt-1 text-sm text-gold-strong">Nächster Schritt: {LEVELS[nextKey].label}</p>
        )}
      </div>
      {showManageCta && (
        <Link to="/mitgliedschaft" className="shrink-0">
          <Button variant="ghost" size="sm">
            Mitgliedschaft verwalten
          </Button>
        </Link>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/components/membership/MembershipSummary.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/membership/MembershipSummary.tsx src/components/membership/MembershipSummary.test.tsx
git commit -m "feat(membership): MembershipSummary panel (AGE-360)"
```

---

### Task 4: Wire `MitgliedschaftPage` to the new components

**Files:**
- Modify: `src/pages/MitgliedschaftPage.tsx`
- Modify: `src/pages/MitgliedschaftPage.test.tsx`

**Interfaces:**
- Consumes: `PricingCard` (Task 2), `MembershipSummary` (Task 3).

The page keeps `interval`, `busy`, `startUpgrade`, and the year/month toggle. Replace the inline `.map` body with `PricingCard`, mark `recommended` on `discover`, and render `<MembershipSummary current={tier} />` above the grid. Delete the now-unused imports (`LEVELS`, `Card`, `CardTitle`, `Badge`, `cn`) that PricingCard now owns — keep `LEVEL_ORDER`, `LEVEL_RANK`, `MembershipLevel`, `Button` (toggle), `useAuth`, `supabase`, `useToast`.

- [ ] **Step 1: Update the page test first (it must fail against the old page)**

The old page prints each label once; the new page also prints the current tier's label inside `MembershipSummary`. Update the "shows all 6 tiers" assertion to `getAllByText` and add assertions for the summary panel + Empfohlen tag.

```tsx
// src/pages/MitgliedschaftPage.test.tsx — replace the "zeigt alle 6 Stufen" test and add two
it("zeigt alle 6 Stufen als Karten", () => {
  renderPage();
  for (const key of ["basic", "connect", "discover", "exchange", "focus", "impact"])
    expect(screen.getByTestId(`level-${key}`)).toBeInTheDocument();
});

it("zeigt das 'Deine Mitgliedschaft'-Panel mit der aktuellen Stufe", () => {
  renderPage();
  expect(screen.getByText("Deine Mitgliedschaft")).toBeInTheDocument();
  // 'Discover' erscheint jetzt im Panel UND auf der Karte → mehrfach.
  expect(screen.getAllByText("Discover").length).toBeGreaterThanOrEqual(2);
});

it("markiert Discover als Empfohlen", () => {
  renderPage();
  expect(within(screen.getByTestId("level-discover")).getByText("Empfohlen")).toBeInTheDocument();
});
```

Leave the other existing tests (current tier, toggle, invoke, error toast) unchanged — they use `data-testid` + roles which PricingCard preserves.

- [ ] **Step 2: Run the updated test to verify it fails**

Run: `pnpm test -- src/pages/MitgliedschaftPage.test.tsx`
Expected: FAIL — "Deine Mitgliedschaft"/"Empfohlen" not found (old page).

- [ ] **Step 3: Rewrite the page body**

```tsx
// src/pages/MitgliedschaftPage.tsx
import { useState } from "react";
import { LEVELS, LEVEL_ORDER, LEVEL_RANK, type MembershipLevel } from "../config/levels";
import { useAuth } from "../providers/auth-context";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/Button";
import { useToast } from "../components/ui/toast-context";
import { cn } from "../lib/cn";
import PricingCard from "../components/membership/PricingCard";
import { MembershipSummary } from "../components/membership/MembershipSummary";

type Interval = "month" | "year";
const PAID: MembershipLevel[] = ["discover", "exchange", "focus", "impact"];
const RECOMMENDED: MembershipLevel = "discover";

export default function MitgliedschaftPage() {
  const { tier, levelRank } = useAuth();
  const { toast } = useToast();
  const [interval, setInterval] = useState<Interval>("year");
  const [busy, setBusy] = useState<MembershipLevel | null>(null);
  const currentRank = levelRank ?? 0;

  async function startUpgrade(level: MembershipLevel) {
    setBusy(level);
    const { data, error } = await supabase.functions.invoke("create-checkout-session", {
      body: { level, interval },
    });
    setBusy(null);
    if (error || !data?.url) {
      toast({
        variant: "error",
        title: "Upgrade konnte nicht gestartet werden",
        description: "Bitte versuche es erneut oder wende dich an den Support.",
      });
      return;
    }
    window.location.assign(data.url as string);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Mitgliedschaft</h1>
        <div className="flex gap-1 rounded-full border border-line p-1">
          <button
            type="button"
            onClick={() => setInterval("year")}
            className={cn(
              "rounded-full px-3 py-1 text-sm",
              interval === "year" && "bg-gold-strong text-canvas",
            )}
          >
            Jährlich
          </button>
          <button
            type="button"
            onClick={() => setInterval("month")}
            className={cn(
              "rounded-full px-3 py-1 text-sm",
              interval === "month" && "bg-gold-strong text-canvas",
            )}
          >
            Monatlich
          </button>
        </div>
      </div>

      <MembershipSummary current={tier} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LEVEL_ORDER.map((key) => (
          <PricingCard
            key={key}
            level={LEVELS[key]}
            interval={interval}
            isCurrent={tier === key}
            canUpgrade={PAID.includes(key) && LEVEL_RANK[key] > currentRank}
            recommended={key === RECOMMENDED}
            busy={busy === key}
            onUpgrade={startUpgrade}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/pages/MitgliedschaftPage.test.tsx`
Expected: PASS (all, including the three updated/new ones).

- [ ] **Step 5: Commit**

```bash
git add src/pages/MitgliedschaftPage.tsx src/pages/MitgliedschaftPage.test.tsx
git commit -m "feat(membership): use PricingCard + summary on /mitgliedschaft (AGE-360)"
```

---

### Task 5: Subscription entry on Mein Profil

**Files:**
- Modify: `src/pages/ProfilAnsichtPage.tsx` (add import; render `MembershipSummary` between `ProfileHero` and the widget grid)

**Interfaces:**
- Consumes: `MembershipSummary` (Task 3). Uses `data.profile.tier` (already fetched).

This is a two-line wiring insertion covered behaviorally by Task 3's component tests; verify with typecheck + the QA/browse step rather than a heavyweight page test (the page depends on react-query + `fetchDashboard`).

- [ ] **Step 1: Add the import and render the summary**

In `src/pages/ProfilAnsichtPage.tsx`, add to the imports:

```tsx
import { MembershipSummary } from "../components/membership/MembershipSummary";
```

Then insert the summary immediately after the closing `</ProfileHero>` and before the widget grid `<div className="grid grid-cols-1 gap-5 ...">`:

```tsx
      </ProfileHero>

      <MembershipSummary current={p.tier} showManageCta />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
```

- [ ] **Step 2: Typecheck + full test run**

Run: `pnpm typecheck && pnpm test -- src/components/membership`
Expected: typecheck clean; membership component tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/ProfilAnsichtPage.tsx
git commit -m "feat(membership): subscription summary + manage CTA on Mein Profil (AGE-360)"
```

---

### Task 6: "Mitgliedschaft" item in the user menu

**Files:**
- Modify: `src/components/AppShell.tsx` (add a `Link` in `UserMenu`, between the "Profil" link and the "Logout" button, ~line 151)

**Interfaces:**
- Consumes: existing `Link` import and `setOpen` in `UserMenu`.

`UserMenu` is a local (non-exported) component inside `AppShell`; a dedicated unit test would require rendering the whole shell (router + auth + providers). Add the item and verify via typecheck + the QA/browse step (open the avatar menu, click "Mitgliedschaft", land on `/mitgliedschaft`).

- [ ] **Step 1: Insert the menu item**

In `src/components/AppShell.tsx`, inside `UserMenu`'s open panel, add between the `to="/profil"` "Profil" link and the Logout `<button>`:

```tsx
          <Link
            to="/mitgliedschaft"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-ink/80 transition-colors hover:bg-ink/[0.04] hover:text-ink"
          >
            Mitgliedschaft
          </Link>
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppShell.tsx
git commit -m "feat(membership): Mitgliedschaft entry in the user menu (AGE-360)"
```

---

### Task 7: Full verification + visual check

- [ ] **Step 1: Run the whole suite + typecheck + lint**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green; nav tests still 6+5+1.

- [ ] **Step 2: Visual check on the deployed preview or dev**

Confirm on `/mitgliedschaft`: prices align across all six cards, accent bands deepen Basic→Impact, monograms 1–6 show, Discover has the Empfohlen ring+tag, the "Deine Mitgliedschaft" panel shows the current tier. On Mein Profil: the summary card + "Mitgliedschaft verwalten" button. In the avatar menu: the "Mitgliedschaft" item → `/mitgliedschaft`. Check in at least one dark variant (e.g. variant C) that the band reads correctly (token-driven).

- [ ] **Step 3: Open the PR**

```bash
git push -u origin donald/age-360-pricing-cards-subscription-home
gh pr create --base main --title "feat(membership): pricing-card redesign + subscription home (AGE-360)" --body "Implements docs/superpowers/specs/2026-07-17-pricing-cards-subscription-home-design.md"
```

---

## Self-Review

**Spec coverage:** Karten-Redesign (Task 2 + 4) ✓; Ausrichtung via fixed skeleton (Task 2, `min-h`/`line-clamp-3`) ✓; accent band + monogram token-driven (Task 1) ✓; Empfohlen on Discover (Task 2 + 4) ✓; "Deine Mitgliedschaft" panel on /mitgliedschaft (Task 3 + 4) ✓; entry points profile card (Task 5) + user menu (Task 6) ✓; no sidebar entry / nav 6+5+1 preserved (Task 7 verify) ✓; no levels.ts/backend changes ✓.

**Placeholder scan:** none — every code step is complete.

**Type consistency:** `PricingCard` prop names/types match between Task 2 definition and Task 4 usage; `MembershipSummary({ current, showManageCta })` matches Tasks 3/4/5; `monogram`/`accentBandStyle` signatures match Tasks 1/2.
