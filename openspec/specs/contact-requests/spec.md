# Contact Requests

## Purpose

Defines the consent-based contact flow between two members: a sender asks to
connect, the recipient accepts or declines, and only an accepted request
releases the recipient's private contact data (email/phone). The rule "no
contact data before acceptance" is enforced in the database by RLS, never by
the frontend. Reconstructed from the code as of the OpenSpec migration.
## Requirements
### Requirement: One directed request per ordered pair

The system SHALL store contact requests in `public.contact_requests` with
`from_id`, `to_id`, an optional `match_id`, an optional `message`, and a
`status` constrained to `pending`, `accepted`, or `declined` (default
`pending`), and SHALL enforce a unique constraint on `(from_id, to_id)` so a
sender holds at most one request toward a given recipient.

#### Scenario: Duplicate request is rejected

- **WHEN** a sender inserts a second `contact_requests` row with the same
  `(from_id, to_id)` pair
- **THEN** the write is rejected by the `contact_requests_unique_pair` unique
  constraint (SQLSTATE 23505) and the UI reports "Anfrage besteht bereits"

#### Scenario: Match reference is optional

- **WHEN** a request is created from a public profile page with no originating
  match
- **THEN** the row is stored with `match_id = NULL` and remains valid

### Requirement: Sender may only insert a pending request for themselves

The system SHALL permit an authenticated member to INSERT a contact request
only when `from_id` equals the caller, `status = 'pending'`, the recipient is
contactable (`is_contactable(to_id)`), and — when `match_id` is supplied — that
match belongs to the `(from_id, to_id)` pair.

#### Scenario: Forged sender is denied

- **WHEN** a member inserts a request whose `from_id` is not their own auth uid
- **THEN** the `cr_insert_self` RLS policy denies the INSERT (SQLSTATE 42501)

#### Scenario: Pre-accepted insert is denied

- **WHEN** a member inserts a request with `status` other than `pending`
- **THEN** the INSERT is denied, so no member can self-issue an already
  `accepted` request to harvest contact data

#### Scenario: Mismatched match_id is denied

- **WHEN** a request carries a `match_id` whose match does not join `from_id`
  and `to_id`
- **THEN** the INSERT is denied by the policy's pair-ownership check

### Requirement: Recipient may only flip a pending request to accepted or declined

The system SHALL grant authenticated members UPDATE privilege on the `status`
column only, and SHALL permit the recipient to change a request that is
currently `pending` and addressed to them (`to_id = auth.uid()`) to either
`accepted` or `declined`; all other columns (`from_id`, `to_id`, `match_id`,
`message`) SHALL be non-writable by members.

#### Scenario: Recipient accepts a pending request

- **WHEN** the recipient of a `pending` request sets `status = 'accepted'`
- **THEN** the `cr_update_recipient` policy permits the UPDATE

#### Scenario: Rewriting from_id or match_id is denied

- **WHEN** a member attempts to UPDATE `from_id`, `to_id`, `match_id`, or
  `message` on a request
- **THEN** the write is denied at the column-privilege layer (members hold
  `UPDATE (status)` only)

#### Scenario: Re-flipping a non-pending request is denied

- **WHEN** a member attempts to change the status of a request that is not
  `pending` (e.g. re-accept an already accepted or declined row)
- **THEN** the UPDATE is denied by the policy's `status = 'pending'` USING clause

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

### Requirement: Acceptance drives lifecycle side-effects server-side

The system SHALL run a `SECURITY DEFINER` trigger
(`handle_contact_request_change`) on `contact_requests` that, on INSERT,
transitions the originating suggested match to `requested` and notifies the
recipient; on transition to `accepted`, sets the match to `accepted`, opens the
normalized (least/greatest) message thread idempotently, and notifies the
sender; and on transition to `declined`, sets the match to `declined` without
undoing an existing acceptance and notifies the sender. These cross-member
writes SHALL NOT be performable by members directly.

#### Scenario: Acceptance opens the chat thread

- **WHEN** a request transitions to `accepted`
- **THEN** the trigger inserts a `message_threads` row for the pair
  (`ON CONFLICT DO NOTHING`), enabling the chat

#### Scenario: Recipient is notified on a new request

