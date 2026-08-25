-- Beliebtheit: der Zähler und die Rechte, ohne die er eine Behauptung wäre
-- (AGE-582). Change: openspec/changes/activity-concept-level/, Abschnitt 3.
--
-- Echtes pgTAP mit plan()/finish() — nur solche Dateien stehen im CI-Lauf; die
-- manuellen probe_*.sql tun es nicht. Diese Datei ist in ci.yml eingetragen.
--
-- ══ WARUM DIESER TEST VOR DEM ZÄHLER ENTSTAND ══════════════════════════════
-- Ein Trigger auf INSERT und DELETE führt eine richtige Zahl nur, wenn die
-- Reaktionszeile nicht VERSCHOBEN werden kann. Sie konnte es: `authenticated`
-- hielt UPDATE auf `post_likes`, und `likes_write_own` ist `for all` auf die
-- eigene Zeile.
--
-- Der Ablauf, nachgerechnet in der Plan-Review:
--   1. auf A reagieren            → Trigger zählt A hoch
--   2. die Zeile auf B umschreiben → KEIN Trigger; A bleibt oben, B unberührt
--   3. die Reaktion zurücknehmen  → DELETE mit OLD.post_id = B → B geht auf −1
-- Beliebig wiederholbar. Deshalb steht der Entzug VOR dem Zähler: ein Zähler
-- über einem verschiebbaren Datum ist eine Einladung.
--
-- ══ WAS DIE MESSUNG AM DESIGN KORRIGIERT HAT ═══════════════════════════════
-- Das Design schrieb, der Angriff treffe „einen Beitrag, den der Angreifer
-- nicht einmal sehen muss". Gemessen am 24.08.: das stimmt NICHT. Der
-- `exists (select 1 from posts …)`-Ausdruck in `likes_write_own` läuft unter
-- der RLS des Aufrufers, und ein Verschieben auf einen UNSICHTBAREN Beitrag
-- scheitert schon heute mit „new row violates row-level security policy".
--
-- Das entschärft den Befund nicht, es verschiebt ihn nur: der Angriff trifft
-- jeden Beitrag, den der Angreifer SEHEN kann — für ein Mitglied ab `exchange`
-- also den ganzen Club, für ein `basic`-Konto jeden öffentlichen Beitrag. Das
-- Fixture unten nimmt deshalb bewusst den ungünstigsten Angreifer, der noch
-- funktioniert: die NIEDRIGSTE Stufe auf einem öffentlichen fremden Beitrag.
--
-- ══ FALLEN, DIE DIESES PROJEKT SCHON GESTELLT HAT ══════════════════════════
--   * Ein UPDATE, das die RLS nicht durchlässt, ergibt NULL ZEILEN statt
--     `42501` — ein fehlendes GRANT dagegen sehr wohl `42501`. Hier wirken
--     beide Schranken, deshalb lautet jede Zusage zusätzlich auf den BESTAND.
--   * `try_as()` meldet jeden Fehler als 'DENIED:'.
--   * In pgTAP heisst es `alike()`, nicht `like()`.
--   * Der lokale Stack ist geseedet. Jede Mengenaussage ist auf die
--     Fixture-IDs eingeschränkt und nie `count(*)` der ganzen Tabelle.

