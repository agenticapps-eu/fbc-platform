# Demo Seed (AGE-254)

Builds a presentable, internally-consistent demo world for the AGE-255 acceptance
run: personas across all tiers, complementary offers/needs, engine-generated
matches, a community feed (incl. one video), upcoming events, plus an accepted
contact request and a sample chat.

> **NOT REAL DATA.** All personas are fictional with non-routable
> `*.demo.fbc.invalid` emails. The script is **idempotent** — running it twice
> produces no duplicates.

## ⚠️ One shared database

Infisical `env=dev` and `env=prod` point at the **same** Supabase project
(`foelowldexkcqzewvrcf`). There is no separate prod DB — the live database is the
only database. A `prod`-detecting guard is therefore impossible, so the script
instead requires an **explicit opt-in** and prints the target host before writing.

## Run

```bash
# Seed the demo world (the confirm flag is the safety opt-in):
DEMO_SEED_CONFIRM=fbc-demo pnpm demo:seed

# Reset (removes the demo world again):
DEMO_SEED_CONFIRM=fbc-demo pnpm demo:reset
```

Without `DEMO_SEED_CONFIRM=fbc-demo` the script refuses and exits non-zero — this
prevents an accidental run against the live project.

`pnpm demo:seed` is `infisical run --env=dev -- tsx supabase/seed/demo_seed.ts`.
The connection is derived from `SUPABASE_DB_PASSWORD` (injected by Infisical) via
the session pooler; override with `DEMO_SEED_DATABASE_URL` if needed (e.g. a local
`supabase start` stack).

### TLS

The Supabase pooler presents a certificate chained to a **private Supabase CA**
(not the public trust store), so strict verification fails out of the box with
`self-signed certificate in certificate chain`. Choose one:

```bash
# Recommended — verify against Supabase's CA (download from the dashboard:
# Project → Database → SSL configuration → Download certificate):
DEMO_SEED_CONFIRM=fbc-demo DEMO_SEED_CA_CERT=~/prod-ca-2021.crt pnpm demo:seed

# Quick path on a trusted network — encrypted but server NOT authenticated:
DEMO_SEED_CONFIRM=fbc-demo DEMO_SEED_TLS_INSECURE=1 pnpm demo:seed
```

A local `supabase start` stack (`localhost`) connects in plaintext, no flag needed.

## What it does

1. Runs the curated SQL verbatim (idempotent):
   - `demo_legacy_profile.sql` — Maximilian Bauer (Legacy, full dataset).
   - `demo_personas.sql` — 16 further personas (Legacy/Prime/Discover) with
     complementary offers/needs, theme scores, `generate_matches_for` for each,
     gated contact details, one accepted + one pending contact request, a chat.
2. Adds the feed: 5 posts (hashtags; one carries an embeddable YouTube video in
   its body), plus comments and likes.
3. Adds 4 upcoming events (`online`, `workshop`, `dinner`, `mastermind`) with
   registrations — the Legacy dinner is seeded past capacity to show the waitlist.
4. Prints a counts summary. Re-running yields identical counts (idempotency).

## Reset details

Reset deletes the demo events (their `host_id` FK is `on delete set null`, so they
are not cascade-removed), then deletes the demo `auth.users`
(`email like '%@demo.fbc.invalid'`) — which cascades to profiles, posts, comments,
offers, needs, matches, contact requests, and messages.

## Precondition: the three presenter logins

The seed **enriches** (never creates) the three pre-existing presenter login
accounts — `discover@fbcdemo.com` (Jonas), `prime@fbcdemo.com` (Carla),
`legacy@fbcdemo.com` (Eleonora). They must exist before seeding, and `demo:reset`
deliberately leaves them intact (it removes their seeded content by id instead).
If those accounts are ever deleted, the seed will fail on the first foreign-key
reference to them — recreate the login accounts first.

## Idempotency

The curated SQL is already idempotent. The feed and events use fixed UUIDs with
`on conflict (id) do nothing`; likes and registrations rely on their composite /
unique keys. See `docs/decisions/0003-demo-seed.md` for the design rationale.
