-- Abgestufte Namensauflösung: ein geteilter Resolver für jeden Klarnamen (AGE-291).
--
-- ENTSCHEIDUNG 1 — Die Schwelle ist die AKTIVIERUNG, nicht eine Stufe.
-- Donald, 26.08.2026. Der ältere Plan setzte sie auf `has_level(4)` (`exchange`).
-- AGE-601 macht `members` zu „jedes aktivierte Mitglied" und öffnet damit den Feed
-- für genau die Menge, die eine `exchange`-Schwelle maskiert hätte: ein voller
-- Feed, in dem kein Autor einen Namen trägt. Die beiden stehen nicht technisch
-- gegeneinander, sondern im Zweck — und der Zweck des Feeds gewinnt.
--
-- ENTSCHEIDUNG 2 — Gebaut, OBWOHL heute nichts leckt. Donald, 26.08.2026.
-- Am PROD-Katalog abgezählt (zwölf namenstragende Funktionen, eine View): kein
-- Aufrufer unterhalb der Schwelle bekommt heute einen fremden Klarnamen. Die
-- profiles-RLS trägt es bereits:
--
--   profiles_select_self_or_discover:
--     is_activated() and activated_at is not null and disabled_at is null
--     and deleted_at is null and (id = auth.uid() or has_level(3))
--
-- Der erste Konjunkt ist zeichengleich mit der Bedingung dieses Resolvers. Wer
-- maskiert würde, bekommt null Zeilen — der Maskierungs-Zweig ist über jede
-- heutige Fläche unerreichbar.
--
-- Das ist ausdrücklich kein Einwand, sondern der Zuschnitt: der Resolver ist
-- TIEFENVERTEIDIGUNG. Er trägt die Zusage an dem Tag, an dem eine neue Fläche das
-- Gate vergisst — und `profiles_public` zeigt, dass das kein Gedankenspiel ist:
-- die View steht auf `security_invoker=off` und umgeht die RLS vollständig, ihr
-- `is_activated()` im WHERE ist das EINZIGE, was den Aufrufer prüft. Fiele es bei
-- einer künftigen Änderung heraus, läge jeder Name offen.
--
-- Die Verwandtschaft der beiden Bedingungen ist deshalb bewusst NICHT
-- wegabstrahiert: `is_activated()` bleibt das Gate, der Resolver ruft es ein
-- zweites Mal. Zwei Prüfungen, die zusammen fallen müssten, sind keine zwei.
--
-- ENTSCHEIDUNG 3 — Drei Leckwege, nicht einer.
-- Die Ausgabespalte ist der offensichtliche. Die beiden anderen wurden beim
-- Abzählen von `search_directory` gefunden und sind ohne den ersten wertlos:
--
--   * `order by p.name` — die alphabetische Position einer maskierten Zeile
--     verrät den Namen, den die Spalte gerade verschweigt. Sortiert wird jetzt
--     nach dem AUFGELÖSTEN Namen, also nach genau dem, was ausgegeben wird.
--   * `search_doc @@ …` — `search_doc` enthält den Namen. „Müller" eingeben und
--     sehen, ob eine maskierte Zeile stehen bleibt, ist ein Orakel auf den Namen.
--
-- Der Volltext wird für einen maskierbaren Aufrufer deshalb GANZ gesperrt, statt
-- den Namen aus einem zweiten `tsvector` herauszuhalten. Die Alternative kostete
-- eine weitere generierte Spalte auf `profiles` — und damit einen Grant, den
-- Golden-Snapshot und die Preisgabe ab `discover`, für eine Menge Aufrufer, die
-- ohnehin null Zeilen bekommt. Die kleinere Sache, die die Zusage erfüllt.
--
-- ENTSCHEIDUNG 4 — `chat.ts` bleibt unangetastet.
-- Es liest `public.profiles` unmittelbar, nicht die View. Die RLS-Policy oben
-- erzwingt dort bereits genau diese Schwelle. Es auf `profiles_public` umzustellen
-- hieße, `is_public = false` mitzuerben: ein Gesprächspartner, der sich aus dem
-- Verzeichnis abgemeldet hat, verschwände aus dem eigenen Chat. Das ist eine
-- Verhaltensänderung und gehört nicht in diesen Diff.

-- ── 1. Der Resolver ─────────────────────────────────────────────────────────
create or replace function public.resolve_display_name(p_owner uuid, p_name text)
returns text
language sql
stable
set search_path to ''
as $$
  select case
    when p_owner = (select auth.uid()) then p_name
    when public.is_activated()        then p_name
    else 'Mitglied'
  end;
$$;

comment on function public.resolve_display_name(uuid, text) is
  'AGE-291: gibt den Klarnamen heraus, wenn der AUFRUFER die Zeile besitzt oder '
  'aktiviert ist, sonst die Maske. Tiefenverteidigung — jede heutige Fläche ist '
  'zusätzlich durch is_activated() gegatet.';

-- Postgres verschenkt EXECUTE implizit an PUBLIC, und anon ist Mitglied von
-- PUBLIC (AGE-602, Abschnitt 5). Ohne diese Zeile stünde die Funktion als
-- siebter Eintrag in der abgeschlossenen Liste von grants_test.sql.
-- `alter default privileges … revoke` wäre hier wirkungslos — bei FUNKTIONEN
-- trägt nur der namentliche Entzug.
revoke execute on function public.resolve_display_name(uuid, text) from public;
grant  execute on function public.resolve_display_name(uuid, text) to authenticated;

