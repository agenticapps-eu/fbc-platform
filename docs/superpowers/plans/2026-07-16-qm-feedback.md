# QM-Feedback (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mitglieder geben plattformweites Feedback (⭐ + drei Fragen + Route); ein `admin` liest alles, jeder andere nur sein eigenes.

**Architecture:** Vier nullable Spalten additiv auf der bestehenden `public.feedback` (kein neuer Tabellen-Schnitt), eine enge `is_admin()`-SECURITY-DEFINER-Funktion als Autorisierungsquelle für eine zusätzliche SELECT-Policy, und ein schwebender Button im `AppShell`, der einen Dialog öffnet. Die Sicherheitsgrenze ist die RLS-Policy, nicht das Frontend.

**Tech Stack:** Supabase/Postgres (Migrationen + pgTAP), React 19 + TypeScript strict, TanStack Query, Tailwind, Vitest + Testing Library, pnpm.

**Spec:** `docs/superpowers/specs/2026-07-16-qm-feedback-design.md` (abgenommen 16.07.2026)
**Linear:** AGE-300 · **Branch:** `donald/age-300-qm-feedback-mvp-sterne-3-fragen-route-kontext` (liegt an, Spec-Commit `4162c5c` ist drauf)

## Global Constraints

- **Conventional Commits mit Linear-Referenz** — jede Commit-Message endet auf `(AGE-300)`.
- **Nie `git add -A`** — der Arbeitsbaum trägt dauerhaft untracked Dateien (`.planning/`, `docs/design-mocks/`), teils mit Rechten 0600, und das Repo ist **öffentlich**. Immer nur die im Task genannten Pfade adden.
- **TypeScript strict** — kein `any`, keine Casts an der falschen Stelle. Typen verengen an der Grenze (DOM/DB), nicht am Ende (AGE-356).
- **RLS ist die Sicherheitsgrenze** (CLAUDE.md) — jede Zugriffsregel existiert als Policy und greift unabhängig vom Client.
- **Autorisierungsquelle ist `staff_roles`**, niemals `profiles.roles` (member-writable, ADR-0002).
- **Keine `vi.mock` auf eigene Komponenten.** Datenschicht-Module (`src/lib/*`) zu mocken ist etabliert und erlaubt (s. `EinstellungenPage.test.tsx`); die zu testende Komponente selbst zu mocken prüft nichts.
- **Migrations-Köpfe tragen die Entscheidung** — Begründung + verworfene Alternative, signiert und datiert. Das ist hier die Fundstelle für spätere Sessions.
- **Sprache:** Kommentare, Commit-Messages und UI-Texte auf Deutsch (Repo-Konvention).

## Vorbedingung: lokale DB

Die Migrations- und pgTAP-Schritte brauchen ein lokales Supabase. **Nicht gegen Prod arbeiten** — `env=dev` teilt den Prod-Supabase-Ref, lokale Schreibzugriffe träfen die Live-DB.

```bash
supabase start -x studio,imgproxy,edge-runtime,logflare,vector
supabase db reset          # wendet alle Migrationen auf eine saubere DB an
```

