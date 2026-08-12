-- Kuratierte Tags: `public.tags` mit Startbefüllung (AGE-528, C7).
-- Donald, 2026-08-12. Spec: openspec/changes/activity-media-and-tags/design.md.
--
-- ── Keine Verknüpfungstabelle zwischen `posts` und `tags` ──────────────────
-- VERWORFEN: `post_tags (post_id, tag_key)`. Sie wäre das saubere
-- Beziehungsmodell — und sie ist hier keins, weil `tags` kein Beziehungsmodell
-- ist, sondern eine REDAKTIONELLE LISTE. `posts.hashtags text[]` bleibt
-- unangetastet und hält beide Sorten; ein Chip gilt als kuratiert, wenn sein
-- Wert hier als `key` vorkommt.
--
-- Der Grund ist nicht Bequemlichkeit: die bestehende Filterung
-- `.contains("hashtags", [tag])` (src/lib/feed.ts) arbeitet unverändert weiter.
-- KORREKTUR vom 2026-08-12: hier stand „und ihr GIN-Index", und den gab es
-- nicht — die Filterung lief seit AGE-250 als Seq-Scan. Gemessen und angelegt
-- in 20260812090300_posts_indizes.sql. Eine Verknüpfungstabelle hieße, denselben Filter
-- neu zu bauen, alle Bestandsbeiträge umzuschreiben und dabei die freien Tags
-- entweder zu verlieren oder doppelt zu führen. Diese Migration ist so ein
-- Insert statt einer Umstrukturierung.
--
-- Der Preis, benannt: ein umbenannter oder deaktivierter kuratierter Tag wirkt
-- NICHT rückwirkend. Bestandsbeiträge tragen weiter ihre Zeichenkette und
-- zeigen sie danach als freien Tag. Für eine Liste, die sich selten ändert, ist
-- das der richtige Tausch.
--
-- ── Die Form des Schlüssels — die Falle, die diesen Weg sonst zerlegt ──────
-- Weil es keine Verknüpfungstabelle gibt, IST der Wert selbst die Verbindung.
-- Damit hängt alles daran, dass derselbe Tag EINE Zeichenkette ergibt, egal ob
-- er im Composer angeklickt oder als `#Wort` in den Text getippt wurde.
-- Getippt normalisiert ihn `parseHashtags` mit `toLowerCase()` (feed.ts:70) —
-- mehr nicht. Umlaute bleiben also stehen: `#Persönlichkeitsentwicklung` wird
-- zu `persönlichkeitsentwicklung`, mit `ö`. Ein Schlüssel
-- `persoenlichkeitsentwicklung` träfe nie, der Chip erschiene als freier Tag,
-- und der Filter zerfiele STILL in zwei Töpfe — ohne Fehlermeldung, in beiden
-- Richtungen halb funktionierend.
--
-- Daher die zwei Constraints. Regel in einem Satz: `key` = `lower(label)`, und
-- `label` ist ein einzelnes Wort ohne Bindestrich.
--
-- ZEICHENKLASSE, KORRIGIERT GEGENÜBER design.md: dort steht
-- `key ~ '^[\p{L}\p{N}_]+$'`, abgeschrieben von `TOKEN_RE` aus dem Frontend.
-- Postgres kennt `\p{L}` nicht — es bricht mit „invalid regular expression:
-- invalid escape \ sequence" ab, die Migration liefe gar nicht erst durch.
-- Gemessen am 2026-08-12 gegen den lokalen Stack (PG 17.6, UTF8,
-- en_US.UTF-8). Die POSIX-Klasse `[[:alnum:]]` leistet dasselbe und umfasst in
-- dieser Kodierung Unicode-Buchstaben: `persönlichkeitsentwicklung` geht durch,
-- `know-how` und `zwei wort` nicht. Weil das an der Locale hängt und nicht am
-- SQL-Text, misst rls_test.sql §20 den Umlaut-Fall ausdrücklich mit — auf
-- jeder Datenbank, auf der die Suite läuft.
--
-- ── Redaktionell heißt: niemand am Client schreibt ─────────────────────────
-- SELECT für beide Rollen (die Filterleiste steht auch ohne Session), sonst
-- nichts. Kein INSERT, kein UPDATE, keine Schreib-Policy. Eine Korrektur der
-- Liste ist ein Insert über die Service-Rolle, keine Schemaänderung.
--
-- Forward-only.

