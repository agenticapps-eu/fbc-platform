-- AGE-628 — Screenshot am Feedback: privater Bucket, vier Policies, und die
-- Bindung der Zeile an ihr Objekt.
--
-- Aufgaben 2.2–2.5 aus openspec/changes/feedback-ausbauen/tasks.md. Die
-- scheiternden Zusagen stehen seit 2.1 in
-- supabase/tests/feedback_screenshots_test.sql (8 von 8 rot).
--
-- Vorlage: 20260812090100_post_media_storage.sql. Dort steht ausgeschrieben,
-- warum Groesse und Typ am BUCKET stehen und nicht im Formular, und warum
-- `avatars` als Vorlage untauglich ist (es traegt beide Grenzen nicht).
--
-- ══ `on conflict (id) do update`, NICHT `do nothing` ═══════════════════════
-- Ein bereits vorhandener, aber falsch konfigurierter Bucket bliebe mit
-- `do nothing` konserviert, und die Zusagen 2–4 der Testdatei liefen gruen
-- gegen eine falsche Konfiguration. Derselbe Befund hat schon im C6-Review
-- zugeschlagen.
--
-- ══ DIE SELECT-POLICY IST DER GANZE SCHUTZ ═════════════════════════════════
-- Das Ausstellen einer signierten URL IST ein SELECT auf `storage.objects`
-- unter der Rolle des Aufrufers. Ohne SELECT-Policy koennte niemand ein Bild
-- anzeigen — und mit einer zu weiten koennte es jeder.
--
-- ══ DREI BEDINGUNGEN, NICHT ZWEI ═══════════════════════════════════════════
-- Lesen und Loeschen verlangen `is_activated()` UND den Bucket UND
-- (Eigentuemer ODER Admin). Das `is_activated()` ist der Unterschied zur
-- ersten Entwurfsfassung: ohne es kaeme ein DEAKTIVIERTES Konto mit noch
-- gesetzter Admin-Rolle weiter an fremde Bilder.
--
-- Und die Klammer um `(Eigentuemer oder Admin)` ist tragend. Wer den ganzen
-- Ausdruck klammert — `is_activated() and (bucket and eigentuemer or admin)` —
-- gibt dem Admin jeden Bucket dieser Instanz frei, nicht nur diesen. Dieselbe
-- Klammerfalle steht in Aufgabe 4.5 fuer `messages_insert`.
--
-- ══ DIE BINDUNG (2.5) ══════════════════════════════════════════════════════
-- Ohne sie zeigt eine Feedback-Zeile auf ein FREMDES Objekt, und die
-- Admin-Flaeche signiert oder loescht danach das falsche Bild. Zwei getrennte
-- Zusagen, weil es zwei verschiedene Fehler sind:
--   * Der Pfad muss im Praefix des Verfassers liegen (CHECK).
--   * Ein Objekt gehoert hoechstens EINER Zeile (partieller Unique-Index).
-- Der Index ist partiell, damit beliebig viele Zeilen `null` tragen duerfen —
-- ein Screenshot ist optional.

-- ── 1. Der Bucket (Aufgabe 2.2) ─────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-screenshots', 'feedback-screenshots', false, 5242880,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── 2. Schreiben: eigenes Praefix, aktiviertes Konto (Aufgabe 2.3) ─────────
drop policy if exists feedback_screenshots_insert_own on storage.objects;
create policy feedback_screenshots_insert_own on storage.objects
  for insert to authenticated
  with check (
    public.is_activated()
    and bucket_id = 'feedback-screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists feedback_screenshots_update_own on storage.objects;
create policy feedback_screenshots_update_own on storage.objects
  for update to authenticated
  using (
    public.is_activated()
    and bucket_id = 'feedback-screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    public.is_activated()
    and bucket_id = 'feedback-screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ── 3. Lesen und Loeschen: Eigentuemer ODER Admin (Aufgabe 2.4) ────────────
drop policy if exists feedback_screenshots_select on storage.objects;
create policy feedback_screenshots_select on storage.objects
  for select to authenticated
  using (
    public.is_activated()
    and bucket_id = 'feedback-screenshots'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_admin()
    )
  );

drop policy if exists feedback_screenshots_delete on storage.objects;
create policy feedback_screenshots_delete on storage.objects
  for delete to authenticated
  using (
    public.is_activated()
    and bucket_id = 'feedback-screenshots'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_admin()
    )
  );

-- ── 4. Die Zeile und ihr Objekt (Aufgabe 2.5) ──────────────────────────────
alter table public.feedback
  add column if not exists screenshot_path text;

-- Der Pfad liegt im Praefix des Verfassers. Ein leerer Text faellt hier
-- ebenfalls heraus: split_part('', '/', 1) ist '' und damit nie eine
-- Profil-Kennung.
alter table public.feedback
  drop constraint if exists feedback_screenshot_path_praefix;
alter table public.feedback
  add constraint feedback_screenshot_path_praefix
  check (
    screenshot_path is null
    or split_part(screenshot_path, '/', 1) = profile_id::text
  );

-- Ein Objekt gehoert hoechstens einer Zeile. Partiell, damit `null` beliebig
-- oft vorkommen darf.
drop index if exists public.feedback_screenshot_path_uniq;
create unique index feedback_screenshot_path_uniq
  on public.feedback (screenshot_path)
  where screenshot_path is not null;

comment on column public.feedback.screenshot_path is
  'Pfad des Screenshots im Bucket feedback-screenshots (AGE-628), optional. '
  'Gebunden: muss im Praefix des Verfassers liegen und gehoert hoechstens '
  'einer Zeile — sonst signiert oder loescht die Admin-Flaeche das falsche Bild.';
