## MODIFIED Requirements

### Requirement: A member's own profile shows no invented data about them

A surface that presents a member's own activity, holdings or history SHALL show
only data the system actually holds. Where a capability does not exist yet, the
surface SHALL omit the section rather than fill it with sample figures.

A "Demo" badge SHALL NOT be treated as sufficient: it explains the numbers to
whoever built them, not to a member reading their own profile, and a member who
believes a figure about themselves has been misinformed regardless of the label.

Omission SHALL be preferred to an empty state where the capability itself is
absent — an empty state announces a feature that is coming, which is only honest
when one is.

Sample figures SHALL NOT survive as a fallback branch that fires when the real
source is empty. A branch of that shape is indistinguishable from real data for
every member who has not yet produced any — which, after an import, is nearly
all of them.

#### Scenario: Absent capability renders nothing

- **WHEN** a member opens their own profile and the platform holds no statistics,
  projects or investments for them
- **THEN** no such section is rendered, with or without sample values

#### Scenario: Present capability renders an empty state

- **WHEN** a member holds no event registrations, a capability the platform does
  have
- **THEN** an empty state invites them to the events page rather than listing
  sample events

#### Scenario: Ein Mitglied ohne Beiträge sieht keine fremden Beiträge

- **WHEN** ein Mitglied ohne eigene Beiträge seine Profilseite öffnet
- **THEN** erscheint kein Beitrag mit Titel, Gattung oder Reichweitenzahl, den es
  nicht selbst verfasst hat — auch nicht als Demo gekennzeichnet

#### Scenario: Die Netzwerk-Aufschlüsselung nennt keine erfundenen Gruppen

- **WHEN** ein Mitglied mit bestätigten Kontakten seine Kontaktseite öffnet
- **THEN** erscheint keine Aufschlüsselung nach Gruppen mit fest verdrahteten
  Zahlen; sichtbar ist die Zahl der tatsächlich bestätigten Kontakte

#### Scenario: Ohne Kontakte erscheint weder Null noch Aufschlüsselung

- **WHEN** ein Mitglied ohne bestätigte Kontakte seine Kontaktseite öffnet
- **THEN** lädt die Seite zum Entdecken anderer Mitglieder ein und zeigt weder
  eine Aufschlüsselung noch die Zahl null

## ADDED Requirements

### Requirement: Vertagte Fähigkeiten erscheinen nicht auf dem eigenen Profil

Wird eine Fähigkeit für den Go-Live vertagt, SHALL ihre Oberfläche auf der
eigenen Profilseite entfallen — nicht leer stehen bleiben. Das gilt für die
Kompass-Oberflächen (Erfolgsradar, Ziele, Entwicklungsfortschritt), für
Auszeichnungen, solange keine vergeben werden, und für Zähler auf Fähigkeiten,
die unerreichbar sind.

Ein Zähler auf eine unerreichbare Fähigkeit SHALL entfallen, **unabhängig von
seinem Wert**. Der Wert kann echt und von null verschieden sein — ein Mitglied
kann Matches aus der Zeit vor der Vertagung tragen. Er verweist dann auf eine
Oberfläche, die niemand öffnen kann, und ist damit nicht falsch, sondern
unbeantwortbar.

Das Ausblenden SHALL **nicht** an der Leere der Daten hängen. Eine Umsetzung,
die nur bei leeren Daten ausblendet, erfüllt diese Anforderung nicht: sie zeigt
die vertagte Oberfläche genau denjenigen, die etwas darin haben.

Die zugehörigen Komponenten und Datenbankspalten SHALL erhalten bleiben. Das
Zurückholen einer vertagten Fähigkeit SHALL nichts weiter verlangen als das
Wiedereinsetzen der Oberfläche.

#### Scenario: Die Kompass-Oberflächen sind auf dem Profil nicht sichtbar

- **WHEN** ein bestätigtes Mitglied ohne Themen-Scores, Auszeichnungen, Ziele und
  Entwicklungsdaten seine eigene Profilseite öffnet
