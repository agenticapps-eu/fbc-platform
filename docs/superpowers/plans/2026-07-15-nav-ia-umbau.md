# Nav-/IA-Umbau Schritt 1+2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Navigation steht auf den 6+5+1 Einträgen der Spec, Community ist in `Mitglieder` und `Aktivität` aufgeteilt, Biete & Suche lebt in Compass, Matching heißt `Meine Chancen`.

**Architecture:** `src/config/nav.ts` ist die einzige Quelle für Routing und Sidebar; der Umbau ändert ihren Inhalt und die Gate-Regel in `App.tsx`, nicht das Prinzip. Alle Inhalts-Bausteine existieren bereits (`CommunityFeed`, `MemberDirectory`, `AngeboteGesuchePage`, `MatchingPage`) — sie werden verschoben, nicht neu gebaut.

**Tech Stack:** React 18 · TypeScript strict · react-router-dom · TanStack Query · Vitest + Testing Library · Tailwind · pnpm

**Spec:** `docs/superpowers/specs/2026-07-15-fbc-navigation-ia-mvp.md`
**Design:** `docs/superpowers/specs/2026-07-15-fbc-navigation-ia-mvp-design.md`
**Linear:** AGE-314 · **Branch:** `donald/age-314-nav-ia-umbau`

## Global Constraints

- **Conventional Commits mit Linear-Referenz** in jeder Message, z. B. `feat(nav): … (AGE-314)`.
- **Nie direkt auf `main`** — dieser Branch, PR am Ende.
- **Keine Prod-Details ins Repo** — `agenticapps-eu/fbc-platform` ist öffentlich. Prod-Zahlen/IDs/URLs gehören in Linear.
- **Niemals `git add -A` oder `git add .`.** Der Arbeitsbaum enthält untracked Dateien, die nicht ins Repo gehören: `docs/data-model.md` und `docs/rls-policies.md` (Rechte `0600`), `.planning/`, `deno.lock`, ein modifiziertes `session-handoff.md`. Bei einem **öffentlichen** Repo ist ein pauschales Stagen eine Veröffentlichung. Stage die Dateien deines Tasks namentlich, oder nutze `git add -u` (nur Versioniertes), und **prüfe `git status --short` vor jedem Commit**.
- **Gültige Stufen sind ausschließlich** `basic, connect, discover, exchange, focus, impact` (AGE-311). `prime`, `legacy`, `circle` existieren nicht — nie einbauen, nie in Copy erwähnen.
- **TypeScript strict** — kein `any`, keine `@ts-ignore`.
- **Deutsche UI-Copy und deutsche Kommentare**, passend zum bestehenden Code.
- **Der Feed wird nicht neu gebaut** (Spec §5) — `CommunityFeed` und `MemberDirectory` werden gemountet, nicht verändert.
- **Keine `vi.mock` auf projekteigene Komponenten.** Sie laufen in der Testumgebung ungemockt — Beleg: `RequireTier.test.tsx` rendert `MemberDirectory` und `CommunityFeed` über die App, ohne einen einzigen Mock, 10/10 grün. Eine Attrappe, die den String rendert, den der Test danach behauptet, prüft nur sich selbst. Provider (`AuthFixture`, `QueryClientProvider`, `MemoryRouter`) sind **keine** Mocks — sie stellen die Umgebung bereit, statt die Komponente zu ersetzen, und sind erwünscht.
- **Ein roter Test ist eine Information, kein Hindernis.** Wenn ein Test aus dem Plan fehlschlägt, ist die Meldung des echten Fehlers die richtige Antwort — nicht Wegmocken, nicht die Assertion aufweichen, nicht Produktionscode für die Bequemlichkeit des Tests umbauen. (Genau so wurde in Task 1 eine Lücke im Plan gefunden.)
- **Verifikation vor jeder „fertig"-Behauptung:** `pnpm test` und `pnpm typecheck` müssen laufen und ihre Ausgabe gezeigt werden.

## File Structure

**Neu:**

| Datei | Verantwortung |
|---|---|
| `src/pages/AktivitaetPage.tsx` | ENTDECKEN-Ziel „Aktivität": Hero + `CommunityFeed`. Dünne Hülle. |
| `src/pages/MitgliederPage.tsx` | ENTDECKEN-Ziel „Mitglieder": Hero + `MemberDirectory`. Dünne Hülle, kein Gate (kommt aus der Route). |
| `src/pages/MeineKursePage.tsx` | MEIN-BEREICH-Stub „Meine Kurse". |
| `src/config/nav.test.ts` | Behauptet die Ziel-Navigation aus Spec §2 gegen `navItems`. |
| `src/components/RequireAuth.test.tsx` | Übernimmt die Auth-Fälle aus `RequireTier.test.tsx` (dessen Komponente entfällt). |

**Geändert:**

| Datei | Änderung |
|---|---|
| `src/config/nav.ts` | `NavSection`-Typ + `navItems` auf die Ziel-Navigation. |
| `src/config/formatHero.ts` | Keys folgen den Pfaden: `/mitglieder`, `/aktivitaet`, `/meine-chancen` rein; `/library`, `/projekte`, `/community`, `/matching` raus. |
| `src/App.tsx` | Gate-Regel (`minTier` ⇒ Wand) + vier Redirects. |
| `src/components/AppShell.tsx` | Drei betitelte Abschnitte statt flachem Menü + `MeinBereichNav`; `WIDE_ROUTES` auf neue Pfade. |
| `src/pages/CompassPage.tsx` | Tabs „Mini-Compass" \| „Suche & Biete"; `/mein-bereich`-Link auf `/profil`. |
| `src/pages/AngeboteGesuchePage.tsx` | Exportiert zusätzlich eine Editor-Komponente ohne Seiten-Rahmen; `/mein-bereich`-Link auf `/profil`. |
| `src/pages/MeineChancenPage.tsx` | Aus `MatchingPage.tsx` (`git mv`), Export + Hero-Key umbenannt. |
| `src/components/mein-bereich/kontakte-widgets.tsx` | Links auf `/meine-chancen` und `/compass`. |
| `src/components/mein-bereich/profil-widgets.tsx` | Link auf `/aktivitaet`. |
| `src/pages/HomePage.tsx` | Link auf `/aktivitaet`. |
| `src/App.test.tsx`, `src/components/MembershipGate.test.tsx` | Ziehen mit den Pfaden/Labels mit. |
| `docs/demo-script.md` | `/verzeichnis` → `/mitglieder`, `/matching` → `/meine-chancen`. |

**Gelöscht:** `src/pages/CommunityPage.tsx` · `src/pages/LibraryPage.tsx` · `src/pages/ProjektePage.tsx` · `src/pages/VerzeichnisPage.tsx` · `src/config/meinBereich.ts` · `src/config/meinBereich.test.ts` · `src/components/ui/MeinBereichNav.tsx` · `src/components/RequireTier.tsx` · `src/components/RequireTier.test.tsx`

---

### Task 1: ENTDECKEN-Seiten „Aktivität" und „Mitglieder"

Legt die beiden Seiten an, die den Community-Split tragen. Sie werden hier noch **nicht** verdrahtet — das macht Task 5. Beide sind dünne Hüllen; Feed und Verzeichnis bleiben unangetastet (Spec §5).

