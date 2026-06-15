-- Event-Registrierung & Host-Werkzeuge (AGE-251). Spec: docs/community-events-spec.md §2.
--
-- Drei Operationen kann der Client NICHT direkt machen, weil die RLS es (richtigerweise)
-- verbietet:
--  1. Restplätze/Teilnehmerzahl zählen — `regs_select_self_or_host` (20260612082726) gibt
--     einem normalen Mitglied NUR die eigenen Registrierungen zurück. Ein Zähler über alle
--     Teilnehmer ist clientseitig nicht berechenbar → `event_registration_counts`.
--  2. registered-vs-waitlist entscheiden — hängt am (verborgenen) Zähler und muss atomar +
--     fälschungssicher sein → `register_for_event`.
--  3. Check-in setzen — schreibt eine fremde Zeile (`profile_id = Teilnehmer`), die
--     `regs_write_own` sperrt → `set_event_check_in` (nur der Host).
--
-- Analog zu `post_engagement_counts` (20260615120000): SECURITY DEFINER, fixes search_path,
-- Cardinality-Cap, least-privilege grants. Abmelden (status='cancelled') und Bewertung
-- (rating) laufen weiter über `regs_write_own` direkt vom Client (eigene Zeile).

-- ── 1. Aggregat-Zähler je Event (read-only) ─────────────────────────────────
create or replace function public.event_registration_counts(p_event_ids uuid[])
returns table (event_id uuid, registered_count bigint, waitlist_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    (select count(*) from public.event_registrations r
       where r.event_id = e.id and r.status = 'registered'),
    (select count(*) from public.event_registrations r
       where r.event_id = e.id and r.status = 'waitlist')
  from public.events e
  -- Obergrenze: an anon vergeben; ohne Cap könnte ein anonymer Aufruf korrelierte
  -- count(*)-Subqueries über zehntausende IDs auslösen. Die Liste fragt nie mehr als
  -- ~100 Events ab; 200 ist großzügig.
  where cardinality(p_event_ids) <= 200
    and e.id = any (p_event_ids)
    -- Spiegelt events_select_by_visibility: keine Zähler für unsichtbare Events.
    and (
      e.visibility = 'public'
      or ( e.visibility = 'members' and (select auth.uid()) is not null )
      or ( e.visibility = 'prime'  and coalesce(public.current_tier_rank(), 0) >= 5 )
      or ( e.visibility = 'legacy' and coalesce(public.current_tier_rank(), 0) >= 7 )
      or e.host_id = (select auth.uid())
    );
$$;

comment on function public.event_registration_counts(uuid[]) is
  'Read-only Aggregat (registered/waitlist) je Event (AGE-251). SECURITY DEFINER, um '
  'über die self-or-host Registrierungs-Policy hinweg zu zählen; nur Zahlen, und nur '
  'für Events, die der Aufrufer per events_select_by_visibility ohnehin sehen darf.';

grant execute on function public.event_registration_counts(uuid[]) to anon, authenticated;

-- ── 2. Anmeldung mit automatischer Warteliste ───────────────────────────────
create or replace function public.register_for_event(p_event_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_event    public.events;
  v_count    integer;
  v_status   text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Event-Zeile sperren: serialisiert gleichzeitige Anmeldungen aufs selbe Event,
  -- damit count(registered)+insert nicht überbuchen (TOCTOU). Andere Events bleiben frei.
  select * into v_event from public.events e where e.id = p_event_id for update;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  -- Sichtbarkeit prüfen (gleiches Prädikat wie die SELECT-Policy). Für ein Event, das
  -- der Aufrufer nicht sehen darf, ist auch keine Anmeldung erlaubt.
  if not (
    v_event.visibility = 'public'
    or ( v_event.visibility = 'members' )
    or ( v_event.visibility = 'prime'  and coalesce(public.current_tier_rank(), 0) >= 5 )
    or ( v_event.visibility = 'legacy' and coalesce(public.current_tier_rank(), 0) >= 7 )
    or v_event.host_id = v_uid
  ) then
    raise exception 'event not visible' using errcode = '42501';
  end if;

  select count(*) into v_count
    from public.event_registrations r
   where r.event_id = p_event_id and r.status = 'registered';

  if v_event.capacity is null or v_count < v_event.capacity then
    v_status := 'registered';
  else
    v_status := 'waitlist';
  end if;

  insert into public.event_registrations (event_id, profile_id, status)
  values (p_event_id, v_uid, v_status)
  on conflict (event_id, profile_id)
    do update set status = excluded.status;

  return v_status;
end;
$$;

comment on function public.register_for_event(uuid) is
  'Meldet den Aufrufer zum Event an und gibt den Status zurück (registered, oder '
  'waitlist bei erreichter capacity). Sperrt die Event-Zeile (for update), damit '
  'gleichzeitige Anmeldungen nicht über die capacity hinaus zählen; SECURITY DEFINER, um den Teilnehmerzähler '
  'serverseitig zu lesen. Re-Anmeldung nach Abmeldung bewertet die Kapazität neu.';

grant execute on function public.register_for_event(uuid) to authenticated;

-- ── 3. Check-in durch den Host ──────────────────────────────────────────────
create or replace function public.set_event_check_in(
  p_registration_id uuid,
  p_checked_in boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  update public.event_registrations r
     set checked_in = p_checked_in
    from public.events e
   where r.id = p_registration_id
     and e.id = r.event_id
     and e.host_id = v_uid;   -- nur der Host des zugehörigen Events
  if not found then
    raise exception 'not the host of this event' using errcode = '42501';
  end if;
end;
$$;

comment on function public.set_event_check_in(uuid, boolean) is
  'Setzt event_registrations.checked_in für eine Registrierung — nur durch den Host des '
  'zugehörigen Events (AGE-251). SECURITY DEFINER, weil die Zeile dem Teilnehmer gehört.';

grant execute on function public.set_event_check_in(uuid, boolean) to authenticated;
