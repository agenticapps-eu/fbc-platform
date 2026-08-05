## ADDED Requirements

### Requirement: The navigation shows only what the launch actually delivers

The system SHALL present exactly seven member-facing menu entries, in two labelled
groups: _Entdecken_ — Start, Academy, Events, Mitglieder, Aktivität — and _Mein
Bereich_ — Mein Profil, Einstellungen. The group headings SHALL remain visible; two
groups of five and two are still structure worth naming.

Staff-only navigation SHALL sit outside that count. The administration entry
appears for administrators alone and is not part of the member-facing seven, so a
check on the rendered sidebar SHALL account for the viewer's role rather than
asserting a bare total.

A route SHALL NOT appear in the menu when it has no content to show at launch. A
route removed from the menu SHALL keep working when opened directly, unless a
redirect is stated for it, so links and bookmarks do not break and restoring the
entry is a single declaration.

No rendered link SHALL target a route that only redirects elsewhere. A menu entry
withdrawn in an earlier change leaves such links behind in cards and widgets, where
they read as working paths and lead nowhere.

The menu SHALL be identical for every membership level; rights gate content, not
navigation.

#### Scenario: The sidebar lists exactly the launch scope

- **WHEN** a signed-in member without a staff role renders the sidebar
- **THEN** it shows Start, Academy, Events, Mitglieder, Aktivität under
  _Entdecken_ and Mein Profil, Einstellungen under _Mein Bereich_, and nothing else

#### Scenario: An administrator additionally sees their own section

- **WHEN** a member with the `admin` role renders the sidebar
- **THEN** the same seven entries appear plus the administration section, and the
  member-facing seven are unchanged

#### Scenario: A demoted route stays reachable

- **WHEN** a member opens `/mitgliedschaft`, `/meine-kurse` or `/kontakte` directly
- **THEN** the page renders, although no menu entry leads there

#### Scenario: No link points at a redirect-only route

- **WHEN** the rendered interface is searched for links to routes that only redirect
- **THEN** none is found — in particular no card or widget still offers
  `/meine-chancen` or `/matching`

#### Scenario: An empty group is not rendered

- **WHEN** every entry of a group has left the menu
- **THEN** the group heading is not rendered either

### Requirement: Every main page opens empty with an invitation, not a status report

The system SHALL give every main page an empty state that names what will appear
there and offers one concrete action the member can take now. An empty state SHALL
NOT be phrased as an absence of data ("Keine Daten vorhanden", "Noch keine X") when
the member can do something about it.

The rule SHALL apply to **data-dependent regions** — a list, feed, collection or
summary whose content comes from rows that may not exist yet — and SHALL NOT
apply to pages made of static content or of a form that is always present. A
settings form, a page of fixed editorial content and a wizard entry point are
never "empty"; demanding a state for them would produce a placeholder that can
never render.

The regions in scope at launch are: the activity feed, the events list, the member
directory, the member's own profile when it is unfilled, the conversation list,
the member's own events, and the contacts and courses regions of the
menu-withdrawn routes. The academy and the membership page are **out of scope** —
both always render content today (a fixed set of lessons, the level summary), so
an empty state for them could never appear; the academy gains one when its library
becomes data-driven.

Where the member genuinely cannot act — a page whose content depends on other
people or on a later release — the empty state SHALL say what will fill it and
when, rather than leaving a bare negation, and SHALL NOT offer a control that does
nothing.

A filtered view that returns nothing SHALL be distinguished from a view that is
empty because nothing exists yet, and SHALL offer to clear the filters.

#### Scenario: An actionable empty state offers the action

- **WHEN** the activity feed has no posts and the member may write one
- **THEN** the empty state invites them to post and renders the control that does it

#### Scenario: A dependent empty state explains rather than negates

- **WHEN** a page cannot be filled by the member's own action
- **THEN** the empty state says what will appear there and what has to happen
  first, and offers no inert control

#### Scenario: Every enumerated region has one

- **WHEN** a member signs in to an account with no data and visits each page
  carrying a region named by this requirement
- **THEN** each region shows an empty state meeting these rules, none shows a bare
  paragraph or a blank area

#### Scenario: A static page needs no empty state

- **WHEN** a page consists of a form or fixed content that is always present
- **THEN** no empty state is required or rendered for it

#### Scenario: No result from filters is not the same as no data

- **WHEN** a member's filter combination matches nobody
- **THEN** the empty state says so and offers to reset the filters, distinct from
  the state shown when no members exist at all