**Files:**
- Create: `src/pages/AktivitaetPage.tsx`
- Create: `src/pages/MitgliederPage.tsx`
- Create: `src/pages/AktivitaetPage.test.tsx`
- Create: `src/pages/MitgliederPage.test.tsx`
- Modify: `src/config/formatHero.ts`

**Interfaces:**
- Consumes: `CommunityFeed` (default export, `src/components/community/CommunityFeed.tsx`), `MemberDirectory` (default export, `src/components/community/MemberDirectory.tsx`), `FormatHero` (named), `FORMAT_HERO` (named).
- Produces: `AktivitaetPage`, `MitgliederPage` (beide default exports, keine Props) — Task 5 trägt sie in `navItems` ein. `FORMAT_HERO["/aktivitaet"]` und `FORMAT_HERO["/mitglieder"]` — Task 5 braucht sie für die `MembershipGate`-Wand.

- [ ] **Step 1: Die Hero-Einträge für die neuen Pfade ergänzen**

`FORMAT_HERO` ist nach Pfaden gekeyt und wird von `MembershipGate.tsx:33` für die Wand gelesen — ohne Eintrag zeigt die Wand keinen Hero. Die alten Keys bleiben in diesem Task noch stehen (die alten Seiten laufen bis Task 5 weiter); Task 5 räumt sie ab.

In `src/config/formatHero.ts`, innerhalb von `FORMAT_HERO`, hinter der `/events`-Zeile einfügen:

```ts
  "/mitglieder": { title: "Mitglieder", claim: "Finde die Passenden." },
  "/aktivitaet": { title: "Aktivität", claim: "Hier lebt der Club." },
```

- [ ] **Step 2: Den fehlschlagenden Test für AktivitaetPage schreiben**

Create `src/pages/AktivitaetPage.test.tsx`:

**Keine Mocks.** `CommunityFeed` und `MemberDirectory` laufen in der Testumgebung ungemockt — Beleg: `RequireTier.test.tsx` rendert beide über die App und ist grün. Wer sie durch Attrappen ersetzt, baut einen Test, der nur noch sich selbst prüft.

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import AktivitaetPage from "./AktivitaetPage";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";

/**
 * Der Feed lädt über TanStack Query und verlinkt Profile → beide Provider nötig.
 * CommunityFeed ruft zudem useAuth(), das ohne Provider wirft — daher AuthFixture.
 * Bewusst anonym (fakeAuthValue): /aktivitaet ist für alle sichtbar, auch ausgeloggt.
 */
function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={fakeAuthValue()}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AktivitaetPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

