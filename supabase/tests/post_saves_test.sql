-- Gespeicherte Beiträge: `post_saves` als private Liste (AGE-582).
-- Change: openspec/changes/activity-concept-level/, Abschnitt 2.
--
-- Echtes pgTAP mit plan()/finish() — nur solche Dateien stehen im CI-Lauf; die
-- manuellen probe_*.sql tun es nicht. Diese Datei ist in ci.yml eingetragen.
--
-- ══ WAS HIER GEMESSEN WIRD ═════════════════════════════════════════════════
-- Zwei Zusagen aus der Spezifikation, und beide sind die Art, die man nicht
-- glaubt, sondern misst:
--
--   1. Wer etwas gespeichert hat, ist für NIEMANDEN sonst sichtbar — auch
--      nicht für den Autor des Beitrags und auch nicht als Zahl. Ein Test, der
--      nur „ich sehe meine Zeile" prüft, bliebe grün, während jeder alles
--      sieht. Darum steht neben jeder eigenen Zeile eine FREMDE im Bestand,
--      und die Zusage lautet auf die ZAHL der sichtbaren Zeilen.
--
--   2. Ein nie bestätigtes und ein deaktiviertes Konto kommen nicht heran.
--      Auch das braucht eine fremde Vorlage: für beide Konten liegt eine
--      eigene Zeile im Bestand, die ein Superuser angelegt hat. Ohne sie
--      prüfte „liest nichts" nur eine leere Tabelle.
--
-- ══ FALLEN, DIE DIESES PROJEKT SCHON GESTELLT HAT ══════════════════════════
--   * Ein DELETE, das die RLS nicht durchlässt, ergibt NULL ZEILEN statt
--     `42501`. `try_as()` meldet dafür brav 'OK'. Jede Löschzusage hier lautet
--     deshalb auf den ÜBERLEBENDEN BESTAND, nicht auf einen Fehlercode.
--   * `try_as()` meldet jeden Fehler als 'DENIED:' — für einen zugesicherten
--     Code müsste der SQLSTATE gelesen werden. Hier wird keiner zugesichert.
--   * In pgTAP heisst es `alike()`, nicht `like()`.
--   * Der lokale Stack ist geseedet. Jede Mengenaussage hier ist deshalb auf
--     die Fixture-IDs eingeschränkt und nie auf `count(*)` der ganzen Tabelle.