Die DB-URL für die Proben liefert `supabase status` (Feld `DB URL`), üblicherweise
`postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

---

### Task 1: Migration — Spalten, `is_admin()`, Admin-Policy

**Files:**
- Create: `supabase/migrations/20260716070000_platform_feedback.sql`
- Modify: `supabase/tests/rls_test.sql:16` (die `plan(31)`-Zeile) + Fixtures + neuer Abschnitt am Ende
- Test: `supabase/tests/rls_test.sql`

**Interfaces:**
- Consumes: `public.staff_roles(profile_id, role)` und das Vorbild `public.is_matching_manager()` aus `20260614120000_volume_routing_queue.sql`; die Policy `feedback_own` aus `20260612082726_rls_policies.sql`.
- Produces: Spalten `public.feedback.likes|misses|idea|route` (alle `text`, nullable); Funktion `public.is_admin() returns boolean`; Policy `feedback_admin_read`. Task 3 schreibt in diese Spalten.

- [ ] **Step 1: Die Tests schreiben, die die Policy fordern**

In `supabase/tests/rls_test.sql`. Zuerst die Fixtures — ein Admin, ein Matching-Manager, und Feedback-Zeilen von zwei verschiedenen Autoren. Die vorhandenen Mitglieder-Fixtures (`1111…` basic, `6666…` impact) werden wiederverwendet; neu ist nur der Staff.

Nach dem bestehenden `insert into auth.users (…)`-Block (um Zeile 19-27) die zwei Staff-Nutzer ergänzen. Die UUIDs folgen dem Muster der Datei (sprechende Präfixe), müssen aber gültiges Hex bleiben — `a`–`f` und Ziffern, sonst wirft der Insert `invalid input syntax for type uuid`:

```sql
insert into auth.users (id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@test.fbc'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'manager@test.fbc');
update public.profiles set tier = 'impact', name = 'Admin'   where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.profiles set tier = 'impact', name = 'Manager' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
```

Die bestehende Rückdatierung (`update public.profiles set created_at = now() - interval '90 days' where id <> '7777…'`) erfasst die neuen Profile automatisch — sie steht nach diesen Inserts. Prüfe beim Einfügen, dass deine Zeilen **davor** stehen.

Danach die Staff-Rollen und die Feedback-Fixtures — ans Ende des Fixture-Abschnitts, vor `create function pg_temp.count_as` (um Zeile 83):

```sql
-- Staff (server-kontrolliert, ADR-0002). Provisioniert wie in Prod: direkt, nie vom Client.
insert into public.staff_roles (profile_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'matching_manager');

-- Feedback von zwei verschiedenen Autoren — der Admin darf beide sehen, sonst niemand.
insert into public.feedback (profile_id, rating, likes, misses, idea, route) values
  ('11111111-1111-1111-1111-111111111111', 5, 'Der Compass', 'Nichts', 'Mehr Events', '/compass'),
  ('66666666-6666-6666-6666-666666666666', 2, 'Das Design', 'Tempo',  'Schneller',    '/meine-chancen');
```

Und ans Dateiende, vor `select * from finish();`, der neue Abschnitt:

```sql
-- ── 11. feedback — plattformweites QM (§3.5, AGE-300) ────────────────────────
-- `admin` liest alles (feedback_admin_read), alle anderen nur ihr eigenes
-- (feedback_own). Die Quelle ist staff_roles, NICHT profiles.roles — letzteres
-- ist member-writable, ein Mitglied könnte sich sonst selbst freischalten.
select is(
  pg_temp.count_as('aaaaaaaa-0000-0000-0000-000000000001',
    'select count(*)::int from public.feedback'),
  2, 'Admin liest fremdes Feedback (beide Zeilen)');

select is(
  pg_temp.count_as('11111111-1111-1111-1111-111111111111',
    'select count(*)::int from public.feedback'),
  1, 'Ein gewöhnliches Mitglied sieht nur sein eigenes Feedback');

select is(
  pg_temp.count_as('bbbbbbbb-0000-0000-0000-000000000002',
    'select count(*)::int from public.feedback'),
  0, 'Ein matching_manager sieht KEIN fremdes Feedback — QM ist nicht die Deal-Queue');

-- Der Admin liest, er verwaltet nicht: feedback_admin_read ist `for select`,
-- feedback_own greift bei fremden Zeilen nicht. Ohne diese Assertion wäre ein
-- versehentliches `for all` in der Policy unbemerkt.
select is(
  pg_temp.try_as('aaaaaaaa-0000-0000-0000-000000000001',
    'delete from public.feedback where profile_id = ''11111111-1111-1111-1111-111111111111'''),
  'OK', 'DELETE läuft ohne Fehler durch (RLS filtert stumm, statt zu werfen)');

select is(
  (select count(*)::int from public.feedback
    where profile_id = '11111111-1111-1111-1111-111111111111'),
  1, '… aber die fremde Zeile steht noch — Admin darf lesen, nicht löschen');
```

Die `plan()`-Zahl in Zeile 16 von `31` auf `36` erhöhen (5 neue Assertions):

```sql
select plan(36);
```

**Warum die DELETE-Prüfung zweistufig ist:** Ein `delete` unter RLS wirft keinen Fehler, wenn keine Zeile passt — es löscht schlicht nichts. `try_as` gäbe also `'OK'` zurück, obwohl nichts geschah. Der Beleg ist deshalb die Zeilenzahl danach, nicht der Rückgabewert. (`try_as` meldet außerdem *jeden* Fehler als `DENIED:` — auch Tippfehler; wenn eine Assertion unerwartet `DENIED` liefert, lies die Meldung, bevor du sie als Policy-Treffer deutest.)

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

```bash
supabase test db supabase/tests/rls_test.sql
```

Erwartet: FAIL. Der Fixture-Insert bricht mit
`ERROR: column "likes" of relation "feedback" does not exist` —
die Spalten aus Step 3 gibt es noch nicht. Das ist der Beweis, dass der Test die neue Struktur wirklich fordert.

- [ ] **Step 3: Die Migration schreiben**

`supabase/migrations/20260716070000_platform_feedback.sql`:

```sql
-- Plattformweites QM-Feedback (AGE-300) — Spec §3.5 in
-- docs/superpowers/specs/2026-07-15-fbc-6level-upgrade.md,
-- Design: docs/superpowers/specs/2026-07-16-qm-feedback-design.md.
-- Donald, 2026-07-16.
--
-- ── Warum vier Spalten und keine zweite Tabelle ──────────────────────────────
-- `feedback` (AGE-234) ist aktionsgebunden gebaut: ref_type in (event|match|course)
-- + ref_id beantworten „Wie war dieses Event?". §3.5 fragt etwas anderes — ⭐ plus
-- „Was gefällt dir? / Was fehlt dir? / Welche Idee hast du?" ÜBER DIE PLATTFORM,
-- verortet über die Route statt über eine Aktion. Beim Sommerfest hat kaum ein Gast
-- schon ein Event besucht; die aktionsgebundene Variante liefe leer.
--
-- Beide Formen teilen sich die Tabelle: bei plattformweitem Feedback bleiben
-- ref_type/ref_id NULL (der CHECK lässt NULL durch), bei aktionsgebundenem bleiben
-- likes/misses/idea/route NULL. VERWORFEN: eine eigene Tabelle `platform_feedback` —
-- sie kostet eigene RLS, eigene Grants und eine zweite Tabelle, die der Admin später
-- beide lesen muss; und `feedback` hat bis heute keinen einzigen Schreiber. Eine
-- Grenze ziehen, bevor die erste Zeile existiert, ist eine Grenze ohne Anlass.
-- VERWORFEN: ein JSONB `answers` — Flexibilität für einen Fall, den es nicht gibt
-- (die drei Fragen stehen im Spec fest), zum Preis von Typsicherheit.
--
-- Forward-only. Grants sind bereits tabellenweit ausgesprochen
-- (20260715140000_explicit_grants.sql: `grant select, insert, update, delete on
-- public.feedback to authenticated`) und decken neue Spalten mit ab — hier ist
-- also NICHTS nachzuziehen. Das gilt nicht für die Funktion unten (AGE-312).

alter table public.feedback
  add column likes  text,
  add column misses text,
  add column idea   text,
  add column route  text;

comment on column public.feedback.likes  is '§3.5 „Was gefällt dir?" — nur bei plattformweitem Feedback.';
comment on column public.feedback.misses is '§3.5 „Was fehlt dir?" — nur bei plattformweitem Feedback.';
comment on column public.feedback.idea   is '§3.5 „Welche Idee hast du?" — nur bei plattformweitem Feedback.';
comment on column public.feedback.route  is 'Pfad, auf dem das Feedback entstand (z. B. /meine-chancen). Tritt an die Stelle von ref_type/ref_id.';

-- ── Autorisierung: is_admin() ────────────────────────────────────────────────
-- Spiegelt is_matching_manager() (20260614120000) im Aufbau, aber ENG auf 'admin'.
-- VERWORFEN: is_matching_manager() wiederverwenden — es umfasst auch
-- 'matching_manager', dessen Zuständigkeit die DKRI-Deal-Queue ist (ADR-0002), nicht
-- das QM. Der Name löge an der Aufrufstelle, und die Ausweitung wäre stillschweigend.
--
-- SECURITY DEFINER ist hier nicht dekorativ: staff_roles trägt selbst RLS
-- (staff_roles_select_self). Ein Inline-exists(...) in der Policy liefe als der
-- abfragende Nutzer und hinge daran, dass er seine eigene Staff-Zeile sehen darf —
-- subtil und fragil. DEFINER umgeht das, wie im Repo etabliert.
create or replace function public.is_admin() returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1 from public.staff_roles
    where profile_id = (select auth.uid())
      and role = 'admin'
  );