- **THEN** erscheinen weder Erfolgsradar noch Auszeichnungen, Ziele oder
  Entwicklungsfortschritt

#### Scenario: Auch mit Daten bleiben die vertagten Oberflächen fort

- **WHEN** ein Mitglied **mit** Themen-Scores, vergebenen Auszeichnungen,
  gepflegten Zielen und gesetztem Entwicklungsfokus seine Profilseite öffnet
- **THEN** erscheint keine dieser vier Oberflächen

#### Scenario: Kein Zähler für eine unerreichbare Fähigkeit

- **WHEN** die Kennzahlen im Profilkopf für ein Mitglied mit einem Matchstand
  über null gezeigt werden
- **THEN** steht dort keine Kachel für Matches, solange Matching unerreichbar ist

#### Scenario: Kein Weg in eine Oberfläche, die es nicht gibt

- **WHEN** die eigene Profilseite gerendert wird
- **THEN** führt von ihr keine Schaltfläche auf eine persönliche Roadmap

### Requirement: Ein leerer Bereich der eigenen Profilseite rendert nicht

Ein Bereich der eigenen Profilseite ohne Inhalt SHALL nicht gerendert werden,
statt eine Feststellung der Leere zu zeigen. Mehrere Kacheln nebeneinander, die
alle „Noch keine …" sagen, lassen ein frisches Profil tot wirken — und nach dem
Import sind fast alle Profile frisch.

**Die Ausnahme** greift, wenn **beide** Bedingungen erfüllt sind: die Fähigkeit
existiert und das Mitglied kann sie selbst füllen — **und** das Ziel der
Einladung steht nicht bereits an anderer Stelle derselben Seite. Fehlt die erste
Bedingung, verspricht der Leerzustand eine Funktion, die niemand gebaut hat;
fehlt die zweite, ist er eine Wiederholung, und mehrere Einladungen mit
demselben Ziel erzeugen genau die tote Seite, die diese Anforderung verhindert.

Eine Eckdatenzeile ohne Wert SHALL entfallen, statt einen Platzhalter zu zeigen.
Wo mehrere Eckdaten in einer Zeile stehen, SHALL jedes für sich entfallen: das
Fehlen des einen SHALL das andere nicht verdecken.

#### Scenario: Ein Mitglied ohne Beiträge wird zum Schreiben eingeladen

- **WHEN** ein Mitglied ohne eigene Beiträge seine Profilseite öffnet
- **THEN** fordert der Beitragsbereich es ausdrücklich zum Schreiben auf und
  führt auf die Aktivitätsseite

#### Scenario: Mit Beiträgen entfällt die Einladung

- **WHEN** ein Mitglied mit eigenen Beiträgen seine Profilseite öffnet
- **THEN** stehen dort seine Beiträge und keine Einladung zum Schreiben

#### Scenario: Ein leerer Interessenbereich entfällt

- **WHEN** ein Mitglied ohne gepflegte Interessen seine Profilseite öffnet
- **THEN** erscheint kein Interessenbereich — auch kein einladender: die
  Einladung in denselben Profil-Editor steht bereits weiter oben auf der Seite

#### Scenario: Ohne Beitrittsdatum entfällt die Zeile

- **WHEN** ein Profil ohne `member_since`, aber mit `member_number` angezeigt
  wird
- **THEN** erscheint keine Angabe „Mitglied seit", auch kein Gedankenstrich —
  die Mitgliedsnummer steht weiterhin

#### Scenario: Ohne Mitgliedsnummer steht das Beitrittsdatum allein

- **WHEN** ein Profil mit `member_since`, aber ohne `member_number` angezeigt
  wird
- **THEN** erscheint „Mitglied seit" mit Monat und Jahr, ohne Trennzeichen zu
  einer fehlenden Nummer

#### Scenario: Ohne beides entfällt die Zeile ganz

- **WHEN** ein Profil ohne `member_since` und ohne `member_number` angezeigt wird
- **THEN** erscheint keine Eckdatenzeile im Profilkopf
