/**
 * Demo seed (AGE-254) — builds a presentable Fair-Business-Club demo world.
 *
 *   infisical run --env=dev -- env DEMO_SEED_CONFIRM=fbc-demo tsx supabase/seed/demo_seed.ts
 *
 * NOT REAL DATA. All personas are fictional with non-routable *.demo.fbc.invalid
 * emails. Idempotent: safe to run repeatedly (no duplicates).
 *
 * Guard: dev and prod are the SAME Supabase project (see ADR-0003), so there is
 * no environment to detect — the script instead refuses unless the operator sets
 * DEMO_SEED_CONFIRM=fbc-demo, preventing an accidental run against the live DB.
 *
 * Orchestrates the existing curated SQL (personas, offers/needs, matches,
 * contacts, accepted+pending requests, chat), then adds the feed posts and
 * events those files do not cover. Reset mode (DEMO_SEED_MODE=reset) removes the
 * demo world again.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import {
  assertOptIn,
  parseMode,
  redactDatabaseUrl,
  resolveDatabaseUrl,
  type SeedMode,
} from "./demo_seed.lib";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEMO_EMAIL_DOMAIN = "@demo.fbc.invalid";
// Demo personas span two email shapes: the 15 fictional accounts the seed creates
// (*@demo.fbc.invalid) AND the three pre-existing presenter logins the seed only
// enriches (discover/prime/legacy@fbcdemo.com — Eleonora/Carla/Jonas). Counts must
// include both; reset must NOT delete the @fbcdemo.com logins (it removes their
// seeded content by id instead).
const DEMO_USER_PREDICATE = `(u.email like '%${DEMO_EMAIL_DOMAIN}' or u.email like '%@fbcdemo.com')`;

// ── Persona ids (defined by the curated SQL files; referenced as authors/hosts) ─
const P = {
  maximilian: "00000000-0000-0000-0000-000000000238",
  eleonora: "5e195a30-99af-4fbb-ae5f-1f4eff3209c7",
  carla: "d73efa12-5f11-4220-94b4-dd5880b10782",
  jonas: "2752a480-a737-4f90-af0c-a76722c781a7",
  friederike: "00000000-0000-0000-0000-000000025401",
  hansPeter: "00000000-0000-0000-0000-000000025402",
  beatrice: "00000000-0000-0000-0000-000000025403",
  yvonne: "00000000-0000-0000-0000-000000025404",
  philip: "00000000-0000-0000-0000-000000025405",
  tobias: "00000000-0000-0000-0000-000000025406",
  gregor: "00000000-0000-0000-0000-000000025407",
  markus: "00000000-0000-0000-0000-000000025410",
} as const;

// Fixed demo ids. A re-run REFRESHES this content (on conflict do update) —
// see the note above SEED_POSTS_SQL for why that changed.
const POST = {
  p1: "00000000-0000-0000-0000-0000000254f1",
  p2: "00000000-0000-0000-0000-0000000254f2",
  p3: "00000000-0000-0000-0000-0000000254f3",
  p4: "00000000-0000-0000-0000-0000000254f4",
  p5: "00000000-0000-0000-0000-0000000254f5",
  // AGE-566: mehr Bestand für die Vorführung. p6–p11 tragen ein Video und
  // FÜLLEN DAMIT DIE ACADEMY — sie liest `video_url`, das ein Trigger aus dem
  // Text zieht (20260813090000). Vor diesen Zeilen standen dort zwei Beiträge.
  p6: "00000000-0000-0000-0000-0000000254f6",
  p7: "00000000-0000-0000-0000-0000000254f7",
  p8: "00000000-0000-0000-0000-0000000254f8",
  p9: "00000000-0000-0000-0000-0000000254f9",
  p10: "00000000-0000-0000-0000-0000000254fa",
  p11: "00000000-0000-0000-0000-0000000254fb",
  p12: "00000000-0000-0000-0000-0000000254fc",
  p13: "00000000-0000-0000-0000-0000000254fd",
  p14: "00000000-0000-0000-0000-0000000254fe",
} as const;
const EVT = {
  online: "00000000-0000-0000-0000-0000000254e1",
  workshop: "00000000-0000-0000-0000-0000000254e2",
  dinner: "00000000-0000-0000-0000-0000000254e3",
  mastermind: "00000000-0000-0000-0000-0000000254e4",
  fruehstueck: "00000000-0000-0000-0000-0000000254e5",
  deepdive: "00000000-0000-0000-0000-0000000254e6",
  kaminabend: "00000000-0000-0000-0000-0000000254e7",
  retreat: "00000000-0000-0000-0000-0000000254e8",
} as const;

/**
 * Echte, einbettbare YouTube-Vorträge — gerendert von `VideoEmbed` (AGE-252)
 * und, weil `video_url` daraus entsteht, zugleich der Bestand der Academy.
 *
 * ALLE ZEHN am 17.08. über die oEmbed-Schnittstelle geprüft (HTTP 200 samt
 * Titel), nicht aus dem Gedächtnis geschrieben: eine erfundene Video-Kennung
 * fällt nicht beim Seeden auf, sondern als schwarzer Kasten in der Vorführung.
 */
