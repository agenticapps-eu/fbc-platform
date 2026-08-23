-- Die Avatarreihe eines Events lernt den Lebenszyklus (AGE-581).
-- Donald, 2026-08-23. Change: openspec/changes/add-admin-member-lifecycle/.
--
-- ══ WARUM DIESE FUNKTION EINZELN NACHGEZOGEN WIRD ══════════════════════════
-- Rund vierzig Policies erben die neue Bedingung, weil sie `is_activated()`
-- oder `is_activated_profile()` rufen. `event_attendees` gehört nicht dazu: sie
-- schreibt `p.activated_at is not null` von Hand aus und ist damit eine der
-- fünf direkten Stellen aus der Inventur in `design.md`.
--
-- Die AUFRUFERseite war schon zu — die Funktion ruft `is_activated()`, und die
-- trägt seit 20260823120000 beide neuen Bedingungen. Offen war die ZIELseite:
-- ein deaktiviertes oder gelöschtes Mitglied blieb ausgerechnet dort stehen, wo
-- sein Gesicht neben denen der anderen Teilnehmer erscheint.
--
-- ══ WARUM `is_activated_profile()` UND NICHT ZWEI WEITERE ZEILEN ═══════════
-- Die beiden Bedingungen hier auszuschreiben wäre die sechste Kopie derselben
-- Regel. `is_activated_profile()` ist genau dafür da und steht seit dem
-- Aktivierungs-Gate (20260806080100) in sechs Policies; sie ist SECURITY
-- DEFINER und STABLE, der Planer hebt sie also aus der Zeilenschleife heraus.
-- Eine Kopie mehr hiesse: die nächste Änderung an der Zugangsbedingung müsste
-- sechs Orte finden statt fünf.
--
-- Der Rückgabetyp bleibt (profile_id, status) — deshalb genügt hier
-- `create or replace`, und Grants und Kommentar bleiben erhalten. Anders als
-- bei `admin_list_members` in derselben Sitzung, wo vier neue Spalten den Typ
-- änderten und ein `drop` unvermeidlich war.
--
-- Forward-only.

create or replace function public.event_attendees(p_event_id uuid)
  returns table (profile_id uuid, status text)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select r.profile_id, r.status
    from public.event_registrations r
    join public.events   e on e.id = r.event_id
    join public.profiles p on p.id = r.profile_id
   where r.event_id = p_event_id
     and public.is_activated()
     and ( e.visibility in ('public', 'members')
           or e.host_id = (select auth.uid()) )
     -- Der Host sieht jeden Status, alle anderen nur die Angemeldeten: eine
     -- Absage und ein Wartelistenplatz gehen niemanden sonst etwas an.
     and ( r.status = 'registered'
           or e.host_id = (select auth.uid()) )
     -- Das Opt-out. Der Host ist hier NICHT ausgenommen: er sieht die Zeile
     -- ohnehin über regs_select_self_or_host, mit Status und Check-in. Diese
     -- Funktion ist die Reihe im Frontend, nicht das Host-Werkzeug.
     and p.is_public
     -- War `p.activated_at is not null` (AGE-581): deckt jetzt auch
     -- disabled_at und deleted_at ab, ohne die Bedingung ein sechstes Mal
     -- abzuschreiben.
     and public.is_activated_profile(p.id)
   order by r.created_at
$$;

comment on function public.event_attendees(uuid) is
  'Teilnehmer eines sichtbaren Events für die Avatarreihe (AGE-531, '
  'Lebenszyklus AGE-581). Gibt NUR profile_id und status — `checked_in` und '
  '`rating` bleiben dem Host über die unveränderte Policy '
  'regs_select_self_or_host vorbehalten, weil RLS zeilen- und nicht '
  'spaltenweise wirkt. Mitglieder ohne öffentliches Profil fehlen ganz: ihre '
  'UUID ist eine Preisgabe, die kein Label im Frontend zurücknimmt. Dasselbe '
  'gilt seit AGE-581 für deaktivierte und geloeschte — die Zielseite prueft '
  'ueber is_activated_profile() und nicht mehr nur activated_at. '
  'Folge: die Gesamtzahl aus event_registration_counts kann größer sein.';
