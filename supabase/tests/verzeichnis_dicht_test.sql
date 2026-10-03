-- Der Rohzugriff auf `profiles` und `profiles_public` ist zu (AGE-1001).
-- Change: openspec/changes/verzeichnis-dicht/.
--
-- Echtes pgTAP mit plan()/finish() — nur solche Dateien stehen im CI-Lauf.
-- Diese Datei ist in ci.yml eingetragen.
--
-- ══ WAS HIER GEMESSEN WIRD ═════════════════════════════════════════════════
--   1. **Der Entzug selbst.** Weder `profiles` noch `profiles_public` sind fuer
--      `authenticated` lesbar — auf KEINEM Rang, auch nicht fuer die eigene
--      Zeile. `rechte_v5_test.sql` hielt bis zu diesem Change das Gegenteil
--      fest; die drei Zusagen dort sind mit diesem Change umgedreht.
--   2. **Dass auch das ZAEHLEN nicht geht.** `select count(*)` ist der
--      Rueckweg, den ein spaltenweises `select(id)` oeffnen wuerde. Gemessen am
--      03.10.: mit `select(id)` liefert `count(*)` wieder alle Zeilen. Deshalb
--      steht hier eine eigene Zusage und nicht nur eine auf `select *`.
--   3. **Die fuenf Lesefunktionen**, je Rang und je Lebenszyklus-Zustand.
--   4. **Der Unterschied zwischen `profil_karten` und
--      `gespraechspartner_karten`.** Ein Profil mit `is_public = false`, mit dem
--      der Aufrufer einen Faden teilt, kommt ueber die zweite MIT Namen zurueck
--      und ueber die erste GAR NICHT. Das ist der Befund, der diesem Change
--      seine Form gegeben hat: `chat.ts` liest heute absichtlich die Tabelle,
--      und ein Ersatz mit dem Praedikat der Sicht liesse im Chat Namen
--      verschwinden — nur bei den Zurueckgezogenen, und von keinem Test mit
--      oeffentlichen Konten bemerkt.
--   5. **Die vier Schreibfunktionen.** Dass sie wirken, und zwar nachgemessen
--      an der Wirkung, nicht an einem ausbleibenden Fehler.
--   6. **Dass `search_directory` DEFINER ist und `feed_top_authors` INVOKER
--      BLEIBT.** Die zweite zaehlt `posts` unter den Rechten des Aufrufers;
--      als DEFINER zaehlte sie terminierte Beitraege mit (`veroeffentlicht_ab`
--      steht in beiden SELECT-Policies). Befund der Plan-Review.
--
-- ══ FALLEN, DIE DIESES PROJEKT SCHON GESTELLT HAT ══════════════════════════
--   * **Am RANG pruefen, nie am Schluesselnamen** — `discover` hat seine
--     Bedeutung schon einmal gewechselt.
--   * In pgTAP heisst es `alike()`, nicht `like()`.
--   * Der lokale Stack ist geseedet und GETEILT: jede Mengenaussage ist auf die
--     Fixture-Kennungen eingeschraenkt, nie `count(*)` der ganzen Tabelle.
--     AUSNAHME ist Zusage 2 — dort IST `count(*)` die Frage, und sie muss
--     scheitern, nicht zaehlen.
--   * Die Helfer geben im Fehlerfall NULL bzw. 'FEHLER:<sqlstate>' zurueck
--     statt die Transaktion zu reissen. Solange die Funktionen fehlen (RED),
--     stuerben sonst alle folgenden Zusagen an „current transaction is aborted".
--   * `alike(…, 'FEHLER:%')` allein waere gruen, sobald IRGENDETWAS schiefgeht.
--     Ablehnungen werden auf `FEHLER:42501%` geprueft (insufficient_privilege).
--   * **`try_as` = 'OK' belegt bei UPDATE NICHTS.** Ein Update, das null Zeilen
--     trifft, ist kein Fehler. Jede Schreibzusage misst danach die WIRKUNG, und
--     zwar als Eigentuemer der Transaktion, also an der RLS vorbei.

