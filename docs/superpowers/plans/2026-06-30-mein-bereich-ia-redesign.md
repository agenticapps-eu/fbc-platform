# „Mein Bereich" IA-Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single overloaded `/mein-bereich` dashboard into four real routes (Mein Profil · Meine Events · Meine Kontakte · Einstellungen), each a distinct path with one clear purpose — which structurally fixes the "three menu items active at once" bug.

**Architecture:** Extract the shared card primitives and the 17 widgets out of `MeinBereichPage.tsx` into a `src/components/mein-bereich/` module, then compose four focused pages from them. `/profil` becomes a compact Bento *view* (the editor moves to `/profil/bearbeiten`). Sidebar nav items get distinct pathnames so React Router's `NavLink` marks exactly one active. Settings persist in a new owner-only `member_settings` table with RLS.

**Tech Stack:** React 18 + TypeScript (strict), React Router 6, TanStack Query, Tailwind, Vitest + Testing Library, Supabase/Postgres (RLS), pnpm.

---

## Conventions for this plan

- **Tests:** `globals: false` → every test imports `{ describe, it, expect, vi, beforeEach }` from `"vitest"`. Colocated `*.test.tsx`. Provider nesting: `AuthFixture` → `QueryClientProvider (retry:false)` → `ToastProvider` (when toasts) → `MemoryRouter`. Mock the **data-layer lib** (`../lib/dashboard` etc.), never Supabase directly. Helpers: `src/test/auth-fixtures.tsx` (`authAsTier`, `fakeAuthValue`, `AuthFixture`).
- **Run a single test:** `pnpm test <path-or-name>`. **Whole suite:** `pnpm test`. **Types:** `pnpm typecheck`. Lint runs via lint-staged on commit.
- **"Move verbatim lines X–Y"** means cut that exact block from `MeinBereichPage.tsx` (state as of commit `778bb81`) into the named file with **no logic change** — only add/adjust `export` and imports. This is a refactor; the test written just before each move proves behaviour is preserved.
- **Commits:** Conventional Commits + `(AGE-237)`. Branch already checked out: `donald/age-237-mein-bereich-ia`.
- **DEMO widgets** (Statistik, Investments, Projekte, KI) keep their existing `demo` badge; they only relocate.

## File Structure (target)

```
src/components/mein-bereich/
  building-blocks.tsx     # DashboardCard, DemoBadge, CardLink, ProgressBar, StatTile,
                          # EmptyHint, CrownIcon, CheckIcon, formatDate, dateFmt, monthFmt
  profil-widgets.tsx      # Erfolgsradar, Entwicklung, Interessen, Ziele, Auszeichnungen,
                          # Beitraege, Impact (+ ScoreBreakdownList, ChipList)
  kontakte-widgets.tsx    # MeineAnfragen (+ AnfrageRow), Netzwerk, Matching (+ cols), Communities
  events-widget.tsx       # EventsWidget (+ EventGroup)
  aktivitaet-portfolio.tsx# collapsible DEMO block: Statistik, Projekte, Investments, KI
src/pages/
  ProfilAnsichtPage.tsx   # NEW  /profil  — Bento view (owner)
  ProfilPage.tsx          # EXISTING editor — route moves to /profil/bearbeiten
  MeineEventsPage.tsx     # NEW  /meine-events
  KontaktePage.tsx        # NEW  /kontakte
  EinstellungenPage.tsx   # NEW  /einstellungen
  MeinBereichPage.tsx     # DELETED at end of Phase 3 (replaced by redirect)
src/lib/
  member-settings.ts      # NEW  fetch/upsert member_settings
supabase/migrations/
  20260630130000_member_settings.sql   # NEW table + owner-only RLS
supabase/tests/
  probe_member_settings_rls.sql         # NEW pgTAP owner-only test (probe_*.sql convention)
```

---

# Phase 1 — Routing + Menu fix (kills the visible bug first)

**Outcome:** Each "Mein Bereich" menu item is a distinct route; exactly one nav link is active per route; `/mein-bereich` redirects to `/profil`. New pages are thin shells that render the old widgets (moved in Phase 2/3); nothing 404s and nothing visually regresses yet.

### Task 1.1: Extract shared building blocks

**Files:**
- Create: `src/components/mein-bereich/building-blocks.tsx`
- Modify: `src/pages/MeinBereichPage.tsx`

- [ ] **Step 1: Create `building-blocks.tsx`** — move these **verbatim** from `MeinBereichPage.tsx` and add `export` to each: `dateFmt` (113-117), `monthFmt` (118), `formatDate` (120-124), `DemoBadge` (176-185), `DashboardCard` (187-214), `CardLink` (216-222), `ProgressBar` (224-231), `EmptyHint` (233-235), `CrownIcon` (237-243), `CheckIcon` (245-257), `StatTile` (298-321). Keep their imports (`cn`, `Card`, `CardTitle`, `Link`, `ReactNode`). Full new file header:

```tsx
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { Card, CardTitle } from "../ui/Card";

export const dateFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
export const monthFmt = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });

export function formatDate(value: string | null, fmt: Intl.DateTimeFormat): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : fmt.format(d);
}
// …DemoBadge, DashboardCard, CardLink, ProgressBar, EmptyHint, CrownIcon, CheckIcon, StatTile
// moved verbatim from MeinBereichPage.tsx, each prefixed with `export`.
```

- [ ] **Step 2: Re-import in `MeinBereichPage.tsx`** — delete the moved definitions; add at top:

```tsx
import {
  CardLink,
  CheckIcon,
  CrownIcon,
  DashboardCard,
  dateFmt,
  DemoBadge,
  EmptyHint,
  formatDate,
  monthFmt,
  ProgressBar,
  StatTile,
} from "../components/mein-bereich/building-blocks";
```

- [ ] **Step 3: Verify nothing else broke** — `pnpm typecheck`. Expected: PASS (every moved symbol now imported).
- [ ] **Step 4: Run existing dashboard test** — `pnpm test MeinBereichPage`. Expected: PASS (render unchanged).
- [ ] **Step 5: Commit**