$$;
comment on function public.is_admin() is
  'True when the caller holds the admin staff role. Server-controlled (staff_roles, '
  'not the member-writable profiles.roles). Narrower than is_matching_manager(): QM '
  'is not the deal queue. Used by feedback_admin_read (AGE-300).';

-- Die Policy läuft als die abfragende Rolle, also braucht sie EXECUTE. Die Funktion
-- verrät nur die eigene Admin-Eigenschaft des Aufrufers — REST-Exposure ist harmlos.
grant execute on function public.is_admin() to authenticated;

-- ── Policy: Admin liest alles ────────────────────────────────────────────────
-- ERGÄNZT feedback_own (20260612082726), ersetzt es nicht: Policies sind additiv
-- (OR-verknüpft), das Mitglied behält also Lese- UND Schreibrecht auf seine eigenen
-- Zeilen. Bewusst nur `for select` — der Admin liest das QM, er verwaltet es nicht.
create policy feedback_admin_read on public.feedback
  for select to authenticated
  using ( public.is_admin() );
```

- [ ] **Step 4: Tests laufen lassen — sie müssen halten**

```bash
supabase db reset
supabase test db supabase/tests/rls_test.sql
```

Erwartet: PASS, `36/36`. Läuft `grants_test.sql` mit durch? Prüfen — die Tabellen-Grants sind unverändert, er darf nicht anschlagen:

```bash
supabase test db supabase/tests/grants_test.sql supabase/tests/rls_test.sql
```

Erwartet: beide PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260716070000_platform_feedback.sql supabase/tests/rls_test.sql
git commit -m "feat(qm): Plattform-Feedback-Spalten + is_admin()-Policy (AGE-300)"
```

---

### Task 2: Der Score-Fix und sein Beleg

**Files:**
- Modify: `supabase/migrations/20260716070000_platform_feedback.sql` (anhängen)
- Modify: `supabase/tests/probe_potential_score.sql:61-63` (Fixture) + neuer Abschnitt
- Test: `supabase/tests/probe_potential_score.sql`

**Interfaces:**
- Consumes: `public.recompute_potential_score(uuid)` aus `20260613230000_potential_score.sql`.
- Produces: nichts Neues — ändert das Verhalten einer bestehenden Funktion.

**Warum dieser Task existiert:** `recompute_potential_score()` mittelt `avg(rating)` über `feedback.profile_id` **ohne** `ref_type`-Filter, und `profile_id` ist der *Autor*. Sobald Task 3 in die Tabelle schreibt, verstellt ein Gast mit seiner Plattform-Bewertung **seinen eigenen** Potenzial-Score — 5 Sterne rauf, 2 Sterne runter, beliebig oft. Heute folgenlos, weil die Tabelle keinen Schreiber hat; dieser Branch macht die Falle scharf.

