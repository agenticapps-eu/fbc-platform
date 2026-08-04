## ADDED Requirements

### Requirement: The profile editor carries the offer and need categories

The system SHALL let a member declare what they offer and what they seek directly
in the profile editor, as two chip groups with multiple selection drawn from the
compass category vocabulary — the offer side and the need side listed separately,
because the two sets differ.

The selection SHALL be the member's own `offers` and `needs`, not a second copy of
them: opening the editor SHALL show a category as selected exactly when the member
holds at least one row in it, and saving SHALL reconcile per category rather than
replace the collection. A member SHALL be able to reach this without visiting the
Kompass page, which carries no menu entry.

Removing a category discards content that is not visible on this screen — a
description, tags and a volume band authored in the rich editor. The editor SHALL
therefore require an **explicit confirmation** naming what will be lost, not a
passive hint, before such a deselection is saved.

Whether confirmation is due SHALL be decided by the row's recorded authoring
surface, not by which of its columns happen to be empty: a category holding any
editor-authored row requires it, a category holding only chip-authored rows does
not. A prompt that always fires is a prompt nobody reads, and a structural guess
would delete a title-only rich entry without asking.

#### Scenario: Existing rows pre-select their categories

- **WHEN** a member with an offer in `kapital` opens the profile editor
- **THEN** the `kapital` chip is shown as selected

#### Scenario: Selection survives a round trip

- **WHEN** a member selects `mentoring`, saves, and reopens the editor
- **THEN** `mentoring` is still selected and one `offers` row backs it

#### Scenario: The member confirms before losing a rich entry

- **WHEN** a member deselects a category in which they hold an entry with a
  description or tags
- **THEN** an explicit confirmation names that entry and the save proceeds only
  after it is given

#### Scenario: Removing a chip-authored category asks nothing

- **WHEN** a member deselects a category whose rows were all created by chip
- **THEN** they are removed on save without a confirmation prompt

### Requirement: A member's own profile shows no invented data about them

A surface that presents a member's own activity, holdings or history SHALL show
only data the system actually holds. Where a capability does not exist yet, the
surface SHALL omit the section rather than fill it with sample figures.

A "Demo" badge SHALL NOT be treated as sufficient: it explains the numbers to
whoever built them, not to a member reading their own profile, and a member who
believes a figure about themselves has been misinformed regardless of the label.

Omission SHALL be preferred to an empty state where the capability itself is
absent — an empty state announces a feature that is coming, which is only honest
when one is.

#### Scenario: Absent capability renders nothing

- **WHEN** a member opens their own profile and the platform holds no statistics,
  projects or investments for them
- **THEN** no such section is rendered, with or without sample values

#### Scenario: Present capability renders an empty state

- **WHEN** a member holds no event registrations, a capability the platform does
  have
- **THEN** an empty state invites them to the events page rather than listing
  sample events
