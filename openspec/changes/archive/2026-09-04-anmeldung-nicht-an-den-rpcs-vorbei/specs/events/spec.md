## MODIFIED Requirements

### Requirement: Only the host may set attendee check-in

The system SHALL set `event_registrations.checked_in` exclusively through the
`SECURITY DEFINER` function `set_event_check_in(uuid, boolean)`, which updates the
row only when the caller is the host of the registration's event.

**„Exclusively" SHALL be enforced by a column privilege, not merely by
convention.** The role `authenticated` SHALL NOT hold `UPDATE` on the column
`checked_in`; its update privilege SHALL be granted per column and SHALL cover
only the columns a member may legitimately set on their own row (`status`,
`rating`). A privilege is a statement about the column itself and therefore keeps
holding if the row-level policy is ever widened — which a condition inside that
policy would not.

The function is unaffected by this restriction because it is `SECURITY DEFINER`
and runs with the privileges of its owner, not of `authenticated`.

A member cancels (`status = 'cancelled'`) or rates their own registration
directly under `regs_write_own`.

#### Scenario: Non-host check-in is refused

- **WHEN** a member who does not host the event calls `set_event_check_in`
- **THEN** the function raises `not the host of this event` and no row changes

#### Scenario: Host checks in an attendee

- **WHEN** the event host calls `set_event_check_in` for one of their event's
  registrations
- **THEN** that registration's `checked_in` is updated

#### Scenario: A member cannot check themselves in by writing the column

- **WHEN** an activated member updates their own `event_registrations` row and
  sets `checked_in = true` directly, bypassing the function
- **THEN** the write is refused for lack of privilege on that column, and
  `checked_in` keeps its value

#### Scenario: Cancelling and rating stay possible

- **WHEN** a member of rank ≥ `exchange` updates their own row to
  `status = 'cancelled'`, or writes a `rating`
- **THEN** both writes succeed — the column privilege narrows what may be
  written, it does not close the row
- **AND** this holds even when the host has already set `checked_in` on that row

<!-- „rank >= exchange" steht hier ausdruecklich, weil `regs_write_own`
     `has_level(4)` verlangt, waehrend `register_for_event` oeffentliche Events
     ab `basic` und Mitglieder-Events ab `has_level(3)` zulaesst. Wer darunter
     liegt, kann sich anmelden, aber nicht direkt absagen. Das ist BESTAND und
     nicht Gegenstand dieses Changes; die Schwellen anzugleichen waere eine
     Rechteaenderung. Befund aus der Planungs-Review (codex, MEDIUM) — hier
     benannt statt stillschweigend falsch zugesichert. -->

### Requirement: Registration counts are aggregate-only and the RPC path is the safe path

<!-- Die Ueberschrift bleibt WOERTLICH die alte, obwohl der Inhalt sich umkehrt:
     OpenSpec ordnet ein MODIFIED ueber die Ueberschrift zu. Mit einer neuen
     Ueberschrift bliebe die alte Anforderung stehen und die neue kaeme daneben —
     zwei Anforderungen, die einander widersprechen. Ein Umbenennen waere ein
     REMOVED plus ADDED, also genau die Archiv-Mechanik, an der AGE-598 Zeit
     verloren hat. Der Satz „the RPC path is the safe path" stimmt nach diesem
     Change weiterhin; er ist nur nicht mehr der EINZIGE sichere Pfad, sondern
     der einzige moegliche. -->

The system SHALL expose per-event `registered` and `waitlist` counts through the
`SECURITY DEFINER` function `event_registration_counts(uuid[])`, which returns only
numeric counts for events the caller can already see and caps the input array at
200 ids.

**Overbooking protection SHALL NOT depend on which path a client takes.**
`register_for_event` remains the only place that assigns `registered` or
`waitlist` against `events.capacity` under a row lock — and the direct table path
SHALL NOT be able to reach the same result:

- The role `authenticated` SHALL NOT be able to INSERT into
  `event_registrations`; a registration row comes into existence only through
  `register_for_event`.
- A member SHALL NOT be able to move their own row **into** `status =
  'registered'`. This is a transition, not a value: it compares the old row to
  the new one and therefore SHALL be enforced by a trigger, since a row-level
  `with check` condition cannot see the old row and would have to forbid
  `registered` outright — which would break writing a rating on an already
  registered row.
- The guard SHALL work in **two layers**, and the lower one SHALL NOT depend on
  who is writing. Layer one checks the capacity invariant itself for **every**
  path into `status = 'registered'`, the `SECURITY DEFINER` functions included;
  it is the guarantee that holds even if an assumption about roles or ownership
  later stops being true. Layer two forbids the direct status change and SHALL be
  written as an **exclusion** — everything except the functions' owner is
  refused — so that an unknown or future role is blocked rather than let
  through. A rule phrased as `current_user = 'authenticated'` would fail **open**
  and SHALL NOT be used.
