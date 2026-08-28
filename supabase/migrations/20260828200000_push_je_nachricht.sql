-- ════════════════════════════════════════════════════════════════════════════
-- AGE-641 — jede Nachricht loest einen Push aus, nicht nur die erste
-- ════════════════════════════════════════════════════════════════════════════
--
-- Change: openspec/changes/push-fundament/.
--
-- ══ DER BEFUND, AM 28.08. AM ECHTEN GERAET GEMESSEN ════════════════════════
-- `20260827230000` liess keinen zweiten Hinweis zu, solange fuer dasselbe
-- Gespraech ein UNGELESENER lag. Gemeint war damit die GLOCKE: zwanzig
-- Nachrichten am Stueck sind ein Anlass und nicht zwanzig.
--
-- Am Push haengt aber dieselbe Zeile. `notifications_push_webhook` feuert
-- `AFTER INSERT ON public.notifications` — wird der Hinweis unterdrueckt,
-- unterbleibt der Push mit. Die Folge ist nicht „die zweite Nachricht kommt
-- nicht durch", sondern:
--
--     Solange IRGENDEIN ungelesener Hinweis fuer einen Faden liegt — auch
--     einer von vorgestern —, ist das Telefon fuer diesen Chat DAUERHAFT
--     stumm. Nicht fuer die zweite Nachricht, nicht fuer die zwanzigste,
--     nicht fuer die von morgen.
--
-- Gemessen auf DEV, mit Grundlinie davor, weil `net.http_post` asynchron ist
-- und ein „succeeded" im Protokoll nur heisst, dass das SQL lief:
--
--   19:11:36  Nachricht eingefuegt, Faden trug einen ungelesenen Hinweis
--             → `notifications` unveraendert, NULL neue `net._http_response`
--   19:12:52  denselben Hinweis als gelesen markiert, Nachricht eingefuegt
--             → neuer Hinweis, `net._http_response` #372 `status=200`,
--               Antwort {"zugestellt":2,"vorlaeufig":0,"dauerhaft":0}
--
-- Der erste Lauf ist die Positivkontrolle zum zweiten: ohne ihn waere „der
-- Push kam" von „es lief ohnehin gerade etwas" nicht zu trennen.
--
-- ══ DIE ENTSCHEIDUNG ═══════════════════════════════════════════════════════
-- Donald am 28.08.: falsch. Ein Messenger, der bei ungelesenen Nachrichten
-- verstummt, ist kein Messenger. Die Zusammenfassung war fuer die Glocke
-- richtig gedacht und an der falschen Stelle gebaut — sie gehoert in die
-- ANZEIGE, nicht ins Ereignis. Das Ereignis ist die Nachricht.
--
-- Der Preis steht hier ausdruecklich, damit ihn niemand spaeter fuer ein
-- Versehen haelt: zwanzig Nachrichten am Stueck wecken das Telefon jetzt
-- zwanzigmal. Das Issue vom 27.08. sagte „lieber zu wenig als zu viel"; diese
-- Migration dreht das um, weil „zu wenig" sich als „gar nicht" herausgestellt
-- hat. Eine Drosselung waere ein eigener Vorgang und braucht eine Frist, keine
-- Ungelesen-Bedingung.
--
-- ══ VERWORFEN, UND WARUM KEINES DAVON GEHT ═════════════════════════════════
-- 1. Den bestehenden Hinweis ERNEUT anstossen, ohne neue Zeile.
--    `send-push` liest aus dem Aufruf ausschliesslich die Hinweis-Kennung;
--    gegen ein zweites Anstossen derselben Kennung steht der Primaerschluessel
--    von `push_zustellungen`. Konstruktiv ausgeschlossen, und zwar absichtlich.
-- 2. Einen Push OHNE `notifications`-Zeile schicken. Denselben Weg versperrt
--    dieselbe Kennung: alles Weitere holt `push_auftraege_holen` aus der
--    Zeile. Eine synthetische Nutzlast haette nichts, woran sie haengt.
-- 3. Die bestehende Zeile auffrischen (`created_at` hochsetzen). Schon am
--    27.08. verworfen und aus demselben Grund weiter verworfen: dann bedeutet
--    `created_at` nicht mehr „seit wann liegt etwas an", und die Glocke
--    sortiert danach.
--
-- ══ WAS UNVERAENDERT BLEIBT ════════════════════════════════════════════════
-- Der Text steht weiterhin NICHT in der Zeile — nicht gekuerzt, nicht als
-- Vorschau, gar nicht. Ein Sperrbildschirm liegt in einer Besprechung offen
-- auf dem Tisch. Ebenso bleiben `is_activated_profile` und
-- `hinweis_erwuenscht` die beiden Tore davor.
--
-- Donald, 28.08.2026.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.hinweis_neue_nachricht() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_empfaenger uuid;
  v_name       text;
begin
  select case when t.a_profile_id = new.sender_id then t.b_profile_id
              else t.a_profile_id end
    into v_empfaenger
    from public.message_threads t
   where t.id = new.thread_id;

  -- Kein Gegenueber (verwaister Faden) oder an sich selbst: nichts zu tun.
  if v_empfaenger is null or v_empfaenger = new.sender_id then
    return new;
  end if;

  if not public.is_activated_profile(v_empfaenger) then
    return new;
  end if;

  if not public.hinweis_erwuenscht(v_empfaenger, 'message') then
    return new;
  end if;

  -- HIER stand die Zusammenfassung. Sie ist ersatzlos raus: siehe Kopf.
  -- Die Glocke fasst `message`-Zeilen jetzt beim ANZEIGEN je Faden zusammen.

  select p.name into v_name from public.profiles p where p.id = new.sender_id;

  insert into public.notifications (profile_id, type, payload)
  values (
    v_empfaenger,
    'message',
    -- Kennungen und ein Name. Kein `body`, unter keinem Schluessel.
    jsonb_build_object(
      'thread_id',   new.thread_id,
      'sender_id',   new.sender_id,
      'sender_name', v_name
    )
  );

  return new;
end $$;

comment on function public.hinweis_neue_nachricht() is
  'Ein Hinweis JE NACHRICHT. Die Zusammenfassung je Gespraech liegt in der '
  'Anzeige (src/lib/hinweise.ts), nicht hier: am INSERT haengt der Push, und '
  'eine unterdrueckte Zeile machte das Telefon fuer den Faden dauerhaft stumm '
  '(AGE-641, 28.08.2026).';
