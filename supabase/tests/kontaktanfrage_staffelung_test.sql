-- Gestaffelte Kontaktanfragen (AGE-598, Teil B) — `supabase test db`.
--
-- Aufgaben 5.1, 5.3 und 5.5 aus openspec/changes/rechte-matrix-stufen/tasks.md.
-- Die Regel steht in den Goals des Entwurfs und stammt von Donald (25.08.):
--
--   `basic`    gar nicht
--   `connect`  nur an GENAU `connect`
--   ab `discover` an alle
--
-- „Genau `connect`" ist die ausdrückliche Auslegung, nicht „`connect` und
-- darüber" — mitsamt der benannten Folge: bei heute 73 × `impact` und
-- 0 × `connect` darf ein `connect`-Mitglied niemanden anschreiben. Das wird
-- hier nicht stillschweigend geglättet, sondern zugesagt (Abschnitt 1).
--
-- ══ WARUM EINE EIGENE DATEI ═════════════════════════════════════════════════
-- `rls_test.sql` prüft die Rechte-Matrix als GANZES und ist 194k gross. Die
-- Staffelung braucht sechs Absenderstufen gegen zwei Zielstufen, also zwölf
-- Zusagen allein für das Prädikat; sie gehören zusammen und nicht verstreut.
-- Die drei Fundstellen in `rls_test.sql`, die von dieser Änderung kippen
-- (Zeilen 260, 268, 272), werden dort behandelt, nicht hier — Aufgabe 6.5.
--
-- **Diese Datei muss in `.github/workflows/ci.yml` eingetragen sein.** Eine
-- pgTAP-Datei mit `plan()` ist kein Beleg dafür, dass sie irgendwo läuft: zwei
-- Dateien standen am 23.08. im Repo und liefen kein einziges Mal in CI.
--
-- ══ ALLE ZIELE SIND 90 TAGE ALT, UND DAS IST ABSICHT ════════════════════════
-- Solange Aufgabe 6 nicht gelaufen ist, trägt `cr_insert_self` NEBEN der
-- Staffelung weiterhin den Welpenschutz (Klausel 332: kalt nur an Konten, die
-- älter als 30 Tage sind). Ein frisch angelegtes Fixture fiele also an einer
-- Klausel durch, die diese Datei gar nicht misst — und der RED sähe plausibel
-- aus, wäre aber aus dem falschen Grund rot. Deshalb sind die Ziele alt.
--
-- Nach dem Streichen von Klausel 332 bleiben dieselben Zusagen grün. Genau EIN
-- Ziel ist deshalb tagesfrisch (`…0004`): es ist der Beleg, dass die Klausel
-- wirklich weg ist, und es kam mit Aufgabe 6.1 dazu — vorher wäre es an einer
-- Klausel gescheitert, die diese Datei gar nicht misst.

begin;
select plan(32);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- `auth.users`-Insert feuert `handle_new_user()` und legt die `public.profiles`-
-- Zeile an. Danach Stufe, Aktivierung und Alter setzen.
insert into auth.users (id, aud, role, email) values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'staffel-basic@test.fbc'),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'staffel-connect@test.fbc'),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'staffel-discover@test.fbc'),
  ('10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'staffel-exchange@test.fbc'),
  ('10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'staffel-focus@test.fbc'),
  ('10000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'staffel-impact@test.fbc'),
  ('20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ziel-connect@test.fbc'),
  ('20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'ziel-impact@test.fbc'),
  ('20000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'ziel-optout@test.fbc'),
  ('20000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'ziel-frisch@test.fbc');

update public.profiles set tier = 'basic',    name = 'Sender Basic'    where id = '10000000-0000-0000-0000-000000000001';
update public.profiles set tier = 'connect',  name = 'Sender Connect'  where id = '10000000-0000-0000-0000-000000000002';
update public.profiles set tier = 'discover', name = 'Sender Discover' where id = '10000000-0000-0000-0000-000000000003';
update public.profiles set tier = 'exchange', name = 'Sender Exchange' where id = '10000000-0000-0000-0000-000000000004';
update public.profiles set tier = 'focus',    name = 'Sender Focus'    where id = '10000000-0000-0000-0000-000000000005';
update public.profiles set tier = 'impact',   name = 'Sender Impact'   where id = '10000000-0000-0000-0000-000000000006';
update public.profiles set tier = 'connect',  name = 'Ziel Connect'    where id = '20000000-0000-0000-0000-000000000001';
update public.profiles set tier = 'impact',   name = 'Ziel Impact'     where id = '20000000-0000-0000-0000-000000000002';
update public.profiles set tier = 'impact',   name = 'Ziel OptOut'     where id = '20000000-0000-0000-0000-000000000003';
update public.profiles set tier = 'impact',   name = 'Ziel Frisch'     where id = '20000000-0000-0000-0000-000000000004';

-- Das tagesfrische Ziel: aktiviert, aber `created_at` bleibt auf `now()`. Es
-- steht ausserhalb der Rückdatierung unten — es IST der Welpenschutz-Fall.
update public.profiles set activated_at = now()
 where id = '20000000-0000-0000-0000-000000000004';

-- Aktivierung: `cr_insert_self` trägt `is_activated()` als erste Klausel. Ohne
-- diese Zeile fiele jede Zusage dieser Datei am Gate durch, und keine einzige
-- hätte die Staffelung je gefragt.
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

-- ── 1. Das Prädikat selbst (5.1) ────────────────────────────────────────────
-- Sechs Absenderstufen gegen zwei Zielstufen. Ein Test gegen `basic` und
-- `discover` allein bestätigt die `connect`→`connect`-Regel nie — sie ist die
-- einzige, die vom ZIEL abhängt.
update public.platform_settings set open_contact = false;

select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
  false, 'basic darf nicht an connect');
select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002'),
  false, 'basic darf nicht an impact');

select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001'),
  true,  'connect darf an connect');
-- Die Zusage, die die Auslegung festhält. Fiele sie weg, liesse sich „genau
-- connect" nicht von „connect und darüber" unterscheiden.
select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002'),
  false, 'connect darf NICHT an impact — die Regel lautet genau connect');

select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001'),
  true,  'discover darf an connect');
select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002'),
  true,  'discover darf an impact');