const VIDEO = {
  koerpersprache: "https://www.youtube.com/watch?v=Ks-_Mh1QhMc", // Amy Cuddy, TED
  fuehrung: "https://www.youtube.com/watch?v=qp0HIF3SfI4", // Simon Sinek, TED
  verletzlichkeit: "https://www.youtube.com/watch?v=X4Qm9cGRub0", // Brené Brown, TEDx
  stress: "https://www.youtube.com/watch?v=RcGyVTAoXEU", // Kelly McGonigal, TED
  sprechen: "https://www.youtube.com/watch?v=eIho2S0ZahI", // Julian Treasure, TED
  aufschieben: "https://www.youtube.com/watch?v=arj7oStGLkU", // Tim Urban, TED
  kreativitaet: "https://www.youtube.com/watch?v=iG9CE55wbtY", // Ken Robinson, TED
} as const;

// ── SQL fragments ─────────────────────────────────────────────────────────────

/**
 * WARUM `do update` UND NICHT MEHR `do nothing` (AGE-566, 17.08.).
 *
 * Die Zeitpunkte hier waren schon immer relativ (`now() - interval '6 days'`),
 * die Konfliktregel aber `do nothing` — und beides zusammen heißt: der erste
 * Lauf legt die Welt an, jeder weitere ändert nichts. Am 17.08. gemessen: der
 * Seed war am ~15.06. gelaufen, der jüngste Beitrag **26 Tage alt**, und von
 * neun Events lag **keines** in der Zukunft. Die Vorführung hätte eine tote
 * Plattform gezeigt, obwohl die Inhalte da sind.
 *
 * Mit `do update` ist ein erneuter Lauf das, wonach er klingt: die Demo-Welt
 * rückt an das heutige Datum heran. Die Kennungen bleiben fest, es entstehen
 * also weiterhin keine Dubletten — und `reset` räumt unverändert nach Kennung
 * auf.
 *
 * `post_likes` und `event_registrations` behalten `do nothing`: sie tragen
 * keine Zeit, es gäbe nichts aufzufrischen.
 */
