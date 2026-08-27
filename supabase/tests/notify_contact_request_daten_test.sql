-- Die Mail-Auskunft für Kontaktanfragen als DEFINER-RPC (AGE-623).
-- Change: openspec/changes/notify-contact-request-definer-rpcs/.
--
-- Echtes pgTAP mit plan()/finish(). Diese Datei MUSS in ci.yml eingetragen
-- sein — ohne den Eintrag liefe sie nie, und genau das ist hier schon zweimal
-- passiert (siehe den Absatz über der Dateiliste in ci.yml).
--
-- ══ DIE ZUSAGE, UM DIE ES GEHT ═════════════════════════════════════════════
-- `notify-contact-request` las bis hierher drei Tabellen DIREKT mit dem
-- Dienstschlüssel. Dass das gelingt, entscheidet die Instanz und nicht dieses
-- Repository: keine wirksame `grant`-Zeile im Migrationsbaum erteilt
-- `service_role` ein Tabellenrecht, und trotzdem hält es am 27.08. lokal 35
-- von 36 Tabellen. Die eine Ausnahme ist `staff_roles` — die Tabelle, für die
-- eine Migration den Entzug ausspricht.
--
-- Diese Datei prüft die Funktion, die den Weg von jener Eigenschaft löst.
--
-- ══ ZWEI FALLEN, DIE DIE PLAN-REVIEW GEFUNDEN HAT ══════════════════════════
--   1. DIE BINDUNG GILT UNGEORDNET. Empfänger und Gegenüber tauschen je nach
--      Ereignis die Rollen: bei einer neuen Anfrage ist `to_id` der Empfänger,
--      bei Zusage/Absage `from_id` (emails.ts:53 gegen :61,64). Ein nach
--      from/to GEORDNETES Prädikat wäre grün für den ersten Fall und verwürfe
--      still jede Zusage- und Absage-Mail. Beide Richtungen stehen unten.
--   2. `left join`, NICHT `join`. Fehlt die Adresszeile oder der Anzeigename,
--      muss die Auskunft TROTZDEM eine Zeile liefern. Ein innerer Verbund
--      machte aus „keine Adresse hinterlegt" eine leere Menge, und der Aufrufer
--      daraus `409 record_mismatch` statt des heutigen `200 skipped: no_email`.
--
-- ══ WEITERE FALLEN, DIE DIESES PROJEKT SCHON GESTELLT HAT ══════════════════
--   * Der lokale Stack ist GESEEDET. Jede Mengenaussage ist auf die eigenen
--     Fixture-IDs eingeschränkt, nie `count(*)` einer Tabelle.
--   * Eine Messung aus lauter Nullen belegt nichts. Zu jeder Negativzusage
--     steht ein Nachbarfall, der eine Zeile ERZEUGT.
--   * In pgTAP heisst es `alike()`, nicht `like()`.
--   * Ein `revoke`, der nicht alle Rollen nennt, wirkt je nach Instanz-Sorte
--     (AGE-622). Die Rechtezusagen unten prüfen alle vier Rollen.
--   * Rechte werden am PRIVILEGIEN-BIT des Katalogs gemessen, nicht an einer
--     Fehlermeldung — und mit einer Gegenprobe, die sich bewegt.

begin;
select plan(16);

-- ── Fixtures ───────────────────────────────────────────────────────────────
-- Zwei Mitglieder mit Adresse, eines ohne Adresszeile, eines ohne Namen.
insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values
  ('a0000000-0000-4000-8000-000000000001', 'age623-a@example.invalid', 'x', now()),
  ('a0000000-0000-4000-8000-000000000002', 'age623-b@example.invalid', 'x', now()),
  ('a0000000-0000-4000-8000-000000000003', 'age623-c@example.invalid', 'x', now());

update public.profiles set name = 'Anna Sechsdreiundzwanzig'
 where id = 'a0000000-0000-4000-8000-000000000001';
update public.profiles set name = 'Bernd Sechsdreiundzwanzig'
 where id = 'a0000000-0000-4000-8000-000000000002';
update public.profiles set name = null
 where id = 'a0000000-0000-4000-8000-000000000003';

insert into public.profile_contacts (profile_id, email)
values
  ('a0000000-0000-4000-8000-000000000001', 'anna-zustellung@example.invalid'),
  ('a0000000-0000-4000-8000-000000000002', 'bernd-zustellung@example.invalid');
-- Konto 3 bekommt BEWUSST keine Zeile in profile_contacts.

insert into public.contact_requests (id, from_id, to_id, status, message)
values
  ('c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002',
   'pending', 'Hallo, lass uns sprechen.'),
  ('c0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000003',
   'pending', 'Zweite Anfrage.');

-- ══ 1. Die Rechte an der Funktion ══════════════════════════════════════════
-- Am Bit gemessen, alle vier Rollen genannt (AGE-622).

select ok(
  has_function_privilege('service_role',
    'public.notify_contact_request_daten(uuid,uuid,uuid)', 'execute'),
  'service_role darf die Auskunft ausfuehren');

select ok(
  not has_function_privilege('anon',
    'public.notify_contact_request_daten(uuid,uuid,uuid)', 'execute'),
  'anon darf die Auskunft NICHT ausfuehren');

select ok(
  not has_function_privilege('authenticated',
    'public.notify_contact_request_daten(uuid,uuid,uuid)', 'execute'),
  'authenticated darf die Auskunft NICHT ausfuehren');