-- ── 2. profiles_public ──────────────────────────────────────────────────────
-- Deckt Feed, Events, Profilansicht, Matching-Hub, Kontaktanfragen UND
-- feed_top_authors mit ab — letzteres liest die View, statt das Prädikat
-- abzuschreiben, und folgt deshalb von selbst.
-- `create or replace` erhält Rechte und Abhängigkeiten; die Spaltenliste bleibt
-- zeichengleich, nur der Ausdruck hinter `name` ändert sich.
create or replace view public.profiles_public with (security_invoker=off) as
  select
    id,
    public.resolve_display_name(id, name) as name,
    avatar_url,
    region,
    company,
    short_bio,
    tier,
    roles,
    cover_url
  from public.profiles
  where is_public
    and public.is_activated()
    and activated_at is not null
    and disabled_at is null
    and deleted_at is null;

-- ── 3. search_directory ─────────────────────────────────────────────────────
-- Unverändert bis auf drei Stellen: die Ausgabespalte, die Sortierung und die
-- Bindung des Volltexts an das Namensrecht (Entscheidung 3).
create or replace function public.search_directory(
  p_query text default null, p_theme text default null, p_branche text default null,
  p_region text default null, p_competency text default null, p_offering text default null,
  p_offers text[] default null, p_needs text[] default null)
returns table(id uuid, name text, avatar_url text, cover_url text, region text,
              company text, short_bio text, branche text, tier text, roles text[],
              competencies text[], has_offers boolean, has_needs boolean,
              offer_categories text[], need_categories text[])
language sql
stable
set search_path to ''
as $$
  select
    p.id,
    public.resolve_display_name(p.id, p.name),
    p.avatar_url, p.cover_url, p.region, p.company, p.short_bio,
    p.branche, p.tier, p.roles, p.competencies,
    exists (select 1 from public.offers o where o.profile_id = p.id) as has_offers,
    exists (select 1 from public.needs  n where n.profile_id = p.id) as has_needs,
    coalesce((select array_agg(distinct o.category order by o.category)
              from public.offers o
              where o.profile_id = p.id and o.category is not null), '{}'::text[]),
    coalesce((select array_agg(distinct n.category order by n.category)
              from public.needs n
              where n.profile_id = p.id and n.category is not null), '{}'::text[])
  from public.profiles p
  where p.is_public
    -- Der Volltext hängt am Namensrecht: `search_doc` enthält den Namen, und ein
    -- Treffer auf einer maskierten Zeile beantwortet genau die Frage, die die
    -- Maske verschweigt.
    and (p_query is null or p_query = ''
         or ((public.is_activated() or p.id = (select auth.uid()))
             and p.search_doc @@ public.suchbegriff_zu_tsquery(p_query)))
    and (p_branche is null or p_branche = '' or p.branche = p_branche)
    and (p_region is null or p_region = '' or p.region = p_region)
    and (p_competency is null or p_competency = '' or p.competencies @> array[p_competency])
    and (p_theme is null or p_theme = '' or exists (
           select 1 from public.offers o where o.profile_id = p.id and o.theme = p_theme
           union all
           select 1 from public.needs n where n.profile_id = p.id and n.theme = p_theme
           union all
           select 1 from public.profile_interests pi
             where pi.profile_id = p.id and pi.theme = p_theme
         ))
    and (p_offering is null or p_offering = ''
         or (p_offering = 'offers' and exists (select 1 from public.offers o where o.profile_id = p.id))
         or (p_offering = 'needs'  and exists (select 1 from public.needs  n where n.profile_id = p.id)))
    -- ODER innerhalb einer Gruppe (&&), UND zwischen den Gruppen (zwei Klauseln).
    -- cardinality(...) = 0 fängt das leere Array ab: es soll NICHT filtern, sonst
    -- leert ein „alle Chips abgewählt" die Liste statt sie freizugeben.
    and (p_offers is null or cardinality(p_offers) = 0 or exists (
           select 1 from public.offers o
           where o.profile_id = p.id and o.category = any(p_offers)))
    and (p_needs is null or cardinality(p_needs) = 0 or exists (
           select 1 from public.needs n
           where n.profile_id = p.id and n.category = any(p_needs)))
  -- Nach dem AUFGELÖSTEN Namen, nicht nach der rohen Spalte: sonst steht eine
  -- maskierte Zeile an ihrer alphabetischen Position und verrät sie damit.
  order by public.resolve_display_name(p.id, p.name) nulls last;
$$;

-- ── 4. list_routing_queue ───────────────────────────────────────────────────
-- Liest `public.profiles` unmittelbar (SECURITY DEFINER) und schreibt das
-- Prädikat nicht ab, sondern gatet über is_activated() + is_matching_manager().
-- Ein Matching-Manager ist damit immer aktiviert, der Resolver gibt hier also
-- stets den Klarnamen heraus. Er steht trotzdem da: fiele das Gate künftig
-- weg, trüge der Resolver — das ist der ganze Zweck von Entscheidung 2.
create or replace function public.list_routing_queue()
returns table(id uuid, match_id uuid, status text, routing text, volume_band text,
              score integer, member_a_name text, member_b_name text,
              need_category text, need_title text, assigned_to uuid,
              created_at timestamp with time zone)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    q.id, q.match_id, q.status, q.routing, q.volume_band,
    m.score,
    public.resolve_display_name(pa.id, pa.name),
    public.resolve_display_name(pb.id, pb.name),
    n.category, n.title, q.assigned_to, q.created_at
  from public.routing_queue q
  join public.matches  m  on m.id = q.match_id
  join public.profiles pa on pa.id = m.a_profile_id
  join public.profiles pb on pb.id = m.b_profile_id
  left join public.needs n on n.id = q.need_id
  where public.is_activated() and public.is_matching_manager()   -- AGE-495
  order by q.created_at desc;
$$;
