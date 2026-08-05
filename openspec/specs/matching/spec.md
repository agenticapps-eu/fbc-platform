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

The system SHALL offer **three authoring surfaces of different depth** over the same
two tables, and SHALL keep them from destroying one another's work:

- the **rich editor** (Suche & Biete), which writes every column and follows the
  replace-collection pattern — the member's rows are deleted and re-inserted from
  the submitted form;
- the **category chips** in the profile editor, which express only membership in a
  category;
- the **guided Kompass run**, which derives offers and needs from its chip steps.

The guided run SHALL be **purely additive**: it inserts a row for a selected
category that has none yet, and it SHALL NOT delete anything. It SHALL NOT clear
`offers` and `needs` wholesale before inserting: a member repeating the Kompass
must keep every description, tag and volume band authored elsewhere. Additive-only is
the same treatment `profile_interests` already receives inside that very function,
and for the same stated reason: another surface manages the same table, and
replacing it there would destroy what that surface maintains.

Additive-only rather than the chips' reconcile-per-category, because the wizard's
selections come from a local draft rather than from the member's current rows: a
re-run beginning from an empty draft would read as "nothing selected" and delete
everything. Removing a category therefore remains the profile editor's job, where
the selection is loaded from the rows it is about to change.

Because the rich editor's replace pattern would destroy descriptions, tags and
volume bands if the chips adopted it, the chips SHALL reconcile **per category**:

- selecting a category that has no row yet SHALL insert one minimal row carrying
  that category, the category's theme, and its label as `title` (the column is
  `not null`, and a chip carries no title of its own);
- deselecting a category SHALL delete **all** of that member's rows in that
  category, including rich ones, and SHALL require an explicit confirmation
  first — the discarded content is not visible on the screen where the gesture
  happens;
- a category that already has one or more rows SHALL be left untouched and SHALL
  render as selected.

The `title` of a minimal row SHALL come from the vocabulary that owns
`offers.category` / `needs.category`, not from the compass step labels. The two
disagree, and the compass wording would be actively wrong: it labels the `kapital`
category "Kapital & Beteiligungen" while `beteiligungen` is a separate offer
category of its own.

The `theme` of a minimal row SHALL be set from the category's declared theme and
SHALL NOT be left null, so chip-authored rows are reachable through the directory's
theme facet on the same terms as rich ones.

Each row SHALL record which surface created it, so the three can be told apart.
Rows written by the chips or the guided run SHALL be marked as chip-authored;
everything else, including every row that already exists, SHALL count as
editor-authored.

A duplicate chip-authored row SHALL be impossible, enforced by a **partial unique
index** on `(profile_id, category)` restricted to chip-authored rows. A plain
uniqueness constraint SHALL NOT be used: the rich editor legitimately holds several
entries in one category, and a total constraint would forbid that. The partial
index is not a nicety — the potential score sums `count(*)` over `offers` and
`needs`, so a duplicate row silently inflates a member's score, and read-then-write
reconciliation without it leaves exactly that race open between two concurrent
saves.

"Chip-authored" SHALL be the definition of a row that can be discarded without
asking. A category whose rows are all chip-authored SHALL be removable without
confirmation; a category holding any editor-authored row SHALL require it. The
system SHALL NOT infer this structurally from empty descriptions or tags — a rich
entry may carry nothing but a custom title or a volume band, and would then be
deleted silently.

Rows created by the chips or the guided run SHALL leave `tx_volume_band` null, so
volume-derived routing resolves to `fbc`; a transaction volume is only ever set
through the rich editor.

Because of that, the rich editor SHALL accept a need whose volume band is absent
and SHALL be able to save it back unset. A missing band means "not stated yet",
not an invalid row: the editor reads a null band as an empty string, and that
value SHALL pass validation — otherwise every chip-authored need blocks the form
until a band is chosen. One surface SHALL NOT be able to render another's output
unsavable.

Reconciliation SHALL decide whether a deletion needs confirmation from the rows as
they are **at save time**, not only from the state loaded into the form. The
window between load and save can gain an editor-authored row, and a decision taken
at load would then delete it silently. The residual race — a row created after the
save's own read — remains open and is accepted: it requires the same member
writing from two places within the same moment, and the alternative is
transactional machinery this MVP does not otherwise carry.

