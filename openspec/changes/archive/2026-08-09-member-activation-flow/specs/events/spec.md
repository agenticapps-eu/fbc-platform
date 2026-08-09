## MODIFIED Requirements

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