**Wichtig — dieser Beleg läuft nicht in CI.** `.github/workflows/ci.yml` führt bewusst nur `grants_test.sql` und `rls_test.sql` aus; die `probe_*.sql` sind manuelle `begin`/`rollback`-Skripte ohne `plan()`/`finish()` und damit kein pgTAP. Der Rot/Grün-Nachweis unten ist also **lokal zu führen** und schützt nicht dauerhaft gegen eine spätere Regression. Das ist bewusst so (Spec §4) und im Handoff vermerkt.

- [ ] **Step 1: Die Probe scharf stellen**

Zwei Änderungen in `supabase/tests/probe_potential_score.sql`.

**(a)** Das bestehende Fixture (Zeile 61-63) setzt `ref_type` nicht — und dokumentiert damit die Falle, die wir gerade schließen. Es wird auf aktionsgebundenes Feedback gezogen, damit es weiter zählt:

```sql
-- Feedback: avg rating 4. ref_type MUSS gesetzt sein — nur aktionsgebundenes
-- Feedback zählt auf den Score (AGE-300). ref_id darf NULL bleiben.
insert into public.feedback (profile_id, ref_type, rating)
  values ('00000000-0000-0000-0000-0000000242aa', 'event', 4);

-- Plattform-Feedback (§3.5): ref_type NULL, absichtlich mit dem schlechtestmöglichen
-- rating. Es darf den Score NICHT bewegen — es ist eine Meinung ÜBER die Plattform,
-- kein Signal über das Mitglied. Ohne den ref_type-Filter in
-- recompute_potential_score() zöge dieses eine Sternchen den Schnitt von 4 auf 2.5
-- und den Score von 54 auf 50.
insert into public.feedback (profile_id, rating, likes, route)
  values ('00000000-0000-0000-0000-0000000242aa', 1, 'Nichts', '/compass');
```

**(b)** Den Kopfkommentar (Zeile 12) ehrlich halten:

```sql
--   feedback   = avg rating 4 über AKTIONSGEBUNDENES Feedback (ref_type gesetzt);
--                Plattform-Feedback (ref_type null) zählt nicht mit
--                → (4-1)/4=0.75 → 0.75 × 10 =  7.5
```

- [ ] **Step 2: Probe laufen lassen — sie muss fehlschlagen**

```bash
psql "$(supabase status -o env | grep '^DB_URL=' | cut -d= -f2- | tr -d '"')" \
  -f supabase/tests/probe_potential_score.sql
```

Falls `supabase status -o env` nicht verfügbar ist, die URL direkt nehmen:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f supabase/tests/probe_potential_score.sql
```

Erwartet: `score_is_54 | f` (und `breakdown_score_matches | f`). Der Score steht auf **50**, weil das Plattform-Feedback mit `rating = 1` den Schnitt auf 2.5 zieht. **Das ist der Bug, sichtbar gemacht.** Alle übrigen Spalten bleiben `t`.

- [ ] **Step 3: Den Filter setzen**

Postgres kann eine Funktion nicht partiell ändern — `create or replace function` verlangt den vollen Body. Kopiere `public.recompute_potential_score` **wörtlich** aus `supabase/migrations/20260613230000_potential_score.sql` (Zeile 48 bis zum Ende der Funktion) ans Ende von `20260716070000_platform_feedback.sql` und ändere **genau eine** Anweisung — den Feedback-Select (dort Zeile 122-126):

```sql
  -- Feedback: avg rating tied to the profile (prototype proxy).
  -- AGE-300: NUR aktionsgebundenes Feedback (ref_type gesetzt). Plattform-Feedback
  -- (§3.5) ist eine Meinung ÜBER die Plattform, kein Signal über das Mitglied —
  -- ohne diesen Filter verstellte ein Gast mit seiner eigenen Bewertung seinen
  -- eigenen Score. Der Kommentar dieser Funktion sagt seit AGE-242, was gemeint
  -- war: „feedback RECEIVED is modelled later (Ebene 2)" — Feedback ÜBER das
  -- Mitglied, nicht VOM Mitglied. Bis Ebene 2 ist ref_type die beste Näherung.
  select count(*), avg(rating)
  into v_feedback_count, v_feedback_avg
  from public.feedback
  where profile_id = p_profile_id
    and rating is not null
    and ref_type is not null;