select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001'),
  true,  'exchange darf an connect');
select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002'),
  true,  'exchange darf an impact');

select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001'),
  true,  'focus darf an connect');
select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002'),
  true,  'focus darf an impact');

select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001'),
  true,  'impact darf an connect');
select is(pg_temp.darf_als('10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002'),
  true,  'impact darf an impact');

-- ── 2. Die Policy im GESCHLOSSENEN Modus (5.3) ──────────────────────────────
-- `open_contact = false` steht seit Abschnitt 1. Die Staffelung wirkt nur
-- hier — bei offenem Schalter lässt Klausel 320 ohnehin jeden durch.
--
-- Die Ablehnung ist an der RLS-Meldung verankert, nicht an „irgendein Fehler".
-- Ein Unique-Verstoss, ein fehlendes Recht und eine Policy-Ablehnung sähen
-- sonst gleich aus.
select alike(
  pg_temp.try_as('10000000-0000-0000-0000-000000000001',
    pg_temp.anfrage('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001')),
  'FEHLER:42501 %row-level security policy%',
  'basic wird von der Policy abgewiesen (geschlossener Modus)');

select is(
  pg_temp.try_as('10000000-0000-0000-0000-000000000002',
    pg_temp.anfrage('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001')),
  'OK', 'connect kommt bei connect durch (geschlossener Modus)');

select alike(
  pg_temp.try_as('10000000-0000-0000-0000-000000000002',
    pg_temp.anfrage('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002')),
  'FEHLER:42501 %row-level security policy%',
  'connect wird bei impact abgewiesen (geschlossener Modus)');

-- Die ERWEITERUNG gegenüber heute, und sie will benannt sein: Klausel 320
-- lautet bis zu dieser Aufgabe `has_level(4)`, ein `discover`-Konto darf im
-- geschlossenen Modus also NICHT senden (`rls_test.sql:260` sagt genau das zu
-- und wird in 6.5 umgeschrieben). Der Change liest sich sonst durchweg als
-- Einschränkung — an dieser einen Stelle ist er das Gegenteil.
select is(
  pg_temp.try_as('10000000-0000-0000-0000-000000000003',
    pg_temp.anfrage('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002')),
  'OK', 'discover kommt jetzt durch — die Erweiterung, ausdrücklich');

-- Die beiden geglückten Anfragen wieder wegräumen. `contact_requests` trägt
-- ein Unique über (from_id, to_id); ohne das Aufräumen misst Abschnitt 3 bei
-- offenem Schalter den Constraint statt der Policy.
delete from public.contact_requests
 where from_id in ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003');

-- ── 3. Die vier unverändert geltenden Zusagen (5.5) ─────────────────────────
-- In BEIDEN Schalterstellungen. Sie hängen nicht an der Staffelung, und genau
-- das ist die Aussage: Klausel 320 auszutauschen darf sie nicht mitnehmen.
-- Absender ist durchweg `impact` — er passiert die Staffelung in jeder
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

-- Absender ab Rang 3, damit die Staffelung nicht die Antwort gibt: was hier
-- gemessen wird, ist der Welpenschutz und nichts sonst.
select is(
  pg_temp.try_as('10000000-0000-0000-0000-000000000003',
    pg_temp.anfrage('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004')),
  'OK', 'geschlossen: eine Kaltanfrage an ein tagesfrisches Konto geht durch');

-- Ohne diese Zusage bliebe der Drop unbelegt: die Klausel zu streichen und die
-- Funktion stehen zu lassen sähe von aussen genauso aus.
select hasnt_function('public', 'is_new_member', array['uuid'],
  'is_new_member(uuid) existiert nicht mehr');

-- ── 4. Die Form des Prädikats (5.2) ─────────────────────────────────────────
-- Was das Verhalten oben nicht zeigt, aber trägt. `security definer` ist der
-- Punkt: das Prädikat liest `profiles.tier` des EMPFÄNGERS, und ein
-- `connect`-Konto darf fremde volle Zeilen nicht lesen. Ohne DEFINER fiele es
-- still auf „kein Recht" und verböte JEDE Anfrage — grün wäre dann nur noch,
-- was ohnehin verboten ist.
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