describe("AktivitaetPage", () => {
  it("zeigt den Aktivität-Hero", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Aktivität" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Test laufen lassen — er muss fehlschlagen**

Run: `pnpm vitest run src/pages/AktivitaetPage.test.tsx`
Expected: FAIL — `Failed to resolve import "./AktivitaetPage"` (die Datei gibt es noch nicht).

- [ ] **Step 4: AktivitaetPage schreiben**

Create `src/pages/AktivitaetPage.tsx`:

```tsx
import CommunityFeed from "../components/community/CommunityFeed";
import { FormatHero } from "../components/ui/FormatHero";
import { FORMAT_HERO } from "../config/formatHero";

/**
 * Aktivität (AGE-314, Spec §3): der lebendige Mittelpunkt — Beiträge, Kommentare,
 * Fotos, Eventberichte. Bewusst derselbe Feed, der bis hierher unter /community lief:
 * verschoben, nicht neu gebaut (Spec §5).
 */
export default function AktivitaetPage() {
  return (
    <div className="flex flex-col gap-6">
      <FormatHero meta={FORMAT_HERO["/aktivitaet"]} />
      <CommunityFeed />
    </div>
  );
}
```

- [ ] **Step 5: Test laufen lassen — er muss durchlaufen**

Run: `pnpm vitest run src/pages/AktivitaetPage.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 6: Den fehlschlagenden Test für MitgliederPage schreiben**

Create `src/pages/MitgliederPage.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import MitgliederPage from "./MitgliederPage";

/** MemberDirectory sucht serverseitig (Query) und verlinkt Profile (Router). */
function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MitgliederPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MitgliederPage", () => {
  it("zeigt den Mitglieder-Hero", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Mitglieder" })).toBeInTheDocument();
  });

  it("mountet das Verzeichnis (Suche + Filter), nicht den Feed", () => {
    renderPage();
    // Spec §3: „Mitglieder" ist nur noch Suche · Filter · Profile · Kontaktaufnahme —
    // keine Beiträge. Die Verzeichnis-Überschrift stammt aus MemberDirectory.
    expect(screen.getByRole("heading", { name: "Verzeichnis" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Test laufen lassen — er muss fehlschlagen**

Run: `pnpm vitest run src/pages/MitgliederPage.test.tsx`
Expected: FAIL — `Failed to resolve import "./MitgliederPage"`

- [ ] **Step 8: MitgliederPage schreiben**

Create `src/pages/MitgliederPage.tsx`:

```tsx
import MemberDirectory from "../components/community/MemberDirectory";
import { FormatHero } from "../components/ui/FormatHero";
import { FORMAT_HERO } from "../config/formatHero";

/**
 * Mitglieder (AGE-314, Spec §3): Suche · Filter · Profile · Kontaktaufnahme —
 * ausdrücklich keine Beiträge mehr (die leben in /aktivitaet).
 *
 * Das Stufen-Gate sitzt NICHT hier, sondern an der Route: `navItems.minTier` lässt
 * App.tsx ein <MembershipGate> legen, das unterhalb von Discover die Wand zeigt.
 * Die harte Grenze ist ohnehin die RLS (siehe lib/directory.ts).
 */
export default function MitgliederPage() {
  return (
    <div className="flex flex-col gap-6">
      <FormatHero meta={FORMAT_HERO["/mitglieder"]} />
      <MemberDirectory />
    </div>
  );
}
```

- [ ] **Step 9: Test laufen lassen — er muss durchlaufen**

Run: `pnpm vitest run src/pages/MitgliederPage.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 10: Committen**

```bash
git add src/pages/AktivitaetPage.tsx src/pages/AktivitaetPage.test.tsx \
        src/pages/MitgliederPage.tsx src/pages/MitgliederPage.test.tsx \
        src/config/formatHero.ts
git commit -m "feat(nav): Seiten Aktivität und Mitglieder für den Community-Split (AGE-314)"
```

---

### Task 2: Stub-Seite „Meine Kurse"

Persönliches Gegenstück zur Academy. Die Academy ist im MVP kuratiert und kennt keine Einschreibung — es gibt nichts anzuzeigen. Bewusst ehrlich leer statt Fake-Daten (Design §5).

**Files:**
- Create: `src/pages/MeineKursePage.tsx`
- Create: `src/pages/MeineKursePage.test.tsx`

**Interfaces:**
- Consumes: nichts.
- Produces: `MeineKursePage` (default export, keine Props) — Task 5 trägt sie in `navItems` ein.

**Stilhinweis:** MEIN-BEREICH-Seiten benutzen **keinen** `FormatHero`, sondern ein schlichtes `h1` — siehe `KontaktePage.tsx` und `MeineEventsPage.tsx`. Diese Seite folgt dem, nicht dem Hero-Stil der ENTDECKEN-Seiten.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

Create `src/pages/MeineKursePage.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MeineKursePage from "./MeineKursePage";

describe("MeineKursePage", () => {
  it("nennt den Bereich", () => {
    render(<MeineKursePage />);
    expect(screen.getByRole("heading", { name: "Meine Kurse" })).toBeInTheDocument();
  });

  it("sagt ehrlich, dass noch keine Kurse belegt sind — ohne Fake-Daten", () => {
    render(<MeineKursePage />);
    expect(screen.getByText(/noch keine Kurse belegt/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Test laufen lassen — er muss fehlschlagen**

Run: `pnpm vitest run src/pages/MeineKursePage.test.tsx`
Expected: FAIL — `Failed to resolve import "./MeineKursePage"`

- [ ] **Step 3: Die Seite schreiben**

Create `src/pages/MeineKursePage.tsx`:

```tsx
/**
 * Meine Kurse (AGE-314, Spec §2): persönliches Gegenstück zur Academy, so wie
 * „Meine Events" zu „Events".
 *
 * Bewusst ein Stub: die Academy ist im MVP kuratiert (drei feste Videos) und kennt
 * keine Einschreibung — es gibt noch keine Datenbasis für „meine" Kurse. Der Eintrag
 * hält die Navigation vollständig wie in der Spec, ohne etwas vorzutäuschen.
 */
export default function MeineKursePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Meine Kurse</h1>
      <p className="text-sm text-muted">
        Du hast noch keine Kurse belegt. Sobald du in der Academy einen Kurs startest,
        erscheint er hier.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Test laufen lassen — er muss durchlaufen**

Run: `pnpm vitest run src/pages/MeineKursePage.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Committen**

```bash
git add src/pages/MeineKursePage.tsx src/pages/MeineKursePage.test.tsx
git commit -m "feat(nav): Stub-Seite Meine Kurse (AGE-314)"
```

---

### Task 3: Matching → „Meine Chancen"

Vollständige Umbenennung inklusive Pfad, damit sie in sich abgeschlossen ist. Die `section` bleibt hier noch `"formate"` — der Umzug nach `mein-bereich` passiert erst in Task 5. Dadurch bleibt das Gate-Verhalten in diesem Task unverändert und alles grün.

**Nur umbenennen, nicht kürzen:** Die inhaltliche Reduktion auf „wenige, hochwertige Empfehlungen" (Spec §3) ist ausdrücklich **nicht** Teil dieses Umbaus (Design §9).

**Files:**
- Rename: `src/pages/MatchingPage.tsx` → `src/pages/MeineChancenPage.tsx`
- Modify: `src/pages/MeineChancenPage.tsx` (Export + Hero-Key)
- Modify: `src/config/formatHero.ts`
- Modify: `src/config/nav.ts` (Import, `path`, `label`)
- Modify: `src/App.tsx` (Redirect)
- Modify: `src/components/AppShell.tsx:19` (`WIDE_ROUTES`)
- Modify: `src/components/mein-bereich/kontakte-widgets.tsx:199`
- Modify: `src/components/MembershipGate.test.tsx`
- Modify: `docs/demo-script.md`

**Interfaces:**
- Consumes: `FORMAT_HERO` (named).
- Produces: `MeineChancenPage` (default export). `FORMAT_HERO["/meine-chancen"]`. Route `/meine-chancen` mit `minTier: "discover"`.

- [ ] **Step 1: Die Datei umbenennen (Historie behalten)**

```bash
git mv src/pages/MatchingPage.tsx src/pages/MeineChancenPage.tsx
```

- [ ] **Step 2: Export und Hero-Key in der Datei umbenennen**

In `src/pages/MeineChancenPage.tsx`:

```tsx
// vorher
export default function MatchingPage() {
// nachher
export default function MeineChancenPage() {
```

```tsx
// vorher (Zeile ~117)
      <FormatHero meta={FORMAT_HERO["/matching"]} />
// nachher
      <FormatHero meta={FORMAT_HERO["/meine-chancen"]} />
```

Und der Link auf den Editor (Zeile ~607), der ab Task 4 im Compass lebt:

```tsx
// vorher
          <Link to="/angebote-gesuche">
// nachher
          <Link to="/compass">
```

- [ ] **Step 3: Den Hero-Eintrag umbenennen**

In `src/config/formatHero.ts` die `/matching`-Zeile ersetzen:

```ts
// vorher
  "/matching": { title: "Matching", claim: "Suche trifft Biete." },
// nachher
  "/meine-chancen": { title: "Meine Chancen", claim: "Suche trifft Biete." },
```

- [ ] **Step 4: Route und Label in nav.ts umstellen**

In `src/config/nav.ts` den Import ersetzen:

```ts
// vorher
import MatchingPage from "../pages/MatchingPage";
// nachher
import MeineChancenPage from "../pages/MeineChancenPage";
```

Und den Eintrag (`section` bleibt vorerst `"formate"`):

```ts
  {
    path: "/meine-chancen",
    label: "Meine Chancen",
    Component: MeineChancenPage,
    section: "formate",
    // §2: „erweiterte Matchings" ab `discover`. Die „ersten Matchings" von
    // `connect` kommen aus der matches-Tabelle und brauchen diese Seite nicht.
    minTier: "discover",
  },
```

- [ ] **Step 5: Redirect für die alte URL setzen**

In `src/App.tsx`, direkt unter der `/mein-bereich`-Zeile (~45):

```tsx
          <Route path="/matching" element={<Navigate to="/meine-chancen" replace />} />
```

- [ ] **Step 6: WIDE_ROUTES und den Widget-Link nachziehen**

`src/components/AppShell.tsx:19`:

```tsx
// vorher
const WIDE_ROUTES = ["/profil", "/kontakte", "/verzeichnis", "/matching"];
// nachher
const WIDE_ROUTES = ["/profil", "/kontakte", "/verzeichnis", "/meine-chancen"];
```

`src/components/mein-bereich/kontakte-widgets.tsx:199`:

```tsx
// vorher
          <CardLink to="/matching">Zum Matching</CardLink>
// nachher
          <CardLink to="/meine-chancen">Zu meinen Chancen</CardLink>
```

- [ ] **Step 7: Den Wand-Test auf den neuen Pfad ziehen**

In `src/components/MembershipGate.test.tsx` (~Zeile 50):

```tsx
// vorher
  it("zeigt einer zu niedrigen Stufe auf einem discover-Format (/matching) die Stufen-Wand", () => {
    renderAt("/matching", authAsTier("basic"));
// nachher
  it("zeigt einer zu niedrigen Stufe auf /meine-chancen die Stufen-Wand", () => {
    renderAt("/meine-chancen", authAsTier("basic"));
```

- [ ] **Step 8: Das Demo-Skript nachziehen**

In `docs/demo-script.md` alle `/matching`-Vorkommen (Zeilen ~28, ~42) auf `/meine-chancen` ändern und die Bezeichnung „Matching-Hub" auf „Meine Chancen".

- [ ] **Step 9: Tests + Typecheck laufen lassen**

Run: `pnpm typecheck && pnpm test`
Expected: PASS — insbesondere `MembershipGate.test.tsx` (Wand auf `/meine-chancen`) und `App.test.tsx`.

- [ ] **Step 10: Committen**

```bash
git add -A
git commit -m "refactor(nav): Matching heißt Meine Chancen (AGE-314)"
```

---

### Task 4: Biete & Suche wird ein Tab in Compass

Spec §3: Biete & Suche „wird Teil von Compass". Der Editor zieht als Komponente in `/compass`; sein Innenleben bleibt unangetastet. `/angebote-gesuche` verschwindet als Route und leitet auf `/compass`.

**Files:**
- Modify: `src/pages/AngeboteGesuchePage.tsx`
- Modify: `src/pages/CompassPage.tsx`
- Modify: `src/config/nav.ts`
- Modify: `src/App.tsx`
- Create: `src/pages/CompassPage.test.tsx`

**Interfaces:**
- Consumes: `Tabs` (named, `src/components/ui/Tabs.tsx`; Props `{ tabs: TabItem[]; defaultValue?: string; className?: string }`, `TabItem = { value: string; label: string; content: ReactNode }`).
- Produces: `AngeboteGesucheEditor` (named export aus `src/pages/AngeboteGesuchePage.tsx`) — der Editor ohne Seiten-Rahmen. Route `/compass` mit zwei Tabs.

- [ ] **Step 1: Den Editor als eigene Komponente herauslösen**

Die heutige Struktur von `src/pages/AngeboteGesuchePage.tsx`:

- **Zeile 52-57** — `export default function AngeboteGesuchePage()`: reine Auth-Hülle, holt `user` und rendert `<MatchingProfileEditor uid={user.id} />`.
- **Zeile 59 ff.** — `function MatchingProfileEditor({ uid })`: das eigentliche Formular. Enthält zwei Stellen, die zum Seiten-Rahmen gehören und im Tab nicht mehr passen.

Drei Änderungen, sonst nichts:

**(a) Default-Export in benannten Export umbenennen** (Zeile 52). Die Auth-Hülle bleibt — der Editor braucht `uid`:

```tsx
/**
 * Such-/Bieteprofil-Editor (AGE-244). Seit AGE-314 lebt er als Tab in /compass
 * (Spec §3: „Biete & Suche wird Teil von Compass") und nicht mehr als eigene
 * Seite — Hero und Tab-Leiste stellt CompassPage.
 */
export function AngeboteGesucheEditor() {
  const { user } = useAuth();
  // Der Compass-Tab ist requiresAuth — user ist hier vorhanden; defensiver Fallback.
  if (!user) return null;
  return <MatchingProfileEditor uid={user.id} />;
}
```

**(b) Die Seitenüberschrift entfernen** (Zeile ~136-139). Der `<h1>Such- &amp; Bieteprofil</h1>` muss weg: `CompassPage` stellt bereits das `h1` über `FormatHero`, und der Tab heißt schon „Suche & Biete" — ein zweites `h1` wäre doppelt und semantisch falsch. **Nur das `<h1>`-Element löschen.** Der beschreibende Absatz darunter („Pflege, was du anbietest …") **bleibt**, ebenso das umgebende `<header>` mit dem Speichern-Button rechts.

**(c) Den Rücklink entfernen** (Zeile ~209-216). Aus einem Tab „zurück zu Mein Bereich" zu verlinken ergibt keinen Sinn. Lösche das `<Link to="/mein-bereich">← Zurück zu Mein Bereich</Link>` samt Inhalt. Das umgebende `<div>` behält nur noch den Speichern-Button — stell es dabei von `justify-between` auf `justify-end`, sonst rutscht der Button nach links:

```tsx
// vorher
      <div className="flex items-center justify-between gap-4">
        <Link to="/mein-bereich" className="text-sm font-medium text-gold-strong hover:text-gold">
          ← Zurück zu Mein Bereich
        </Link>
        <Button type="submit" variant="primary" disabled={mutation.isPending}>
// nachher
      <div className="flex items-center justify-end gap-4">
        <Button type="submit" variant="primary" disabled={mutation.isPending}>
```

Den `Link`-Import entfernen, falls er dadurch ungenutzt wird.

**Die Formularlogik, die Mutation, die Cards und die Validierung bleiben unangetastet.**

- [ ] **Step 2: Den fehlschlagenden Test für die Compass-Tabs schreiben**

Create `src/pages/CompassPage.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import CompassPage from "./CompassPage";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={authAsTier("exchange")}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CompassPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

describe("CompassPage", () => {
  it("führt Mini-Compass und Suche & Biete in einer Seite zusammen (Spec §3)", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: "Mini-Compass" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Suche & Biete" })).toBeInTheDocument();
  });

  it("startet auf dem Mini-Compass", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: "Mini-Compass" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
```

- [ ] **Step 3: Test laufen lassen — er muss fehlschlagen**

Run: `pnpm vitest run src/pages/CompassPage.test.tsx`
Expected: FAIL — `Unable to find an accessible element with the role "tab"` (CompassPage hat noch keine Tabs).

- [ ] **Step 4: CompassPage auf Tabs umbauen**

In `src/pages/CompassPage.tsx` die Imports ergänzen:

```tsx
import { Tabs } from "../components/ui/Tabs";
import { AngeboteGesucheEditor } from "./AngeboteGesuchePage";
```

Den bisherigen `<Card>`-Block in eine lokale Komponente `MiniCompassTab()` verschieben (unveränderter Inhalt), dabei zwei Links korrigieren:

```tsx
// vorher (Zeile ~57) — Altlast aus #54, lebt nur vom Redirect
            <Link to="/mein-bereich" className="text-sm font-medium text-gold-strong hover:underline">
// nachher
            <Link to="/profil" className="text-sm font-medium text-gold-strong hover:underline">
```

Der bisherige Block „Du kannst dein Such- & Bieteprofil jederzeit direkt pflegen" mit dem Link auf `/angebote-gesuche` (Zeilen ~71–84) **entfällt ersatzlos** — das Profil ist jetzt der Nachbar-Tab, ein Link darauf wäre Unsinn.

Dann das Seiten-Gerüst:

```tsx
export default function CompassPage() {
  return (
    <div className="flex flex-col gap-6">
      <FormatHero meta={FORMAT_HERO["/compass"]} />
      <Tabs
        tabs={[
          { value: "compass", label: "Mini-Compass", content: <MiniCompassTab /> },
          { value: "suche-biete", label: "Suche & Biete", content: <AngeboteGesucheEditor /> },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 5: Test laufen lassen — er muss durchlaufen**

Run: `pnpm vitest run src/pages/CompassPage.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: Route entfernen und Redirect setzen**

In `src/config/nav.ts` den Import `AngeboteGesuchePage` und den kompletten `/angebote-gesuche`-Eintrag löschen.

In `src/App.tsx`, bei den anderen Redirects:

```tsx
          {/* Der Such-/Biete-Editor ist seit AGE-314 ein Tab in /compass (Spec §3).
            Der Redirect landet auf dem Mini-Compass-Tab, nicht auf „Suche & Biete" —
            Tab-Deeplinks hat heute keine Seite, das wäre ein eigener Mechanismus. */}
          <Route path="/angebote-gesuche" element={<Navigate to="/compass" replace />} />
```

- [ ] **Step 7: Tests + Typecheck laufen lassen**

Run: `pnpm typecheck && pnpm test`
Expected: PASS

- [ ] **Step 8: Committen**

```bash
git add -A
git commit -m "feat(nav): Biete & Suche wird ein Tab in Compass (AGE-314)"
```

---

### Task 5: Das Nav-Gerüst auf 6+5+1 umstellen

Der Kern. Hier wird `nav.ts` zur Ziel-Navigation, die Gate-Regel korrigiert, die Sidebar dreigeteilt und die letzten Redirects gesetzt. **Der RED-Test dieses Tasks ist die eigentliche Zusage der Spec.**

**Files:**
- Create: `src/config/nav.test.ts`
- Modify: `src/config/nav.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/config/formatHero.ts`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `AktivitaetPage`, `MitgliederPage`, `MeineKursePage` (Tasks 1–2), `MeineChancenPage` (Task 3).
- Produces: `NavSection = "entdecken" | "mein-bereich" | "service" | "sub"`; `navItems` in Zielgestalt. Task 6 räumt danach die Waisen ab.

- [ ] **Step 1: Den fehlschlagenden Nav-Test schreiben**

Create `src/config/nav.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { navItems } from "./nav";

/**
 * Die Ziel-Navigation aus Spec §2 — 6 + 5 + 1. Reihenfolge ist verbindlich: sie
 * erzählt die Reise (Compass → Academy → Events → Mitglieder → Aktivität).
 */
const ERWARTET = {
  entdecken: [
    ["/", "Start"],
    ["/compass", "Compass"],
    ["/academy", "Academy"],
    ["/events", "Events"],
    ["/mitglieder", "Mitglieder"],
    ["/aktivitaet", "Aktivität"],
  ],
  "mein-bereich": [
    ["/profil", "Mein Profil"],
    ["/meine-chancen", "Meine Chancen"],
    ["/meine-kurse", "Meine Kurse"],
    ["/meine-events", "Meine Events"],
    ["/kontakte", "Meine Kontakte"],
  ],
  service: [["/einstellungen", "Einstellungen"]],
} as const;

describe("Ziel-Navigation (Spec §2)", () => {
  for (const [section, erwartet] of Object.entries(ERWARTET)) {
    it(`hat unter „${section}" genau die vorgesehenen Einträge, in Reihenfolge`, () => {
      const ist = navItems
        .filter((i) => i.section === section)
        .map((i) => [i.path, i.label]);
      expect(ist).toEqual(erwartet.map((e) => [...e]));
    });
  }

  it("führt die gestrichenen Pfade nicht mehr", () => {
    const pfade = navItems.map((i) => i.path);
    for (const weg of ["/library", "/projekte", "/community", "/verzeichnis", "/matching", "/angebote-gesuche"]) {
      expect(pfade).not.toContain(weg);
    }
  });

  it("hält das Verzeichnis ab Discover — die Schranke bleibt, sie mauert nur statt wegzuleiten", () => {
    const mitglieder = navItems.find((i) => i.path === "/mitglieder");
    expect(mitglieder?.minTier).toBe("discover");
  });

  it("hält Meine Chancen ab Discover, auch nach dem Umzug in Mein Bereich", () => {
    const chancen = navItems.find((i) => i.path === "/meine-chancen");
    expect(chancen?.minTier).toBe("discover");
  });
});
```

- [ ] **Step 2: Test laufen lassen — er muss fehlschlagen**

Run: `pnpm vitest run src/config/nav.test.ts`
Expected: FAIL — die `entdecken`/`mein-bereich`/`service`-Fälle liefern `[]`, weil es die Sections noch nicht gibt; `/mitglieder` ist `undefined`.

- [ ] **Step 3: nav.ts auf die Ziel-Navigation umschreiben**

`src/config/nav.ts` vollständig ersetzen:

```ts
import type { ComponentType } from "react";
import type { MembershipLevel } from "./levels";
import AcademyPage from "../pages/AcademyPage";
import AktivitaetPage from "../pages/AktivitaetPage";
import ChatPage from "../pages/ChatPage";
import CompassPage from "../pages/CompassPage";
import HomeRedirect from "../components/HomeRedirect";
import EventsPage from "../pages/EventsPage";
import MeineChancenPage from "../pages/MeineChancenPage";
import MeineKursePage from "../pages/MeineKursePage";
import EinstellungenPage from "../pages/EinstellungenPage";
import KontaktePage from "../pages/KontaktePage";
import MeineEventsPage from "../pages/MeineEventsPage";
import MitgliederPage from "../pages/MitgliederPage";
import ProfilAnsichtPage from "../pages/ProfilAnsichtPage";
import ProfilPage from "../pages/ProfilPage";

/**
 * Sidebar-Abschnitt (AGE-314, Spec §2):
 * - `entdecken`    — das öffentliche Schaufenster; auch anon sichtbar.
 * - `mein-bereich` — persönliche Bereiche; setzen ein Konto voraus.
 * - `service`      — Konto-nahes.
 * - `sub`          — geroutet, aber KEIN Menüeintrag (z. B. Chat).
 */
export type NavSection = "entdecken" | "mein-bereich" | "service" | "sub";

export interface NavItem {
  path: string;
  label: string;
  Component: ComponentType;
  /** Gruppierung in der Sidebar. */
  section: NavSection;
  /** Mindest-Mitgliedsstufe. Löst in App.tsx die „Mitglied werden"-Wand aus. */
  minTier?: MembershipLevel;
  /** Route nur für eingeloggte Nutzer (ohne Stufen-Anforderung). */
  requiresAuth?: boolean;
}

/**
 * Routen innerhalb der AppShell. Einzige Quelle für Sidebar-Navigation und Routing.
 *
 * Alle Mitglieder sehen dieselbe Navigation (Spec §1) — Rechte gaten die Inhalte,
 * nicht das Menü. Anon sieht nur `entdecken` (Donald, 15.07.2026).
 *
 * Die Reihenfolge unter `entdecken` ist verbindlich und erzählt die Reise:
 * Compass (entdecke mich) → Academy (entwickle mich) → Events (treffe Menschen) →
 * Mitglieder (finde Passende) → Aktivität (hier lebt der Club).
 */
export const navItems: NavItem[] = [
  { path: "/", label: "Start", Component: HomeRedirect, section: "entdecken" },
  { path: "/compass", label: "Compass", Component: CompassPage, section: "entdecken", requiresAuth: true },
  { path: "/academy", label: "Academy", Component: AcademyPage, section: "entdecken", requiresAuth: true },
  { path: "/events", label: "Events", Component: EventsPage, section: "entdecken" },
  {
    path: "/mitglieder",
    label: "Mitglieder",
    Component: MitgliederPage,
    section: "entdecken",
    // §2: „vollständiges Mitgliederverzeichnis" ab `discover`. Darunter greift die
    // Wand; die RLS liefert ohnehin höchstens die eigene Zeile.
    minTier: "discover",
  },
  { path: "/aktivitaet", label: "Aktivität", Component: AktivitaetPage, section: "entdecken" },

  { path: "/profil", label: "Mein Profil", Component: ProfilAnsichtPage, section: "mein-bereich", requiresAuth: true },
  {
    path: "/meine-chancen",
    label: "Meine Chancen",
    Component: MeineChancenPage,
    section: "mein-bereich",
    // §2: „erweiterte Matchings" ab `discover`.
    minTier: "discover",
  },
  { path: "/meine-kurse", label: "Meine Kurse", Component: MeineKursePage, section: "mein-bereich", requiresAuth: true },
  { path: "/meine-events", label: "Meine Events", Component: MeineEventsPage, section: "mein-bereich", requiresAuth: true },
  { path: "/kontakte", label: "Meine Kontakte", Component: KontaktePage, section: "mein-bereich", requiresAuth: true },

  { path: "/einstellungen", label: "Einstellungen", Component: EinstellungenPage, section: "service", requiresAuth: true },

  // Unterbereiche: geroutet, kein Menüeintrag.
  { path: "/profil/bearbeiten", label: "Profil bearbeiten", Component: ProfilPage, section: "sub", requiresAuth: true },
  // Chat bewusst OHNE minTier (AGE-311): §2 stellt Nachrichten an akzeptierte Kontakte
  // allen ab `basic` frei. Die Schranke ist die Freigabe, nicht die Stufe — und sie
  // sitzt in der RLS (messages_insert verlangt eine akzeptierte contact_request).
  { path: "/chat", label: "Chat", Component: ChatPage, section: "sub", requiresAuth: true },
];
```

**Hinweis:** `publicAccess` entfällt ersatzlos — die Sichtbarkeit für Anon leitet sich jetzt aus `section === "entdecken"` ab (Design §4). Der bisherige `/`-Eintrag hatte `publicAccess: true`; das ist nun implizit.

- [ ] **Step 4: Die Gate-Regel korrigieren**

In `src/App.tsx` `gatedElement` ersetzen:

```tsx
function gatedElement(item: NavItem) {
  const element = <item.Component />;
  // minTier ⇒ Wand statt Wegleiten: das Format bleibt im Schaufenster sichtbar, der
  // Inhalt gesperrt (Spec §1). Bewusst VOR der Section-Prüfung: /meine-chancen liegt
  // seit AGE-314 unter „mein-bereich", soll aber weiter mauern statt wegzuleiten.
  if (item.minTier) return <MembershipGate min={item.minTier}>{element}</MembershipGate>;
  // requiresAuth: ENTDECKEN mauert (Schaufenster bleibt sichtbar), persönliche
  // Bereiche leiten zum Login — dort gibt es ohne Konto nichts zu zeigen.
  if (item.requiresAuth) {
    return item.section === "entdecken" ? (
      <MembershipGate>{element}</MembershipGate>
    ) : (
      <RequireAuth>{element}</RequireAuth>
    );
  }
  return element;
}
```

Den jetzt ungenutzten Import `RequireTier` aus `src/App.tsx` entfernen (Zeile 9).

- [ ] **Step 5: Die restlichen Redirects setzen**

In `src/App.tsx` zu den Redirects aus Task 3/4 ergänzen:

```tsx
          <Route path="/community" element={<Navigate to="/aktivitaet" replace />} />
          <Route path="/verzeichnis" element={<Navigate to="/mitglieder" replace />} />
```

- [ ] **Step 6: Die Sidebar auf drei Abschnitte umstellen**

In `src/components/AppShell.tsx` den Import `MeinBereichNav` entfernen, `NavSection` importieren und über der `SidebarContent`-Funktion ergänzen:

```tsx
/** Reihenfolge und Titel der Sidebar-Abschnitte (Spec §2). `sub` erscheint nie. */
const SIDEBAR_SECTIONS: Array<{ section: NavSection; title: string }> = [
  { section: "entdecken", title: "Entdecken" },
  { section: "mein-bereich", title: "Mein Bereich" },
  { section: "service", title: "Service" },
];
```

Dann in `SidebarContent` den Filter und das Rendering ersetzen:

```tsx
  const { user, tier } = useAuth();
  // Alle Mitglieder sehen dieselbe Navigation (Spec §1) — Rechte gaten die Inhalte
  // (MembershipGate), nicht das Menü. Anon sieht nur „Entdecken": „Meine Kontakte"
  // ohne Konto wäre ein Versprechen ins Leere.
  const sections = SIDEBAR_SECTIONS.filter(
    ({ section }) => user || section === "entdecken",
  ).map(({ section, title }) => ({
    title,
    items: navItems.filter((i) => i.section === section),
  }));
```

Und weiter unten:

```tsx
// vorher
      <SidebarNav sections={[{ items: visible }]} onNavigate={onNavigate} />
      {user && <MeinBereichNav onNavigate={onNavigate} />}
// nachher
      <SidebarNav sections={sections} onNavigate={onNavigate} />
```

- [ ] **Step 7: Die Hero-Einträge der gelöschten Formate abräumen**

In `src/config/formatHero.ts` die Zeilen `/library`, `/projekte` und `/community` entfernen. Ergebnis:

```ts
export const FORMAT_HERO: Record<string, FormatHeroMeta> = {
  "/compass": { title: "Kompass", claim: "Finde deine Richtung im Club." },
  "/academy": { title: "Academy", claim: "Lernen von den Besten." },
  "/events": { title: "Events", claim: "Triff den Club in echt." },
  "/mitglieder": { title: "Mitglieder", claim: "Finde die Passenden." },
  "/aktivitaet": { title: "Aktivität", claim: "Hier lebt der Club." },
  "/meine-chancen": { title: "Meine Chancen", claim: "Suche trifft Biete." },
};
```

- [ ] **Step 8: Den Nav-Test laufen lassen — er muss jetzt durchlaufen**

Run: `pnpm vitest run src/config/nav.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 9: Den Anon-Test auf die neue Zusage umschreiben**

`App.test.tsx` behauptet heute „Anon sieht Community, nicht Matching". Neue Zusage: Anon sieht alle sechs ENTDECKEN-Einträge und keinen persönlichen.

In `src/App.test.tsx` den ersten Test ersetzen (ab Zeile ~24):

```tsx
    // Anon sieht das ganze Schaufenster: alle sechs „Entdecken"-Einträge, unabhängig
    // davon, ob der Inhalt gegatet ist (Spec §1 — Rechte gaten Inhalte, nicht das Menü).
    for (const label of ["Start", "Compass", "Academy", "Events", "Mitglieder", "Aktivität"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    // „Mein Bereich"/„Service" setzen ein Konto voraus und bleiben für Anon aus.
    for (const label of ["Mein Profil", "Meine Chancen", "Meine Kurse", "Einstellungen"]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
    // / rendert die öffentliche Startseite.
    expect(
      screen.getByRole("heading", { name: "Willkommen im Fair Business Club" }),
    ).toBeInTheDocument();
```

- [ ] **Step 10: Die vier Verzeichnis-Gate-Tests übersetzen**

`RequireTier.test.tsx` prüft heute, dass `/verzeichnis` zu niedrige Stufen **wegleitet**. Nach Step 4 gibt es dieses Verhalten nicht mehr — die Fälle sind ab jetzt rot. Sie werden **nicht gelöscht, sondern übersetzt**: die Zusage dahinter bleibt wortwörtlich dieselbe — **keine Mitgliederdaten unterhalb von `discover`** — nur mauert sie jetzt, statt wegzuleiten (Design §7).

Das passiert hier und nicht später, damit die Gate-Änderung im selben Commit liegt wie ihr Beweis.

In `src/components/MembershipGate.test.tsx` die Helferfunktion aus `RequireTier.test.tsx:14-21` übernehmen (falls noch nicht vorhanden) und sicherstellen, dass `fakeAuthValue` und `AuthContextValue` importiert sind:

```tsx
/** Eingeloggt, aber tier/level_rank werden noch geladen (Profil-Fetch offen). */
function authLoadingTier(): AuthContextValue {
  return fakeAuthValue({
    user: { id: "test-user" } as AuthContextValue["user"],
    tier: null,
    levelRank: null,
    tierLoading: true,
  });
}
```

Dann den übersetzten Block ergänzen:

```tsx
/**
 * Übersetzt aus RequireTier.test.tsx (AGE-314). Das Verzeichnis lag bis dahin unter
 * /verzeichnis und leitete zu niedrige Stufen weg. Als Top-Level-Eintrag „Mitglieder"
 * mauert es stattdessen (Spec §1) — die Zusage ist dieselbe, nur die Einlösung ist neu.
 */
describe("Stufen-Gating für /mitglieder (min Discover)", () => {
  it("zeigt Basic die Wand statt Mitgliederdaten", () => {
    renderAt("/mitglieder", authAsTier("basic"));

    expect(
      screen.getByRole("heading", { name: "Dieser Bereich ist ab Discover verfügbar" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Verzeichnis" })).not.toBeInTheDocument();
  });

  it("lässt Discover das Verzeichnis sehen", () => {
    renderAt("/mitglieder", authAsTier("discover"));

    expect(screen.getByRole("heading", { name: "Verzeichnis" })).toBeInTheDocument();
  });

  it("lässt Impact (höhere Stufe) das Verzeichnis sehen", () => {
    renderAt("/mitglieder", authAsTier("impact"));

    expect(screen.getByRole("heading", { name: "Verzeichnis" })).toBeInTheDocument();
  });

  // Achtung: Titel bewusst ohne typografische Anführungszeichen um „Mitglied werden".
  // Ein öffnendes „ mit schließendem ASCII-" beendet das String-Literal vorzeitig (TS1002).
  it("zeigt anonymen Besuchern die Wand mit Mitglied-werden-Button — kein Verzeichnis", () => {
    renderAt("/mitglieder", fakeAuthValue());

    expect(screen.getByRole("button", { name: "Mitglied werden" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Verzeichnis" })).not.toBeInTheDocument();
  });

  it("rendert nichts, solange die Stufe noch lädt — kein Aufblitzen der Wand", () => {
    renderAt("/mitglieder", authLoadingTier());

    expect(
      screen.queryByRole("heading", { name: "Dieser Bereich ist ab Discover verfügbar" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Verzeichnis" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 11: Die übersetzten Fälle aus RequireTier.test.tsx entfernen**

In `src/components/RequireTier.test.tsx` die beiden `describe`-Blöcke `Stufen-Gating für /verzeichnis (min Discover)` (Zeilen ~41–74) und `Stufen-Gating wartet auf das Laden der Stufe` (Zeilen ~120–129) **löschen** — sie leben ab jetzt in `MembershipGate.test.tsx`.

Die Blöcke `Auth-Gating für /mein-bereich` und `Auth-Gating für /profil` bleiben unverändert: sie prüfen `RequireAuth`, nicht `RequireTier`. Den `markSkipped`-Import entfernen, falls er durch die Löschung ungenutzt wird. Die Datei wird in Task 6 passend umbenannt.

- [ ] **Step 12: Tests + Typecheck laufen lassen — alles muss grün sein**

Run: `pnpm typecheck && pnpm test`
Expected: **PASS, ohne Ausnahme.** Insbesondere `nav.test.ts` (5), `App.test.tsx`, `MembershipGate.test.tsx` (inkl. der fünf übersetzten `/mitglieder`-Fälle) und `RequireTier.test.tsx` (nur noch Auth-Fälle).

`meinBereich.test.ts` bleibt grün: sie prüft `MEIN_BEREICH_NODES` isoliert, und die Config existiert bis Task 6 weiter.

- [ ] **Step 13: Committen**

```bash
git add -A
git commit -m "feat(nav): Nav-Gerüst auf 6+5+1, minTier mauert statt wegzuleiten (AGE-314)"
```

---

### Task 6: Waisen abräumen, Tests übersetzen, Links nachziehen

Räumt ab, was die Tasks 1–5 zu Waisen gemacht haben. Die Test-Übersetzung ist bereits in Task 5 passiert (dort liegt die Gate-Änderung, die sie beweist) — hier bleibt Löschen und Links nachziehen.

**Files:**
- Delete: `src/pages/CommunityPage.tsx`, `src/pages/LibraryPage.tsx`, `src/pages/ProjektePage.tsx`, `src/pages/VerzeichnisPage.tsx`, `src/config/meinBereich.ts`, `src/config/meinBereich.test.ts`, `src/components/ui/MeinBereichNav.tsx`, `src/components/RequireTier.tsx`
- Rename: `src/components/RequireTier.test.tsx` → `src/components/RequireAuth.test.tsx`
- Modify: `src/components/AppShell.tsx`, `src/components/mein-bereich/profil-widgets.tsx`, `src/pages/HomePage.tsx`, `docs/demo-script.md`

**Interfaces:**
- Consumes: alles aus Tasks 1–5.
- Produces: keine neuen Schnittstellen.

**Warum diese acht Dateien Waisen sind** (jede einzeln geprüft, nicht geraten):

| Datei | Letzter Aufrufer entfiel in |
|---|---|
| `CommunityPage.tsx` | Task 5 (aus `navItems` entfernt; Feed lebt in `AktivitaetPage`) |
| `LibraryPage.tsx`, `ProjektePage.tsx` | Task 5 (leere Stubs, ersatzlos gestrichen — Design §5) |
| `VerzeichnisPage.tsx` | Task 5 (`MitgliederPage` mountet `MemberDirectory` direkt) |
| `RequireTier.tsx` | Task 5 Step 4 — `App.tsx:30` war der einzige Aufrufer |
| `meinBereich.ts`, `meinBereich.test.ts`, `MeinBereichNav.tsx` | Task 5 Step 6 — zweite Nav-Quelle, MEIN BEREICH kommt jetzt aus `navItems` |

- [ ] **Step 1: RequireTier.test.tsx umbenennen**

Die Datei enthält nach Task 5 nur noch `RequireAuth`-Fälle (`/profil`, `/mein-bereich`) — die `/verzeichnis`-Fälle sind dort bereits nach `MembershipGate.test.tsx` übersetzt worden. Der Name passt nicht mehr zum Inhalt, und die Komponente, nach der sie heißt, wird in Step 2 gelöscht:

```bash
git mv src/components/RequireTier.test.tsx src/components/RequireAuth.test.tsx
```

- [ ] **Step 2: Die Waisen löschen**

```bash
git rm src/pages/CommunityPage.tsx src/pages/LibraryPage.tsx \
       src/pages/ProjektePage.tsx src/pages/VerzeichnisPage.tsx \
       src/config/meinBereich.ts src/config/meinBereich.test.ts \
       src/components/ui/MeinBereichNav.tsx src/components/RequireTier.tsx
```

`src/components/ui/index.ts` re-exportiert `MeinBereichNav` **nicht** (geprüft: nur
`SidebarNav` in Zeile 10) — dort ist nichts zu tun.

- [ ] **Step 3: Die letzten Links nachziehen**

`src/components/AppShell.tsx:19`:

```tsx
// vorher (nach Task 3)
const WIDE_ROUTES = ["/profil", "/kontakte", "/verzeichnis", "/meine-chancen"];
// nachher
const WIDE_ROUTES = ["/profil", "/kontakte", "/mitglieder", "/meine-chancen"];
```

`src/components/mein-bereich/profil-widgets.tsx:248`:

```tsx
// vorher
      action={<CardLink to="/community">Alle anzeigen</CardLink>}
// nachher
      action={<CardLink to="/aktivitaet">Alle anzeigen</CardLink>}
```

`src/components/mein-bereich/kontakte-widgets.tsx:198` — der Editor ist seit Task 4 ein Compass-Tab, der Link lebt sonst nur vom Redirect:

```tsx
// vorher
          <CardLink to="/angebote-gesuche">Bearbeiten</CardLink>
// nachher
          <CardLink to="/compass">Bearbeiten</CardLink>
```

`src/pages/HomePage.tsx:93-97`:

```tsx
// vorher
        <SectionHeader title="Neue öffentliche Beiträge" to="/community" linkLabel="Zur Community" />
// nachher
        <SectionHeader title="Neue öffentliche Beiträge" to="/aktivitaet" linkLabel="Zur Aktivität" />
```

`docs/demo-script.md`: `/verzeichnis` → `/mitglieder`, „Verzeichnis" → „Mitglieder" wo es die Seite meint.

- [ ] **Step 4: Beweisen, dass keine alten Pfade mehr im Code stehen**

```bash
grep -rn '"/community"\|"/verzeichnis"\|"/matching"\|"/angebote-gesuche"\|"/library"\|"/projekte"' src/
```

Expected: **nur** die vier `<Route path=…>`-Redirect-Zeilen in `src/App.tsx`. Jeder andere Treffer ist ein vergessener Link.

- [ ] **Step 5: Vollen Testlauf + Typecheck + Lint**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: alles PASS, keine ungenutzten Imports.

- [ ] **Step 6: Committen**

**Kein `git add -A`.** Der Arbeitsbaum enthält untracked Dateien, die nicht ins Repo gehören — darunter `docs/data-model.md` und `docs/rls-policies.md` (Dateirechte `0600`), `.planning/` und ein modifiziertes `session-handoff.md`. **`agenticapps-eu/fbc-platform` ist öffentlich**; ein `-A` würde sie dort veröffentlichen. Stage ausschließlich die Dateien dieses Tasks:

```bash
git add -u src/pages src/config src/components docs/demo-script.md
git status --short   # prüfen: NICHTS aus .planning/, kein data-model.md, kein session-handoff.md
git commit -m "refactor(nav): Waisen entfernen, Verzeichnis-Gate-Tests übersetzen (AGE-314)"
```

`git add -u` nimmt nur bereits versionierte Dateien (inkl. Löschungen und Umbenennungen aus Step 1-2) und fasst Untracked nicht an. Prüfe die `git status`-Ausgabe, bevor du committest.

---

### Task 7: Visuelle Abnahme im Browser

Es sind ausschließlich TSX-Änderungen — der Dev-Server ist Pflicht, nicht Kür (Workflow-Gate).

> **⚠️ `pnpm dev` läuft gegen die Live-Datenbank.** Das Script ist
> `infisical run --env=dev -- vite`, und `env=dev` teilt sich die Supabase-Instanz mit
> Prod. Diese Abnahme ist deshalb **nur zum Anschauen**: keine Beiträge erstellen, keine
> Kontaktanfragen stellen, keine Registrierungen, nichts löschen. Navigieren, schauen,
> Screenshot — sonst nichts.

- [ ] **Step 1: Dev-Server starten**

```bash
pnpm dev
```

- [ ] **Step 2: Je Seite einen Screenshot ziehen**

Mit `/browse`, eingeloggt als Mitglied auf `exchange`:

`/` · `/compass` (beide Tabs) · `/academy` · `/events` · `/mitglieder` · `/aktivitaet` · `/profil` · `/meine-chancen` · `/meine-kurse` · `/meine-events` · `/kontakte` · `/einstellungen`

Prüfen: drei betitelte Abschnitte in der Sidebar, genau ein aktiver Eintrag pro Seite, keine leeren Bereiche.

- [ ] **Step 3: Die Sichtbarkeitsgrenzen im Browser prüfen**

| Fall | Erwartung |
|---|---|
| Ausgeloggt auf `/` | Sidebar zeigt nur „Entdecken" mit sechs Einträgen |
| Ausgeloggt auf `/mitglieder` | Wand mit „Mitglied werden", **keine** Mitgliederdaten |
| `basic` auf `/mitglieder` | Wand „ab Discover verfügbar", **keine** Mitgliederdaten |
| `basic` auf `/meine-chancen` | Wand, kein stilles Wegleiten |
| Alte URL `/community` | landet auf `/aktivitaet` |
| Alte URL `/verzeichnis` | landet auf `/mitglieder` |
| Alte URL `/matching` | landet auf `/meine-chancen` |
| Alte URL `/angebote-gesuche` | landet auf `/compass` |

- [ ] **Step 4: Screenshots im PR referenzieren**

Ablage unter `.planning/qa-screens/age-314/`.

---

## Self-Review

**Spec-Abdeckung (Schritt 1+2):**

| Spec-Anforderung | Task |
|---|---|
| §2 Nav auf 6+5+1 | Task 5 (`nav.test.ts` beweist es) |
| §1 Alle sehen dieselbe Navigation | Task 5 (Gate-Regel + Sidebar-Filter) |
| §3 Community → Mitglieder + Aktivität | Tasks 1, 5, 6 |
| §3 Mitglieder ohne Beiträge | Task 1 (Test prüft: Verzeichnis, kein Feed) |
| §3 Biete & Suche in Compass | Task 4 |
| §3 Matching → Meine Chancen | Task 3 |
| §5 Feed nicht neu bauen | Tasks 1, 6 (`CommunityFeed` unverändert gemountet) |
| §5 Keine Legacy/Circle/Prime-Stufen | Global Constraints; `DirectoryUpsell` mit „Prime" wird in Task 6 gelöscht |
| §4 Events für alle sichtbar | unverändert — `/events` bleibt ohne `minTier` |

**Nicht abgedeckt, bewusst:** Spec §6 Schritt 3 und 4, die inhaltliche Kürzung von Meine Chancen, Design-Variante H/I fixieren. Alle in Design §9 als out-of-scope festgehalten.

**Typ-Konsistenz geprüft:** `NavSection` (Task 5) wird in `AppShell` (Task 5) und `nav.test.ts` (Task 5) identisch verwendet. `AngeboteGesucheEditor` (Task 4 Step 1 erzeugt, Step 4 konsumiert). `MeineChancenPage` (Task 3 erzeugt, Task 5 importiert). `FORMAT_HERO`-Keys folgen durchgehend den `navItems`-Pfaden — geprüft gegen `MembershipGate.tsx:33`, das nach `pathname` schlägt.

**Reihenfolge-Abhängigkeit:** Tasks 1–4 sind untereinander unabhängig und je für sich grün. Task 5 braucht 1–4. Task 6 braucht 5. Task 7 braucht 6.