- **WHEN** a request is inserted
- **THEN** the trigger writes a `contact_request` notification for `to_id`, a
  row the members could not write themselves under `notifications_own`

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

### Requirement: Eine offene eingehende Anfrage ist ohne Vorwissen erreichbar

Das System SHALL einem Mitglied mit **mindestens einer offenen eingehenden**
Kontaktanfrage einen Weg dorthin anbieten, der **kein Vorwissen** über die
Anfrage voraussetzt — insbesondere ohne dass es die Profilseite des Absenders
aufrufen muss.

Der Weg SHALL in der **Navigation** stehen und die **Anzahl** der offenen
Anfragen nennen, damit er als Aufforderung erkennbar ist und nicht als weiterer
Menüpunkt untergeht. Die Anzahl SHALL zugänglich benannt sein — eine nackte
Ziffer neben einem Wort ist keine Aussage darüber, **was** gezählt wurde.

Der Weg SHALL NOT erscheinen, solange **keine** offene eingehende Anfrage
vorliegt. Er ist kein dauerhafter Menüpunkt, sondern die Anzeige eines offenen
Vorgangs; ohne Vorgang gibt es nichts anzuzeigen. Damit bleibt die Entscheidung
aus AGE-494 in Kraft — sie nahm den ständigen Kontakte-Eintrag heraus, weil
bestehende Kontakte über Profil und Chat erreichbar sind, und traf den Fall
einer **noch offenen** Anfrage nicht, für den beides nicht trägt.

Der Hinweis auf der Profilseite des Absenders SHALL als zusätzlicher Weg bestehen
bleiben. Er ist nützlich, wenn man ohnehin dort steht — er ist nur kein
Einstiegspunkt, weil er ihn schon voraussetzt.

#### Scenario: Eine offene Anfrage schafft einen Weg

- **WHEN** einem Mitglied eine offene eingehende Kontaktanfrage vorliegt
- **THEN** erreicht es die Anfragen über die Navigation, ohne zuvor ein fremdes
  Profil aufgerufen zu haben

#### Scenario: Der Weg nennt die Anzahl, und zwar benannt

- **WHEN** zwei offene eingehende Anfragen vorliegen
- **THEN** trägt der Weg die Zahl 2, und sein zugänglicher Name sagt, dass es
  sich um offene Anfragen handelt

#### Scenario: Ohne offene Anfragen gibt es den Weg nicht

- **WHEN** keine offene eingehende Anfrage vorliegt
- **THEN** erscheint der Navigationseintrag NICHT, und insbesondere keine Null

#### Scenario: Der Chat ist kein Ersatz

- **WHEN** eine eingehende Anfrage noch offen ist
- **THEN** besteht für sie kein Chat, und der Weg zu den Anfragen ist unabhängig
  davon erreichbar

#### Scenario: Ausgeloggt wird nicht gefragt

- **WHEN** niemand angemeldet ist
- **THEN** wird die Abfrage der eingehenden Anfragen **gar nicht** abgesetzt, und
  der Eintrag erscheint nicht

### Requirement: Ein unbekannter Stand der Anfragen sieht nicht aus wie „keine"

Weiß das System die Anzahl der offenen eingehenden Anfragen **nicht**, weil ihr
Abruf fehlschlug, SHALL es das anzeigen — und SHALL NOT denselben Eindruck
erzeugen wie „es liegt nichts an".

Der Navigationseintrag SHALL in diesem Fall **erscheinen** und statt einer Zahl
kenntlich machen, dass der Stand unbekannt ist. Sein zugänglicher Name SHALL
sagen, dass die Anfragen nicht geladen werden konnten.

Der Grund ist die Bauart dieses Wegs: Er ist das **einzige** Signal für einen
offenen Vorgang, und er wird aus einer Abfrage gespeist, die scheitern kann.
Verschwände er beim Scheitern, wäre er genau der stille Fehlschlag, gegen den er
gebaut wurde — nur an der Stelle, auf die sich alles andere verlässt.

#### Scenario: Der Abruf für den Navigationseintrag scheitert

- **WHEN** die Abfrage der offenen eingehenden Anfragen mit einem Fehler endet
- **THEN** erscheint der Navigationseintrag, ohne Zahl, und sein zugänglicher
  Name sagt, dass die Anfragen nicht geladen werden konnten

