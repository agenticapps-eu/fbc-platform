## REMOVED Requirements

### Requirement: Author name masking is only partially resolved

**Reason:** Superseded — the name reveal now runs through the shared display-name
resolver (see `member-profiles`), replacing the "partially resolved / not yet
implemented" status. The anonymous "Mitglied" fallback is retained by the new
requirements.

## ADDED Requirements

### Requirement: Directory names are resolved by the viewer's activation

The directory SHALL display each member's name via the shared display-name resolver
(see `member-profiles`): a caller who is the member themselves, or who is an
**activated** member, SHALL see the full name; every other caller SHALL see the
masked "Mitglied" label. Resolution SHALL occur in the database read path
(`profiles_public` / `search_directory`), so the full name is never sent to a
below-threshold caller.

**The threshold is activation, not a tier.** An earlier plan set it at
`level_rank >= 4` (`exchange`). Because "members" now means every activated member,
that threshold would have masked every author of a feed the same members may read —
a full feed in which nobody has a name. The two do not conflict technically; they
conflict in purpose, and the feed's purpose wins.

**The resolver SHALL apply even where a gate already excludes the caller.** Every
surface that carries a name today is additionally gated on activation, so a caller
the resolver would mask receives no rows at all and the masked branch is unreachable.
That is the point: the resolver is the second of two independent defences, and a
future surface that omits the gate must still not disclose a name. The duplication is
therefore deliberate and SHALL NOT be factored away — two checks that would fail
together are one check.

**Masking the returned column is not sufficient by itself.** Ordering and full-text
search are disclosure channels of their own: a masked row at its alphabetical
position discloses the name the column withholds, and a search term that keeps a
masked row on screen answers the same question. Both SHALL be bound to the same
right as the column.

#### Scenario: An activated viewer sees the full name

- **WHEN** an activated caller reads another member in the directory
- **THEN** that member's full name is returned

#### Scenario: A viewer below the threshold sees the masked label

- **WHEN** a caller who is not activated resolves another member's name
- **THEN** the "Mitglied" masked label is returned and the full name is absent from
  the payload

#### Scenario: A member always sees their own full name

- **WHEN** a caller reads their own directory row
- **THEN** their full name is returned, whether or not they are activated

#### Scenario: Anonymous caller keeps the masked fallback

- **WHEN** an anonymous caller cannot read an author's profile row
- **THEN** the name renders as the "Mitglied" fallback

#### Scenario: The masked name does not leak through ordering

- **WHEN** the directory is ordered by name
- **THEN** it is ordered by the resolved name, so a masked row does not occupy the
  alphabetical position of the name it withholds

#### Scenario: The masked name does not leak through search

- **WHEN** a caller who may not see names searches the directory by free text
- **THEN** the search does not answer whether a masked row matches the term, so the
  search cannot be used as an oracle on the withheld name

#### Scenario: A surface without the gate still masks

- **WHEN** a read path reaches profile rows without the activation gate in front of it
- **THEN** the resolver still returns the masked label to a caller below the
  threshold, because it re-checks the caller itself
