-- AGE-601 — `members` bedeutet ab jetzt „jedes aktivierte Mitglied".
--
-- ENTSCHEIDUNG (Donald, 25.08.2026). Bis hierher verlangte der `members`-Zweig
-- zusaetzlich `has_level(4)` (`exchange`). Der Befund, der das gekippt hat: in PROD
-- traegt JEDER Beitrag `members` und kein einziger `public`. Unter Rang 4 war der
-- Feed also nicht duenner, sondern LEER — eine Flaeche, die zum Mitmachen einlaedt
-- und ihrem Besucher nichts zeigen kann.
--
-- DER PREIS IST AUSDRUECKLICH IN KAUF GENOMMEN: die Anmeldung ist offen, `basic`
-- ist der Selbstregistrierungs-Rang, und die AKTIVIERUNG wird damit die einzige
-- Huerde vor dem Feed. Die Variante „die Anmeldung zusaetzlich schliessen" wurde
-- erwogen und NICHT gewaehlt. Das kippt AGE-311 an dieser einen Stelle.
--
-- WAS NICHT MITKIPPT: `exchange` bleibt die Schwelle fuer Kontaktanfragen
-- (`cr_insert_self_exchange`) und Event-Teilnahme (`register_for_event`). Das sind
-- eigene Entscheidungen mit eigener Begruendung; sie stehen hier nur, damit
-- niemand sie fuer vergessen haelt.
--
-- VIER STELLEN, EINE MIGRATION
-- Das Praedikat liegt vierfach vor. Abgezaehlt am PROD-KATALOG, nicht aus den
-- Migrationen geschlossen — Migrations-Archaeologie kann eine ueberschriebene
-- Fassung fuer lebendig halten:
--
--   select ... from pg_policy where pg_get_expr(polqual,polrelid) like '%has_level%'
--   union all select ... from pg_proc where pg_get_functiondef(oid) like '%has_level(4)%'
--
--   1. policy posts_select_by_visibility  (die Regel selbst)
--   2. post_engagement_counts             (Zaehler an der Karte)
--   3. post_media_lesbar                  (Signatur fuers Bild)
--   4. former_member_entries              (Ehemaligen-Markierung)
--
-- Alle vier hier, weil sie EINE Aussage sind. Drei zu aendern und eine zu vergessen
-- ergaebe einen Feed, dessen Zaehler oder Bilder nicht zu seinen Zeilen passen — und
-- das saehe aus wie ein Bug in der Oberflaeche, nicht wie eine vergessene Zeile.
--
-- NICHT ANGEFASST, UND DAS IST DER BELEG FUER EINE REGEL: `feed_tag_counts` und
-- `feed_top_authors` laufen `security invoker` und tragen bewusst KEINE Abschrift.
-- Sie folgen dieser Aenderung von selbst. Genau das ist der in `community-feed`
-- ausgeschriebene Grund, ein Praedikat nicht abzuschreiben — hier zahlt er sich
-- zum ersten Mal messbar aus: die Aenderung kostet vier Stellen statt sechs.
--
-- Die sechs weiteren `has_level`-Policies (offers_select, needs_select,
-- interests_select, profile_badges_select, profiles_select_self_or_discover,
-- theme_scores_select) tragen KEINEN `members`-Zweig — das sind die
-- `discover`-Gates des Verzeichnisses und bleiben unberuehrt.

-- ── 1. Die Regel selbst ─────────────────────────────────────────────────────
-- `is_activated()` steht unveraendert davor und ist ab jetzt die einzige Huerde.
drop policy if exists posts_select_by_visibility on public.posts;
create policy posts_select_by_visibility on public.posts
  for select to authenticated
  using (
    public.is_activated()
    and (
      visibility = 'public'
      or visibility = 'members'
      or author_id = (select auth.uid())
    )
  );

comment on policy posts_select_by_visibility on public.posts is
  'AGE-601: `members` heisst jedes aktivierte Mitglied. Keine Stufenschwelle mehr '
  '— in PROD traegt jeder Beitrag `members`, eine Schwelle darueber machte den Feed '
  'nicht duenner, sondern leer. Die Huerde ist is_activated().';

-- ── 2. Zaehler an der Karte ─────────────────────────────────────────────────
create or replace function public.post_engagement_counts(p_post_ids uuid[])
  returns table(post_id uuid, like_count bigint, comment_count bigint)
  language sql stable security definer set search_path to 'public'
