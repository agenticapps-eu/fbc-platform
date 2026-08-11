## ADDED Requirements

### Requirement: Die Selbstregistrierung erhebt kein Passwort

Die Selbstregistrierung SHALL **kein Passwort erheben**. Sie SHALL Name und
E-Mail-Adresse verlangen und sonst nichts.

Der Grund ist die Dopplung, die sonst entsteht: Das Einlösen des
Bestätigungslinks setzt ohnehin ein Passwort, und dieses ersetzt ein bei der
Registrierung gewähltes. Ein Passwort, das gesetzt, nie gebraucht und
stillschweigend überschrieben wird, ist kein Schutz, sondern ein Schritt, der
Vertrauen kostet.

Das Konto SHALL trotzdem ein Passwort tragen — der Anmeldedienst kennt keines
ohne. Für dieses gilt:

- Es SHALL dem Registrierenden **nicht bekannt werden können**: weder angezeigt
  noch protokolliert noch aus der Eingabe ableitbar.
- Es SHALL NOT über Konten hinweg dasselbe sein. Ein fester Wert wäre ein
  Generalschlüssel für jedes Konto in genau dem Fenster, in dem das Gate noch
  geschlossen ist, der Anmeldedienst aber schon Sitzungen ausgibt.

**Was das NICHT löst, und deshalb hier steht:** Wer eine fremde Adresse
registriert, kann das weiterhin. Diese Anforderung nimmt ihm nur das Passwort
aus der Hand; was ihn aufhält, ist unverändert das Aktivierungs-Gate.

#### Scenario: Die Registrierung verlangt kein Passwort

- **WHEN** jemand das Registrierungsformular öffnet
- **THEN** wird nach Name und E-Mail-Adresse gefragt und nach keinem Passwort

#### Scenario: Die Registrierung geht ohne Passworteingabe durch

- **WHEN** jemand Name und Adresse einträgt und absendet
- **THEN** wird das Konto angelegt, ohne dass eine Passwortprüfung die Eingabe
  abweist

#### Scenario: Zwei Registrierungen erhalten nicht dasselbe Passwort

- **WHEN** zwei Konten nacheinander selbst registriert werden
- **THEN** tragen sie verschiedene Passwörter

### Requirement: Ein gesetztes Passwort wird bestätigt, bevor der Weg weitergeht

Hat jemand über einen gültigen Token ein Passwort gesetzt, SHALL das System das
**bestätigen**, bevor es ihn weiterschickt. Die Bestätigung SHALL sichtbar sein,
nicht nur ein Zustandswechsel im Hintergrund.

Der Grund ist die Lage, in der dieser Mensch steht: Unmittelbar nach dem Setzen
werden **alle Sitzungen widerrufen**, auch die eigene — das ist richtig und
bleibt so. Ohne Rückmeldung sieht das aus wie ein Rauswurf. Wer nicht erfährt,
dass es geklappt hat, versucht es erneut, hält den Link für kaputt oder
schreibt den Support an.

Der Weg zum Login SHALL **beides** anbieten: eine Handlung, die sofort führt,
und eine Weiterleitung von selbst für den, der nichts tut. Die Weiterleitung
SHALL angekündigt sein, damit sie nicht als Sprung erscheint.

Die Bestätigung SHALL zum **Zweck** passen, unter dem das Token eingelöst wurde.
Wer sein Passwort zurückgesetzt hat, wurde nicht aktiviert; ein Text, der beides
gleich nennt, sagt der Hälfte der Menschen etwas Falsches.

#### Scenario: Nach dem Setzen erscheint eine Bestätigung

- **WHEN** ein Passwort erfolgreich gegen ein gültiges Token gesetzt wurde
- **THEN** erscheint eine sichtbare Bestätigung, dass das Passwort gesetzt ist,
  bevor der Login gezeigt wird

#### Scenario: Der Weg zum Login steht offen, ohne zu warten

- **WHEN** die Bestätigung erscheint
- **THEN** gibt es eine Handlung, die sofort zum Login führt

#### Scenario: Wer nichts tut, wird von selbst weitergeleitet

- **WHEN** die Bestätigung erscheint und niemand handelt
- **THEN** führt das System nach einer angekündigten Frist zum Login

#### Scenario: Der Wortlaut folgt dem Zweck

- **WHEN** ein Passwort über den Weg des **Zurücksetzens** gesetzt wurde
- **THEN** spricht die Bestätigung vom zurückgesetzten Passwort und nicht von
  einer Aktivierung
