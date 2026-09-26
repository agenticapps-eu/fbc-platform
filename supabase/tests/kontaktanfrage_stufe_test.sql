-- Kontaktanfragen hängen allein an der ABSENDERstufe (AGE-903).
-- Vorher: gestaffelte Kontaktanfragen (AGE-598, Teil B).
--
-- Die Regel ab AGE-903, und sie ist einfacher als die, die sie ersetzt:
--
--   ab Rang 4 (`discover`, die unterste Clubstufe)  an JEDEN
--   darunter                                        an NIEMANDEN
--
-- Die Staffelung nach Empfängerstufe ist **ersatzlos entfallen**. Sie lautete
-- „`connect` nur an genau `connect`" und war eine Aussage über eine Stufe, die
-- es in dieser Bedeutung nicht mehr gibt: `connect` stand auf Rang 2 und steht
-- jetzt auf Rang 3 — in beiden Fällen ausserhalb des Clubs, und damit ohne
-- jedes Senderecht.
--
-- Diese Datei hiess bis AGE-903 `kontaktanfrage_staffelung_test.sql`. Der Name
-- ist mitgewandert, weil eine Datei, die belegt, dass es KEINE Staffelung gibt,
-- nicht so heissen kann.
--
-- ══ DIE EMPFAENGERSTUFE IST DER MESSWERT, DER NICHTS AENDERT ════════════════
-- Abschnitt 1 fährt sechs Absenderstufen gegen zwei Zielstufen — eine
-- ausserhalb des Clubs (Rang 2) und eine an der Spitze (Rang 6). Die Zusage
-- ist, dass die zweite Achse die Antwort NICHT beeinflusst. Nur ein Ziel zu
-- prüfen liesse offen, ob die Staffelung wirklich weg ist oder bloss an diesem
-- einen Ziel nicht auffällt.
--
-- ══ WARUM EINE EIGENE DATEI ═════════════════════════════════════════════════
-- `rls_test.sql` prüft die Rechte-Matrix als GANZES und ist 194k gross. Die
-- Stufenfrage braucht sechs Absenderstufen gegen zwei Zielstufen, also zwölf
-- Zusagen allein für das Prädikat; sie gehören zusammen und nicht verstreut.
--
-- **Diese Datei muss in `.github/workflows/ci.yml` eingetragen sein.** Eine
-- pgTAP-Datei mit `plan()` ist kein Beleg dafür, dass sie irgendwo läuft: zwei
-- Dateien standen am 23.08. im Repo und liefen kein einziges Mal in CI.
--
-- ══ ALLE ZIELE SIND 90 TAGE ALT, UND DAS IST ABSICHT ════════════════════════
-- Der Welpenschutz (Klausel 332: kalt nur an Konten, die älter als 30 Tage
-- sind) ist seit dem 02.09. gestrichen. Die Ziele bleiben trotzdem alt: ein
-- frisch angelegtes Fixture fiele an einer Klausel durch, die diese Datei gar
-- nicht misst — und ein RED sähe dann plausibel aus, wäre aber aus dem falschen
-- Grund rot.
--
-- Genau EIN Ziel ist deshalb tagesfrisch (`…0004`): es ist der Beleg, dass die
-- Klausel wirklich weg ist, und zwar in BEIDEN Schalterstellungen.

