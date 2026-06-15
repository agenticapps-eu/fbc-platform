# Events (AGE-251) — Design

**Status**: Approved  **Date**: 2026-06-15  **Linear**: AGE-251
**Spec**: `docs/community-events-spec.md` §2  **Branch**: `donald/age-251-events`

## Goal

Build out the `/events` route (currently a placeholder) into a working events
surface: list/calendar of upcoming & past events, a detail page, registration
with automatic waitlisting, host tools (create/edit, attendee list, check-in,
post-event rating), and wire the "Mein Bereich" dashboard widget to real data.

Reuses the Community-Feed (AGE-250) visibility/card pattern. Schema
(`events`, `event_registrations`) and RLS already exist from Week 1 — W4 **uses**
them. Look: Schwarz & Gold (`docs/design-system.md`).

## Key constraint (drives the DB design)

`regs_select_self_or_host` lets an attendee read only their **own** registration
rows. A normal member therefore **cannot count** how many people are registered
for an event they do not host. So:

- "Restplätze" (remaining spots) and participant counts cannot be computed
  client-side → require a read-only aggregate RPC (same class of problem the feed
  solved with `post_engagement_counts`).
- The registered-vs-waitlist decision cannot be made safely client-side (count is
  hidden, and a client-decided status is racy / forgeable) → require a server-side
  registration RPC.
- Host check-in writes a row the host does not own (`profile_id = attendee`),
  which `regs_write_own` forbids → require a host check-in RPC.

Decision (user-approved): **RPCs for both registration and check-in**, plus the
counts RPC. Detail view is a **dedicated route** `/events/:id`.

## 1. Database — migration `2026…_event_rpcs.sql`

Mirrors `20260615120000_post_engagement_counts.sql` conventions exactly:
`language sql`/`plpgsql`, `stable`/`volatile`, `security definer`,
`set search_path`, an explicit cardinality cap on array inputs, a `comment on
function`, and least-privilege `grant execute`.

### `event_registration_counts(p_event_ids uuid[])`
- Returns `table (event_id uuid, registered_count bigint, waitlist_count bigint)`.
- `security definer`, `stable`. Counts only `status='registered'` and
  `status='waitlist'` (cancelled excluded).
- **Visibility-gated**: `where` replicates `events_select_by_visibility`
  (public/members/prime≥5/legacy≥7 or host) so definer rights never leak counts
  for events the caller cannot see. Cardinality cap `<= 200`.
- `grant execute … to anon, authenticated` (public events have anon-visible counts).

### `register_for_event(p_event_id uuid) returns text`
- `security definer`, `volatile`, `plpgsql`.
- Rejects if `auth.uid()` is null (anon cannot register).
- Rejects (raises) if the caller cannot see the event (same visibility predicate)
  — registering for an invisible event is not allowed.
- Counts current `status='registered'` for the event. `v_status :=
  'registered'` when `capacity is null OR count < capacity`, else `'waitlist'`.
- `insert … on conflict (event_id, profile_id) do update set status = excluded.status`
  — re-registering after a cancel re-evaluates capacity. Returns `v_status`.
- `grant execute … to authenticated`.

### `set_event_check_in(p_registration_id uuid, p_checked_in boolean) returns void`
- `security definer`, `volatile`, `plpgsql`.
- Updates `event_registrations.checked_in` only `where id = p_registration_id`
  **and** the row's event has `host_id = auth.uid()`. Non-hosts no-op/raise.
- `grant execute … to authenticated`.

### Not via RPC
- **Cancel/unregister**: client `update event_registrations set status='cancelled'`
  on the own row (`regs_write_own`).
- **Rating**: client `update event_registrations set rating=…` on the own row
  (`regs_write_own`); UI only offers it for past events the member attended.

No new tables, columns, or RLS policies. Hand-maintain the three RPC signatures in
`src/lib/database.types.ts` `Functions` (the repo convention until `gen types`
is re-run).

## 2. Data layer — `src/lib/events.ts` (+ `events.test.ts`)

Mirrors `feed.ts` structure (domain types, pure helpers tested, Supabase
functions trusting RLS, `uid`-prefixed query keys).

**Types**: `EventType`, `EventVisibility`, `EventListItem` (incl. host, counts,
myStatus), `EventDetail`, `EventHost` (profile or partner), `Attendee`,
`MyRegistration`.

