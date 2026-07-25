# Academy & Library

## Purpose

Describes the Academy learning surface and its personal "My Courses" counterpart.
This is a placeholder capability: the Academy shows a small, hard-coded set of
curated video lessons embedded from external hosts, and there is no content
schema, enrollment, or progress tracking. Reconstructed from code as of the
OpenSpec migration. A data-driven academy with real courses and enrollment is
tracked as open work (AGE-262) and does not exist yet.

## Requirements

### Requirement: Academy lists curated video lessons

The system SHALL render an Academy page that displays a fixed, code-defined list
of curated lessons, each with a title, a description, and an embedded video from
an external host (YouTube/Vimeo) via a reusable embed component. The platform
SHALL NOT host video content itself.

#### Scenario: Academy shows the curated lessons

- **WHEN** a member opens the Academy page
- **THEN** each hard-coded lesson is shown as a card with its title, description,
  and an embedded external video player

### Requirement: My Courses is a placeholder with no enrollment

The system SHALL provide a "My Courses" page as the personal counterpart to the
Academy, and — because there is no enrollment or course data model — it SHALL
show only an empty-state message rather than any real course list.

#### Scenario: My Courses shows the empty state

- **WHEN** a member opens the My Courses page
- **THEN** it shows an empty-state message indicating no courses have been taken
  and no per-member course data is displayed