begin;
select plan(32);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- `auth.users`-Insert feuert `handle_new_user()` und legt die `public.profiles`-
-- Zeile an. Danach Stufe, Aktivierung und Alter setzen.
insert into auth.users (id, aud, role, email) values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'stufe-active@test.fbc'),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'stufe-boost@test.fbc'),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'stufe-connect@test.fbc'),
  ('10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'stufe-discover@test.fbc'),
  ('10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'stufe-focus@test.fbc'),
  ('10000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'stufe-impact@test.fbc'),
  ('20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ziel-boost@test.fbc'),
  ('20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'ziel-impact@test.fbc'),
  ('20000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'ziel-optout@test.fbc'),
  ('20000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'ziel-frisch@test.fbc');

-- Rangtreu besetzt: jedes Fixture behält den RANG, den es vorher hatte, und
-- bekommt den Schlüssel, der jetzt auf diesem Rang sitzt. Die Grenze wandert
-- also durch die Fixtures hindurch — Rang 3 stand vorher darüber und steht
-- jetzt darunter, und genau das ist die Änderung.
update public.profiles set tier = 'active',   name = 'Sender Active'   where id = '10000000-0000-0000-0000-000000000001';
update public.profiles set tier = 'boost',    name = 'Sender Boost'    where id = '10000000-0000-0000-0000-000000000002';
update public.profiles set tier = 'connect',  name = 'Sender Connect'  where id = '10000000-0000-0000-0000-000000000003';
update public.profiles set tier = 'discover', name = 'Sender Discover' where id = '10000000-0000-0000-0000-000000000004';
update public.profiles set tier = 'focus',    name = 'Sender Focus'    where id = '10000000-0000-0000-0000-000000000005';
update public.profiles set tier = 'impact',   name = 'Sender Impact'   where id = '10000000-0000-0000-0000-000000000006';
-- Das Ziel ausserhalb des Clubs (Rang 2). Es belegt, dass die Empfängerstufe
-- nichts mehr entscheidet: ab Rang 4 darf man auch HIERHIN schreiben.
update public.profiles set tier = 'boost',    name = 'Ziel Boost'      where id = '20000000-0000-0000-0000-000000000001';
update public.profiles set tier = 'impact',   name = 'Ziel Impact'     where id = '20000000-0000-0000-0000-000000000002';
update public.profiles set tier = 'impact',   name = 'Ziel OptOut'     where id = '20000000-0000-0000-0000-000000000003';
update public.profiles set tier = 'impact',   name = 'Ziel Frisch'     where id = '20000000-0000-0000-0000-000000000004';

-- Das tagesfrische Ziel: aktiviert, aber `created_at` bleibt auf `now()`. Es
-- steht ausserhalb der Rückdatierung unten — es IST der Welpenschutz-Fall.
update public.profiles set activated_at = now()
 where id = '20000000-0000-0000-0000-000000000004';

-- Aktivierung: `cr_insert_self` trägt `is_activated()` als erste Klausel. Ohne
-- diese Zeile fiele jede Zusage dieser Datei am Gate durch, und keine einzige
-- hätte die Stufenschwelle je gefragt.
update public.profiles
   set activated_at = now(),
       created_at   = now() - interval '90 days'
 where id in (
   '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004',
   '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000006',
   '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000003');

-- Der Empfänger, der keine Anfragen will (Klausel `is_contactable`).
insert into public.member_settings (profile_id, contactable_by_prime)
values ('20000000-0000-0000-0000-000000000003', false);

-- Ein Match, das ein ANDERES Paar verbindet als die Anfrage, die es begründen
-- soll. Es belegt die Paarbindung — ein beliebiges `match_id` darf nicht
-- genügen.
insert into public.matches (id, a_profile_id, b_profile_id, score) values
  ('30000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005', 42);

-- ── Helfer ──────────────────────────────────────────────────────────────────
-- Das Prädikat liest die Stufe des AUFRUFERS über `has_level` und muss deshalb
-- unter dessen Identität laufen. Der Fehlerzweig gibt NULL zurück statt die
-- Transaktion zu reissen: solange das Prädikat noch nicht existiert (RED),
-- stürben sonst alle folgenden Zusagen an „current transaction is aborted" und
-- der erste echte Fehler läge unter Dutzenden Folgefehlern begraben.
create function pg_temp.darf_als(uid uuid, ziel uuid) returns boolean
language plpgsql as $$
declare b boolean;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute format('select public.darf_kontaktanfrage_senden(%L::uuid)', ziel) into b;
  exception when others then
    b := null;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return b;
end $$;

-- `try_as`: 'OK', wenn die Anweisung unter der Identität durchgeht, sonst
-- 'FEHLER:<sqlstate> <meldung>'. Der SQLSTATE gehört MIT in die Rückgabe:
-- ohne ihn ist eine RLS-Ablehnung von einem Tippfehler nicht zu unterscheiden,
-- und ein `alike(…, 'DENIED:%')` wäre grün, sobald irgendetwas schiefgeht.
create function pg_temp.try_as(uid uuid, q text) returns text
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q;
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    return 'FEHLER:' || SQLSTATE || ' ' || SQLERRM;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'OK';
end $$;

-- Die Anfrage als Anweisung — `format` läuft als Eigentümer, VOR der
-- Impersonierung. Werte niemals im impersonierten Ausdruck aus einer
-- Hilfstabelle lesen: `authenticated` hat an `pg_temp` keine Rechte, und der
-- daraus folgende `42501` sähe aus wie eine RLS-Ablehnung.
create function pg_temp.anfrage(von uuid, an uuid) returns text
language sql as $$
  select format(
    'insert into public.contact_requests (from_id, to_id) values (%L::uuid, %L::uuid)',
    von, an)
$$;

-- ── 1. Das Prädikat selbst ──────────────────────────────────────────────────
-- Sechs Absenderstufen gegen zwei Zielstufen. Die Zusage ist zweiteilig: die
-- Absenderstufe entscheidet, und die Empfängerstufe entscheidet NICHTS.
--
-- Der Schalter wird hier AUSDRÜCKLICH gesetzt und nicht vorausgesetzt: auf PROD
-- steht `open_contact` auf `true` und hebt die Schwelle vollständig auf. Eine
-- Zusage über die Schwelle, die den Schalter nicht selbst stellt, wäre bei
-- offenem Schalter grün, ohne die Schwelle je gefragt zu haben.
--
-- Zurückgestellt wird er durch das `rollback` am Dateiende — die ganze Datei
-- läuft in EINER Transaktion. Ein zusätzliches `set open_contact = true` am
-- Ende wäre nicht nur überflüssig, es schriebe auch den falschen Wert fest,
-- falls eine Umgebung ihn je auf `false` stehen hat.
update public.platform_settings set open_contact = false;

-- Unterhalb des Clubs: dreimal nein, und zwar an BEIDE Ziele. Dass auch das
-- Ziel auf Rang 2 verschlossen bleibt, ist die Zusage, dass „connect an
-- connect" wirklich weg ist und nicht bloss anders heisst.
select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
  false, 'Rang 1 (active) darf nicht an Rang 2');
select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002'),
  false, 'Rang 1 (active) darf nicht an Rang 6');

select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001'),
  false, 'Rang 2 (boost) darf nicht an Rang 2');
select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002'),
  false, 'Rang 2 (boost) darf nicht an Rang 6');

-- Die Zusage, an der die entfallene Staffelung haengt. Vorher durfte ein
-- Absender auf DIESEM Rang an ein gleichstufiges Ziel schreiben — das war die
-- ganze Regel „genau connect". Jetzt darf er es nicht, und auch sonst nichts.
select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001'),
  false, 'Rang 3 (connect) darf NICHT an Rang 2 — die Staffelung ist ersatzlos weg');
select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002'),
  false, 'Rang 3 (connect) darf nicht an Rang 6 — der Club beginnt erst bei 4');