The surfaces SHALL draw their categories from vocabularies that overlap but do not
coincide: chips and guided run offer the curated Kompass subset, the rich editor
the full set. Every chip category SHALL be a valid key in the rich editor's
vocabulary for its side, so a chip can never write a key the rich editor would
reject.

#### Scenario: Member saves an offer and a need

- **WHEN** a member fills the Suche & Biete editor and saves
- **THEN** rows are written to `offers`/`needs` with the member's `profile_id`,
  the chosen category, theme, title, tags (and, for needs, `tx_volume_band`)

#### Scenario: Chips leave a rich entry of the same category alone

- **WHEN** a member holds an offer in `kapital` with a description and tags, and
  saves the profile editor with the `kapital` chip still selected
- **THEN** that row is unchanged — description and tags survive

#### Scenario: Repeating the guided Kompass preserves rich entries

- **WHEN** a member who holds a richly filled `kapital` offer runs the guided
  Kompass again and selects `kapital` there too
- **THEN** the existing row survives with its description, tags and volume band

#### Scenario: The guided run never removes a category

- **WHEN** a member runs the guided Kompass and leaves `kontakte` unselected while
  holding an offer in it
- **THEN** that offer remains — the wizard adds, it does not withdraw

#### Scenario: Selecting a new category creates a minimal row

- **WHEN** a member selects the `know_how` chip and has no offer in that category
- **THEN** one `offers` row is inserted with `category = 'know_how'`, the
  category's declared theme, and the owning vocabulary's label as `title`

#### Scenario: Deselecting a category removes its rows after confirmation

- **WHEN** a member deselects the `kontakte` chip
- **THEN** an explicit confirmation names what will be discarded, and only on
  confirmation is every one of that member's `offers` rows with
  `category = 'kontakte'` deleted

#### Scenario: A chip-created row is reachable through the theme facet

- **WHEN** a member's only `mentoring` offer was created by a chip
- **THEN** a directory search filtering on that category's theme returns them

#### Scenario: A duplicate chip row cannot be created

- **WHEN** two concurrent saves both try to insert a chip-authored row for the
  same member and category
- **THEN** the partial unique index rejects the second, so the potential score's
  `count(*)` over `offers`/`needs` is not inflated

#### Scenario: The rich editor may still hold several entries in one category

- **WHEN** a member authors two distinct `kapital` offers in the rich editor
- **THEN** both are stored — the uniqueness rule binds only chip-authored rows

#### Scenario: A title-only rich entry still triggers confirmation

- **WHEN** a member deselects a category whose only row was authored in the rich
  editor with a custom title but no description, tags or volume band
- **THEN** confirmation is still required, because the row is editor-authored —
  its emptiness in other columns is not what decides

#### Scenario: A chip-created need carries no volume band

- **WHEN** a member selects the `investoren` chip
- **THEN** the inserted `needs` row has `tx_volume_band = null` and therefore
  routes to `fbc`

#### Scenario: The rich editor can open and save a chip-created need

- **WHEN** a member opens the rich editor holding a chip-created need with no
  volume band, changes nothing, and saves
- **THEN** the form is valid, the save succeeds, and the band stays unset

#### Scenario: Confirmation is decided from the rows at save time

- **WHEN** an editor-authored row appears in a category after the profile editor
  was opened, and the member then deselects that category
- **THEN** the confirmation is still required, because the decision is taken
  against the rows read at save time

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
member whose level rank clears `discover` (rank 3), enforced in the database
independently of the client by the `offers_select` / `needs_select` policies using
`has_level(3)`.

This requirement previously named `is_prime_plus()`. That predicate was replaced for
these two tables by the six-level migration and the spec text had not followed;
the gate is `has_level(3)`. Own rows stay visible at every level, because
maintaining one's own "Ich suche / Ich biete" is available from `basic` — only
browsing **other** members' offers and needs sits behind the rank.

#### Scenario: Discover-and-above member sees others' offers for matching

- **WHEN** a member with `level_rank >= 3` selects `offers`/`needs`
- **THEN** the `offers_select`/`needs_select` policy returns rows of other members

#### Scenario: Below-Discover member sees only their own

- **WHEN** a member with `level_rank < 3` selects `offers`/`needs`
- **THEN** only rows where `profile_id` equals their own id are returned

#### Scenario: A member below the rank can still maintain their own

- **WHEN** a `basic` member writes their own offer or need
- **THEN** the write succeeds and the row is readable to them

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
