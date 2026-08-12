## MODIFIED Requirements

### Requirement: The event detail page shows the content of the event

The system SHALL render the detail page with the cover as a header carrying the
start date, the title and type, the time span, the location, the description,
the topics as a checked list, the host with avatar and a link to their profile,
the attendee row, the registration control with capacity and waitlist, and
similar events.

The page SHALL arrange these as **cards**, following
`docs/mockups/event-detail-2026-07-29.png`: a hero card carrying cover, type,
title, host and the registration control; below it a row of "Details", "Themen"
and "Veranstalter"; below that "Beschreibung" beside "Teilnehmer". A list of the
right elements in the wrong arrangement SHALL NOT count as satisfying this
requirement — the first implementation contained every field and still read as
incomplete. On narrow viewports the cards SHALL stack in that order.

The "Details" block SHALL name the visibility in words — "Offen für alle
Mitglieder" or "Nur für Mitglieder" — because that question arises exactly when
someone considers registering.

The host SHALL appear twice and deliberately: once in the hero as a line
("Veranstaltet von" plus name), and once as its own card with avatar, name,
role and company, short biography and a link to the profile. All of it SHALL
come from `profiles_public`, which the page already queries; absent fields SHALL
simply be omitted rather than leaving empty labels.

A block whose content is absent SHALL be omitted entirely rather than rendered
empty, and the remaining cards SHALL close the gap.

The host block and the attendee row SHALL be rendered **only with a session**.
Without one, neither `profiles_public` nor `partners` nor `event_attendees`
SHALL be queried, and the event SHALL appear without host and without
attendees. This preserves the existing requirement that the event pages resolve
no hosts without a session; the page SHALL remain reachable either way.

The attendee row SHALL show at most five avatars followed by `+n` for the
remainder, and SHALL name the total from `event_registration_counts`. Because
`event_attendees` omits members outside the directory, the total MAY exceed the
number of avatars and their `+n`; the row SHALL NOT recompute the total from
the rows it received.

Similar events SHALL be the three next upcoming events of the same `type`,
excluding the event itself, filled up with the next upcoming events overall
when fewer than three qualify. They SHALL come from the same query as the
events list and SHALL be fetched when that query has not run, so a direct link,
a reload or a bookmark shows them as a navigation from the list would. They
SHALL carry a link to the full list.

Time spans SHALL render as a single range when start and end fall on the same
day and SHALL name both dates otherwise. An event without `ends_at` SHALL show
only its start.

#### Scenario: An event with an end shows a span

- **WHEN** an event has `starts_at` and `ends_at` on the same day
- **THEN** the page shows one date with a start and end time

#### Scenario: An event without an end shows only the start

- **WHEN** an event has no `ends_at`
- **THEN** the page shows the start date and time and no range

#### Scenario: The visibility is stated in words

- **WHEN** a `members` event is rendered
- **THEN** the details block says it is for members only, and a `public` event
  says it is open to everyone

#### Scenario: The host card carries role and biography

- **WHEN** the host's profile has a company, roles and a short biography
- **THEN** the host card shows them alongside a link to that profile

#### Scenario: A host without a biography leaves no empty label

- **WHEN** the host's profile has neither company nor biography
- **THEN** the card shows name and avatar only, with no empty rows

#### Scenario: The total may exceed the visible faces

- **WHEN** an event has attendees whose profiles are not public
- **THEN** the row names the full total while showing only the resolvable
  attendees as avatars

#### Scenario: Similar events exclude the current one

- **WHEN** the detail page of an event renders similar events
- **THEN** the event itself is not among them

#### Scenario: A direct link still shows similar events

- **WHEN** the detail page is opened directly, without the events list having
  been visited in this session
- **THEN** similar events are fetched and rendered

#### Scenario: Without a session the page shows no host and no attendees

- **WHEN** a visitor without a session opens a public event's detail page
- **THEN** neither `profiles_public` nor `partners` nor `event_attendees` is
  queried
- **AND** the event renders without host and without an attendee row
- **AND** the console stays free of `42501`
