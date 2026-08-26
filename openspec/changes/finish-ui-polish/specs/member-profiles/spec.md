## MODIFIED Requirements

### Requirement: Public profile fields are exposed through a read-only view

The system SHALL expose a fixed public field subset (`id`, `name`, `avatar_url`,
`region`, `company`, `short_bio`, `tier`, `roles`, `cover_url`) of `is_public`
profiles through the `profiles_public` view, granting SELECT to `authenticated`
only. The view SHALL be read-only to clients: `anon` and `authenticated` hold no
INSERT/UPDATE/DELETE, and `anon` holds no SELECT.

The `name` column SHALL be the **resolved** display name rather than the stored
one: the full name when the caller owns the row or is an activated member,
otherwise the masked "Mitglied" label. It is resolved in the view's body, so no
caller below the threshold receives another member's full name through the view —
and, because the view is the read path for the feed, events, the profile view, the
matching hub and `feed_top_authors`, resolving it here resolves it for all of them
without the predicate being copied anywhere.

Neue Felder SHALL an das **Ende** der Spaltenliste treten. `create or replace
view` verlangt, dass bestehende Spalten Name, Typ und Reihenfolge behalten; eine
Spalte in der Mitte einzufügen lässt die Anweisung scheitern. Die Reihenfolge
oben ist deshalb Vorschrift, nicht Darstellung.

The view runs with its owner's privileges (`security_invoker = off`) and
therefore does **not** evaluate the base table's policies. That is deliberate —
it is what lets a `basic` member see the directory's base fields that the base
table reserves for higher ranks. The consequence SHALL be carried explicitly:
**every access condition that must hold for the directory SHALL be stated in the
view's own body**, because a condition placed only in the base table's policies
does not reach callers of the view.

The activation gate SHALL therefore be part of the view's body, **on both
sides**: an unactivated caller SHALL receive no rows, and a profile whose own
owner has not activated SHALL NOT appear for anyone.

Weil die Sicht für jede Feldergänzung vollständig neu deklariert werden muss,
SHALL jede solche Neudeklaration das Gate wortgleich mitführen. Eine Ergänzung,
die es beim Abschreiben verliert, öffnet das Verzeichnis lautlos und wäre an der
Sicht selbst nicht abzulesen. Die Namensauflösung SHALL beim Abschreiben ebenso
mitgeführt werden, und sie SHALL das Gate **nicht** ersetzen: sie ist die zweite
von zwei Verteidigungen, keine Umformulierung der ersten.

#### Scenario: Authenticated member reads public fields of any listed profile

- **WHEN** an **activated** authenticated member selects from `profiles_public`
- **THEN** the public field subset of every `is_public` profile is returned, with
  `name` carrying the full name

#### Scenario: Ein unbestätigtes Profil steht für niemanden in der Sicht

- **GIVEN** ein bestätigtes Mitglied und ein Profil, dessen Inhaber nicht
  bestätigt hat
- **WHEN** das bestätigte Mitglied `profiles_public` abfragt
- **THEN** fehlt die Zeile des unbestätigten Profils, weil die Sicht auch auf
  den Aktivierungszeitpunkt der **Zeile** filtert

#### Scenario: Ein nicht aktiviertes Konto erhält aus der Sicht nichts

- **GIVEN** ein angemeldetes Konto, dessen Aktivierungszeitpunkt leer ist —
  unabhängig von seiner Mitgliedsstufe
- **WHEN** es `profiles_public` abfragt
- **THEN** erhält es null Zeilen — **einschließlich der eigenen** —, weil die
  Bedingung im Rumpf der Sicht steht und nicht in einer Policy, an der die Sicht
  vorbeiliefe. Die eigene Zeile ist hier keine Ausnahme: wer sich mit einem
  weitergegebenen Passwort anmeldet, ist gegenüber der Sicht das Mitglied

#### Scenario: Writes through the view are rejected

- **WHEN** any client issues INSERT/UPDATE/DELETE against `profiles_public`
- **THEN** the write is denied (write privileges were revoked from `anon` and
  `authenticated`)

#### Scenario: Anonymous visitor cannot read the view

- **WHEN** an anonymous (`anon`) caller selects from `profiles_public`
- **THEN** no rows are returned (SELECT was revoked from `anon`)

#### Scenario: Das Hintergrundbild erreicht die fremde Profilansicht

- **GIVEN** ein bestätigtes, öffentliches Profil mit gesetztem `cover_url`
- **WHEN** ein anderes bestätigtes Mitglied `profiles_public` für dieses Profil liest
- **THEN** enthält das Ergebnis `cover_url`

## ADDED Requirements

### Requirement: Display-name resolution is centralized and activation-gated

The system SHALL resolve a member's shown name through a single shared resolver
keyed off the authenticated caller's own state (never a client-supplied parameter),
and every name-bearing read surface — directory, community feed, events, matching,
and profile views — SHALL use it. The full name is shown to the profile owner and to
callers who are activated members; all other callers see the masked "Mitglied"
label. "Full name" here means `profiles.name`; contact fields (email, phone) remain
governed by the contact-request disclosure rules and are out of scope for this
resolver.

The resolver SHALL take the row's owner and the stored name as arguments and read
the caller only from the verified token. A surface SHALL NOT reproduce the condition
inline; a read path that carries a name without calling the resolver is the defect
this requirement exists to prevent.

The resolver's condition SHALL be re-checked even on surfaces that already gate the
caller, and the resulting redundancy SHALL NOT be removed. Today every such surface
is gated, so the masked branch is not reachable through any of them; the resolver
earns its place on the day one is added that forgets.

The masked name SHALL NOT be recoverable from anything else the surface returns —
in particular not from result ordering and not from whether a free-text search keeps
a masked row on screen.

The client SHALL render the name the server returned and SHALL NOT reconstruct a
full name from any other field. A client-side placeholder for a **missing** name is
not a reconstruction and remains permitted.

#### Scenario: All name-bearing surfaces use the shared resolver

- **WHEN** a member's name is shown on the feed, an event, a match, or a profile
- **THEN** the name is produced by the shared resolver, so masking is consistent
  across every surface

#### Scenario: The gate keys off the token, not client input

- **WHEN** a caller supplies a tier/identity parameter in an attempt to obtain a full name
- **THEN** it is ignored; resolution uses the authenticated token

#### Scenario: A caller below the threshold receives the masked label

- **WHEN** a caller who is not activated resolves a name that is not their own
- **THEN** the masked "Mitglied" label is returned

#### Scenario: The owner's own name is never masked

- **WHEN** a caller resolves the name of the row they own
- **THEN** the full name is returned, whether or not the caller is activated
