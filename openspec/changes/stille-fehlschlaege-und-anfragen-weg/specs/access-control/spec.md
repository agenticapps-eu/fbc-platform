## ADDED Requirements

### Requirement: Eine Registrierung ohne Sitzung ist kein stiller Erfolg

Der Anmeldedienst antwortet auf eine Registrierung mit einer **bereits bekannten**
Adresse bewusst mit Erfolg, **ohne Fehler und ohne Sitzung** — das ist sein Schutz
gegen das Aufzählen vorhandener Adressen und SHALL NOT umgangen werden.

Die Oberfläche SHALL diesen Fall dennoch **sichtbar** beantworten. Bleibt nach
einer Registrierung sowohl ein Fehler als auch eine Sitzung aus, SHALL sie einen
Hinweis zeigen, der auf die Wege zur Anmeldung und zum Zurücksetzen des Passworts
führt.

Der Hinweis SHALL NOT mehr preisgeben als der Anmeldedienst selbst: Er SHALL
denselben Text zeigen, gleich ob die Adresse vergeben ist oder nicht.

Der Grund ist die Bauart der Seite: Erfolg wird durch die entstehende Sitzung
angezeigt, die die Seite ablöst; ein Fehler durch die Fehlermeldung. Fehlen beide,
bleibt **kein** Zweig, der etwas sagt — der Knopf tut wortlos nichts. Das trifft
ausgerechnet importierte Mitglieder, die den naheliegenden Weg „Registrieren"
statt „Aktivieren" wählen.

#### Scenario: Registrierung ohne Fehler und ohne Sitzung

- **WHEN** eine Registrierung ohne Fehler zurückkommt, aber keine Sitzung entsteht
- **THEN** erscheint ein sichtbarer Hinweis mit den Wegen zur Anmeldung und zum
  Zurücksetzen des Passworts

#### Scenario: Der Hinweis verrät nicht, ob die Adresse vergeben ist

- **WHEN** derselbe Fall mit einer vergebenen und mit einer unbekannten Adresse
  eintritt
- **THEN** ist der angezeigte Text in beiden Fällen derselbe

#### Scenario: Mit Sitzung bleibt es beim bisherigen Verlauf

- **WHEN** eine Registrierung eine Sitzung herstellt
- **THEN** erscheint dieser Hinweis NICHT, und der Verlauf führt wie bisher auf
  den Aktivierungsbildschirm