const SEED_POSTS_SQL = `
begin;
insert into public.posts (id, author_id, body, hashtags, visibility, created_at) values
  ('${POST.p1}', '${P.maximilian}',
   'Großartiger Austausch beim letzten FBC-Dinner — Qualität vor Reichweite ist gelebte Realität in diesem Kreis. #Impact #Mentoring',
   array['impact','mentoring'], 'public', now() - interval '6 days'),
  ('${POST.p2}', '${P.carla}',
   'Wie gute Führung wirklich entsteht — sehenswerter Vortrag, den wir in der Academy aufgreifen. ${VIDEO.fuehrung} #Leadership #Netzwerk',
   array['leadership','netzwerk'], 'members', now() - interval '4 days'),
  ('${POST.p3}', '${P.tobias}',
   'Unsere Robotik-Plattform geht in die nächste Skalierungsstufe — wir suchen Co-Investoren für die Series A. #Robotik #SeriesA',
   array['robotik','seriesa'], 'members', now() - interval '2 days'),
  ('${POST.p4}', '${P.markus}',
   'Digital Health verändert die Prävention. Spannende Gespräche mit potenziellen Partnern aus dem Club. #HealthTech #Prävention',
   array['healthtech','prävention'], 'members', now() - interval '1 day'),
  ('${POST.p5}', '${P.beatrice}',
   'Klarheit über das eigene WARUM ist der Hebel für nachhaltiges Wachstum. Dankbar für die Tiefe der Gespräche hier. #Leadership #Coaching',
   array['leadership','coaching'], 'public', now() - interval '8 hours'),
  -- Die Academy-Reihe: sechs Vorträge, sechs verschiedene Stimmen aus dem Club.
  ('${POST.p6}', '${P.beatrice}',
   'Verletzlichkeit als Führungsstärke — der Vortrag, über den wir im letzten Workshop so lange gesprochen haben. ${VIDEO.verletzlichkeit} #Leadership #Coaching',
   array['leadership','coaching'], 'members', now() - interval '9 days'),
  ('${POST.p7}', '${P.friederike}',
   'Stress ist nicht der Gegner — es kommt darauf an, wie wir ihn deuten. Pflichtprogramm für alle, die gerade skalieren. ${VIDEO.stress} #Mindset #Wachstum',
   array['mindset','wachstum'], 'members', now() - interval '7 days'),
  ('${POST.p8}', '${P.gregor}',
   'Wer gehört werden will, muss anders sprechen. Nehme daraus viel für unsere Pitches mit. ${VIDEO.sprechen} #Kommunikation #Vertrieb',
   array['kommunikation','vertrieb'], 'members', now() - interval '5 days'),
  ('${POST.p9}', '${P.philip}',
   'Warum wir Dinge aufschieben — mit Abstand die ehrlichste halbe Stunde zum Thema. ${VIDEO.aufschieben} #Produktivität #Mindset',
   array['produktivität','mindset'], 'members', now() - interval '3 days'),
  ('${POST.p10}', '${P.yvonne}',
   'Wie wir Kreativität in Organisationen wieder zulassen. Passt zu unserer Diskussion über Nachwuchs und Kultur. ${VIDEO.kreativitaet} #Kultur #Innovation',
   array['kultur','innovation'], 'members', now() - interval '36 hours'),
  ('${POST.p11}', '${P.carla}',
   'Körpersprache entscheidet oft schon vor dem ersten Satz. Kurz, konkret, sofort anwendbar. ${VIDEO.koerpersprache} #Kommunikation #Auftritt',
   array['kommunikation','auftritt'], 'public', now() - interval '5 hours'),
  -- Und Beiträge ohne Video, damit der Feed nicht wie eine Videowand wirkt.
  ('${POST.p12}', '${P.hansPeter}',
   'Nachfolge ist kein Termin, sondern ein Prozess über Jahre. Suche den Austausch mit allen, die das gerade hinter sich haben. #Nachfolge #Mittelstand',
   array['nachfolge','mittelstand'], 'members', now() - interval '8 days'),
  ('${POST.p13}', '${P.jonas}',
   'Unsere Stiftung hat das erste Projekt bewilligt — entstanden aus einem Gespräch hier im Club. Genau dafür ist dieser Kreis da. #Impact #Stiftung',
   array['impact','stiftung'], 'members', now() - interval '2 days'),
  ('${POST.p14}', '${P.eleonora}',
   'Kurzer Rückblick auf das Quartal: 14 Vorstellungen, 6 konkrete Kooperationen, 2 Beteiligungen. Danke für euer Vertrauen. #Netzwerk #Rückblick',
   array['netzwerk','rückblick'], 'members', now() - interval '20 hours')
on conflict (id) do update set
  body       = excluded.body,
  hashtags   = excluded.hashtags,
  visibility = excluded.visibility,
  created_at = excluded.created_at;

insert into public.comments (id, post_id, author_id, body, created_at) values
  ('00000000-0000-0000-0000-0000000254c1', '${POST.p1}', '${P.eleonora}', 'Sehr gerne — das nächste Format steht schon.', now() - interval '5 days'),
  ('00000000-0000-0000-0000-0000000254c2', '${POST.p3}', '${P.eleonora}', 'Klingt spannend, lass uns die Zahlen anschauen.', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000254c3', '${POST.p2}', '${P.beatrice}', 'Starker Vortrag, danke fürs Teilen!', now() - interval '3 days'),
  ('00000000-0000-0000-0000-0000000254c4', '${POST.p12}', '${P.maximilian}', 'Sehr gerne — bei uns hat die Übergabe knapp vier Jahre gedauert.', now() - interval '7 days'),
  ('00000000-0000-0000-0000-0000000254c5', '${POST.p13}', '${P.friederike}', 'Das freut mich sehr zu lesen. Glückwunsch!', now() - interval '30 hours'),
  ('00000000-0000-0000-0000-0000000254c6', '${POST.p7}', '${P.tobias}', 'Habe ihn zweimal geschaut. Der zweite Teil trägt.', now() - interval '6 days'),
  ('00000000-0000-0000-0000-0000000254c7', '${POST.p14}', '${P.markus}', 'Beeindruckende Zahlen — und dahinter echte Gespräche.', now() - interval '12 hours')
on conflict (id) do update set
  body       = excluded.body,
  created_at = excluded.created_at;

insert into public.post_likes (post_id, profile_id) values
  ('${POST.p1}', '${P.carla}'), ('${POST.p1}', '${P.beatrice}'), ('${POST.p1}', '${P.tobias}'),
  ('${POST.p2}', '${P.maximilian}'), ('${POST.p2}', '${P.eleonora}'),
  ('${POST.p3}', '${P.eleonora}'), ('${POST.p3}', '${P.friederike}'),
  ('${POST.p5}', '${P.carla}'), ('${POST.p5}', '${P.markus}'),
  ('${POST.p6}', '${P.yvonne}'), ('${POST.p6}', '${P.eleonora}'), ('${POST.p6}', '${P.carla}'),
  ('${POST.p7}', '${P.tobias}'), ('${POST.p7}', '${P.gregor}'),
  ('${POST.p8}', '${P.philip}'), ('${POST.p8}', '${P.maximilian}'),
  ('${POST.p9}', '${P.beatrice}'), ('${POST.p9}', '${P.yvonne}'), ('${POST.p9}', '${P.markus}'),
  ('${POST.p10}', '${P.friederike}'), ('${POST.p10}', '${P.jonas}'),
  ('${POST.p11}', '${P.beatrice}'), ('${POST.p11}', '${P.hansPeter}'),
  ('${POST.p12}', '${P.maximilian}'), ('${POST.p12}', '${P.gregor}'),
  ('${POST.p13}', '${P.eleonora}'), ('${POST.p13}', '${P.friederike}'), ('${POST.p13}', '${P.beatrice}'),
  ('${POST.p14}', '${P.carla}'), ('${POST.p14}', '${P.tobias}'), ('${POST.p14}', '${P.philip}')
on conflict (post_id, profile_id) do nothing;
commit;
`;

