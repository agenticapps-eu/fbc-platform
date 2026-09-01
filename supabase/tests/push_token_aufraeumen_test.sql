-- ════════════════════════════════════════════════════════════════════════════
-- AGE-682 — tote Geraetetokens: was der Anbieter nicht ablehnt
-- ════════════════════════════════════════════════════════════════════════════
--
-- Change: openspec/changes/push-token-aufraeumen/.
--
-- ══ WORUM ES GEHT ══════════════════════════════════════════════════════════
-- Der bestehende Loeschpfad haengt an einer ABLEHNUNG des Anbieters:
-- `dauerhaft` -> `push_zustellung_quittieren` -> `delete from push_tokens`.
-- APNs lehnt ein Token einer deinstallierten App aber auf einem bewusst
-- unscharfen Zeitplan ab — womoeglich nie. Diese Zeile verschwindet dann von
-- selbst NICHT.
--
-- ══ DIE POSITIVKONTROLLE IST DER GANZE PUNKT ═══════════════════════════════
-- Ein Aufraeumer, der nichts findet, und einer, der ALLES loescht, sehen ohne
-- Gegenprobe identisch aus. Solange `push_tokens` fast leer ist (1 Zeile auf
-- PROD, 2 auf DEV), waere ein Lauf ohne zweite Zeile vakuum-gruen.
--
-- Deshalb drei Tokenzeilen, nicht eine:
--   ALT     181 Tage — muss weg
--   FRISCH  ueber `claim_push_token`, also den ECHTEN Weg — muss bleiben
--   GRENZE  179 Tage — muss bleiben (der Tag vor der Frist)
--
-- Und im Integrationsteil noch einmal dasselbe: ein faelliger Auftrag auf
-- einem frischen Token MUSS zurueckkommen, sonst belegt „null Auftraege auf
-- dem alten" nur, dass die Funktion ueberhaupt nichts liefert.
--
-- ══ DAS LEBENSZEICHEN ENTSTEHT UEBER DEN ECHTEN WEG ════════════════════════
-- `claim_push_token`, nicht ein direktes `update`. Ein Test, der die Spalte
-- selbst setzt, prueft seine eigene Fixture; genau diese Verwechslung hat den
-- Vorgang ueberhaupt ausgeloest — der Spaltenkommentar behauptete ein
-- Lebenszeichen, das kein Aufrufer erzeugte.
--
-- ══ DIE FALLEN AUS DEN VORIGEN DATEIEN GELTEN WEITER ═══════════════════════
-- `alike()` statt `like()`. `try_as()` meldet jeden Fehler als DENIED, auch
-- einen Tippfehler — wo es auf die Wirkung ankommt, wird gezaehlt.
-- ════════════════════════════════════════════════════════════════════════════

begin;
select plan(14);