-- Ab der untersten Clubstufe: dreimal ja, und zwar ebenfalls an BEIDE Ziele.
-- Das Ziel auf Rang 2 ist hier der Messwert: waere die Empfaengerstufe noch
-- eine Bedingung, stuende hier `false`.
select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001'),
  true,  'Rang 4 (discover) darf an Rang 2 — die Empfaengerstufe entscheidet nichts');
select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002'),
  true,  'Rang 4 (discover) darf an Rang 6');

select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001'),
  true,  'Rang 5 (focus) darf an Rang 2');
select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002'),
  true,  'Rang 5 (focus) darf an Rang 6');

select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001'),
  true,  'Rang 6 (impact) darf an Rang 2');
select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002'),
  true,  'Rang 6 (impact) darf an Rang 6');

-- ── 2. Die Policy im GESCHLOSSENEN Modus ────────────────────────────────────
-- `open_contact = false` steht seit Abschnitt 1. Die Schwelle wirkt nur hier —
-- bei offenem Schalter laesst Klausel 320 ohnehin jeden durch.
--
-- Die Ablehnung ist an der RLS-Meldung verankert, nicht an „irgendein Fehler".
-- Ein Unique-Verstoss, ein fehlendes Recht und eine Policy-Ablehnung saehen
-- sonst gleich aus.
--
-- Drei Ablehnungen und EINE Positivkontrolle. Ohne die letzte waere der
-- Abschnitt auch dann gruen, wenn die Policy gar nichts mehr durchliesse.
select alike(
  pg_temp.try_as('10000000-0000-0000-0000-000000000001',
    pg_temp.anfrage('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001')),
  'FEHLER:42501 %row-level security policy%',
  'geschlossen: Rang 1 wird von der Policy abgewiesen');