```

Davor, als Kopf des angehängten Abschnitts:

```sql
-- ── recompute_potential_score: Plattform-Feedback zählt nicht ────────────────
-- Vollständige Neudeklaration, weil Postgres keine partielle Änderung kennt. Gegen
-- 20260613230000_potential_score.sql ist AUSSCHLIESSLICH der Feedback-Select
-- geändert (+ `and ref_type is not null`); Gewichte, Sättigungen und der
-- Erfolgsradar sind unverändert. probe_potential_score.sql belegt das: seine
-- übrigen Assertions (Radar, Komponentenzahl, Gewichtung) müssen weiter halten.
```

**Beim Kopieren nichts anderes anfassen.** Wenn dabei etwas verrutscht, schlagen die übrigen Assertions der Probe an — genau dafür sind sie da.

- [ ] **Step 4: Probe laufen lassen — sie muss halten**

```bash
supabase db reset
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f supabase/tests/probe_potential_score.sql
```

Erwartet: **alle** Spalten `t` — `score_is_54 | t`, `sein_from_compass | t`, `tun_from_fallback | t`, `haben_from_fallback | t`, `wirken_empty | t`, `four_theme_rows | t`, `five_components | t`, `breakdown_score_matches | t`.

Der Score steht wieder auf 54, **obwohl** eine 1-Sterne-Zeile des Mitglieds in der Tabelle liegt. Das ist der Beleg.

Danach die pgTAP-Suiten gegenprüfen, sie dürfen nicht betroffen sein:

```bash
supabase test db supabase/tests/grants_test.sql supabase/tests/rls_test.sql
```

Erwartet: beide PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260716070000_platform_feedback.sql supabase/tests/probe_potential_score.sql
git commit -m "fix(score): Plattform-Feedback zählt nicht auf den Potenzial-Score (AGE-300)"
```

---

### Task 3: Datenschicht `src/lib/feedback.ts`

**Files:**
- Create: `src/lib/feedback.ts`
- Create: `src/lib/feedback.test.ts`

**Interfaces:**
- Consumes: `supabase` aus `src/lib/supabase.ts`; die Spalten aus Task 1.
- Produces:
  ```ts
  export interface PlatformFeedbackInput {
    profileId: string;
    rating: number;
    likes: string;
    misses: string;
    idea: string;
    route: string;
  }
  export function submitPlatformFeedback(input: PlatformFeedbackInput): Promise<void>
  ```
  Task 4 ruft `submitPlatformFeedback` auf und mockt dieses Modul im Test.

- [ ] **Step 1: Den failing test schreiben**

`src/lib/feedback.test.ts`. Gemockt wird der Supabase-Client (fremde Grenze), nicht unser eigener Code:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
vi.mock("./supabase", () => ({
  supabase: { from: (table: string) => ({ insert: (row: unknown) => insert(table, row) }) },
}));

import { submitPlatformFeedback } from "./feedback";

beforeEach(() => {
  insert.mockReset();
  insert.mockResolvedValue({ error: null });
});

describe("submitPlatformFeedback", () => {
  it("schreibt die drei Texte und die Route in die feedback-Zeile", async () => {
    await submitPlatformFeedback({
      profileId: "u1",
      rating: 4,
      likes: "Der Compass",
      misses: "Nichts",
      idea: "Mehr Events",
      route: "/meine-chancen",
    });

    expect(insert).toHaveBeenCalledWith("feedback", {
      profile_id: "u1",
      rating: 4,
      likes: "Der Compass",
      misses: "Nichts",
      idea: "Mehr Events",
      route: "/meine-chancen",
    });
  });

  it("lässt ref_type/ref_id weg — sonst zählte das Feedback auf den Potenzial-Score", async () => {
    await submitPlatformFeedback({
      profileId: "u1", rating: 1, likes: "", misses: "", idea: "", route: "/",
    });

    const row = insert.mock.calls[0][1] as Record<string, unknown>;
    expect(row).not.toHaveProperty("ref_type");
    expect(row).not.toHaveProperty("ref_id");
  });

  it("reicht einen Fehler der DB durch, statt ihn zu schlucken", async () => {
    insert.mockResolvedValue({ error: { message: "new row violates row-level security policy" } });

    await expect(
      submitPlatformFeedback({
        profileId: "u1", rating: 5, likes: "", misses: "", idea: "", route: "/",
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining("row-level security") });
  });
});
```

Der zweite Test ist kein Selbstzweck: Er nagelt die Kopplung aus Task 2 von der Schreibseite fest. Setzte jemand später `ref_type` hier, zählte das Feedback wieder auf den Score.

- [ ] **Step 2: Test laufen lassen — er muss fehlschlagen**

```bash
pnpm vitest run src/lib/feedback.test.ts
```

Erwartet: FAIL — `Failed to resolve import "./feedback"`.

- [ ] **Step 3: Die Implementierung schreiben**

`src/lib/feedback.ts`:

```ts
import { supabase } from "./supabase";

/**
 * Plattformweites QM-Feedback (AGE-300) — Spec §3.5 in
 * docs/superpowers/specs/2026-07-15-fbc-6level-upgrade.md.
 *
 * Schreibt über die `feedback_own`-Policy (20260612082726): ein Mitglied schreibt
 * nur unter der eigenen profile_id. Gelesen wird hier nichts — die Admin-Sicht ist
 * eine reine Policy (`feedback_admin_read`), eine Oberfläche dafür steht nicht im Spec.
 *
 * `ref_type`/`ref_id` bleiben bewusst ungesetzt. Sie kennzeichnen AKTIONSGEBUNDENES
 * Feedback (Event/Match/Kurs, AGE-234), und nur solches zählt auf den Potenzial-Score
 * (recompute_potential_score, s. 20260716070000_platform_feedback.sql). Eine Meinung
 * über die Plattform ist kein Signal über das Mitglied.
 */
export interface PlatformFeedbackInput {
  profileId: string;
  /** 1–5. Pflicht — ohne Sterne ist die Zeile aussagelos (Spec-Design §3). */
  rating: number;
  likes: string;
  misses: string;
  idea: string;
  /** Pfad, auf dem das Feedback entstand (z. B. `/meine-chancen`). */
  route: string;
}

export async function submitPlatformFeedback(input: PlatformFeedbackInput): Promise<void> {
  const { error } = await supabase.from("feedback").insert({
    profile_id: input.profileId,
    rating: input.rating,
    likes: input.likes,
    misses: input.misses,
    idea: input.idea,
    route: input.route,
  });
  if (error) throw error;
}
```

- [ ] **Step 4: Test laufen lassen — er muss halten**

```bash
pnpm vitest run src/lib/feedback.test.ts
pnpm typecheck
```

Erwartet: 3 Tests PASS, tsc ohne Ausgabe.

**Hinweis:** `database.types.ts` ist generiert und kennt die neuen Spalten noch nicht. Falls `tsc` die Insert-Zeile anmeckert, regeneriere die Typen gegen die lokale DB, statt zu casten (ein Cast wäre exakt die AGE-356-Falle):

```bash
supabase gen types typescript --local > src/lib/database.types.ts
```

Dann `src/lib/database.types.ts` mit committen.

- [ ] **Step 5: Commit**

```bash
git add src/lib/feedback.ts src/lib/feedback.test.ts
# database.types.ts nur falls regeneriert:
# git add src/lib/database.types.ts
git commit -m "feat(qm): Datenschicht für plattformweites Feedback (AGE-300)"
```

---

### Task 4: `FeedbackButton` — Button + Dialog

**Files:**
- Create: `src/components/feedback/FeedbackButton.tsx`
- Create: `src/components/feedback/FeedbackButton.test.tsx`

**Interfaces:**
- Consumes: `submitPlatformFeedback` + `PlatformFeedbackInput` (Task 3); `useAuth` aus `src/providers/auth-context`; `Button`, `Field`, `Textarea`, `useToast` aus `src/components/ui`; `useLocation` aus `react-router-dom`.
- Produces: `export function FeedbackButton(): JSX.Element | null` — rendert `null` ohne eingeloggten Nutzer. Task 5 baut sie in `AppShell` ein.

**Es gibt keine Dialog-Primitive** in `src/components/ui/`. Folge dem etablierten Overlay-Muster aus `AppShell.tsx:337-357` (Off-Canvas-Sidebar): `fixed inset-0 z-50` + `role="dialog"` + `aria-modal="true"` + `aria-label`, ein Backdrop-`div` mit `onClick` zum Schließen, darüber das Panel. Keine neue Abhängigkeit.

- [ ] **Step 1: Den failing test schreiben**

`src/components/feedback/FeedbackButton.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthFixture, fakeAuthValue } from "../../test/auth-fixtures";
import type { AuthContextValue } from "../../providers/auth-context";
import { ToastProvider } from "../ui/Toast";

