-- `admin_list_members` liefert den Ban-Zustand mit (AGE-581).
-- Donald, 2026-08-24. Change: openspec/changes/add-admin-member-lifecycle/.
--
-- ══ WARUM ═══════════════════════════════════════════════════════════════════
-- Das Delta verlangt zweierlei, und ohne diese Spalte widerspricht es sich:
--
--   * „Fehlt der Ban, SHALL derselbe Aufruf nicht abbrechen, sondern ihn
--     nachsetzen." (`admin_disable_member` tut das.)
--   * „‚deaktivieren' SHALL NOT an bereits deaktivierten [Zeilen] erscheinen."
--
-- Zusammen machen sie den Nachsetz-Weg über die Oberfläche unerreichbar: genau
-- der halbe Zustand, für den er gedacht ist — deaktiviert, aber Ban fehlt —
-- sieht in der Liste aus wie jede andere deaktivierte Zeile. Das Delta nennt
-- eine Handlung, die ihren eigenen halben Ausgang nicht heilen kann, „keine
-- Handlung, sondern eine Falle".
--
-- Mit `gebannt` löst sich der Widerspruch auf, ohne dass eine der beiden
-- Zusagen weichen muss: das Menü bietet „Deaktivieren" an einer deaktivierten
-- Zeile GENAU DANN an, wenn der Ban fehlt. Wo er steht, bleibt der Eintrag
-- verborgen, und die Begründung der zweiten Zusage — „ein Knopf, dessen
-- einziger Ausgang ein Fehler ist" — trifft weiterhin zu.
--
-- ══ WARUM `is_banned` UND NICHT DAS PRÄDIKAT NOCH EINMAL ═══════════════════
-- `u.banned_until is not null and u.banned_until > now()` liesse sich hier
-- direkt hinschreiben — `auth.users` ist ohnehin verbunden, und es wäre eine
-- Unterabfrage weniger je Zeile. Es wäre aber die zweite Stelle mit derselben
-- Bedingung, und in diesem Projekt ist ein verdoppeltes Prädikat schon einmal
-- auseinandergelaufen. `is_banned` ist `stable` und liegt bei `service_role`;
-- aus einer SECURITY-DEFINER-Funktion mit Eigentümer `postgres` heraus wird das
-- Ausführungsrecht gegen den EIGENTÜMER geprüft, nicht gegen den Aufrufer —
-- der Aufruf ist also erlaubt, ohne dass ein `authenticated` an `is_banned`
-- herankäme.
--
-- ══ WARUM WIEDER `drop` ════════════════════════════════════════════════════
-- Derselbe Grund wie am 23.08.: der Rückgabetyp ändert sich, und
-- `create or replace` kann ihn nicht ändern. Grants, Kommentar und die
-- PARAMETER-VORGABEWERTE kommen deshalb unten wieder mit — ohne die
-- Vorgabewerte meldete `admin_list_members()` wieder 42883 statt der
-- zugesicherten 42501.
--
-- Forward-only.

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
      p.id, p.name, p.avatar_url, p.region, p.company, p.short_bio,
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
      -- `case p_status when …` und kein `or`-Gestrüpp: bei `null` trifft keine
      -- Verzweigung (Gleichheit mit null ist null), also greift `else` — und
      -- damit dieselbe Bedingung wie bei `alle`. Genau das sagt die
      -- Anforderung zu.
      and case p_status
            when 'deaktiviert' then p.disabled_at is not null and p.deleted_at is null
            when 'geloescht'   then p.deleted_at is not null
            when 'aktiviert'   then p.activated_at is not null
                                and p.disabled_at is null and p.deleted_at is null
            when 'offen'       then p.activated_at is null
                                and p.disabled_at is null and p.deleted_at is null
            else                    p.disabled_at is null and p.deleted_at is null
          end
    order by (p.activated_at is not null), p.name, p.id
    -- Ein ausdrückliches `null` wirkt sonst als „ohne Grenze", nicht als
    -- Vorgabewert (AGE-566, Befund 2).
    limit coalesce(p_limit, 50) offset coalesce(p_offset, 0);
end $$;

-- Die drei Dinge, die der `drop` mitgenommen hat. Die Vorgabewerte stehen
-- bereits in der Signatur oben; hier folgen Grants und Kommentar.
revoke execute on function public.admin_list_members(text, text, int, int) from public, anon;
grant  execute on function public.admin_list_members(text, text, int, int) to authenticated;

comment on function public.admin_list_members(text, text, int, int) is
  'Mitgliederliste fuer Admins (AGE-566, Lebenszyklus AGE-581). SECURITY '
  'DEFINER, WEIL ein Profil mit activated_at is null ueber jeden anderen '
  'Lesepfad fuer niemanden sichtbar ist — auch nicht fuer einen Admin; seit '
  'AGE-581 gilt dasselbe fuer disabled_at und deleted_at. Liefert die vierzehn '
  'Verzeichnisspalten von search_directory plus login_email, bestaetigt, '
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
