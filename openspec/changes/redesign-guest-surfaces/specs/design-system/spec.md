## MODIFIED Requirements

### Requirement: Content uses the available width; only reading columns are capped

Pages SHALL use the width the viewport offers, up to 1440 px beside the sidebar.
A width cap SHALL apply only to routes that are a form or a single column of prose
— sign-in, onboarding, settings and the profile editor — and SHALL sit at 760 px.

The rule SHALL be stated as a list of the capped routes, not of the wide ones: a
default cap silently starves every multi-column layout added later, which is how
`lg:grid-cols-3` and `xl:grid-cols-4` on the dashboard came to be classes that
could never take effect.

**The cap SHALL apply to the reading or form column itself, not to the page
composition around it.** A capped route MAY place a companion panel beside its
column and use the remaining width for it, provided the column keeps its capped
measure. What the cap protects is the line length someone reads and the width of
the fields they fill in; it was never a rule that the rest of the viewport must
stay empty.

This is stated because the narrower reading — cap the route, leave the rest blank
— is the one that was implemented, and it left the sign-in route using 31 % of a
1440 px viewport with 992 px beside it doing nothing.

#### Scenario: A multi-column page gets its columns

- **WHEN** the member dashboard renders at 1440 px
- **THEN** its tile grid and its two-column section resolve at their intended
  breakpoints, and no card title is truncated for want of width

#### Scenario: A form keeps a readable measure

- **WHEN** the settings page renders at 1440 px
- **THEN** its column stays capped rather than stretching across the full width

#### Scenario: A capped route may use the width beside its column

- **WHEN** the sign-in route renders at 1440 px
- **THEN** its form column stays within the cap while a companion panel occupies
  the width beside it, rather than the width standing empty

### Requirement: Every content page opens with an image header

Each page reachable from the navigation SHALL open with a header carrying a title,
a one-line claim and a photograph. The photograph SHALL bleed to the right and
SHALL be overlaid by a gradient that keeps the text side an even surface: body copy
SHALL NOT sit on the image.

Each such page SHALL have its **own** motif, held in one route table rather than at
the call sites. A shared default image is not acceptable — a header that repeats
across pages replaces the orientation it exists to give.

This uniqueness rule binds the pages reachable from the navigation. A route
outside the navigation MAY carry a motif already assigned to one of them, and
where it does, that reuse SHALL be recorded alongside the image's provenance
rather than left to be discovered.

Form and reading routes (sign-in, onboarding, settings, profile editor) SHALL NOT
carry an image header: over a form it is decoration in front of the task.

**The sign-in route SHALL nevertheless carry imagery beside the form.** What the
rule above forbids is putting a picture *between* the visitor and the task; it
does not require the entry screen to be bare.

On wide viewports the sign-in route SHALL place a full-height panel beside the
form. That panel SHALL use the **same device** as an image header — photograph
with a gradient that keeps the text side an even surface — carrying the brand mark
and the claim on that even surface. No copy of any kind SHALL sit on the
photograph, here as anywhere else, and no form field, label or button SHALL appear
in the panel at all.

Naming it the same device is deliberate, and more honest than inventing a
different one: what changes is the axis, not the treatment. Beside the form it
orients before the task; above the form it stands in front of it. That is the
whole distinction, and it is written down because the silence was once read as
"the entry screen must be plain".

Where the panel is not shown, the brand mark and the claim SHALL still appear
above the form. Losing them entirely on narrow viewports would strip the identity
from the screen on the devices where most members sign in.

The sign-in route SHALL retain, at every width, every way out it offers: the
switch between signing in and registering, the forgotten-password path, the route
back to the public home, and the legal notices.

#### Scenario: A navigation page opens with its own motif

- **WHEN** a member opens Kompass, Academy, Events, Mitglieder or Aktivität
- **THEN** each shows a header with title, claim and a photograph that page does not
  share with the others

#### Scenario: The header text stands on an even surface

- **WHEN** an image header renders
- **THEN** the title and claim sit on the flat gradient side, not on the photograph

#### Scenario: The sign-in route carries a panel beside the form

