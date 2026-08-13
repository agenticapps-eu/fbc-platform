## MODIFIED Requirements

### Requirement: Contact data is disclosed only after an accepted contact request

The system SHALL keep contact details in a separate `profile_contacts` table
(`email`, `phone`) whose SELECT policy `contacts_select_self_or_released`
returns a row only to its owner OR to a counterparty that shares an `accepted`
row in `contact_requests`. Contact data SHALL never be exposed through
`profiles_public` or the rank-gated profile row.

Die **vollständige Anschrift** SHALL Teil dieser Zeile sein und keine eigene
Sichtbarkeitsregel bekommen: `street`, `postal_code`, `city`, `state` und
`country` liegen auf `public.profile_contacts` und werden von derselben Policy
gedeckt wie E-Mail und Telefonnummer. Sie SHALL NOT auf `public.profiles`
liegen — dort wäre sie für jedes eingeloggte Mitglied lesbar, und die
Anschrift ist ein Stammdatum, das der Club braucht, aber nicht das Verzeichnis.

`public.profiles.region` SHALL davon unberührt bleiben und weiterhin die
**Regionalgruppe** bezeichnen (die FBC-Standortzugehörigkeit), nicht den
Wohnort. Die beiden SHALL NOT vermischt werden: `region` steuert Filter und
Zugehörigkeit, die Anschrift ist Stammdatum.

Beide Zweige — Eigentümer wie freigegebene Gegenseite — SHALL zusätzlich die
Aktivierung des Aufrufers voraussetzen. Gerade die **eigene** Kontaktzeile ist
hier der Punkt: sie trägt E-Mail und Telefonnummer des Mitglieds, und wer sich
mit einem weitergegebenen Passwort anmeldet, holte sie sonst als Erstes ab.
Zusätzlich SHALL die Zeile des **Zielprofils** dessen Bestätigung voraussetzen.

#### Scenario: Owner reads their own contact data

- **WHEN** a **bestätigtes** member selects their own `profile_contacts` row
- **THEN** the row is returned

#### Scenario: Die eigene Kontaktzeile bleibt vor der Bestätigung verschlossen

- **GIVEN** ein angemeldetes, nicht bestätigtes Konto
- **WHEN** es seine eigene `profile_contacts`-Zeile abfragt
- **THEN** liefert RLS null Zeilen — E-Mail und Telefonnummer sind nicht
  abholbar, obwohl es formal die eigenen Daten sind

#### Scenario: Contact data stays hidden without acceptance

- **WHEN** a member selects another member's `profile_contacts` row and no
  `accepted` `contact_requests` row links the two
- **THEN** RLS returns no row

#### Scenario: Acceptance reveals contact data

- **WHEN** a `contact_requests` row between the two members reaches
  `status = 'accepted'`
- **THEN** each may thereafter SELECT the other's `profile_contacts` row, sofern
  beide bestätigt sind

#### Scenario: Die Anschrift liefert ohne angenommene Kontaktanfrage nichts

- **GIVEN** ein bestätigtes Mitglied, dessen `profile_contacts`-Zeile eine
  vollständige Anschrift trägt
- **WHEN** ein anderes bestätigtes Mitglied ohne angenommene Kontaktanfrage
  `street`, `postal_code`, `city`, `state` oder `country` dieser Zeile abfragt
- **THEN** liefert RLS null Zeilen — die Anschrift ist genauso verschlossen wie
  Telefonnummer und E-Mail und SHALL NOT über eine eigene Spaltenauswahl
  erreichbar sein

#### Scenario: Nach der Annahme kommt die Anschrift mit

- **GIVEN** zwei bestätigte Mitglieder mit einer `accepted` Kontaktanfrage
- **WHEN** eines die Kontaktzeile des anderen liest
- **THEN** enthält dieselbe freigegebene Zeile neben E-Mail und Telefonnummer
  auch die fünf Adressfelder

## ADDED Requirements

