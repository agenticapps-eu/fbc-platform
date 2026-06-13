-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  DEMO SEED — NOT REAL DATA.  Demo Legacy member "Maximilian Bauer".        ║
-- ║  Mirrors Detlev's member-dashboard mockup so AGE-239/AGE-240 can be built  ║
-- ║  against realistic data. Safe to run repeatedly (idempotent).              ║
-- ║                                                                            ║
-- ║  NOT wired into `supabase db reset` by default. To load it, either:        ║
-- ║    • add  "./seed/*.sql"  to [db.seed].sql_paths in supabase/config.toml,  ║
-- ║      or                                                                    ║
-- ║    • run:  psql "$LOCAL_DB_URL" -f supabase/seed/demo_legacy_profile.sql   ║
-- ║                                                                            ║
-- ║  Fixed demo identity: id …238 (= AGE-238), email *.demo.fbc.invalid.       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 1. Demo auth user. The handle_new_user trigger auto-creates the profiles row
--    (name from metadata, tier 'discover'); we enrich it below. pgcrypto lives in
--    the `extensions` schema on Supabase — qualify so search_path is irrelevant.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000238',
  'authenticated', 'authenticated',
  'maximilian.bauer@demo.fbc.invalid',
  extensions.crypt('demo-not-a-real-password', extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Maximilian Bauer"}',
  '', '', '', ''
)
on conflict (id) do nothing;

-- 2. Enrich the demo profile (the trigger already inserted the base row).
update public.profiles set
  name               = 'Maximilian Bauer',
  tier               = 'legacy',
  headline           = 'Unternehmer · Investor · Deal Keeper · Ökosystem Architekt',
  roles              = array['Unternehmer', 'Investor', 'Deal Keeper', 'Ökosystem Architekt'],
  member_number      = 'FBC-10023',
  member_since       = date '2019-03-01',
  region             = 'Stuttgart',
  company            = 'Bauer Holding GmbH',
  branche            = 'Beteiligungen & Immobilien',
  short_bio          = 'DEMO-Profil — fiktive Daten zur Layout-Abnahme des Member-Dashboards.',
  potential_score    = 87,
  profile_completion = 100,
  is_public          = true,
  dev_focus          = 'wirken',
  dev_progress       = 72,
  next_steps         = array[
                         'Mentoren-Zertifizierung abschließen',
                         'Zwei neue Preferred Partner onboarden',
                         'Impact-Report Q3 finalisieren'
                       ],
  competencies       = array['M&A', 'Beteiligungskapital', 'Immobilienentwicklung', 'Unternehmensnachfolge'],
  interests          = array['Impact Investing', 'Kreislaufwirtschaft', 'Mentoring', 'Family Office']
where id = '00000000-0000-0000-0000-000000000238';

-- 3. Erfolgsradar (Sein/Tun/Haben/Wirken), 0–10.
insert into public.profile_theme_scores (profile_id, theme, score) values
  ('00000000-0000-0000-0000-000000000238', 'sein',   8.5),
  ('00000000-0000-0000-0000-000000000238', 'tun',    9.0),
  ('00000000-0000-0000-0000-000000000238', 'haben',  7.5),
  ('00000000-0000-0000-0000-000000000238', 'wirken', 8.0)
on conflict (profile_id, theme) do update set score = excluded.score;