-- GEGENPROBE: ohne sie waeren die beiden Zusagen darueber auch dann gruen,
-- wenn die Rolle das Recht ohnehin nie haelt. Der Nachbarwert muss sich bewegen.
grant execute on function public.notify_contact_request_daten(uuid,uuid,uuid) to anon;
select ok(
  has_function_privilege('anon',
    'public.notify_contact_request_daten(uuid,uuid,uuid)', 'execute'),
  'Gegenprobe: erteilt misst die Sonde true');
revoke execute on function public.notify_contact_request_daten(uuid,uuid,uuid) from anon;
select ok(
  not has_function_privilege('anon',
    'public.notify_contact_request_daten(uuid,uuid,uuid)', 'execute'),
  'Gegenprobe: entzogen misst die Sonde wieder false');

select ok(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'notify_contact_request_daten'),
  'Die Auskunft ist SECURITY DEFINER');

-- ══ 2. Der Normalfall: neue Anfrage, Empfaenger ist to_id ══════════════════

select is(
  (select recipient_email from public.notify_contact_request_daten(
     'c0000000-0000-4000-8000-000000000001',
     'a0000000-0000-4000-8000-000000000002',
     'a0000000-0000-4000-8000-000000000001')),
  'bernd-zustellung@example.invalid',
  'Neue Anfrage: liefert die Adresse des Empfaengers (to_id)');

select is(
  (select other_name from public.notify_contact_request_daten(
     'c0000000-0000-4000-8000-000000000001',
     'a0000000-0000-4000-8000-000000000002',
     'a0000000-0000-4000-8000-000000000001')),
  'Anna Sechsdreiundzwanzig',
  'Neue Anfrage: liefert den Namen des Gegenuebers (from_id)');

select is(
  (select message from public.notify_contact_request_daten(
     'c0000000-0000-4000-8000-000000000001',
     'a0000000-0000-4000-8000-000000000002',
     'a0000000-0000-4000-8000-000000000001')),
  'Hallo, lass uns sprechen.',
  'Der Text kommt aus der Datenbank, nicht aus dem Payload');

-- ══ 3. DIE FALLE AUS DER REVIEW: die andere Richtung ═══════════════════════
-- Bei Zusage/Absage ist `from_id` der Empfaenger. Ein geordnetes Praedikat
-- waere hier leer — und haette still jede Zusage-Mail verworfen.

select is(
  (select recipient_email from public.notify_contact_request_daten(
     'c0000000-0000-4000-8000-000000000001',
     'a0000000-0000-4000-8000-000000000001',
     'a0000000-0000-4000-8000-000000000002')),
  'anna-zustellung@example.invalid',
  'Zusage/Absage: dieselbe Zeile traegt auch die umgekehrte Richtung');

select is(
  (select other_name from public.notify_contact_request_daten(
     'c0000000-0000-4000-8000-000000000001',
     'a0000000-0000-4000-8000-000000000001',
     'a0000000-0000-4000-8000-000000000002')),
  'Bernd Sechsdreiundzwanzig',
  'Zusage/Absage: das Gegenueber ist dann der andere');

-- ══ 4. Die Bindung ═════════════════════════════════════════════════════════
-- Ein Unbeteiligter als Empfaenger darf NICHTS ziehen — sonst waere die
-- Funktion ein Adress-Orakel fuer jeden, der das Webhook-Geheimnis haelt.

select is_empty(
  $$select 1 from public.notify_contact_request_daten(
      'c0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000003',
      'a0000000-0000-4000-8000-000000000001')$$,
  'Ein Unbeteiligter als Empfaenger bekommt keine Zeile');

select is_empty(
  $$select 1 from public.notify_contact_request_daten(
      'c0000000-0000-4000-8000-000000000099',
      'a0000000-0000-4000-8000-000000000002',
      'a0000000-0000-4000-8000-000000000001')$$,
  'Eine unbekannte Anfrage-Kennung bekommt keine Zeile');

-- ══ 5. DIE ZWEITE FALLE: fehlende Adresse ist KEINE fehlende Zeile ═════════
-- Konto 3 hat keine profile_contacts-Zeile. Die Auskunft muss trotzdem eine
-- Zeile liefern, sonst wird aus `200 skipped: no_email` ein `409`.

select is(
  (select count(*)::int from public.notify_contact_request_daten(
     'c0000000-0000-4000-8000-000000000002',
     'a0000000-0000-4000-8000-000000000003',
     'a0000000-0000-4000-8000-000000000001')),
  1,
  'Ohne Adresszeile kommt die Zeile TROTZDEM (left join, nicht join)');

select ok(
  (select recipient_email is null from public.notify_contact_request_daten(
     'c0000000-0000-4000-8000-000000000002',
     'a0000000-0000-4000-8000-000000000003',
     'a0000000-0000-4000-8000-000000000001')),
  'Ohne Adresszeile ist das Adressfeld leer, nicht die Menge');

select ok(
  (select other_name is not null from public.notify_contact_request_daten(
     'c0000000-0000-4000-8000-000000000002',
     'a0000000-0000-4000-8000-000000000003',
     'a0000000-0000-4000-8000-000000000001')),
  'Nachbarfall: derselbe Aufruf liefert den Namen des Gegenuebers sehr wohl');

select * from finish();
rollback;