/**
 * Acht Termine, gestaffelt von übermorgen bis in sechs Wochen.
 *
 * Die Staffelung ist der Punkt, nicht die Zahl: eine Terminliste, deren
 * nächster Eintrag in drei Wochen liegt, sieht aus wie eine Liste ohne
 * Betrieb. Der erste liegt deshalb in zwei Tagen, und zwischen je zwei
 * Terminen liegt höchstens eine Woche.
 *
 * `do update` auf `starts_at`: siehe die Notiz über SEED_POSTS_SQL. Der
 * Trigger `trg_event_feed_post` feuert nur bei INSERT (und `trg_event_feed_sync`
 * nur bei `update of visibility, host_id`) — ein Auffrischen der Termine
 * erzeugt also KEINE zweiten Feed-Beiträge.
 *
 * WARUM `tag(n, stunde)` UND NICHT `now() + interval 'n days' + interval '9 hours'`:
 * Das Zweite addiert auf die AKTUELLE UHRZEIT. Beim ersten Lauf am 17.08. um
 * 12:46 kam dabei ein Frühstück um 21:46 heraus und ein Kaminabend um 07:46 —
 * die Zahlen in der Zusammenfassung sahen dabei tadellos aus, erst die
 * Terminliste zeigte es. Der Helfer bindet an den Tagesbeginn **in
 * Europe/Berlin** und legt die Stunde darauf; die Datenbank läuft in UTC, und
 * eine Uhrzeit, die nur dort stimmt, ist für die Vorführung falsch.
 */
