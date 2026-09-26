## MODIFIED Requirements

### Requirement: Visibility follows membership tier rank

The system SHALL gate tier-scoped visibility on the caller's numeric tier rank
via `current_tier_rank()` and the derived parametric predicate
`has_level(min_rank)`, so that a member below the required rank cannot read a
higher-tier resource while a member at or above it can. The rank comparison —
not a client flag — SHALL be the deciding factor.

**Korrigiert 2026-08-05.** Der bisherige Text nannte `is_prime_plus()` als
lebendes Prädikat. Die Funktion existiert seit AGE-311 nicht mehr: sie wurde
gedroppt, nachdem alle sieben abhängigen Policies auf `has_level()` umgehängt
worden waren. Gemessen gegen die Datenbank, nicht aus den Migrationen gelesen.

Die Rangprüfung SHALL NOT als alleinige Hürde vor Mitgliederdaten stehen, wo
Konten mit hoher Stufe provisioniert werden, ohne dass ihr Inhaber sich je
ausgewiesen hat. In diesem Fall SHALL das Aktivierungs-Gate zusätzlich greifen.

**Nachgezogen mit AGE-903.** Die tier-abhängige Schwelle vor Mitgliederdaten
liegt seither einheitlich bei **Rang 4**, dem Eintritt in den Club. Vorher
standen zwei Schwellen nebeneinander (Rang 2 für die Verzeichnisliste, Rang 3
für die erweiterten Felder). Ein Beispiel, das eine Stufe beim Namen nennt,
trägt deshalb ab jetzt immer den Rang mit — ein Schlüssel allein sagt nichts
mehr: `discover` bezeichnete vor AGE-903 den Rang 3 und danach den Rang 4.

#### Scenario: Below-threshold member is excluded from the full directory

- **WHEN** a member below the directory threshold selects another member's full
  `profiles` row (extended fields) or their `offers`/`needs`
- **THEN** the tier-gated policy (via `has_level()`/`current_tier_rank()`)
  returns no row

#### Scenario: At-or-above-threshold member gains access

- **WHEN** an **activated** member at or above the threshold reads the same
  resource
- **THEN** the tier gate permits it (e.g. a member at rank 4 — `discover` in
  the ladder introduced by AGE-903 — reads a full foreign profile and its
  extended interests)

#### Scenario: Eine hohe Stufe ersetzt die Aktivierung nicht

- **GIVEN** ein Konto auf der höchsten Stufe, das nie aktiviert wurde
- **WHEN** es dieselbe Ressource liest
- **THEN** wird sie verweigert — die Stufe öffnet nichts, solange die
  Aktivierung fehlt

#### Scenario: Ein Rang unterhalb des Clubs liest keine fremden Mitgliederdaten

- **GIVEN** ein aktiviertes Konto auf Rang 3 (CONNECT nach AGE-903)
- **WHEN** es ein fremdes Vollprofil, `offers`, `needs`, `profile_interests`,
  `profile_badges` oder `profile_theme_scores` liest
- **THEN** kommt keine Zeile zurück — Rang 3 liegt ausserhalb des Clubs, und
  genau dieser Fall war vor AGE-903 erlaubt
