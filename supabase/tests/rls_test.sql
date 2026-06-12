-- P5 RLS tests (AGE-235) — run with `supabase test db`. Verifies tier-based
-- visibility per docs/rls-policies.md across Discover / Prime / Legacy.
--
-- RLS only engages when current_user is a non-owner role, so each check runs the
-- sensitive operation as `authenticated` with the member's JWT sub, then RESETs
-- back so the pgTAP assertions themselves execute as the (superuser) test session.
-- The whole thing runs inside the implicit pgTAP transaction and never commits.

begin;
select plan(17);

-- ── fixtures (seeded as the superuser test role → bypasses RLS) ───────────────
-- Three members; auth.users insert fires handle_new_user(), which provisions the
-- matching public.profiles row.
insert into auth.users (id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'discover@test.fbc'),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'prime@test.fbc'),
  ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'legacy@test.fbc');

update public.profiles set tier = 'discover', name = 'Discover', is_public = true
  where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set tier = 'prime', name = 'Prime', is_public = true
  where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set tier = 'legacy', name = 'Legacy', is_public = true
  where id = '33333333-3333-3333-3333-333333333333';

-- Prime and Legacy each author an offer; Prime has contact data.
insert into public.offers (profile_id, title) values
  ('22222222-2222-2222-2222-222222222222', 'Prime offer'),
  ('33333333-3333-3333-3333-333333333333', 'Legacy offer');
insert into public.profile_contacts (profile_id, email) values
  ('22222222-2222-2222-2222-222222222222', 'prime-contact@test.fbc');
-- Legacy-visibility post authored by LEGACY: the policy lets an author always see
-- their own post, so it must be authored by someone other than Prime to actually
-- exercise the rank>=7 gate against Prime. A comment on it checks that interaction
-- rows inherit the parent post's visibility.
insert into public.posts (id, author_id, body, visibility) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'A legacy-only post', 'legacy');
insert into public.comments (post_id, author_id, body) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'secret legacy comment');

-- A thread Discover<->Prime with NO accepted contact_request, to prove message
-- gating independently of thread gating (a service-role engine could create one).
insert into public.message_threads (a_profile_id, b_profile_id) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- ── role-impersonation helpers ───────────────────────────────────────────────
-- count_as: scalar query result under a member's identity.
create function pg_temp.count_as(uid uuid, q text) returns int language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute q into n;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return n;
end $$;

