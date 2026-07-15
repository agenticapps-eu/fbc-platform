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

// Fixed demo ids → re-runs update nothing new (on conflict do nothing).
const POST = {
  p1: "00000000-0000-0000-0000-0000000254f1",
  p2: "00000000-0000-0000-0000-0000000254f2",
  p3: "00000000-0000-0000-0000-0000000254f3",
  p4: "00000000-0000-0000-0000-0000000254f4",
  p5: "00000000-0000-0000-0000-0000000254f5",
} as const;
const EVT = {
  online: "00000000-0000-0000-0000-0000000254e1",
  workshop: "00000000-0000-0000-0000-0000000254e2",
  dinner: "00000000-0000-0000-0000-0000000254e3",
  mastermind: "00000000-0000-0000-0000-0000000254e4",
} as const;

/** A real, embeddable YouTube talk — rendered by the feed's VideoEmbed (AGE-252). */
const DEMO_VIDEO_URL = "https://www.youtube.com/watch?v=Ks-_Mh1QhMc";

// ── SQL fragments ─────────────────────────────────────────────────────────────

const SEED_POSTS_SQL = `
begin;
insert into public.posts (id, author_id, body, hashtags, visibility, created_at) values
  ('${POST.p1}', '${P.maximilian}',
   'Großartiger Austausch beim letzten FBC-Dinner — Qualität vor Reichweite ist gelebte Realität in diesem Kreis. #Impact #Mentoring',
   array['impact','mentoring'], 'public', now() - interval '6 days'),
  ('${POST.p2}', '${P.carla}',
   'Wie gute Führung wirklich entsteht — sehenswerter Vortrag, den wir in der Academy aufgreifen. ${DEMO_VIDEO_URL} #Leadership #Netzwerk',
   array['leadership','netzwerk'], 'members', now() - interval '4 days'),
  ('${POST.p3}', '${P.tobias}',
   'Unsere Robotik-Plattform geht in die nächste Skalierungsstufe — wir suchen Co-Investoren für die Series A. #Robotik #SeriesA',
   array['robotik','seriesa'], 'members', now() - interval '2 days'),
  ('${POST.p4}', '${P.markus}',
   'Digital Health verändert die Prävention. Spannende Gespräche mit potenziellen Partnern aus dem Club. #HealthTech #Prävention',
   array['healthtech','prävention'], 'members', now() - interval '1 day'),
  ('${POST.p5}', '${P.beatrice}',
   'Klarheit über das eigene WARUM ist der Hebel für nachhaltiges Wachstum. Dankbar für die Tiefe der Gespräche hier. #Leadership #Coaching',
   array['leadership','coaching'], 'public', now() - interval '8 hours')
on conflict (id) do nothing;

insert into public.comments (id, post_id, author_id, body, created_at) values
  ('00000000-0000-0000-0000-0000000254c1', '${POST.p1}', '${P.eleonora}', 'Sehr gerne — das nächste Format steht schon.', now() - interval '5 days'),
  ('00000000-0000-0000-0000-0000000254c2', '${POST.p3}', '${P.eleonora}', 'Klingt spannend, lass uns die Zahlen anschauen.', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000254c3', '${POST.p2}', '${P.beatrice}', 'Starker Vortrag, danke fürs Teilen!', now() - interval '3 days')
on conflict (id) do nothing;

insert into public.post_likes (post_id, profile_id) values
  ('${POST.p1}', '${P.carla}'), ('${POST.p1}', '${P.beatrice}'), ('${POST.p1}', '${P.tobias}'),
  ('${POST.p2}', '${P.maximilian}'), ('${POST.p2}', '${P.eleonora}'),
  ('${POST.p3}', '${P.eleonora}'), ('${POST.p3}', '${P.friederike}'),
  ('${POST.p5}', '${P.carla}'), ('${POST.p5}', '${P.markus}')
on conflict (post_id, profile_id) do nothing;
commit;
`;

const SEED_EVENTS_SQL = `
begin;
insert into public.events (id, title, type, starts_at, location, host_id, visibility, capacity) values
  ('${EVT.online}', 'FBC Webinar: Kapital & Wachstum 2026', 'online', now() + interval '7 days',
   'Online (Zoom)', '${P.carla}', 'members', 100),
  ('${EVT.workshop}', 'Leadership-Workshop: Klarheit & Wirkung', 'workshop', now() + interval '14 days',
   'Stuttgart, FBC Lounge', '${P.beatrice}', 'members', 12),
  ('${EVT.dinner}', 'Legacy Dinner Stuttgart', 'dinner', now() + interval '21 days',
   'Stuttgart, Restaurant Délice', '${P.maximilian}', 'members', 4),
  ('${EVT.mastermind}', 'Investoren-Mastermind Q3', 'mastermind', now() + interval '28 days',
   'München, Private Club', '${P.friederike}', 'members', 6)
on conflict (id) do nothing;

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
