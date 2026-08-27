-- ════════════════════════════════════════════════════════════════════════════
-- AGE-641 — `push_tokens`: ein Zustellweg gehoert genau einer Person
-- ════════════════════════════════════════════════════════════════════════════
--
-- Change: openspec/changes/push-fundament/. Phase A, Schritt 2.
--
-- Echtes pgTAP mit plan()/finish(). Diese Datei muss in `ci.yml` eingetragen
-- sein — `supabase test db` ohne Dateiliste laeuft sie nie.
--
-- ══ WARUM DIESE TABELLE SCHAERFER IST ALS DIE ANDEREN ══════════════════════
-- Bei den meisten Tabellen fragt RLS: wer darf das LESEN. Hier ist die Zeile
-- selbst der Zustellweg. Wer ein fremdes Token liest, kann einem fremden
-- Menschen eine Benachrichtigung aufs Telefon schicken. Die Sichtbarkeits-
-- grenze IST hier die Zustellgrenze.
--
-- ══ DREI FALLEN, DIE DIESE DATEI BEWUSST UMGEHT ════════════════════════════
-- 1. `alike()`, nicht `like()` — letzteres gibt es in pgTAP nicht.
-- 2. `try_as()` meldet JEDEN Fehler als `DENIED:`, auch einen Tippfehler.
--    Wo es auf die Wirkung ankommt, wird darum mit `update_zeilen_as()` die
--    Zahl der getroffenen Zeilen gemessen.
-- 3. Ein fremdes UPDATE unter RLS ist KEIN `42501`. Es trifft schlicht null
--    Zeilen und meldet Erfolg. Eine Zusage auf den SQLSTATE waere hier gruen,
--    ohne irgendetwas zu belegen.
-- ════════════════════════════════════════════════════════════════════════════

begin;
select plan(14);

-- ── Impersonierung ──────────────────────────────────────────────────────────
-- Eigene Kopien: jede Testdatei laeuft in ihrer eigenen Sitzung.
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

create function pg_temp.zeilen_as(uid uuid, q text) returns int language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute q;
  get diagnostics n = row_count;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return n;
