## MODIFIED Requirements

### Requirement: Eine Selbstregistrierung löst den Bestätigungslink selbst aus

Das System SHALL nach einer erfolgreichen Selbstregistrierung den
Bestätigungslink **ohne weiteres Zutun des Registrierenden** ausgeben und
versenden. Der Versand SHALL über denselben sitzungsgebundenen Weg laufen wie
der Knopf auf dem Aktivierungsbildschirm; ein zweiter Versandweg SHALL NOT
entstehen.

**„Erfolgreich" heißt: es besteht eine Sitzung.** Nicht „der Anmeldedienst
antwortete ohne Fehler". Die beiden fallen auseinander, und genau dort saß der
Fehler: Auf eine Registrierung mit einer **bereits bekannten** Adresse antwortet
der Anmeldedienst mit Erfolg, ohne Fehler und **ohne Sitzung** — sein Schutz
gegen das Aufzählen vorhandener Adressen. Ein Auslöser, der nur „kein Fehler"
prüft, feuert dann in ein Konto hinein, das dem Aufrufer nicht gehört: Der
sitzungsgebundene Versand hat keine Sitzung und scheitert mit `42501`, und die
Zählung meldet eine Registrierung, die nie stattfand.

Alle Nebenwirkungen des Erfolgsfalls — Versand **und** Ereigniszählung — SHALL
deshalb an der bestehenden Sitzung hängen, nicht am ausbleibenden Fehler.

Der Grund für den Auslöser selbst ist die Bauart des Zugangs: Ein selbst
registriertes Konto trägt keinen Aktivierungszeitpunkt und steht damit hinter dem
Gate, und der Link ist für dieses Konto die einzige Tür. Ohne einen Auslöser ist
die Registrierung eine Sackgasse, die wie ein Erfolg aussieht.

Der Knopf auf dem Aktivierungsbildschirm SHALL als zweiter Weg bestehen bleiben.
Er ist der Ausweg, wenn der automatische Versand fehlschlägt.

Ein fehlgeschlagener Versand SHALL die Registrierung NICHT ungültig machen: Das
Konto ist angelegt und die Sitzung besteht, bevor der Versand beginnt.

#### Scenario: Registrierung gibt ein Token aus, ohne dass jemand klickt

- **WHEN** sich jemand erfolgreich selbst registriert
- **THEN** ist für sein Profil genau ein Aktivierungstoken ausgegeben, ohne dass
  er den Bestätigungsknopf gedrückt hat

#### Scenario: Der Versand nach der Registrierung schlägt fehl

- **WHEN** die Registrierung erfolgreich war, der anschließende Versand aber
  fehlschlägt
- **THEN** bleiben Konto und Sitzung bestehen, und der Aktivierungsbildschirm
  bietet den Bestätigungsknopf an

#### Scenario: Ohne Sitzung läuft keine Nebenwirkung des Erfolgsfalls

- **WHEN** eine Registrierung ohne Fehler, aber **ohne Sitzung** zurückkommt
- **THEN** wird **kein** Bestätigungslink angefordert und **kein**
  Registrierungsereignis gezählt

## ADDED Requirements

### Requirement: Eine Registrierung auf eine bekannte Adresse führt weiter

Wie der Anmeldedienst auf eine Registrierung mit einer **bereits bekannten**
Adresse antwortet, hängt an einer seiner Einstellungen. **Gemessen am
2026-08-25:**

