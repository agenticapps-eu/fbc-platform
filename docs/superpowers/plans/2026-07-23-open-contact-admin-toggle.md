# open_contact Admin Toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any logged-in member send contact requests during events, via an admin-flippable `open_contact` flag, and stop the raw RLS error from leaking to users.

**Architecture:** A new singleton `platform_settings` table holds one boolean `open_contact`. A `SECURITY DEFINER` helper `is_contact_open()` exposes it to the `contact_requests` insert policy, which now drops the level gate *and* the Welpenschutz when the flag is on (all AGE-247 safety rails stay). The frontend reads the flag to decide whether to show the composer, maps RLS denials to a friendly message, and gets a new admin-only `/admin` page whose first setting is the toggle.

**Tech Stack:** Supabase Postgres + RLS (pgTAP tests via `supabase test db`), React + TypeScript (strict), @tanstack/react-query, Vitest + @testing-library/react.

## Global Constraints

- TypeScript strict; pnpm; Conventional Commits; every commit references `AGE-455`.
- Never `git add -A` — stage named files only (repo is public; untracked 0600 files exist).
- New tables inherit **no** grants — grants must be spoken explicitly (AGE-312).
- `src/lib/database.types.ts` is hand-maintained (no gen script); new tables must be added there by hand or `supabase.from(...)` won't typecheck.
- RLS is the security boundary; all frontend gating is convenience only.
- Membership ranks: `basic=1 connect=2 discover=3 exchange=4 focus=5 impact=6`.
- Migration head-comments carry the decision + discarded alternative, signed/dated.
- pgTAP traps: use `alike()` not `like()`; `try_as()` reports every failure as `DENIED:<err>`; bump `plan(N)` when adding assertions.

---

### Task 1: Migration — `platform_settings`, helper, policy rewrite + RLS tests

**Files:**
- Create: `supabase/migrations/20260723120000_open_contact_toggle.sql`
- Modify: `supabase/tests/rls_test.sql` (add closed-mode guard + open-mode + admin-write assertions; bump `plan`)

**Interfaces:**
- Produces (SQL, referenced by later frontend tasks): table `public.platform_settings(id boolean, open_contact boolean, updated_at timestamptz, updated_by uuid)`; function `public.is_contact_open() returns boolean`; policy `cr_insert_self` replacing `cr_insert_self_exchange`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260723120000_open_contact_toggle.sql`:

```sql
-- Kontaktanfragen fürs Sommerfest freischaltbar machen (AGE-455).
--
-- Problem: frische Anmeldungen sind `basic` (rank 1); die einzige Insert-Policy auf
-- contact_requests (cr_insert_self_exchange, 20260715150000) verlangt has_level(4)=
-- exchange, und der Welpenschutz (§2) sperrt zusätzlich Kaltanfragen an <30-Tage-
-- Mitglieder. Im Sommerfest-Workshop sind ALLE Mitglieder frisch und basic → niemand
-- kann jemanden anschreiben. Ein Backdaten der Seed-Daten hilft nicht (Live-Signups
-- bekommen ein frisches created_at).
--
-- Entscheidung (AGE-455, Donald 23.07.): ein admin-schaltbarer Flag `open_contact`
-- öffnet für Events BEIDE Hürden. Verworfene Alternative: die Gates hart im Code
-- entfernen — dann wäre das Zurückschalten nach dem Event ein Deploy statt eines
-- Admin-Klicks. Der Flag lässt from_id=self, status=pending, match_id-Zugehörigkeit
-- (AGE-247) und das Empfänger-Opt-out (is_contactable) in JEDEM Modus unangetastet —
-- geöffnet werden NUR Level-Gate und Welpenschutz.

-- ── 1. Singleton-Settings-Tabelle ───────────────────────────────────────────
create table public.platform_settings (
  id           boolean primary key default true check (id),  -- erzwingt genau EINE Zeile
  open_contact boolean not null default true,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles (id)
);
comment on table public.platform_settings is
  'Plattformweite Einstellungen (Singleton, id=true). Erste Einstellung: open_contact '
  '(AGE-455). Admin-schaltbar über /admin; RLS: alle lesen, nur is_admin() schreibt.';

-- Seed: fürs Sommerfest offen.
insert into public.platform_settings (id, open_contact) values (true, true);

alter table public.platform_settings enable row level security;