end $$;

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, aud, role, email) values
  ('d0000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'pt-anna@test.fbc'),
  ('d0000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'pt-bodo@test.fbc'),
  ('d0000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'pt-cara@test.fbc');

update public.profiles set tier = 'impact', name = 'PT Anna', activated_at = now()
 where id = 'd0000000-0000-0000-0000-00000000000a';
update public.profiles set tier = 'impact', name = 'PT Bodo', activated_at = now()
 where id = 'd0000000-0000-0000-0000-00000000000b';
update public.profiles set tier = 'impact', name = 'PT Cara', activated_at = now()
 where id = 'd0000000-0000-0000-0000-00000000000c';

-- Anna hat ZWEI Geraete. Das ist der Normalfall, nicht die Ausnahme.
insert into public.push_tokens (profile_id, token, plattform) values
  ('d0000000-0000-0000-0000-00000000000a', 'tok-anna-telefon', 'ios'),
  ('d0000000-0000-0000-0000-00000000000a', 'tok-anna-tablet',  'android'),
  ('d0000000-0000-0000-0000-00000000000b', 'tok-bodo-telefon', 'ios');

-- ── 1. Owner-only ───────────────────────────────────────────────────────────

select is(
  pg_temp.count_as('d0000000-0000-0000-0000-00000000000a',
    'select count(*)::int from public.push_tokens'),
  2, 'Anna sieht ihre beiden Geraete');

-- Die eigentliche Zusage. Nicht „sie sieht weniger", sondern NULL.
select is(
  pg_temp.count_as('d0000000-0000-0000-0000-00000000000a',
    $$select count(*)::int from public.push_tokens
       where profile_id = 'd0000000-0000-0000-0000-00000000000b'$$),
  0, 'Anna sieht kein einziges Token von Bodo');

select is(
  pg_temp.count_as('d0000000-0000-0000-0000-00000000000c',
    'select count(*)::int from public.push_tokens'),
  0, 'Cara ohne eigene Geraete sieht gar nichts');

-- ── 2. Fremdes Schreiben trifft NULL Zeilen (nicht: wirft 42501) ────────────

select is(
  pg_temp.zeilen_as('d0000000-0000-0000-0000-00000000000a',
    $$update public.push_tokens set plattform = 'android'
       where token = 'tok-bodo-telefon'$$),
  0, 'Annas UPDATE auf Bodos Token trifft null Zeilen');

select is(
  pg_temp.zeilen_as('d0000000-0000-0000-0000-00000000000a',
    $$delete from public.push_tokens where token = 'tok-bodo-telefon'$$),
  0, 'Annas DELETE auf Bodos Token trifft null Zeilen');

-- Positivkontrolle zu den beiden darueber: dieselbe Anweisung auf das EIGENE
-- Token trifft sehr wohl eine Zeile. Ohne sie waere „null Zeilen" auch von
-- einer kaputten Tabelle erfuellt, die gar nichts trifft.
select is(
  pg_temp.zeilen_as('d0000000-0000-0000-0000-00000000000a',
    $$update public.push_tokens set plattform = 'android'
       where token = 'tok-anna-telefon'$$),
  1, 'dieselbe Anweisung auf das eigene Token trifft eine Zeile');

-- ── 3. Ein Token laesst sich nicht auf ein fremdes Profil legen ─────────────
-- Das ist die `with check`-Haelfte. Ohne sie koennte Anna Bodo ein Geraet
-- UNTERSCHIEBEN — und bekaeme damit seine Hinweise auf ihr Telefon.

select alike(
  pg_temp.try_as('d0000000-0000-0000-0000-00000000000a',
    $$insert into public.push_tokens (profile_id, token, plattform)
      values ('d0000000-0000-0000-0000-00000000000b', 'tok-untergeschoben', 'ios')$$),
  'DENIED:%', 'Anna kann Bodo kein Geraet unterschieben');

-- ── 4. Tabellenform ─────────────────────────────────────────────────────────

select alike(
  pg_temp.try_as('d0000000-0000-0000-0000-00000000000a',
    $$insert into public.push_tokens (profile_id, token, plattform)
      values ('d0000000-0000-0000-0000-00000000000a', 'tok-bodo-telefon', 'ios')$$),
  'DENIED:%', 'ein Token gehoert global genau einer Zeile');

select alike(
  pg_temp.try_as('d0000000-0000-0000-0000-00000000000a',
    $$insert into public.push_tokens (profile_id, token, plattform)
      values ('d0000000-0000-0000-0000-00000000000a', 'tok-anna-uhr', 'windows')$$),
  'DENIED:%', 'eine unbekannte Plattform wird abgewiesen');

select is(
  (select count(*)::int from public.push_tokens
    where profile_id = 'd0000000-0000-0000-0000-00000000000a'),
  2, 'mehrere Geraete je Mitglied bleiben erlaubt — kein unique auf profile_id');

-- ── 5. anon haelt gar nichts ────────────────────────────────────────────────

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'push_tokens' and grantee = 'anon'),
  0, 'anon haelt kein einziges Recht auf push_tokens');

-- ── 6. claim_push_token — der Kontowechsel ──────────────────────────────────
-- GEFUNDEN VON DER PLAN-REVIEW (R2). Ein gewoehnlicher Insert genuegt nicht:
-- Token sind global eindeutig, und owner-only heisst, dass Bodo Annas Zeile
-- weder sieht noch aendern kann. Schlaegt beim Abmelden das Aufraeumen fehl —
-- kein Netz, App abgestuerzt — und dasselbe Geraet meldet sich als Bodo an,
-- dann prallt sein Insert an der Eindeutigkeit ab und die Zeile bleibt bei
-- Anna. ANNAS naechste Nachricht ginge auf ein Geraet, das Bodo in der Hand
-- haelt. Das ist kein Randfall: ein Geraet, zwei Konten ist der Normalfall bei
-- Ehepaaren, Nachfolgern und Diensttelefonen.

select is(
  pg_temp.count_as('d0000000-0000-0000-0000-00000000000b',
    $$select count(*)::int from public.claim_push_token('tok-anna-telefon', 'ios')$$),
  1, 'Bodo kann ein gestrandetes Token uebernehmen');

select is(
  (select profile_id::text from public.push_tokens where token = 'tok-anna-telefon'),
  'd0000000-0000-0000-0000-00000000000b',
  'nach der Uebernahme gehoert das Geraet Bodo, nicht mehr Anna');

-- ── 7. on delete cascade ────────────────────────────────────────────────────

delete from public.profiles where id = 'd0000000-0000-0000-0000-00000000000b';

select is(
  (select count(*)::int from public.push_tokens
    where profile_id = 'd0000000-0000-0000-0000-00000000000b'),
  0, 'ein geloeschtes Profil hinterlaesst keine Zustellwege');

select * from finish();
rollback;
