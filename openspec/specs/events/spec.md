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
constrained to `online`, `presence`, `dinner`, `workshop`, or `mastermind`, a
**non-null** `starts_at`, an optional `ends_at`, an optional `location`, an
optional `description`, an optional `cover_path`, optional `topics`, an optional
`host_id` (a profile) and `host_partner_id` (a partner), a `visibility`
constrained to `public` or `members` (default `public`), an optional integer
`capacity`, and a `created_at`. Deleting a referenced host profile or partner
SHALL null the corresponding host column rather than delete the event.

`starts_at` SHALL be `not null`. An event without a date is meaningless as
content and breaks the chronological ordering the list and both tabs rely on.

`ends_at` SHALL be constrained by `ends_at is null or ends_at > starts_at`, so
an event cannot end before it begins while the end remains optional.

`cover_path` SHALL hold a **storage path** into the private bucket
`event-covers`, never a URL: a private bucket yields no durable URL, only a
path plus a time-limited signature. It SHALL be `unique`, because the bucket's
visibility function resolves the owning event through exactly this column and
two rows on one path would make that answer ambiguous.

`cover_path` SHALL be bound to the writing host: a write SHALL be rejected
unless the path's first segment equals the caller's uid, or the path is null.
Uniqueness alone SHALL NOT be relied upon for this, because it stops holding
the moment the original row is unlinked and the object is left orphaned.

#### Scenario: A foreign cover path is refused on write

- **WHEN** a host sets `cover_path` to a path whose first segment is another
  member's uid
- **THEN** the write is rejected

`topics` SHALL be a `text[]` of free-text agenda points for this one event. It
SHALL NOT reference `public.tags`: those fifteen curated values are an
editorial list for the activity feed and do not describe an agenda.

#### Scenario: An event is created with a valid type

- **WHEN** a host creates an event with `type = 'workshop'`, a `starts_at` and
  no `capacity`
- **THEN** the row is stored with `visibility = 'public'`, unlimited capacity
  (null), and a generated `id`

#### Scenario: An unsupported type is rejected

- **WHEN** a write sets an event `type` outside the allowed set
- **THEN** the write is rejected by the type check constraint

#### Scenario: An event without a start is rejected

- **WHEN** a write creates an event with `starts_at` null
- **THEN** the write is rejected by the not-null constraint

#### Scenario: An end before the start is rejected

- **WHEN** a write sets `ends_at` earlier than or equal to `starts_at`
- **THEN** the write is rejected by the check constraint

#### Scenario: An open end is accepted

- **WHEN** a write sets `starts_at` and leaves `ends_at` null
- **THEN** the write is accepted

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
registration rows **from the table**, while the host reads all rows for their
event.

Attendee identities beyond one's own row SHALL be reachable only through
`event_attendees(uuid)`. The table-level policy `regs_select_self_or_host`
SHALL remain unchanged, so `checked_in` and `rating` of a foreign registration
stay unreadable: row-level security is row-level, not column-level, and opening
the policy would disclose a member's rating alongside their name.

#### Scenario: Duplicate registration collapses to one row

- **WHEN** a member registers for an event they already have a row for
- **THEN** no second row is created; the existing row is updated (unique
  constraint on `event_id, profile_id`)

#### Scenario: Attendee visibility is scoped

- **WHEN** a non-host member queries registrations for an event
- **THEN** only their own registration row is returned; the host querying the same
  event sees all attendee rows

#### Scenario: A foreign rating stays unreadable

- **WHEN** a member reads the attendees of an event they do not host
- **THEN** no `rating` and no `checked_in` value of another member is returned

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

### Requirement: Ohne Session löst die Eventliste keine Hosts auf

Der Client SHALL Hosts eines Events nur mit einer Session auflösen. Ohne
Session SHALL er **weder** `profiles_public` **noch** `partners` abfragen; ein
Event SHALL dann ohne Host-Angabe erscheinen.

Beide Quellen sind für `anon` gesperrt — `partners` trägt sein `select`
ausschließlich für `authenticated` und die Anforderung „Partner reads are gated
behind authentication" verlangt genau das. Eine Regel, die nur die
Profil-Hälfte überspränge, ließe die zweite Abweisung stehen.

Die Eventseiten SHALL für Nicht-Mitglieder erreichbar bleiben; die Regel
betrifft die Anreicherung, nicht den Zugang.

