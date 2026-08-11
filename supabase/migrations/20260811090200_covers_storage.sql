-- Storage für Hintergrundbilder: Bucket `covers` + drei Policies (AGE-498, C6).
-- Donald, 2026-08-11. Spec: openspec/changes/profile-cover-and-admin-edit/.
-- Vorlage: 20260613081627_profile_editor_storage.sql (avatars), Gate-Fassung
-- aus 20260806080100_activation_gate.sql:453.
--
-- ── Eigener Bucket statt Präfix im avatars-Bucket ──────────────────────────
-- Ein `{uid}/cover-*.webp` im bestehenden Bucket wäre billiger: die drei
-- avatars-Policies erlauben es bereits, es bräuchte NULL neue Policies.
--
-- VERWORFEN, weil die Trennung dann nur eine Namenskonvention wäre, die
-- niemand durchsetzt. Der Bucket ist die einzige Stelle, an der sich
-- `file_size_limit` und `allowed_mime_types` SERVERSEITIG aussprechen lassen.
-- Heute liegt die Größenbegrenzung ausschließlich im Client (AvatarCropper
-- exportiert webp), und ein handgebauter Upload umgeht sie. Das
-- Hintergrundbild ist zudem die größere Datei — 1500×500 statt 512×512.
--
-- 2 MiB: ein 1500×500-WebP bei Qualität 0,85 liegt bei 80–250 kB. Die Grenze
-- lässt jedes reale Bild durch und schneidet den Fall ab, in dem jemand ein
-- 40-MB-TIFF durchreicht.
--
-- `on conflict (id) do update` und NICHT `do nothing`: ein bereits bestehender
-- `covers`-Bucket mit falschen Einstellungen würde sonst konserviert, und der
-- Test liefe grün gegen eine falsche Konfiguration. Aus dem Fremd-Review zum
-- Change (REVIEWS.md, codex).
--
-- ── Der Preis des eigenen Buckets, und wie er bezahlt wird ─────────────────
-- Drei neue Policies sind drei neue Stellen, an denen das Aktivierungs-Gate
-- stehen muss — dieselbe Regel liegt danach an SECHS Stellen. Die
-- covers-Policies übernehmen `public.is_activated()` deshalb wörtlich von
-- avatars, und rls_test.sql §17 zählt für BEIDE Buckets, dass je drei
-- Schreib-Policies das Gate tragen. Wer es an einem Bucket ändert, wird am
-- anderen rot.
--
-- ── Keine SELECT-Policy, mit Absicht ───────────────────────────────────────
-- Wie bei avatars (Kopf von 20260613081627): der Bucket ist öffentlich,
-- Objekte rendern über ihre URL. Eine SELECT-Policy erlaubte nur das AUFLISTEN
-- (Supabase-Linter 0025). Wovor das Gate schützt, ist das ERFAHREN der URL —
-- `profiles.cover_url` liegt dahinter.
--
-- Forward-only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 2097152, array['image/webp'])
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Der Editor lädt nach `{uid}/{timestamp}.webp`; der erste Pfadabschnitt muss
-- der auth.uid() des AUFRUFERS entsprechen. Folge, die im Frontend sichtbar
-- wird: ein Admin kann für ein fremdes Profil kein Bild hochladen — die
-- Bild-Steuerung ist im Fremd-Modus deshalb ausgeblendet, statt an der Policy
-- zu scheitern.
create policy covers_insert_own on storage.objects
  for insert to authenticated
  with check (
    public.is_activated()
    and bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy covers_update_own on storage.objects
  for update to authenticated
  using (
    public.is_activated()
    and bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    public.is_activated()
    and bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy covers_delete_own on storage.objects
  for delete to authenticated
  using (
    public.is_activated()
    and bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