const tag = (n: number, stunde: number, minute = 0) =>
  `((date_trunc('day', now() at time zone 'Europe/Berlin') + interval '${n} days' ` +
  `+ interval '${stunde} hours' + interval '${minute} minutes') at time zone 'Europe/Berlin')`;
const SEED_EVENTS_SQL = `
begin;
insert into public.events (id, title, type, starts_at, ends_at, location, host_id, visibility, capacity, description) values
  ('${EVT.fruehstueck}', 'FBC Frühstück Stuttgart', 'presence', ${tag(2, 9)},
   ${tag(2, 11)},
   'Stuttgart, Hotel am Schlossgarten', '${P.maximilian}', 'members', 20,
   'Offener Auftakt in den Tag: kurze Vorstellungsrunde, zwei Impulse aus dem Kreis, danach freier Austausch.'),
  ('${EVT.deepdive}', 'Deep Dive: KI im Mittelstand', 'online', ${tag(3, 17)},
   ${tag(3, 18, 30)},
   'Online (Zoom)', '${P.tobias}', 'members', 80,
   'Was heute schon trägt und was noch Versprechen ist — mit Beispielen aus Produktion, Vertrieb und Verwaltung.'),
  ('${EVT.online}', 'FBC Webinar: Kapital & Wachstum 2026', 'online', ${tag(9, 18)},
   ${tag(9, 19, 30)},
   'Online (Zoom)', '${P.carla}', 'members', 100,
   'Finanzierungswege jenseits der Hausbank: Beteiligungen, stille Einlagen, Förderprogramme.'),
  ('${EVT.kaminabend}', 'Kaminabend: Unternehmensnachfolge', 'dinner', ${tag(11, 19)},
   ${tag(11, 22)},
   'Ludwigsburg, Schloss-Remise', '${P.hansPeter}', 'members', 10,
   'Drei Übergaben, drei Wege, drei ehrliche Rückblicke — im kleinen Kreis und ohne Folien.'),
  ('${EVT.workshop}', 'Leadership-Workshop: Klarheit & Wirkung', 'workshop', ${tag(16, 10)},
   ${tag(16, 16)},
   'Stuttgart, FBC Lounge', '${P.beatrice}', 'members', 12,
   'Ein Tag an der eigenen Führungspraxis: Haltung, Sprache, Entscheidungen. Bewusst klein gehalten.'),
  ('${EVT.dinner}', 'Legacy Dinner Stuttgart', 'dinner', ${tag(23, 19)},
   ${tag(23, 23)},
   'Stuttgart, Restaurant Délice', '${P.maximilian}', 'members', 4,
   'Vier Plätze, ein Abend, ein Thema: was von unserer Arbeit bleiben soll.'),
  ('${EVT.mastermind}', 'Investoren-Mastermind Q4', 'mastermind', ${tag(30, 14)},
   ${tag(30, 18)},
   'München, Private Club', '${P.friederike}', 'members', 6,
   'Reihum ein Fall aus dem eigenen Portfolio, danach ungeschminkte Rückmeldung der Runde.'),
  ('${EVT.retreat}', 'Jahresauftakt-Retreat 2027', 'workshop', ${tag(42, 10)},
   ${tag(44, 14)},
   'Allgäu, Berggut Sonnenhalde', '${P.eleonora}', 'members', 24,
   'Drei Tage Abstand vom Tagesgeschäft: Jahresplanung, Partnerschaften und viel Zeit zwischen den Programmpunkten.')
on conflict (id) do update set
  title       = excluded.title,
  type        = excluded.type,
  starts_at   = excluded.starts_at,
  ends_at     = excluded.ends_at,
  location    = excluded.location,
  capacity    = excluded.capacity,
  description = excluded.description;

-- Webinar: a healthy registered list (well under capacity).
insert into public.event_registrations (event_id, profile_id, status) values
  ('${EVT.online}', '${P.eleonora}', 'registered'), ('${EVT.online}', '${P.jonas}', 'registered'),
  ('${EVT.online}', '${P.tobias}', 'registered'), ('${EVT.online}', '${P.markus}', 'registered'),
  ('${EVT.online}', '${P.gregor}', 'registered')
on conflict (event_id, profile_id) do nothing;

-- Legacy dinner: capacity 4 → 4 registered + 2 waitlist (demonstrates the waitlist path).
insert into public.event_registrations (event_id, profile_id, status) values
  ('${EVT.dinner}', '${P.eleonora}', 'registered'), ('${EVT.dinner}', '${P.friederike}', 'registered'),
  ('${EVT.dinner}', '${P.yvonne}', 'registered'),  ('${EVT.dinner}', '${P.philip}', 'registered'),
  ('${EVT.dinner}', '${P.beatrice}', 'waitlist'),  ('${EVT.dinner}', '${P.hansPeter}', 'waitlist')
on conflict (event_id, profile_id) do nothing;

-- Mastermind: a couple of prime registrations.
insert into public.event_registrations (event_id, profile_id, status) values
  ('${EVT.mastermind}', '${P.carla}', 'registered'), ('${EVT.mastermind}', '${P.tobias}', 'registered')
on conflict (event_id, profile_id) do nothing;

-- Die vier neuen Termine. Unterschiedliche Füllstände mit Absicht: das
-- Frühstück gut besucht, der Deep Dive breit, der Kaminabend fast voll (9 von
-- 10 — dort wird der Hinweis auf die letzten Plätze sichtbar), das Retreat noch
-- offen. Eine Liste, in der jeder Termin gleich voll ist, wirkt gestellt.
insert into public.event_registrations (event_id, profile_id, status) values
  ('${EVT.fruehstueck}', '${P.eleonora}', 'registered'), ('${EVT.fruehstueck}', '${P.beatrice}', 'registered'),
  ('${EVT.fruehstueck}', '${P.gregor}', 'registered'),   ('${EVT.fruehstueck}', '${P.philip}', 'registered'),
  ('${EVT.fruehstueck}', '${P.yvonne}', 'registered'),   ('${EVT.fruehstueck}', '${P.markus}', 'registered'),
  ('${EVT.fruehstueck}', '${P.jonas}', 'registered'),
  ('${EVT.deepdive}', '${P.maximilian}', 'registered'), ('${EVT.deepdive}', '${P.carla}', 'registered'),
  ('${EVT.deepdive}', '${P.friederike}', 'registered'), ('${EVT.deepdive}', '${P.hansPeter}', 'registered'),
  ('${EVT.deepdive}', '${P.gregor}', 'registered'),     ('${EVT.deepdive}', '${P.beatrice}', 'registered'),
  ('${EVT.kaminabend}', '${P.maximilian}', 'registered'), ('${EVT.kaminabend}', '${P.eleonora}', 'registered'),
  ('${EVT.kaminabend}', '${P.friederike}', 'registered'), ('${EVT.kaminabend}', '${P.jonas}', 'registered'),
  ('${EVT.kaminabend}', '${P.tobias}', 'registered'),     ('${EVT.kaminabend}', '${P.markus}', 'registered'),
  ('${EVT.kaminabend}', '${P.philip}', 'registered'),     ('${EVT.kaminabend}', '${P.yvonne}', 'registered'),
  ('${EVT.kaminabend}', '${P.gregor}', 'registered'),
  ('${EVT.retreat}', '${P.carla}', 'registered'), ('${EVT.retreat}', '${P.beatrice}', 'registered'),
  ('${EVT.retreat}', '${P.tobias}', 'registered'),
  -- Der Workshop stand seit AGE-254 ohne eine einzige Anmeldung in der Liste.
  -- Ein Termin mit „0 Angemeldete" liest sich in einer Vorführung nicht als
  -- „noch Platz", sondern als „interessiert niemanden".
  ('${EVT.workshop}', '${P.yvonne}', 'registered'), ('${EVT.workshop}', '${P.philip}', 'registered'),
  ('${EVT.workshop}', '${P.markus}', 'registered'), ('${EVT.workshop}', '${P.hansPeter}', 'registered'),
  ('${EVT.workshop}', '${P.jonas}', 'registered')
on conflict (event_id, profile_id) do nothing;

-- Die Ankündigungen im Feed staffeln.
--
-- Der Trigger trg_event_feed_post schreibt beim Anlegen eines Events einen mit
-- DEM ZEITPUNKT DES ANLEGENS. Beim Seeden entstehen alle in derselben Sekunde,
-- und im Feed stand daraufhin ein Viererblock „Neues Event · vor 8 Minuten"
-- ganz oben — im Browser gesehen, in keiner Zählung sichtbar. Das liest sich
-- wie ein Datenimport, nicht wie ein Club, in dem über Wochen etwas angekündigt
-- wird.
--
-- Gesetzt wird nach Kennung, nicht nach „alles, was gerade entstand": ein
-- erneuter Lauf soll dieselben Zeitpunkte wieder herstellen und nicht die eines
-- fremden Beitrags verschieben.
update public.posts p set created_at = v.wann
  from (values
    ('${EVT.fruehstueck}'::uuid, now() - interval '11 days'),
    ('${EVT.deepdive}'::uuid,    now() - interval '9 days'),
    ('${EVT.kaminabend}'::uuid,  now() - interval '6 days'),
    ('${EVT.retreat}'::uuid,     now() - interval '3 days')
  ) as v(ref, wann)
 where p.kind = 'event' and p.ref_id = v.ref;
commit;
`;

