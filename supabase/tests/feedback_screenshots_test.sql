-- Der Screenshot am Feedback: Bucket und Policies (AGE-628).
-- Change: openspec/changes/feedback-ausbauen/, Einheit 2, Aufgaben 2.1–2.9.
--
-- Echtes pgTAP mit plan()/finish(). Diese Datei ist in ci.yml eingetragen —
-- ohne diesen Eintrag liefe sie nie.
--
-- ══ ZWEI HAELFTEN, UND NUR DIE ZWEITE BELEGT ETWAS ═════════════════════════
-- Die Abschnitte 1–2 pruefen den KATALOG: dass es den Bucket mit den richtigen
-- Grenzen gibt und je eine Policy pro Kommando. Das kann vollstaendig gruen
-- sein, waehrend die Bedingungen falsch herum stehen.
-- Ab Abschnitt 3 fassen die Zusagen ECHTE ZEILEN an, unter fuenf
-- verschiedenen Konten. Beides getrennt zu halten ist Absicht.
--
-- Am 02.09. drei Gegenproben am lokalen Stack gefahren, jede ueber die ganze
-- CI-Liste (25 Dateien, 1080 Zusagen), jede danach zeichengleich zurueck
-- (`diff` gegen den `pg_policies`-Abzug):
--   * `is_activated()` aus Lese- und Loesch-Policy → 3 Zusagen fallen, alle
--     drei aus Abschnitt 5b (der deaktivierte EIGENTUEMER), keine aus 5.
--   * die Klammer verschoben → GENAU EINE faellt, die Koeder-Zusage auf
--     `avatars`. Es gab dafuer im ganzen Bestand keine andere Abdeckung.
--   * `is_admin()` aus der Loesch-Policy → GENAU EINE faellt, die
--     Admin-Loeschzusage aus Abschnitt 4.
--
-- ══ WARUM DIE GRENZEN AM BUCKET STEHEN UND NICHT IM FORMULAR ═══════════════
-- Das Formular prueft dieselben Grenzen (Aufgabe 7.2), aber die GRENZE ist der
-- Bucket: das Formular ist Komfort, die Storage-API ist die Sicherheitsgrenze.
-- `avatars` traegt beide Grenzen nicht und ist als Vorlage untauglich; Vorlage
-- ist `post-media` (20260812090100).
--
-- ══ DIE VIER FALLEN, DIE DIE ZWEITE HAELFTE UMGEHT ═════════════════════════
--   * `storage.objects` traegt normalerweise KEINE SELECT-Policy. Postgres
--     zieht die SELECT-Sichtbarkeit aber fuer UPDATE und DELETE heran, sobald
--     das WHERE eine Spalte nennt — ein `update … where bucket_id = …` trifft
--     dann 0 Zeilen, auch bei `using (true)`. Dieser Change legt fuer diesen
--     Bucket eine SELECT-Policy an (2.4), was die Falle hier entschaerft; wer
--     sie umgeht, faellt wieder hinein.
--   * `storage.protect_delete()` ist ein BEFORE-STATEMENT-Trigger und blockt
--     jedes direkte DELETE, unabhaengig von RLS. Ohne
--     `set_config('storage.allow_delete_query', 'true', true)` misst die
--     Zusage den Trigger statt der Policy.
--   * Eine Ablehnung an der konkreten Meldung verankern
--     (`%row-level security policy%`), nie an einem blossen „es hat gekracht".
--   * INSERT scheitert laut, UPDATE scheitert leise. Ein stiller No-op wird
--     ueber die gezaehlte Zeilenzahl belegt, nicht ueber den Rueckgabewert.

begin;
select plan(37);

-- ── 1. Der Bucket und seine Grenzen (Aufgabe 2.2) ───────────────────────────
select is(
  (select count(*)::int from storage.buckets where id = 'feedback-screenshots'),
  1, 'Es gibt den Bucket feedback-screenshots');

select is(
  (select public from storage.buckets where id = 'feedback-screenshots'),
  false, 'Der Bucket ist PRIVAT — Screenshots zeigen fremde Bildschirme und gehen nur ueber signierte URLs');

select is(
  (select file_size_limit from storage.buckets where id = 'feedback-screenshots'),
  5242880::bigint, 'Die Groessengrenze steht am Bucket und betraegt 5 MiB');

