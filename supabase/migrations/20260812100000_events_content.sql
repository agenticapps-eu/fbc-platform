-- Event-Inhalte: vier Spalten, ein Pflichttermin, eine Pfadbindung (AGE-531, C8).
-- Donald, 2026-08-12. Spec: openspec/changes/events-content/.
--
-- Die Event-MECHANIK ist fertig und wird hier nicht angefasst — Anmeldung,
-- Warteliste, Kapazität, Check-in, Bewertung. Was fehlte, ist der INHALT: ein
-- Event trug Titel, Typ, einen Startzeitpunkt, einen Ort und sonst nichts.
--
-- ── `cover_path`, nicht `cover_url` ───────────────────────────────────────
-- AGE-531 nennt die Spalte `cover_url`. Sie heißt hier anders, und das ist
-- keine Kosmetik. Das Titelbild liegt in einem PRIVATEN Bucket (Begründung in
-- 20260812100200_event_covers_storage.sql, übernommen von C7), und aus einem
-- privaten Bucket gibt es keine dauerhafte URL — nur einen Pfad plus eine
-- Signatur mit einer Stunde Gültigkeit. Eine Spalte namens `cover_url`, die
-- einen Pfad hält, wäre eine falsche Auskunft an jeden künftigen Leser, zumal
-- `profiles.cover_url` (C6, öffentlicher Bucket `covers`) danebensteht und
-- dort wirklich eine URL ist.
--
-- ── `unique (cover_path)` ist keine Kosmetik ──────────────────────────────
-- `event_cover_lesbar()` schlägt das Event über GENAU diese Spalte nach. Zwei
-- Zeilen auf denselben Pfad machten die Antwort mehrdeutig: dasselbe Objekt
-- gehörte dann zu zwei Events mit womöglich verschiedener Sichtbarkeit, und
-- welche gewönne, entschiede die Planwahl. Wörtlich die Begründung von
-- `post_media.storage_path` (20260812090000).
--
-- ── Die Pfadbindung im `with_check` — der Befund aus dem Plan-Review ──────
-- Aus dem Fremd-Review zum Change (REVIEWS.md, codex, SEVERITY HIGH).
--
-- Die INSERT-Policy des Buckets beweist Eigentum nur, während das OBJEKT
-- entsteht (`(storage.foldername(name))[1] = auth.uid()`). Wer danach die
-- SPALTE schreibt, prüfte niemand. Der Weg, den das offenließe: ein Mitglied
-- merkt sich den `cover_path` eines fremden `members`-Events, wartet, bis
-- dessen Host das Bild ersetzt — die Spalte zeigt woandershin, das Objekt
-- bleibt liegen —, und hängt den verwaisten Pfad an sein eigenes
-- `public`-Event. Danach signiert `anon` ein Bild, das nie öffentlich war.
-- `unique (cover_path)` hält das nur auf, solange die alte Zeile darauf zeigt.
--
-- Das ist derselbe Angriff, den C7 in `create_post_with_media` abwehrt
-- (20260812090000_post_media.sql:214–240). Dort fiel er im Diff-Review auf,
-- hier im Plan-Review — also bevor es Code gab, was billiger ist.
--
-- Geschlossen wird er an ZWEI Stellen, weil eine davon nur neue Zeilen
-- erwischt: hier beim Schreiben, und in `event_cover_lesbar()` beim Lesen.
-- Die lesende Hälfte deckt auch Zeilen ab, die diese Policy nie gesehen hat.
--
-- `is_activated()` bleibt dabei das ÄUSSERE `and`. Der Plan-Review schlug an
-- anderer Stelle vor, das Gate hinter den Host-Zweig zu ziehen
-- (`(is_activated() and sichtbar) or ist_host`); das ist abgelehnt und in
-- REVIEWS.md begründet — es widerspräche allen drei bestehenden
-- events-Policies und rissse das Gate aus C3 auf.
--
-- ── Was hier NICHT passiert: `events_visibility_check` ────────────────────
-- AGE-531 verlangt, die toten Werte 'prime' und 'legacy' zu entfernen. Sie
-- sind seit dem 15.07. nicht mehr da — 20260715150000_six_level_model.sql:284
-- hat den Bestand umgeschrieben und den Check ersetzt, für `posts` gleich mit.
-- Gemessen am 2026-08-12 in DEV UND PROD: beide tragen bereits
-- `check (visibility in ('public','members'))`.
--
-- Das steht hier, damit der nächste Leser nicht erneut danach sucht: die
-- Aufgabe entfiel, sie wurde nicht vergessen.
--
-- ── `starts_at` auf `not null` ────────────────────────────────────────────
-- Ein Event ohne Datum ist inhaltlich sinnlos und bricht die Sortierung, auf
-- der beide Reiter stehen. Vorher gemessen statt angenommen (Befund codex,
-- MEDIUM): DEV 9 Zeilen / 0 ohne Termin, PROD 0 Zeilen — Ausgabe von
-- scripts/probe-c8-starts-at-preflight.ts, nur lesend.
--
-- Folge im Frontend, benannt: `EventForm` muss den Termin ab jetzt verlangen,
-- sonst scheitert das Anlegen erst am `insert`.
--
-- Forward-only.

