-- Der Feed-Beitrag einer zugestellten Release-Note (AGE-718).
-- Change: openspec/changes/release-notes-in-der-aktivitaet/.
--
-- Echtes pgTAP mit plan()/finish() — nur solche Dateien stehen im CI-Lauf.
-- Diese Datei ist in ci.yml eingetragen.
--
-- ══ WAS HIER GEMESSEN WIRD ═════════════════════════════════════════════════
-- Fuenf Zusagen, die man im Browser nicht widerlegen kann:
--
--   1. **Die Pruefbedingung spricht die Invariante vollstaendig aus.** Ein
--      `release` ohne Bezug, ein `release` mit `ref_id`, ein `member` mit
--      Bezug — alle drei abgelehnt. Und dieselbe Mitteilung steht nicht
--      zweimal im Feed.
--   2. **Ein Mitglied schreibt keine Release-Zeile.** `posts_write_own`
--      verlangt `kind = 'member'`.
--   3. **Der Ausloeser haengt am Zustandswechsel.** Ein Entwurf erzeugt
--      nichts, ein Versand genau eine Zeile, ein zweiter Versand keine weitere.
--   4. **Eine Reaktion an der Release-Karte benachrichtigt niemanden.** In
--      `author_id` steht der zustellende Admin, nicht der Verfasser.
--   5. **Ohne bestimmbaren Autor wird trotzdem zugestellt.**
--
-- ══ FALLEN, DIE DIESES PROJEKT SCHON GESTELLT HAT ══════════════════════════
--   * In pgTAP heisst es `alike()`, nicht `like()`.
--   * Ein Helfer, der jeden Fehler als 'DENIED:' meldet, macht RLS-Ablehnung,
--     fehlenden Grant und Tippfehler ununterscheidbar. `pg_temp.als()` gibt
--     deshalb SQLSTATE UND SQLERRM zurueck, und jede Ablehnung ist an
--     `row-level security policy` verankert.
--   * `authenticated` haelt seit AGE-582 KEIN insert-Recht auf `posts`. Das
--     ACL antwortet VOR der Policy — die Zusage in Abschnitt 2 bliebe sonst
--     auch ohne jede Policy gruen. Das Recht wird innerhalb dieser Transaktion
--     kurz zurueckgegeben.
--   * **Eine Messung aus lauter Nullen belegt nichts.** Jede Verneinung traegt
--     hier ihre Positivkontrolle daneben.
--   * Jede Mengenaussage ist auf die Fixture-Kennungen eingeschraenkt, nie
--     `count(*)` der ganzen Tabelle — der lokale Stack gehoert allen Worktrees.