begin;
select plan(23);

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, aud, role, email) values
  ('c1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'bl-angreifer@test.fbc'),
  ('c1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bl-autor@test.fbc'),
  ('c1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'bl-zweiter@test.fbc');

-- Der Angreifer steht auf `basic` — der niedrigsten Stufe. Wenn der Weg SCHON
-- von dort offen ist, ist er von jeder höheren erst recht offen.
update public.profiles set tier = 'basic', name = 'Bl Angreifer', activated_at = now()
 where id = 'c1000000-0000-0000-0000-000000000001';
update public.profiles set tier = 'impact', name = 'Bl Autor', activated_at = now()
 where id = 'c1000000-0000-0000-0000-000000000002';
update public.profiles set tier = 'impact', name = 'Bl Zweiter', activated_at = now()
 where id = 'c1000000-0000-0000-0000-000000000003';

-- Beide öffentlich und beide von einem FREMDEN Autor: der Angreifer greift
-- nichts an, was ihm gehört.
insert into public.posts (id, author_id, body, visibility) values
  ('c2000000-0000-0000-0000-00000000000a', 'c1000000-0000-0000-0000-000000000002',
   'Beitrag A — hierauf reagiert der Angreifer.', 'public'),
  ('c2000000-0000-0000-0000-00000000000b', 'c1000000-0000-0000-0000-000000000002',
   'Beitrag B — hierhin soll die Reaktion wandern.', 'public');

-- ── Helfer (Muster aus rls_test.sql) ────────────────────────────────────────
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

-- ── 1. Eine Reaktion ist nicht verschiebbar ─────────────────────────────────
-- Die erste Schranke: das Recht selbst. Eine Reaktion hat keinen Änderungsfall
-- — sie entsteht und sie vergeht. Der Client schreibt `post_likes` nur per
-- `upsert` und `delete`; das UPDATE-Recht war unbenutzt.
select is(
  (select string_agg(distinct privilege_type, ',' order by privilege_type)
     from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'post_likes'
      and grantee = 'authenticated'),
  'DELETE,INSERT,SELECT',
  'authenticated hält auf post_likes kein UPDATE mehr');

select is(
  pg_temp.try_as('c1000000-0000-0000-0000-000000000001',
    $$insert into public.post_likes (post_id, profile_id)
      values ('c2000000-0000-0000-0000-00000000000a',
              'c1000000-0000-0000-0000-000000000001')$$),
  'OK', 'Vorbedingung: der Angreifer reagiert auf Beitrag A');

select alike(
  pg_temp.try_as('c1000000-0000-0000-0000-000000000001',
    $$update public.post_likes set post_id = 'c2000000-0000-0000-0000-00000000000b'
       where profile_id = 'c1000000-0000-0000-0000-000000000001'$$),
  'DENIED:%',
  'Der Verschiebeversuch wird abgewiesen — und zwar mit einem Fehler, nicht '
  'still mit null Zeilen: das fehlende Recht greift vor der Policy');

-- Die Zusagen auf den Bestand stehen daneben, weil ein von der RLS
-- abgewiesenes UPDATE null Zeilen ergäbe und `try_as` dafür 'OK' meldete.
select is(
  (select post_id from public.post_likes
    where profile_id = 'c1000000-0000-0000-0000-000000000001'),
  'c2000000-0000-0000-0000-00000000000a'::uuid,
  'Die Reaktion zeigt weiterhin auf Beitrag A');

select is(
  (select count(*)::int from public.post_likes
    where post_id = 'c2000000-0000-0000-0000-00000000000b'),
  0, 'Beitrag B trägt zu keinem Zeitpunkt eine Reaktionszeile');

-- ── 2. Der Zähler ───────────────────────────────────────────────────────────
-- §1 hat genau eine Reaktion hinterlassen: die des Angreifers auf A, die nicht
-- wandern konnte. Von diesem Stand aus wird hier weitergezählt.
select is(
  (select data_type || '/' || is_nullable || '/' || coalesce(column_default, '(keiner)')
     from information_schema.columns
    where table_schema = 'public' and table_name = 'posts' and column_name = 'like_count'),
  'integer/NO/0',
  'posts.like_count ist integer, not null, Vorgabe 0 — ein Beitrag ohne '
  'Reaktion steht auf 0 und nicht auf null');

-- Kein `greatest(…, 0)` im Trigger: das faenge eine negative Zahl STILL ab und
-- machte jedes kuenftige Loch unsichtbar. Die Pruefbedingung faellt laut aus.
select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.posts'::regclass
      and contype = 'c' and conname = 'posts_like_count_nicht_negativ'),
  1, 'Eine Prüfbedingung verbietet eine negative Zahl');

select is(
  (select like_count from public.posts where id = 'c2000000-0000-0000-0000-00000000000a'),
  1, 'Die eine Reaktion aus §1 steht als 1 an Beitrag A');

select is(
  (select like_count from public.posts where id = 'c2000000-0000-0000-0000-00000000000b'),
  0, 'Beitrag B steht auf 0 — der Verschiebeversuch hat ihn nicht erreicht');

select is(
  pg_temp.try_as('c1000000-0000-0000-0000-000000000003',
    $$insert into public.post_likes (post_id, profile_id)
      values ('c2000000-0000-0000-0000-00000000000a',
              'c1000000-0000-0000-0000-000000000003')$$),
  'OK', 'Ein zweites Mitglied reagiert ebenfalls auf A');

select is(
  (select like_count from public.posts where id = 'c2000000-0000-0000-0000-00000000000a'),
  2, 'Die zweite Reaktion hebt die Zahl auf 2');

select is(
  pg_temp.try_as('c1000000-0000-0000-0000-000000000003',
    $$delete from public.post_likes
       where post_id = 'c2000000-0000-0000-0000-00000000000a'
         and profile_id = 'c1000000-0000-0000-0000-000000000003'$$),
  'OK', 'Das zweite Mitglied nimmt seine Reaktion zurück');

select is(
  (select like_count from public.posts where id = 'c2000000-0000-0000-0000-00000000000a'),
  1, 'Die Rücknahme führt die Zahl auf den Ausgangswert zurück');

-- Die Gegenrechnung. `post_engagement_counts` zaehlt live ueber `post_likes`;
-- wenn die materialisierte Zahl davon abwiche, waere sie eine Behauptung.
select is(
  (select count(*)::int from public.posts p
     join public.post_engagement_counts(array[
            'c2000000-0000-0000-0000-00000000000a'::uuid,
            'c2000000-0000-0000-0000-00000000000b'::uuid]) e on e.post_id = p.id
    where p.like_count <> e.like_count),
  0, 'Die Zahl an der Zeile stimmt für jeden Beitrag mit post_engagement_counts überein');