vi.mock("../../lib/feedback", () => ({ submitPlatformFeedback: vi.fn() }));
import { submitPlatformFeedback } from "../../lib/feedback";
import { FeedbackButton } from "./FeedbackButton";

const mockedSubmit = vi.mocked(submitPlatformFeedback);

beforeEach(() => {
  mockedSubmit.mockReset();
  mockedSubmit.mockResolvedValue();
});

function renderAt(route: string, user: AuthContextValue["user"] | null = { id: "u1" } as AuthContextValue["user"]) {
  const value = fakeAuthValue({ user, tier: "basic", levelRank: 1 });
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthFixture value={value}>
        <ToastProvider>
          <FeedbackButton />
        </ToastProvider>
      </AuthFixture>
    </MemoryRouter>,
  );
}

describe("FeedbackButton", () => {
  it("bleibt für nicht eingeloggte Besucher unsichtbar — sie können ohnehin nicht speichern", () => {
    renderAt("/", null);
    expect(screen.queryByRole("button", { name: /feedback/i })).toBeNull();
  });

  it("sperrt das Absenden, solange keine Sterne gewählt sind", () => {
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    expect(screen.getByRole("button", { name: /absenden/i })).toBeDisabled();
  });

  it("schickt Sterne, Texte und die aktuelle Route", async () => {
    renderAt("/meine-chancen");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    fireEvent.click(screen.getByRole("radio", { name: "4 von 5 Sternen" }));
    fireEvent.change(screen.getByLabelText(/was gefällt dir/i), { target: { value: "Der Compass" } });
    fireEvent.change(screen.getByLabelText(/was fehlt dir/i), { target: { value: "Nichts" } });
    fireEvent.change(screen.getByLabelText(/welche idee/i), { target: { value: "Mehr Events" } });
    fireEvent.click(screen.getByRole("button", { name: /absenden/i }));

    await waitFor(() =>
      expect(mockedSubmit).toHaveBeenCalledWith({
        profileId: "u1",
        rating: 4,
        likes: "Der Compass",
        misses: "Nichts",
        idea: "Mehr Events",
        route: "/meine-chancen",
      }),
    );
  });

  it("zeigt einen Fehler an, statt ihn verschwinden zu lassen", async () => {
    mockedSubmit.mockRejectedValue(new Error("kaputt"));
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    fireEvent.click(screen.getByRole("radio", { name: "5 von 5 Sternen" }));
    fireEvent.click(screen.getByRole("button", { name: /absenden/i }));

    expect(await screen.findByText(/konnte nicht gespeichert werden/i)).toBeInTheDocument();
  });
});
```

Prüfe die Signatur von `fakeAuthValue` in `src/test/auth-fixtures.tsx`, bevor du sie aufrufst, und passe die Felder an, falls sie abweicht (Vorbild: `src/pages/EinstellungenPage.test.tsx:36-41`).

- [ ] **Step 2: Test laufen lassen — er muss fehlschlagen**

```bash
pnpm vitest run src/components/feedback/FeedbackButton.test.tsx
```

Erwartet: FAIL — `Failed to resolve import "./FeedbackButton"`.

- [ ] **Step 3: Die Komponente schreiben**

`src/components/feedback/FeedbackButton.tsx`:

```tsx
import { useState } from "react";
import { useLocation } from "react-router-dom";