-- Grants müssen ausgesprochen werden — neue Tabellen erben nichts (AGE-312).
grant select on public.platform_settings to authenticated;
grant update (open_contact) on public.platform_settings to authenticated;

-- Jeder Eingeloggte liest den Flag (treibt UI + Policy). Kein anon: der Kontakt-Flow
-- ist authenticated-only.
create policy platform_settings_select on public.platform_settings
  for select to authenticated
  using ( true );

-- Schreiben nur Admins. is_admin() ist server-kontrolliert (staff_roles), nicht die
-- frei editierbare profiles.roles.
create policy platform_settings_update_admin on public.platform_settings
  for update to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- updated_at/updated_by setzt der Server, nie der Client (der hat nur update(open_contact)).
create or replace function public.platform_settings_touch() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;
revoke execute on function public.platform_settings_touch() from public, anon, authenticated;

create trigger platform_settings_touch
  before update on public.platform_settings
  for each row execute function public.platform_settings_touch();

-- ── 2. Helper: is_contact_open() ────────────────────────────────────────────
-- STABLE SECURITY DEFINER wie has_level()/is_contactable(): hält die Policy schlank
-- und die Tabelle abschließbar. Gibt nur ein Boolean zurück.
create or replace function public.is_contact_open() returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce((select open_contact from public.platform_settings where id), false);
$$;
comment on function public.is_contact_open() is
  'True, wenn plattformweit Kontaktanfragen für alle freigeschaltet sind (AGE-455). '
  'Öffnet in der contact_requests-Insert-Policy Level-Gate UND Welpenschutz.';
revoke execute on function public.is_contact_open() from public, anon;
grant execute on function public.is_contact_open() to authenticated;

-- ── 3. Insert-Policy: Flag öffnet Level-Gate + Welpenschutz ─────────────────
drop policy if exists cr_insert_self_exchange on public.contact_requests;
create policy cr_insert_self on public.contact_requests
  for insert to authenticated
  with check (
    from_id = (select auth.uid())
    and status = 'pending'
    and public.is_contactable(to_id)
    and ( public.is_contact_open() or public.has_level(4) )
    and (
      match_id is null
      or exists (
        select 1 from public.matches m
        where m.id = match_id
          and (
            (m.a_profile_id = from_id and m.b_profile_id = to_id) or
            (m.a_profile_id = to_id and m.b_profile_id = from_id)
          )
      )
    )
    and ( public.is_contact_open() or match_id is not null or not public.is_new_member(to_id) )
  );
comment on policy cr_insert_self on public.contact_requests is
  'AGE-455/§2: Kontaktanfrage — from_id=self, nur pending, match_id gehört zum Paar, '
  'Empfänger-Opt-out erzwungen. Level-Gate (exchange) UND Welpenschutz gelten NUR, '
  'solange is_contact_open() false ist; der Admin-Flag öffnet beide fürs Event.';
```

- [ ] **Step 2: Guard the existing closed-mode assertions in `rls_test.sql`**

The migration seeds `open_contact = true`, which would flip the existing section-4/5/6 gate assertions. Force the flag off so they keep testing the closed (§2) behavior. In `supabase/tests/rls_test.sql`, immediately **before** the line `-- ── 4. Kontaktanfragen — ab \`exchange\` (rank 4) ──`, insert:

```sql
-- open_contact steuert, ob Level-Gate + Welpenschutz gelten (AGE-455). Die Gate-Tests
-- in Abschnitt 4–6 prüfen den GESCHLOSSENEN Modus (§2-Default); der Migrations-Seed
-- steht auf true (Sommerfest), daher hier explizit aus.
update public.platform_settings set open_contact = false;
```

- [ ] **Step 3: Add open-mode + admin-write assertions**

In `supabase/tests/rls_test.sql`, immediately **after** the section-6 opt-out block (after the assertion labelled `'Wer Kontaktanfragen abgeschaltet hat, bekommt keine (Opt-out wird erzwungen)'`), insert:

