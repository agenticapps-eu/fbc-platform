## MODIFIED Requirements

### Requirement: Offers and needs visibility is RLS-gated

The system SHALL restrict reading of `offers` and `needs` to the owning member or a
member whose level rank clears the club entry at **rank 4** (`discover` in the
ladder introduced by AGE-903), enforced in the database independently of the
client by the `offers_select` / `needs_select` policies using `has_level(4)`.

This requirement previously named `is_prime_plus()`. That predicate was replaced for
these two tables by the six-level migration and the spec text had not followed;
the gate is `has_level(4)`. Own rows stay visible at every level, because
maintaining one's own "Ich suche / Ich biete" is available from the lowest tier —
only browsing **other** members' offers and needs sits behind the rank.

**Die Zahl wanderte mit AGE-903 von 3 auf 4.** Sie bezeichnete nie eine
Rangzahl um ihrer selbst willen, sondern die unterste Clubstufe; die trug
vorher die 3 und trägt jetzt die 4. Eine Stufe, die nur die eigene Zeile sieht,
hiess vorher `basic`/`connect` und heisst jetzt `active`/`boost`/`connect` —
dieselbe Zusage, ein Rang mehr darunter.

#### Scenario: Discover-and-above member sees others' offers for matching

- **WHEN** a member with `level_rank >= 4` selects `offers`/`needs`
- **THEN** the `offers_select`/`needs_select` policy returns rows of other members

#### Scenario: Below-Discover member sees only their own

- **WHEN** a member with `level_rank < 4` selects `offers`/`needs`
- **THEN** only rows where `profile_id` equals their own id are returned

#### Scenario: A member below the rank can still maintain their own

<!-- Titel zeichengleich; der Rumpf nennt `active` statt `basic`, denselben
     Rang 1 nach AGE-903. -->

- **WHEN** an `active` member writes their own offer or need
- **THEN** the write succeeds and the row is readable to them