### Requirement: Ein gescheiterter Abruf der Anfragen ist nicht Stille

Die Fläche „Meine Anfragen" SHALL einen **fehlgeschlagenen** Abruf sichtbar
melden. Sie SHALL NOT im Fehlerfall dasselbe zeigen wie bei einem leeren
Posteingang.

Ein leerer Posteingang SHALL weiterhin **still** bleiben — ein Leerzustand, der
bei jedem Aufruf erscheint, ist Lärm. Der Unterschied ist der Punkt: „nichts da"
weiß die Fläche, „Abruf gescheitert" weiß sie gerade nicht.

Scheitert ein **Nachladen**, während bereits Anfragen vorliegen, SHALL die Fläche
die vorliegenden Anfragen **weiter zeigen** und beantwortbar halten. Sie SHALL
NOT durch eine Fehlermeldung ersetzt werden: Eine beantwortbare Anfrage zu
verstecken, weil ihre Aktualisierung scheiterte, richtet mehr Schaden an als der
veraltete Stand.

#### Scenario: Der Abruf scheitert, ohne dass etwas vorliegt

- **WHEN** die Abfrage der eingehenden Anfragen mit einem Fehler endet und keine
  Daten vorliegen
- **THEN** erscheint ein sichtbarer Hinweis, dass die Anfragen nicht geladen
  werden konnten

#### Scenario: Ein Nachladen scheitert über vorliegenden Anfragen

- **WHEN** bereits Anfragen geladen sind und ein erneuter Abruf fehlschlägt
- **THEN** bleiben die Anfragen sichtbar und beantwortbar

#### Scenario: Leer bleibt still

- **WHEN** die Abfrage erfolgreich ist und keine offene Anfrage liefert
- **THEN** erscheint **keine** Karte und **kein** Leerzustand

### Requirement: Kontaktanfragen sind nach Absender- und Empfängerstufe gestaffelt

Das System SHALL die Erlaubnis, eine Kontaktanfrage einzufügen, aus **beiden**
Stufen ableiten — der des Absenders und der des Empfängers:

- Ein Absender mit Rang 1 (`basic`) SHALL **keine** Kontaktanfrage senden
  dürfen.
- Ein Absender mit Rang 2 (`connect`) SHALL nur an einen Empfänger mit **genau**
  Rang 2 senden dürfen. „`connect` und darüber" ist ausdrücklich **nicht**
  gemeint; die Auslegung ist am 25.08.2026 entschieden worden, samt der
  benannten Folge, dass ein `connect`-Mitglied bei heutigem Bestand niemanden
  erreicht.
- Ein Absender ab Rang 3 (`discover`) SHALL an jeden Empfänger senden dürfen.

Die Regel SHALL in einem benannten Prädikat stehen, nicht als Bedingungskette in
der Policy, und SHALL die Empfängerstufe mit den Rechten der Funktion lesen
(`SECURITY DEFINER`, `search_path` leer, `execute` nur für `authenticated`).
Ohne erhöhte Rechte fiele die Prüfung für einen Absender unterhalb Rang 3 still
auf „kein Recht" und verböte **jede** Anfrage — derselbe Grund, aus dem
`is_contactable(uuid)` DEFINER ist.

<!-- Bis zum Archivieren stand hier `is_new_member` als Beispiel. Der Delta war
     geschrieben, als es die Funktion noch gab; derselbe Change hat sie
     gestrichen. Ein Verweis auf eine gelöschte Funktion in der durablen
     Wahrheit ist genau die Sorte Nachweisschuld, gegen die diese Datei
     geschrieben ist — deshalb korrigiert statt stehen gelassen.
     `is_contactable` trägt dasselbe Muster aus demselben Grund
     (`20260715150000_six_level_model.sql:127`). -->


Der Admin-Schalter `platform_settings.open_contact` SHALL diese Staffelung —
und nur sie — aufheben können, solange er `true` ist. Nur `is_admin()`-Mitglieder
SHALL den Schalter schreiben dürfen.