### Requirement: Ein Mitglied pflegt seine Kontaktzeile selbst

Das System SHALL einem bestätigten Mitglied erlauben, seine eigene Zeile in
`public.profile_contacts` über den Profil-Editor anzulegen und zu ändern —
Anschrift, Kontakt-E-Mail und Telefonnummer. Bis zu diesem Change schrieb dort
ausschließlich `admin_update_profile()`; ein Mitglied konnte seine eigene
Telefonnummer nicht ändern, obwohl Policy und Grant es längst erlaubten.

Der Schreibweg SHALL die bestehenden Policies `profile_contacts_insert_own` und
`profile_contacts_update_own` benutzen und SHALL NOT eine neue Policy, eine
`SECURITY DEFINER`-Funktion oder eine Grant-Änderung erfordern:
`profile_contacts` trägt einen **Tabellen**-Grant, keine Spaltenliste wie
`profiles`, weshalb neue Spalten für `authenticated` ohne weiteres Zutun
schreibbar sind.

Keines der Felder SHALL Pflicht sein. Ein Mitglied ohne Kontaktzeile SHALL beim
ersten Speichern eine bekommen (Upsert auf `profile_id`), ohne dass die
Oberfläche zwischen „anlegen" und „ändern" unterscheidet.

Das Formular SHALL **kein** Land erfinden. `country` bleibt leer, bis ein
Mitglied es einträgt; die Oberfläche SHALL „DE" höchstens als Platzhalter
zeigen. Eine Vorbelegung im Formular machte aus einer bewussten Leerung beim
nächsten Laden wieder „DE" und legte bei einer Speicherung, die mit der
Anschrift nichts zu tun hat, eine Kontaktzeile an, deren einziger Inhalt ein
erfundenes Land wäre. Die Vorgabe `DE` gehört dorthin, wo sie gebraucht wird:
in den Import (C10), der ein Feld füllt, das WordPress nicht erhebt.

Die Kontakt-E-Mail SHALL vor dem Speichern auf ihre Form geprüft werden. Sie ist
die Adresse, an die `notify-contact-request` schickt; ein Tippfehler dort ist
keine Anzeigefrage, sondern eine Benachrichtigung, die niemanden erreicht. Die
**Login**-Adresse in `auth.users` SHALL davon unberührt bleiben.

#### Scenario: Ein Mitglied trägt seine Anschrift ein

- **GIVEN** ein bestätigtes Mitglied ohne Zeile in `profile_contacts`
- **WHEN** es im Profil-Editor den Kontaktblock ausfüllt und speichert
- **THEN** entsteht die Zeile mit den eingetragenen Feldern, und ein erneutes
  Speichern ändert dieselbe Zeile, statt eine zweite anzulegen

#### Scenario: Der Kontaktblock deckt auch E-Mail und Telefon ab

- **WHEN** ein bestätigtes Mitglied im Profil-Editor Kontakt-E-Mail oder
  Telefonnummer ändert
- **THEN** wird der Wert in `profile_contacts` geschrieben, ohne dass ein Admin
  eingreifen muss

#### Scenario: Leere Felder bleiben leer

- **WHEN** ein Mitglied den Kontaktblock ganz oder teilweise leer speichert
- **THEN** wird der Vorgang angenommen und die betroffenen Spalten stehen auf
  NULL — kein Feld des Blocks ist Pflicht

#### Scenario: Das Formular erfindet kein Land

- **GIVEN** ein Profil ohne Anschrift
- **WHEN** das Mitglied den Profil-Editor öffnet und etwas speichert, das mit
  der Anschrift nichts zu tun hat
- **THEN** bleibt `country` leer — es entsteht keine Kontaktzeile, deren
  einziger Inhalt ein nicht eingetragenes Land wäre

#### Scenario: Eine unbrauchbare Kontakt-E-Mail wird abgewiesen