-- Sortiert vergleichen: die Reihenfolge im Array ist keine Zusage.
select is(
  (select array(select unnest(allowed_mime_types) order by 1)
     from storage.buckets where id = 'feedback-screenshots'),
  array['image/jpeg', 'image/png', 'image/webp'],
  'Der Bucket nimmt genau png, jpeg und webp');

-- ── 2. Die vier Policies (Aufgaben 2.3–2.4) ─────────────────────────────────
-- Je Kommando eine. Geprueft wird hier NUR, dass sie existiert und am
-- richtigen Kommando haengt — was sie erlaubt, messen 2.6–2.9.
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'feedback_screenshots_insert_own' and cmd = 'INSERT'),
  1, 'Es gibt eine INSERT-Policy feedback_screenshots_insert_own');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'feedback_screenshots_update_own' and cmd = 'UPDATE'),
  1, 'Es gibt eine UPDATE-Policy feedback_screenshots_update_own');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'feedback_screenshots_select' and cmd = 'SELECT'),
  1, 'Es gibt eine SELECT-Policy — ohne sie liesse sich keine signierte URL ausstellen');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'feedback_screenshots_delete' and cmd = 'DELETE'),
  1, 'Es gibt eine DELETE-Policy — sie traegt spaeter die Admin-Ausnahme aus 2.4');


-- ════════════════════════════════════════════════════════════════════════════
-- AB HIER FASSEN DIE ZUSAGEN ECHTE ZEILEN AN (Aufgaben 2.6–2.9)
--
-- Alles darueber prueft den Katalog und bliebe gruen, waehrend die Klammer in
-- 2.4 falsch stuende. Die Faelle unten handeln unter vier verschiedenen Konten
-- auf wirklichen Objekten — nur sie belegen, was die Policies ERLAUBEN.
--
-- `storage.protect_delete()` blockt jedes direkte DELETE, unabhaengig von RLS,
-- und meldet dabei `42501` — denselben Code wie eine RLS-Ablehnung. Ohne die
-- Freigabe hier unten laege in jeder Loesch-Zusage der Trigger unter dem
-- Ergebnis statt der Policy.
select set_config('storage.allow_delete_query', 'true', true);

-- ── Impersonierung ──────────────────────────────────────────────────────────
-- Eigene Kopie wie in `feedback_themes_test.sql`: jede Testdatei laeuft in
-- ihrer eigenen Sitzung. Der Fehler wird GEFANGEN und als Text zurueckgegeben,
-- damit eine scheiternde Zusage die Datei nicht abreisst.
create function pg_temp.als(uid uuid, q text) returns text
language plpgsql as $$
declare ergebnis text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q into ergebnis;
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    return 'FEHLER:' || SQLERRM;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return ergebnis;
end $$;