**Pure helpers (TDD targets in `events.test.ts`)**:
- `partitionEvents(events, now) → { upcoming, past }` — upcoming sorted ascending
  by `starts_at`, past descending; null `starts_at` treated as upcoming/undated.
- `remainingSpots(capacity, registeredCount) → number | null` (null = unlimited).
- `isFull(capacity, registeredCount) → boolean`.
- `isPastEvent(startsAt, now) → boolean`.
- `eventTypeLabel(type)` + `EVENT_TYPE_OPTIONS` (online/presence/dinner/workshop/
  mastermind).
- `registrationStatusLabel(status)`.
- `VISIBILITY_OPTIONS` (same shape as feed).

**Supabase functions (not unit-tested, like feed)**:
- `fetchEvents() → EventListItem[]` — `events` ordered by `starts_at`; enrich host
  from `profiles_public` (and `partners` for `host_partner_id`); counts via
  `event_registration_counts`; own statuses via own `event_registrations` rows.
- `fetchEvent(id) → EventDetail | null`.
- `fetchAttendees(eventId) → Attendee[]` — host-only (RLS returns rows to host),
  enriched via `profiles_public`.
- `createEvent(input)` / `updateEvent(id, input)` — `host_id = self`.
- `registerForEvent(eventId)` → `rpc('register_for_event')`.
- `cancelRegistration(eventId, profileId)`.
- `setCheckIn(registrationId, checkedIn)` → `rpc('set_event_check_in')`.
- `rateEvent(registrationId, rating)`.

**Query keys**: `eventsListKey(uid)`, `eventDetailKey(uid, id)`,
`attendeesKey(uid, eventId)` — `uid`-prefixed.

## 3. UI

- **`src/pages/EventsPage.tsx`** (replace placeholder): header; "Event anlegen"
  (logged-in only) toggling an `EventForm`; `Tabs` (Kommende / Vergangene) of
  event cards; a "Meine Events" (hosted) section when the member hosts any.
- **`src/components/events/EventCard.tsx`** (+ list): title, type `Badge`,
  date/time, location, host avatar+name, Restplätze/„ausgebucht" → `Link` to
  `/events/:id`. Schwarz & Gold via existing `Card`/`Badge`/`Avatar`.
- **`src/pages/EventDetailPage.tsx`** at route `/events/:id` (in AppShell, no
  `RequireAuth`; RLS gates so anon sees only public events): description, host
  (profile link or partner), time/location, capacity & participant count,
  status-aware **Anmelden/Abmelden** (registered → "Abmelden"; waitlist →
  "Auf Warteliste — Abmelden"; full & not registered → "Auf Warteliste"); a
  host-only **tools panel** (edit via `EventForm`, attendee list with check-in
  toggles); for attendees, a 1–5 **rating** control once the event is past.
- **`src/components/events/EventForm.tsx`**: create/edit — title, type `Select`,
  `datetime-local`, location, capacity (optional int), visibility `Select`.
- Route added in `App.tsx` next to `/p/:id`.

## 4. Dashboard

- `fetchDashboard`: add a `hostedEvents` query (`events` where `host_id = uid`,
  upcoming first). Keep the existing registrations query.
- `EventsWidget`: show real registrations split into upcoming ("Gebucht") and past
  ("Vergangen") via `partitionEvents`, plus an "Eigene Events" group for hosted
  events; keep the demo fallback only when the member has genuinely no events
  (consistent with the existing profile-spec §5 demo-widget convention).
  "Alle anzeigen" → `/events`.

## 5. Testing & verification

- TDD: `events.test.ts` pure helpers RED→GREEN before implementation.
- Gates: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- RLS: impersonation check that anon sees only `public` events; member sees
  members/rank-gated; counts RPC respects the same predicate.
- Live two-account QA: register → waitlist at capacity → cancel → host check-in →
  past-event rating.
- Post-phase: `/review` + `/cso` (touches storage/RLS/auth) + `/qa`.

## Out of scope (follow-ups)

- Auto-promotion of waitlisted members when a registered attendee cancels.
- Calendar grid view (the spec's "Liste/Kalender" is satisfied by the
  upcoming/past list; a true month grid is not required for DoD).
- Demo event seed data (AGE-254).