const SUMMARY_SQL = `
select
  (select count(*) from auth.users u where ${DEMO_USER_PREDICATE}) as personas,
  (select count(*) from public.offers o join auth.users u on u.id = o.profile_id
     where ${DEMO_USER_PREDICATE}) as offers,
  (select count(*) from public.needs n join auth.users u on u.id = n.profile_id
     where ${DEMO_USER_PREDICATE}) as needs,
  (select count(*) from public.matches) as matches,
  (select count(*) from public.posts where id = any($1::uuid[])) as posts,
  (select count(*) from public.comments c join public.posts p on p.id = c.post_id
     where p.id = any($1::uuid[])) as comments,
  (select count(*) from public.events where id = any($2::uuid[])) as events,
  (select count(*) from public.event_registrations where event_id = any($2::uuid[])) as registrations,
  (select count(*) from public.contact_requests where status = 'accepted') as accepted_requests,
  (select count(*) from public.messages) as messages
`;

// Reset: delete the seeded feed + events by fixed id (their authors/hosts may be
// the @fbcdemo.com presenter logins, which must survive — so a user-domain delete
// alone would orphan that content). Deleting posts/events cascades their comments,
// likes and registrations. Then delete the *@demo.fbc.invalid auth.users, which
// cascades profiles → offers/needs/matches/contact_requests/messages. The three
// @fbcdemo.com logins are intentionally left intact.
const RESET_SQL = `
begin;
delete from public.posts where id = any($1::uuid[]);
delete from public.events where id = any($2::uuid[]);
delete from auth.users where email like '%${DEMO_EMAIL_DOMAIN}';
commit;
`;

