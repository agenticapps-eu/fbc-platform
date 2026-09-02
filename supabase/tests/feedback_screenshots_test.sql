-- Der Screenshot am Feedback: Bucket und Policies (AGE-628).
-- Change: openspec/changes/feedback-ausbauen/, Einheit 2, Aufgaben 2.1–2.5.
--
-- Echtes pgTAP mit plan()/finish(). Diese Datei ist in ci.yml eingetragen —
-- ohne diesen Eintrag liefe sie nie.
--
-- ══ DIESE DATEI PRUEFT DEN KATALOG, NICHT DAS VERHALTEN ════════════════════
-- Aufgabe 2.1 sagt zu, DASS es den Bucket und seine vier Policies gibt, und
-- dass der Bucket die richtigen Grenzen traegt. Ob die Policies das RICHTIGE
-- erlauben, sagen die Aufgaben 2.6–2.9 zu, und die fassen echte Zeilen an.
-- Beides getrennt zu halten ist Absicht: ein Katalogtest kann gruen sein,
-- waehrend die Bedingung falsch herum steht.
--
-- ══ WARUM DIE GRENZEN AM BUCKET STEHEN UND NICHT IM FORMULAR ═══════════════
-- Das Formular prueft dieselben Grenzen (Aufgabe 7.2), aber die GRENZE ist der
-- Bucket: das Formular ist Komfort, die Storage-API ist die Sicherheitsgrenze.
-- `avatars` traegt beide Grenzen nicht und ist als Vorlage untauglich; Vorlage
-- ist `post-media` (20260812090100).
--
-- ══ FALLEN FUER SPAETER (2.6–2.9), HIER SCHON NOTIERT ══════════════════════
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
select plan(8);

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

select * from finish();
rollback;
