## MODIFIED Requirements

### Requirement: Offers and needs visibility is RLS-gated

The system SHALL restrict reading of `offers` and `needs` to the owning member or
a member holding the right `suche_biete` (`min_rank = 5`, FOCUS), enforced in the
database independently of the client by the `offers_select` / `needs_select`
policies calling `darf('suche_biete')`.

This requirement previously named `is_prime_plus()`. That predicate was replaced for
these two tables by the six-level migration and the spec text had not followed.

**Die Zahl wanderte mit AGE-903 von 3 auf 4 und wird mit V5F-1 zu einem Namen.**
Sie bezeichnete nie eine Rangzahl um ihrer selbst willen, sondern die unterste
Clubstufe. Detlevs SPEC 01 (V5 FINAL) löst sie von der Clubstufe: „SUCHE/BIETE
einstellen und lesen" ist ein Recht ab FOCUS. Die Schwelle SHALL deshalb nicht
mehr als Zahl im Policy-Rumpf stehen, sondern als `min_rank` der Zeile
`suche_biete` in `public.berechtigungen`.

**Anlegen verlangt das Recht, Pflegen nicht.** Ein INSERT in `offers`/`needs`
SHALL `darf('suche_biete')` verlangen — „einstellen" ist genau das, was SPEC 01
an FOCUS bindet. UPDATE und DELETE eigener Zeilen SHALL **ohne** das Recht
möglich bleiben, und eigene Zeilen SHALL immer lesbar sein. Begründung: ein
Mitglied, dessen Stufe sinkt, muss seine eigenen Einträge zurücknehmen oder
berichtigen können; sie unerreichbar zu machen wäre eine Datensperre, keine
Rechtegrenze. Die abgelöste Fassung sagte „maintaining one's own … is available
from the lowest tier" — davon bleibt das Pflegen, das Neuanlegen fällt.

#### Scenario: Discover-and-above member sees others' offers for matching

<!-- Titel zeichengleich. „Discover-and-above" ist ab AGE-1000 ueberholt —
     es ist „mit dem Recht `suche_biete`", also ab Rang 5. -->

- **WHEN** a member holding `suche_biete` selects `offers`/`needs`
- **THEN** the `offers_select`/`needs_select` policy returns rows of other members

#### Scenario: Below-Discover member sees only their own

<!-- Titel zeichengleich. Der Fall gilt ab AGE-1000 auch fuer Rang 4, also
     INNERHALB des Clubs. -->

- **WHEN** ein aktiviertes Mitglied auf Rang 4 `offers`/`needs` liest
- **THEN** kommen nur Zeilen zurück, deren `profile_id` die eigene ist

#### Scenario: Ohne das Recht entsteht keine neue Zeile

- **WHEN** ein aktiviertes Mitglied auf Rang 4 ein eigenes Angebot oder Gesuch
  anlegen will
- **THEN** wird der INSERT von der Policy abgelehnt

#### Scenario: A member below the rank can still maintain their own

<!-- Titel zeichengleich, und der Rumpf ist ENGER geworden: pflegen ja,
     neu anlegen nein. „maintain" meinte vorher beides. -->

- **GIVEN** ein aktiviertes Mitglied auf Rang 4 mit einer bestehenden eigenen
  Zeile in `offers`
- **WHEN** es diese Zeile ändert oder löscht
- **THEN** gelingt beides, und die Zeile ist ihm weiterhin lesbar

### Requirement: Match visibility is limited to participants

The system SHALL restrict reading of a `matches` row to the two profiles it links
**and** to a caller holding the right `vorschlaege` (`min_rank = 5`, FOCUS),
enforced by RLS.

**Ergänzt mit V5F-1.** Detlevs SPEC 01 führt „Match/Vorschläge" als Recht ab
FOCUS. Teilnehmerschaft allein SHALL deshalb nicht mehr genügen: eine Zeile
SHALL nur zurückkommen, wenn der Aufrufer an ihr beteiligt ist **und** das Recht
trägt. Die Reihenfolge ist wichtig — das Recht öffnet keine fremden Paare, und
die Teilnahme ersetzt das Recht nicht.

Die Zeilen eines Kontos, dessen Stufe unter Rang 5 liegt, SHALL in der Datenbank
bleiben. Ein Aufstieg SHALL sie wieder sichtbar machen, ohne dass das Matching
erneut laufen muss.

**Eine Nebenwirkung, die benannt sein will.** Eine Kontaktanfrage kann sich auf
einen Vorschlag berufen (`contact_requests.match_id`), und die Oberfläche
ermittelt diesen Bezug, indem sie `matches` liest. Ohne das Recht kommt dort
keine Zeile, die Anfrage entsteht also **unverknüpft**, und
`handle_contact_request_change` hebt den Status des Vorschlags nie an. Das SHALL
als hinnehmbar gelten und nicht als Fehler: ein Konto ohne `vorschlaege` sieht
Vorschläge gar nicht und kann sich deshalb auch nicht sinnvoll auf einen
berufen. Die Anfrage selbst gelingt unverändert — Entscheidung E4 hält
Kontaktanfragen ab Rang 4 offen. Gefunden im Diff-Review.

#### Scenario: Participant reads their match

<!-- Titel zeichengleich. Beteiligung allein genuegt ab AGE-1000 nicht mehr. -->

- **WHEN** a member holding `vorschlaege` selects `matches` where they are
  `a_profile_id` or `b_profile_id`
- **THEN** the `matches_select_participant` policy returns the row

#### Scenario: Non-participant sees nothing

- **WHEN** a member selects a `matches` row for a pair they are not part of
- **THEN** no row is returned

#### Scenario: Teilnahme ohne das Recht reicht nicht

- **GIVEN** ein aktiviertes Mitglied auf Rang 4, das an einem `matches`-Paar
  beteiligt ist
- **WHEN** es diese Zeile liest
- **THEN** kommt sie nicht zurück

#### Scenario: Ein Aufstieg bringt die Vorschläge zurück

- **GIVEN** dasselbe Mitglied, dessen Stufe anschliessend auf Rang 5 gesetzt wird
- **WHEN** es dieselbe Zeile erneut liest
- **THEN** kommt sie zurück — sie wurde nie gelöscht
