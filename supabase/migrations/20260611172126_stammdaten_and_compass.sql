-- Stammdaten + Ebene-2 prep (AGE-234, P4 §1/§2). RLS enabled, policies in P5.

-- ── partner_categories (P4 §1) ───────────────────────────────────────────────
create table public.partner_categories (
  key   text primary key,
  label text not null
);
insert into public.partner_categories (key, label) values
  ('host',      'Host Partner'),
  ('expert',    'Expert Partner'),
  ('public',    'Public Partner'),
  ('sponsor',   'Sponsor Partner'),
  ('strategic', 'Strategic Partner'),
  ('impact',    'Impact Partner');
alter table public.partner_categories enable row level security;

-- ── compass_responses (P4 §2; Ebene 2 prepared) ──────────────────────────────
create table public.compass_responses (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  theme           text check (theme in ('sein', 'tun', 'haben', 'wirken')),
  answers         jsonb,
  potential_level text,
  tx_volume_band  text check (tx_volume_band in ('lt_10k', '10k_100k', '100k_1m', '1m_10m', 'gt_10m')),
  routing         text check (routing in ('fbc', 'dkri')),
  created_at      timestamptz not null default now()
);
comment on column public.compass_responses.routing is
  'Derived from tx_volume_band (>= 1m_10m → dkri). P4 §2.';
comment on column public.compass_responses.potential_level is
  'Free text, e.g. gruendung|wachstum|nachfolge|investment (P4 §2).';

alter table public.compass_responses enable row level security;
create index compass_responses_profile_id_idx on public.compass_responses (profile_id);