- **WHEN** ein Mitglied im Kontaktblock eine Zeichenkette speichert, die keine
  E-Mail-Adresse ist
- **THEN** meldet das Formular den Fehler und schreibt nichts — weder die
  Adresse noch die übrigen Felder des Vorgangs

### Requirement: Die Branche kommt aus einer kuratierten Liste

Das System SHALL eine feste, versionierte Liste von Branchenwerten führen und
das Profilfeld `branche` daraus befüllen lassen, statt es als Freitext zu
erheben. Vorbild sind die Kompass-Kategorien: eine deklarative Quelle, aus der
**der Editor und die Import-Zuordnung** lesen.

Der Filterweg im Verzeichnis SHALL davon unberührt bleiben und seine Optionen
weiter als **Facette aus den vorhandenen Werten** bilden. Die Liste steuert, was
neu eingetragen wird; sie beschreibt nicht, was in den Daten steht.

Grund ist der Import: In WordPress gibt es kein Branchenfeld, und der Filter im
Mitgliederverzeichnis zieht seine Optionen als Facette aus den vorhandenen
Werten. Ohne Zielvokabular würde die Facettenliste zum Spiegel des
Import-Rauschens — neunundsechzig Freitexte ergäben Dutzende „Branchen".

Das System SHALL dafür eine **reine Funktion** bereitstellen, die einen
Freitext auf höchstens einen Wert dieser Liste abbildet, per Stichwortzuordnung
und ohne Sprachmodell. Ein nicht zuzuordnender Text SHALL kein Ergebnis liefern
und SHALL NOT geraten werden.

Trifft ein Freitext Stichwörter **mehrerer** Branchen, SHALL die Funktion
ebenfalls kein Ergebnis liefern. Sonst entschiede die Reihenfolge der Liste,
welche Branche gewinnt — und die Reihenfolge ist Redaktion, keine Aussage über
den Text. Ein leeres Feld, das ein Mitglied selbst füllt, ist besser als eine
Zuordnung, die von der Sortierung einer Konfigurationsdatei abhängt. Die Zuordnung SHALL ungenau sein dürfen: jedes
Mitglied kann die Branche im Profil ändern, und ein grob gefüllter Filter ist
besser als ein leerer.

Die Spalte SHALL `text` bleiben und SHALL NOT durch eine Fremdschlüssel- oder
`check`-Beziehung an die Liste gebunden werden — Bestandswerte aus der Zeit vor
diesem Change bleiben so lesbar, und das Verzeichnis zeigt weiterhin, was in
den Daten steht.

#### Scenario: Der Editor bietet die Liste an

- **WHEN** ein Mitglied im Profil-Editor die Branche setzt
- **THEN** wählt es aus der kuratierten Liste, statt freien Text einzugeben

#### Scenario: Ein Freitext wird zugeordnet

- **WHEN** die Zuordnungsfunktion einen Freitext erhält, der ein Stichwort einer
  Branche enthält
- **THEN** liefert sie genau diesen Branchenwert aus der Liste

#### Scenario: Was nicht passt, bleibt leer

- **WHEN** die Zuordnungsfunktion einen Freitext ohne erkennbares Stichwort
  erhält
- **THEN** liefert sie kein Ergebnis, und das Feld bleibt leer

#### Scenario: Ein mehrdeutiger Freitext bleibt ebenfalls leer

- **WHEN** ein Freitext Stichwörter zweier verschiedener Branchen enthält
- **THEN** liefert die Funktion kein Ergebnis — sie entscheidet nicht nach der
  Reihenfolge der Liste

#### Scenario: Ein Bestandswert außerhalb der Liste bleibt erhalten

- **GIVEN** ein Profil, dessen `branche` vor diesem Change als Freitext gesetzt
  wurde und in der Liste nicht vorkommt
- **WHEN** das Verzeichnis seine Branchenfacette bildet
- **THEN** erscheint der Wert weiterhin — die Liste steuert die Eingabe, nicht
  den Bestand
