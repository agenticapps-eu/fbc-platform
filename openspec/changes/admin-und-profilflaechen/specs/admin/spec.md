## MODIFIED Requirements

### Requirement: Admins review aggregated member feedback

The system SHALL provide a `SECURITY DEFINER` RPC `admin_list_feedback()` that
returns feedback rows joined to the author's name and the author's `profile_id`,
gated so it returns rows only when `is_admin()`, and paged through `p_limit` and
`p_offset`. The admin capability over feedback SHALL be read-only — the admin
reviews QM feedback but does not manage it (no admin delete of others' rows).

#### Scenario: Admin reads all feedback with author names

- **WHEN** an admin calls `admin_list_feedback()`
- **THEN** every feedback row on the requested page is returned with
  `author_name` resolved past the `profiles` RLS (owner-rights join)

#### Scenario: Non-admin (incl. matching manager) gets nothing

- **WHEN** a matching manager or ordinary member calls `admin_list_feedback()`
- **THEN** the `where is_admin()` filter returns zero rows — QM is not the deal queue

#### Scenario: The read stays read-only

- **WHEN** the admin capability over feedback is inspected
- **THEN** it offers no way for an admin to change or delete another member's
  feedback row

## ADDED Requirements

### Requirement: Die Reiter der Mitgliederliste weisen ihre Anzahl aus

Each tab of the admin member list SHALL show how many members its state holds.
The counts SHALL come from a **separate** `SECURITY DEFINER` RPC and SHALL NOT be
obtained by extending `admin_list_members` — that function's signature and column
set are each guarded by an explicit assertion, and widening either turns a guard
into an obstacle rather than a protection.

The counting RPC SHALL apply the same state definitions the listing RPC applies
— **the same** definitions, shared, not a second copy of them, so that a tab's
number and the rows behind it cannot drift apart. A copy held together only by a
test can pass on a balanced fixture while a branch is wrong; a shared definition
has nothing to drift from.

The counts SHALL be global and SHALL NOT narrow with an active search term. It SHALL raise
for a non-admin caller rather than return zeroes: a zero is a statement about the
stock, and a caller with no right to the stock must not receive one.

Because "Alle" and "Mitgliedschaft" are two views over one and the same set, they
SHALL carry the same number. That is a property of the states, not a duplication.

#### Scenario: Each tab carries its number

- **WHEN** an admin opens the member list
- **THEN** each tab shows the count of members in its state next to its label

#### Scenario: The number matches the rows behind it

- **WHEN** a tab reports N members and the list is paged through entirely under
  that same tab **with no search term entered**
- **THEN** exactly N distinct members are seen

#### Scenario: A search narrows the list but not the number

- **WHEN** the admin enters a search term
- **THEN** the tabs keep reporting how many members exist in each state, while
  the list shows only the matches — the tab answers how many there are, not how
  many match

#### Scenario: Two views over one set carry one number

- **WHEN** the counts are read
- **THEN** the tab for all members and the tab for membership report the same
  number, because they filter the same set

#### Scenario: A non-admin gets no count

- **WHEN** an ordinary member or a matching manager calls the counting RPC
- **THEN** it raises, and does not return a row of zeroes

#### Scenario: The listing function keeps its signature and its columns

- **WHEN** the signature and the column set of `admin_list_members` are compared
  against the state before this change
- **THEN** both are unchanged — the shared definition changes how the function
  decides, never what it is called with or what it returns

#### Scenario: Both functions decide by the same definition

- **WHEN** a member is in a given state
- **THEN** the counting function and the listing function agree about it, because
  both ask the same shared definition rather than each carrying its own

### Requirement: Das Administrationsmenü trägt seine Flächen vollständig

Every admin route that is meant to be reached by navigating SHALL have an entry
in the administration menu. A route reachable only by typing its address is
undiscoverable, and a menu that omits one of its surfaces misleads about what the
administration can do.

Routes that exist only as the target of a link from another surface — those
carrying a parameter, such as a single member's page — SHALL NOT appear in the
menu, because there is no such thing as opening them without their parameter.

#### Scenario: The feedback surface is in the menu

- **WHEN** an admin views the administration menu
- **THEN** it lists the settings surface, the member list and the feedback
  surface

#### Scenario: A parameterised route stays out of the menu

- **WHEN** the administration menu is compared against the admin routes
- **THEN** the route for a single member is absent from the menu, and is reached
  from the member list instead