import { submitPlatformFeedback } from "../../lib/feedback";
import { useAuth } from "../../providers/auth-context";
import { Button, Textarea, useToast } from "../ui";

/**
 * QM-Feedback (AGE-300) — Spec §3.5. Schwebender Button, überall im AppShell.
 *
 * Kein Nav-Eintrag: `src/config/nav.test.ts` nagelt die Navigation exakt an Spec §2
 * fest (6+5+1). Ein Eintrag hier bräche beides. Der Route-Kontext tritt an die Stelle
 * der Aktion — deshalb muss das Modul überall erreichbar sein, nicht an einer Stelle.
 *
 * Kein Dialog-Primitive im Repo → Overlay-Muster aus AppShell.tsx (Off-Canvas-Sidebar).
 */
const STARS = [1, 2, 3, 4, 5] as const;

export function FeedbackButton() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [likes, setLikes] = useState("");
  const [misses, setMisses] = useState("");
  const [idea, setIdea] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Ohne Konto ist Feedback nicht speicherbar: feedback.profile_id ist `not null`
  // und feedback_own verlangt profile_id = auth.uid(). Einen Button zu zeigen, der
  // nur scheitern kann, wäre ein Versprechen ins Leere.
  if (!user) return null;

  function close() {
    setOpen(false);
    setError(null);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await submitPlatformFeedback({
        // Kein `!` nötig: der Guard oben verengt `user` für den Rest der Komponente.
        // Falls tsc hier doch meckert, den Wert vor dem Guard binden — NICHT casten.
        profileId: user.id,
        rating,
        likes,
        misses,
        idea,
        route: pathname,
      });
      toast.show({ title: "Danke für dein Feedback!" });
      setRating(0);
      setLikes("");
      setMisses("");
      setIdea("");
      setOpen(false);
    } catch {
      setError("Dein Feedback konnte nicht gespeichert werden. Bitte versuche es noch einmal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 rounded-full border border-gold/30 bg-canvas px-4 py-2.5 text-sm font-semibold text-ink shadow-soft transition-colors hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-strong"
      >
        Feedback
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Feedback geben">
          <div className="absolute inset-0 bg-night/60 backdrop-blur-sm" onClick={close} />
          <div className="absolute bottom-0 right-0 max-h-[90vh] w-full overflow-y-auto rounded-t-[var(--radius-card)] bg-canvas p-6 shadow-soft sm:bottom-5 sm:right-5 sm:w-[26rem] sm:rounded-[var(--radius-card)]">
            <h2 className="text-lg font-semibold text-ink">Wie gefällt dir die Plattform?</h2>

            <div className="mt-4" role="radiogroup" aria-label="Sternebewertung">
              {STARS.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} von 5 Sternen`}
                  onClick={() => setRating(n)}
                  className="px-1 text-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-strong"
                >
                  <span aria-hidden="true">{n <= rating ? "★" : "☆"}</span>
                </button>
              ))}
            </div>

            <label className="mt-4 block text-sm font-medium text-ink" htmlFor="fb-likes">
              Was gefällt dir?
            </label>
            <Textarea id="fb-likes" rows={2} value={likes} onChange={(e) => setLikes(e.target.value)} />

            <label className="mt-3 block text-sm font-medium text-ink" htmlFor="fb-misses">
              Was fehlt dir?
            </label>
            <Textarea id="fb-misses" rows={2} value={misses} onChange={(e) => setMisses(e.target.value)} />

            <label className="mt-3 block text-sm font-medium text-ink" htmlFor="fb-idea">
              Welche Idee hast du?
            </label>
            <Textarea id="fb-idea" rows={2} value={idea} onChange={(e) => setIdea(e.target.value)} />

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>
                Abbrechen
              </Button>
              <Button onClick={submit} disabled={rating === 0 || saving}>
                Absenden
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

**Vor dem Schreiben prüfen** (der Plan kann hier von der Realität abweichen — die Wahrheit steht im Code):
- `Textarea` — nimmt sie `id`/`rows` durch? (`src/components/ui/Textarea.tsx`)
- `Button` — heißt die Ghost-Variante `variant="ghost"`? (`src/components/ui/Button.tsx`)
- `useToast` — ist die Methode `show({ title })`? (`src/components/ui/toast-context.ts`)
- `useAuth` — kommt sie aus `providers/auth-context` und liefert `user.id`?
- Farb-Token `text-danger` — existiert es? Sonst das im Repo übliche Fehler-Token nehmen.

Passe die Aufrufe an das an, was da ist. Erfinde keine Props.

- [ ] **Step 4: Test laufen lassen — er muss halten**

```bash
pnpm vitest run src/components/feedback/FeedbackButton.test.tsx
pnpm typecheck
```

Erwartet: 4 Tests PASS, tsc ohne Ausgabe.

- [ ] **Step 5: Commit**

```bash
git add src/components/feedback/FeedbackButton.tsx src/components/feedback/FeedbackButton.test.tsx
git commit -m "feat(qm): Feedback-Dialog mit Sternen und den drei Fragen (AGE-300)"
```

---

### Task 5: Einbau in den `AppShell`

**Files:**
- Modify: `src/components/AppShell.tsx` (Import oben; Einbau nach dem Off-Canvas-Block, um Zeile 358)

**Interfaces:**
- Consumes: `FeedbackButton` (Task 4).
- Produces: nichts.

- [ ] **Step 1: Einbauen**

Import zu den bestehenden Komponenten-Imports:

```tsx
import { FeedbackButton } from "./feedback/FeedbackButton";
```

Und **nach** dem schließenden `)}` des Off-Canvas-Blocks (`AppShell.tsx:357`), direkt vor dem letzten `</div>`:

```tsx
      {/* QM-Feedback (AGE-300, Spec §3.5) — bewusst außerhalb von <main>, damit der
          Button beim Seitenwechsel stehen bleibt und die Route mitwandert. Rendert
          sich selbst weg, wenn niemand eingeloggt ist. */}
      <FeedbackButton />