-- ── Impersonierung ──────────────────────────────────────────────────────────
-- Eigene Kopien: jede Testdatei laeuft in ihrer eigenen Sitzung.
create function pg_temp.try_as(uid uuid, q text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q;
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    return 'DENIED:' || SQLERRM;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'OK';
end $$;

-- Ohne JWT, nur die Rolle: fuer `anon` und `service_role` gibt es kein `sub`.
create function pg_temp.try_as_rolle(rolle text, q text) returns text language plpgsql as $$
begin
  execute 'set local role ' || quote_ident(rolle);
  begin
    execute q;
  exception when others then
    reset role;
    return 'DENIED:' || SQLERRM;
  end;
  reset role;
  return 'OK';
end $$;

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, aud, role, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'ta-anna@test.fbc'),
  ('a0000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'ta-bodo@test.fbc');

update public.profiles set tier = 'impact', name = 'TA Anna', activated_at = now()
 where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set tier = 'impact', name = 'TA Bodo', activated_at = now()
 where id = 'a0000000-0000-0000-0000-00000000000b';

-- ALT und GRENZE direkt gesetzt: eine Zeile zu ALTERN ist der einzige Weg,
-- der ohne halbes Jahr Wartezeit auskommt. Das ist die Fixture, nicht der
-- gepruefte Weg — der steht gleich darunter.
insert into public.push_tokens (profile_id, token, plattform, letzter_kontakt) values
  ('a0000000-0000-0000-0000-00000000000a', 'ta-alt', 'ios',
   now() - interval '181 days'),
  ('a0000000-0000-0000-0000-00000000000b', 'ta-grenze', 'android',
   now() - interval '179 days');

-- FRISCH ueber den echten Weg. `claim_push_token` schreibt auf `auth.uid()`,
-- braucht also die Impersonierung.
select is(
  pg_temp.try_as('a0000000-0000-0000-0000-00000000000a',
    $$select count(*) from public.claim_push_token('ta-frisch', 'ios')$$),
  'OK', 'Positivkontrolle: das frische Token entsteht ueber claim_push_token');

select is(
  (select count(*)::int from public.push_tokens where token like 'ta-%'),
  3, 'Positivkontrolle: drei Tokenzeilen stehen vor dem Aufraeumen');

-- ── 1. Der Aufraeumer, direkt gerufen ───────────────────────────────────────
select is(
  (select public.push_tokens_aufraeumen()),
  1, 'genau EINE Zeile wird entfernt — nicht null, nicht drei');

select is(
  (select count(*)::int from public.push_tokens where token = 'ta-alt'),
  0, 'das Token ohne Lebenszeichen ist weg');

select is(
  (select count(*)::int from public.push_tokens where token = 'ta-frisch'),
  1, 'das Token MIT frischem Lebenszeichen bleibt — die Positivkontrolle');

select is(
  (select count(*)::int from public.push_tokens where token = 'ta-grenze'),
  1, 'der Tag VOR der Frist bleibt: 179 Tage sind nicht 181');

-- ── 2. Die Hinweise bleiben unangetastet ────────────────────────────────────
-- Das Loeschen nimmt den WEG aufs Geraet, nicht die Nachricht. Ohne diese
-- Zusage koennte die Kaskade unbemerkt weiter reichen, als sie soll.
insert into public.notifications (id, profile_id, type, payload) values
  ('a1000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-00000000000a', 'message',
   jsonb_build_object('thread_id', 't-1', 'sender_name', 'TA Bodo'));

insert into public.push_tokens (profile_id, token, plattform, letzter_kontakt) values
  ('a0000000-0000-0000-0000-00000000000a', 'ta-alt-2', 'ios',
   now() - interval '200 days');

select is(
  (select public.push_tokens_aufraeumen()),
  1, 'Positivkontrolle: der zweite Lauf entfernt die zweite alte Zeile');

select is(
  (select count(*)::int from public.notifications
    where id = 'a1000000-0000-0000-0000-000000000001'),
  1, 'die Zeile in notifications bleibt bestehen');

-- ── 3. Der Faelligkeitslauf raeumt auf, BEVOR er vergibt ────────────────────
-- Zwei Zustellzeilen, beide faellig: eine auf einem abgestandenen Token, eine
-- auf einem frischen. Nur die zweite darf zurueckkommen.
insert into public.push_tokens (profile_id, token, plattform, letzter_kontakt) values
  ('a0000000-0000-0000-0000-00000000000b', 'ta-alt-3', 'android',
   now() - interval '190 days');

insert into public.notifications (id, profile_id, type, payload) values
  ('a1000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-00000000000b', 'message',
   jsonb_build_object('thread_id', 't-2', 'sender_name', 'TA Anna'));

insert into public.push_zustellungen (notification_id, token_id, zustand, naechster_versuch)
select 'a1000000-0000-0000-0000-000000000002', t.id, 'offen', now() - interval '1 minute'
  from public.push_tokens t
 where t.token in ('ta-alt-3', 'ta-grenze');

select is(
  (select count(*)::int from public.push_auftraege_faellig()
    where notification_id = 'a1000000-0000-0000-0000-000000000002'),
  1, 'Positivkontrolle: der faellige Auftrag auf dem lebenden Token kommt zurueck');

select is(
  (select count(*)::int from public.push_tokens where token = 'ta-alt-3'),
  0, 'das abgestandene Token wurde vom Faelligkeitslauf selbst entfernt');

select is(
  (select count(*)::int from public.push_zustellungen z
     join public.notifications n on n.id = z.notification_id
    where n.id = 'a1000000-0000-0000-0000-000000000002'),
  1, 'seine Zustellzeile ging mit der Kaskade — nur die lebende bleibt');

-- ── 4. Niemand ausserhalb der Datenbank darf den Aufraeumer rufen ───────────
-- `security definer` auf einer LOESCHENDEN Funktion. Der Entzug muss an der
-- Funktion stehen: Default Privileges wirken auf Funktionen nicht, und dieses
-- Projekt fuehrt rollen-eigene Grants — `service_role` gehoert deshalb
-- ausdruecklich dazu und nicht bloss `public`.
select alike(
  pg_temp.try_as('a0000000-0000-0000-0000-00000000000a',
    $$select public.push_tokens_aufraeumen()$$),
  'DENIED:%', 'authenticated darf den Aufraeumer nicht rufen');

select alike(
  pg_temp.try_as_rolle('anon', $$select public.push_tokens_aufraeumen()$$),
  'DENIED:%', 'anon darf den Aufraeumer nicht rufen');

select alike(
  pg_temp.try_as_rolle('service_role', $$select public.push_tokens_aufraeumen()$$),
  'DENIED:%', 'service_role darf den Aufraeumer nicht rufen');

select * from finish();
rollback;