-- Die Stelle, an der AGE-903 sichtbar EINSCHRAENKT. Bis hierher durfte ein
-- Absender auf Rang 3 an ein gleichstufiges Ziel schreiben; die Policy trug
-- dafuer die Staffelung. Jetzt traegt sie has_level(4), und dieser Weg ist zu.
select alike(
  pg_temp.try_as('10000000-0000-0000-0000-000000000003',
    pg_temp.anfrage('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001')),
  'FEHLER:42501 %row-level security policy%',
  'geschlossen: Rang 3 wird auch bei einem Ziel auf Rang 2 abgewiesen');

select alike(
  pg_temp.try_as('10000000-0000-0000-0000-000000000003',
    pg_temp.anfrage('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002')),
  'FEHLER:42501 %row-level security policy%',
  'geschlossen: Rang 3 wird bei Rang 6 abgewiesen');

-- Die Positivkontrolle: die unterste Clubstufe kommt durch. Sie belegt, dass
-- die drei Ablehnungen von der SCHWELLE kommen und nicht von einer anderen
-- Klausel, die gerade alles zumacht.
select is(
  pg_temp.try_as('10000000-0000-0000-0000-000000000004',
    pg_temp.anfrage('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002')),
  'OK', 'geschlossen: Rang 4 kommt durch — die unterste Clubstufe darf senden');

-- Die geglueckte Anfrage wieder wegraeumen. `contact_requests` traegt ein
-- Unique ueber (from_id, to_id); ohne das Aufraeumen misst Abschnitt 3 bei
-- offenem Schalter den Constraint statt der Policy.
delete from public.contact_requests
 where from_id = '10000000-0000-0000-0000-000000000004';

-- ── 3. Die vier unverändert geltenden Zusagen ───────────────────────────────
-- In BEIDEN Schalterstellungen. Sie hängen nicht an der Stufenschwelle, und
-- genau das ist die Aussage: Klausel 320 auszutauschen darf sie nicht
-- mitnehmen. Absender ist durchweg `impact` — er passiert die Schwelle in jeder
-- Stellung, die Ablehnung kann also nur aus der gemeinten Klausel kommen.

-- 3a. Geschlossener Modus.
select alike(
  pg_temp.try_as('10000000-0000-0000-0000-000000000006',
    pg_temp.anfrage('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002')),
  'FEHLER:42501 %row-level security policy%',
  'geschlossen: ein fremdes from_id wird abgewiesen');

select alike(
  pg_temp.try_as('10000000-0000-0000-0000-000000000006',
    'insert into public.contact_requests (from_id, to_id, status) values '
    '(''10000000-0000-0000-0000-000000000006''::uuid, ''20000000-0000-0000-0000-000000000002''::uuid, ''accepted'')'),
  'FEHLER:42501 %row-level security policy%',
  'geschlossen: eine Anfrage muss pending sein');