- Ist die eingebaute E-Mail-Bestätigung **aus**, antwortet er mit **HTTP 422 und
  dem Code `user_already_exists`** — also mit einem Fehler, dessen Text
  („User already registered") englisch ist und die Existenz des Kontos
  ausspricht.
- Ist sie **an**, antwortet er mit Erfolg, **ohne Fehler und ohne Sitzung**. Das
  ist sein Schutz gegen das Aufzählen vorhandener Adressen und SHALL NOT
  umgangen werden.

Die Oberfläche SHALL **beide** Ausgänge auf **denselben** Hinweis führen, der
weiterführt. Sie SHALL NOT den rohen Fehlertext des Anmeldedienstes anzeigen.

Der Grund, beide gleich zu behandeln: Welcher der beiden eintritt, ist eine
Betriebseinstellung und kein Unterschied, der die betroffene Person etwas angeht.
Sie will wissen, wie sie hineinkommt. Und der Fehlertext des ersten Falls sagt
ausgerechnet das, was der Aufzählungsschutz des zweiten sorgfältig vermeidet.

Der Hinweis SHALL **zum Anfordern eines Zugangslinks** führen und daneben zur
Anmeldung. Er SHALL NOT „Passwort zurücksetzen" als ersten Weg anbieten: Die
betroffene Gruppe sind ganz überwiegend **importierte, noch nicht aktivierte**
Mitglieder, die den naheliegenden Knopf „Registrieren" statt „Aktivieren"
wählen. Sie haben kein Passwort, das sich zurücksetzen ließe — eine Oberfläche,
die ihnen das anbietet, verspricht etwas anderes, als sie braucht.

Der Hinweis SHALL **keinen Grund nennen**: Er SHALL nicht aussagen, ob die
Adresse vergeben ist. Die Oberfläche kann diese Aussage auch gar nicht treffen —
der Anmeldedienst nennt ihr den Grund nicht, und sie SHALL NOT nach ihm fragen.

**Was diese Anforderung ausdrücklich NICHT zusagt.** Sie macht die beiden
Ausgänge nicht von außen ununterscheidbar. Eine unbekannte Adresse erzeugt eine
Sitzung und löst die Seite ab; eine bekannte bleibt auf ihr stehen. Sie
**verbessert** die Lage allerdings gegenüber heute: Der rohe Satz „User already
registered" verschwindet, und damit die einzige Stelle, an der die Oberfläche die
Existenz eines Kontos ausdrücklich behauptet hat. Dieser
Unterschied ist heute schon beobachtbar und folgt daraus, dass die eingebaute
E-Mail-Bestätigung ausgeschaltet ist — ihn zu schließen hieße, den ganzen
Registrierungsverlauf umzubauen. Der Hinweis fügt **keinen neuen** Beobachtungsweg
hinzu; er ersetzt einen Knopf, der wortlos nichts tut, durch einen, der etwas
sagt.

Der Grund für die Anforderung ist die Bauart der Seite: Erfolg wird durch die
entstehende Sitzung angezeigt, die die Seite ablöst; ein Fehler durch die
Fehlermeldung. Fehlen beide, bleibt **kein** Zweig, der etwas sagt.

#### Scenario: Registrierung ohne Fehler und ohne Sitzung

- **WHEN** eine Registrierung ohne Fehler zurückkommt, aber keine Sitzung entsteht
- **THEN** erscheint ein sichtbarer Hinweis, der zum Anfordern eines Zugangslinks
  und zur Anmeldung führt

#### Scenario: Registrierung mit `user_already_exists`

- **WHEN** eine Registrierung mit dem Code `user_already_exists` fehlschlägt
- **THEN** erscheint **derselbe** Hinweis, und der rohe Fehlertext des
  Anmeldedienstes erscheint nirgends

#### Scenario: Jeder andere Fehler bleibt sichtbar

- **WHEN** eine Registrierung mit einem anderen Fehler fehlschlägt
- **THEN** wird dessen Meldung angezeigt und NICHT durch den Hinweis ersetzt

#### Scenario: Der Hinweis nennt keinen Grund

- **WHEN** dieser Hinweis erscheint
- **THEN** sagt sein Text nicht aus, ob die Adresse bereits vergeben ist

#### Scenario: Mit Sitzung bleibt es beim bisherigen Verlauf

- **WHEN** eine Registrierung eine Sitzung herstellt
- **THEN** erscheint dieser Hinweis NICHT, und der Verlauf führt wie bisher auf
  den Aktivierungsbildschirm
