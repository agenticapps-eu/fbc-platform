# Events

## Purpose

Defines the FBC events capability: the event catalog (online, presence, dinner,
workshop, mastermind formats), member registration with automatic waitlisting on
full capacity, host tools (attendee list, check-in), and post-event ratings.
Visibility and participation are enforced in the database via RLS and
`SECURITY DEFINER` RPCs keyed on membership tier rank. Reconstructed from the code
as of the OpenSpec migration; the retired `prime`/`legacy` visibility values were
folded into `members`.
## Requirements
### Requirement: Events describe format, timing, host, and capacity

The system SHALL store each event with a non-null `title`, an optional `type`
constrained to `online`, `presence`, `dinner`, `workshop`, or `mastermind`, an
optional `starts_at` and `location`, an optional `host_id` (a profile) and
`host_partner_id` (a partner), a `visibility` constrained to `public` or `members`
(default `public`), an optional integer `capacity`, and a `created_at`. Deleting a
referenced host profile or partner SHALL null the corresponding host column rather
than delete the event.

#### Scenario: An event is created with a valid type

- **WHEN** a host creates an event with `type = 'workshop'` and no `capacity`
- **THEN** the row is stored with `visibility = 'public'`, unlimited capacity
  (null), and a generated `id`

#### Scenario: An unsupported type is rejected

- **WHEN** a write sets an event `type` outside the allowed set
- **THEN** the write is rejected by the type check constraint

### Requirement: Events are visible to all authenticated members

The system SHALL, via RLS, permit any authenticated **and activated** member to
read every event whose `visibility` is `public` or `members`, and additionally
permit the host to read their own event. Tiering SHALL sit on participation, not
on visibility — but activation SHALL sit in front of both. An account that holds
a session without having confirmed its address SHALL read no events at all.

#### Scenario: A basic member sees a members-visibility event

- **WHEN** an authenticated, activated member of any tier reads the events list
- **THEN** both `public` and `members` events are returned

#### Scenario: An unconfirmed account sees no events

- **WHEN** an authenticated member whose account is not yet activated reads the
  events list
- **THEN** no events are returned, including `public` ones

#### Scenario: Host sees their own event

- **WHEN** an activated member reads an event they host
- **THEN** the event is returned regardless of the caller's tier

### Requirement: Registrations are unique per member with tracked status

The system SHALL store each registration with an `event_id`, a `profile_id`, a
`status` constrained to `registered`, `waitlist`, or `cancelled` (default
`registered`), a boolean `checked_in` (default false), an optional `rating`
between 1 and 5, and a `unique (event_id, profile_id)` constraint so a member has
at most one registration per event. A member SHALL read only their own
registration rows, while the host reads all rows for their event.

#### Scenario: Duplicate registration collapses to one row

- **WHEN** a member registers for an event they already have a row for
- **THEN** no second row is created; the existing row is updated (unique
  constraint on `event_id, profile_id`)

#### Scenario: Attendee visibility is scoped

- **WHEN** a non-host member queries registrations for an event
- **THEN** only their own registration row is returned; the host querying the same
  event sees all attendee rows

#### Scenario: Rating is bounded

- **WHEN** a write sets `rating` outside 1..5
- **THEN** the write is rejected by the rating check constraint

### Requirement: Registration goes through a capacity-aware RPC with a visibility-dependent threshold

The system SHALL register a member through the `SECURITY DEFINER` function
`register_for_event(uuid)`, which locks the event row to serialize concurrent
sign-ups, assigns `registered` while `capacity` is null or unfilled and otherwise
`waitlist`, and enforces a participation threshold that depends on the event's
visibility: for `public` events any authenticated member (including `basic`) may
register, while for `members` events the caller must hold at least `discover`
(rank 3) or be the host.

The function SHALL additionally require the caller's account to be **activated**,
and SHALL apply that requirement to `public` events as well. This is a
deliberate behavioural change (AGE-495): a self-registered guest who was usable
immediately SHALL now confirm their address before signing up for anything,
including a public event. The cost is accepted because the alternative — one
ungated write path into member data — would make the gate a matter of taste
rather than a boundary. The threshold by tier SHALL remain unchanged behind it.

#### Scenario: Sign-up past capacity goes to the waitlist

- **WHEN** an activated member registers for a `registered`-full event with a set
  `capacity`
- **THEN** the function returns `waitlist` and stores the row with
  `status = 'waitlist'`

#### Scenario: Public event admits a basic member

- **WHEN** a `basic` (rank 1) authenticated **and activated** member registers
  for a `public` event
- **THEN** registration succeeds

#### Scenario: An unconfirmed account cannot register for a public event

- **WHEN** an authenticated member whose account is not yet activated registers
  for a `public` event
- **THEN** the function raises `not activated` and no registration row is
  written

#### Scenario: Members event requires discover

- **WHEN** an authenticated, activated member below `discover` (rank 3) registers
  for a `members` event they do not host
- **THEN** the function raises `membership level too low to register`

### Requirement: Only the host may set attendee check-in

The system SHALL set `event_registrations.checked_in` exclusively through the
`SECURITY DEFINER` function `set_event_check_in(uuid, boolean)`, which updates the
row only when the caller is the host of the registration's event. A member cancels
(`status = 'cancelled'`) or rates their own registration directly under
`regs_write_own`.

#### Scenario: Non-host check-in is refused

- **WHEN** a member who does not host the event calls `set_event_check_in`
- **THEN** the function raises `not the host of this event` and no row changes

#### Scenario: Host checks in an attendee

- **WHEN** the event host calls `set_event_check_in` for one of their event's
  registrations
- **THEN** that registration's `checked_in` is updated

### Requirement: Registration counts are aggregate-only and the RPC path is the safe path

The system SHALL expose per-event `registered` and `waitlist` counts through the
`SECURITY DEFINER` function `event_registration_counts(uuid[])`, which returns only
numeric counts for events the caller can already see and caps the input array at
200 ids. Direct table writes permitted by `regs_write_own` (which also requires
rank ≥ `exchange`) SHALL be treated as a known constraint: they bypass the RPC's
capacity/waitlist assignment and row lock, so overbooking protection holds only on
the `register_for_event` path.

#### Scenario: Counts expose numbers, not attendees

- **WHEN** a member calls `event_registration_counts` for a visible event
- **THEN** the result contains only `event_id`, `registered_count`, and
  `waitlist_count`, never attendee identities

#### Scenario: Direct write bypasses capacity logic (known constraint)

- **WHEN** a member with rank ≥ `exchange` inserts an
  `event_registrations` row directly instead of calling `register_for_event`
- **THEN** the write is accepted by `regs_write_own` without the capacity-based
  waitlist assignment, so overbooking is prevented only via the RPC

