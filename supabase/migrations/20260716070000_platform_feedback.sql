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
