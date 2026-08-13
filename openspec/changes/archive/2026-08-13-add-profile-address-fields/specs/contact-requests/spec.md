## MODIFIED Requirements

### Requirement: Contact data is released only on acceptance

The system SHALL expose a recipient's private `profile_contacts` (email, phone
**und die vollständige Anschrift**: `street`, `postal_code`, `city`, `state`,
`country`) to a counterparty ONLY while a `contact_requests` row between the two
profiles has `status = 'accepted'`; contact data SHALL never become visible
implicitly, by any lesser status, or through the sending of a request alone.

Die Freigabe SHALL **fortlaufend** sein und nicht als Abzug zum Zeitpunkt der
Annahme gelten: ändert ein Mitglied später seine Anschrift, sieht die
angenommene Gegenseite den neuen Wert. Das gilt für E-Mail und Telefonnummer
seit jeher — es ist eine Eigenschaft der Policy, die auf die Zeile wirkt und
nicht auf einen Zeitpunkt — und wird hier ausdrücklich festgehalten, statt
als stillschweigende Nebenwirkung mitzulaufen.

#### Scenario: Accepted request releases contact data

- **WHEN** a member reads `profile_contacts` for a profile they have an
  `accepted` request with (in either direction)
- **THEN** the `contacts_select_self_or_released` policy returns the email/phone
  **und die Adressfelder derselben Zeile**

#### Scenario: Pending or declined request reveals nothing

- **WHEN** a member reads `profile_contacts` for a profile whose request is
  `pending` or `declined`
- **THEN** no contact row is returned and the profile page shows only the
  request flow, not the contact details

#### Scenario: Eine spätere Adressänderung erreicht die angenommene Gegenseite

- **GIVEN** zwei Mitglieder mit einer `accepted` Kontaktanfrage
- **WHEN** eines seine Anschrift danach ändert
- **THEN** liest die Gegenseite den neuen Wert, ohne dass eine neue Anfrage
  nötig wäre

## ADDED Requirements

### Requirement: Die Oberfläche benennt, was eine Annahme freigibt

Das System SHALL vor der Annahme einer Kontaktanfrage benennen, **welche** Daten
damit freigegeben werden, und SHALL dabei die Anschrift ausdrücklich nennen.
„Kontaktdaten werden geteilt" genügt nicht mehr: solange die Zeile E-Mail und
Telefonnummer trug, deckte sich der Begriff mit der Erwartung; mit der
vollständigen Anschrift tut er das nicht.

Dieselbe Aussage SHALL im Profil-Editor beim Kontaktblock stehen, damit sie auch
sieht, wer die Daten einträgt — und nicht nur, wer eine Anfrage bekommt.

Ein Widerruf einer einmal erteilten Freigabe SHALL NOT Teil dieser Zusage sein.
Es gibt heute keinen für E-Mail und Telefonnummer; einen allein für die
Anschrift zu bauen, hieße eine halbe Zusage zu geben. Das ist ein eigener
Vorgang.

#### Scenario: Der Annahme-Dialog nennt die Anschrift

- **WHEN** einem Mitglied eine offene Kontaktanfrage zur Entscheidung angezeigt
  wird
- **THEN** nennt der Text E-Mail, Telefonnummer **und Anschrift** als das, was
  eine Annahme freigibt

#### Scenario: Der Editor sagt es beim Eintragen

- **WHEN** ein Mitglied den Kontaktblock im Profil-Editor öffnet
- **THEN** steht dort, dass diese Angaben nach einer angenommenen
  Kontaktanfrage für die Gegenseite sichtbar sind