#### Scenario: Ausgeloggt wird kein Host abgefragt

- **WHEN** ein ausgeloggter Besucher die Eventliste oder ein einzelnes Event
  öffnet und die Events Profil- und Partner-Hosts tragen
- **THEN** wird weder `profiles_public` noch `partners` abgefragt
- **AND** die Events erscheinen ohne Host-Angabe
- **AND** die Konsole bleibt frei von `42501`

#### Scenario: Eingeloggt bleiben beide Host-Arten unverändert

- **WHEN** ein authentifiziertes, aktiviertes Mitglied dieselben Events öffnet
- **THEN** werden `profiles_public` und `partners` wie bisher abgefragt
- **AND** ein Partner-Host erscheint mit Name und Logo, ein über
  `profiles_public` sichtbarer Profil-Host mit Name, Avatarbild und Stufe
- **AND** ein Partner-Host hat weiterhin Vorrang vor einem Profil-Host

### Requirement: Attendees of a visible event are resolvable by activated members

The system SHALL expose the attendees of an event through the `SECURITY
DEFINER` function `event_attendees(uuid)`, which returns `profile_id` and
`status` for the registrations of the given event, ordered by `created_at`.

The function SHALL return rows only when all of the following hold: the caller
holds a session, the caller's account is **activated**, and the event's
`visibility` is `public` or `members` or the caller is its host. It SHALL
return only registrations with `status = 'registered'` to callers other than
the host — a cancellation and a waitlist position are nobody else's business —
while the host SHALL see every status.

The function SHALL return only attendees whose own profile is **public and
activated**, the same condition `profiles_public` applies. A member who has
withdrawn from the directory SHALL NOT have their `profile_id` disclosed here:
a stable UUID on the wire is a disclosure that a "Ein Mitglied" label in the
interface does not undo, and it correlates with everything else visible about
that account.

Consequently the attendee **total** MAY exceed the number of resolvable
attendees. The total SHALL keep coming from `event_registration_counts` and
SHALL stay complete rather than silently counting only the visible ones.

`execute` SHALL be granted to `authenticated` only. A visitor without a session
SHALL learn no attendees, not even for a `public` event.

The function SHALL NOT return `checked_in` or `rating`. Those belong to the
host tooling, which reads them through the unchanged table policy.

#### Scenario: An activated member sees who is coming

- **WHEN** an authenticated, activated member calls `event_attendees` for an
  event they may see but do not host
- **THEN** the `profile_id` of every `registered` attendee with a public,
  activated profile is returned

#### Scenario: A member outside the directory is not disclosed

- **WHEN** an attendee's profile is not public and an activated member calls
  `event_attendees` for that event
- **THEN** that attendee's `profile_id` is absent from the result entirely

#### Scenario: An unconfirmed account sees no attendees

- **WHEN** an authenticated member whose account is not yet activated calls
  `event_attendees` for a visible event
- **THEN** no rows are returned

#### Scenario: Cancellations and waitlist stay private

- **WHEN** an activated non-host member calls `event_attendees` for an event
  that has `cancelled` and `waitlist` registrations
- **THEN** neither is returned, while the host calling the same function
  receives both

#### Scenario: The table policy is unaffected

- **WHEN** an activated member selects directly from `event_registrations` for
  an event they do not host
- **THEN** only their own row is returned, exactly as before

### Requirement: An event cover lives in a private bucket

The system SHALL store event cover images in a storage bucket `event-covers`
with `public = false`, a `file_size_limit` of 2 MiB and `allowed_mime_types` of
exactly `image/webp`.

The bucket SHALL be private for the same reason `post-media` is: the visibility
of the image follows the visibility of its event. A public bucket with
hard-to-guess paths SHALL NOT count as access control.

Size and type SHALL be stated on the bucket, not only in the form, so a
hand-built upload cannot bypass them.

Writing SHALL be permitted only within the caller's own `{uid}/` path prefix
and only for an activated account, matching `avatars`, `covers` and
`post-media` word for word.

#### Scenario: A non-WebP upload is rejected

- **WHEN** an upload to `event-covers` carries a MIME type other than
  `image/webp`
- **THEN** the bucket rejects it

#### Scenario: Writing into a foreign prefix is refused

- **WHEN** an activated member uploads to a path whose first segment is not
  their own uid
- **THEN** the write is refused

#### Scenario: An unconfirmed account cannot upload

