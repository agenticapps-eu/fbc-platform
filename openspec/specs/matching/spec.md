# Matching

## Purpose

Defines how members express what they offer ("Ich biete") and seek ("Ich suche"),
how the platform derives complementary matches between members, and how large-volume
opportunities are routed to a staff-managed queue. Matches are computed server-side by
a rule-based engine and never written by members; visibility of offers, needs, matches
and the routing queue is enforced by RLS. Reconstructed from the code as of the
OpenSpec migration. Matching v2 provisioning and the paid contact gate are only
partially in place: the tier-based contact gate exists (Prime+ may send requests), but
the DKRI deal workflow beyond queue visibility is deferred to a later level.

## Requirements

### Requirement: Members author offers and needs

The system SHALL let a member create, edit and delete their own `offers` ("Ich biete")
and `needs` ("Ich suche"), each carrying a category, an optional theme from
`sein`/`tun`/`haben`/`wirken`, a title, an optional description and tags. Needs SHALL
additionally carry a `tx_volume_band` used for FBC/DKRI routing. A member SHALL only be
able to write rows tied to their own profile.

#### Scenario: Member saves an offer and a need

- **WHEN** a member fills the Suche & Biete editor and saves
- **THEN** rows are written to `offers`/`needs` with the member's `profile_id`,
  the chosen category, theme, title, tags (and, for needs, `tx_volume_band`)

#### Scenario: Writing another member's offer is rejected

- **WHEN** a member attempts to insert or update an `offers`/`needs` row whose
  `profile_id` is not their own
- **THEN** the RLS `*_write_own` policy denies the write

#### Scenario: Invalid theme or volume band is rejected

- **WHEN** a write sets `theme` outside `sein/tun/haben/wirken` or `tx_volume_band`
  outside `lt_10k/10k_100k/100k_1m/1m_10m/gt_10m`
- **THEN** the CHECK constraint rejects the row

### Requirement: Offers and needs visibility is RLS-gated

The system SHALL restrict reading of `offers` and `needs` to the owning member or a
member whose tier clears the Prime+ gate (`is_prime_plus()`), enforced in the database
independently of the client.

#### Scenario: Prime+ member sees others' offers for matching

- **WHEN** a member whose tier clears the Prime+ gate selects `offers`/`needs`
- **THEN** the `offers_select`/`needs_select` policy returns rows of other members

#### Scenario: Non-Prime member sees only their own

- **WHEN** a member below the Prime+ gate selects `offers`/`needs`
- **THEN** only rows where `profile_id` equals their own id are returned

### Requirement: Matches are created server-side only

The system SHALL compute matches exclusively through the `SECURITY DEFINER` engine
`generate_matches_for(profile)` (member-facing wrapper `recompute_my_matches()`), and
SHALL NOT grant members any INSERT or UPDATE on `matches`. The `matches` table has no
client write policy; the engine executes under `service_role`, and a member may only
(re)compute their own matches.

#### Scenario: Member recomputes their own matches

- **WHEN** an authenticated member calls `recompute_my_matches()`
- **THEN** the engine runs `generate_matches_for(auth.uid())` and returns the number
  of upserted matches

#### Scenario: Engine refuses another profile

- **WHEN** a member calls `generate_matches_for` for a profile that is not their own
  (and `auth.uid()` is not null)
- **THEN** the function raises an error with SQLSTATE `42501`

#### Scenario: Direct match insert has no policy

- **WHEN** an authenticated member attempts to INSERT into `matches`
- **THEN** the write is denied because no INSERT policy exists (only `service_role`
  bypasses RLS)

### Requirement: Matches carry a transparent weighted score

The system SHALL store each match with a `score` in the 0–100 range, a `basis` jsonb
recording the weighted components (complementarity 35, theme 20, branche 15, region 15,
interests/competencies 10, tier 5), and a `status` of `suggested`, `requested`,
`accepted` or `declined`. The engine SHALL only upsert pairs scoring at least 40 and,
on conflict, SHALL update `score`/`basis`/`routing` while leaving `status` untouched.

#### Scenario: Only qualifying pairs are written

- **WHEN** the engine evaluates a candidate pair whose weighted score is below 40
- **THEN** no match row is written for that pair

#### Scenario: Recompute preserves an advanced status

- **WHEN** the engine re-upserts a pair already at status `requested` or `accepted`
- **THEN** the row's `score`, `basis` and `routing` update but `status` is preserved

#### Scenario: Basis explains the score

- **WHEN** a match is created
- **THEN** its `basis` jsonb lists the six weighted components with their points,
  and the Matching-Hub renders them under "Warum dieses Match?"

### Requirement: Match visibility is limited to participants

The system SHALL restrict reading of a `matches` row to the two profiles it links,
enforced by RLS.

#### Scenario: Participant reads their match

- **WHEN** a member selects `matches` where they are `a_profile_id` or `b_profile_id`
- **THEN** the `matches_select_participant` policy returns the row

#### Scenario: Non-participant sees nothing

- **WHEN** a member selects a `matches` row for a pair they are not part of
- **THEN** no row is returned

### Requirement: FBC/DKRI routing is derived from volume

The system SHALL set a match's `routing` to `dkri` when any complementarity-driving
need in the pair is large-volume (`1m_10m` or `gt_10m`), and to `fbc` otherwise, and a
contact request SHALL inherit the routing lane of its linked match on insert (`fbc`
when there is no match).

#### Scenario: Large-volume need routes to DKRI

- **WHEN** the engine matches a pair whose driving need has band `1m_10m` or `gt_10m`
- **THEN** the match's `routing` is `dkri`

#### Scenario: Contact request copies the match lane

- **WHEN** a contact request is inserted with a `match_id`
- **THEN** the BEFORE trigger sets its `routing` from the linked match's routing

### Requirement: DKRI requests enter a staff-only routing queue

The system SHALL enqueue a `dkri`-routed contact request into `routing_queue` (one
entry per match, populated only by the `SECURITY DEFINER` lifecycle trigger), and SHALL
restrict reading and updating the queue to holders of a server-controlled
matching-manager role. The `is_matching_manager()` check SHALL derive from the
service-provisioned `staff_roles` table, never from the member-writable `profiles.roles`,
and SHALL be kept off the anon API surface.

#### Scenario: Large request is enqueued

- **WHEN** a contact request with `routing = 'dkri'` and a `match_id` is inserted
- **THEN** the lifecycle trigger upserts a `routing_queue` row for that match (idempotent
  per match) while the normal accept→thread flow is left intact

#### Scenario: Only a manager reads the queue

- **WHEN** a member without a `matching_manager`/`admin` staff role selects
  `routing_queue` or calls `list_routing_queue()`
- **THEN** no rows are returned (the `is_matching_manager()` guard is false)

#### Scenario: Members cannot self-grant the role

- **WHEN** a member edits their `profiles.roles` chips
- **THEN** `is_matching_manager()` is unaffected because it reads only `staff_roles`,
  which has no client write grant
