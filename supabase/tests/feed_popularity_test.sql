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
select plan(5);

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, aud, role, email) values
  ('c1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'bl-angreifer@test.fbc'),
  ('c1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bl-autor@test.fbc');

-- Der Angreifer steht auf `basic` — der niedrigsten Stufe. Wenn der Weg SCHON
-- von dort offen ist, ist er von jeder höheren erst recht offen.
update public.profiles set tier = 'basic', name = 'Bl Angreifer', activated_at = now()
 where id = 'c1000000-0000-0000-0000-000000000001';
update public.profiles set tier = 'impact', name = 'Bl Autor', activated_at = now()
 where id = 'c1000000-0000-0000-0000-000000000002';

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

select * from finish();
rollback;