```bash
git add src/components/mein-bereich/building-blocks.tsx src/pages/MeinBereichPage.tsx
git commit -m "refactor: extract Mein-Bereich card building blocks (AGE-237)"
```

### Task 1.2: Rewrite the sidebar node config to distinct paths

**Files:**
- Modify: `src/config/meinBereich.ts`
- Test: `src/config/meinBereich.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { MEIN_BEREICH_NODES } from "./meinBereich";

describe("MEIN_BEREICH_NODES", () => {
  it("hat vier Leaf-Einträge auf distinkten Pfaden (kein ?tab, keine Doppel-Pfade)", () => {
    const paths = MEIN_BEREICH_NODES.map((n) => n.to);
    expect(paths).toEqual(["/profil", "/meine-events", "/kontakte", "/einstellungen"]);
    expect(paths.every((p) => !p.includes("?"))).toBe(true);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
```

- [ ] **Step 2: Run it** — `pnpm test meinBereich`. Expected: FAIL (current nodes use `?tab=` and children).
- [ ] **Step 3: Replace the file**

```ts
/**
 * „Mein Bereich" — flache Navigationsliste. Jeder Eintrag ist eine eigene Route
 * mit eigenem Pfad (kein ?tab), damit NavLink pro Seite genau einen Eintrag aktiv
 * markiert. Bewusst schlank; Doppelung mit den Formaten wird vermieden (außer
 * „Meine Events", bewusst aufgenommen — Detlev/Donald 2026-06-30).
 */
export interface MeinBereichLeaf {
  label: string;
  to: string;
}

export const MEIN_BEREICH_NODES: MeinBereichLeaf[] = [
  { label: "Mein Profil", to: "/profil" },
  { label: "Meine Events", to: "/meine-events" },
  { label: "Meine Kontakte", to: "/kontakte" },
  { label: "Einstellungen", to: "/einstellungen" },
];
```

- [ ] **Step 4: Run it** — `pnpm test meinBereich`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/config/meinBereich.ts src/config/meinBereich.test.ts
git commit -m "refactor: Mein-Bereich nav nodes use distinct paths (AGE-237)"
```

### Task 1.3: Simplify the accordion to a flat list

**Files:**
- Modify: `src/components/ui/MeinBereichAccordion.tsx`

- [ ] **Step 1: Replace the component body** — the `children`/`open` accordion branch is dead now (no node has children). Flatten:

```tsx
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/cn";
import { MEIN_BEREICH_NODES } from "../../config/meinBereich";

const linkBase = "relative rounded-md px-3 py-2 text-sm transition-colors";
const linkRest = "text-ink/70 hover:bg-night/[0.05] hover:text-ink";
const linkActive = "bg-night/[0.06] font-semibold text-gold-strong";