const POST_IDS = Object.values(POST);
const EVENT_IDS = Object.values(EVT);

// ── Orchestration ─────────────────────────────────────────────────────────────

/**
 * TLS for the connection. The Supabase pooler presents a cert chained to a
 * private Supabase CA (not the public trust store), so plain verification fails.
 * Secure by default, with two conscious opt-outs (never silently disabled):
 *   - DEMO_SEED_CA_CERT=<pem path>  → verify against Supabase's CA (recommended;
 *     download from the project's dashboard → Database → SSL configuration).
 *   - DEMO_SEED_TLS_INSECURE=1      → encrypt but do not authenticate the server
 *     (MITM-exposed — only on a trusted network). Prints a warning.
 */
function resolveSsl(url: string): pg.ClientConfig["ssl"] {
  if (url.includes("localhost")) return false; // local `supabase start` is plaintext
  const caPath = process.env.DEMO_SEED_CA_CERT;
  if (caPath) return { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true };
  if (process.env.DEMO_SEED_TLS_INSECURE === "1") {
    console.warn(
      "⚠️  TLS verification disabled (DEMO_SEED_TLS_INSECURE=1): the connection is " +
        "encrypted but the server is NOT authenticated — only use on a trusted network.",
    );
    return { rejectUnauthorized: false };
  }
  return { rejectUnauthorized: true };
}