begin;
select plan(31);

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, aud, role, email) values
  ('7e000000-0000-0000-0000-0000000000ad', 'authenticated', 'authenticated', 'rb-admin@test.fbc'),
  ('7e000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'rb-a@test.fbc');

update public.profiles set tier = 'impact', name = 'RB Admin', activated_at = now()
 where id = '7e000000-0000-0000-0000-0000000000ad';
update public.profiles set tier = 'impact', name = 'RB A', activated_at = now()
 where id = '7e000000-0000-0000-0000-00000000000a';

insert into public.staff_roles (profile_id, role)
values ('7e000000-0000-0000-0000-0000000000ad', 'admin');

insert into public.release_notes (id, title, body, status, created_by) values
  ('7f000000-0000-0000-0000-000000000001', 'Neu in der App', 'Text', 'draft',
   '7e000000-0000-0000-0000-0000000000ad'),
  ('7f000000-0000-0000-0000-000000000002', 'Bleibt Entwurf', 'Text', 'draft',
   '7e000000-0000-0000-0000-0000000000ad'),
  -- Fuer Abschnitt 5: ohne Urheber, und der Weg dorthin laeuft ohne Sitzung.
  ('7f000000-0000-0000-0000-000000000003', 'Ohne Urheber', 'Text', 'draft', null),
  ('7f000000-0000-0000-0000-000000000004', 'Mit Urheber, ohne Sitzung', 'Text', 'draft',
   '7e000000-0000-0000-0000-0000000000ad'),
  -- Fuer 3.5: eine Note, die mit ALTEM `sent_at` zugestellt wird.
  ('7f000000-0000-0000-0000-000000000005', 'Alt zugestellt', 'Text', 'draft',
   '7e000000-0000-0000-0000-0000000000ad');

-- Ein echtes Event, damit die Zusage in 1.2 die PRUEFBEDINGUNG trifft und
-- nicht den Fremdschluessel auf `events`.
insert into public.events (id, title, starts_at, host_id, visibility) values
  ('7e111111-0000-4000-8000-000000000001', 'RB Event', now() + interval '7 days',
   '7e000000-0000-0000-0000-0000000000ad', 'members');

-- ── Helfer ──────────────────────────────────────────────────────────────────
-- Gibt SQLSTATE UND SQLERRM zurueck: „permission denied" und „row-level
-- security policy" sind beide 42501 und muessen unterscheidbar bleiben.
create function pg_temp.als(uid uuid, q text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute q;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'OK';
exception when others then
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'FEHLER:' || sqlstate || ' ' || sqlerrm;
end $$;

-- Gibt die Zahl der GETROFFENEN Zeilen zurueck: ein UPDATE oder DELETE, dessen
-- Zeile die USING-Klausel wegfiltert, wirft nicht — es trifft nichts.
create function pg_temp.zaehle_als(uid uuid, q text) returns int language plpgsql as $$
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

create function pg_temp.zustellen_als(uid uuid, p_id uuid) returns text language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select public.send_release_note(p_id) into n;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'OK:' || n;
exception when others then
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'FEHLER:' || sqlstate || ' ' || sqlerrm;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Die Pruefbedingung und der partielle Unique-Index (Aufgabe 4.4)
-- ════════════════════════════════════════════════════════════════════════════
-- Als EIGENTUEMER geprueft, nicht als `authenticated`: dort weist die Policy
-- vorher ab, und die Pruefbedingung waere nie gemessen.

select throws_ok(
  $$insert into public.posts (author_id, body, visibility, kind)
    values ('7e000000-0000-0000-0000-0000000000ad', '', 'members', 'release')$$,
  '23514', null,
  '1.1 kind=release ohne release_note_id wird abgelehnt — von der Pruefbedingung');

select throws_ok(
  $$insert into public.posts (author_id, body, visibility, kind, release_note_id, ref_id)
    values ('7e000000-0000-0000-0000-0000000000ad', '', 'members', 'release',
            '7f000000-0000-0000-0000-000000000001',
            '7e111111-0000-4000-8000-000000000001')$$,
  '23514', null,
  '1.2 kind=release zusammen mit ref_id wird abgelehnt — von der Pruefbedingung');

select throws_ok(
  $$insert into public.posts (author_id, body, visibility, kind, release_note_id)
    values ('7e000000-0000-0000-0000-0000000000ad', '', 'members', 'member',
            '7f000000-0000-0000-0000-000000000001')$$,
  '23514', null,
  '1.3 kind=member mit release_note_id wird abgelehnt — von der Pruefbedingung');

-- DIE POSITIVKONTROLLE ZU 1.1–1.3. Ohne sie belegten drei rote Inserts nur,
-- dass irgendetwas kracht.
select lives_ok(
  $$insert into public.posts (author_id, body, visibility, kind, release_note_id)
    values ('7e000000-0000-0000-0000-0000000000ad', '', 'members', 'release',
            '7f000000-0000-0000-0000-000000000002')$$,
  '1.4 Positivkontrolle: die passende Kombination geht durch');

select throws_ok(
  $$insert into public.posts (author_id, body, visibility, kind, release_note_id)
    values ('7e000000-0000-0000-0000-00000000000a', '', 'members', 'release',
            '7f000000-0000-0000-0000-000000000002')$$,
  '23505', null,
  '1.5 Dieselbe Mitteilung ein zweites Mal wird abgelehnt — vom Unique-Index');

-- Die Hilfszeile aus 1.4 wieder weg: sie gehoert zu einem Entwurf und wuerde
-- die Zaehlungen weiter unten verfaelschen.
delete from public.posts where release_note_id = '7f000000-0000-0000-0000-000000000002';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Ein Mitglied schreibt keine Release-Zeile (Aufgabe 4.5)
-- ════════════════════════════════════════════════════════════════════════════
-- Das INSERT-Recht wird kurz zurueckgegeben, sonst antwortet das ACL vor der
-- Policy und die Zusage bliebe auch ohne jede Policy gruen (AGE-582).
grant insert on public.posts to authenticated;

select alike(
  pg_temp.als('7e000000-0000-0000-0000-00000000000a',
    $$insert into public.posts (author_id, body, visibility, kind, release_note_id)
      values ('7e000000-0000-0000-0000-00000000000a', '', 'members', 'release',
              '7f000000-0000-0000-0000-000000000002')$$),
  'FEHLER:42501 %row-level security policy%',
  '2.1 Ein Mitglied kann keinen kind=release-Beitrag anlegen — abgewiesen von '
  'der POLICY, nicht vom fehlenden Grant');

select is(
  pg_temp.als('7e000000-0000-0000-0000-00000000000a',
    $$insert into public.posts (author_id, body, visibility, kind)
      values ('7e000000-0000-0000-0000-00000000000a', 'Ein Beitrag', 'members', 'member')$$),
  'OK',
  '2.2 Positivkontrolle: mit demselben Grant schreibt dasselbe Mitglied einen '
  'Mitgliedsbeitrag');

revoke insert on public.posts from authenticated;

-- ── Und die beiden anderen Verben (Befund opencode im Diff-Review, MITTEL) ──
-- Die Zusage lautet „anlegen, aendern oder loeschen" — gemessen war nur das
-- Anlegen. Geprueft wird hier der ZUSTELLENDE ADMIN, denn er ist der Autor der
-- Zeile: haenge `posts_write_own` allein an der Autorschaft, duerfte er seine
-- systemverwaltete Zeile loeschen. Sie traegt `kind = 'member'` auch in der
-- USING-Klausel, also darf er es nicht.
--
-- Ueber die ZEILENZAHL, nicht ueber einen Fehlercode: ein UPDATE oder DELETE,
-- dessen Zeile die USING-Klausel wegfiltert, wirft NICHT — es trifft nichts.
-- „INSERT scheitert laut, UPDATE scheitert leise."
insert into public.posts (id, author_id, body, visibility, kind, release_note_id)
values ('7e333333-0000-4000-8000-000000000001',
        '7e000000-0000-0000-0000-0000000000ad', '', 'members', 'release',
        '7f000000-0000-0000-0000-000000000002');

grant update, delete on public.posts to authenticated;

select is(
  pg_temp.zaehle_als('7e000000-0000-0000-0000-0000000000ad',
    $$with u as (update public.posts set body = 'gekapert'
                  where id = '7e333333-0000-4000-8000-000000000001' returning 1)
      select count(*)::int from u$$),
  0, '2.3 Der zustellende Admin kann seine Release-Zeile nicht aendern');

select is(
  pg_temp.zaehle_als('7e000000-0000-0000-0000-0000000000ad',
    $$with d as (delete from public.posts
                  where id = '7e333333-0000-4000-8000-000000000001' returning 1)
      select count(*)::int from d$$),
  0, '2.4 …und nicht loeschen');

-- Die Nachlese: ohne sie belegte „null Zeilen" nichts — die Zeile koennte auch
-- fehlen.
select is(
  (select body from public.posts where id = '7e333333-0000-4000-8000-000000000001'),
  '', '2.5 Die Zeile steht unveraendert da');

-- POSITIVKONTROLLE zu 2.3/2.4: an seinem eigenen MITGLIEDSBEITRAG greifen
-- dieselben Rechte sehr wohl. Ohne sie waeren 2.3 und 2.4 auch dann gruen, wenn
-- `authenticated` das Recht gar nicht zurueckbekommen haette.
insert into public.posts (id, author_id, body, visibility, kind)
values ('7e333333-0000-4000-8000-000000000002',
        '7e000000-0000-0000-0000-0000000000ad', 'Meiner', 'members', 'member');

select is(
  pg_temp.zaehle_als('7e000000-0000-0000-0000-0000000000ad',
    $$with d as (delete from public.posts
                  where id = '7e333333-0000-4000-8000-000000000002' returning 1)
      select count(*)::int from d$$),
  1, '2.6 Positivkontrolle: seinen eigenen Mitgliedsbeitrag loescht er sehr wohl');

revoke update, delete on public.posts from authenticated;
delete from public.posts where id = '7e333333-0000-4000-8000-000000000001';

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Der Ausloeser haengt am Zustandswechsel (Aufgabe 4.6)
-- ════════════════════════════════════════════════════════════════════════════
select is(
  (select count(*)::int from public.posts
    where kind = 'release'
      and release_note_id in ('7f000000-0000-0000-0000-000000000001',
                              '7f000000-0000-0000-0000-000000000002')),
  0, '3.1 Ein Entwurf hat keinen Feed-Beitrag');

select alike(
  pg_temp.zustellen_als('7e000000-0000-0000-0000-0000000000ad',
                        '7f000000-0000-0000-0000-000000000001'),
  'OK:%', '3.2 Die Zustellung gelingt');

select is(
  (select count(*)::int from public.posts
    where kind = 'release'
      and release_note_id = '7f000000-0000-0000-0000-000000000001'),
  1, '3.3 Die Zustellung erzeugt genau eine posts-Zeile');

select is(
  (select visibility from public.posts
    where release_note_id = '7f000000-0000-0000-0000-000000000001'),
  'members', '3.4 Der Ausloeser setzt visibility ausdruecklich auf members');

-- DIE ZUSAGE, AN DER DIE GANZE MIGRATION HAENGT: der Feed ordnet ueber
-- `veroeffentlicht_ab`, und die Spalte traegt `default now()`.
--
-- ══ WARUM SIE NICHT UEBER `send_release_note()` MESSBAR IST ═══════════════
-- Die Funktion setzt `sent_at = now()`, und `now()` ist der Zeitstempel der
-- TRANSAKTION. Der Spaltenvorgabewert liefert denselben Wert — beide Spalten
-- sind ueber diesen Weg zwangslaeufig gleich, egal ob der Ausloeser die
-- zweite setzt oder nicht. GEMESSEN am 12.09.: eine Fassung des Ausloesers
-- OHNE `veroeffentlicht_ab` lief gegen die erste Form dieser Zusage gruen
-- durch. Sie belegte nichts.
--
-- Deshalb ein ALTES `sent_at` und der direkte Zustandswechsel. Nur so
-- unterscheiden sich Vorgabewert und Zustelldatum ueberhaupt.
update public.release_notes
   set status = 'sent', sent_at = '2026-05-01 09:00:00+00'
 where id = '7f000000-0000-0000-0000-000000000005';

select is(
  (select count(*)::int from public.posts
    where release_note_id = '7f000000-0000-0000-0000-000000000005'
      and created_at         = '2026-05-01 09:00:00+00'
      and veroeffentlicht_ab = '2026-05-01 09:00:00+00'),
  1, '3.5 BEIDE Zeitspalten stammen aus sent_at, nicht aus now() — gemessen '
     'an einem weit zurueckliegenden Zustelldatum');

select is(
  (select body from public.posts
    where release_note_id = '7f000000-0000-0000-0000-000000000001'),
  '', '3.6 Der Beitrag traegt keinen Mitteilungsinhalt');

select alike(
  pg_temp.zustellen_als('7e000000-0000-0000-0000-0000000000ad',
                        '7f000000-0000-0000-0000-000000000001'),
  'FEHLER:23505%', '3.7 Ein zweiter Versand bricht ab');

select is(
  (select count(*)::int from public.posts
    where kind = 'release'
      and release_note_id = '7f000000-0000-0000-0000-000000000001'),
  1, '3.8 …und erzeugt keine zweite posts-Zeile');

-- ── Eine vorbestehende Zeile darf die Zustellung nicht toeten ──────────────
-- Befund opencode im Diff-Review, HOCH. Weder der Fremdschluessel noch der
-- CHECK binden eine `release`-Zeile an `status = 'sent'` der Note: eine Zeile
-- auf einen ENTWURF ist schema-gueltig und hier von Hand angelegt. Ohne das
-- `on conflict` im Ausloeser traefe sein Insert den partiellen Unique-Index,
-- der Trigger-Fehler rollte das `update` zurueck — und die Mitteilung waere nie
-- mehr zustellbar.
insert into public.posts (id, author_id, body, visibility, kind, release_note_id)
values ('7e444444-0000-4000-8000-000000000001',
        '7e000000-0000-0000-0000-0000000000ad', '', 'members', 'release',
        '7f000000-0000-0000-0000-000000000002');

select alike(
  pg_temp.zustellen_als('7e000000-0000-0000-0000-0000000000ad',
                        '7f000000-0000-0000-0000-000000000002'),
  'OK:%', '3.9 Eine vorbestehende Release-Zeile laesst die Zustellung gelingen');

select is(
  (select count(*)::int from public.posts
    where kind = 'release'
      and release_note_id = '7f000000-0000-0000-0000-000000000002'),
  1, '3.10 …und es bleibt bei der einen Zeile');

select is(
  (select status from public.release_notes
    where id = '7f000000-0000-0000-0000-000000000002'),
  'sent', '3.11 …und die Mitteilung steht auf sent');

delete from public.posts where release_note_id = '7f000000-0000-0000-0000-000000000002';

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Hinweise (Aufgaben 4.8 und 4.9)
-- ════════════════════════════════════════════════════════════════════════════
-- ZUERST die Zaehlung, die VOR dem Mitgliedsbeitrag stehen muss: der loest
-- selbst einen `post_created`-Rundruf aus.
select is(
  (select count(*)::int from public.notifications
    where profile_id = '7e000000-0000-0000-0000-00000000000a'
      and type = 'release_note'
      and payload->>'release_note_id' = '7f000000-0000-0000-0000-000000000001'),
  1, '4.1 Die Zustellung erzeugt genau einen Release-Hinweis');

-- Auf die KENNUNG des Release-Beitrags eingeschraenkt, nicht auf den Typ
-- allein: im selben Lauf entstehen Mitgliedsbeitraege (Positivkontrolle 2.6),
-- und die kuendigen sich zu Recht an. Eine Zaehlung ueber alle `post_created`
-- maesse deren Rundruf mit und sagte ueber die dritte Art nichts.
select is(
  (select count(*)::int from public.notifications n
    where n.profile_id = '7e000000-0000-0000-0000-00000000000a'
      and n.type = 'post_created'
      and n.payload->>'post_id' = (select p.id::text from public.posts p
        where p.release_note_id = '7f000000-0000-0000-0000-000000000001')),
  0, '4.2 …und keinen zusaetzlichen Hinweis ueber einen neuen Beitrag');

-- Der Vergleichsbeitrag: gewoehnlich, vom Admin, damit die Positivkontrollen
-- denselben Empfaenger haben wie die Verneinungen.
insert into public.posts (id, author_id, body, visibility, kind) values
  ('7e222222-0000-4000-8000-000000000001',
   '7e000000-0000-0000-0000-0000000000ad', 'Ein Mitgliedsbeitrag', 'members', 'member');

insert into public.comments (post_id, author_id, body)
select p.id, '7e000000-0000-0000-0000-00000000000a', 'Danke!'
  from public.posts p where p.release_note_id = '7f000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.notifications n
    where n.profile_id = '7e000000-0000-0000-0000-0000000000ad'
      and n.type = 'comment_on_post'
      and n.payload->>'post_id' = (select p.id::text from public.posts p
        where p.release_note_id = '7f000000-0000-0000-0000-000000000001')),
  0, '4.3 Ein Kommentar an der Release-Karte benachrichtigt den Admin nicht');