```sql
-- ── 6b. open_contact öffnet BEIDE Gates (AGE-455) ───────────────────────────
-- Mit dem Flag darf jedes eingeloggte Mitglied jeden anschreiben — Level-Gate und
-- Welpenschutz offen. Das Empfänger-Opt-out bleibt in JEDEM Modus erzwungen.
update public.platform_settings set open_contact = true;

-- Basic (rank 1) an ein FRISCHES Mitglied (7777) OHNE Match: geschlossen doppelt
-- verboten (Level + Welpenschutz), offen erlaubt → belegt, dass beide Gates fallen.
select is(
  pg_temp.try_as('11111111-1111-1111-1111-111111111111',
    'insert into public.contact_requests (from_id, to_id) values (''11111111-1111-1111-1111-111111111111'', ''77777777-7777-7777-7777-777777777777'')'),
  'OK', 'open_contact: Basic darf ein neues Mitglied kalt anschreiben (Level + Welpenschutz offen)');

-- Das Opt-out (8888) bleibt auch im offenen Modus geschützt.
select alike(
  pg_temp.try_as('11111111-1111-1111-1111-111111111111',
    'insert into public.contact_requests (from_id, to_id) values (''11111111-1111-1111-1111-111111111111'', ''88888888-8888-8888-8888-888888888888'')'),
  'DENIED:%', 'open_contact: das Empfänger-Opt-out bleibt erzwungen');

-- ── 6c. platform_settings ist admin-schaltbar (AGE-455) ─────────────────────
update public.platform_settings set open_contact = false;  -- Ausgangswert (Superuser)

-- Nicht-Admin: das UPDATE läuft (Spalten-Grant) und wirft nicht, trifft unter RLS
-- aber 0 Zeilen (using = is_admin() = false) und ändert deshalb nichts.
select is(
  pg_temp.try_as('11111111-1111-1111-1111-111111111111',
    'update public.platform_settings set open_contact = true where id'),
  'OK', 'Nicht-Admin-UPDATE wirft nicht (RLS filtert die Zeile weg)');
select is(
  (select open_contact from public.platform_settings where id),
  false, '… ändert den Flag aber nicht');

-- Admin darf schreiben.
select is(
  pg_temp.try_as('aaaaaaaa-0000-0000-0000-000000000001',
    'update public.platform_settings set open_contact = true where id'),
  'OK', 'Admin darf platform_settings schreiben');
select is(
  (select open_contact from public.platform_settings where id),
  true, 'Admin schaltet open_contact frei');
```

- [ ] **Step 4: Bump the pgTAP plan count**

In `supabase/tests/rls_test.sql`, change `select plan(55);` to `select plan(61);` (6 new assertions: 2 in 6b, 4 in 6c).

- [ ] **Step 5: Run the migration + RLS suite (red→green)**

Run: `supabase start -x studio,imgproxy,edge-runtime,logflare,vector && supabase db reset && supabase test db supabase/tests/grants_test.sql supabase/tests/rls_test.sql`
Expected: all migrations apply cleanly; pgTAP reports `ok` for all 61 assertions including the four new AGE-455 lines. (If `supabase start` is already running, `supabase db reset` + `supabase test db …` alone suffice.)