-- try_as: 'OK' if the statement succeeds under the member's identity, else 'DENIED:<err>'.
-- The statement runs in a subtransaction so a denial never aborts the test tx.
create function pg_temp.try_as(uid uuid, q text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q;
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    return 'DENIED:' || SQLERRM;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'OK';
end $$;

-- ── 1. Discover: directory yes, search profiles / offers no, contact send no ─
select is(
  pg_temp.count_as('11111111-1111-1111-1111-111111111111',
    'select count(*)::int from public.profiles_public where id = ''22222222-2222-2222-2222-222222222222'''),
  1, 'Discover sees Prime in the public directory (profiles_public)');

select is(
  pg_temp.count_as('11111111-1111-1111-1111-111111111111',
    'select count(*)::int from public.profiles where id = ''22222222-2222-2222-2222-222222222222'''),
  0, 'Discover cannot read another member''s full profile row (extended fields)');

select is(
  pg_temp.count_as('11111111-1111-1111-1111-111111111111',
    'select count(*)::int from public.offers where profile_id = ''33333333-3333-3333-3333-333333333333'''),
  0, 'Discover sees no foreign offers');

select like(
  pg_temp.try_as('11111111-1111-1111-1111-111111111111',
    'insert into public.contact_requests (from_id, to_id) values (''11111111-1111-1111-1111-111111111111'', ''22222222-2222-2222-2222-222222222222'')'),
  'DENIED:%', 'Discover cannot send a contact request (rank < Prime)');

-- ── 2. Prime: sees foreign offers, can send a contact request ────────────────
select is(
  pg_temp.count_as('22222222-2222-2222-2222-222222222222',
    'select count(*)::int from public.offers where profile_id = ''33333333-3333-3333-3333-333333333333'''),
  1, 'Prime sees a foreign (Legacy) offer');

select is(
  pg_temp.try_as('22222222-2222-2222-2222-222222222222',
    'insert into public.contact_requests (from_id, to_id) values (''22222222-2222-2222-2222-222222222222'', ''33333333-3333-3333-3333-333333333333'')'),
  'OK', 'Prime can send a contact request');

-- ── 3. Messaging gated on an accepted contact request ────────────────────────
select like(
  pg_temp.try_as('22222222-2222-2222-2222-222222222222',
    'insert into public.message_threads (a_profile_id, b_profile_id) values (''22222222-2222-2222-2222-222222222222'', ''33333333-3333-3333-3333-333333333333'')'),
  'DENIED:%', 'Thread blocked while the contact request is only pending');

select is(
  pg_temp.try_as('33333333-3333-3333-3333-333333333333',
    'update public.contact_requests set status = ''accepted'' where from_id = ''22222222-2222-2222-2222-222222222222'' and to_id = ''33333333-3333-3333-3333-333333333333'''),
  'OK', 'Recipient (Legacy) accepts the contact request');

select is(
  pg_temp.try_as('22222222-2222-2222-2222-222222222222',
    'insert into public.message_threads (a_profile_id, b_profile_id) values (''22222222-2222-2222-2222-222222222222'', ''33333333-3333-3333-3333-333333333333'')'),
  'OK', 'Thread allowed once the contact request is accepted');

select like(
  pg_temp.try_as('22222222-2222-2222-2222-222222222222',
    'insert into public.messages (thread_id, sender_id, body) select id, ''22222222-2222-2222-2222-222222222222'', ''hi'' from public.message_threads where a_profile_id = ''11111111-1111-1111-1111-111111111111'' and b_profile_id = ''22222222-2222-2222-2222-222222222222'''),
  'DENIED:%', 'Message INSERT fails without an accepted contact request');

select is(
  pg_temp.try_as('22222222-2222-2222-2222-222222222222',
    'insert into public.messages (thread_id, sender_id, body) select id, ''22222222-2222-2222-2222-222222222222'', ''hi'' from public.message_threads where a_profile_id = ''22222222-2222-2222-2222-222222222222'' and b_profile_id = ''33333333-3333-3333-3333-333333333333'''),
  'OK', 'Message INSERT succeeds after the contact request is accepted');

-- ── 4. profile_contacts readable only after release ──────────────────────────
select is(
  pg_temp.count_as('33333333-3333-3333-3333-333333333333',
    'select count(*)::int from public.profile_contacts where profile_id = ''22222222-2222-2222-2222-222222222222'''),
  1, 'Prime''s contact data is readable by Legacy after acceptance');

select is(
  pg_temp.count_as('11111111-1111-1111-1111-111111111111',
    'select count(*)::int from public.profile_contacts where profile_id = ''22222222-2222-2222-2222-222222222222'''),
  0, 'Prime''s contact data is hidden from Discover (no accepted request)');

-- ── 5. posts visibility='legacy' ─────────────────────────────────────────────
select is(
  pg_temp.count_as('22222222-2222-2222-2222-222222222222',
    'select count(*)::int from public.posts where visibility = ''legacy'''),
  0, 'A legacy-visibility post is invisible to Prime');

select is(
  pg_temp.count_as('33333333-3333-3333-3333-333333333333',
    'select count(*)::int from public.posts where visibility = ''legacy'''),
  1, 'A legacy-visibility post is visible to Legacy');

-- ── 6. interaction rows inherit parent-post visibility (security follow-up) ───
select is(
  pg_temp.count_as('22222222-2222-2222-2222-222222222222',
    'select count(*)::int from public.comments where post_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''),
  0, 'Comment on a legacy-visibility post is hidden from Prime');

select is(
  pg_temp.count_as('33333333-3333-3333-3333-333333333333',
    'select count(*)::int from public.comments where post_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''),
  1, 'Comment on a legacy-visibility post is visible to Legacy');

select * from finish();
rollback;
