-- Teilnehmer eines Events sichtbar machen: `event_attendees()` (AGE-531, C8).
-- Donald, 2026-08-12. Spec: openspec/changes/events-content/.
--
-- Bis hierhin sah die Teilnehmerliste NUR der Veranstalter und man selbst
-- (`regs_select_self_or_host`). Das Mockup zeigt Gesichter, und Detlev will
-- genau das: „Und dadurch weiß man auch schon, wer kommt denn alles."
--
-- ── Die entschiedene Variante ─────────────────────────────────────────────
-- Drei standen zur Wahl: (1) nur andere Angemeldete desselben Events,
-- (2) jedes aktivierte Mitglied, das das Event sehen darf, (3) nur die Anzahl.
-- Entschieden am 2026-08-12: VARIANTE 2.
--
-- (1) erfüllt den Satz nicht, um den es geht — „vorher sehen, wer kommt" heißt
-- VOR der eigenen Anmeldung. (1) bräuchte zudem einen Helfer wie diesen hier,
-- weil eine Unterabfrage auf `event_registrations` innerhalb deren eigener
-- Policy „infinite recursion detected in policy" ergibt. (3) ändert nichts:
-- die Zahl liefert `event_registration_counts` seit AGE-251.
--
-- ── Warum eine RPC und NICHT die geöffnete Policy ─────────────────────────
-- VERWORFEN: `regs_select_self_or_host` um einen Zweig erweitern
-- („Event sichtbar UND status = 'registered'"). Kürzer, und falsch:
--
--  1. RLS ist ZEILENWEISE, nicht spaltenweise. Wer eine fremde
--     Registrierungszeile lesen darf, liest sie GANZ — samt `checked_in` und
--     `rating`. Die Sterne-Bewertung eines namentlich bekannten Mitglieds wäre
--     damit für jedes Mitglied abrufbar. Für die Avatarreihe im Mockup wird
--     davon nichts gebraucht.
--  2. Das Aktivierungs-Gate stünde danach an einer UMGEBAUTEN Stelle. Die
--     Policy trägt `public.is_activated()` seit C3
--     (20260806080100_activation_gate.sql:185). Ein Umbau derselben Policy
--     machte den pgTAP-Fall „eingeloggt, nicht aktiviert liefert leer" zu
--     einem Test über neuen Code statt über die gesetzte Grenze.
--
-- `regs_select_self_or_host` bleibt deshalb Wort für Wort stehen, und
-- rls_test.sql §20.4 hält als Regression fest, dass die Tabelle selbst zu
-- bleibt. Das Muster ist etabliert: `event_registration_counts` ist genau
-- dieser Bau, eine Ebene schmaler.
--
-- ── Wer nicht im Verzeichnis steht, steht auch nicht in der Reihe ─────────
-- Aus dem Fremd-Review (REVIEWS.md, codex, SEVERITY HIGH).
--
-- Die erste Fassung gab alle `profile_id` heraus und ließ das Frontend nicht
-- auflösbare Profile als „Ein Mitglied" zeichnen. Das ist Kulisse: eine
-- stabile UUID auf der Leitung ist eine Preisgabe, die kein Label rückgängig
-- macht — sie korreliert mit allem anderen, was über dieses Konto sichtbar
-- ist. Die Funktion filtert deshalb selbst auf `is_public` und
-- `activated_at is not null`, dieselbe Bedingung, mit der die View
-- `profiles_public` arbeitet.
--
-- DER PREIS, BENANNT: die Gesamtzahl kann GRÖSSER sein als die Zahl der
-- Gesichter. Sie kommt weiterhin aus `event_registration_counts` und bleibt
-- vollständig. „64 Teilnehmer, 61 davon sichtbar" ist ehrlich; eine Zahl, die
-- stillschweigend nur die Sichtbaren zählte, wäre es nicht.
--
-- ── Der Host-Zweig ist heute tot, und das steht hier statt in einem Test ──
-- `visibility` erlaubt nur 'public' und 'members', und beide sieht jedes
-- aktivierte Mitglied. Der Zweig `or host_id = auth.uid()` ist damit für ein
-- aktiviertes Konto unerreichbar — der Plan-Review hat zu Recht bemerkt, dass
-- ein Testfall dafür nicht konstruierbar ist. Er bleibt trotzdem stehen, weil
-- diese Funktion `events_select_by_visibility` spiegeln soll, in der er
-- ebenfalls steht; käme je ein dritter Sichtbarkeitswert dazu, wäre sein
-- Fehlen die stille Lücke. Behauptet wird er nirgends als geprüft.
--
-- ── `anon` bekommt kein `execute` ─────────────────────────────────────────
-- Anders als bei `event_cover_lesbar`: ausgeloggt gibt es keine Teilnehmer,
-- auch nicht bei einem öffentlichen Event. Die Eventseiten bleiben ohne
-- Session erreichbar; nur die Anreicherung entfällt — dieselbe Regel wie in
-- AGE-530 für `profiles_public` und `partners`.
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
     and p.activated_at is not null
   order by r.created_at
$$;

comment on function public.event_attendees(uuid) is
  'Teilnehmer eines sichtbaren Events für die Avatarreihe (AGE-531). Gibt NUR '
  'profile_id und status — `checked_in` und `rating` bleiben dem Host über die '
  'unveränderte Policy regs_select_self_or_host vorbehalten, weil RLS zeilen- '
  'und nicht spaltenweise wirkt. Mitglieder ohne öffentliches Profil fehlen '
  'ganz: ihre UUID ist eine Preisgabe, die kein Label im Frontend zurücknimmt. '
  'Folge: die Gesamtzahl aus event_registration_counts kann größer sein.';

revoke execute on function public.event_attendees(uuid) from public, anon;
grant  execute on function public.event_attendees(uuid) to authenticated;
