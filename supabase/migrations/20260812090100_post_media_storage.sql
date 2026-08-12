-- Storage für Beitragsbilder: privater Bucket `post-media` + vier Policies
-- (AGE-528, C7). Donald, 2026-08-12.
-- Spec: openspec/changes/activity-media-and-tags/design.md.
-- Vorlage: 20260811090200_covers_storage.sql (C6) — dort steht, warum Größe und
-- Typ am Bucket stehen und nicht im Formular. `avatars` trägt beide Grenzen
-- NICHT und ist als Vorlage untauglich, auch wenn AGE-528 es so nahelegt.
-- Braucht `public.post_media_lesbar()` aus 20260812090000_post_media.sql.
--
-- ── Ein PRIVATER Bucket, ausgeliefert über signierte URLs ──────────────────
-- VERWORFEN: zwei Buckets, beim Upload nach `posts.visibility` gewählt —
-- öffentlich für `public`, privat für `members`.
--
-- Der Satz, der die Entscheidung trägt: ZWEI BUCKETS SPAREN DIE
-- SIGNATUR-MASCHINERIE NICHT EIN. Ein privater Bucket lässt sich nicht per
-- `<img src>` mit einem Authorization-Header lesen — ein img-Tag setzt keine
-- Header. Der einzige Weg aus einem privaten Bucket in ein `<img>` ist die
-- signierte URL, und für `members`-Beiträge braucht man sie ohnehin, also für
-- den Normalfall dieser Plattform. Eingespart würde sie allein für die
-- Minderheit der öffentlichen Beiträge.
--
-- Bezahlt würde das mit einer Sichtbarkeit, die beim Upload zementiert ist:
-- `members` → `public` hieße kopieren, `post_media.storage_path` umschreiben,
-- altes Objekt löschen, `visibility` setzen. Vier Schritte über zwei Systeme,
-- vom Client aus, NICHT atomar. Ein Abbruch nach Schritt 1 legt die Bilder
-- eines `members`-Beitrags in den öffentlichen Bucket — genau das Leck, gegen
-- das dieser Change existiert. Dazu stünde die Sichtbarkeitsregel an einer
-- zweiten Stelle (RLS von `posts` UND Bucket-Wahl beim Upload); diese Krankheit
-- trägt das Repo bei `profiles_public` bereits.
--
-- ── 1 h Gültigkeit der Signaturen, und was daran hängt ─────────────────────
-- Der Client signiert mit `expiresIn = 3600` (src/lib/post-media.ts) und hält
-- die URLs 50 min in react-query. Diese Zahl ist eine ENTSCHEIDUNG, keine
-- Nebenwirkung, denn sie ist zugleich die Nachlaufzeit eines
-- Sichtbarkeitswechsels: eine ausgegebene Signatur gilt bis zum Ablauf weiter,
-- auch wenn der Beitrag inzwischen auf `members` steht. Wer einen Beitrag von
-- öffentlich auf „nur Mitglieder" umstellt, verbirgt den BEITRAG sofort, das
-- BILD bei jemandem mit offener Seite aber bis zu eine Stunde später. Kürzer
-- senkt die Nachlaufzeit und kostet Cache; wer die Zahl ändert, ändert beides.
--
-- ── Diesmal MIT SELECT-Policy — anders als avatars und covers ──────────────
-- Bei den beiden öffentlichen Buckets ist eine SELECT-Policy sinnlos (sie
-- erlaubte nur das Auflisten). Hier ist sie der ganze Schutz: das Ausstellen
-- einer Signatur IST ein SELECT auf storage.objects unter der Rolle des
-- Aufrufers. Gemessen vor dieser Migration, sechs Fälle, durch die echte
-- Storage-API: scripts/probe-post-media-signatur.ts, Ausgabe in EVIDENCE.md.
--
-- `on conflict (id) do update` und NICHT `do nothing`: ein bestehender Bucket
-- mit falschen Einstellungen würde sonst konserviert und rls_test.sql §19.5
-- liefe grün gegen eine falsche Konfiguration (Befund aus dem C6-Review).
--
-- Forward-only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', false, 1048576, array['image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lesen: für BEIDE Rollen dieselbe Funktion. Der ausgeloggte Besucher ist kein
-- Sonderfall, sondern der Anlass — `/aktivitaet` ist ohne Session erreichbar
-- (src/config/nav.ts:75 trägt weder requiresAuth noch minTier).
create policy post_media_select on storage.objects
  for select to anon, authenticated
  using ( bucket_id = 'post-media' and public.post_media_lesbar(name) );

-- Schreiben: eigenes Präfix, bestätigter Zugang. Wörtlich das Gate von
-- `avatars` und `covers`; rls_test.sql zählt für alle drei Buckets, dass je
-- drei Schreib-Policies es tragen.
create policy post_media_insert_own on storage.objects
  for insert to authenticated
  with check (
    public.is_activated()
    and bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy post_media_update_own on storage.objects
  for update to authenticated
  using (
    public.is_activated()
    and bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    public.is_activated()
    and bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy post_media_delete_own on storage.objects
  for delete to authenticated
  using (
    public.is_activated()
    and bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
