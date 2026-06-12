-- Matching (P4 §3) — AGE-234 PR-B. RLS enabled, policies deferred to P5/AGE-235.
-- offers/needs are member-authored; matches are created by the service-role
-- match-engine (AGE-245). message-INSERT gating (only when a contact_request is
-- accepted) is a P5 RLS concern. Enum-like columns use text+check (P4 §0).

-- ── offers — "Ich biete" (P4 §3) ─────────────────────────────────────────────
create table public.offers (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  category    text,
  theme       text check (theme in ('sein', 'tun', 'haben', 'wirken')),
  title       text not null,
  description text,
  tags        text[],
  created_at  timestamptz not null default now()
);
alter table public.offers enable row level security;

-- ── needs — "Ich suche" (offers + tx_volume_band for FBC/DKRI routing) ────────
create table public.needs (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  category       text,
  theme          text check (theme in ('sein', 'tun', 'haben', 'wirken')),
  title          text not null,
  description    text,
  tags           text[],
  tx_volume_band text check (tx_volume_band in ('lt_10k', '10k_100k', '100k_1m', '1m_10m', 'gt_10m')),
  created_at     timestamptz not null default now()
);
alter table public.needs enable row level security;

-- ── matches (created server-side by the match-engine, AGE-245) ───────────────
create table public.matches (
  id           uuid primary key default gen_random_uuid(),
  a_profile_id uuid not null references public.profiles (id) on delete cascade,
  b_profile_id uuid not null references public.profiles (id) on delete cascade,
  score        int  not null,
  basis        jsonb,
  status       text not null default 'suggested'
                 check (status in ('suggested', 'requested', 'accepted', 'declined')),
  routing      text not null default 'fbc' check (routing in ('fbc', 'dkri')),
  created_at   timestamptz not null default now(),
  constraint matches_distinct_profiles check (a_profile_id <> b_profile_id),
  constraint matches_unique_pair unique (a_profile_id, b_profile_id)
);
alter table public.matches enable row level security;

-- ── contact_requests (contact data revealed only at status='accepted', P5) ───
create table public.contact_requests (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references public.profiles (id) on delete cascade,
  to_id      uuid not null references public.profiles (id) on delete cascade,
  match_id   uuid references public.matches (id) on delete set null,
  message    text,
  status     text not null default 'pending'
               check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  constraint contact_requests_unique_pair unique (from_id, to_id)
);
alter table public.contact_requests enable row level security;

-- ── message_threads ──────────────────────────────────────────────────────────
create table public.message_threads (
  id           uuid primary key default gen_random_uuid(),
  a_profile_id uuid not null references public.profiles (id) on delete cascade,
  b_profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  constraint message_threads_unique_pair unique (a_profile_id, b_profile_id)
);
alter table public.message_threads enable row level security;

-- ── messages ─────────────────────────────────────────────────────────────────
create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.message_threads (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;

-- ── indexes (P4 §9; FK columns indexed generally) ────────────────────────────
create index offers_tags_gin                  on public.offers using gin (tags);
create index needs_tags_gin                   on public.needs using gin (tags);
create index offers_profile_id_idx            on public.offers (profile_id);
create index needs_profile_id_idx             on public.needs (profile_id);
create index matches_a_profile_id_idx         on public.matches (a_profile_id);
create index matches_b_profile_id_idx         on public.matches (b_profile_id);
create index contact_requests_to_id_status_idx on public.contact_requests (to_id, status);
create index contact_requests_from_id_idx     on public.contact_requests (from_id);
create index contact_requests_match_id_idx    on public.contact_requests (match_id);
create index message_threads_a_profile_id_idx on public.message_threads (a_profile_id);
create index message_threads_b_profile_id_idx on public.message_threads (b_profile_id);
create index messages_thread_id_idx           on public.messages (thread_id);
create index messages_sender_id_idx           on public.messages (sender_id);
