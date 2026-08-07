## ADDED Requirements

### Requirement: Ein Mitglied kommt ohne fremde Hilfe in sein Konto zurück

Das System SHALL einen sitzungsfreien Weg anbieten, über den ein Mitglied ein
neues Passwort setzen kann, ohne das alte zu kennen. Der Weg SHALL für ein
**aktiviertes** Konto ebenso gelten wie für ein nicht aktiviertes — nach dem
Import ist „aktiviert" der Normalfall, und ein Weg zurück, der nur für die
Ausnahme gilt, ist keiner.

Der Weg SHALL von der Anmeldeseite aus erreichbar sein. Andernfalls findet ihn
genau die Person nicht, die ihn braucht: die, die gerade an der Anmeldung
scheitert.

Der Empfänger SHALL in jedem Fall die **hinterlegte** Adresse des Profils sein,
niemals eine im Aufruf mitgegebene. Andernfalls wäre der Weg zurück zugleich ein
Weg in fremde Konten.

#### Scenario: Ein aktiviertes Konto fordert ein neues Passwort an

- **GIVEN** ein Konto ist aktiviert und sein Passwort ist unbekannt
- **WHEN** über die Anmeldeseite ein neues Passwort angefordert wird
- **THEN** geht eine Mail an die hinterlegte Adresse, und ihr Link führt auf
  einen Bildschirm, der ein neues Passwort setzt

#### Scenario: Der Weg ist von der Anmeldung aus auffindbar

- **WHEN** die Anmeldeseite aufgerufen wird
- **THEN** trägt sie einen sichtbaren Weg zum Zurücksetzen des Passworts

#### Scenario: Eine mitgegebene Adresse bestimmt den Empfänger nicht

- **WHEN** eine Anforderung eine andere Adresse nennt als die am Profil
  hinterlegte
- **THEN** geht die Mail an die hinterlegte Adresse

### Requirement: Der Rückweg verrät nicht, welche Adressen es gibt

Die Antwort auf eine Anforderung SHALL unabhängig davon gleich ausfallen, ob zu
der Adresse ein Konto besteht, ob es aktiviert ist und ob tatsächlich eine Mail
herausging. Andernfalls wäre der Endpunkt ein Verzeichnis der Mitgliedsadressen.

Weil die Antwort damit in allen Fällen dieselbe ist, SHALL die Meldung an das
Mitglied **alle** Ausgänge abdecken, statt einen Versand zuzusagen, den es nicht
gegeben haben muss. Sie SHALL insbesondere einen Rückkanal nennen.

#### Scenario: Eine unbekannte Adresse

- **WHEN** für eine Adresse, zu der kein Konto besteht, ein neues Passwort
  angefordert wird
- **THEN** ist die Antwort nicht von der für eine bestehende Adresse zu
  unterscheiden, und es geht keine Mail heraus

#### Scenario: Die Meldung sagt nichts zu, was nicht geschehen sein muss

- **WHEN** eine Anforderung angenommen wurde
- **THEN** deckt die Meldung sowohl den soeben verschickten Link als auch den
  bereits vorhandenen ab und nennt einen Rückkanal — und sie unterscheidet die
  Fälle nicht

### Requirement: Das Zurücksetzen nutzt dieselben Grenzen wie der Aktivierungsversand

Der Rückweg SHALL denselben Grenzen unterliegen wie der Aktivierungsversand:
Sperrfrist zwischen zwei Anforderungen, Tageskontingent je Profil, und das
Schutzfenster, das einen noch gültigen, unbenutzten Link **nicht** entwertet.
Die Grenzen SHALL **vor** der Unterscheidung nach Zweck greifen. Andernfalls
wäre das Zurücksetzen ein Weg, genau an ihnen vorbeizukommen.

Das Zurücksetzen SHALL kein zweites Token-Verfahren einführen. Einmaligkeit
unter Nebenläufigkeit, Speicherung ausschließlich als Hashwert, die Drossel am
Einlöse-Endpunkt und der Aufzählungsschutz SHALL dieselben sein wie beim
Aktivierungsweg — sonst werden ihre künftigen Fehler zweimal gemacht.

#### Scenario: Zweimal hintereinander anfordern

