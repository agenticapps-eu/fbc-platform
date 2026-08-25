-- Das Cover steht im Verzeichnis-Rückgabesatz (AGE-595).
-- Donald, 2026-08-25.
--
-- ══ WARUM ══════════════════════════════════════════════════════════════════
-- Die Karte im Mitgliederverzeichnis zeigt heute nur den Avatar, obwohl das
-- Hintergrundbild gepflegt ist und auf jedem öffentlichen Profil steht. Damit
-- die Karte es zeigen kann, ohne je Mitglied eine zweite Abfrage zu stellen,
-- wandert `cover_url` in die Projektion.
--
-- Die Preisgabe wächst dadurch NICHT. Die Spalte liegt bereits in
-- `profiles_public` (20260811090000) und ist auf jedem öffentlichen Profil zu
-- sehen; es gilt dieselbe Grenze wie für den Rest der Projektion — `is_public`
-- plus das Rang-Gate der Basistabelle.
--
-- ══ WARUM DROP UND NICHT `CREATE OR REPLACE` ═══════════════════════════════
-- Weil sich der RÜCKGABETYP ändert. `create or replace function` kann ihn nicht
-- ändern; Postgres weist das mit `42P13` ab. Das ist ein ANDERER Grund als bei
-- AGE-494 (20260804200000), wo die ARGUMENTLISTE wuchs und ein `replace` eine
-- Überladung registriert hätte statt zu ersetzen. Die beiden Zwänge sind
-- voneinander unabhängig: eine spätere Änderung, die nur die zurückgegebenen
-- Spalten verbreitert, trifft allein auf diesen hier.
--
-- Folge, und sie ist die eigentliche Falle: ein `drop` nimmt die Rechte MIT.
-- Die neue Funktion erbt sie nicht, sondern bekommt die Default Privileges der
-- Instanz — und die schliessen `EXECUTE` für `PUBLIC` ein. Ohne das `revoke`
-- unten dürfte `anon` die Funktion ausführen. `directory_search_test.sql` prüft
-- beide Richtungen: dass `anon` es nicht darf UND dass `authenticated` es darf.
--
-- ══ WARUM ZWEI FUNKTIONEN IN EINER MIGRATION ═══════════════════════════════
-- `admin_list_members` speist dieselbe `MemberCard`, und die Admin-Anforderung
-- verlangt ausdrücklich Spalten-Parität mit `search_directory`
-- (openspec/specs/admin/spec.md). `cover_url` nur in einer der beiden brächte
-- den Paritätstest und die TypeScript-Typen zu Fall. Sie gehören deshalb in
-- denselben Schritt, nicht in zwei.
--
-- VERWORFEN: `offer_categories`/`need_categories` bei dieser Gelegenheit aus
-- dem Rückgabesatz zu nehmen, weil die Karte sie nicht mehr zeigt. Das wäre
-- eine dritte Signaturänderung an derselben Funktion für einen Nutzen, den
-- niemand hat — der Filter über der Liste liest seine Optionen ohnehin aus
-- `config/compass.ts`, aber API-Stabilität ist hier mehr wert als eine Spalte
-- weniger.

-- ── 1. `search_directory` ───────────────────────────────────────────────────
-- Wortgleich zu 20260817180000, EINE Spalte mehr: `cover_url` direkt hinter
-- `avatar_url`, weil beide dasselbe beantworten (welches Bild gehört zu diesem
-- Mitglied). Signatur, Filter und Sortierung unverändert.
drop function public.search_directory(text, text, text, text, text, text, text[], text[]);

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
  cover_url        text,
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
    p.id, p.name, p.avatar_url, p.cover_url, p.region, p.company, p.short_bio,
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

-- Der Drop hat die Rechte mitgenommen; ohne diese zwei Zeilen hielte `PUBLIC`
-- das geerbte EXECUTE aus den Default Privileges.
revoke all on function public.search_directory(text, text, text, text, text, text, text[], text[]) from public;
grant execute on function public.search_directory(text, text, text, text, text, text, text[], text[]) to authenticated;

-- ── 2. `admin_list_members` — dieselbe Spalte, derselbe Zwang ───────────────
-- Auch hier ändert sich der Rückgabetyp, also auch hier `drop` + `create`
-- statt `create or replace` (`42P13`). Die vorherigen Fassungen dieser Funktion
-- kamen mit `replace` aus, weil sie nur den RUMPF anfassten — das gilt hier
-- nicht mehr.
--
-- `cover_url` steht an derselben Stelle wie oben, direkt hinter `avatar_url`.
-- Die Anforderung verlangt Übereinstimmung der Verzeichnisspalten, und
-- `admin_member_list_test.sql` vergleicht sie in beide Richtungen gegen den
-- Katalog: was die eine hat und die andere nicht, steht dort namentlich.
--
-- Rumpf und Signatur sind im Übrigen wortgleich zu 20260825120000. Die einzige
-- inhaltliche Änderung ist `p.cover_url` in der Projektion.
drop function public.admin_list_members(text, text, int, int);