insert into public.comments (post_id, author_id, body)
values ('7e222222-0000-4000-8000-000000000001',
        '7e000000-0000-0000-0000-00000000000a', 'Und hier?');

select is(
  (select count(*)::int from public.notifications n
    where n.profile_id = '7e000000-0000-0000-0000-0000000000ad'
      and n.type = 'comment_on_post'
      and n.payload->>'post_id' = '7e222222-0000-4000-8000-000000000001'),
  1, '4.4 Positivkontrolle: derselbe Kommentar am Mitgliedsbeitrag erzeugt genau '
     'einen Hinweis');

insert into public.post_likes (post_id, profile_id)
select p.id, '7e000000-0000-0000-0000-00000000000a'
  from public.posts p where p.release_note_id = '7f000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.notifications n
    where n.profile_id = '7e000000-0000-0000-0000-0000000000ad'
      and n.type = 'like_on_post'
      and n.payload->>'post_id' = (select p.id::text from public.posts p
        where p.release_note_id = '7f000000-0000-0000-0000-000000000001')),
  0, '4.5 Eine Reaktion an der Release-Karte benachrichtigt den Admin nicht');

insert into public.post_likes (post_id, profile_id)
values ('7e222222-0000-4000-8000-000000000001',
        '7e000000-0000-0000-0000-00000000000a');

