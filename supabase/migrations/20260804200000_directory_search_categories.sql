-- Kompass-Kategorien im Verzeichnis + Herkunft der offers/needs (AGE-494, 2026-08-04).
-- Change: openspec/changes/mvp-scope-navigation (Capabilities directory-search, matching).
--
-- WARUM DROP UND NICHT `create or replace`:
-- Das Issue verlangte „create or replace mit Defaults, damit bestehende Aufrufer
-- nicht brechen". Das täte das Gegenteil. Postgres identifiziert eine Funktion über
-- ihre Argumenttypliste; zwei zusätzliche text[]-Parameter ergeben eine ANDERE
-- Signatur, also eine ÜBERLADUNG neben der alten. Danach ist der Facetten-Baseline-
-- Aufruf `search_directory()` (src/lib/directory.ts:122) zwischen beiden Kandidaten
-- mehrdeutig (42725) — auch mit Named Args, weil in beiden Varianten alle Parameter
-- Defaults tragen. Verworfene Alternative: die alte Signatur stehen lassen und eine
-- zweite Funktion `search_directory_v2` einführen — zwei Namen für eine Sache, und
-- der Aufrufer müsste wissen, welchen er nimmt.
-- Die Aufrufer brechen dadurch trotzdem nicht: es gibt genau einen
-- (src/lib/directory.ts, zwei Call-Sites), und er übergibt Named Args.
--
-- WARUM coalesce(..., '{}'):
-- `array_agg(...) filter (where ...)` liefert über lauter NULL-Zeilen NULL, nicht
-- das leere Array. Ohne coalesce müsste jeder Client zwei Formen von „nichts"
-- unterscheiden — geprüft in supabase/tests/directory_search_test.sql.
--
-- WARUM EIN PARTIELLER UNIQUE-INDEX UND KEIN CONSTRAINT:
-- Der reiche Editor (AngeboteGesuchePage) darf legitim MEHRERE Einträge je
-- Kategorie führen; ein voller unique(profile_id, category) bräche ihn. Nur die
-- chip-erzeugten Zeilen müssen eindeutig sein, denn recompute_potential_score
-- summiert `count(*)` über offers/needs (20260613230000_potential_score.sql:110) —
-- eine doppelte Chip-Zeile aus zwei gleichzeitigen Speicherungen bliebe unsichtbar
-- und bliese den Score still auf.

-- ── 1. Herkunft der Zeilen ───────────────────────────────────────────────────
-- 'editor' als Default trifft auch jede BESTEHENDE Zeile korrekt: alles, was es
-- heute gibt, stammt aus dem reichen Editor oder dem alten Kompass-Durchlauf und
-- soll vom Chip-Picker nie stillschweigend gelöscht werden.
alter table public.offers
  add column source text not null default 'editor'
  check (source in ('editor', 'chip'));
alter table public.needs
  add column source text not null default 'editor'
  check (source in ('editor', 'chip'));

comment on column public.offers.source is
  'Welche Oberfläche die Zeile angelegt hat: `editor` (Suche & Biete, schreibt alle '
  'Spalten) oder `chip` (Kategorie-Auswahl im Profil / geführter Kompass). Entscheidet, '
  'ob das Abwählen einer Kategorie ohne Rückfrage löschen darf — NICHT über leere '
  'Spalten raten: ein reicher Eintrag kann nur aus einem eigenen Titel bestehen.';
comment on column public.needs.source is
  'Welche Oberfläche die Zeile angelegt hat: `editor` oder `chip`. Siehe offers.source.';

create unique index offers_chip_one_per_category
  on public.offers (profile_id, category) where source = 'chip';
create unique index needs_chip_one_per_category
  on public.needs (profile_id, category) where source = 'chip';

-- ── 2. search_directory ersetzen ─────────────────────────────────────────────
drop function public.search_directory(text, text, text, text, text, text);

create function public.search_directory(
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
         or p.search_doc @@ websearch_to_tsquery('german', p_query))
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

comment on function public.search_directory is
  'Mitgliederverzeichnis-Suche: deutsche Volltextsuche (search_doc) + Facetten '
  '(theme/branche/region/competency, bietet/sucht) + Kompass-Kategorien '
  '(p_offers/p_needs: ODER in der Gruppe, UND zwischen den Gruppen; leeres Array = '
  'kein Filter). Gibt zusätzlich offer_categories/need_categories zurück — distinct, '
  'ohne NULL, leeres Array statt NULL. SECURITY INVOKER — die RLS '
  '(profiles_select_self_or_discover) ist die Sichtbarkeitsgrenze: unterhalb von '
  '`discover` (rank 3) sieht ein Aufrufer höchstens die eigene Zeile. Listet nur '
  'is_public-Profile. Die Kategorien vergrößern die PREISGABE (was jemand sucht, '
  'nicht mehr nur dass er sucht), nicht die GRENZE.';

-- Nichts wird geerbt (AGE-312): Rechte auf der NEUEN Signatur aussprechen.
revoke all on function public.search_directory(text, text, text, text, text, text, text[], text[]) from public;
grant execute on function public.search_directory(text, text, text, text, text, text, text[], text[]) to authenticated;
