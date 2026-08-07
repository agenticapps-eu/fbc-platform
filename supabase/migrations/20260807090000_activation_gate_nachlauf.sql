-- Nachlauf zum Aktivierungs-Gate (AGE-495 / C3) — zwei Befunde aus dem
-- unabhaengigen Code-Review 8.7 vom 2026-08-07.
--
-- Entscheidung Donald, 2026-08-07: beide werden geschlossen, bevor C10 laeuft.
-- Bei importierten Konten ist das Gate die EINZIGE Huerde; jede Flaeche, die
-- daran vorbeigeht, ist dort keine Randnotiz.
--
-- ── 1. recompute_potential_score war ungegatet (Befund R1) ──────────────────
-- Verworfene Alternative: den Grant `to authenticated` entziehen. Das waere
-- die haertere Sperre, nimmt aber dem BESTAETIGTEN Mitglied die Neuberechnung
-- seines eigenen Potenzial-Scores — die Funktion ist genau dafuer da und wird
-- aus src/lib/dashboard.ts gelesen. Der Wachter kostet eine Zeile und laesst
-- den erwuenschten Fall unberuehrt.
--
-- Vollstaendige Neudeklaration, weil Postgres keine partielle Aenderung kennt.
-- Gegen 20260804200100 ist AUSSCHLIESSLICH der Wachter ergaenzt — Gewichte,
-- Saettigungen, Feedback-Select, Erfolgsradar und das Label „Kompass" sind
-- unveraendert uebernommen.

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

  -- AGE-495 (Review 8.7, R1): und er muss seinen Zugang bestaetigt haben.
  -- Der Zweig oben ist `id = auth.uid()` — genau das, was der Kopf von
  -- 20260806080100 als „die Luecke" benennt: der Angreifer meldet sich MIT DEM
  -- VERTEILTEN PASSWORT als das Mitglied an, fuer die Datenbank IST er das
  -- Mitglied. Ohne diese Zeile berichtet die Funktion ihm Zaehlungen ueber
  -- Beitraege, Angebote, Anmeldungen und Empfehlungen des Bestohlenen und
  -- SCHREIBT `profiles.potential_score` und `profile_theme_scores` — beides an
  -- gegateten Write-Policies vorbei.
  --
  -- `v_caller is not null` bleibt noetig: Seeds und service_role laufen mit
  -- auth.uid() = null, und is_activated() waere dort false.
  if v_caller is not null and not public.is_activated() then
    raise exception 'recompute_potential_score: not activated'
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
        'key', 'compass', 'label', 'Kompass', 'weight', 25,
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


-- ── 2. Die beiden Zaehler sperrten das Schaufenster zu (Befund T-D) ─────────
-- `post_engagement_counts` und `event_registration_counts` sind an `anon`
-- vergeben — der Grant blieb beim Gate-Change stehen, der Konjunkt kam
-- unbedingt dazu. Fuer einen ausgeloggten Aufrufer ist `is_activated()` false,
-- also lieferten beide leer. Folge seit dem 06.08.: jeder ausgeloggte Besucher
-- sah 0 Likes, 0 Kommentare, 0 Teilnehmer. Still — src/lib/feed.ts:313 und
-- src/lib/events.ts:256 melden nur einen FEHLER an Sentry, und es kam keiner.
--
-- Verworfene Alternative: den Grant `to anon` entziehen und die Zahlen im
-- Schaufenster ausblenden. Das waere die kleinere Codeaenderung, kehrt aber
-- Detlevs erklaerten Wunsch um — das Schaufenster soll fuer Ausgeloggte
-- vollstaendig aussehen. Die Zahlen gehoeren zu den Beitraegen, die
-- posts_select_public_anon ohnehin freigibt.
--
-- Das Gate bleibt fuer ANGEMELDETE unveraendert scharf: ein eingeloggtes, nicht
-- bestaetigtes Konto bekommt weiterhin nichts. Es soll nicht mehr sehen als ein
-- ausgeloggter Besucher — aber auch nicht weniger als noetig, und die Zahlen
-- sind Aggregate ueber Flaechen, die anon ohnehin sieht.
-- Vollstaendige Neudeklaration; gegen 20260806080100 ist AUSSCHLIESSLICH der
-- eine Konjunkt geaendert.

create or replace function public.post_engagement_counts(p_post_ids uuid[])
returns table (post_id uuid, like_count bigint, comment_count bigint)
language sql stable security definer set search_path = public
as $$
  select
    p.id,
    (select count(*) from public.post_likes pl where pl.post_id = p.id),
    (select count(*) from public.comments  c  where c.post_id  = p.id)
  from public.posts p
  where cardinality(p_post_ids) <= 200
    and p.id = any (p_post_ids)
    -- AGE-495 (Review 8.7, T-D): fuer ANGEMELDETE gilt das Gate, fuer den
    -- ausgeloggten Besucher nicht. Beide Funktionen sind an `anon` vergeben,
    -- und `is_activated()` liefert ohne Sitzung false — der unbedingte Konjunkt
    -- liess das Schaufenster deshalb still auf 0 laufen: 0 Likes, 0 Kommentare,
    -- 0 Teilnehmer, ohne Fehler und ohne Signal. Die Sichtbarkeitszweige
    -- darunter begrenzen anon ohnehin auf `public`.
    and ((select auth.uid()) is null or public.is_activated())
    and (
      p.visibility = 'public'
      or ( p.visibility = 'members' and public.has_level(4) )
      or p.author_id = (select auth.uid())
    );
$$;
grant execute on function public.post_engagement_counts(uuid[]) to anon, authenticated;

create or replace function public.event_registration_counts(p_event_ids uuid[])
returns table (event_id uuid, registered_count bigint, waitlist_count bigint)
language sql stable security definer set search_path = public
as $$
  select
    e.id,
    (select count(*) from public.event_registrations r
       where r.event_id = e.id and r.status = 'registered'),
    (select count(*) from public.event_registrations r
       where r.event_id = e.id and r.status = 'waitlist')
  from public.events e
  where cardinality(p_event_ids) <= 200
    and e.id = any (p_event_ids)
    -- AGE-495 (Review 8.7, T-D): fuer ANGEMELDETE gilt das Gate, fuer den
    -- ausgeloggten Besucher nicht. Beide Funktionen sind an `anon` vergeben,
    -- und `is_activated()` liefert ohne Sitzung false — der unbedingte Konjunkt
    -- liess das Schaufenster deshalb still auf 0 laufen: 0 Likes, 0 Kommentare,
    -- 0 Teilnehmer, ohne Fehler und ohne Signal. Die Sichtbarkeitszweige
    -- darunter begrenzen anon ohnehin auf `public`.
    and ((select auth.uid()) is null or public.is_activated())
    and (
      e.visibility = 'public'
      or ( e.visibility = 'members' and (select auth.uid()) is not null )
      or e.host_id = (select auth.uid())
    );
$$;
grant execute on function public.event_registration_counts(uuid[]) to anon, authenticated;