select alike(
  pg_temp.try_as('10000000-0000-0000-0000-000000000006',
    'insert into public.contact_requests (from_id, to_id, match_id) values '
    '(''10000000-0000-0000-0000-000000000006''::uuid, ''20000000-0000-0000-0000-000000000002''::uuid, '
    '''30000000-0000-0000-0000-000000000001''::uuid)'),
  'FEHLER:42501 %row-level security policy%',
  'geschlossen: ein match_id eines fremden Paares traegt die Anfrage nicht');

select alike(
  pg_temp.try_as('10000000-0000-0000-0000-000000000006',
    pg_temp.anfrage('10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000003')),
  'FEHLER:42501 %row-level security policy%',
  'geschlossen: ein Empfaenger mit Opt-out ist nicht erreichbar');

-- 3b. Offener Modus — dieselben vier.
update public.platform_settings set open_contact = true;

select alike(
  pg_temp.try_as('10000000-0000-0000-0000-000000000006',
    pg_temp.anfrage('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002')),
  'FEHLER:42501 %row-level security policy%',
  'offen: ein fremdes from_id wird abgewiesen');

select alike(
  pg_temp.try_as('10000000-0000-0000-0000-000000000006',
    'insert into public.contact_requests (from_id, to_id, status) values '
    '(''10000000-0000-0000-0000-000000000006''::uuid, ''20000000-0000-0000-0000-000000000002''::uuid, ''accepted'')'),
  'FEHLER:42501 %row-level security policy%',
  'offen: eine Anfrage muss pending sein');

select alike(
  pg_temp.try_as('10000000-0000-0000-0000-000000000006',
    'insert into public.contact_requests (from_id, to_id, match_id) values '
    '(''10000000-0000-0000-0000-000000000006''::uuid, ''20000000-0000-0000-0000-000000000002''::uuid, '
    '''30000000-0000-0000-0000-000000000001''::uuid)'),
  'FEHLER:42501 %row-level security policy%',
  'offen: ein match_id eines fremden Paares traegt die Anfrage nicht');

select alike(
  pg_temp.try_as('10000000-0000-0000-0000-000000000006',
    pg_temp.anfrage('10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000003')),
  'FEHLER:42501 %row-level security policy%',
  'offen: ein Empfaenger mit Opt-out ist nicht erreichbar');

-- ── 3c. Der Welpenschutz ist weg (6.1, 6.4) ─────────────────────────────────
-- Eine KALTE Anfrage — ohne `match_id` — an ein Konto, das am selben Tag
-- registriert wurde. Bis zum 02.09. wies Klausel 332 sie im geschlossenen
-- Modus ab; sie ist ersatzlos gestrichen.
--
-- Der Grund ist gemessen, nicht gemeint: alle 74 Profile auf PROD sind jünger
-- als 30 Tage. Ein eingeschalteter Welpenschutz hätte die Kontaktfunktion
-- plattformweit stillgelegt, mit rund 2 % Durchlass über Übereinstimmungen.
-- Eine Schutzregel, die man wegen ihrer eigenen Wirkung nie einschalten kann,
-- ist keine Regel.
--
-- Beide Schalterstellungen, weil der Schalter sie bis heute verdeckt hat: bei
-- `open_contact = true` (dem Stand seit dem 05.08.) war die Klausel ohnehin
-- offen, und ein Test allein in dieser Stellung hätte das Streichen gar nicht
-- bemerkt.
select is(
  pg_temp.try_as('10000000-0000-0000-0000-000000000005',
    pg_temp.anfrage('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000004')),
  'OK', 'offen: eine Kaltanfrage an ein tagesfrisches Konto geht durch');

update public.platform_settings set open_contact = false;

