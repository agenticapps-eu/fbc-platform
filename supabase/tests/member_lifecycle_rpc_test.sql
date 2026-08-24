-- Lebenszyklus eines Mitglieds, Teil B: die vier Funktionen (AGE-581).
-- Change: openspec/changes/add-admin-member-lifecycle/.
--
-- Echtes pgTAP mit plan()/finish() — nur solche Dateien stehen im CI-Lauf.
--
-- ══ WARUM EINE EIGENE DATEI ════════════════════════════════════════════════
-- `member_lifecycle_test.sql` prüft das GATE — wer was sieht. Diese Datei
-- prüft die ÜBERGÄNGE — was beim Umschalten geschieht. Beides in einer Datei
-- hiesse, dass jeder rot/grün-Durchlauf am Gate die Übergangsmatrix mitzieht.
--
-- ══ WARUM DIE FUNKTIONEN ALS `service_role` GERUFEN WERDEN ═════════════════
-- EXECUTE liegt bei `service_role` und NICHT bei `authenticated`. Läge es dort,
-- könnte ein Admin die Datenbankfunktion unmittelbar aufrufen und den Ban bei
-- GoTrue überspringen — die zugesagte Doppelsperre wäre dann keine Zusage,
-- sondern eine Gewohnheit der Oberfläche.
--
-- Daraus folgt, dass `auth.uid()` beim Aufruf LEER ist: `service_role` ist der
-- Server, kein Mensch. Die handelnde Person kommt deshalb als `actor`-Parameter
-- mit, und geprüft wird `is_admin_uid(actor)`. Das ist kein Loch: nur der
-- Server darf die Funktion überhaupt rufen, und er hat den JWT vorher am
-- Gateway prüfen lassen.
--
-- ══ WARUM DER BAN-ZUSTAND AUS `auth.users` KOMMT ═══════════════════════════
-- Die Übergangstabelle unterscheidet „deaktiviert, Ban gesetzt" von
-- „deaktiviert, Ban fehlt" — nur im zweiten Fall arbeitet ein erneuter Aufruf
-- nach, statt abzubrechen. Die Funktion liest `auth.users.banned_until` selbst;
-- als SECURITY DEFINER mit Eigentümer `postgres` darf sie das, wie
-- `admin_list_members` auch.
--
-- ══ FALLEN ═════════════════════════════════════════════════════════════════
--   * `try_as()` meldet JEDEN Fehler als `DENIED:` — auf SQLSTATE prüfen.
--   * `alike()`, nicht `like()`.