begin;
select plan(24);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Der auth.users-Insert feuert handle_new_user() und legt public.profiles an.
insert into auth.users (id, aud, role, email) values
  ('5a000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'sp-eigner@test.fbc'),
  ('5a000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'sp-fremd@test.fbc'),
  ('5a000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'sp-unbestaetigt@test.fbc'),
  ('5a000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'sp-deaktiviert@test.fbc');

-- Alle auf `impact`: hinter dem Aktivierungs-Gate liegt bei importierten
-- Mitgliedern kein Stufen-Gate mehr, das einen Fehler noch auffinge. Ein
-- `basic`-Konto sähe vieles schon wegen der Stufe nicht und täuschte ein Gate
-- vor, das gar nicht greift.
update public.profiles set tier = 'impact', name = 'Sp Eigner',   activated_at = now()
 where id = '5a000000-0000-0000-0000-000000000001';
update public.profiles set tier = 'impact', name = 'Sp Fremd',    activated_at = now()
 where id = '5a000000-0000-0000-0000-000000000002';
-- Nie bestätigt: `activated_at` bleibt bewusst null.
update public.profiles set tier = 'impact', name = 'Sp Unbestaetigt'
 where id = '5a000000-0000-0000-0000-000000000003';
-- Bestätigt UND wieder deaktiviert — der zweite Weg, an dem `is_activated()`
-- fällt. Er ist der wichtigere: eine Prüfung, die nur `activated_at` liest,
-- bliebe hier grün.
update public.profiles set tier = 'impact', name = 'Sp Deaktiviert',
       activated_at = now(), disabled_at = now()
 where id = '5a000000-0000-0000-0000-000000000004';

insert into public.posts (id, author_id, body, visibility) values
  ('5b000000-0000-0000-0000-0000000000aa', '5a000000-0000-0000-0000-000000000002',
   'Ein Beitrag, den zwei Mitglieder speichern.', 'public');

-- ── Helfer (Muster aus rls_test.sql) ────────────────────────────────────────
create function pg_temp.count_as(uid uuid, q text) returns int language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute q into n;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return n;
end $$;

-- try_as: 'OK' wenn die Anweisung unter der Identität durchgeht, sonst
-- 'DENIED:<err>'. Siehe Kopf: bei DELETE sagt 'OK' NICHTS über die Wirkung.
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

-- ── 1. Gestalt der Tabelle ──────────────────────────────────────────────────
select has_table('public', 'post_saves', 'Die Tabelle post_saves existiert');

select col_is_pk(
  'public', 'post_saves', array['profile_id', 'post_id'],
  'Der Primärschlüssel liegt auf (profile_id, post_id) — die Eindeutigkeit '
  'trägt der Schlüssel, nicht die Anwendungslogik');

select is(
  (select relrowsecurity from pg_class
    where oid = 'public.post_saves'::regclass),
  true, 'RLS ist auf post_saves eingeschaltet');

-- `confdeltype = 'c'` ist ON DELETE CASCADE. Eine gespeicherte Zeile ohne
-- Beitrag oder ohne Profil ist kein Datum, sondern Müll.
select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.post_saves'::regclass
      and contype = 'f' and confdeltype = 'c'),
  2, 'Beide Fremdschlüssel löschen kaskadierend');

-- ── 2. Der Eigner speichert ─────────────────────────────────────────────────
select is(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000001',
    $$insert into public.post_saves (profile_id, post_id)
      values ('5a000000-0000-0000-0000-000000000001',
              '5b000000-0000-0000-0000-0000000000aa')$$),
  'OK', 'Ein bestätigtes Mitglied speichert einen Beitrag für sich');

-- Der zweite Versuch darf an der Oberfläche nicht scheitern — genau so ruft
-- ihn die Datenschicht (Abschnitt 5) auf.
select is(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000001',
    $$insert into public.post_saves (profile_id, post_id)
      values ('5a000000-0000-0000-0000-000000000001',
              '5b000000-0000-0000-0000-0000000000aa')
      on conflict do nothing$$),
  'OK', 'Zweimal speichern scheitert nicht');

select is(
  (select count(*)::int from public.post_saves
    where profile_id = '5a000000-0000-0000-0000-000000000001'
      and post_id    = '5b000000-0000-0000-0000-0000000000aa'),
  1, 'Zweimal speichern ergibt genau EINE Zeile');

-- ── 3. Fremde Speicherungen bleiben unsichtbar ──────────────────────────────
-- `Sp Fremd` ist der AUTOR des Beitrags. Wenn irgendjemand die fremde Zeile
-- sehen dürfte, dann er — die Spezifikation sagt ausdrücklich: auch er nicht.
select is(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000002',
    $$insert into public.post_saves (profile_id, post_id)
      values ('5a000000-0000-0000-0000-000000000002',
              '5b000000-0000-0000-0000-0000000000aa')$$),
  'OK', 'Der Autor speichert seinen eigenen Beitrag ebenfalls');

select is(
  pg_temp.count_as('5a000000-0000-0000-0000-000000000001',
    $$select count(*)::int from public.post_saves
       where post_id = '5b000000-0000-0000-0000-0000000000aa'$$),
  1, 'Der Eigner sieht zu diesem Beitrag genau EINE Zeile — seine, nicht zwei');

select is(
  pg_temp.count_as('5a000000-0000-0000-0000-000000000002',
    $$select count(*)::int from public.post_saves
       where post_id = '5b000000-0000-0000-0000-0000000000aa'$$),
  1, 'Auch der Autor des Beitrags sieht nur seine eigene Zeile');

-- Ein DELETE ohne Treffer meldet KEINEN Fehler (siehe Kopf). Die Zusage lautet
-- deshalb auf den Bestand.
select is(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000001',
    $$delete from public.post_saves
       where profile_id = '5a000000-0000-0000-0000-000000000002'$$),
  'OK', 'Das Löschen einer fremden Zeile meldet keinen Fehler — die RLS lässt '
        'es nur ins Leere laufen');

select is(
  (select count(*)::int from public.post_saves
    where profile_id = '5a000000-0000-0000-0000-000000000002'),
  1, 'Die fremde Zeile besteht nach dem Löschversuch weiter');