- **WHEN** a visitor opens the sign-in route on a wide viewport
- **THEN** a panel with the photograph, the brand mark and the claim stands beside
  the form, and no text and no control of any kind sits on the photograph

#### Scenario: The brand survives where the panel does not

- **WHEN** a visitor opens the sign-in route on a narrow viewport
- **THEN** the form occupies the width alone and remains operable, and the brand
  mark and claim still appear above it

#### Scenario: Every way out survives the layout

- **WHEN** the sign-in route renders at any width, in either mode
- **THEN** the switch between signing in and registering, the forgotten-password
  path, the route back to the public home and the legal notices are all present

## ADDED Requirements

### Requirement: A promotional claim made to visitors carries a source

A statement the platform itself makes to people who are not signed in — a count,
a statistic or a testimonial presented as evidence of the club — SHALL derive
from data the system holds, or SHALL name the person it comes from. Where neither
is available, the section SHALL be omitted rather than filled with an
illustrative value.

The rule is deliberately confined to what **the platform asserts about itself**.
It does not govern legal text, event data, prices, or anything a member writes:
those have their own sources and their own requirements, and stretching one rule
across all of them would make it unverifiable and therefore worthless.

A rounded or aspirational figure SHALL NOT be treated as exempt. A membership
count stated as more than the accounts that exist is a number a member can count.

An attribution to an unnamed archetype — "a member at this level" — SHALL NOT be
treated as naming a person.

#### Scenario: A guest page shows no unsourced promotional count

- **WHEN** a visitor without a session opens a page carrying the platform's own
  claims about itself
- **THEN** every such figure derives from data the system holds, and no section
  presents an illustrative one

#### Scenario: A testimonial names its author or is absent

- **WHEN** a public page would present a testimonial
- **THEN** it names the person it comes from, and otherwise the section is absent
  rather than attributed to an unnamed archetype

### Requirement: The guest home carries the same two-column structure as the signed-in home

On wide viewports the public home SHALL place its reading content in a main
column with a narrower rail beside it, using the ratio the signed-in home already
uses rather than introducing a third one. The image header SHALL span the full
width above that grid, not sit inside the main column. Below the breakpoint the
page SHALL collapse to a single column, with the rail's content following the
reading content rather than preceding it.

The rail SHALL carry only material that needs no query and no invented figure:
the membership levels the application already defines in code, and one invitation
to join.

The levels SHALL be read from the application's own level definitions, in the
order those definitions establish, and SHALL show for each the label, what it
unlocks, and its price. A list maintained separately from those definitions would
drift from what the platform actually sells.

#### Scenario: The guest home shows a rail on a wide viewport

- **WHEN** a visitor without a session opens the home page on a wide viewport
- **THEN** the reading content stands in a main column with a rail beside it, and
  the image header spans the width above both

#### Scenario: The rail collapses on a narrow viewport

- **WHEN** the same page is opened on a narrow viewport
- **THEN** it renders as one column and the rail's content follows the reading
  content rather than preceding it

#### Scenario: The rail names the levels the application defines

- **WHEN** the rail renders
- **THEN** the levels it lists are those the application holds in code, in their
  defined order, each with its label, what it unlocks and its price

### Requirement: The invitation to register opens registration

A control that invites a visitor to become a member SHALL lead to the registration
form, not to the sign-in form. The registration state SHALL therefore be
addressable, so that a link can reach it.

Every such control on the guest surfaces SHALL use it. A button labelled "become a
member" that presents a sign-in form asks the visitor to do something they cannot
do, and it does so at the exact moment they decided to join.

The state SHALL follow the address even when the sign-in route is already
rendered, because a route that does not remount keeps whatever state it had.

#### Scenario: An invitation to join opens the registration form

- **WHEN** a visitor activates a control inviting them to become a member
- **THEN** the registration form is shown, not the sign-in form

#### Scenario: The state follows the address without a remount

- **WHEN** the sign-in route is already rendered and the visitor navigates to the
  registration address
- **THEN** the registration form is shown rather than the previously rendered mode