- **WHEN** an authenticated member whose account is not yet activated uploads a
  cover
- **THEN** the write is refused

### Requirement: A cover is exactly as visible as its event

The system SHALL decide readability of an `event-covers` object through the
`SECURITY DEFINER` function `event_cover_lesbar(text)`, which resolves the
owning event via `events.cover_path` and mirrors the event's own read rules:
without a session only `public` events, with a session the activated caller's
`public` and `members` events plus their own hosted events.

The function SHALL additionally require that the object's first path segment
equals the resolved event's `host_id`. This is the read-side half of binding a
cover to its host; it holds for rows the write-side check never saw.

`execute` on the function SHALL be revoked from `PUBLIC` and granted explicitly
to `anon` and `authenticated`, because a Postgres function is executable by
`PUBLIC` by default and silently inheriting that would widen privileges.

Because the bucket is private, issuing a signed URL **is** a `select` on
`storage.objects` under the caller's role; the SELECT policy is therefore the
whole of the access control, not a listing convenience.

An object with no matching `events.cover_path` row SHALL be readable by nobody.

Signatures SHALL be issued with the same validity C7 chose for post media, so
a visibility change takes effect on the image with the same known lag as it
does on a post image.

#### Scenario: A members-event cover is unreachable without a session

- **WHEN** a visitor without a session requests a signed URL for the cover of a
  `members` event
- **THEN** the request is refused

#### Scenario: A public-event cover is reachable without a session

- **WHEN** a visitor without a session requests a signed URL for the cover of a
  `public` event
- **THEN** the signature is issued and the image is retrievable

#### Scenario: An orphaned object is readable by nobody

- **WHEN** an object exists in `event-covers` that no `events.cover_path`
  references
- **THEN** no caller, with or without a session, receives a signature for it

#### Scenario: A stolen path stays unreadable

- **WHEN** an orphaned object belonging to another member's `members` event is
  referenced by a `public` event whose host is not that member
- **THEN** no caller receives a signature for it, with or without a session

### Requirement: Covers are signed in one batch per view

The system SHALL obtain signed URLs for event covers through **one** batched
signing call per view — one for the whole overview list, one for the detail
page — never one call per tile.

The signature validity and the client-side staleness window SHALL be the values
C7 chose for post media, reused rather than re-decided, because that number is
also the lag with which a visibility change reaches an already-rendered image.

The signing query's cache key SHALL be scoped to the principal, since which
covers can be signed depends on who is asking.

An event whose cover cannot be signed SHALL render the placeholder, exactly as
an event with no cover does. A single unsignable object SHALL NOT fail the
whole view.

#### Scenario: One signing call serves the whole list

- **WHEN** an overview with several covered events is rendered
- **THEN** a single batched signing request is issued, not one per tile

#### Scenario: An unsignable cover degrades to the placeholder

- **WHEN** one event's cover object cannot be signed for this caller
- **THEN** that tile shows the placeholder and the remaining tiles still show
  their images

### Requirement: The events overview shows three tiles per row

The system SHALL lay out the event list at three tiles per row on wide
viewports, degrading to two and then one on narrower ones.

Each tile SHALL show the cover image with the start date as a badge on it, the
type badge, the title, the time span, the location, the number of attendees and
a link into the detail page. An event without a cover SHALL render a neutral
placeholder rather than a collapsed tile.

The attendee **number** on the tile SHALL come from `event_registration_counts`,
not from `event_attendees`: the overview shows a count, and the count is
already available to every caller who can see the event.

#### Scenario: A wide viewport shows three tiles

- **WHEN** the events list is rendered at a wide viewport with at least three
  events
- **THEN** three tiles sit side by side

#### Scenario: An event without a cover keeps its tile

- **WHEN** an event has no `cover_path`
- **THEN** the tile renders a placeholder in the cover's place and keeps its
  height

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

### Requirement: The event form stays short

The system SHALL require exactly two fields to create an event: the title and
the start. Type, end, location, capacity, visibility, description, cover and
topics SHALL all remain optional.

The start SHALL be required in the form because the column is `not null`; a
form that permits an empty start would fail at the insert instead of at the
field.

The form SHALL NOT grow a subtitle field. The description carries what a
subtitle would.

Editing an event without choosing a new image SHALL keep the existing cover.
Removing a cover SHALL be an explicit action that sets `cover_path` to null;
it SHALL NOT be reachable by accident through saving the form.