create table public.tags (
  key    text primary key,
  label  text    not null,
  sort   int     not null,
  active boolean not null default true,
  constraint tags_key_klein  check (key = lower(key)),
  constraint tags_key_tippbar check (key ~ '^[[:alnum:]_]+$'),
  -- Die dritte Hälfte derselben Regel, ergänzt am 2026-08-12 nach dem
  -- Diff-Review: `key` = `lower(label)`. Die beiden Constraints darüber prüfen
  -- nur den Schlüssel für sich; ein Label „Know-how" mit dem Schlüssel
  -- `knowhow` käme durch — und spaltete den Filter still in zwei Töpfe, weil
  -- `parseHashtags` aus dem Fließtext nie `knowhow` erzeugt. Der Test dazu
  -- prüfte bis dahin nur die 15 Zeilen der Startbefüllung; eine spätere
  -- redaktionelle Ergänzung ist ein Insert und läuft an keiner Suite vorbei.
  constraint tags_key_ist_label check (key = lower(label))
);
alter table public.tags enable row level security;

comment on table public.tags is
  'Kuratierte Themen- und Format-Tags (AGE-528). Redaktionelle Liste, keine '
  'Verknüpfung: ein Chip gilt als kuratiert, wenn sein Wert hier als `key` '
  'vorkommt. `key` muss so aussehen, wie parseHashtags einen getippten Tag '
  'normalisiert — kleingeschrieben, ein Wort, ohne Bindestrich.';

grant select on public.tags to anon, authenticated;

create policy tags_select_all on public.tags
  for select to anon, authenticated
  using ( true );

-- ── Startbefüllung: 15 Tags, aus dem Mockup gelesen ────────────────────────
-- NICHT die Kompass-Kategorien, die AGE-528 vermutet: es sind 14 statt elf
-- (src/config/matching.ts), und es sind MATCHING-Kategorien — „biete Kapital",
-- „suche Mitarbeiter". Als Thema eines Erlebnisberichts tragen sie nicht;
-- `#kapital` unter Wanderfotos ist keine Einordnung. Das Filterfeld im Mockup
-- (docs/mockups/aktivitaet-2026-07-29.png) IST die kuratierte Liste.
--
-- `sort` in Zehnerschritten, damit ein späterer Tag dazwischen passt, ohne dass
-- die ganze Liste neu vergeben wird. Themen unter 200, Formate ab 200.
--
-- BEWUSST NICHT DABEI: `event` und `academy` — beide wären die halbe Vorstufe
-- der Feed-Verzahnung aus C9 und bis dahin eine zweite, von Hand gepflegte
-- Wahrheit darüber, was ein Event-Beitrag ist. Ebenso wenig `allgäu`, `tools`,
-- `produktivität`, `projekt`, `kooperation`, `digitalisierung`: sie stehen im
-- Mockup an Beiträgen, aber nicht in der Filterliste — sie sollen freie Tags
-- bleiben, und genau diesen Unterschied zeichnet der Change (kuratiert gefüllt,
-- frei als Outline).
--
-- Von Donald am 2026-08-11 freigegeben, mit Detlev noch nicht abgestimmt. Eine
-- Korrektur ist ein `insert`/`update`, keine Migration am Schema.

insert into public.tags (key, label, sort) values
  ('unternehmertum',              'Unternehmertum',              10),
  ('investitionen',               'Investitionen',               20),
  ('immobilien',                  'Immobilien',                  30),
  ('marketing',                   'Marketing',                   40),
  ('persönlichkeitsentwicklung',  'Persönlichkeitsentwicklung',  50),
  ('nachhaltigkeit',              'Nachhaltigkeit',              60),
  ('technologie',                 'Technologie',                 70),
  ('gesundheit',                  'Gesundheit',                  80),
  ('leadership',                  'Leadership',                  90),
  ('netzwerken',                  'Netzwerken',                 100),
  ('ki',                          'KI',                         110),
  -- Formate. `vorstellung` ist kein Wunschdenken: zum Go-Live kommen ~70
  -- importierte Konten an, und das ist ihr erster Beitrag.
  ('erlebnistag',                 'Erlebnistag',                200),
  ('rückblick',                   'Rückblick',                  210),
  ('vorstellung',                 'Vorstellung',                220),
  ('frage',                       'Frage',                      230);