-- ── Fixture: fuenf Konten ───────────────────────────────────────────────────
-- Der auth.users-Insert feuert handle_new_user() und legt public.profiles an.
insert into auth.users (id, aud, role, email) values
  ('fc000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'schuss-verfasser@test.fbc'),
  ('fc000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'schuss-dritter@test.fbc'),
  ('fc000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'schuss-admin@test.fbc'),
  ('fc000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated', 'schuss-admin-deaktiviert@test.fbc'),
  ('fc000000-0000-0000-0000-00000000000e', 'authenticated', 'authenticated', 'schuss-eigentuemer-deaktiviert@test.fbc');

update public.profiles set tier = 'basic', name = 'Verfasser', activated_at = now()
 where id = 'fc000000-0000-0000-0000-00000000000a';
update public.profiles set tier = 'basic', name = 'Drittes Mitglied', activated_at = now()
 where id = 'fc000000-0000-0000-0000-00000000000b';
update public.profiles set tier = 'basic', name = 'Admin', activated_at = now()
 where id = 'fc000000-0000-0000-0000-00000000000c';
-- Beide bewusst OHNE activated_at. Der Admin hat seine Staff-Zeile trotzdem —
-- genau darum geht es in 2.8. Das Mitglied daneben ist EIGENTUEMER eines
-- Screenshots und traegt damit den Fall, den `is_activated()` in der Policy
-- wirklich abfaengt (siehe Abschnitt 5b).
update public.profiles set tier = 'basic', name = 'Admin ohne Bestaetigung'
 where id = 'fc000000-0000-0000-0000-00000000000d';
update public.profiles set tier = 'basic', name = 'Eigentuemer ohne Bestaetigung'
 where id = 'fc000000-0000-0000-0000-00000000000e';

insert into public.staff_roles (profile_id, role) values
  ('fc000000-0000-0000-0000-00000000000c', 'admin'),
  ('fc000000-0000-0000-0000-00000000000d', 'admin');

-- ── Fixture: die Objekte ────────────────────────────────────────────────────
-- Je ein eigenes Objekt pro Loeschfall. Ein gemeinsames Objekt liesse den
-- ersten erfolgreichen Loeschfall alle folgenden mitnehmen, und die haetten
-- dann „0 Zeilen" gemeldet, ohne dass die Policy je gefragt worden waere.
insert into storage.objects (bucket_id, name) values
  ('feedback-screenshots', 'fc000000-0000-0000-0000-00000000000a/lesen.png'),
  ('feedback-screenshots', 'fc000000-0000-0000-0000-00000000000b/lesen-b.png'),
  ('feedback-screenshots', 'fc000000-0000-0000-0000-00000000000a/loeschen-fremd.png'),
  ('feedback-screenshots', 'fc000000-0000-0000-0000-00000000000a/loeschen-eigen.png'),
  ('feedback-screenshots', 'fc000000-0000-0000-0000-00000000000a/loeschen-admin.png'),
  ('feedback-screenshots', 'fc000000-0000-0000-0000-00000000000a/loeschen-deaktiviert.png'),
  ('feedback-screenshots', 'fc000000-0000-0000-0000-00000000000e/eigen-deaktiviert.png'),
  -- Der Koeder fuer die Klammer aus 2.4. `avatars` traegt KEINE SELECT-Policy,
  -- also sieht dort niemand etwas — ausser einem Admin, dem eine falsch
  -- gesetzte Klammer jeden Bucket dieser Instanz aufmacht.
  ('avatars', 'fc000000-0000-0000-0000-00000000000a/koeder.webp');

-- ── 3. Lesen: wer das Bild ueberhaupt zu Gesicht bekommt (Aufgabe 2.6) ──────
-- Das Ausstellen einer signierten URL IST dieses SELECT unter der Rolle des
-- Aufrufers. Was hier 0 zaehlt, bekommt kein Bild.
select is(
  pg_temp.als('fc000000-0000-0000-0000-00000000000a',
    $q$select count(*)::text from storage.objects
        where bucket_id = 'feedback-screenshots'
          and name = 'fc000000-0000-0000-0000-00000000000a/lesen.png'$q$),
  '1', 'Der Verfasser sieht seinen eigenen Screenshot');

select is(
  pg_temp.als('fc000000-0000-0000-0000-00000000000b',
    $q$select count(*)::text from storage.objects
        where bucket_id = 'feedback-screenshots'
          and name = 'fc000000-0000-0000-0000-00000000000a/lesen.png'$q$),
  '0', 'Ein drittes Mitglied kommt an den fremden Screenshot NICHT heran');

-- Positivkontrolle zur Zeile darueber. Ohne sie belegte die 0 nichts: sie
-- entstuende genauso, wenn die Abfrage selbst ins Leere liefe.
select is(
  pg_temp.als('fc000000-0000-0000-0000-00000000000b',
    $q$select count(*)::text from storage.objects
        where bucket_id = 'feedback-screenshots'
          and name = 'fc000000-0000-0000-0000-00000000000b/lesen-b.png'$q$),
  '1', '… waehrend dasselbe Mitglied seinen EIGENEN Screenshot sehr wohl sieht');

select is(
  pg_temp.als('fc000000-0000-0000-0000-00000000000c',
    $q$select count(*)::text from storage.objects
        where bucket_id = 'feedback-screenshots'
          and name = 'fc000000-0000-0000-0000-00000000000a/lesen.png'$q$),
  '1', 'Der Admin sieht den fremden Screenshot — er muss ihn zum Feedback anschauen koennen');

-- DIE KLAMMER-ZUSAGE. Wer `is_activated() and (bucket und eigentuemer or
-- admin)` schreibt statt `is_activated() and bucket and (eigentuemer or
-- admin)`, gibt dem Admin JEDEN Bucket dieser Instanz frei. Der Katalogtest
-- oben bliebe dabei gruen; diese Zeile faellt.
select is(
  pg_temp.als('fc000000-0000-0000-0000-00000000000c',
    $q$select count(*)::text from storage.objects
        where bucket_id = 'avatars'
          and name = 'fc000000-0000-0000-0000-00000000000a/koeder.webp'$q$),
  '0', 'Die Admin-Ausnahme endet am Bucket — in avatars sieht auch der Admin nichts');

-- Nachlese als Eigentuemer der Tabelle (RLS gilt dort nicht). Ohne sie waere
-- die 0 darueber auch dann gruen, wenn das Koeder-Objekt gar nicht existierte.
select is(
  (select count(*)::int from storage.objects
    where bucket_id = 'avatars'
      and name = 'fc000000-0000-0000-0000-00000000000a/koeder.webp'),
  1, '… und das Koeder-Objekt liegt wirklich dort, die 0 daneben ist kein Messfehler');

-- ── 4. Loeschen — getrennt vom Lesen gemessen (Aufgabe 2.7) ────────────────
-- Getrennt, weil ein Lauf, der beides zusammen prueft, gruen bleiben kann,
-- waehrend eines von beiden zu weit greift.
--
-- Ein DELETE, dessen Zeile die USING-Klausel wegfiltert, wirft NICHT — es
-- trifft null Zeilen. Der Beleg ist deshalb die gezaehlte Zeilenzahl, nie der
-- Rueckgabewert.
select is(
  pg_temp.als('fc000000-0000-0000-0000-00000000000b',
    $q$with geloescht as (
         delete from storage.objects
          where bucket_id = 'feedback-screenshots'
            and name = 'fc000000-0000-0000-0000-00000000000a/loeschen-fremd.png'
          returning 1)
       select count(*)::text from geloescht$q$),
  '0', 'Ein drittes Mitglied loescht den fremden Screenshot nicht');

select is(
  (select count(*)::int from storage.objects
    where name = 'fc000000-0000-0000-0000-00000000000a/loeschen-fremd.png'),
  1, '… und die Nachlese zeigt: das Objekt liegt noch da');

select is(
  pg_temp.als('fc000000-0000-0000-0000-00000000000a',
    $q$with geloescht as (
         delete from storage.objects
          where bucket_id = 'feedback-screenshots'
            and name = 'fc000000-0000-0000-0000-00000000000a/loeschen-eigen.png'
          returning 1)
       select count(*)::text from geloescht$q$),
  '1', 'Der Verfasser loescht seinen eigenen Screenshot');

select is(
  pg_temp.als('fc000000-0000-0000-0000-00000000000c',
    $q$with geloescht as (
         delete from storage.objects
          where bucket_id = 'feedback-screenshots'
            and name = 'fc000000-0000-0000-0000-00000000000a/loeschen-admin.png'
          returning 1)
       select count(*)::text from geloescht$q$),
  '1', 'Der Admin loescht auch einen fremden Screenshot — so entschieden am 01.09.');

-- ── 5. Der deaktivierte Admin (Aufgabe 2.8) ────────────────────────────────
-- ══ HIER STIMMTE DIE BEGRUENDUNG IM MIGRATIONSKOPF NICHT ═══════════════════
-- Der Entwurf sagte, `is_activated()` in Lese- und Loesch-Policy fange den
-- deaktivierten Admin ab. GEMESSEN am 02.09.: das tut es nicht, weil es nichts
-- mehr abzufangen gibt. `is_admin()` traegt seit AGE-581
-- (20260823120000_member_lifecycle_schema) die GANZE Zugangsbedingung selbst —
-- aktiviert UND nicht deaktiviert UND nicht geloescht. Der Admin-Zweig des
-- ODER ist damit schon geschlossen, bevor `is_activated()` gefragt wird.
--
-- Was `is_activated()` in dieser Policy wirklich traegt, ist der ANDERE Zweig:
-- der deaktivierte EIGENTUEMER. Der steht in Abschnitt 5b, und die Gegenprobe
-- vom 02.09. laesst genau ihn fallen, wenn man die Bedingung herausnimmt.
--
-- Die erste Zusage unten ist die Positivkontrolle: die Staff-Zeile LIEGT. Ohne
-- sie waeren die Zusagen darunter auch dann gruen, wenn das Konto gar nie
-- Admin gewesen waere — dann maessen sie nichts.
select is(
  (select count(*)::int from public.staff_roles
    where profile_id = 'fc000000-0000-0000-0000-00000000000d' and role = 'admin'),
  1, 'Das deaktivierte Konto traegt die Admin-Zeile in staff_roles wirklich');

select is(
  pg_temp.als('fc000000-0000-0000-0000-00000000000d', 'select public.is_admin()::text'),
  'false',
  '… und ist trotzdem kein is_admin() — die Rolle ueberlebt den Zugangsentzug nicht (AGE-581)');

select is(
  pg_temp.als('fc000000-0000-0000-0000-00000000000d',
    $q$select count(*)::text from storage.objects
        where bucket_id = 'feedback-screenshots'
          and name = 'fc000000-0000-0000-0000-00000000000a/lesen.png'$q$),
  '0', '… und sieht den fremden Screenshot trotzdem nicht');

select is(
  pg_temp.als('fc000000-0000-0000-0000-00000000000d',
    $q$with geloescht as (
         delete from storage.objects
          where bucket_id = 'feedback-screenshots'
            and name = 'fc000000-0000-0000-0000-00000000000a/loeschen-deaktiviert.png'
          returning 1)
       select count(*)::text from geloescht$q$),
  '0', '… und loescht ihn auch nicht');

select is(
  (select count(*)::int from storage.objects
    where name = 'fc000000-0000-0000-0000-00000000000a/loeschen-deaktiviert.png'),
  1, '… Nachlese: das Objekt liegt noch da');

-- ── 5b. Der deaktivierte EIGENTUEMER — der Fall, den `is_activated()` traegt ─
-- Diese drei Zusagen sind die einzige Abdeckung der Bedingung `is_activated()`
-- in den beiden Policies aus 2.4. Der Admin-Zweig braucht sie nicht (siehe
-- Abschnitt 5), der Eigentuemer-Zweig sehr wohl: ohne sie kaeme ein
-- gesperrtes oder geloeschtes Konto mit gueltigem Token weiter an seine
-- eigenen Screenshots — lesen UND loeschen.
select is(
  pg_temp.als('fc000000-0000-0000-0000-00000000000e',
    $q$select count(*)::text from storage.objects
        where bucket_id = 'feedback-screenshots'
          and name = 'fc000000-0000-0000-0000-00000000000e/eigen-deaktiviert.png'$q$),
  '0', 'Ein deaktivierter Eigentuemer sieht nicht einmal seinen EIGENEN Screenshot');

select is(
  pg_temp.als('fc000000-0000-0000-0000-00000000000e',
    $q$with geloescht as (
         delete from storage.objects
          where bucket_id = 'feedback-screenshots'
            and name = 'fc000000-0000-0000-0000-00000000000e/eigen-deaktiviert.png'
          returning 1)
       select count(*)::text from geloescht$q$),
  '0', '… und loescht ihn auch nicht');

select is(
  (select count(*)::int from storage.objects
    where name = 'fc000000-0000-0000-0000-00000000000e/eigen-deaktiviert.png'),
  1, '… Nachlese: das Objekt liegt noch da');

-- ── 6. Die Bindung der Zeile an ihr Objekt (Aufgaben 2.5 und 2.9) ──────────
-- Ohne sie zeigt eine Feedback-Zeile auf ein FREMDES Objekt, und die
-- Admin-Flaeche signiert oder loescht danach das falsche Bild. Zwei
-- verschiedene Fehler, deshalb zwei getrennte Zusagen — und jede an ihrem
-- eigenen Namen verankert, nicht an einem blossen „es hat gekracht".
select alike(
  pg_temp.als('fc000000-0000-0000-0000-00000000000a',
    $q$with neu as (
         insert into public.feedback (profile_id, rating, likes, screenshot_path)
         values ('fc000000-0000-0000-0000-00000000000a', 4, 'fremder Pfad',
                 'fc000000-0000-0000-0000-00000000000b/lesen-b.png')
         returning screenshot_path)
       select screenshot_path from neu$q$),
  'FEHLER:%feedback_screenshot_path_praefix%',
  'Ein Mitglied kann seine Zeile nicht auf ein fremdes Praefix zeigen lassen');

select is(
  pg_temp.als('fc000000-0000-0000-0000-00000000000a',
    $q$with neu as (
         insert into public.feedback (profile_id, rating, likes, screenshot_path)
         values ('fc000000-0000-0000-0000-00000000000a', 4, 'eigener Pfad',
                 'fc000000-0000-0000-0000-00000000000a/lesen.png')
         returning screenshot_path)
       select screenshot_path from neu$q$),
  'fc000000-0000-0000-0000-00000000000a/lesen.png',
  'Positivkontrolle: das EIGENE Praefix geht durch — sonst belegt die Zeile darueber nichts');

select alike(
  pg_temp.als('fc000000-0000-0000-0000-00000000000a',
    $q$with neu as (
         insert into public.feedback (profile_id, rating, likes, screenshot_path)
         values ('fc000000-0000-0000-0000-00000000000a', 4, 'derselbe Pfad nochmal',
                 'fc000000-0000-0000-0000-00000000000a/lesen.png')
         returning screenshot_path)
       select screenshot_path from neu$q$),
  'FEHLER:%feedback_screenshot_path_uniq%',
  'Ein Objekt gehoert hoechstens EINER Zeile — sonst loescht das Aufraeumen ein noch benutztes Bild');

-- Der Index ist PARTIELL. Ohne das `where screenshot_path is not null` liesse
-- er nur eine einzige Zeile ohne Screenshot zu — und ein Screenshot ist
-- optional.
select is(
  pg_temp.als('fc000000-0000-0000-0000-00000000000a',
    $q$with neu as (
         insert into public.feedback (profile_id, rating, likes)
         values ('fc000000-0000-0000-0000-00000000000a', 4, 'ohne Bild, erstes'),
                ('fc000000-0000-0000-0000-00000000000a', 4, 'ohne Bild, zweites')
         returning 1)
       select count(*)::text from neu$q$),
  '2', 'Beliebig viele Zeilen duerfen OHNE Screenshot bestehen — der Index ist partiell');


-- ── 7. Der Loesch-Weg fuers Bild (Aufgaben 5.1–5.3) ────────────────────────
-- ══ WAS DIESER WEG TUT — UND WAS BEWUSST DER AUFRUFER TUT ══════════════════
-- Er nimmt die FEEDBACK-KENNUNG entgegen, nie einen Pfad. Ein Pfad vom
-- Aufrufer waere derselbe _confused deputy_, gegen den der CHECK in Abschnitt 6
-- steht: der Admin duerfte damit jedes Objekt im Bucket nennen.
--
-- Er leert den Verweis und gibt den Pfad ZURUECK. Das OBJEKT entfernt der
-- Aufrufer danach ueber die Storage-API — genau dafuer traegt er die
-- DELETE-Policy aus 2.4, und genau in dieser Reihenfolge macht es
-- `removePostMedia` in `src/lib/feed.ts` seit AGE-582:
--
--   „Reihenfolge mit Absicht: erst die Zeile, dann das Objekt. Andersherum
--    bliebe bei einem Abbruch dazwischen eine Zeile stehen, die auf ein Bild
--    zeigt, das es nicht mehr gibt — und die Kachel bliebe fuer immer leer.
--    So herum ist der schlimmste Ausgang ein verwaistes Objekt, das niemand
--    sieht."
--
-- Ein `delete from storage.objects` im Rumpf waere die scheinbar kuerzere
-- Fassung und die falsche: `storage.objects` ist die Metazeile, die BYTES
-- liegen im Speicher-Backend. Die Zeile wegzuloeschen liesse die Datei fuer
-- immer liegen — deshalb steht davor der Trigger `storage.protect_delete()`,
-- und ihn zu uebergehen hiesse, seine Begruendung zu ignorieren.

-- Fixture: zwei Zeilen mit Bild, je eine pro Verfasser. Die zweite ist die
-- Gegenprobe — nur die GENANNTE Zeile darf sich aendern.
insert into storage.objects (bucket_id, name) values
  ('feedback-screenshots', 'fc000000-0000-0000-0000-00000000000a/loeschen-bild.png'),
  ('feedback-screenshots', 'fc000000-0000-0000-0000-00000000000b/bleibt.png');

insert into public.feedback (id, profile_id, rating, likes, screenshot_path) values
  ('fc111111-0000-4000-8000-000000000001', 'fc000000-0000-0000-0000-00000000000a',
   2, 'mit Bild', 'fc000000-0000-0000-0000-00000000000a/loeschen-bild.png'),
  ('fc111111-0000-4000-8000-000000000002', 'fc000000-0000-0000-0000-00000000000b',
   2, 'auch mit Bild', 'fc000000-0000-0000-0000-00000000000b/bleibt.png');

-- 7.1 Der Weg gibt den Pfad zurueck. Ohne ihn wuesste der Aufrufer nicht,
-- welches Objekt er zu entfernen hat — und muesste ihn sich selbst
-- zusammensuchen, womit der Pfad wieder aus dem Client kaeme.
select is(
  pg_temp.als('fc000000-0000-0000-0000-00000000000c',
    $q$select public.admin_feedback_bild_loeschen(
         'fc111111-0000-4000-8000-000000000001')$q$),
  'fc000000-0000-0000-0000-00000000000a/loeschen-bild.png',
  'Der Loesch-Weg gibt den Pfad zurueck, damit der Aufrufer das Objekt entfernen kann');

-- 7.2 Und der Verweis an der Zeile ist danach leer.
select is(
  (select coalesce(screenshot_path, 'LEER') from public.feedback
    where id = 'fc111111-0000-4000-8000-000000000001'),
  'LEER', '… und der Verweis an der Feedback-Zeile ist geleert');

-- 7.3 Die Nachbarzeile ist unberuehrt. Ohne diese Zusage bliebe offen, ob der
-- Weg genau EINE Zeile anfasst oder die Spalte tabellenweit leert.
select is(
  (select coalesce(screenshot_path, 'LEER') from public.feedback
    where id = 'fc111111-0000-4000-8000-000000000002'),
  'fc000000-0000-0000-0000-00000000000b/bleibt.png',
  '… waehrend die Zeile eines anderen Verfassers ihren Verweis behaelt');

-- 7.4 Idempotent. Ein zweiter Aufruf auf derselben Zeile darf nicht brechen —
-- die Oberflaeche kann denselben Knopf zweimal treffen.
select is(
  pg_temp.als('fc000000-0000-0000-0000-00000000000c',
    $q$select coalesce(public.admin_feedback_bild_loeschen(
         'fc111111-0000-4000-8000-000000000001'), 'NICHTS')$q$),
  'NICHTS', 'Ein zweiter Aufruf auf derselben Zeile liefert nichts und wirft nicht');

-- 7.5 Ein Nicht-Admin kommt nicht durch — und zwar mit einem Fehler, nicht mit
-- einem stillen Nichts. Ein stilles Nichts saehe fuer die Oberflaeche aus wie
-- „war schon geloescht".
select alike(
  pg_temp.als('fc000000-0000-0000-0000-00000000000b',
    $q$select public.admin_feedback_bild_loeschen(
         'fc111111-0000-4000-8000-000000000002')$q$),
  'FEHLER:%forbidden%',
  'Ein gewoehnliches Mitglied kommt ueber den Loesch-Weg nicht durch');

-- 7.6 Nachlese dazu. Ohne sie belegte die Zeile darueber nur, dass es einen
-- Fehler gab — nicht, dass nichts geschehen ist.
select is(
  (select coalesce(screenshot_path, 'LEER') from public.feedback
    where id = 'fc111111-0000-4000-8000-000000000002'),
  'fc000000-0000-0000-0000-00000000000b/bleibt.png',
  '… und die Zeile, die es anfassen wollte, traegt ihren Verweis unveraendert');

-- 7.7 Eine unbekannte Kennung ist ein Fehler und kein Nichts. Sonst meldete
-- die Oberflaeche „erledigt", wo sie nichts getroffen hat.
select alike(
  pg_temp.als('fc000000-0000-0000-0000-00000000000c',
    $q$select public.admin_feedback_bild_loeschen(
         'fc111111-0000-4000-8000-0000000000ff')$q$),
  'FEHLER:%unbekannte Feedback-Kennung%',
  'Eine unbekannte Feedback-Kennung bricht ab statt still nichts zu tun');

select * from finish();
rollback;