Unabhängig vom Schalter und in **jedem** Modus SHALL weiterhin gelten: der
Absender SHALL sich selbst als `from_id` eintragen, der Status SHALL `pending`
sein, ein mitgegebenes `match_id` SHALL dem Paar gehören, und das Opt-out des
Empfängers (`is_contactable`) SHALL greifen.

#### Scenario: Ein basic-Konto darf nicht senden

- **WHEN** `open_contact` false ist und ein Mitglied mit Rang 1 (`basic`) eine
  Anfrage an einen kontaktierbaren Empfänger einfügt
- **THEN** wird das INSERT abgelehnt (SQLSTATE 42501), und die Oberfläche nennt
  die Stufe als Grund statt den rohen Postgres-Fehler zu zeigen

#### Scenario: Ein connect-Konto erreicht ein anderes connect-Konto

- **WHEN** `open_contact` false ist und ein Mitglied mit Rang 2 an einen
  Empfänger mit Rang 2 sendet
- **THEN** lässt die Policy das INSERT zu

#### Scenario: Ein connect-Konto erreicht ein impact-Konto nicht

- **WHEN** `open_contact` false ist und dasselbe Mitglied an einen Empfänger mit
  Rang 6 (`impact`) sendet
- **THEN** wird das INSERT abgelehnt — die Zielstufe ist nicht genau `connect`

#### Scenario: Ab discover ist jeder Empfänger erreichbar

- **WHEN** `open_contact` false ist und ein Mitglied ab Rang 3 an einen
  Empfänger beliebiger Stufe sendet
- **THEN** lässt die Staffelung das INSERT zu

#### Scenario: Der Schalter hebt die Staffelung auf

- **WHEN** `open_contact` true ist und ein `basic`-Mitglied an einen
  kontaktierbaren Empfänger sendet
- **THEN** lässt die Staffelungsklausel das INSERT zu

#### Scenario: Der Schalter hebt die übrigen Prüfungen nicht auf

- **WHEN** `open_contact` true ist und ein Mitglied eine Anfrage mit fremdem
  `from_id`, mit Status `accepted` oder an ein Konto mit gesetztem Opt-out
  einfügt
- **THEN** wird das INSERT abgelehnt

#### Scenario: Nur Admins schreiben den Schalter

- **WHEN** ein Mitglied ohne `is_admin()` `platform_settings.open_contact`
  aktualisiert
- **THEN** verweigert die Policy `platform_settings_update_admin` den Schreibzugriff

### Requirement: Eine Kaltanfrage hängt nicht am Alter des Empfängers

Das System SHALL die Erlaubnis, eine Kontaktanfrage einzufügen, **nicht** vom
Registrierungsdatum des Empfängers abhängig machen. Ein Mitglied, das nach der
Staffelung senden darf, SHALL auch an ein frisch registriertes Konto senden
dürfen, mit oder ohne `match_id`.

Das Prädikat `is_new_member(uuid)` SHALL nach dieser Änderung **nicht mehr
existieren**. Es hatte genau einen lebenden Aufrufer — die entfallende
Welpenschutz-Klausel — und ein Prädikat ohne Aufrufer ist eine Einladung, es
später falsch wieder anzuschliessen.

Was den Schutz übernimmt, SHALL die Staffelung selbst sein: ein `basic`-Konto
darf gar nicht senden, ein `connect`-Konto nur an `connect`. Sie fragt, **wer
sendet**, statt wer empfängt.

#### Scenario: Kaltanfrage an ein frisch registriertes Konto geht durch

- **WHEN** ein sendeberechtigtes Mitglied eine Anfrage **ohne** `match_id` an
  einen Empfänger sendet, der sich am selben Tag registriert hat
- **THEN** lässt die Policy das INSERT zu

#### Scenario: Auch bei geschlossenem Schalter zählt nur die Stufe

- **WHEN** `open_contact` false ist und ein Mitglied ab Rang 3 dieselbe Anfrage
  an dasselbe frische Konto sendet
- **THEN** lässt die Policy das INSERT zu — es entscheidet die Staffelung, nicht
  das Alter des Empfängers

#### Scenario: Das Prädikat ist fort

- **WHEN** `public.is_new_member(uuid)` aufgerufen wird
- **THEN** existiert die Funktion nicht