-- 4. Themed interests (re-seed cleanly; uuid PK can't dedupe on content).
delete from public.profile_interests where profile_id = '00000000-0000-0000-0000-000000000238';
insert into public.profile_interests (profile_id, theme, label) values
  ('00000000-0000-0000-0000-000000000238', 'sein',   'Persönliche Entwicklung'),
  ('00000000-0000-0000-0000-000000000238', 'sein',   'Achtsamkeit'),
  ('00000000-0000-0000-0000-000000000238', 'tun',    'Unternehmensaufbau'),
  ('00000000-0000-0000-0000-000000000238', 'tun',    'Deal Origination'),
  ('00000000-0000-0000-0000-000000000238', 'haben',  'Beteiligungen'),
  ('00000000-0000-0000-0000-000000000238', 'haben',  'Immobilienportfolio'),
  ('00000000-0000-0000-0000-000000000238', 'wirken', 'Impact Investing'),
  ('00000000-0000-0000-0000-000000000238', 'wirken', 'Mentoring');

-- 5. Private goals across the four categories.
delete from public.goals where profile_id = '00000000-0000-0000-0000-000000000238';
insert into public.goals (profile_id, category, title, progress) values
  ('00000000-0000-0000-0000-000000000238', 'persoenlich',     'Work-Life-Balance verbessern',        60),
  ('00000000-0000-0000-0000-000000000238', 'unternehmerisch', 'Holding auf 5 Beteiligungen ausbauen', 80),
  ('00000000-0000-0000-0000-000000000238', 'finanziell',      'Impact-Fonds mit 10 Mio. € auflegen',  45),
  ('00000000-0000-0000-0000-000000000238', 'wirkung',         '100 Gründer:innen mentorieren',        30);

-- 6. Awarded badges (awarded server-side; here via seed/service context).
insert into public.profile_badges (profile_id, badge_key, awarded_at) values
  ('00000000-0000-0000-0000-000000000238', 'transaction_manager', date '2021-06-01'),
  ('00000000-0000-0000-0000-000000000238', 'mentor',              date '2022-09-15'),
  ('00000000-0000-0000-0000-000000000238', 'host',                date '2023-02-20')
on conflict (profile_id, badge_key) do nothing;

-- 7. Such-/Bieteprofil (offers + needs) — rendered by the public profile page
--    (AGE-239) for Prime+ viewers. Re-seed cleanly; uuid PK can't dedupe on content.
delete from public.offers where profile_id = '00000000-0000-0000-0000-000000000238';
insert into public.offers (profile_id, category, theme, title, description) values
  ('00000000-0000-0000-0000-000000000238', 'Kapital',  'haben', 'Beteiligungskapital', 'Eigenkapital für skalierbare Impact-Ventures im DACH-Raum.'),
  ('00000000-0000-0000-0000-000000000238', 'Know-how', 'tun',   'M&A-Begleitung',      'Strukturierung und Begleitung von Transaktionen & Nachfolgen.');

delete from public.needs where profile_id = '00000000-0000-0000-0000-000000000238';
insert into public.needs (profile_id, category, theme, title, description) values
  ('00000000-0000-0000-0000-000000000238', 'Projekte', 'wirken', 'Impact-Projekte',  'Suche wirkungsorientierte Projekte mit Skalierungspotenzial.'),
  ('00000000-0000-0000-0000-000000000238', 'Partner',  'tun',    'Preferred Partner', 'Erweitere mein Partnernetzwerk in Immobilien & Beteiligungen.');

-- 8. Score-Inputs (AGE-242): Mini-Compass-Antworten (speisen den Erfolgsradar)
--    + Feedback, damit recompute_potential_score alle fünf Komponenten aus echten
--    Daten füllt. Antworten sind so gewählt, dass die Themen-Ø den oben gesetzten
--    Radar-Werten entsprechen (sein 8.5 / tun 9 / haben 7.5 / wirken 8).
delete from public.compass_responses where profile_id = '00000000-0000-0000-0000-000000000238';
insert into public.compass_responses (profile_id, theme, answers) values
  ('00000000-0000-0000-0000-000000000238', 'sein',   '{"klarheit":8,"sinn":9}'::jsonb),
  ('00000000-0000-0000-0000-000000000238', 'tun',    '{"umsetzung":9}'::jsonb),
  ('00000000-0000-0000-0000-000000000238', 'haben',  '{"kapital":7,"netzwerk":8}'::jsonb),
  ('00000000-0000-0000-0000-000000000238', 'wirken', '{"reichweite":8}'::jsonb);

delete from public.feedback where profile_id = '00000000-0000-0000-0000-000000000238';
insert into public.feedback (profile_id, ref_type, rating, note) values
  ('00000000-0000-0000-0000-000000000238', 'event', 5, 'Starker Beitrag beim Summit.'),
  ('00000000-0000-0000-0000-000000000238', 'match', 4, 'Gutes Match, schnelle Reaktion.');

-- 9. Score & Radar aus den obigen echten Daten berechnen (überschreibt die in
--    Schritt 2/3 gesetzten Demo-Werte mit dem regelbasierten Ergebnis). Im
--    Service/Seed-Kontext (auth.uid() = null) ist der Aufruf erlaubt.
select public.recompute_potential_score('00000000-0000-0000-0000-000000000238');
