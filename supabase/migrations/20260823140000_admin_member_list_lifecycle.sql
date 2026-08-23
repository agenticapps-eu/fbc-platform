-- Die Admin-Mitgliederliste lernt den Lebenszyklus (AGE-581).
-- Donald, 2026-08-23. Change: openspec/changes/add-admin-member-lifecycle/.
--
-- ══ WARUM `drop` UND NICHT `create or replace` ═════════════════════════════
-- `create or replace function` kann den RÜCKGABETYP einer bestehenden Funktion
-- nicht ändern und bricht mit „cannot change return type of existing function"
-- ab. Die vier neuen Spalten ändern ihn. Gemessen, nicht hergeleitet — der
-- Versuch war der erste Weg und schlug fehl.
--
-- Ein `drop` nimmt DREI Dinge mit, die eine Ersetzung behalten hätte, und alle
-- drei stehen unten wieder da:
--   * die Grants (AGE-312: in diesem Projekt wird nichts vererbt),
--   * den Kommentar,
--   * und — die teuerste — die PARAMETER-VORGABEWERTE. Ohne sie meldet
--     Postgres für den argumentlosen Aufruf `admin_list_members()` wieder
--     „function does not exist" (42883) statt der zugesicherten `42501`. Der
--     Aufrufer bekäme also einen anderen Fehler als versprochen, und ein Test
--     auf „schlägt fehl" hätte den Unterschied nicht bemerkt.
--
-- ══ WARUM DIE VIER SPALTEN GANZ HINTEN STEHEN ══════════════════════════════
-- Die ersten vierzehn Spalten sind die Verzeichnisprojektion und werden gegen
-- `search_directory` auf Gleichheit geprüft. Neue Spalten dazwischen machten
-- aus einem Vergleich von Projektionen einen Vergleich von Positionen.
--
-- ══ WARUM `alle` NICHT „ALLE ZEILEN" HEISST ════════════════════════════════
-- `alle`, `aktiviert` und `offen` beantworten Fragen über die MITGLIEDSCHAFT.
-- Ein deaktiviertes oder gelöschtes Mitglied gehört nicht dazu; es bekommt mit
-- `deaktiviert` und `geloescht` eigene Reiter. „Alle" beantwortet „wer ist
-- Mitglied?", nicht „was steht in der Tabelle?".
--
-- `deaktiviert` schliesst die zusätzlich Gelöschten AUS, `geloescht` nicht:
-- Löschen bringt die Sperre mit, und ohne diese Asymmetrie zeigten beide Reiter
-- über weite Strecken dieselben Zeilen.
--
-- ══ WARUM `left join` AUF profile_legacy ═══════════════════════════════════
-- Nicht jedes Mitglied hat eine Altdatenzeile — der Trigger `handle_new_user`
-- legt keine an. Ein `join` liesse jedes selbst registrierte Konto lautlos aus
-- der Liste fallen, auf genau der Fläche, die entstanden ist, weil Mitglieder
-- anderswo lautlos fehlten.
--
-- Die Verbindung zu `auth.users` bleibt dagegen ein `join`, und das ist
-- geprüft: `profiles_id_fkey` ist ein Fremdschlüssel von `profiles.id` auf
-- `auth.users.id`, die Verbindung ist strukturell garantiert. Ein `left join`
-- wäre dort irreführend — er behauptete eine Lücke, die es nicht geben kann.
--
-- ══ BEFUND [PR]: `payment_type` BRAUCHT VIER STELLEN, NICHT EINE ═══════════
-- `admin_update_profile` führt jedes Altdatenfeld an VIER Stellen: Weissliste,
-- Präsenztest (`patch ?| array[…]`), INSERT-Spaltenliste und die Zuweisung im
-- `on conflict do update`. Nur die Weissliste zu ändern nähme den Wert
-- widerspruchslos entgegen, schriebe eine Auditzeile — und speicherte nichts.
-- Der stillste denkbare Fehler auf einer Verwaltungsfläche.
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
  payment_type     text
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
      pl.payment_type
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
  'member_since, deaktiviert_seit, geloescht_seit, paid_until und '
  'payment_type; KEINE Spalte aus profile_contacts. p_status: '
  'alle|aktiviert|offen|deaktiviert|geloescht, unbekannt bricht mit 22023 ab. '
  'Die ersten drei schliessen Deaktivierte und Geloeschte AUS — sie '
  'beantworten Fragen ueber die Mitgliedschaft. deaktiviert nimmt die '
  'zusaetzlich Geloeschten heraus, geloescht nicht: Loeschen bringt die Sperre '
  'mit. Sortiert unbestaetigte zuerst, dann name, dann id — eine Aktivierung '
  'laesst eine Zeile deshalb zwischen den Seiten wandern. Kein is_public-'
  'Filter: die Verwaltungsliste ist keine Verzeichnisansicht.';