as $$
  select
    p.id,
    (select count(*) from public.post_likes pl where pl.post_id = p.id),
    (select count(*) from public.comments  c  where c.post_id  = p.id)
  from public.posts p
  where cardinality(p_post_ids) <= 200
    and p.id = any (p_post_ids)
    -- AGE-495: fuer ANGEMELDETE gilt das Gate, fuer den ausgeloggten Besucher
    -- nicht. Die Funktion ist an `anon` vergeben, und `is_activated()` liefert
    -- ohne Sitzung false — ein unbedingter Konjunkt liesse das Schaufenster still
    -- auf 0 laufen, ohne Fehler und ohne Signal.
    and ((select auth.uid()) is null or public.is_activated())
    and (
      p.visibility = 'public'
      -- AGE-601: kein has_level(4) mehr. Der anon-Fall bleibt trotzdem auf
      -- `public` beschraenkt — er scheitert eine Zeile hoeher an is_activated(),
      -- sobald eine Sitzung besteht, und ohne Sitzung greift dieser Zweig gar
      -- nicht, weil `members` fuer anon nie erreichbar war.
      or ( p.visibility = 'members' and public.is_activated() )
      or p.author_id = (select auth.uid())
    );
$$;

-- ── 3. Signatur fuers Bild ──────────────────────────────────────────────────
create or replace function public.post_media_lesbar(objektname text)
  returns boolean
  language sql stable security definer set search_path to ''
as $$
  select exists (
    select 1
      from public.post_media m
      join public.posts p on p.id = m.post_id
     where m.storage_path = objektname
       and case
             -- Ohne Session: nur oeffentliche Beitraege. Spiegelt
             -- posts_select_public_anon (20260612082726). UNVERAENDERT durch
             -- AGE-601 — ausgeloggt aendert sich nichts.
             when (select auth.uid()) is null then p.visibility = 'public'
             -- Mit Session: posts_select_by_visibility (AGE-601).
             else public.is_activated()
                  and ( p.visibility = 'public'
                        or p.visibility = 'members'
                        or p.author_id = (select auth.uid()) )
           end
  );
$$;

-- ── 4. Ehemaligen-Markierung ────────────────────────────────────────────────
create or replace function public.former_member_entries(
  p_post_ids uuid[] default '{}'::uuid[],
  p_comment_ids uuid[] default '{}'::uuid[])
  returns table(kind text, entry_id uuid, former boolean)
  language plpgsql stable security definer set search_path to ''
as $$
declare
  v_grenze constant int := 200;
  v_anzahl int := coalesce(cardinality(p_post_ids), 0)
                + coalesce(cardinality(p_comment_ids), 0);
begin
  if array_ndims(p_post_ids) > 1 or array_ndims(p_comment_ids) > 1 then
    raise exception 'mehrdimensionale Arrays werden nicht angenommen'
      using errcode = '22023';
  end if;

  if v_anzahl > v_grenze then
    raise exception 'zu viele Eintraege: % (hoechstens %)', v_anzahl, v_grenze
      using errcode = '22023';
  end if;

  return query
    -- Die sichtbaren Beitraege — die der Aufrufer gefragt hat UND die, unter
    -- denen die gefragten Kommentare haengen. Beides in EINER Menge, damit das
    -- abgeschriebene Praedikat auch nur einmal dasteht.
    with sichtbar as (
      select p.id, p.author_id
        from public.posts p
       where public.is_activated()
         and ( p.visibility = 'public'
               or p.visibility = 'members'          -- AGE-601: kein has_level(4)
               or p.author_id = (select auth.uid()) )
         and ( p.id = any(p_post_ids)
               or exists (select 1
                            from public.comments c
                           where c.id = any(p_comment_ids)
                             and c.post_id = p.id) )
    )
    select 'post'::text, s.id,
           -- NICHT `not is_activated_profile(...)`: das waere auch fuer ein nie
           -- bestaetigtes Konto wahr, und das wurde nicht entfernt, es ist nur
           -- nie angekommen.
           (pr.disabled_at is not null or pr.deleted_at is not null)
      from sichtbar s
      join public.profiles pr on pr.id = s.author_id
     where s.id = any(p_post_ids)
    union all
    select 'comment'::text, c.id,
           (pr.disabled_at is not null or pr.deleted_at is not null)
      from public.comments c
      join sichtbar s on s.id = c.post_id
      join public.profiles pr on pr.id = c.author_id
     where c.id = any(p_comment_ids);
end $$;