begin;
select plan(39);

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, aud, role, email) values
  ('e0000000-0000-0000-0000-0000000000ad', 'authenticated', 'authenticated', 'rpc-admin@test.fbc'),
  ('e0000000-0000-0000-0000-0000000000c0', 'authenticated', 'authenticated', 'rpc-kein-admin@test.fbc'),
  ('e0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'rpc-ziel1@test.fbc'),
  ('e0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'rpc-ziel2@test.fbc'),
  ('e0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'rpc-ziel3@test.fbc'),
  ('e0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'rpc-ziel4@test.fbc'),
  ('e0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'rpc-ziel5@test.fbc');

insert into public.staff_roles (profile_id, role) values
  ('e0000000-0000-0000-0000-0000000000ad', 'admin');

update public.profiles set name = 'RPC Admin', activated_at = now()
 where id = 'e0000000-0000-0000-0000-0000000000ad';
update public.profiles set activated_at = now()
 where id::text like 'e0000000-%';

-- ── Helfer ──────────────────────────────────────────────────────────────────
-- Ruft als `service_role`, weil dort das EXECUTE liegt.
create function pg_temp.state_svc(q text) returns text language plpgsql as $$
begin
  execute 'set local role service_role';
  begin
    execute q;
  exception when others then
    reset role;
    return SQLSTATE;
  end;
  reset role;
  return 'KEIN FEHLER';
end $$;

-- Und als `authenticated`, um zu belegen, dass DORT nichts geht.
create function pg_temp.state_auth(uid uuid, q text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q;
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    return SQLSTATE;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'KEIN FEHLER';
end $$;

create function pg_temp.svc(q text) returns void language plpgsql as $$
begin
  execute 'set local role service_role';
  execute q;
  reset role;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Die Funktionen bestehen, und die Rechte liegen richtig
-- ════════════════════════════════════════════════════════════════════════════
select has_function('public', 'admin_disable_member', 'admin_disable_member besteht');
select has_function('public', 'admin_enable_member',  'admin_enable_member besteht');
select has_function('public', 'admin_delete_member',  'admin_delete_member besteht');
select has_function('public', 'admin_restore_member', 'admin_restore_member besteht');

-- Der Kern der Entscheidung: NICHT bei authenticated. Ein Admin, der die
-- Datenbankfunktion direkt riefe, erzeugte einen Zustand ohne Ban.
select is(
  has_function_privilege('authenticated',
    'public.admin_disable_member(uuid,uuid,text)', 'execute'),
  false, 'authenticated darf admin_disable_member NICHT ausfuehren');
select is(
  has_function_privilege('service_role',
    'public.admin_disable_member(uuid,uuid,text)', 'execute'),
  true, 'service_role darf es');
select is(
  has_function_privilege('anon',
    'public.admin_disable_member(uuid,uuid,text)', 'execute'),
  false, 'anon darf es nicht');

-- Und der Weg über die API ist damit zu.
select is(
  pg_temp.state_auth('e0000000-0000-0000-0000-0000000000ad',
    $$select public.admin_disable_member(
        'e0000000-0000-0000-0000-000000000001',
        'e0000000-0000-0000-0000-0000000000ad')$$),
  '42501', 'Ein Admin kommt ueber die gewoehnliche Sitzung nicht an die Funktion');

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Die Schranke im Rumpf — zweite Schranke, nicht die erste
-- ════════════════════════════════════════════════════════════════════════════
select is(
  pg_temp.state_svc($$select public.admin_disable_member(
      'e0000000-0000-0000-0000-000000000001',
      'e0000000-0000-0000-0000-0000000000c0')$$),
  '42501', 'Ein actor ohne Admin-Rolle wird abgewiesen');

select is(
  pg_temp.state_svc($$select public.admin_disable_member(
      'e0000000-0000-0000-0000-0000000000ad',
      'e0000000-0000-0000-0000-0000000000ad')$$),
  '22023', 'Ein Admin kann sich nicht selbst deaktivieren');

select is(
  pg_temp.state_svc($$select public.admin_disable_member(
      '00000000-0000-0000-0000-00000000dead',
      'e0000000-0000-0000-0000-0000000000ad')$$),
  'P0002', 'Ein nicht existierendes Ziel meldet sich als solches');

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Deaktivieren und die Spur
-- ════════════════════════════════════════════════════════════════════════════
select is(
  pg_temp.state_svc($$select public.admin_disable_member(
      'e0000000-0000-0000-0000-000000000001',
      'e0000000-0000-0000-0000-0000000000ad')$$),
  'KEIN FEHLER', 'Deaktivieren gelingt');

select isnt(
  (select disabled_at from public.profiles where id = 'e0000000-0000-0000-0000-000000000001'),
  null, 'disabled_at ist gesetzt');

select is(
  (select count(*)::int from public.admin_audit
    where target = 'e0000000-0000-0000-0000-000000000001' and action = 'disable_member'),
  1, 'genau eine Protokollzeile, mit dem handelnden Admin als actor');

select is(
  (select actor from public.admin_audit
    where target = 'e0000000-0000-0000-0000-000000000001' and action = 'disable_member'),
  'e0000000-0000-0000-0000-0000000000ad'::uuid, 'der actor steht in der Spur');

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Der halbe Zustand — und dass er heilbar ist
--
-- Ohne Ban ist der Zustand unvollständig. Ein Abbruch machte ihn durch die
-- Oberfläche unheilbar: der Admin müsste erst reaktivieren, um erneut
-- deaktivieren zu können, und liesse das Konto dabei kurz wieder sichtbar
-- werden.
-- ════════════════════════════════════════════════════════════════════════════
select is(
  pg_temp.state_svc($$select public.admin_disable_member(
      'e0000000-0000-0000-0000-000000000001',
      'e0000000-0000-0000-0000-0000000000ad')$$),
  'KEIN FEHLER', 'Ohne Ban arbeitet ein zweiter Aufruf nach, statt abzubrechen');

select is(
  (select count(*)::int from public.admin_audit
    where target = 'e0000000-0000-0000-0000-000000000001' and action = 'disable_member'),
  1, 'und schreibt dabei KEINE zweite Zeile ueber eine Sichtbarkeitsaenderung');

-- Jetzt den Ban setzen, wie es die Edge Function täte.
update auth.users set banned_until = now() + interval '100 years'
 where id = 'e0000000-0000-0000-0000-000000000001';

select is(
  pg_temp.state_svc($$select public.admin_disable_member(
      'e0000000-0000-0000-0000-000000000001',
      'e0000000-0000-0000-0000-0000000000ad')$$),
  '22023', 'MIT Ban bricht der zweite Aufruf ab — der Zustand ist vollstaendig');

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Reaktivieren
-- ════════════════════════════════════════════════════════════════════════════
update auth.users set banned_until = null where id = 'e0000000-0000-0000-0000-000000000001';

select is(
  pg_temp.state_svc($$select public.admin_enable_member(
      'e0000000-0000-0000-0000-000000000001',
      'e0000000-0000-0000-0000-0000000000ad')$$),
  'KEIN FEHLER', 'Reaktivieren gelingt');

select is(
  (select disabled_at from public.profiles where id = 'e0000000-0000-0000-0000-000000000001'),
  null, 'disabled_at ist wieder leer');

select is(
  (select count(*)::int from public.admin_audit
    where target = 'e0000000-0000-0000-0000-000000000001' and action = 'enable_member'),
  1, 'auch die Umkehrung hinterlaesst eine Spur');

select is(
  pg_temp.state_svc($$select public.admin_enable_member(
      'e0000000-0000-0000-0000-000000000001',
      'e0000000-0000-0000-0000-0000000000ad')$$),
  '22023', 'Ein zweites Reaktivieren bricht ab');

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Löschen — und warum es `disabled_at` NICHT anfasst
--
-- Der Kern des Befunds aus dem Plan-Review. Setzte das Löschen `disabled_at`
-- mit, ginge die einzige Information verloren, die das Wiederherstellen
-- braucht: war dieses Mitglied vorher schon deaktiviert?
-- ════════════════════════════════════════════════════════════════════════════
select is(
  pg_temp.state_svc($$select public.admin_delete_member(
      'e0000000-0000-0000-0000-000000000002',
      'e0000000-0000-0000-0000-0000000000ad')$$),
  'KEIN FEHLER', 'Loeschen eines aktiven Mitglieds gelingt');

select is(
  (select disabled_at from public.profiles where id = 'e0000000-0000-0000-0000-000000000002'),
  null, 'Loeschen fasst disabled_at NICHT an');

select isnt(
  (select deleted_at from public.profiles where id = 'e0000000-0000-0000-0000-000000000002'),
  null, 'deleted_at ist gesetzt');

-- Die Zeile bleibt. Ein Hard-Delete entsteht in diesem Change nicht.
select is(
  (select count(*)::int from public.profiles where id = 'e0000000-0000-0000-0000-000000000002'),
  1, 'die Profilzeile besteht weiter');
select is(
  (select count(*)::int from auth.users where id = 'e0000000-0000-0000-0000-000000000002'),
  1, 'die auth-Zeile besteht weiter');

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Wiederherstellen gibt den VORZUSTAND zurück, nicht einen besseren
--
-- Zwei Wege durch dieselbe Handlung. Der zweite ist der, an dem die erste
-- Fassung gescheitert wäre.
-- ════════════════════════════════════════════════════════════════════════════
-- Weg A: aktiv → gelöscht → wiederhergestellt. Muss aktiv sein.
select is(
  pg_temp.state_svc($$select public.admin_restore_member(
      'e0000000-0000-0000-0000-000000000002',
      'e0000000-0000-0000-0000-0000000000ad')$$),
  'KEIN FEHLER', 'Wiederherstellen gelingt');
select is(
  (select (deleted_at is null and disabled_at is null)
     from public.profiles where id = 'e0000000-0000-0000-0000-000000000002'),
  true, 'Weg A: war aktiv, ist wieder aktiv');

-- Weg B: deaktiviert → gelöscht → wiederhergestellt. Muss DEAKTIVIERT bleiben.
select pg_temp.svc($$select public.admin_disable_member(
    'e0000000-0000-0000-0000-000000000003',
    'e0000000-0000-0000-0000-0000000000ad')$$);
select pg_temp.svc($$select public.admin_delete_member(
    'e0000000-0000-0000-0000-000000000003',
    'e0000000-0000-0000-0000-0000000000ad')$$);
select pg_temp.svc($$select public.admin_restore_member(
    'e0000000-0000-0000-0000-000000000003',
    'e0000000-0000-0000-0000-0000000000ad')$$);

select is(
  (select (deleted_at is null and disabled_at is not null)
     from public.profiles where id = 'e0000000-0000-0000-0000-000000000003'),
  true, 'Weg B: war deaktiviert, ist wieder deaktiviert — nicht aktiv');

-- ════════════════════════════════════════════════════════════════════════════
-- 8. Die verbotenen Übergänge
-- ════════════════════════════════════════════════════════════════════════════
select pg_temp.svc($$select public.admin_delete_member(
    'e0000000-0000-0000-0000-000000000004',
    'e0000000-0000-0000-0000-0000000000ad')$$);

select is(
  pg_temp.state_svc($$select public.admin_enable_member(
      'e0000000-0000-0000-0000-000000000004',
      'e0000000-0000-0000-0000-0000000000ad')$$),
  '22023', 'Reaktivieren belebt ein geloeschtes Profil nicht wieder');

select is(
  pg_temp.state_svc($$select public.admin_disable_member(
      'e0000000-0000-0000-0000-000000000004',
      'e0000000-0000-0000-0000-0000000000ad')$$),
  '22023', 'Deaktivieren greift bei einem geloeschten Profil nicht');

select is(
  pg_temp.state_svc($$select public.admin_restore_member(
      'e0000000-0000-0000-0000-000000000005',
      'e0000000-0000-0000-0000-0000000000ad')$$),
  '22023', 'Wiederherstellen greift bei einem nicht geloeschten Profil nicht');

select is(
  pg_temp.state_svc($$select public.admin_delete_member(
      'e0000000-0000-0000-0000-0000000000ad',
      'e0000000-0000-0000-0000-0000000000ad')$$),
  '22023', 'Ein Admin kann sich nicht selbst loeschen');

-- ════════════════════════════════════════════════════════════════════════════
-- AGE-581, Befund aus dem Diff-Review zu 11.5: die AKTIVIERUNGSWEGE kannten den
-- Lebenszyklus nicht. Sie fragten nur `activated_at` — ein Admin konnte eine
-- geloeschte Person aktivieren, und `issue_activation_token` stellte ihr einen
-- Zugangslink aus. Migration 20260824120000.
-- ════════════════════════════════════════════════════════════════════════════

update public.profiles set disabled_at = now(), deleted_at = null, activated_at = null
 where id = 'e0000000-0000-0000-0000-000000000002';
update public.profiles set deleted_at = now(), disabled_at = null, activated_at = null
 where id = 'e0000000-0000-0000-0000-000000000003';
-- Die GEGENPROBE-Zeile: unbestaetigt, aber nicht entfernt. Ohne sie belegte
-- dieser Block nur, dass mark_activated ueberhaupt abbricht — nicht, dass sie
-- am richtigen Merkmal abbricht.
update public.profiles set disabled_at = null, deleted_at = null, activated_at = null
 where id = 'e0000000-0000-0000-0000-000000000005';

select is(
  pg_temp.state_svc($$select public.mark_activated(
      'e0000000-0000-0000-0000-000000000002')$$),
  '22023', 'mark_activated aktiviert kein DEAKTIVIERTES Profil');

select is(
  pg_temp.state_svc($$select public.mark_activated(
      'e0000000-0000-0000-0000-000000000003')$$),
  '22023', 'mark_activated aktiviert kein GELOESCHTES Profil');

select is(
  pg_temp.state_svc($$select public.mark_activated(
      'e0000000-0000-0000-0000-000000000005')$$),
  'KEIN FEHLER', 'mark_activated aktiviert ein unbestaetigtes Profil weiterhin');

-- Der Admin-Weg traegt denselben Waechter ein zweites Mal — nicht doppelt
-- gemoppelt, sondern damit der Admin den GRUND genannt bekommt, statt einen
-- Fehler aus einer Funktion zu sehen, die er nicht gerufen hat.
--
-- DER AUSGANGSZUSTAND WIRD HIER NEU GESETZT, und das ist keine Umstaendlichkeit:
-- ohne diese Zeile war die Zusage auch OHNE den Waechter gruen. Die Zusage
-- darueber hatte unter der alten Fassung `mark_activated` erfolgreich laufen
-- lassen, `activated_at` stand also — und der Admin-Weg brach mit demselben
-- 22023 ab, nur wegen „bereits bestaetigt". Gemessen in der Gegenprobe am
-- 24.08.: 3 von 5 neuen Zusagen fielen um, diese nicht.
update public.profiles set deleted_at = now(), disabled_at = null, activated_at = null
 where id = 'e0000000-0000-0000-0000-000000000003';

select is(
  pg_temp.state_auth('e0000000-0000-0000-0000-0000000000ad',
    $$select public.admin_activate_member(
        'e0000000-0000-0000-0000-000000000003')$$),
  '22023', 'admin_activate_member aktiviert kein GELOESCHTES Profil');

-- Und die Arbeitsgrenze von former_member_entries zaehlt jetzt Elemente:
-- `array_length(x,1)` sah in `{{a,b}}` genau EINE Zeile, `= any(...)` aber
-- beide Werte. Migration 20260824110000.
select is(
  pg_temp.state_auth('e0000000-0000-0000-0000-0000000000ad',
    $$select * from public.former_member_entries(
        array[array['e0000000-0000-0000-0000-000000000001'::uuid,
                    'e0000000-0000-0000-0000-000000000002'::uuid]], '{}')$$),
  '22023', 'former_member_entries weist mehrdimensionale Arrays ab');

select * from finish();
rollback;