select alike(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000001',
    $$insert into public.post_saves (profile_id, post_id)
      values ('5a000000-0000-0000-0000-000000000002',
              '5b000000-0000-0000-0000-0000000000aa')$$),
  'DENIED:%', 'Niemand legt eine Zeile auf fremden Namen an');

-- ── 4. Kein Änderungsweg ────────────────────────────────────────────────────
-- Es gibt SELECT, INSERT und DELETE — sonst nichts. Die Zusage liegt bewusst
-- auf der RLS und nicht nur am Grant: dieses Projekt hat schon einmal Rechte
-- geerbt, die niemand ausgesprochen hatte (AGE-312). Fehlt die UPDATE-Policy,
-- bleibt die Tabelle auch dann unveränderlich, wenn ein Grant zurückkehrt.
select is(
  (select string_agg(cmd::text, ',' order by cmd::text) from pg_policies
    where schemaname = 'public' and tablename = 'post_saves'),
  'DELETE,INSERT,SELECT',
  'Genau drei Policies: SELECT, INSERT, DELETE — kein UPDATE, kein ALL');

-- ── 5. Ein unbestätigtes Konto kommt nicht heran ────────────────────────────
-- Die Vorlage legt ein Superuser an: „liest nichts" über einer leeren Tabelle
-- wäre keine Messung.
insert into public.post_saves (profile_id, post_id) values
  ('5a000000-0000-0000-0000-000000000003', '5b000000-0000-0000-0000-0000000000aa'),
  ('5a000000-0000-0000-0000-000000000004', '5b000000-0000-0000-0000-0000000000aa');

select is(
  pg_temp.count_as('5a000000-0000-0000-0000-000000000003',
    $$select count(*)::int from public.post_saves$$),
  0, 'Ein unbestätigtes Konto liest nicht einmal die eigene Zeile');

select alike(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000003',
    $$insert into public.post_saves (profile_id, post_id)
      values ('5a000000-0000-0000-0000-000000000003',
              '5b000000-0000-0000-0000-0000000000aa')
      on conflict do nothing$$),
  'DENIED:%', 'Ein unbestätigtes Konto speichert nicht');

select is(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000003',
    $$delete from public.post_saves
       where profile_id = '5a000000-0000-0000-0000-000000000003'$$),
  'OK', 'Der Löschversuch eines unbestätigtes Kontos meldet keinen Fehler');

select is(
  (select count(*)::int from public.post_saves
    where profile_id = '5a000000-0000-0000-0000-000000000003'),
  1, 'Ein unbestätigtes Konto löscht auch die eigene Zeile nicht');

-- ── 6. Ein deaktiviertes Konto kommt nicht heran ────────────────────────────
select is(
  pg_temp.count_as('5a000000-0000-0000-0000-000000000004',
    $$select count(*)::int from public.post_saves$$),
  0, 'Ein deaktiviertes Konto liest nicht einmal die eigene Zeile');

select alike(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000004',
    $$insert into public.post_saves (profile_id, post_id)
      values ('5a000000-0000-0000-0000-000000000004',
              '5b000000-0000-0000-0000-0000000000aa')
      on conflict do nothing$$),
  'DENIED:%', 'Ein deaktiviertes Konto speichert nicht');

select is(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000004',
    $$delete from public.post_saves
       where profile_id = '5a000000-0000-0000-0000-000000000004'$$),
  'OK', 'Der Löschversuch eines deaktiviertes Kontos meldet keinen Fehler');

select is(
  (select count(*)::int from public.post_saves
    where profile_id = '5a000000-0000-0000-0000-000000000004'),
  1, 'Ein deaktiviertes Konto löscht auch die eigene Zeile nicht');

-- ── 7. Lösen ────────────────────────────────────────────────────────────────
-- Zuletzt, weil es den Bestand abräumt, auf den die Zusagen oben lauten.
select is(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000001',
    $$delete from public.post_saves
       where profile_id = '5a000000-0000-0000-0000-000000000001'$$),
  'OK', 'Der Eigner löst seine eigene Speicherung');

select is(
  (select count(*)::int from public.post_saves
    where profile_id = '5a000000-0000-0000-0000-000000000001'),
  0, 'Danach ist die Zeile wirklich fort');

select * from finish();
rollback;