select is(
  (select count(*)::int from public.notifications n
    where n.profile_id = '7e000000-0000-0000-0000-0000000000ad'
      and n.type = 'like_on_post'
      and n.payload->>'post_id' = '7e222222-0000-4000-8000-000000000001'),
  1, '4.6 Positivkontrolle: dieselbe Reaktion am Mitgliedsbeitrag erzeugt genau '
     'einen Hinweis');

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Ohne bestimmbaren Autor wird trotzdem zugestellt (Aufgabe 4.10)
-- ════════════════════════════════════════════════════════════════════════════
-- Der Zustandswechsel als EIGENTUEMER, also ohne Sitzung: `auth.uid()` ist
-- null. Zusammen mit `created_by is null` bleibt dem Ausloeser kein Autor —
-- der Fall, den ein kuenftiger zweiter Weg zu `sent` mitbraechte.
update public.release_notes set status = 'sent', sent_at = now()
 where id = '7f000000-0000-0000-0000-000000000003';

select is(
  (select status from public.release_notes
    where id = '7f000000-0000-0000-0000-000000000003'),
  'sent', '5.1 Die Zustellung gelingt auch ohne bestimmbaren Autor');

select is(
  (select count(*)::int from public.posts
    where release_note_id = '7f000000-0000-0000-0000-000000000003'),
  0, '5.2 …und es entsteht kein Feed-Beitrag statt eines not-null-Fehlers');

-- DIE POSITIVKONTROLLE: derselbe Weg, nur mit Urheber. Ohne sie belegte 5.2
-- auch einen Ausloeser, der auf diesem Weg gar nicht feuert.
update public.release_notes set status = 'sent', sent_at = now()
 where id = '7f000000-0000-0000-0000-000000000004';

select is(
  (select count(*)::int from public.posts
    where release_note_id = '7f000000-0000-0000-0000-000000000004'),
  1, '5.3 Positivkontrolle: mit Urheber entsteht auf demselben Weg ein Beitrag');

select finish();
rollback;
