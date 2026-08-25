## ADDED Requirements

### Requirement: Ein einzelner Beitrag ist adressierbar

The feed SHALL accept the identifier of a single post and, when given one, SHALL
load that post by its identifier and present it ahead of the feed. Without such an
identifier the feed SHALL behave exactly as before — the address is an addition,
not a second mode.

Loading it by identifier rather than searching for it in the feed is what makes
the promise reachable: an addressed post may be arbitrarily old, and a feed that
scans its own pages either stops early — and then fails for exactly the quieter
members whose posts lie furthest back — or scans without bound.

The addressed post SHALL NOT be shown twice: where it also occurs in the feed
below, it SHALL appear only once.

The presentation SHALL NOT act as a filter. The rest of the feed SHALL be present
below the addressed post, and paging onwards SHALL still work.

#### Scenario: The feed opens on the addressed post

- **WHEN** the feed is opened with the identifier of a post the caller may see
- **THEN** that post is shown ahead of the feed, however old it is

#### Scenario: Without an identifier nothing changes

- **WHEN** the feed is opened with no post identifier
- **THEN** it shows its first page from the top, with no post singled out

#### Scenario: The addressed post is not shown twice

- **WHEN** the feed is opened on a post that also falls on the loaded pages
- **THEN** it appears once, not once above and once within the list

#### Scenario: The address does not become a filter

- **WHEN** the feed has been opened on an addressed post
- **THEN** the other posts of the feed are present below it, and paging onwards
  still works

#### Scenario: The address does not disturb the feed's own query

- **WHEN** the feed is opened once with and once without a post identifier, with
  the same selection otherwise
- **THEN** the feed's own query is the same in both cases — the address changes
  what is shown in addition, never what the feed itself requests

### Requirement: Ein Verweis auf einen unsichtbaren Beitrag verrät ihn nicht

Addressing a post the caller may not see SHALL be indistinguishable from
addressing a post that does not exist.

The promise SHALL be satisfied by construction rather than by wording: both cases
SHALL travel the same code path and yield the same empty result, so that there
are not two outcomes whose messages a later change could pull apart. "An
invisible post is not shown" would not be enough — it is compatible with a
surface that answers *no access* for one and *not found* for the other, and the
difference between those two answers is itself the disclosure.

#### Scenario: Invisible and non-existent answer alike

- **WHEN** the feed is opened once with the identifier of an existing post the
  caller may not see, and once with an identifier that belongs to no post
- **THEN** both requests return no post, and the two surfaces are identical —
  the same wording and the same absence of any hint that one of the two exists

#### Scenario: The two cases are one code path

- **WHEN** the two requests above are compared
- **THEN** they issue the same request and receive the same empty result, rather
  than being distinguished and then rendered alike

#### Scenario: A visible post is still reached

- **WHEN** the feed is opened with the identifier of a post the caller may see
- **THEN** it is shown — so that the promise above is not satisfied by a surface
  that simply refuses everything