- The two layers SHALL be **two separate triggers**, because they require
  opposite privilege models. Layer two SHALL be `SECURITY INVOKER`, since it can
  only distinguish callers through a meaningful `current_user`. Layer one SHALL
  be `SECURITY DEFINER`, since it SHALL count **all** registrations of the
  event: read under the writer's own row-level security it sees only that
  member's rows, counts zero occupied seats and lets the overbooking through.
  A single `SECURITY INVOKER` trigger carrying both layers therefore fails
  **open** on exactly the guarantee layer one is supposed to make, and SHALL NOT
  be used.
- Layer one SHALL also fire when a row that already holds `status = 'registered'`
  changes its `event_id`, since the status does not change on that path while the
  seat at the target event is newly taken.
- Neither trigger function SHALL be executable by `public`, `anon`,
  `authenticated` or `service_role`. A trigger's `EXECUTE` privilege is checked
  when the trigger is created, not when it fires, so both keep working; without
  the revoke, layer one would additionally be a tool for computing the occupancy
  of events the caller cannot see.

`regs_write_own` SHALL therefore permit UPDATE only, not INSERT or DELETE. A
registration is cancelled (`status = 'cancelled'`), never deleted — deleting it
would additionally circumvent the uniqueness of `(event_id, profile_id)`.

#### Scenario: Counts expose numbers, not attendees

- **WHEN** a member calls `event_registration_counts` for a visible event
- **THEN** the result contains only `event_id`, `registered_count`, and
  `waitlist_count`, never attendee identities

#### Scenario: Direct write bypasses capacity logic (known constraint)

<!-- Der TITEL bleibt woertlich stehen, obwohl er jetzt das Gegenteil des Rumpfes
     behauptet — und das ist Absicht. `openspec archive` ordnet ein Szenario
     ueber seine Ueberschrift zu; ein neuer Titel wuerde das alte nicht mehr
     finden und es beim Falten still LOESCHEN. Genau daran hat der Archivierer
     diesen Change am 04.09. abgebrochen, zu Recht: der erste Entwurf des Deltas
     hatte die Zusage unter neuem Namen („A direct insert cannot create a
     registration") danebengestellt, statt die alte umzudrehen.

     Die Bedingung wird also im RUMPF geschaerft, nie im Titel. Dass „(known
     constraint)" nach diesem Change keine Einschraenkung mehr benennt, ist der
     Preis dafuer, dass die Zeile nachvollziehbar dieselbe bleibt. -->

- **WHEN** an activated member with rank ≥ `exchange` inserts an
  `event_registrations` row directly instead of calling `register_for_event`
- **THEN** the insert is refused for lack of privilege, and no row is created —
  the constraint this scenario used to record is lifted: overbooking is no
  longer prevented "only via the RPC"

#### Scenario: A member cannot promote themselves off the waitlist

- **WHEN** a member whose own row holds `status = 'waitlist'` for a full event
  updates it to `status = 'registered'`
- **THEN** the trigger refuses the transition and the row keeps `waitlist`

#### Scenario: A member cannot move their registration to another event

- **WHEN** a member updates `event_id` on their own `registered` row to point at
  a different, full event
- **THEN** the write is refused — `event_id`, `profile_id`, `id` and `created_at`
  SHALL NOT be updatable by `authenticated`

#### Scenario: The capacity layer holds on its own

<!-- Die vier Wege scheitern schon an den Spaltenrechten. Ohne dieses Szenario
     bliebe die Abnahme gruen, waehrend Schicht 1 vollstaendig wirkungslos ist —
     sie kaeme nie zum Zug. Genau das war der Fall, bis es gemessen wurde. -->

- **GIVEN** the column and table privileges are widened again, so that
  `authenticated` may insert rows and write `event_id`
- **WHEN** such a write would put a row into `status = 'registered'` at an event
  that is already at capacity — whether by insert or by moving an already
  registered row to that event
- **THEN** layer one refuses it on its own, naming the capacity as the reason

#### Scenario: A refusal names the mechanism that actually applied

- **WHEN** a member directly moves their own row into `status = 'registered'` at
  an event that is **also** at capacity
- **THEN** the refusal names the direct status change, not the capacity — layer
  two applies before layer one

#### Scenario: The RPC path is unaffected on insert

- **WHEN** a member calls `register_for_event` for an event with free capacity
- **THEN** the row is created with `status = 'registered'`
- **AND WHEN** the same call is made for an event at capacity
- **THEN** the row is created with `status = 'waitlist'`

#### Scenario: The RPC path is unaffected on re-registration

<!-- `register_for_event` endet auf
     `insert … on conflict (event_id, profile_id) do update set status = …`.
     Eine Wiederanmeldung laeuft also ueber den UPDATE-Zweig — genau dort, wo der
     neue Trigger feuert. Ohne dieses Szenario koennte der Change diesen Weg
     sperren, waehrend ein Test, der nur den INSERT-Zweig prueft, gruen bleibt.
     Befund aus der Planungs-Review (codex, HIGH). -->

- **WHEN** a member whose own row holds `status = 'cancelled'` calls
  `register_for_event` again for an event with free capacity
- **THEN** the existing row moves to `status = 'registered'`
- **AND WHEN** a member on the waitlist calls it again after capacity freed up
- **THEN** their row moves to `status = 'registered'`