```

- [ ] **Step 2: Die volle Suite laufen lassen**

```bash
pnpm vitest run
pnpm typecheck
pnpm lint
```

Erwartet: alle Tests PASS (die 180 bestehenden + 7 neue), tsc und Lint sauber. **`src/config/nav.test.ts` muss unverändert grün sein** — wir haben die Navigation nicht angefasst, und das ist die Zusage aus dem Spec.

- [ ] **Step 3: In der laufenden App ansehen**

```bash
pnpm dev
```

**Achtung:** `pnpm dev` braucht eine Infisical-Session, und der Login geht nicht aus Claude Code heraus (kein TTY). Wenn keine Session steht, muss Donald ihn im Terminal ausführen. **`env=dev` zeigt auf die Prod-Supabase** — ein hier abgeschicktes Test-Feedback landet in der Live-DB. Entweder gegen die lokale DB laufen lassen oder die Zeile hinterher entfernen.

Prüfen: Button unten rechts sichtbar · Dialog öffnet · Absenden ohne Sterne gesperrt · nach dem Absenden erscheint der Toast · die Zeile trägt die richtige `route`.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppShell.tsx
git commit -m "feat(qm): Feedback-Button im AppShell einhängen (AGE-300)"
```

---

## Abschluss

- [ ] **Verifikation vor dem PR** — nicht behaupten, sondern zeigen:

```bash
supabase db reset
supabase test db supabase/tests/grants_test.sql supabase/tests/rls_test.sql
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/probe_potential_score.sql
pnpm vitest run && pnpm typecheck && pnpm lint
```

Alle vier müssen sauber sein. Die Probe muss **jede** Spalte auf `t` zeigen.

- [ ] **PR öffnen** gegen `main`, Titel im Conventional-Commit-Format (die CI erzwingt das):
  `feat(qm): Plattformweites QM-Feedback mit Sternen und drei Fragen (AGE-300)`

  In die Beschreibung gehört der Score-Fund — er ist die nicht offensichtliche Hälfte dieses PRs.

- [ ] **AGE-300 auf Done** setzen (Linear-MCP), sobald der PR gemergt und live verifiziert ist.

## Was dieser Plan bewusst nicht tut

| Weggelassen | Warum |
|---|---|
| Screenshot-Upload | Spec §3.5 nennt ihn „optional"; bräuchte Storage-Bucket + Policies + Größenlimit. |
| Anonymes Feedback | `feedback.profile_id` ist `not null`; ein anon-Insert auf der Live-DB wäre ein Tor, das man später bereut. |
| Automatisches Linear-Issue je Feedback | Spec §3.5: „MVP = nur speichern". |
| Admin-UI zum Lesen | §3.5 verlangt „für Admin sichtbar" — die Policy leistet das. Eine Oberfläche steht nicht im Spec. |
| CI-Schutz für den Score-Fix | Die `probe_*.sql` sind kein pgTAP und laufen bewusst nicht in CI. Rot/Grün wird lokal geführt (Task 2). Als Follow-up vermerkt. |

## Offen (nicht im Plan lösbar)

- **Ist überhaupt jemand `admin`?** `staff_roles` wird out of band per SQL provisioniert. Ohne einen `admin`-Eintrag greift `feedback_admin_read` ins Leere — die DB-Tests belegen die Policy, aber live vorführen lässt sie sich nur mit einem echten Admin. Vor dem Sommerfest zu klären; vermutlich derselbe Handgriff im SQL Editor wie die fehlenden Stufen-Logins.