begin;
select plan(41);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- `auth.users`-Insert feuert `handle_new_user()` und legt die
-- `public.profiles`-Zeile an. Danach Stufe, Aktivierung und Sichtbarkeit.
insert into auth.users (id, aud, role, email) values
  ('b1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'v-connect@test.fbc'),
  ('b1000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'v-discover@test.fbc'),
  ('b1000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'v-impact@test.fbc'),
  ('b1000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'v-unbestaetigt@test.fbc'),
  ('b2000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'v-oeffentlich@test.fbc'),
  ('b2000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'v-zurueckgezogen@test.fbc'),
  ('b2000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'v-gesperrt@test.fbc');

update public.profiles set tier = 'connect',  name = 'V Rang Drei'  where id = 'b1000000-0000-0000-0000-000000000003';
update public.profiles set tier = 'discover', name = 'V Rang Vier'  where id = 'b1000000-0000-0000-0000-000000000004';
update public.profiles set tier = 'impact',   name = 'V Rang Sechs' where id = 'b1000000-0000-0000-0000-000000000006';
update public.profiles set tier = 'impact',   name = 'V Unbestaetigt' where id = 'b1000000-0000-0000-0000-000000000009';
update public.profiles set tier = 'impact',   name = 'V Oeffentlich' where id = 'b2000000-0000-0000-0000-000000000001';
update public.profiles set tier = 'impact',   name = 'V Zurueckgezogen' where id = 'b2000000-0000-0000-0000-000000000002';
update public.profiles set tier = 'impact',   name = 'V Gesperrt'   where id = 'b2000000-0000-0000-0000-000000000003';

update public.profiles set activated_at = now()
 where id in ('b1000000-0000-0000-0000-000000000003',
              'b1000000-0000-0000-0000-000000000004',
              'b1000000-0000-0000-0000-000000000006',
              'b2000000-0000-0000-0000-000000000001',
              'b2000000-0000-0000-0000-000000000002',
              'b2000000-0000-0000-0000-000000000003');

-- Das zurueckgezogene Profil ist der Kern von Zusage 4.
update public.profiles set is_public = false
 where id = 'b2000000-0000-0000-0000-000000000002';
-- Das gesperrte ist der Kern der Lebenszyklus-Zusagen.
update public.profiles set disabled_at = now()
 where id = 'b2000000-0000-0000-0000-000000000003';

-- Erweiterte Felder am oeffentlichen Ziel, damit `profil_detail` etwas zu
-- liefern hat.
update public.profiles
   set headline = 'Kopfzeile', competencies = array['pruefen']
 where id = 'b2000000-0000-0000-0000-000000000001';

-- EIN Gespraechsfaden: Rang 6 mit dem ZURUECKGEZOGENEN Profil. Genau die Lage,
-- die `chat.ts` heute ueber die Basistabelle loest.
insert into public.message_threads (id, a_profile_id, b_profile_id) values
  ('b3000000-0000-0000-0000-000000000001',
   'b1000000-0000-0000-0000-000000000006', 'b2000000-0000-0000-0000-000000000002');

-- Zwei Beitraege des oeffentlichen Ziels: einer sichtbar, einer TERMINIERT.
-- Der zweite ist die Zusage, die `feed_top_authors` als INVOKER begruendet.
insert into public.posts (id, author_id, body, visibility, veroeffentlicht_ab) values
  ('b4000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001',
   'sichtbar', 'members', now() - interval '1 day'),
  ('b4000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001',
   'terminiert', 'members', now() + interval '30 days');

-- ── Helfer ──────────────────────────────────────────────────────────────────
create function pg_temp.als_zahl(uid uuid, q text) returns integer
language plpgsql as $$
declare n integer;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q into n;
  exception when others then
    n := null;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return n;
end $$;

create function pg_temp.als_text(uid uuid, q text) returns text
language plpgsql as $$
declare s text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q into s;
  exception when others then
    s := null;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return s;
end $$;

/** Fuehrt `q` als `uid` aus und gibt 'OK' oder 'FEHLER:<sqlstate> …' zurueck. */
create function pg_temp.try_as(uid uuid, q text) returns text
language plpgsql as $$
declare ergebnis text := 'OK';
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q;
  exception when others then
    ergebnis := 'FEHLER:' || SQLSTATE || ' ' || SQLERRM;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return ergebnis;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Der Entzug — auf JEDEM Rang, auch fuer die eigene Zeile
-- ════════════════════════════════════════════════════════════════════════════

select alike(
  pg_temp.try_as('b1000000-0000-0000-0000-000000000003',
    $$select 1 from public.profiles limit 1$$),
  'FEHLER:42501%', 'Rang 3 darf `profiles` nicht lesen');

select alike(
  pg_temp.try_as('b1000000-0000-0000-0000-000000000004',
    $$select 1 from public.profiles limit 1$$),
  'FEHLER:42501%', 'Rang 4 darf `profiles` nicht lesen — DIESE Zusage stand '
                   'bis AGE-1001 umgekehrt in rechte_v5_test.sql');

select alike(
  pg_temp.try_as('b1000000-0000-0000-0000-000000000006',
    $$select 1 from public.profiles limit 1$$),
  'FEHLER:42501%', 'Rang 6 darf `profiles` nicht lesen');

select alike(
  pg_temp.try_as('b1000000-0000-0000-0000-000000000006',
    $$select 1 from public.profiles where id = 'b1000000-0000-0000-0000-000000000006'$$),
  'FEHLER:42501%', 'auch die EIGENE Zeile nicht — sie kommt aus `mein_profil()`');

select alike(
  pg_temp.try_as('b1000000-0000-0000-0000-000000000003',
    $$select 1 from public.profiles_public limit 1$$),
  'FEHLER:42501%', 'Rang 3 darf die Sicht nicht lesen');

select alike(
  pg_temp.try_as('b1000000-0000-0000-0000-000000000006',
    $$select 1 from public.profiles_public limit 1$$),
  'FEHLER:42501%', 'Rang 6 darf die Sicht nicht lesen');

-- ── 2. Auch das ZAEHLEN nicht ───────────────────────────────────────────────
-- Der Rueckweg, den ein spaltenweises `select(id)` oeffnen wuerde: gemessen am
-- 03.10. liefert `count(*)` damit wieder alle Zeilen. Eine Zusage auf
-- `select *` allein saehe das nicht.
select alike(
  pg_temp.try_as('b1000000-0000-0000-0000-000000000006',
    $$select count(*) from public.profiles$$),
  'FEHLER:42501%', 'Rang 6 kann `profiles` nicht einmal ZAEHLEN');

select alike(
  pg_temp.try_as('b1000000-0000-0000-0000-000000000006',
    $$select count(*) from public.profiles_public$$),
  'FEHLER:42501%', 'dasselbe fuer die Sicht');

select is(
  (select count(*)::int from information_schema.role_column_grants
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'authenticated' and privilege_type = 'SELECT'),
  0, 'KEIN spaltenweises SELECT auf `profiles` fuer `authenticated` — auch '
     'nicht auf `id`, denn damit waeren die Kennungen wieder aufzaehlbar');

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Die eigene Zeile — `mein_profil()` und `meine_stufe()`
-- ════════════════════════════════════════════════════════════════════════════

select is(
  pg_temp.als_zahl('b1000000-0000-0000-0000-000000000006',
    $$select count(*)::int from public.mein_profil()$$),
  1, '`mein_profil()` gibt genau EINE Zeile');

select is(
  pg_temp.als_text('b1000000-0000-0000-0000-000000000006',
    $$select name from public.mein_profil()$$),
  'V Rang Sechs', 'und zwar die eigene');

select is(
  pg_temp.als_zahl('b1000000-0000-0000-0000-000000000003',
    $$select count(*)::int from public.mein_profil()$$),
  1, 'auch unterhalb des Clubs — die eigene Zeile haengt an keiner Stufe');

select is(
  pg_temp.als_zahl('b1000000-0000-0000-0000-000000000009',
    $$select count(*)::int from public.mein_profil()$$),
  0, 'ein UNBESTAETIGTES Konto bekommt nichts — eine DEFINER-Funktion erbt '
     'kein Praedikat, sie muss es mitbringen');

select is(
  pg_temp.als_zahl('b2000000-0000-0000-0000-000000000003',
    $$select count(*)::int from public.mein_profil()$$),
  0, 'ein GESPERRTES Konto ebenso wenig');

select is(
  pg_temp.als_text('b1000000-0000-0000-0000-000000000006',
    $$select tier from public.meine_stufe()$$),
  'impact', '`meine_stufe()` gibt die Stufe');

select is(
  pg_temp.als_zahl('b1000000-0000-0000-0000-000000000004',
    $$select level_rank from public.meine_stufe()$$),
  4, 'und den Rang — das ersetzt die Einbettung `membership_tiers(level_rank)`');

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Karten zu bekannten Kennungen
-- ════════════════════════════════════════════════════════════════════════════

select is(
  pg_temp.als_text('b1000000-0000-0000-0000-000000000003',
    $$select name from public.profil_karten(array['b2000000-0000-0000-0000-000000000001']::uuid[])$$),
  'V Oeffentlich', '`profil_karten` liefert auch unterhalb des Clubs — die '
                   'Basisfelder haengen bewusst an keiner Stufe');

select is(
  pg_temp.als_zahl('b1000000-0000-0000-0000-000000000006',
    $$select count(*)::int from public.profil_karten(array['b2000000-0000-0000-0000-000000000002']::uuid[])$$),
  0, 'ein ZURUECKGEZOGENES Profil kommt dort NICHT — das Praedikat der Sicht '
     'gilt unveraendert weiter');

select is(
  pg_temp.als_zahl('b1000000-0000-0000-0000-000000000006',
    $$select count(*)::int from public.profil_karten(array['b2000000-0000-0000-0000-000000000003']::uuid[])$$),
  0, 'ein GESPERRTES ebenso wenig');

select is(
  pg_temp.als_zahl('b1000000-0000-0000-0000-000000000009',
    $$select count(*)::int from public.profil_karten(array['b2000000-0000-0000-0000-000000000001']::uuid[])$$),
  0, 'und ein UNBESTAETIGTER Aufrufer bekommt gar nichts');

-- ── Der Unterschied, der diesem Change seine Form gegeben hat ───────────────
select is(
  pg_temp.als_text('b1000000-0000-0000-0000-000000000006',
    $$select name from public.gespraechspartner_karten(array['b2000000-0000-0000-0000-000000000002']::uuid[])$$),
  'V Zurueckgezogen',
  'im Chat traegt ein zurueckgezogenes Profil seinen Namen — ueber '
  '`gespraechspartner_karten`, NICHT ueber das Praedikat der Sicht');

select is(
  pg_temp.als_zahl('b1000000-0000-0000-0000-000000000004',
    $$select count(*)::int from public.gespraechspartner_karten(array['b2000000-0000-0000-0000-000000000002']::uuid[])$$),
  0, 'wer KEINEN Faden mit ihm teilt, bekommt es nicht — das Praedikat IST '
     'die Berechtigung');

select is(
  pg_temp.als_zahl('b1000000-0000-0000-0000-000000000006',
    $$select count(*)::int from public.gespraechspartner_karten(array['b2000000-0000-0000-0000-000000000003']::uuid[])$$),
  0, 'und ein gesperrtes Profil auch im Chat nicht');

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Die erweiterten Felder eines fremden Profils
-- ════════════════════════════════════════════════════════════════════════════

select is(
  pg_temp.als_text('b1000000-0000-0000-0000-000000000004',
    $$select headline from public.profil_detail('b2000000-0000-0000-0000-000000000001')$$),
  'Kopfzeile', 'ab Rang 4 kommen die erweiterten Felder — wie heute');

select is(
  pg_temp.als_zahl('b1000000-0000-0000-0000-000000000003',
    $$select count(*)::int from public.profil_detail('b2000000-0000-0000-0000-000000000001')$$),
  0, 'unterhalb des Clubs nicht — die Clubschwelle bleibt, wo sie war');

select is(
  pg_temp.als_zahl('b1000000-0000-0000-0000-000000000003',
    $$select count(*)::int from public.profil_detail('b1000000-0000-0000-0000-000000000003')$$),
  1, 'die EIGENE Zeile aber schon — sonst waere der eigene Profilaufruf kaputt');

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Die Schreibwege — und ihre WIRKUNG, nicht nur ihr Ausbleiben von Fehlern
-- ════════════════════════════════════════════════════════════════════════════

select is(
  (select count(*)::int from information_schema.role_column_grants
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  0, 'auch die 17 Spalten-Grants fuer UPDATE sind weg — ohne SELECT auf die '
     'WHERE-Spalten waeren sie ohnehin unbenutzbar');

-- Vierzehn Pflichtparameter, kein Vorgabewert: der Editor schreibt immer den
-- vollstaendigen Satz. Die Zusage ruft deshalb genauso auf, wie er es tut.
select is(
  pg_temp.try_as('b1000000-0000-0000-0000-000000000006',
    $$select public.profil_speichern(
        'Neu Benannt', 'Region', 'Firma', 'Kurz', 'branche', 'Kopf',
        array['rolle']::text[], array['kompetenz']::text[], 'https://beispiel.test',
        'sein', '{}'::jsonb, array[]::text[], null, null)$$),
  'OK', '`profil_speichern` laeuft durch');

select is(
  (select name from public.profiles where id = 'b1000000-0000-0000-0000-000000000006'),
  'Neu Benannt', '… und der Name steht wirklich — als Eigentuemer nachgemessen, '
                 'an der RLS vorbei');

select is(
  pg_temp.try_as('b1000000-0000-0000-0000-000000000006',
    $$select public.verzeichnis_sichtbarkeit_setzen(false)$$),
  'OK', '`verzeichnis_sichtbarkeit_setzen` laeuft durch');

select is(
  (select is_public from public.profiles where id = 'b1000000-0000-0000-0000-000000000006'),
  false, '… und die Sichtbarkeit steht wirklich');

select is(
  pg_temp.try_as('b1000000-0000-0000-0000-000000000006',
    $$select public.entwicklungsschwerpunkt_setzen('wirken')$$),
  'OK', '`entwicklungsschwerpunkt_setzen` laeuft durch');

select is(
  (select dev_focus from public.profiles where id = 'b1000000-0000-0000-0000-000000000006'),
  'wirken', '… und der Schwerpunkt steht wirklich');

select is(
  pg_temp.try_as('b1000000-0000-0000-0000-000000000009',
    $$select public.profil_speichern(
        'Darf Nicht', 'r', 'f', 'k', null, null,
        array[]::text[], array[]::text[], null, null, '{}'::jsonb,
        array[]::text[], null, null)$$),
  'OK', 'ein unbestaetigtes Konto bekommt KEINEN Fehler …');

select isnt(
  (select name from public.profiles where id = 'b1000000-0000-0000-0000-000000000009'),
  'Darf Nicht', '… aber auch keine Wirkung. Genau hier belegt ein ausbleibender '
                'Fehler nichts, und nur die Nachmessung trennt die beiden Faelle');

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Die beiden Funktionen, die der Entzug sonst gebrochen haette
-- ════════════════════════════════════════════════════════════════════════════

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'search_directory'),
  true, '`search_directory` ist DEFINER — sonst naehme ihr der Entzug die Sicht');

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'feed_top_authors'),
  false, '`feed_top_authors` BLEIBT INVOKER — als DEFINER zaehlte sie Beitraege '
         'mit, die der Aufrufer nicht sehen darf');

select is(
  pg_temp.als_zahl('b1000000-0000-0000-0000-000000000006',
    $$select post_count::int from public.feed_top_authors(20)
       where profile_id = 'b2000000-0000-0000-0000-000000000001'$$),
  1, 'und sie zaehlt den TERMINIERTEN Beitrag nicht mit — das ist die Zusage, '
     'die ihren Verbleib als INVOKER begruendet');

select is(
  pg_temp.als_text('b1000000-0000-0000-0000-000000000006',
    $$select name from public.feed_top_authors(20)
       where profile_id = 'b2000000-0000-0000-0000-000000000001'$$),
  'V Oeffentlich', 'den Namen liefert sie weiterhin — ueber die neue Funktion '
                   'statt ueber ein Leserecht auf der Sicht');

select is(
  pg_temp.als_zahl('b1000000-0000-0000-0000-000000000006',
    $$select count(*)::int from public.search_directory()
       where id = 'b2000000-0000-0000-0000-000000000001'$$),
  1, '`search_directory` findet das oeffentliche Ziel weiterhin');

select is(
  pg_temp.als_zahl('b1000000-0000-0000-0000-000000000003',
    $$select count(*)::int from public.search_directory()
       where id <> 'b1000000-0000-0000-0000-000000000003'$$),
  0, 'und ein Konto unterhalb der Verzeichnisschwelle findet weiterhin NUR '
     'sich selbst — die Zusage bleibt, ihr Traeger ist jetzt das Eintrittstor '
     'der Funktion statt der RLS');

select * from finish();
rollback;