-- ── admin_update_profile: payment_type an allen vier Stellen ───────────────
-- Der Rückgabetyp bleibt `void`, deshalb genügt hier `create or replace` —
-- und Grants und Kommentar bleiben damit erhalten.

create or replace function public.admin_update_profile(target uuid, patch jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin_update_profile' using errcode = '42501';
  end if;

  if jsonb_typeof(patch) is distinct from 'object' then
    raise exception 'patch muss ein JSON-Objekt sein' using errcode = '22023';
  end if;
  if patch = '{}'::jsonb then
    raise exception 'patch ist leer' using errcode = '22023';
  end if;

  foreach k in array (select array(select jsonb_object_keys(patch))) loop
    if k not in (
      -- profiles (die client-schreibbare Menge + cover_url)
      'name', 'avatar_url', 'cover_url', 'region', 'company', 'short_bio',
      'branche', 'headline', 'roles', 'socials', 'website', 'competencies',
      'dev_focus', 'is_public', 'videos',
      -- profile_contacts (AGE-537: die fünf Adressfelder dazu)
      'email', 'phone',
      'street', 'postal_code', 'city', 'state', 'country',
      -- profile_legacy (STELLE 1 von 4 für payment_type, AGE-581)
      'paid_until', 'legacy_tier', 'legacy_price', 'legacy_source_id',
      'payment_type'
    ) then
      raise exception 'unbekanntes Feld im patch: %', k using errcode = '22023';
    end if;
  end loop;

  update public.profiles set
    name         = case when patch ? 'name'         then patch ->> 'name'         else name end,
    avatar_url   = case when patch ? 'avatar_url'   then patch ->> 'avatar_url'   else avatar_url end,
    cover_url    = case when patch ? 'cover_url'    then patch ->> 'cover_url'    else cover_url end,
    region       = case when patch ? 'region'       then patch ->> 'region'       else region end,
    company      = case when patch ? 'company'      then patch ->> 'company'      else company end,
    short_bio    = case when patch ? 'short_bio'    then patch ->> 'short_bio'    else short_bio end,
    branche      = case when patch ? 'branche'      then patch ->> 'branche'      else branche end,
    headline     = case when patch ? 'headline'     then patch ->> 'headline'     else headline end,
    website      = case when patch ? 'website'      then patch ->> 'website'      else website end,
    dev_focus    = case when patch ? 'dev_focus'    then patch ->> 'dev_focus'    else dev_focus end,
    goals        = case when patch ? 'goals'        then patch ->> 'goals'        else goals end,
    is_public    = case when patch ? 'is_public'    then (patch ->> 'is_public')::boolean else is_public end,
    socials      = case when patch ? 'socials'
                        then nullif(patch -> 'socials', 'null'::jsonb)
                        else socials end,
    roles        = case when patch ? 'roles'        then public.jsonb_text_array(patch -> 'roles')        else roles end,
    competencies = case when patch ? 'competencies' then public.jsonb_text_array(patch -> 'competencies') else competencies end,
    videos       = case when patch ? 'videos'       then public.jsonb_text_array(patch -> 'videos')       else videos end
  where id = target;

  if not found then
    raise exception 'Profil % existiert nicht', target using errcode = 'P0002';
  end if;

  -- Die Kontaktzeile. Sie ist NICHT die Login-Adresse (die steht in
  -- auth.users), aber sie ist die, an die notify-contact-request schickt —
  -- und seit AGE-537 trägt sie auch die Anschrift.
  if patch ?| array['email', 'phone', 'street', 'postal_code', 'city', 'state', 'country'] then
    insert into public.profile_contacts as pc
      (profile_id, email, phone, street, postal_code, city, state, country)
    values (
      target,
      patch ->> 'email',       patch ->> 'phone',
      patch ->> 'street',      patch ->> 'postal_code',
      patch ->> 'city',        patch ->> 'state',
      patch ->> 'country')
    on conflict (profile_id) do update set
      email       = case when patch ? 'email'       then excluded.email       else pc.email end,
      phone       = case when patch ? 'phone'       then excluded.phone       else pc.phone end,
      street      = case when patch ? 'street'      then excluded.street      else pc.street end,
      postal_code = case when patch ? 'postal_code' then excluded.postal_code else pc.postal_code end,
      city        = case when patch ? 'city'        then excluded.city        else pc.city end,
      state       = case when patch ? 'state'       then excluded.state       else pc.state end,
      country     = case when patch ? 'country'     then excluded.country     else pc.country end;
  end if;

  -- STELLE 2 von 4: ohne `payment_type` im Präsenztest liefe ein Patch, der NUR
  -- die Zahlungsart trägt, an diesem Block vorbei und speicherte nichts.
  if patch ?| array['paid_until', 'legacy_tier', 'legacy_price',
                    'legacy_source_id', 'payment_type'] then
    -- STELLE 3 von 4: die INSERT-Spaltenliste, für das erste Mal.
    insert into public.profile_legacy as pl
      (profile_id, paid_until, legacy_tier, legacy_price, legacy_source_id, payment_type)
    values (
      target,
      (patch ->> 'paid_until')::date,
      patch ->> 'legacy_tier',
      (patch ->> 'legacy_price')::numeric,
      patch ->> 'legacy_source_id',
      patch ->> 'payment_type')
    -- STELLE 4 von 4: die Zuweisung für jedes weitere Mal. Ohne sie speicherte
    -- der erste Aufruf und jeder folgende nicht — der Fehler sähe aus wie ein
    -- Zwischenspeicher.
    on conflict (profile_id) do update set
      paid_until       = case when patch ? 'paid_until'       then excluded.paid_until       else pl.paid_until end,
      legacy_tier      = case when patch ? 'legacy_tier'      then excluded.legacy_tier      else pl.legacy_tier end,
      legacy_price     = case when patch ? 'legacy_price'     then excluded.legacy_price     else pl.legacy_price end,
      legacy_source_id = case when patch ? 'legacy_source_id' then excluded.legacy_source_id else pl.legacy_source_id end,
      payment_type     = case when patch ? 'payment_type'     then excluded.payment_type     else pl.payment_type end;
  end if;

  insert into public.admin_audit (actor, action, target, payload)
  values ((select auth.uid()), 'update_profile', target, patch);
end $$;

comment on function public.admin_update_profile(uuid, jsonb) is
  'Aendert Stamm-, Kontakt- und Altdaten eines fremden Profils (AGE-498, '
  'Adressfelder AGE-537, payment_type AGE-581). SECURITY DEFINER, WEIL die '
  'spaltenweisen UPDATE-Grants auf profiles VOR der Policy greifen — eine '
  'Admin-Policy allein bliebe wirkungslos. EXECUTE liegt bei authenticated, '
  'damit die Abwehr IN der Funktion stattfindet und pruefbar ist. Weisliste '
  'ohne tier/potential_score/profile_completion/search_doc/member_number/'
  'activated_at — und ohne disabled_at/deleted_at: der Lebenszyklus laeuft '
  'ueber die vier eigenen RPCs, damit der GoTrue-Ban nicht umgangen wird.';
