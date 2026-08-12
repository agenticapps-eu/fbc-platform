-- Storage für Event-Titelbilder: privater Bucket `event-covers` + vier Policies
-- (AGE-531, C8). Donald, 2026-08-12. Spec: openspec/changes/events-content/.
--
-- Vorlage ist 20260812090100_post_media_storage.sql (C7), NICHT
-- 20260811090200_covers_storage.sql (C6). Der Unterschied ist der ganze Punkt:
-- `covers` ist ein ÖFFENTLICHER Bucket und hat deshalb bewusst keine
-- SELECT-Policy (eine erlaubte dort nur das Auflisten). Hier trägt genau diese
-- Policy die Zugriffskontrolle.
--
-- ── Ein PRIVATER Bucket, ausgeliefert über signierte URLs ─────────────────
-- Die Frage ist dieselbe wie bei Beitragsbildern: das Titelbild eines
-- `members`-Events darf ohne Session nicht abrufbar sein. Ein öffentlicher
-- Bucket mit schwer erratbaren Pfaden erfüllt das nicht — das ist
-- Verschleierung, keine Zugriffskontrolle.
--
-- Die verworfene Alternative steht ausführlich im Kopf von
-- 20260812090100_post_media_storage.sql und gilt hier unverändert: zwei
-- Buckets nach Sichtbarkeit sparen die Signatur-Maschinerie NICHT ein — ein
-- `<img>` setzt keine Header, also braucht der `members`-Fall sie ohnehin —
-- und bezahlen mit einer nicht-atomaren Bucket-Wanderung bei jedem späteren
-- Sichtbarkeitswechsel. C7 hat das entschieden; C8 entscheidet es nicht neu.
--
-- ── 2 MiB statt 1 MiB ─────────────────────────────────────────────────────
-- `post-media` trägt 1 MiB, weil dort bis zu sechs Bilder an einem Beitrag
-- hängen. Das Titelbild ist ein einzelner Querformat-Header; `covers` (C6)
-- trägt aus demselben Grund 2 MiB. Ein 1500×500-WebP bei Qualität 0,85 liegt
-- bei 80–250 kB — die Grenze lässt jedes reale Bild durch und schneidet den
-- Fall ab, in dem jemand ein 40-MB-TIFF durchreicht.
--
-- ── Die Präfix-Prüfung im Lesepfad — Befund aus dem Plan-Review ───────────
-- Aus dem Fremd-Review (REVIEWS.md, codex, SEVERITY HIGH). Die schreibende
-- Hälfte sitzt in `events_write_host` (20260812100000); ihr Kopf beschreibt
-- den Angriff. Diese hier ist die lesende, und sie ist die wichtigere: sie
-- deckt auch Zeilen ab, die die Policy nie gesehen hat — Bestand, ein späterer
-- Admin-Weg, ein `service_role`-Schreibzugriff.
--
-- Die Regel in einem Satz: das erste Pfadsegment MUSS die `host_id` des
-- Events sein, dessen `cover_path` auf das Objekt zeigt.
--
-- Das ist kein Widerspruch zu `post_media_lesbar`, die den Pfad ausdrücklich
-- nie zerlegt: dort würde aus dem Pfad eine SICHTBARKEIT abgeleitet, und die
-- gehört der Zeile, nicht der Zeichenkette. Hier wird aus dem Pfad kein Recht
-- abgeleitet — er wird gegen die Zeile GEPRÜFT.
--
-- ── `revoke … from public` ────────────────────────────────────────────────
-- Eine Funktion ist per Voreinstellung für `PUBLIC` ausführbar. Ohne diese
-- Zeile wäre die Migration eine stille Rechteausweitung (Befund codex, LOW;
-- `post_media_lesbar` macht es an :167 genauso). `anon` MUSS sie ausführen
-- dürfen — sonst trägt die SELECT-Policy für den ausgeloggten Besucher nicht,
-- und Titelbilder öffentlicher Events blieben leer.
--
-- ── `on conflict (id) do update`, nicht `do nothing` ──────────────────────
-- Ein bereits bestehender Bucket mit falschen Einstellungen würde sonst
-- konserviert, und rls_test.sql §20.9 liefe grün gegen eine falsche
-- Konfiguration. Befund aus dem C6-Review, hier übernommen.
--
-- Forward-only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-covers', 'event-covers', false, 2097152, array['image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.event_cover_lesbar(objektname text) returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
      from public.events e
     where e.cover_path = objektname
       -- Die Pfadbindung: das Objekt gehört dem Host des Events, sonst nicht.
       -- Ohne diese Zeile ließe sich ein verwaister fremder Pfad an ein
       -- eigenes public-Event hängen und danach von anon signieren.
       and (storage.foldername(objektname))[1] = e.host_id::text
       and case
             -- Ohne Session: nur öffentliche Events. Spiegelt
             -- events_select_public_anon (20260612082726).
             when (select auth.uid()) is null then e.visibility = 'public'
             -- Mit Session: spiegelt events_select_by_visibility
             -- (20260806080100), Aktivierungs-Gate als äußeres and inbegriffen.
             else public.is_activated()
                  and ( e.visibility in ('public', 'members')
                        or e.host_id = (select auth.uid()) )
           end
  );
$$;

comment on function public.event_cover_lesbar(text) is
  'Entscheidet, wer sich für ein Objekt in `event-covers` eine Signatur '
  'ausstellen lassen darf. Schlägt das Event über `events.cover_path` nach und '
  'spiegelt dessen Leserechte. Verlangt zusätzlich, dass das erste Pfadsegment '
  'die host_id des Events ist — das ist die lesende Hälfte der Pfadbindung aus '
  'events_write_host und deckt auch Zeilen ab, die jene Policy nie gesehen hat. '
  'Ein Objekt ohne passende Event-Zeile ist für niemanden lesbar.';

revoke execute on function public.event_cover_lesbar(text) from public;
grant  execute on function public.event_cover_lesbar(text) to anon, authenticated;

-- Lesen: für BEIDE Rollen dieselbe Funktion. Der ausgeloggte Besucher ist kein
-- Sonderfall — die Eventseiten sind ohne Session erreichbar, und ein
-- öffentliches Event soll sein Titelbild auch dort zeigen.
create policy event_cover_select on storage.objects
  for select to anon, authenticated
  using ( bucket_id = 'event-covers' and public.event_cover_lesbar(name) );

-- Schreiben: eigenes Präfix, bestätigter Zugang. Wörtlich das Gate von
-- `avatars`, `covers` und `post-media`; rls_test.sql zählt für jeden Bucket in
-- seinem eigenen Abschnitt, dass je drei Schreib-Policies es tragen.
create policy event_cover_insert_own on storage.objects
  for insert to authenticated
  with check (
    public.is_activated()
    and bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy event_cover_update_own on storage.objects
  for update to authenticated
  using (
    public.is_activated()
    and bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    public.is_activated()
    and bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy event_cover_delete_own on storage.objects
  for delete to authenticated
  using (
    public.is_activated()
    and bucket_id = 'event-covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