#### Scenario: Saving without a new image keeps the cover

- **WHEN** a host edits an event's title and saves without touching the image
- **THEN** `cover_path` is unchanged

#### Scenario: Removing the cover is explicit

- **WHEN** a host uses the remove action on the cover and saves
- **THEN** `cover_path` becomes null and the tile falls back to the placeholder

#### Scenario: Title and start suffice

- **WHEN** a member fills in only the title and the start
- **THEN** the event can be saved

#### Scenario: A missing start blocks submission

- **WHEN** a member leaves the start empty
- **THEN** the form refuses to submit and marks the field, rather than sending
  the insert

### Requirement: The cover upload reuses the existing cropper

The system SHALL crop event covers with the existing `AvatarCropper` at a
landscape aspect, exporting WebP, rather than introducing a second cropping
implementation.

#### Scenario: A landscape crop is produced

- **WHEN** a host selects an image for the event cover
- **THEN** the cropper offers a landscape frame and the export is `image/webp`

### Requirement: Ein neues Event kündigt sich selbst im Feed an

Das System SHALL beim Anlegen eines Events einen Beitrag im Aktivitätsfeed
erzeugen — über einen Trigger auf `public.events`, nicht über den Client. Der
Grund SHALL festgehalten sein: ein Event entsteht über mehr als einen Weg
(Formular, künftig Import oder Admin), und eine Regel im Client gilt nur für
den Weg, der sie kennt.

Der Beitrag SHALL `kind = 'event'` und `ref_id = events.id` tragen, seinen
Autor aus `events.host_id` nehmen und seine Sichtbarkeit aus
`events.visibility`. Er SHALL **keinen** Inhalt des Events kopieren.

Das System SHALL spätere Änderungen an `events.visibility` **und**
`events.host_id` nachziehen: die Sichtbarkeit folgt, ein später zugewiesener
Host lässt den fehlenden Beitrag entstehen, ein Hostwechsel zieht den Autor
nach, und ein entzogener Host entfernt den Beitrag.

Der Grund SHALL festgehalten sein: hörte der Trigger nur auf `visibility`, käme
ein Event, das ohne Host angelegt und später einem Host zugeordnet wird, nie in
den Feed — die Zusage „neue Events erscheinen in der Aktivität" bräche still.
Bei admin-gepflegten Events ist das kein Sonderfall.

Das System SHALL für ein Event ohne `host_id` keinen Beitrag erzeugen und das
Anlegen des Events dadurch NOT scheitern lassen.

Das System SHALL den Beitrag ausschließlich über diese Trigger schreiben. Weder
der Host noch ein anderes Konto SHALL ihn anlegen, ändern oder löschen können.

Bestehende Events SHALL einmalig ihren Beitrag nachbekommen, mit
`posts.created_at = events.created_at`. Ohne das hätte der Feed am Starttag
keinen einzigen Event-Eintrag; mit `now()` verdrängten alte Events den echten
Feed von oben.

#### Scenario: Ein neu angelegtes Event steht im Feed

- **WHEN** ein Host ein Event anlegt
- **THEN** entsteht ein Beitrag mit `kind = 'event'`, dem Host als Autor und der
  Sichtbarkeit des Events

#### Scenario: Ein bestehendes Event bekommt seinen Beitrag mit seinem Datum

- **WHEN** die Migration auf eine Datenbank mit bestehenden Events angewandt wird
- **THEN** trägt jeder nachgezogene Beitrag das `created_at` seines Events und
  steht nicht als neuester Beitrag oben

#### Scenario: Das Anlegen eines Events schlägt durch den Trigger nie fehl

- **WHEN** ein Event ohne Host angelegt wird
- **THEN** gelingt das Anlegen, und es entsteht kein Beitrag

#### Scenario: Ein später zugewiesener Host holt den Beitrag nach

- **WHEN** einem Event ohne Host später ein Host zugewiesen wird
- **THEN** entsteht in diesem Moment sein Feed-Beitrag mit diesem Host als Autor

#### Scenario: Der Host kann den erzeugten Beitrag nicht anfassen

- **WHEN** der Host seinen automatisch erzeugten Feed-Beitrag zu ändern oder zu
  löschen versucht
- **THEN** wird der Zugriff abgelehnt — der Beitrag folgt dem Event, nicht dem
  Autor

