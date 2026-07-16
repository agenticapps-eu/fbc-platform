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

-- ── recompute_potential_score: Plattform-Feedback zählt nicht ────────────────
-- Vollständige Neudeklaration, weil Postgres keine partielle Änderung kennt. Gegen
-- 20260613230000_potential_score.sql ist AUSSCHLIESSLICH der Feedback-Select
-- geändert (+ `and ref_type is not null`); Gewichte, Sättigungen und der
-- Erfolgsradar sind unverändert. probe_potential_score.sql belegt das: seine
-- übrigen Assertions (Radar, Komponentenzahl, Gewichtung) müssen weiter halten.
create or replace function public.recompute_potential_score(p_profile_id uuid)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());

  -- Saturation constants: the count at which a component reaches 100 %.
  c_activity_saturation  constant numeric := 10;
  c_recommend_saturation constant numeric := 5;

  v_completion      int;
  v_compass_themes  int;
  v_activity_count  int;
  v_recommend_count int;
  v_feedback_count  int;
  v_feedback_avg    numeric;

  r_completion numeric;
  r_compass    numeric;
  r_activity   numeric;
  r_recommend  numeric;
  r_feedback   numeric;

  v_score       int;
  v_theme       text;
  v_compass_avg numeric;
  v_signal_count int;
  v_theme_score numeric;
  v_breakdown   jsonb;
begin
  -- AuthZ: a member may only (re)compute their OWN score. service_role / migration
  -- context (auth.uid() is null) is allowed for seeds and admin recomputes.
  if v_caller is not null and v_caller <> p_profile_id then
    raise exception 'recompute_potential_score: not allowed for another profile'
      using errcode = '42501';
  end if;

  -- ── 1. Component inputs (real data) ────────────────────────────────────────
  select coalesce(profile_completion, 0) into v_completion
  from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'recompute_potential_score: profile % not found', p_profile_id
      using errcode = 'P0002';
  end if;

  -- Compass: distinct themes answered with at least one numeric answer.
  select count(distinct cr.theme) into v_compass_themes
  from public.compass_responses cr
  where cr.profile_id = p_profile_id
    and cr.theme is not null
    and exists (
      select 1 from jsonb_each(coalesce(cr.answers, '{}'::jsonb)) e
      where jsonb_typeof(e.value) = 'number'
    );

  -- Aktivität: own engagement across the activity-producing tables.
  select
      (select count(*) from public.posts               where author_id  = p_profile_id)
    + (select count(*) from public.comments            where author_id  = p_profile_id)
    + (select count(*) from public.offers              where profile_id = p_profile_id)
    + (select count(*) from public.needs               where profile_id = p_profile_id)
    + (select count(*) from public.event_registrations where profile_id = p_profile_id)
  into v_activity_count;

  -- Empfehlungen: accepted incoming contact requests + awarded certifications.
  select
      (select count(*) from public.contact_requests
        where to_id = p_profile_id and status = 'accepted')
    + (select count(*) from public.profile_badges where profile_id = p_profile_id)
  into v_recommend_count;

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

  -- ── 2. Normalize to 0..1 ───────────────────────────────────────────────────
  r_completion := least(greatest(v_completion, 0) / 100.0, 1);
  r_compass    := least(v_compass_themes / 4.0, 1);
  r_activity   := least(v_activity_count / c_activity_saturation, 1);
  r_recommend  := least(v_recommend_count / c_recommend_saturation, 1);
  r_feedback   := case
                    when coalesce(v_feedback_count, 0) = 0 then 0
                    else least(greatest((v_feedback_avg - 1) / 4.0, 0), 1)
                  end;

  -- ── 3. Weighted sum → 0..100 ───────────────────────────────────────────────
  v_score := round(100 * (
      0.30 * r_completion
    + 0.25 * r_compass
    + 0.20 * r_activity
    + 0.15 * r_recommend
    + 0.10 * r_feedback
  ))::int;

  update public.profiles set potential_score = v_score where id = p_profile_id;

  -- ── 4. Erfolgsradar: theme scores (compass primary, activity fallback) ─────
  foreach v_theme in array array['sein', 'tun', 'haben', 'wirken'] loop
    select avg((e.value #>> '{}')::numeric) into v_compass_avg
    from public.compass_responses cr
    cross join lateral jsonb_each(coalesce(cr.answers, '{}'::jsonb)) e
    where cr.profile_id = p_profile_id
      and cr.theme = v_theme
      and jsonb_typeof(e.value) = 'number';

    if v_compass_avg is not null then
      v_theme_score := least(greatest(v_compass_avg, 0), 10);
    else
      select
          (select count(*) from public.offers
            where profile_id = p_profile_id and theme = v_theme)
        + (select count(*) from public.needs
            where profile_id = p_profile_id and theme = v_theme)
        + (select count(*) from public.profile_interests
            where profile_id = p_profile_id and theme = v_theme)
      into v_signal_count;
      v_theme_score := least(v_signal_count * 2.0, 10);
    end if;

    insert into public.profile_theme_scores (profile_id, theme, score)
    values (p_profile_id, v_theme, round(v_theme_score, 1))
    on conflict (profile_id, theme) do update set score = excluded.score;
  end loop;

  -- ── 5. Transparent breakdown (points = weight × ratio) ─────────────────────
  v_breakdown := jsonb_build_object(
    'score', v_score,
    'components', jsonb_build_array(
      jsonb_build_object(
        'key', 'completion', 'label', 'Profilvollständigkeit', 'weight', 30,
        'points', round(30 * r_completion, 1),
        'detail', v_completion || ' % ausgefüllt'),
      jsonb_build_object(
        'key', 'compass', 'label', 'Compass', 'weight', 25,
        'points', round(25 * r_compass, 1),
        'detail', v_compass_themes || '/4 Themen beantwortet'),
      jsonb_build_object(
        'key', 'activity', 'label', 'Aktivität', 'weight', 20,
        'points', round(20 * r_activity, 1),
        'detail', v_activity_count || ' Aktivitäten'),
      jsonb_build_object(
        'key', 'recommendations', 'label', 'Empfehlungen', 'weight', 15,
        'points', round(15 * r_recommend, 1),
        'detail', v_recommend_count || ' Empfehlungen'),
      jsonb_build_object(
        'key', 'feedback', 'label', 'Feedback', 'weight', 10,
        'points', round(10 * r_feedback, 1),
        'detail', case
                    when coalesce(v_feedback_count, 0) = 0 then 'Noch kein Feedback'
                    else round(v_feedback_avg, 1) || ' ★ Ø (' || v_feedback_count || ')'
                  end)
    )
  );

  return v_breakdown;
end;
$$;