- **WHEN** für ein aktiviertes Konto zweimal innerhalb der Sperrfrist ein neues
  Passwort angefordert wird
- **THEN** wird nur die erste Mail versendet

#### Scenario: Ein Fremder kann ein Mitglied nicht mit Mails überziehen

- **GIVEN** ein Dritter kennt die Login-Adresse eines aktivierten Mitglieds
- **WHEN** er wiederholt ein neues Passwort anfordert
- **THEN** greifen Sperrfrist, Tageskontingent und Schutzfenster genauso wie beim
  Aktivierungsversand

#### Scenario: Ein offener Link wird nicht entwertet

- **GIVEN** ein Mitglied hat einen gültigen, unbenutzten Link im Postfach
- **WHEN** ein Dritter über die bekannte Adresse eine neue Anforderung auslöst
- **THEN** bleibt der Link im Postfach gültig und es wird kein neuer ausgegeben

### Requirement: Das Anfordern allein ändert nichts am Konto

Eine Anforderung SHALL den Zugang des Mitglieds unberührt lassen: Das bestehende
Passwort SHALL gültig bleiben, und laufende Sitzungen SHALL NOT beendet werden.
Erst das **Einlösen** des Links SHALL das Passwort ersetzen und alle Sitzungen
widerrufen. Andernfalls genügte die Kenntnis einer Adresse, um ein Mitglied
auszusperren.

Das Einlösen SHALL den Aktivierungsstand eines Kontos nicht zurücknehmen. Ein
aktiviertes Konto SHALL nach dem Zurücksetzen aktiviert bleiben, und der
Zeitpunkt seiner Aktivierung SHALL NOT überschrieben werden.

#### Scenario: Anfordern sperrt niemanden aus

- **GIVEN** ein Mitglied ist auf seinen Geräten angemeldet
- **WHEN** ein Dritter für dessen Adresse ein neues Passwort anfordert
- **THEN** bleiben Passwort und Sitzungen des Mitglieds unverändert

#### Scenario: Einlösen meldet alle Geräte ab

- **WHEN** ein Mitglied über den Link ein neues Passwort setzt
- **THEN** gilt nur noch das neue Passwort, und alle zuvor bestehenden Sitzungen
  sind beendet

#### Scenario: Ein aktiviertes Konto bleibt aktiviert

- **GIVEN** ein aktiviertes Konto setzt sein Passwort über den Rückweg neu
- **THEN** ist es danach weiterhin aktiviert, und sein Aktivierungszeitpunkt ist
  derselbe wie zuvor

### Requirement: Die Mail sagt, was der Link tut und was zu tun ist, wenn man ihn nicht wollte

Die Mail zum Zurücksetzen SHALL sich vom Aktivierungstext unterscheiden. Sie
SHALL ihre Gültigkeitsdauer nennen, SHALL benennen, dass das Einlösen **alle
Geräte abmeldet**, und SHALL dem Empfänger sagen, dass er sie folgenlos
ignorieren kann, wenn er sie nicht angefordert hat. Letzteres ist keine
Höflichkeit: Weil ein Fremder den Versand auslösen kann, ist die Mail selbst der
einzige Ort, an dem das Mitglied davon erfährt.

Der Link SHALL auf einen Bildschirm führen, der vom Aktivierungsbildschirm
unterscheidbar ist. Das Token ist bewusst undurchsichtig und trägt seinen Zweck
nicht — die Zieladresse ist damit der einzige Träger, an dem die Oberfläche die
richtige Sprache wählen kann.

#### Scenario: Der Reset-Text unterscheidet sich vom Aktivierungstext

- **WHEN** ein aktiviertes Konto ein neues Passwort anfordert
- **THEN** nennt die Mail die Gültigkeitsdauer, die Abmeldung aller Geräte und
  den Hinweis zum Ignorieren — und sie fordert nicht zur Aktivierung auf

#### Scenario: Der Link führt auf den Passwort-Bildschirm, nicht auf den Aktivierungsweg

- **WHEN** der Link aus einer Reset-Mail geöffnet wird
- **THEN** erscheint ein Bildschirm, der vom Setzen eines neuen Passworts
  spricht, nicht vom Bestätigen eines Zugangs