function runSqlFile(client: pg.Client, file: string): Promise<unknown> {
  const sql = readFileSync(join(HERE, file), "utf8");
  return client.query(sql);
}

async function seed(client: pg.Client): Promise<void> {
  console.log("→ Running curated SQL: demo_legacy_profile.sql");
  await runSqlFile(client, "demo_legacy_profile.sql");
  console.log("→ Running curated SQL: demo_personas.sql");
  await runSqlFile(client, "demo_personas.sql");
  console.log("→ Seeding feed posts (+ comments, likes)");
  await client.query(SEED_POSTS_SQL);
  console.log("→ Seeding events (+ registrations)");
  await client.query(SEED_EVENTS_SQL);
}

async function reset(client: pg.Client): Promise<void> {
  console.log("→ Deleting demo posts + events, then demo auth.users (cascades the rest)");
  await client.query(RESET_SQL, [POST_IDS, EVENT_IDS]);
}

async function printSummary(client: pg.Client): Promise<void> {
  const { rows } = await client.query(SUMMARY_SQL, [POST_IDS, EVENT_IDS]);
  console.log("\nDemo world summary (counts):");
  console.table(rows[0]);
}

async function main(): Promise<void> {
  const env = process.env;
  const mode: SeedMode = parseMode(env);
  assertOptIn(env); // throws (and we exit non-zero) unless DEMO_SEED_CONFIRM=fbc-demo
  const url = resolveDatabaseUrl(env);

  console.log(`\nFBC demo seed — mode: ${mode}`);
  console.log(`Target Postgres: ${redactDatabaseUrl(url)}`);
  console.log("⚠️  This is the LIVE shared Supabase project (dev == prod).\n");

  const client = new pg.Client({
    connectionString: url,
    ssl: resolveSsl(url),
  });
  await client.connect();
  try {
    if (mode === "reset") await reset(client);
    else await seed(client);
    await printSummary(client);
    console.log(`\n✓ Demo ${mode} complete.`);
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
