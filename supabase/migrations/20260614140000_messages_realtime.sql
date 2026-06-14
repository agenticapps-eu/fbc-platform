-- Realtime chat (AGE-248, §9): publish public.messages over Supabase Realtime.
--
-- The tables and RLS already exist (20260612065636_matching.sql,
-- 20260612082726_rls_policies.sql §6). The only missing piece is that `messages`
-- is not in the `supabase_realtime` publication, so Postgres emits no change
-- events and the chat would never update live.
--
-- Adding the table to the publication is enough for INSERT fan-out; Supabase
-- applies the table's RLS to Realtime, so a client only receives a message row it
-- could SELECT under `messages_select` (i.e. only thread participants). No extra
-- policy is required. REPLICA IDENTITY stays default — the chat consumes INSERTs
-- only (no UPDATE/DELETE realtime), and the default identity carries the new row.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
