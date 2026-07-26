# Messaging

## Purpose

Defines the one-to-one chat between two members. A conversation exists as a
single normalized thread per pair, and messages can only be exchanged once the
two members have an accepted contact request between them. Visibility and
write-permission are enforced in the database by RLS; realtime delivery reuses
the same policies. Reconstructed from the code as of the OpenSpec migration.

## Requirements

### Requirement: One thread per member pair

The system SHALL store conversations in `public.message_threads` with
`a_profile_id` and `b_profile_id`, and SHALL enforce a unique constraint on
`(a_profile_id, b_profile_id)` so at most one thread exists per pair. Threads
SHALL be created server-side with the pair normalized as
`(least(from_id,to_id), greatest(from_id,to_id))` and never re-created for a
pair that already has one.

#### Scenario: Thread is opened once on acceptance

- **WHEN** a contact request transitions to `accepted`
- **THEN** the lifecycle trigger inserts the normalized thread with
  `ON CONFLICT (a_profile_id, b_profile_id) DO NOTHING`, so re-acceptance never
  produces a duplicate

### Requirement: Thread visibility is limited to its participants

The system SHALL permit an authenticated member to SELECT a `message_threads`
row only when they are `a_profile_id` or `b_profile_id`, and SHALL permit a
thread INSERT only by a participant for whom an `accepted` contact request
exists between the two profiles.

#### Scenario: Non-participant cannot see a thread

- **WHEN** a member who is neither `a_profile_id` nor `b_profile_id` queries a
  thread
- **THEN** the `threads_select` policy returns no row

### Requirement: Messages carry sender and body within a thread

The system SHALL store messages in `public.messages` with `thread_id`,
`sender_id`, a non-null `body`, and `created_at`, each referencing an existing
`message_threads` row.

#### Scenario: Message is bound to a thread and sender

- **WHEN** a message is inserted
- **THEN** the row records its `thread_id`, `sender_id`, and `body`, and cascades
  on deletion of the parent thread

### Requirement: A member may read only messages in their own threads

The system SHALL permit an authenticated member to SELECT a `messages` row only
when they are a participant of the message's thread.

#### Scenario: Outsider cannot read messages

- **WHEN** a member who is not a participant of a thread queries that thread's
  messages
- **THEN** the `messages_select` policy returns no rows

### Requirement: Sending requires an accepted contact request

The system SHALL permit a `messages` INSERT only when `sender_id` equals the
caller, the caller participates in the target thread, AND an `accepted`
`contact_requests` row exists between the thread's two profiles; a message
SHALL NOT be sendable on a thread whose contact request is not accepted.

#### Scenario: Participant sends after acceptance

- **WHEN** a thread participant inserts a message with `sender_id = auth.uid()`
  and the pair's contact request is `accepted`
- **THEN** the `messages_insert` policy permits the INSERT

#### Scenario: Send is denied without acceptance

- **WHEN** a member attempts to insert a message on a thread whose contact
  request is not `accepted`
- **THEN** the INSERT is denied by RLS and the client rolls back the optimistic
  message and shows a "Nachricht nicht gesendet" error

#### Scenario: Spoofed sender is denied

- **WHEN** a member inserts a message with `sender_id` other than their own auth
  uid
- **THEN** the INSERT is denied by the policy's `sender_id = auth.uid()` check

### Requirement: New messages are delivered in realtime under RLS

The system SHALL publish `public.messages` INSERTs over the
`supabase_realtime` publication so participants receive live updates, and the
same `messages_select` RLS SHALL apply to realtime fan-out so a client receives
only message rows it is permitted to read.

#### Scenario: Participant receives a live message

- **WHEN** a message is inserted into a thread the member participates in and a
  realtime subscription for that thread is active
- **THEN** the member receives the new row live and it is merged idempotently
  into the conversation

#### Scenario: Realtime does not leak to non-participants

- **WHEN** a message is inserted into a thread a subscriber does not participate
  in
- **THEN** the subscriber receives no event, because realtime enforces
  `messages_select`
