-- Event-Anmeldung: Schwelle sichtbarkeitsabhängig (AGE-448). Donald, 2026-07-22.
--
-- ── Befund ──────────────────────────────────────────────────────────────────
-- Ein Discover-User (und erst recht ein frisch registrierter Gast) kann sich
-- nicht zum Sommerfest anmelden: „membership level too low to register". Live
-- reproduziert am 22.07.
--
-- register_for_event (20260715150000_six_level_model.sql:407) verlangte pauschal
-- has_level(4) (= `exchange`, rank 4) — Spec §2 „Teilnahme ab exchange". Das ist
-- für das Sommerfest falsch: Gäste registrieren sich vor Ort und starten laut
-- handle_new_user auf `basic` (rank 1). Der Sichtbarkeits-Check darüber blockt
-- nicht (members lässt jeden Eingeloggten durch) — allein die Teilnahme-Schwelle.
--
-- ── Entscheidung (Donald, 2026-07-22) ───────────────────────────────────────
-- Schwelle sichtbarkeitsabhängig:
--   * public  → jeder Eingeloggte darf sich anmelden (auch basic). Der Gäste-Fall.
--   * members → ab `discover` (rank 3) oder Host. Angehoben gegenüber §2 (exchange),
--     aber bewusst nicht bis basic: Mitglieder-Events bleiben eine Mitglieder-Sache.
-- Reversibel: nach dem Sommerfest bewusst entscheiden, ob wieder auf exchange
-- hochgesetzt wird (analog AGE-445 Punkt 3). Das ist ein Ein-Zeilen-Rückbau hier.
--
-- VERWORFEN: die Schwelle pauschal auf has_level(1) senken. Das hätte auch
-- Mitglieder-Events für jeden Eingeloggten geöffnet — §2 will die Stufung dort
-- behalten. Die Sichtbarkeit ist der richtige Diskriminator: was `public` ist,
-- ist ohnehin für alle gedacht.
--
-- Nur der EINE Zweig (Zeile mit has_level(4)) ändert sich; der Rest der Funktion
-- (Sichtbarkeit, Kapazität/Waitlist, for-update-Sperre) bleibt wortgleich.

create or replace function public.register_for_event(p_event_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_event  public.events;
  v_count  integer;
  v_status text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_event from public.events e where e.id = p_event_id for update;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  -- Sichtbarkeit (spiegelt events_select_by_visibility).
  if not (
    v_event.visibility in ('public', 'members')
    or v_event.host_id = v_uid
  ) then
    raise exception 'event not visible' using errcode = '42501';
  end if;

  -- Teilnahme sichtbarkeitsabhängig (AGE-448): öffentliche Events darf jeder
  -- Eingeloggte besuchen; Mitglieder-Events ab `discover` (rank 3). Der Host
  -- darf sein eigenes Event immer bespielen. Ohne diese Prüfung wäre der RPC
  -- der offene Seitenweg an regs_write_own vorbei.
  if not (
    v_event.visibility = 'public'
    or public.has_level(3)
    or v_event.host_id = v_uid
  ) then
    raise exception 'membership level too low to register' using errcode = '42501';
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
  'waitlist bei erreichter capacity). Sperrt die Event-Zeile (for update) gegen '
  'Überbuchung; prüft Sichtbarkeit UND die Teilnahme-Schwelle: public für jeden '
  'Eingeloggten, members ab `discover` (rank 3) oder Host (AGE-448, war exchange).';