-- Absender ab Rang 4, damit die Stufenschwelle nicht die Antwort gibt: was hier
-- gemessen wird, ist der Welpenschutz und nichts sonst.
--
-- Bis AGE-903 stand hier Rang 3, und das war damals richtig — Rang 3 hiess
-- `discover` und lag ÜBER der Schwelle. Jetzt liegt Rang 3 darunter, und die
-- Zusage wäre rot geworden, ohne dass am Welpenschutz etwas falsch ist. Genau
-- die Sorte Fundstelle, die ein mechanisches Umbenennen übersieht.
select is(
  pg_temp.try_as('10000000-0000-0000-0000-000000000004',
    pg_temp.anfrage('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004')),
  'OK', 'geschlossen: eine Kaltanfrage an ein tagesfrisches Konto geht durch');

-- Ohne diese Zusage bliebe der Drop unbelegt: die Klausel zu streichen und die
-- Funktion stehen zu lassen sähe von aussen genauso aus.
select hasnt_function('public', 'is_new_member', array['uuid'],
  'is_new_member(uuid) existiert nicht mehr');

-- ── 4. Die Form des Prädikats ───────────────────────────────────────────────
-- Was das Verhalten oben nicht zeigt, aber trägt.
--
-- **Der Grund für `security definer` ist mit AGE-903 entfallen, die Eigenschaft
-- bleibt.** Vorher las das Prädikat `profiles.tier` des EMPFÄNGERS, und ein
-- Konto ausserhalb des Clubs darf fremde volle Zeilen nicht lesen — ohne
-- DEFINER wäre es still auf „kein Recht" gefallen und hätte JEDE Anfrage
-- verboten. Jetzt liest es nur noch `has_level(4)`, also die eigene Stufe, und
-- bräuchte DEFINER nicht mehr.
--
-- Es auf INVOKER umzustellen ist deshalb möglich und hier ausdrücklich NICHT
-- getan: es wäre eine zweite Änderung an einem Prädikat, das in einer Policy
-- steht, mit eigenem Risiko und eigener Golden-Liste in `grants_test.sql`. Die
-- Zusagen unten halten die Form fest, wie sie ist — nicht, wie sie begründet
-- war.
select has_function('public', 'darf_kontaktanfrage_senden', array['uuid'],
  'darf_kontaktanfrage_senden(uuid) existiert');

select is(
  (select provolatile from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'darf_kontaktanfrage_senden'),
  's'::"char", 'Das Praedikat ist stable');

select is(
  (select p.prosecdef::text || '/' || coalesce(array_to_string(p.proconfig, ','), '(keiner)')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'darf_kontaktanfrage_senden'),
  'true/search_path=""',
  'Das Praedikat ist security definer MIT geleertem search_path');

-- Die beiden Grants. Eine neue Funktion erbt EXECUTE über PUBLIC — ohne den
-- ausdrücklichen `revoke` dürfte ein AUSGELOGGTER Aufrufer ein
-- `security definer`-Prädikat ausführen, das `profiles.tier` fremder UUIDs
-- liest. `grants_test.sql` Abschnitt 6 sagt dasselbe von der anderen Seite;
-- bricht er, ist genau dieser `revoke` die Reparatur — nicht die Golden-Liste.
--
-- Über die `oid` und mit `coalesce` in die FALSCHE Richtung: die Namensform
-- `has_function_privilege('anon', 'public.…(uuid)', …)` wirft, solange die
-- Funktion fehlt, und risse damit im RED die ganze Transaktion mit. Die
-- Vorgabe ist deshalb jeweils das, was die Zusage scheitern lässt.
select ok(
  not coalesce((select has_function_privilege('anon', p.oid, 'EXECUTE')
                  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'darf_kontaktanfrage_senden'), true),
  'anon darf das Praedikat NICHT ausfuehren');

select ok(
  coalesce((select has_function_privilege('authenticated', p.oid, 'EXECUTE')
              from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'darf_kontaktanfrage_senden'), false),
  'authenticated darf das Praedikat ausfuehren');

select * from finish();
rollback;
