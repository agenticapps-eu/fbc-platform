-- Contact-request lifecycle side-effects (AGE-247). Spec: docs/matching-spec.md §6.
--
-- ONE SECURITY DEFINER trigger on contact_requests performs every side-effect the
-- client is intentionally NOT allowed to do directly:
--   * matches.status transitions — `matches` has NO client UPDATE policy (AGE-235);
--     the lifecycle is server-managed on purpose.
--   * message_threads creation on acceptance — opens the chat (normalized pair,
--     idempotent via the unique constraint).
--   * in-app notifications for the OTHER party — `notifications_own` only lets a
--     member insert rows for THEMSELVES, so neither sender nor recipient could write
--     the counterparty's notification from the client.
--
-- Why a trigger and not client writes: the contact flow spans two members and three
-- tables on which the requester/recipient each lack the needed RLS rights. The
-- function is owned by the migration role and runs with definer rights, so it
-- bypasses RLS exactly like generate_matches_for (AGE-245) — and keeps the whole
-- lifecycle in ONE place. It is locked off the PostgREST RPC surface (trigger-only),
-- mirroring the handle_new_user lock-down.
--
-- Contact data (profile_contacts) is revealed PURELY by the existing RLS
-- (contacts_select_self_or_released, AGE-235) once a contact_request reaches
-- 'accepted'. This trigger does NOT touch profile_contacts — acceptance is the only
-- key, and the "no contact data before accepted" guarantee stays in the DB.

create or replace function public.handle_contact_request_change()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_from_name text;
  v_to_name   text;
begin
  if tg_op = 'INSERT' then
    -- New request → the originating match becomes 'requested'. Never downgrade an
    -- already-accepted pair; match_id is optional (profile-page requests may omit it).
    if new.match_id is not null then
      update public.matches
        set status = 'requested'
        where id = new.match_id and status = 'suggested';
    end if;

    select name into v_from_name from public.profiles where id = new.from_id;
    insert into public.notifications (profile_id, type, payload)
    values (
      new.to_id,
      'contact_request',
      jsonb_build_object(
        'request_id', new.id,
        'match_id',   new.match_id,
        'from_id',    new.from_id,
        'from_name',  v_from_name,
        'message',    new.message
      )
    );
    return new;
  end if;

  -- UPDATE: only react to an actual status change (e.g. accept / decline).
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    select name into v_to_name from public.profiles where id = new.to_id;

    if new.status = 'accepted' then
      if new.match_id is not null then
        update public.matches set status = 'accepted' where id = new.match_id;
      end if;
      -- Open the chat: create the (normalized, unique) thread if absent.
      insert into public.message_threads (a_profile_id, b_profile_id)
      values (least(new.from_id, new.to_id), greatest(new.from_id, new.to_id))
      on conflict (a_profile_id, b_profile_id) do nothing;

      insert into public.notifications (profile_id, type, payload)
      values (
        new.from_id,
        'contact_request_accepted',
        jsonb_build_object(
          'request_id', new.id, 'match_id', new.match_id,
          'to_id', new.to_id, 'to_name', v_to_name
        )
      );

    elsif new.status = 'declined' then
      -- Mirror onto the match, but never undo an acceptance.
      if new.match_id is not null then
        update public.matches set status = 'declined'
          where id = new.match_id and status <> 'accepted';
      end if;

      insert into public.notifications (profile_id, type, payload)
      values (
        new.from_id,
        'contact_request_declined',
        jsonb_build_object(
          'request_id', new.id, 'match_id', new.match_id,
          'to_id', new.to_id, 'to_name', v_to_name
        )
      );
    end if;
  end if;

  return new;
end;
$$;

comment on function public.handle_contact_request_change() is
  'AGE-247 contact-request lifecycle: on INSERT sets the originating match to '
  '''requested'' and notifies the recipient; on status→accepted sets the match to '
  '''accepted'', opens the message thread, and notifies the sender; on status→declined '
  'sets the match to ''declined'' (never undoing an acceptance) and notifies the sender. '
  'SECURITY DEFINER — writes matches/message_threads/notifications the two members '
  'cannot write under RLS. Contact data stays gated by contacts_select_self_or_released; '
  'acceptance is the only key.';

-- Trigger-only helper: keep it off the REST RPC surface (mirrors handle_new_user).
revoke execute on function public.handle_contact_request_change() from public, anon, authenticated;

create trigger contact_requests_lifecycle
  after insert or update on public.contact_requests
  for each row execute function public.handle_contact_request_change();