alter table public.events
  add column description text,
  add column ends_at     timestamptz,
  add column cover_path  text,
  add column topics      text[];

alter table public.events
  add constraint events_cover_path_key unique (cover_path);

alter table public.events
  alter column starts_at set not null;

alter table public.events
  add constraint events_ends_after_start
  check (ends_at is null or ends_at > starts_at);

comment on column public.events.description is
  'Fließtext zum Event. Optional — ein Mitglied, das abends schnell einen '
  'Termin einstellt, soll nicht durch zwölf Pflichtfelder (AGE-531).';

comment on column public.events.ends_at is
  'Ende des Events, optional. `events_ends_after_start` erzwingt, dass es nach '
  'dem Beginn liegt; ein offenes Ende bleibt erlaubt.';

comment on column public.events.cover_path is
  'PFAD in den privaten Bucket `event-covers`, keine URL — aus einem privaten '
  'Bucket gibt es nur Pfad plus zeitlich begrenzte Signatur. Erstes Segment ist '
  'die uid des Hosts; das erzwingen `events_write_host` (schreibend) und '
  '`event_cover_lesbar()` (lesend).';

comment on column public.events.topics is
  'Programmpunkte DIESES Events als freier Text, im Mockup eine Häkchenliste. '
  'Bewusst OHNE Bezug zu `public.tags`: die 15 kuratierten Tags sind eine '
  'redaktionelle Liste für den Feed und beschreiben keine Tagesordnung.';

-- Die Policy wird ersetzt, nicht ergänzt — `using` bleibt Wort für Wort, das
-- `with_check` bekommt die Pfadbindung. Beides trägt weiterhin `is_activated()`
-- als äußeres `and`.
drop policy if exists events_write_host on public.events;
create policy events_write_host on public.events
  for all to authenticated
  using (
    public.is_activated()
    and host_id = (select auth.uid())
  )
  with check (
    public.is_activated()
    and host_id = (select auth.uid())
    and (
      cover_path is null
      or split_part(cover_path, '/', 1) = (select auth.uid())::text
    )
  );

comment on policy events_write_host on public.events is
  'Der Host schreibt sein Event, sofern sein Zugang bestätigt ist. Zusätzlich '
  'seit AGE-531: `cover_path` muss im eigenen `{uid}/`-Präfix liegen. Ohne '
  'diese Klausel ließe sich der verwaiste Pfad eines fremden members-Events an '
  'ein eigenes public-Event hängen und danach von anon signieren — derselbe '
  'Angriff, den create_post_with_media() abwehrt.';