create function public.admin_list_members(
  p_query  text default null,
  p_status text default null,
  p_limit  int  default 50,
  p_offset int  default 0
)
returns table (
  id               uuid,
  name             text,
  avatar_url       text,
  cover_url        text,
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
  need_categories  text[],
  login_email      text,
  bestaetigt       boolean,
  member_since     date,
  deaktiviert_seit timestamptz,
  geloescht_seit   timestamptz,
  paid_until       date,
  payment_type     text,
  gebannt          boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  muster text;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin_list_members' using errcode = '42501';
  end if;

  if p_status is not null and p_status not in
     ('alle', 'aktiviert', 'offen', 'deaktiviert', 'geloescht') then
    raise exception 'unbekannter Status: %', p_status using errcode = '22023';
  end if;

  muster := case
    when coalesce(btrim(p_query), '') = '' then null
    else '%' || replace(replace(replace(btrim(p_query), '!', '!!'), '%', '!%'), '_', '!_') || '%'
  end;

  return query
    select
      p.id, p.name, p.avatar_url, p.cover_url, p.region, p.company, p.short_bio,
      p.branche, p.tier, p.roles, p.competencies,
      exists (select 1 from public.offers o where o.profile_id = p.id) as has_offers,
      exists (select 1 from public.needs  n where n.profile_id = p.id) as has_needs,
      coalesce((select array_agg(distinct o.category order by o.category)
                  from public.offers o
                 where o.profile_id = p.id and o.category is not null), '{}'::text[]),
      coalesce((select array_agg(distinct n.category order by n.category)
                  from public.needs n
                 where n.profile_id = p.id and n.category is not null), '{}'::text[]),
      u.email::text,
      (p.activated_at is not null),
      p.member_since,
      p.disabled_at,
      p.deleted_at,
      pl.paid_until,
      pl.payment_type,
      public.is_banned(p.id)
    from public.profiles p
    join auth.users u on u.id = p.id
    -- Kein `join`: ein Mitglied ohne Altdatenzeile fiele sonst aus der Liste.
    left join public.profile_legacy pl on pl.profile_id = p.id
    where (muster is null
           or p.name ilike muster escape '!'
           or u.email ilike muster escape '!')
      and public.member_state_matches(p_status, p.activated_at, p.disabled_at, p.deleted_at)
    order by (p.activated_at is not null), p.name, p.id
    -- Ein ausdrückliches `null` wirkt sonst als „ohne Grenze", nicht als
    -- Vorgabewert (AGE-566, Befund 2).
    limit coalesce(p_limit, 50) offset coalesce(p_offset, 0);
end $$;

revoke execute on function public.admin_list_members(text, text, int, int) from public, anon;
grant  execute on function public.admin_list_members(text, text, int, int) to authenticated;

comment on function public.admin_list_members(text, text, int, int) is
  'Mitgliederliste fuer Admins (AGE-566, Lebenszyklus AGE-581). SECURITY '
  'DEFINER, WEIL ein Profil mit activated_at is null ueber jeden anderen '
  'Lesepfad fuer niemanden sichtbar ist — auch nicht fuer einen Admin; seit '
  'AGE-581 gilt dasselbe fuer disabled_at und deleted_at. Liefert die fuenfzehn '
  'Verzeichnisspalten von search_directory (seit AGE-595 einschliesslich '
  'cover_url) plus login_email, bestaetigt, '
  'member_since, deaktiviert_seit, geloescht_seit, paid_until, payment_type '
  'und gebannt; KEINE Spalte aus profile_contacts. gebannt kommt aus '
  'is_banned und ist die EINZIGE Auskunft der Flaeche ueber banned_until — ohne sie kann das Zeilenmenue den Nachsetz-Weg fuer einen fehlenden Ban nicht anbieten. p_status: '
  'alle|aktiviert|offen|deaktiviert|geloescht, unbekannt bricht mit 22023 ab. '
  'Die ersten drei schliessen Deaktivierte und Geloeschte AUS — sie '
  'beantworten Fragen ueber die Mitgliedschaft. deaktiviert nimmt die '
  'zusaetzlich Geloeschten heraus, geloescht nicht: Loeschen bringt die Sperre '
  'mit. Sortiert unbestaetigte zuerst, dann name, dann id — eine Aktivierung '
  'laesst eine Zeile deshalb zwischen den Seiten wandern. Kein is_public-'
  'Filter: die Verwaltungsliste ist keine Verzeichnisansicht.';
