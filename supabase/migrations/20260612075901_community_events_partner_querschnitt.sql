-- Community/Events/Partner/Querschnitt (P4 §4–§7) — AGE-234 PR-C.
-- RLS enabled, policies deferred to P5/AGE-235. Enum-like cols use text+check.
-- created_at added to every table per P4 §0 (incl. post_likes/event_registrations
-- whose terse §4/§5 specs omit it).

-- ── Community (P4 §4) ────────────────────────────────────────────────────────
create table public.posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null,
  hashtags   text[],
  visibility text not null default 'members'
               check (visibility in ('public', 'members', 'prime', 'legacy')),
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
alter table public.comments enable row level security;

create table public.post_likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);
alter table public.post_likes enable row level security;

-- ── Partner (P4 §6) — before events (events.host_partner_id → partners) ───────
create table public.partners (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text references public.partner_categories (key),
  logo_url    text,
  contact     text,
  region      text,
  description text,
  website     text,
  created_at  timestamptz not null default now()
);
alter table public.partners enable row level security;

-- ── Events (P4 §5) ───────────────────────────────────────────────────────────
create table public.events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  type            text check (type in ('online', 'presence', 'dinner', 'workshop', 'mastermind')),
  starts_at       timestamptz,
  location        text,
  host_id         uuid references public.profiles (id) on delete set null,
  host_partner_id uuid references public.partners (id) on delete set null,
  visibility      text not null default 'public'
                    check (visibility in ('public', 'members', 'prime', 'legacy')),
  capacity        int,
  created_at      timestamptz not null default now()
);
alter table public.events enable row level security;

create table public.event_registrations (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status     text not null default 'registered'
               check (status in ('registered', 'waitlist', 'cancelled')),
  checked_in boolean not null default false,
  rating     int check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  constraint event_registrations_unique unique (event_id, profile_id)
);
alter table public.event_registrations enable row level security;

-- ── Querschnitt (P4 §7) ──────────────────────────────────────────────────────
create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  ref_type   text check (ref_type in ('event', 'match', 'course')),
  ref_id     uuid,
  rating     int check (rating between 1 and 5),
  note       text,
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type       text,
  payload    jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;

-- ── indexes (P4 §9; FK columns indexed generally) ────────────────────────────
create index posts_visibility_created_at_idx   on public.posts (visibility, created_at);
create index posts_author_id_idx               on public.posts (author_id);
create index comments_post_id_idx              on public.comments (post_id);
create index comments_author_id_idx            on public.comments (author_id);
create index post_likes_profile_id_idx         on public.post_likes (profile_id);
create index partners_category_idx             on public.partners (category);
create index events_host_id_idx                on public.events (host_id);
create index events_host_partner_id_idx        on public.events (host_partner_id);
create index event_registrations_event_id_idx  on public.event_registrations (event_id);
create index event_registrations_profile_id_idx on public.event_registrations (profile_id);
create index feedback_profile_id_idx           on public.feedback (profile_id);
create index notifications_profile_id_idx       on public.notifications (profile_id);