Note: if step 3's open-mode assertion `'Basic darf ein neues Mitglied kalt anschreiben'` reports `DENIED:%` instead of `OK`, the policy in step 1 did not open a gate — re-check the two `is_contact_open()` clauses.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260723120000_open_contact_toggle.sql supabase/tests/rls_test.sql
git commit -m "feat(db): open_contact platform toggle opens contact gates (AGE-455)"
```

---

### Task 2: Frontend data layer — `platform-settings.ts` + types

**Files:**
- Create: `src/lib/platform-settings.ts`
- Create: `src/lib/platform-settings.test.ts`
- Modify: `src/lib/database.types.ts` (add `platform_settings` table type)

**Interfaces:**
- Consumes: `supabase` client from `./supabase`; the `platform_settings` table type added to `database.types.ts`.
- Produces: `interface PlatformSettings { openContact: boolean }`; `DEFAULT_PLATFORM_SETTINGS`; `platformSettingsQueryKey`; `platformSettingsFromRow(row)`; `fetchPlatformSettings(): Promise<PlatformSettings>`; `updateOpenContact(next: boolean): Promise<void>`.

- [ ] **Step 1: Add the table type to `database.types.ts`**

In `src/lib/database.types.ts`, inside `public.Tables`, immediately after the closing `};` of the `member_settings:` block (the one just before `membership_tiers:`), insert (object key order is cosmetic for TS):

```ts
      platform_settings: {
        Row: {
          id: boolean;
          open_contact: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: boolean;
          open_contact?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: boolean;
          open_contact?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
```

- [ ] **Step 2: Write the failing lib test**

Create `src/lib/platform-settings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_PLATFORM_SETTINGS, platformSettingsFromRow } from "./platform-settings";

describe("platformSettingsFromRow", () => {
  it("liest open_contact aus der Zeile", () => {
    expect(platformSettingsFromRow({ open_contact: true })).toEqual({ openContact: true });
    expect(platformSettingsFromRow({ open_contact: false })).toEqual({ openContact: false });
  });

  it("fällt ohne Zeile auf den sicheren Default (geschlossen) zurück", () => {
    expect(platformSettingsFromRow(null)).toEqual(DEFAULT_PLATFORM_SETTINGS);
    expect(DEFAULT_PLATFORM_SETTINGS.openContact).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test -- src/lib/platform-settings.test.ts`
Expected: FAIL — cannot resolve `./platform-settings`.

- [ ] **Step 4: Write the lib**

Create `src/lib/platform-settings.ts`:

```ts
import { supabase } from "./supabase";

/** Plattformweite Einstellungen (Singleton-Tabelle platform_settings, AGE-455). */
export interface PlatformSettings {
  /** Wenn true: jedes eingeloggte Mitglied darf jedem eine Kontaktanfrage senden. */
  openContact: boolean;
}

/** Sicherer Default: geschlossen. Ein Lesefehler soll die UI NICHT öffnen — die RLS
 *  ist ohnehin die echte Grenze. */
export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = { openContact: false };

export const platformSettingsQueryKey = ["platform-settings"] as const;

/** Reine Abbildung Zeile → Settings, damit sie ohne DB testbar ist. */
export function platformSettingsFromRow(
  row: { open_contact: boolean } | null,
): PlatformSettings {
  return { openContact: row?.open_contact ?? DEFAULT_PLATFORM_SETTINGS.openContact };
}

/** Lädt den plattformweiten Flag. Alle Eingeloggten dürfen lesen (RLS). */
export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabase
    .from("platform_settings")
    .select("open_contact")
    .maybeSingle();
  if (error) throw error;
  return platformSettingsFromRow(data);
}

/** Schaltet den Flag. RLS erzwingt is_admin(); der Client hat nur update(open_contact). */
export async function updateOpenContact(next: boolean): Promise<void> {
  const { error } = await supabase
    .from("platform_settings")
    .update({ open_contact: next })
    .eq("id", true);
  if (error) throw error;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test -- src/lib/platform-settings.test.ts`
Expected: PASS (both cases).

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: no errors (confirms the `database.types.ts` block makes `supabase.from("platform_settings")` typecheck).

- [ ] **Step 7: Commit**

```bash
git add src/lib/platform-settings.ts src/lib/platform-settings.test.ts src/lib/database.types.ts
git commit -m "feat(lib): platform-settings data layer for open_contact (AGE-455)"
```

---

### Task 3: PublicProfilePage — flag-driven gating + friendly RLS error

**Files:**
- Modify: `src/pages/PublicProfilePage.tsx`
- Modify: `src/pages/PublicProfilePage.test.tsx`

**Interfaces:**
- Consumes: `fetchPlatformSettings`, `platformSettingsQueryKey` from Task 2; existing `LEVEL_RANK`, `useAuth`, `useToast`.

- [ ] **Step 1: Add failing tests**

In `src/pages/PublicProfilePage.test.tsx`:

(a) Extend the `contact-requests` mock (near the top) to also mock the sender, and add a `platform-settings` mock. Replace the existing block:

```ts
vi.mock("../lib/contact-requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/contact-requests")>();
  return { ...actual, fetchContactRelation: vi.fn() };
});
```

with:

```ts
vi.mock("../lib/contact-requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/contact-requests")>();
  return { ...actual, fetchContactRelation: vi.fn(), sendContactRequest: vi.fn() };
});
vi.mock("../lib/platform-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/platform-settings")>();
  return { ...actual, fetchPlatformSettings: vi.fn() };
});
```

(b) Update the imports and mock handles. Replace:

```ts
import { fetchContactRelation, type ContactRelation } from "../lib/contact-requests";
```

with:

```ts
import {
  fetchContactRelation,
  sendContactRequest,
  type ContactRelation,
} from "../lib/contact-requests";
import { fetchPlatformSettings } from "../lib/platform-settings";
```

and add after `const mockedRelation = vi.mocked(fetchContactRelation);`:

```ts
const mockedSend = vi.mocked(sendContactRequest);
const mockedPlatform = vi.mocked(fetchPlatformSettings);
```

Also add `fireEvent` to the testing-library import:

```ts
import { fireEvent, render, screen } from "@testing-library/react";
```

(c) In `beforeEach`, default the flag to closed so existing assertions hold:

```ts
beforeEach(() => {
  mockedFetch.mockReset();
  mockedRelation.mockReset();
  mockedRelation.mockResolvedValue(NO_RELATION);
  mockedSend.mockReset();
  mockedPlatform.mockReset();
  mockedPlatform.mockResolvedValue({ openContact: false });
});
```

(d) Add two tests inside the `describe("Öffentliche Profilseite (AGE-239)", …)` block:

```ts
  it("zeigt bei open_contact auch Basic den Kontaktanfrage-Button (AGE-455)", async () => {
    mockedFetch.mockResolvedValue(fullView);
    mockedPlatform.mockResolvedValue({ openContact: true });
    renderPage(authAsTier("basic"));

    expect(
      await screen.findByRole("button", { name: "Kontaktanfrage senden" }),
    ).toBeInTheDocument();
  });

  it("zeigt bei RLS-Ablehnung (42501) eine freundliche Meldung, nicht den rohen Fehler (AGE-455)", async () => {
    mockedFetch.mockResolvedValue(fullView);
    mockedSend.mockRejectedValue({
      code: "42501",
      message: 'new row violates row-level security policy for table "contact_requests"',
    });
    renderPage(authAsTier("exchange"));

    fireEvent.click(await screen.findByRole("button", { name: "Kontaktanfrage senden" }));
    fireEvent.click(await screen.findByRole("button", { name: "Anfrage senden" }));

    expect(
      await screen.findByText(/nur über ein gemeinsames Match möglich/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/row-level security/)).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- src/pages/PublicProfilePage.test.tsx`
Expected: the two new tests FAIL — basic sees no button (openContact not yet read); the 42501 toast shows the raw `row-level security` message.

- [ ] **Step 3: Read the flag in the page**

In `src/pages/PublicProfilePage.tsx`, add the import after the other lib imports:

```ts
import { fetchPlatformSettings, platformSettingsQueryKey } from "../lib/platform-settings";
```

In the default `PublicProfilePage` component, add a query next to the existing profile query (after the `const { data, isLoading, isError } = useQuery({ … })` block):

```ts
  const { data: platform } = useQuery({
    queryKey: platformSettingsQueryKey,
    queryFn: fetchPlatformSettings,
  });
```

Change the `canRequestContact` line from:

```ts
  const canRequestContact = (levelRank ?? 0) >= LEVEL_RANK.exchange;
```

to:

```ts
  // §2: Kontaktrecht ab `exchange`. Der Admin-Flag open_contact (AGE-455) öffnet es
  // fürs Event für alle — die RLS (cr_insert_self) erzwingt dieselbe Regel.
  const canRequestContact =
    (platform?.openContact ?? false) || (levelRank ?? 0) >= LEVEL_RANK.exchange;
```

- [ ] **Step 4: Map the RLS denial to a friendly message**

In `src/pages/PublicProfilePage.tsx`, in `ContactRequestComposer`'s `onError`, after the `if (code === "23505") { … }` block and before the generic `const description = …` fallback, insert:

```ts
      // RLS-Ablehnung (42501): der Insert scheitert an is_contactable/Welpenschutz/
      // Level-Gate. Nie den rohen Postgres-String zeigen (AGE-455).
      if (code === "42501") {
        toast({
          variant: "error",
          title: "Anfrage nicht möglich",
          description: `Eine Kontaktanfrage an ${name} ist gerade nicht möglich. An neue Mitglieder ist eine Anfrage nur über ein gemeinsames Match möglich.`,
        });
        return;
      }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test -- src/pages/PublicProfilePage.test.tsx`
Expected: PASS — all existing tests plus the two new ones.

- [ ] **Step 6: Commit**

```bash
git add src/pages/PublicProfilePage.tsx src/pages/PublicProfilePage.test.tsx
git commit -m "feat(profile): gate contact composer on open_contact + friendly RLS error (AGE-455)"
```

---

### Task 4: Extract `ToggleRow` into a shared UI component

**Files:**
- Create: `src/components/ui/ToggleRow.tsx`
- Modify: `src/pages/EinstellungenPage.tsx` (remove local `ToggleRow`, import shared; drop now-unused `cn` import)

**Interfaces:**
- Produces: `ToggleRow` — `{ label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }`, renders a `role="switch"` button with `aria-label={label}` and `aria-checked={checked}`.

- [ ] **Step 1: Create the shared component**

Create `src/components/ui/ToggleRow.tsx` (moved verbatim from `EinstellungenPage.tsx` lines 23–64, with the `cn` import path adjusted for the new location):

```tsx
import { cn } from "../../lib/cn";

/** Beschriftete Umschalt-Zeile (role="switch"). Geteilt von Einstellungen & Admin. */
export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-60",
          checked ? "bg-gold-strong" : "bg-line",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-canvas transition-all",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Use the shared component in EinstellungenPage**

In `src/pages/EinstellungenPage.tsx`:
- Delete the local `function ToggleRow({ … }) { … }` (lines 23–64).
- Delete the now-unused import `import { cn } from "../lib/cn";` (line 12).
- Add the import alongside the other `../components/ui/*` imports:

```tsx
import { ToggleRow } from "../components/ui/ToggleRow";
```

- [ ] **Step 3: Verify no regression**

Run: `pnpm test -- src/pages/EinstellungenPage.test.tsx && pnpm typecheck`
Expected: PASS — the existing Einstellungen toggles behave identically; no unused-import / type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/ToggleRow.tsx src/pages/EinstellungenPage.tsx
git commit -m "refactor(ui): extract shared ToggleRow component (AGE-455)"
```

---

### Task 5: Admin page — gate, page, route, nav

**Files:**
- Create: `src/components/RequireAdmin.tsx`
- Create: `src/components/RequireAdmin.test.tsx`
- Create: `src/pages/AdminSettingsPage.tsx`
- Create: `src/pages/AdminSettingsPage.test.tsx`
- Modify: `src/App.tsx` (add `/admin` route)
- Modify: `src/components/AppShell.tsx` (add admin-only sidebar section)

**Interfaces:**
- Consumes: `useAuth().staffRole`; `ToggleRow` (Task 4); `fetchPlatformSettings`, `updateOpenContact`, `platformSettingsQueryKey`, `DEFAULT_PLATFORM_SETTINGS` (Task 2).
- Produces: default-exported `RequireAdmin` and `AdminSettingsPage`; route `/admin`; sidebar section "Administration".

- [ ] **Step 1: Write the failing gate test**

Create `src/components/RequireAdmin.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";
import RequireAdmin from "./RequireAdmin";

function renderGate(value: AuthContextValue) {
  return render(
    <AuthFixture value={value}>
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <p>Admin-Inhalt</p>
              </RequireAdmin>
            }
          />
          <Route path="/" element={<p>Startseite</p>} />
          <Route path="/login" element={<p>Login</p>} />
        </Routes>
      </MemoryRouter>
    </AuthFixture>,
  );
}

describe("RequireAdmin (AGE-455)", () => {
  it("lässt Admins durch", () => {
    renderGate(
      fakeAuthValue({ user: { id: "u1" } as AuthContextValue["user"], staffRole: "admin" }),
    );
    expect(screen.getByText("Admin-Inhalt")).toBeInTheDocument();
  });

  it("leitet eingeloggte Nicht-Admins auf die Startseite", () => {
    renderGate(
      fakeAuthValue({ user: { id: "u1" } as AuthContextValue["user"], staffRole: null }),
    );
    expect(screen.getByText("Startseite")).toBeInTheDocument();
    expect(screen.queryByText("Admin-Inhalt")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- src/components/RequireAdmin.test.tsx`
Expected: FAIL — cannot resolve `./RequireAdmin`.

- [ ] **Step 3: Write the gate**

Create `src/components/RequireAdmin.tsx` (mirrors `RequireStaff`, but admin-only):

```tsx
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/auth-context";

/**
 * Route-Gate für die Admin-Seite (AGE-455). Rendert children nur, wenn der Nutzer die
 * `admin`-Rolle aus `staff_roles` trägt (nicht matching_manager). Reines UI-Gating —
 * die echte Zugriffskontrolle erzwingt die RLS (platform_settings_update_admin prüft
 * is_admin()), unabhängig vom Client.
 */
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, staffRole, isLoading, tierLoading } = useAuth();

  if (isLoading || (user && tierLoading)) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (staffRole !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 4: Run the gate test to verify it passes**

Run: `pnpm test -- src/components/RequireAdmin.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 5: Write the failing admin-page test**

Create `src/pages/AdminSettingsPage.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/Toast";

vi.mock("../lib/platform-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/platform-settings")>();
  return { ...actual, fetchPlatformSettings: vi.fn(), updateOpenContact: vi.fn() };
});
import { fetchPlatformSettings, updateOpenContact } from "../lib/platform-settings";
import AdminSettingsPage from "./AdminSettingsPage";

const mockedFetch = vi.mocked(fetchPlatformSettings);
const mockedUpdate = vi.mocked(updateOpenContact);

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AdminSettingsPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockedFetch.mockReset();
  mockedUpdate.mockReset();
  mockedUpdate.mockResolvedValue(undefined);
});

describe("AdminSettingsPage (AGE-455)", () => {
  it("zeigt den open_contact-Toggle im aktuellen Zustand", async () => {
    mockedFetch.mockResolvedValue({ openContact: true });
    renderPage();

    const toggle = await screen.findByRole("switch", {
      name: "Kontaktanfragen für alle freischalten",
    });
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("schaltet den Flag beim Klick um", async () => {
    mockedFetch.mockResolvedValue({ openContact: true });
    renderPage();

    const toggle = await screen.findByRole("switch", {
      name: "Kontaktanfragen für alle freischalten",
    });
    fireEvent.click(toggle);
    expect(mockedUpdate).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm test -- src/pages/AdminSettingsPage.test.tsx`
Expected: FAIL — cannot resolve `./AdminSettingsPage`.

- [ ] **Step 7: Write the admin page**

Create `src/pages/AdminSettingsPage.tsx`:

```tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardTitle } from "../components/ui/Card";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import { ToggleRow } from "../components/ui/ToggleRow";
import { useToast } from "../components/ui/toast-context";
import {
  DEFAULT_PLATFORM_SETTINGS,
  fetchPlatformSettings,
  platformSettingsQueryKey,
  updateOpenContact,
} from "../lib/platform-settings";

/**
 * Admin-Einstellungen (AGE-455). Nur über /admin (RequireAdmin) erreichbar; die
 * echte Schreibgrenze ist die RLS (platform_settings_update_admin → is_admin()).
 * Erste und vorerst einzige Einstellung: der open_contact-Toggle.
 */
export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: platformSettingsQueryKey,
    queryFn: fetchPlatformSettings,
  });

  const save = useMutation({
    mutationFn: (next: boolean) => updateOpenContact(next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: platformSettingsQueryKey });
      toast({ variant: "success", title: "Einstellung gespeichert" });
    },
    onError: (error) => {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : "Unbekannter Fehler.";
      toast({ variant: "error", title: "Speichern fehlgeschlagen", description: message });
    },
  });

  if (isLoading) return <DashboardSkeleton />;

  const settings = data ?? DEFAULT_PLATFORM_SETTINGS;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Administration</h1>
      <Card className="flex flex-col gap-2">
        <CardTitle>Kontaktanfragen</CardTitle>
        <ToggleRow
          label="Kontaktanfragen für alle freischalten"
          hint="Für Events: jedes eingeloggte Mitglied darf jedem eine Kontaktanfrage senden — die Stufen-Hürde und der 30-Tage-Welpenschutz sind aus. Das Opt-out des Empfängers bleibt aktiv."
          checked={settings.openContact}
          onChange={(v) => save.mutate(v)}
          disabled={save.isPending}
        />
      </Card>
    </div>
  );
}
```

- [ ] **Step 8: Run the admin-page test to verify it passes**

Run: `pnpm test -- src/pages/AdminSettingsPage.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 9: Register the route**

In `src/App.tsx`:
- Add imports next to the existing page/gate imports:

```tsx
import RequireAdmin from "./components/RequireAdmin";
import AdminSettingsPage from "./pages/AdminSettingsPage";
```

- Inside `<Route element={<AppShell />}>`, next to the `/intern/routing` route, add:

```tsx
        {/* Admin-Einstellungen (AGE-455). Nur `admin` (RequireAdmin), daher kein
            navItem — der Sidebar-Eintrag wird in AppShell separat für Admins gesetzt.
            DB-seitig erzwingt platform_settings_update_admin is_admin(). */}
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminSettingsPage />
            </RequireAdmin>
          }
        />
```

- [ ] **Step 10: Add the admin-only sidebar entry**

In `src/components/AppShell.tsx`, in `SidebarContent`:
- Change `const { user, tier } = useAuth();` to `const { user, tier, staffRole } = useAuth();`.
- Replace the `const sections = …` block with a version that maps to `{ path, label }` (uniform type) and appends the admin section:

```tsx
  const sections: { title: string; items: { path: string; label: string }[] }[] =
    SIDEBAR_SECTIONS.filter(({ section }) => user || section === "entdecken").map(
      ({ section, title }) => ({
        title,
        items: navItems
          .filter((i) => i.section === section)
          .map((i) => ({ path: i.path, label: i.label })),
      }),
    );
  // Admin-Bereich: eigener, nur für `admin` sichtbarer Abschnitt (AGE-455). Bewusst
  // KEIN navItem — /admin wird in App.tsx über RequireAdmin geroutet, nicht über die
  // navItems-Schleife.
  if (staffRole === "admin") {
    sections.push({ title: "Administration", items: [{ path: "/admin", label: "Administration" }] });
  }
```

- [ ] **Step 11: Verify the full suite + typecheck**

Run: `pnpm typecheck && pnpm test -- src/pages/AdminSettingsPage.test.tsx src/components/RequireAdmin.test.tsx`
Expected: PASS; no type errors (confirms the `sections` retype in AppShell compiles).

- [ ] **Step 12: Commit**

```bash
git add src/components/RequireAdmin.tsx src/components/RequireAdmin.test.tsx src/pages/AdminSettingsPage.tsx src/pages/AdminSettingsPage.test.tsx src/App.tsx src/components/AppShell.tsx
git commit -m "feat(admin): admin-only settings page with open_contact toggle (AGE-455)"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run lint, typecheck, and the whole unit suite**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: lint clean; no type errors; all Vitest suites green (including the new `platform-settings`, `PublicProfilePage`, `RequireAdmin`, `AdminSettingsPage` tests and the unchanged `EinstellungenPage` tests).

- [ ] **Step 2: Re-run the DB rights matrix from a clean database**

Run: `supabase db reset && supabase test db supabase/tests/grants_test.sql supabase/tests/rls_test.sql`
Expected: migrations apply cleanly; pgTAP reports `ok` for all 61 assertions. (This mirrors the CI `migrations` job; a green run here means CI's migration gate will pass.)

- [ ] **Step 3: Confirm nothing stray is staged**

Run: `git status --short`
Expected: clean working tree (all changes committed across Tasks 1–5); no untracked scratch/probe files.

---

## Self-Review

**Spec coverage:**
- `platform_settings` table + seed on → Task 1 Step 1. ✓
- `is_contact_open()` helper → Task 1 Step 1. ✓
- RLS SELECT-all / UPDATE-admin + touch trigger → Task 1 Step 1. ✓
- Policy opens level gate + Welpenschutz, keeps opt-out/status/match-id → Task 1 Step 1 + verified by rls_test 6b (Steps 3, 5). ✓
- Frontend reads flag (`canRequestContact`) → Task 3 Step 3. ✓
- Friendly 42501 mapping (original screenshot bug) → Task 3 Step 4. ✓
- Admin-only `/admin` page with the toggle as first setting → Task 5 (Steps 7, 9). ✓
- Sidebar entry gated on `staffRole === 'admin'` → Task 5 Step 10. ✓
- Tests: pgTAP (open allows basic→new, closed denies, opt-out denies both, admin-write) → Task 1; frontend (basic sees button on open; 42501 friendly; admin gating + toggle) → Tasks 3, 5; lib fetch/default → Task 2. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step carries full code. ✓

**Type consistency:** `PlatformSettings.openContact` (Task 2) used identically in Tasks 3 & 5; `platformSettingsQueryKey`, `fetchPlatformSettings`, `updateOpenContact`, `DEFAULT_PLATFORM_SETTINGS` names match across tasks; `ToggleRow` prop shape (Task 4) matches its use in Task 5 Step 7; policy renamed `cr_insert_self_exchange` → `cr_insert_self` consistently (Task 1). ✓