export function MeinBereichAccordion({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Mein Bereich" className="flex flex-col gap-1">
      <p className="px-3 pb-1 text-sm font-semibold text-ink">Mein Bereich</p>
      {MEIN_BEREICH_NODES.map((node) => (
        <NavLink
          key={node.to}
          to={node.to}
          end
          onClick={onNavigate}
          className={({ isActive }) => cn(linkBase, isActive ? linkActive : linkRest)}
        >
          {node.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

Note: `end` is added so `/profil` does **not** stay active on `/profil/bearbeiten` (the editor is reached via a button, not this nav).

- [ ] **Step 2: Typecheck** — `pnpm typecheck`. Expected: PASS (unused `useState` import removed).
- [ ] **Step 3: Commit**

```bash
git add src/components/ui/MeinBereichAccordion.tsx
git commit -m "refactor: flatten Mein-Bereich sidebar to distinct links (AGE-237)"
```

### Task 1.4: Page shells + routes + redirect

**Files:**
- Create: `src/pages/ProfilAnsichtPage.tsx`, `src/pages/MeineEventsPage.tsx`, `src/pages/KontaktePage.tsx`, `src/pages/EinstellungenPage.tsx`
- Modify: `src/config/nav.ts`, `src/App.tsx`, `src/components/AppShell.tsx`
- Test: `src/App.test.tsx` (extend)

- [ ] **Step 1: Create four thin shells.** For Phase 1 each renders a heading + (where applicable) the existing widget set by reusing `MeinBereichPage`'s data hook. To avoid duplicating the query, add a tiny shared hook first.

Create `src/pages/ProfilAnsichtPage.tsx`:

```tsx
export default function ProfilAnsichtPage() {
  return <h1 className="font-display text-2xl font-semibold text-ink">Mein Profil</h1>;
}
```

Create `src/pages/MeineEventsPage.tsx`, `src/pages/KontaktePage.tsx`, `src/pages/EinstellungenPage.tsx` analogously with headings "Meine Events", "Meine Kontakte", "Einstellungen". (These get filled in Phases 2–4; the shells keep routes live now.)

- [ ] **Step 2: Write the failing nav test** in `src/App.test.tsx` (add a new `it`):

```tsx
it("markiert auf /kontakte genau einen Sidebar-Eintrag als aktiv", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <AuthFixture value={authAsTier("legacy")}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/kontakte"]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthFixture>,
  );
  const active = screen.getAllByRole("link").filter((el) => el.getAttribute("aria-current") === "page");
  expect(active).toHaveLength(1);
  expect(active[0]).toHaveTextContent("Meine Kontakte");
});
```

Add `authAsTier` to the existing import from `./test/auth-fixtures`.

- [ ] **Step 3: Run it** — `pnpm test App`. Expected: FAIL (routes `/kontakte` etc. don't exist yet → no such link / wrong count).

- [ ] **Step 4: Register routes in `src/config/nav.ts`.** Add imports and `konto` entries. Replace the two trailing `konto` items (lines 127-134) with:

```tsx
  {
    path: "/mein-bereich",
    label: "Mein Bereich",
    Component: MeinBereichPage,
    section: "konto",
    requiresAuth: true,
  },
  { path: "/profil", label: "Profil", Component: ProfilAnsichtPage, section: "konto", requiresAuth: true },
  {
    path: "/profil/bearbeiten",
    label: "Profil bearbeiten",
    Component: ProfilPage,
    section: "konto",
    requiresAuth: true,
  },
  { path: "/meine-events", label: "Meine Events", Component: MeineEventsPage, section: "konto", requiresAuth: true },
  { path: "/kontakte", label: "Meine Kontakte", Component: KontaktePage, section: "konto", requiresAuth: true },
  { path: "/einstellungen", label: "Einstellungen", Component: EinstellungenPage, section: "konto", requiresAuth: true },
```

Add imports near the other page imports:

```tsx
import EinstellungenPage from "../pages/EinstellungenPage";
import KontaktePage from "../pages/KontaktePage";
import MeineEventsPage from "../pages/MeineEventsPage";
import ProfilAnsichtPage from "../pages/ProfilAnsichtPage";
```

(`ProfilPage` and `MeinBereichPage` are already imported.)

- [ ] **Step 5: Add the `/mein-bereich` → `/profil` redirect in `src/App.tsx`.** The `navItems.map` still creates a `/mein-bereich` route from the entry above; override it with an explicit redirect placed **after** the map (more specific wins is not how Routes works — instead remove `/mein-bereich` from the map). Simplest: filter it out of the generated routes and add a redirect.

Replace the `navItems.map(...)` block (App.tsx:42-44) with:

```tsx
{navItems
  .filter((item) => item.path !== "/mein-bereich")
  .map((item) => (
    <Route key={item.path} path={item.path} element={gatedElement(item)} />
  ))}
<Route path="/mein-bereich" element={<Navigate to="/profil" replace />} />
```

Add `Navigate` to the react-router-dom import: `import { Navigate, Route, Routes } from "react-router-dom";`. Keep the `MeinBereichPage` entry in `nav.ts` (harmless — only used for its label by `UserMenu`; its Component is no longer routed). Actually remove the now-unused `Component: MeinBereichPage` risk: leave the entry but it is never mapped to a route. `MeinBereichPage` import in nav.ts stays (still referenced by the entry object).

- [ ] **Step 6: Point stale `/mein-bereich` links at `/profil`.** In `src/components/AppShell.tsx` `UserMenu`, change the `<Link to="/mein-bereich">` (line 137) to `to="/profil"` and its label to keep "Mein Bereich". Update `WIDE_ROUTES` (line 19) to the routes that need full width:

```tsx
const WIDE_ROUTES = ["/profil", "/kontakte", "/verzeichnis", "/matching"];
```

- [ ] **Step 7: Run the nav test** — `pnpm test App`. Expected: PASS. Then `pnpm typecheck`. Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/ProfilAnsichtPage.tsx src/pages/MeineEventsPage.tsx src/pages/KontaktePage.tsx src/pages/EinstellungenPage.tsx src/config/nav.ts src/App.tsx src/components/AppShell.tsx src/App.test.tsx
git commit -m "feat: distinct Mein-Bereich routes + /mein-bereich redirect (AGE-237)"
```

**Phase 1 gate:** `pnpm test && pnpm typecheck` green. Manually: clicking each "Mein Bereich" item highlights exactly one; old `/mein-bereich` URL lands on `/profil`. The four new pages show only headings (filled next).

---

# Phase 2 — Profil Bento view

**Outcome:** `/profil` shows the compact Bento view built from the profile-related widgets; the editor lives at `/profil/bearbeiten`; the DEMO widgets sit in a collapsed "Aktivität & Portfolio" block.

### Task 2.1: Move profile widgets into `profil-widgets.tsx`

**Files:**
- Create: `src/components/mein-bereich/profil-widgets.tsx`
- Modify: `src/pages/MeinBereichPage.tsx`

- [ ] **Step 1: Create `profil-widgets.tsx`.** Move **verbatim** and `export` each: `ErfolgsradarWidget` (429-441), `EntwicklungWidget` (444-492), `InteressenWidget` (495-525), `ChipList` (527-537), `AuszeichnungenWidget` (969-991), `BeitraegeWidget` (934-966) + its `DEMO_POSTS` (100-111), `ZieleWidget` (994-1033), `ImpactWidget` (814-860), `ScoreBreakdownList` (864-886). Add the lazy radar import and required lib imports at top:

```tsx
import { lazy, Suspense } from "react";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import {
  THEME_LABEL,
  THEME_ORDER,
  type DashboardBadge,
  type DashboardData,
  type DashboardProfile,
  type ScoreBreakdown,
} from "../../lib/dashboard";
import { GOAL_CATEGORIES } from "../../lib/profile";
import {
  CardLink,
  CheckIcon,
  CrownIcon,
  DashboardCard,
  DemoBadge,
  EmptyHint,
  formatDate,
  monthFmt,
  ProgressBar,
} from "./building-blocks";

const ErfolgsradarChart = lazy(() =>
  import("../dashboard/ErfolgsradarChart").then((m) => ({ default: m.ErfolgsradarChart })),
);

const DEMO_POSTS = [
  { title: "Warum Ökosysteme die Zukunft des Mittelstands sind", kind: "Artikel", meta: "1,2k Views · 84 Likes" },
  { title: "Deal-Keeping im Family Office (Podcast)", kind: "Podcast", meta: "640 Views · 51 Likes" },
];
// …the nine widgets moved verbatim, each `export function …`
```

- [ ] **Step 2: Delete those definitions from `MeinBereichPage.tsx`** and import them from `./components/mein-bereich/profil-widgets` (the page still renders during this phase). Remove now-unused imports in `MeinBereichPage.tsx` (`THEME_*`, `GOAL_CATEGORIES`, etc.) only if no longer referenced — `pnpm typecheck` will flag leftovers.
- [ ] **Step 3: Typecheck + existing test** — `pnpm typecheck && pnpm test MeinBereichPage`. Expected: PASS.
- [ ] **Step 4: Commit**

```bash
git add src/components/mein-bereich/profil-widgets.tsx src/pages/MeinBereichPage.tsx
git commit -m "refactor: extract profile widgets module (AGE-237)"
```

### Task 2.2: Aktivität & Portfolio collapsible (DEMO block)

**Files:**
- Create: `src/components/mein-bereich/aktivitaet-portfolio.tsx`
- Test: `src/components/mein-bereich/aktivitaet-portfolio.test.tsx`
- Modify: `src/pages/MeinBereichPage.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AktivitaetPortfolio } from "./aktivitaet-portfolio";

describe("AktivitaetPortfolio", () => {
  it("ist standardmäßig eingeklappt und zeigt Inhalte erst nach Klick", () => {
    render(<AktivitaetPortfolio />);
    expect(screen.queryByText("Meine Statistik (30 Tage)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Aktivität & Portfolio/ }));
    expect(screen.getByText("Meine Statistik (30 Tage)")).toBeInTheDocument();
    expect(screen.getByText("Meine Investments")).toBeInTheDocument();
  });
});
```

> Note: the repo has **no** `@testing-library/user-event` dependency — use `fireEvent` from `@testing-library/react` (the established pattern) everywhere in this plan.

- [ ] **Step 2: Run it** — `pnpm test aktivitaet-portfolio`. Expected: FAIL (module missing).
- [ ] **Step 3: Create `aktivitaet-portfolio.tsx`.** Move **verbatim** `StatistikWidget` (793-808)+`DEMO_STATS` (55-61), `ProjekteWidget` (889-907)+`DEMO_PROJECTS` (62-65), `InvestmentsWidget` (910-931)+`DEMO_INVESTMENTS` (66-70), `KIAssistentWidget` (1036-1063)+`DEMO_KI_CHIPS` (71-75) into this file (keep them un-exported, internal). Wrap in a collapsible:

```tsx
import { useState } from "react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";
import { DashboardCard, DemoBadge, ProgressBar } from "./building-blocks";

// DEMO_STATS / DEMO_PROJECTS / DEMO_INVESTMENTS / DEMO_KI_CHIPS + the four widgets
// moved verbatim from MeinBereichPage.tsx (internal, not exported).

export function AktivitaetPortfolio() {
  const [open, setOpen] = useState(false);
  return (
    <section className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center justify-between rounded-[var(--radius-card)] border border-line bg-soft px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          Aktivität &amp; Portfolio <DemoBadge />
        </span>
        <span aria-hidden className="text-muted">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <StatistikWidget />
          <ProjekteWidget />
          <InvestmentsWidget />
          <KIAssistentWidget />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run it** — `pnpm test aktivitaet-portfolio`. Expected: PASS.
- [ ] **Step 5: Remove the four widgets + their DEMO consts from `MeinBereichPage.tsx`** (they no longer render there; the page is deleted in Phase 3 anyway). `pnpm typecheck`.
- [ ] **Step 6: Commit**

```bash
git add src/components/mein-bereich/aktivitaet-portfolio.tsx src/components/mein-bereich/aktivitaet-portfolio.test.tsx src/pages/MeinBereichPage.tsx
git commit -m "feat: collapsible Aktivität & Portfolio demo block (AGE-237)"
```

### Task 2.3: Compose the Bento `ProfilAnsichtPage`

**Files:**
- Modify: `src/pages/ProfilAnsichtPage.tsx`
- Test: `src/pages/ProfilAnsichtPage.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";
import type { DashboardData } from "../lib/dashboard";

vi.mock("../components/dashboard/ErfolgsradarChart", () => ({
  ErfolgsradarChart: () => <div data-testid="radar-chart" />,
}));
vi.mock("../lib/dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/dashboard")>();
  return { ...actual, fetchDashboard: vi.fn() };
});
import { fetchDashboard } from "../lib/dashboard";
import ProfilAnsichtPage from "./ProfilAnsichtPage";

const mockedFetch = vi.mocked(fetchDashboard);

// Minimaler, gültiger DashboardData-Stub. Felder vollständig — Render-Vertrag, keine Logik.
const DATA: DashboardData = {
  profile: {
    name: "Eleonora Voss", avatar_url: null, tier: "legacy", roles: ["Investorin"],
    headline: null, region: "Stuttgart", company: "Voss Capital", member_since: "2017-05-01",
    member_number: "FBC-10001", potential_score: 82, dev_focus: "sein", dev_progress: 80, next_steps: [],
  },
  interests: [{ theme: "sein", label: "Persönlichkeitsentwicklung" }],
  goals: [], badges: [], themeScores: [], posts: [], events: [], hostedEvents: [],
  needs: [], offers: [], contactsCount: 1, eventsCount: 2,
  matchStats: { active: 0, successful: 0, avgScore: 0 }, scoreBreakdown: null,
};

beforeEach(() => {
  mockedFetch.mockReset();
  mockedFetch.mockResolvedValue(DATA);
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={authAsTier("legacy")}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProfilAnsichtPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

describe("ProfilAnsichtPage (Bento)", () => {
  it("zeigt Hero, KPI und Profil-Kacheln und einen Bearbeiten-Link", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Eleonora Voss" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profil bearbeiten" })).toHaveAttribute("href", "/profil/bearbeiten");
    expect(screen.getByRole("heading", { name: "Mein Erfolgsradar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Meine Interessen" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mein Impact" })).toBeInTheDocument();
  });
});
```

Confirm the exact `DashboardData` / `DashboardProfile` field names against `src/lib/dashboard.ts` before finalizing the stub; adjust keys to match.

- [ ] **Step 2: Run it** — `pnpm test ProfilAnsichtPage`. Expected: FAIL (page is just a heading).
- [ ] **Step 3: Implement the Bento page.** Reuse `ProfileHero` + `StatTile` for the header, then a Bento grid of the profile widgets, then `AktivitaetPortfolio`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ProfileHero } from "../components/profile/ProfileHero";
import { Button } from "../components/ui/Button";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import { StatTile, formatDate, monthFmt } from "../components/mein-bereich/building-blocks";
import { AktivitaetPortfolio } from "../components/mein-bereich/aktivitaet-portfolio";
import {
  AuszeichnungenWidget,
  BeitraegeWidget,
  EntwicklungWidget,
  ErfolgsradarWidget,
  ImpactWidget,
  InteressenWidget,
  ZieleWidget,
} from "../components/mein-bereich/profil-widgets";
import { dashboardQueryKey, fetchDashboard } from "../lib/dashboard";
import { useAuth } from "../providers/auth-context";

export default function ProfilAnsichtPage() {
  const { user } = useAuth();
  if (!user) return null;
  return <ProfilView uid={user.id} />;
}

function ProfilView({ uid }: { uid: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: dashboardQueryKey(uid),
    queryFn: () => fetchDashboard(uid),
  });
  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data) {
    return <p className="text-sm text-danger">Profil konnte nicht geladen werden. Bitte neu laden.</p>;
  }
  const p = data.profile;
  return (
    <div className="flex flex-col gap-6">
      <ProfileHero
        name={p.name}
        avatarUrl={p.avatar_url}
        tier={p.tier}
        roles={p.roles}
        headline={p.headline}
        region={p.region}
        company={p.company}
        action={
          <Link to="/profil/bearbeiten">
            <Button variant="ghost" size="sm">Profil bearbeiten</Button>
          </Link>
        }
      >
        <p className="text-xs text-muted">
          Mitglied seit: {formatDate(p.member_since, monthFmt)}
          {p.member_number && <> · Mitgliedsnummer: {p.member_number}</>}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Impact Score" value={p.potential_score} />
          <StatTile label="Netzwerk" value={data.contactsCount} />
          <StatTile label="Matches" value={data.matchStats.successful} />
          <StatTile label="Events" value={data.eventsCount} />
        </div>
      </ProfileHero>

      {/* Bento: breite Kacheln (Über mich folgt aus Headline/short_bio in ProfileHero),
          Interessen + Beiträge spannen die volle Reihe. */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <ErfolgsradarWidget data={data} />
        <AuszeichnungenWidget badges={data.badges} />
        <ImpactWidget score={p.potential_score} breakdown={data.scoreBreakdown} />
        <InteressenWidget data={data} />
        <ZieleWidget data={data} />
        <EntwicklungWidget profile={p} />
        <div className="md:col-span-2 xl:col-span-3">
          <BeitraegeWidget data={data} />
        </div>
      </div>

      <AktivitaetPortfolio />
    </div>
  );
}
```

Note: `InteressenWidget`/`ZieleWidget`'s "Bearbeiten" `CardLink` currently points to `/profil`; change those two `to="/profil"` references to `to="/profil/bearbeiten"` in `profil-widgets.tsx` so they reach the editor.

- [ ] **Step 4: Run it** — `pnpm test ProfilAnsichtPage`. Expected: PASS. Then `pnpm typecheck`.
- [ ] **Step 5: Commit**

```bash
git add src/pages/ProfilAnsichtPage.tsx src/pages/ProfilAnsichtPage.test.tsx src/components/mein-bereich/profil-widgets.tsx
git commit -m "feat: Profil Bento view at /profil (AGE-237)"
```

### Task 2.4: Editor entry copy + back-link

**Files:**
- Modify: `src/pages/ProfilPage.tsx`

- [ ] **Step 1:** The editor is now at `/profil/bearbeiten`. Add a back-link to `/profil` at the top of the editor (match existing heading markup; the editor heading "Profil bearbeiten" stays). Minimal addition above the form heading:

```tsx
<Link to="/profil" className="text-sm font-medium text-gold-strong hover:text-gold">← Zurück zum Profil</Link>
```

Ensure `Link` is imported from `react-router-dom`.

- [ ] **Step 2:** `pnpm typecheck && pnpm test ProfilPage` (if a test exists; else skip). Expected: PASS.
- [ ] **Step 3: Commit**

```bash
git add src/pages/ProfilPage.tsx
git commit -m "feat: back-link from profile editor to view (AGE-237)"
```

**Phase 2 gate:** `/profil` shows the Bento view; "Profil bearbeiten" → `/profil/bearbeiten` editor; Aktivität block starts collapsed.

---

# Phase 3 — Meine Kontakte + Meine Events; delete old dashboard

**Outcome:** `/kontakte` and `/meine-events` render their real content; `MeinBereichPage.tsx` is deleted.

### Task 3.1: Move contact + events widgets into modules

**Files:**
- Create: `src/components/mein-bereich/kontakte-widgets.tsx`, `src/components/mein-bereich/events-widget.tsx`
- Modify: `src/pages/MeinBereichPage.tsx`

- [ ] **Step 1: Create `events-widget.tsx`** — move **verbatim** `EventsWidget` (542-597), `EventGroup` (599-642), `DEMO_EVENTS` (76-99), and the `isPastEvent` import. Export `EventsWidget`. Required imports: `Badge`, `DashboardCard`, `CardLink`, `formatDate`, `dateFmt`, `isPastEvent` from `../../lib/events`, `type DashboardData`, `type DashboardEvent`.
- [ ] **Step 2: Create `kontakte-widgets.tsx`** — move **verbatim** `MeineAnfragenWidget` (329-358), `AnfrageRow` (360-426), `CommunitiesWidget` (645-658)+`DEMO_COMMUNITIES` (44-48), `NetzwerkWidget` (661-693)+`DEMO_NETWORK` (49-54), `MatchingWidget` (696-730), `MatchingColumn` (732-781), `MatchStat` (783-790). Export the four top-level widgets (`MeineAnfragenWidget`, `CommunitiesWidget`, `NetzwerkWidget`, `MatchingWidget`). Carry their imports: `useMutation/useQuery/useQueryClient`, `Link/useNavigate`, `Avatar`, `Badge`, `Button`, `Card`, `CardTitle`, `useToast`, `CategoryIcon`, contact-requests lib, matching-hub lib, dashboard lib, matching config, building-blocks.
- [ ] **Step 3:** Delete those blocks from `MeinBereichPage.tsx`. `pnpm typecheck && pnpm test MeinBereichPage` (page still composes from the imported widgets). Expected: PASS.
- [ ] **Step 4: Commit**

```bash
git add src/components/mein-bereich/kontakte-widgets.tsx src/components/mein-bereich/events-widget.tsx src/pages/MeinBereichPage.tsx
git commit -m "refactor: extract kontakte + events widget modules (AGE-237)"
```

### Task 3.2: `MeineEventsPage`

**Files:**
- Modify: `src/pages/MeineEventsPage.tsx`
- Test: `src/pages/MeineEventsPage.test.tsx` (create)

- [ ] **Step 1: Write the failing test** — mock `../lib/dashboard` `fetchDashboard` (same pattern as 2.3), provide one hosted event, assert the page heading "Meine Events" and the hosted event title render.

```tsx
// imports as in ProfilAnsichtPage.test.tsx; DATA.hostedEvents = [{ id: "e1", title: "Legacy Dinner", type: "dinner", starts_at: "2026-07-02T18:00:00Z", location: "Stuttgart" }]
describe("MeineEventsPage", () => {
  it("zeigt eigene/gebuchte Events", async () => {
    renderPage(); // wraps <MeineEventsPage/> in Auth+Query+MemoryRouter
    expect(await screen.findByRole("heading", { name: "Meine Events" })).toBeInTheDocument();
    expect(screen.getByText("Legacy Dinner")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it** — `pnpm test MeineEventsPage`. Expected: FAIL.
- [ ] **Step 3: Implement** — same `useAuth`+`useQuery(dashboardQueryKey, fetchDashboard)` skeleton as `ProfilAnsichtPage`, rendering a heading + `<EventsWidget data={data} />`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import { EventsWidget } from "../components/mein-bereich/events-widget";
import { dashboardQueryKey, fetchDashboard } from "../lib/dashboard";
import { useAuth } from "../providers/auth-context";

export default function MeineEventsPage() {
  const { user } = useAuth();
  if (!user) return null;
  return <Inner uid={user.id} />;
}
function Inner({ uid }: { uid: string }) {
  const { data, isLoading, isError } = useQuery({ queryKey: dashboardQueryKey(uid), queryFn: () => fetchDashboard(uid) });
  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data) return <p className="text-sm text-danger">Konnte nicht geladen werden.</p>;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Meine Events</h1>
      <EventsWidget data={data} />
    </div>
  );
}
```

- [ ] **Step 4: Run it** — `pnpm test MeineEventsPage`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/pages/MeineEventsPage.tsx src/pages/MeineEventsPage.test.tsx
git commit -m "feat: Meine Events page (AGE-237)"
```

### Task 3.3: `KontaktePage`

**Files:**
- Modify: `src/pages/KontaktePage.tsx`
- Test: `src/pages/KontaktePage.test.tsx` (create)

- [ ] **Step 1: Write the failing test** — mock `../lib/dashboard` AND `../lib/contact-requests` (`fetchIncomingRequests` → `[]` so the Anfragen widget stays silent; the others render). Assert "Mein Netzwerk", "Mein Matching", "Meine Communities" headings render.

```tsx
vi.mock("../lib/contact-requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/contact-requests")>();
  return { ...actual, fetchIncomingRequests: vi.fn() };
});
// beforeEach: vi.mocked(fetchIncomingRequests).mockResolvedValue([]);
describe("KontaktePage", () => {
  it("zeigt Netzwerk, Matching und Communities", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Mein Netzwerk" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mein Matching" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Meine Communities" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it** — `pnpm test KontaktePage`. Expected: FAIL.
- [ ] **Step 3: Implement** — `useAuth`+`useQuery` skeleton; render heading + the four widgets. `MeineAnfragenWidget` takes `uid`; the others take props from `data`:

```tsx
return (
  <div className="flex flex-col gap-6">
    <h1 className="font-display text-2xl font-semibold text-ink">Meine Kontakte</h1>
    <MeineAnfragenWidget uid={uid} />
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <NetzwerkWidget contactsCount={data.contactsCount} />
      <CommunitiesWidget />
    </div>
    <MatchingWidget data={data} />
  </div>
);
```

Import the four widgets from `../components/mein-bereich/kontakte-widgets`.

- [ ] **Step 4: Run it** — `pnpm test KontaktePage`. Expected: PASS. Then `pnpm typecheck`.
- [ ] **Step 5: Commit**

```bash
git add src/pages/KontaktePage.tsx src/pages/KontaktePage.test.tsx
git commit -m "feat: Meine Kontakte page (AGE-237)"
```

### Task 3.4: Delete the old dashboard

**Files:**
- Delete: `src/pages/MeinBereichPage.tsx`, `src/pages/MeinBereichPage.test.tsx`
- Modify: `src/config/nav.ts`

- [ ] **Step 1:** Remove the `import MeinBereichPage` and the `/mein-bereich` entry from `nav.ts` (the redirect route in `App.tsx` no longer needs the component). Confirm no other importer: `grep -rn "MeinBereichPage" src/`. Expected: only the deletions remain.
- [ ] **Step 2:** `git rm src/pages/MeinBereichPage.tsx src/pages/MeinBereichPage.test.tsx`.
- [ ] **Step 3:** `pnpm typecheck && pnpm test`. Expected: PASS (full suite green).
- [ ] **Step 4: Commit**

```bash
git add -A src/pages src/config/nav.ts
git commit -m "refactor: remove obsolete Mein-Bereich dashboard (AGE-237)"
```

**Phase 3 gate:** All four pages render real content; `/mein-bereich` redirects; `grep` shows no `MeinBereichPage` references; full suite green.

---

# Phase 4 — Einstellungen (full functional, owner-only RLS)

**Outcome:** `/einstellungen` shows Konto + Mitgliedschaft (read-only) and **persisted** Benachrichtigungen + Sichtbarkeit toggles, enforced by RLS.

### Task 4.1: Migration — `member_settings` table

**Files:**
- Create: `supabase/migrations/20260630130000_member_settings.sql`

- [ ] **Step 1: Write the migration** (owner-only side table, copying the `goals`/`profile_contacts` idiom):

```sql
-- member_settings — 1:1 mit profiles. Benachrichtigungs- & Sichtbarkeits-
-- Präferenzen. Strikt own-profile (read + write), nie Prime+, nie public.
create table public.member_settings (
  profile_id              uuid primary key references public.profiles (id) on delete cascade,
  notify_email_requests   boolean not null default true,   -- E-Mail bei neuer Kontaktanfrage
  notify_email_events     boolean not null default true,   -- E-Mail zu Event-Erinnerungen
  notify_email_digest     boolean not null default false,  -- wöchentlicher Digest
  visible_in_directory    boolean not null default true,   -- im Verzeichnis listbar
  contactable_by_prime    boolean not null default true,   -- Prime+ darf Kontaktanfrage senden
  updated_at              timestamptz not null default now()
);

comment on table public.member_settings is
  'Per-member notification + visibility preferences. Strictly own-profile only.';

revoke all on public.member_settings from anon, authenticated;
grant select, insert, update on public.member_settings to authenticated;

alter table public.member_settings enable row level security;

create policy member_settings_own on public.member_settings
  for all to authenticated
  using ( profile_id = (select auth.uid()) )
  with check ( profile_id = (select auth.uid()) );

create trigger member_settings_set_updated_at
  before update on public.member_settings
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Apply to dev** — `pnpm db:push`. Expected: migration applies cleanly. (Dev shares the prod Supabase ref — see project memory; this is intended.)
- [ ] **Step 3: Regenerate types** — use the Supabase MCP `generate_typescript_types` tool, write output to `src/lib/database.types.ts`, then `pnpm exec prettier --write src/lib/database.types.ts && pnpm typecheck`. Expected: `member_settings` Row/Insert/Update appear; typecheck PASS.
- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260630130000_member_settings.sql src/lib/database.types.ts
git commit -m "feat: member_settings table with owner-only RLS (AGE-237)"
```

### Task 4.2: pgTAP — owner-only enforcement

**Files:**
- Create: `supabase/tests/probe_member_settings_rls.sql`

Note: the repo's probes are named `probe_*.sql` (not `*.test.sql`) and there is **no** `db:test` npm script — read a neighbouring probe (e.g. `supabase/tests/probe_compass_responses_rls.sql`, the closest owner-only-RLS analogue) to copy the **exact** scaffold and the auth/`set_config('request.jwt.claims', …)` helper this repo uses.

- [ ] **Step 1:** Mirror `probe_compass_responses_rls.sql`'s structure (`begin; … rollback;`, the role/jwt-switch helper, `plan(n)` + `finish()`). Seed two profiles A and B. Assert: as A, `insert` + `select` of own `member_settings` row works; as B, `select` of A's row yields 0 rows and `update` of A's row affects 0 rows.
- [ ] **Step 2: Run the DB probes** the same way the existing probes are run in this repo (check the README / how `probe_*.sql` files are executed — likely `supabase test db` or piping the file through `psql` against the local stack). Expected: all assertions PASS.
- [ ] **Step 3: Commit**

```bash
git add supabase/tests/probe_member_settings_rls.sql
git commit -m "test: member_settings owner-only RLS probe (AGE-237)"
```

### Task 4.3: Data layer — `member-settings.ts`

**Files:**
- Create: `src/lib/member-settings.ts`
- Test: `src/lib/member-settings.test.ts` (create — pure-shape test of defaults)

- [ ] **Step 1: Write the failing test** (defaults helper is pure; the Supabase fetch/upsert are covered by RLS pgTAP + the page test's mock):

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_MEMBER_SETTINGS, type MemberSettings } from "./member-settings";

describe("member-settings defaults", () => {
  it("listet im Verzeichnis und erlaubt Prime-Kontakt standardmäßig", () => {
    const s: MemberSettings = DEFAULT_MEMBER_SETTINGS;
    expect(s.visible_in_directory).toBe(true);
    expect(s.contactable_by_prime).toBe(true);
    expect(s.notify_email_digest).toBe(false);
  });
});
```

- [ ] **Step 2: Run it** — `pnpm test member-settings`. Expected: FAIL.
- [ ] **Step 3: Implement** (follow `src/lib/profile.ts` conventions: React-Query key factory, thrown errors, `.upsert(..., { onConflict: "profile_id" })`):

```ts
import { supabase } from "./supabase";

export interface MemberSettings {
  notify_email_requests: boolean;
  notify_email_events: boolean;
  notify_email_digest: boolean;
  visible_in_directory: boolean;
  contactable_by_prime: boolean;
}

export const DEFAULT_MEMBER_SETTINGS: MemberSettings = {
  notify_email_requests: true,
  notify_email_events: true,
  notify_email_digest: false,
  visible_in_directory: true,
  contactable_by_prime: true,
};

export const memberSettingsQueryKey = (uid: string) => ["member-settings", uid] as const;

export async function fetchMemberSettings(uid: string): Promise<MemberSettings> {
  const { data, error } = await supabase
    .from("member_settings")
    .select("notify_email_requests, notify_email_events, notify_email_digest, visible_in_directory, contactable_by_prime")
    .eq("profile_id", uid)
    .maybeSingle();
  if (error) throw error;
  return data ?? DEFAULT_MEMBER_SETTINGS; // noch keine Zeile ⇒ Defaults
}

export async function saveMemberSettings(uid: string, values: MemberSettings): Promise<void> {
  const { error } = await supabase
    .from("member_settings")
    .upsert({ profile_id: uid, ...values }, { onConflict: "profile_id" });
  if (error) throw error;
}
```

- [ ] **Step 4: Run it** — `pnpm test member-settings`. Expected: PASS. Then `pnpm typecheck` (verifies the new column types exist after 4.1 regeneration).
- [ ] **Step 5: Commit**

```bash
git add src/lib/member-settings.ts src/lib/member-settings.test.ts
git commit -m "feat: member-settings data layer (AGE-237)"
```

### Task 4.4: `EinstellungenPage` with persisted toggles

**Files:**
- Modify: `src/pages/EinstellungenPage.tsx`
- Test: `src/pages/EinstellungenPage.test.tsx` (create)

- [ ] **Step 1: Write the failing test** — mock `../lib/member-settings`; assert toggles render with fetched values and that flipping one calls `saveMemberSettings`.

```tsx
vi.mock("../lib/member-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/member-settings")>();
  return { ...actual, fetchMemberSettings: vi.fn(), saveMemberSettings: vi.fn() };
});
import { fetchMemberSettings, saveMemberSettings, DEFAULT_MEMBER_SETTINGS } from "../lib/member-settings";
// beforeEach: vi.mocked(fetchMemberSettings).mockResolvedValue(DEFAULT_MEMBER_SETTINGS);
//             vi.mocked(saveMemberSettings).mockResolvedValue();

describe("EinstellungenPage", () => {
  it("zeigt Konto-Infos und persistiert einen Toggle", async () => {
    renderPage(authAsTier("legacy")); // wraps in Auth+Query+Toast+MemoryRouter
    expect(await screen.findByRole("heading", { name: "Einstellungen" })).toBeInTheDocument();
    const toggle = screen.getByRole("switch", { name: /Im Verzeichnis sichtbar/ });
    fireEvent.click(toggle);
    expect(saveMemberSettings).toHaveBeenCalled();
  });
});
```

The auth fixture's `user` has `id`; for the email line use `authAsTier` (its user has no email) — render `user.email ?? "—"`. To show a real email in the test, build the value with `fakeAuthValue({ user: { id: "u1", email: "legacy@fbcdemo.de" } as ... })`.

- [ ] **Step 2: Run it** — `pnpm test EinstellungenPage`. Expected: FAIL.
- [ ] **Step 3: Implement.** Sections: Konto (email from `useAuth().user.email`, Logout via `useAuth().signOut` + navigate `/login`), Mitgliedschaft (`TierBadge`/`tierLabel(tier)`), Benachrichtigungen (3 switches), Sichtbarkeit (2 switches). Load with `useQuery(memberSettingsQueryKey, fetchMemberSettings)`; persist with `useMutation(saveMemberSettings)` on each change (optimistic local state + invalidate). Use `role="switch"` buttons with `aria-checked` and a clear `aria-label` per toggle (e.g. "Im Verzeichnis sichtbar"). Show a success toast (`useToast`) on save and an error toast on failure (mirror `AnfrageRow`'s mutation error handling). Keep markup consistent with `DashboardCard`/`Card`.

Sketch:

```tsx
function ToggleRow({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <button
        type="button" role="switch" aria-checked={checked} aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-gold-strong" : "bg-line")}
      >
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-canvas transition-all",
          checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}
```

The page wires `ToggleRow`s to the loaded `MemberSettings`, calling the mutation with the next full object on each change.

- [ ] **Step 4: Run it** — `pnpm test EinstellungenPage`. Expected: PASS. Then `pnpm typecheck`.
- [ ] **Step 5: Commit**

```bash
git add src/pages/EinstellungenPage.tsx src/pages/EinstellungenPage.test.tsx
git commit -m "feat: Einstellungen page with persisted notification + visibility prefs (AGE-237)"
```

### Task 4.5: Honour `visible_in_directory` (close the loop)

**Files:**
- Modify: the directory/visibility read path (verify against `src/lib/directory.ts` + the `profiles.is_public` usage and the `profiles_public` view).

- [ ] **Step 1:** Decide the minimal wiring: `member_settings.visible_in_directory` should govern directory listing. The existing coarse flag is `profiles.is_public` gating the `profiles_public` view. Pick ONE source of truth — recommended: keep `profiles.is_public` as the enforced column and have the Sichtbarkeit toggle write **both** `member_settings.visible_in_directory` and `profiles.is_public` (the latter already has an UPDATE grant and drives the view + RLS). Confirm `is_public` is in the client UPDATE grant (it is, per `foundation_conform`). Update `saveMemberSettings` callers (or `saveMemberSettings` itself) to also `supabase.from("profiles").update({ is_public: values.visible_in_directory }).eq("id", uid)`.
- [ ] **Step 2:** Add a test asserting the visibility toggle triggers the `profiles.is_public` write (extend the page test or the data-layer test with a `supabase` mock if needed — otherwise assert via the `saveMemberSettings` mock that both writes happen). Keep `contactable_by_prime` as stored-only for now (the contact-request INSERT RLS gate is a follow-up; note it).
- [ ] **Step 3:** `pnpm test && pnpm typecheck`. Expected: PASS.
- [ ] **Step 4: Commit**

```bash
git add -A src/lib src/pages
git commit -m "feat: directory visibility toggle drives profiles.is_public (AGE-237)"
```

**Phase 4 gate:** Settings load, toggle, persist across reload; pgTAP proves owner-only; directory visibility honours the toggle.

---

## Final verification

- [ ] `pnpm test` — full suite green.
- [ ] `pnpm typecheck` — clean.
- [ ] `grep -rn "MeinBereichPage\|?tab=" src/` — no hits.
- [ ] Manual: each Mein-Bereich menu item highlights exactly one entry; `/mein-bereich` → `/profil`; editor at `/profil/bearbeiten`; Aktivität block collapses; settings persist.
- [ ] Per project workflow: run `/review` on the branch diff and `/cso` (Phase 4 touches DB/RLS/auth) before the PR.

## Notes / deliberate deferrals (flag to user)

- **Shared `ProfileView` for `/p/:id` + `/profil`:** the spec envisioned one component with `isOwner`. This plan builds the owner Bento view from `dashboard.ts` data and leaves `PublicProfilePage` (which uses the tier-gated `public-profile.ts` + RLS path) untouched. Converging them is a separate task — merging two different data/RLS sources carries security risk and isn't worth bundling here. **Confirm this deferral is acceptable.**
- **`contactable_by_prime`** is stored but not yet enforced in the `cr_insert_self_prime` RLS policy; wiring it into the INSERT `with check` is a small follow-up migration.
- **"Über mich"** in the Bento comes from `ProfileHero` (headline/short_bio); there is no separate long-bio widget today. If a dedicated "Über mich" tile is wanted, it's an additive card.