-- Der Index traegt die Ordnung. Die Zusage lautet auf die SPALTENFOLGE und die
-- Richtung, nicht nur auf den Namen: ein Index ueber dieselben drei Spalten in
-- anderer Reihenfolge spart den Sortierschritt nicht und waere fuer den
-- Keyset-Cursor wertlos.
select is(
  (select indexdef from pg_indexes
    where schemaname = 'public' and indexname = 'posts_like_count_created_at_id_idx'),
  'CREATE INDEX posts_like_count_created_at_id_idx ON public.posts '
  'USING btree (like_count DESC, created_at DESC, id DESC)',
  'Der Index trägt (like_count desc, created_at desc, id desc) — total geordnet, '
  'wie der Keyset-Cursor es braucht');

-- ── 3. Die Triggerfunktion ist gehärtet ─────────────────────────────────────
-- Sie schreibt `posts` unter fremdem Recht. Als INVOKER liefe das UPDATE unter
-- `posts_write_own` und der Zaehler waere genau dort falsch, wo er zaehlt.
select is(
  (select p.prosecdef::text || '/' || coalesce(array_to_string(p.proconfig, ','), '(keiner)')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'post_likes_zaehler'),
  'true/search_path=""',
  'post_likes_zaehler() ist security definer MIT geleertem search_path');

-- Postgres prueft EXECUTE beim ANLEGEN des Triggers, nicht bei jedem Feuern —
-- der Entzug kostet den Zaehler also nichts und nimmt eine offene Tuer weg.
select is(
  (select coalesce(string_agg(distinct grantee, ',' order by grantee), '(niemand)')
     from information_schema.role_routine_grants
    where routine_schema = 'public' and routine_name = 'post_likes_zaehler'
      and grantee in ('PUBLIC', 'anon', 'authenticated')),
  '(niemand)',
  'Weder PUBLIC noch anon noch authenticated dürfen post_likes_zaehler() rufen');

-- ── 4. Rechte auf `posts` ───────────────────────────────────────────────────
-- Der Zähler steht in einer Spalte der Tabelle, die der Autor bearbeiten darf.
-- Mit tabellenweitem UPDATE könnte er seine eigene Beliebtheit setzen — bei
-- einer Sortierung nach Beliebtheit wäre das eine Einladung. Also fällt UPDATE
-- auf die drei Spalten zurück, die `updatePost` wirklich schreibt.
select is(
  (select string_agg(distinct privilege_type, ',' order by privilege_type)
     from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'posts'
      and grantee = 'authenticated'),
  'DELETE,SELECT',
  'authenticated hält auf posts weder INSERT noch tabellenweites UPDATE');

select is(
  (select string_agg(distinct column_name, ',' order by column_name)
     from information_schema.role_column_grants
    where table_schema = 'public' and table_name = 'posts'
      and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  'body,hashtags,visibility',
  'Schreibbar sind genau die drei Spalten, die updatePost setzt');

select alike(
  pg_temp.try_as('c1000000-0000-0000-0000-000000000002',
    $$insert into public.posts (author_id, body, visibility)
      values ('c1000000-0000-0000-0000-000000000002', 'Direkt eingefuegt', 'public')$$),
  'DENIED:%',
  'Ein direktes INSERT in posts wird verweigert — Beiträge entstehen über '
  'create_post_with_media');

-- Der eigene Beitrag, das eigene Recht — und trotzdem nein: `like_count` steht
-- nicht auf der Spaltenliste.
select alike(
  pg_temp.try_as('c1000000-0000-0000-0000-000000000002',
    $$update public.posts set like_count = 999
       where id = 'c2000000-0000-0000-0000-00000000000a'$$),
  'DENIED:%',
  'Der Autor kann die Beliebtheit seines EIGENEN Beitrags nicht setzen');

select is(
  pg_temp.try_as('c1000000-0000-0000-0000-000000000002',
    $$update public.posts
         set body = 'Bearbeitet', hashtags = array['neu'], visibility = 'members'
       where id = 'c2000000-0000-0000-0000-00000000000b'$$),
  'OK', 'Text, Schlagworte und Sichtbarkeit bleiben am eigenen Beitrag schreibbar');

-- 3.10 — die VORAUSSETZUNG des Entzugs, nicht seine Bestätigung: der Weg über
-- die RPC hängt nicht am INSERT-Recht des Aufrufers. Der Entzug steht hier
-- ausdrücklich in der Transaktion, damit die Zusage auch dann noch etwas misst,
-- wenn das Recht ohnehin schon fort ist. Zuletzt, weil er den Bestand ändert.
revoke insert on public.posts from authenticated;

select is(
  pg_temp.try_as('c1000000-0000-0000-0000-000000000002',
    $$select public.create_post_with_media(
        'c2000000-0000-0000-0000-00000000000c'::uuid,
        'Ueber die RPC entstanden', 'public',
        array['beleg'], '{}'::text[], '[]'::jsonb)$$),
  'OK',
  'Ein Beitrag entsteht über create_post_with_media auch OHNE INSERT-Recht auf '
  'posts — die Funktion ist security definer');

select * from finish();
rollback;
