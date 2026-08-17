-- Verzeichnissuche findet jetzt auch angefangene Wörter (AGE-566).
-- Donald, 2026-08-17.
--
-- ══ DER BEFUND ═════════════════════════════════════════════════════════════
-- „Det" fand „Detlev Krause" nicht — erst der ausgeschriebene Name traf.
-- Gemeldet aus der Vorführ-Umgebung, dann gemessen: `websearch_to_tsquery`
-- erzeugt VOLLE Lexeme. `websearch_to_tsquery('german','Det')` liefert die
-- Anfrage `'det'`, und `'det'` steht in keinem `search_doc` — dort steht
-- `'detlev'`. Am selben Bestand gemessen: `websearch` 0 Treffer,
-- `to_tsquery('german','det:*')` 1 Treffer.
--
-- Wer in einem Suchfeld tippt, erwartet Treffer WÄHREND des Tippens. Eine
-- Suche, die erst beim letzten Buchstaben anspringt, ist für den Benutzer
-- kaputt, auch wenn sie tut, was in ihrer Signatur steht.
--
-- ══ WARUM EIN EIGENER HELFER UND KEIN `|| ':*'` AN DIE ANFRAGE ═════════════
-- `websearch_to_tsquery` gibt eine `tsquery` zurück, an die sich kein Präfix
-- mehr anhängen lässt — der Stern gehört in die EINGABE von `to_tsquery`, und
-- die verlangt eine bereits zerlegte, mit Operatoren verbundene Zeichenkette.
-- Roh durchgereicht wäre sie ausserdem eine Fehlerquelle: `to_tsquery` bricht
-- bei einem einzelnen `&`, `!` oder einer offenen Klammer mit einem Syntaxfehler
-- ab, und ein Tippfehler im Suchfeld darf keine Fehlermeldung erzeugen.
--
-- Der Helfer zerlegt deshalb selbst: alles ausser Buchstaben und Ziffern wird zu
-- Trennzeichen, jedes verbleibende Wort bekommt `:*`, verbunden mit `&`. Damit
-- ist die Eingabe für `to_tsquery` konstruktionsbedingt gültig — es kann kein
-- Zeichen mehr durchrutschen, das als Operator gelesen würde.
--
-- UND-Verknüpfung zwischen den Wörtern, wie bisher: „det kra" soll den finden,
-- auf den BEIDES passt, nicht die Vereinigung. Das entspricht dem Verhalten von
-- `websearch_to_tsquery` bei mehreren Wörtern.
--
-- VERWORFEN: zusätzlich `ilike` über `name`. Es fände „eter" in „Peter" und
-- damit Treffer, die niemand sucht, und es umginge die Stammformen, die die
-- deutsche Konfiguration gerade leistet („Beratung" findet „beraten").

create or replace function public.suchbegriff_zu_tsquery(p_query text)
  returns tsquery
  language sql
  immutable
  set search_path = ''
as $$
  select case
    when coalesce(btrim(p_query), '') = '' then null
    else to_tsquery('german', nullif((
      select string_agg(wort || ':*', ' & ')
        from unnest(
               string_to_array(
                 btrim(regexp_replace(lower(p_query), '[^[:alnum:]äöüß]+', ' ', 'g')),
                 ' ')) as wort
       where wort <> ''
    ), ''))
  end;
$$;

comment on function public.suchbegriff_zu_tsquery(text) is
  'Freitext aus einem Suchfeld → PRAEFIX-tsquery (AGE-566). Jedes Wort bekommt '
  ':*, verbunden mit &. Zerlegt selbst statt durchzureichen: to_tsquery bricht '
  'sonst bei einem einzelnen & oder einer offenen Klammer mit einem Syntaxfehler '
  'ab, und ein Tippfehler im Suchfeld darf keine Fehlermeldung erzeugen. '
  'Liefert null bei leerer Eingabe — der Aufrufer filtert dann nicht.';

revoke execute on function public.suchbegriff_zu_tsquery(text) from public;
grant  execute on function public.suchbegriff_zu_tsquery(text) to anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- `search_directory` — wortgleich zu 20260804200000, EINE Zeile anders: die
-- Volltextbedingung geht über den Helfer statt über `websearch_to_tsquery`.
-- Signatur, Rückgabespalten, Reihenfolge und alle übrigen Filter unverändert;
-- `directory_search_test.sql` vergleicht die Projektion gegen den Katalog.

create or replace function public.search_directory(
  p_query      text default null,
  p_theme      text default null,
  p_branche    text default null,
  p_region     text default null,
  p_competency text default null,
  p_offering   text default null,
  p_offers     text[] default null,
  p_needs      text[] default null
)
returns table (
  id               uuid,
  name             text,
  avatar_url       text,
  region           text,
  company          text,
  short_bio        text,
  branche          text,
  tier             text,
  roles            text[],
  competencies     text[],
  has_offers       boolean,
  has_needs        boolean,
  offer_categories text[],
  need_categories  text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id, p.name, p.avatar_url, p.region, p.company, p.short_bio,
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
    and (p_query is null or p_query = ''
         or p.search_doc @@ public.suchbegriff_zu_tsquery(p_query))
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
  order by p.name nulls last;
$$;
