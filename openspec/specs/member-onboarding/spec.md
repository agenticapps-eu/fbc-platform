# member-onboarding Specification

## Purpose
TBD - created by archiving change add-member-onboarding. Update Purpose after archive.
## Requirements
### Requirement: Die Strecke erscheint beim Aufruf der Startseite, solange der Merker fehlt

Ein angemeldetes, aktiviertes Konto ohne gesetzten Onboarding-Merker SHALL beim
Aufruf der **Startseite** auf die Willkommensstrecke geführt werden, statt die
Startseite zu sehen.

Der Auslöser SHALL der Aufruf der Startseite sein. Er **SHALL NOT** das Setzen
des Passworts sein: nach dem Setzen eines Passworts über ein Aktivierungstoken
werden alle Sitzungen widerrufen, auch die eigene, und es gibt dort keine
Sitzung, in der sich etwas zeigen ließe.

Die Weiche SHALL an **einer** Route hängen und **SHALL NOT** als Sperre um die
gesamte Anwendung liegen. Jede andere Route SHALL unberührt bleiben, auch bei
fehlendem Merker.

Die Weiche SHALL nur umleiten, wenn **alle** Bedingungen zutreffen: es gibt einen
angemeldeten Nutzer, sein Konto ist aktiviert, und der Merker ist nachweislich
nicht gesetzt. Der Aktivierungszustand SHALL ausdrücklich auf „aktiviert" geprüft
werden und **SHALL NOT** auf „nicht unaktiviert": für einen ausgeloggten Besucher
meldet das System „aktiviert", weil es nichts zu aktivieren gibt.

#### Scenario: Ein frisch aktiviertes Mitglied landet in der Strecke

- **WHEN** ein aktiviertes Konto ohne gesetzten Merker die Startseite aufruft
- **THEN** erscheint die Willkommensstrecke und nicht die Startseite

#### Scenario: Ein Konto mit gesetztem Merker sieht die Startseite

- **WHEN** ein aktiviertes Konto mit gesetztem Merker die Startseite aufruft
- **THEN** erscheint die Startseite unverändert und die Strecke **nicht**

#### Scenario: Ein ausgeloggter Besucher wird nicht umgeleitet

- **WHEN** ein nicht angemeldeter Besucher die Startseite aufruft
- **THEN** erscheint die öffentliche Startseite und **keine** Umleitung

#### Scenario: Ein nicht aktiviertes Konto sieht die Aktivierung

- **WHEN** ein angemeldetes, **nicht** aktiviertes Konto die Startseite aufruft
- **THEN** erscheint der Aktivierungsbildschirm und nicht die Strecke

#### Scenario: Andere Routen führen nicht in die Strecke

- **WHEN** ein aktiviertes Konto ohne gesetzten Merker eine andere Route als die
  Startseite aufruft
- **THEN** erscheint diese Route, und die Strecke greift nicht ein

### Requirement: Die Weiche entscheidet erst, wenn sie den Merker kennt

Der Merker kommt aus der Datenbank und ist beim ersten Rendern **unbekannt**. Die
Weiche SHALL diesen dritten Zustand als eigenen behandeln und ihn **SHALL NOT**
einem der beiden anderen zuschlagen.

Solange der Merker unbekannt ist, SHALL weder umgeleitet noch die Startseite
gezeigt werden.

Schlägt das Lesen fehl, SHALL **nicht** umgeleitet werden. Ein Fehler beim Lesen
**SHALL NOT** als „Merker nicht gesetzt" gelten — ein Netzfehler darf
niemanden in die Strecke werfen.

Nach dem Setzen des Merkers SHALL der gelesene Zustand nachziehen, **bevor** zur
Startseite navigiert wird. Sonst führt die Startseite in die soeben beendete
Strecke zurück.

#### Scenario: Während des Ladens erscheint keine der beiden Seiten

- **WHEN** ein angemeldetes Konto die Startseite aufruft und der Merker noch
  nicht gelesen ist
- **THEN** erscheint weder die Strecke noch der Inhalt der Startseite

#### Scenario: Ein Lesefehler leitet nicht um

- **WHEN** das Lesen des Merkers fehlschlägt
- **THEN** erscheint die Startseite und **keine** Umleitung in die Strecke

#### Scenario: Nach dem Beenden führt die Startseite nicht zurück

- **WHEN** ein Mitglied die Strecke beendet und auf der Startseite ankommt
- **THEN** erscheint die Startseite und nicht erneut die Strecke

### Requirement: Die Strecke erklärt zuerst den Nutzen

Vor dem ersten Schritt SHALL die Strecke **kurz** erklären, was das Ausfüllen dem
Mitglied selbst bringt.

Die Erklärung SHALL aus der Sicht des Mitglieds sprechen und **SHALL NOT** damit
argumentieren, was die Plattform oder der Club davon hat.

#### Scenario: Die Erklärung steht vor dem ersten Schritt

- **WHEN** ein Mitglied die Strecke betritt
- **THEN** erscheint eine Erklärung des Nutzens, bevor die erste Frage gestellt
  wird

### Requirement: Die Strecke fragt drei Dinge und schreibt feldbezogen

Die Strecke SHALL aus höchstens drei Schritten bestehen:

1. die **Berufsbezeichnung**,
2. die Auswahl aus den **Kompass-Kategorien** für „Ich biete" und „Ich suche",
3. **Profilbild** und **FBC Standort**.

Jeder Schritt SHALL mit dem vorbelegt sein, was bereits im Profil steht.

Schritt 3 SHALL nur die Felder zeigen, die **leer** sind, und **SHALL NOT**
erscheinen, wenn beide gesetzt sind.

Jeder Schritt SHALL **ausschließlich die Felder seines Schritts** schreiben. Er
**SHALL NOT** einen Schreibweg benutzen, der weitere Profilspalten, die
Kontaktzeile oder Kindtabellen mitschreibt: der Weg des Profil-Editors ersetzt
Interessen und Ziele vollständig und legt die Kontaktzeile bedingungslos an —
aus einem Ein-Feld-Schritt heraus aufgerufen löschte er Daten, nach denen
niemand gefragt hat.

Der **FBC Standort** SHALL als Freitext erhoben werden. Eine Auswahlliste
**SHALL NOT** eingeführt werden — es gibt keine verbindliche Liste der Standorte,
und die vorhandenen Werte sind Freitext.

Die Strecke **SHALL NOT** den Mini-Compass-Assistenten mit seinen Skalen für
Sein, Tun, Haben und Wirken wiederbeleben.

#### Scenario: Vorhandene Angaben sind vorbelegt

- **WHEN** ein Konto mit gesetzter Berufsbezeichnung die Strecke betritt
- **THEN** trägt der erste Schritt diese Berufsbezeichnung bereits als Wert

#### Scenario: Ein bereits vollständiger Schritt entfällt

- **WHEN** ein Konto mit gesetztem Profilbild **und** gesetztem Standort die
  Strecke durchläuft
- **THEN** erscheint der dritte Schritt nicht

#### Scenario: Ein Schritt lässt fremde Profildaten unberührt

- **WHEN** ein Mitglied mit hinterlegten Interessen und einer gefüllten
  Kontaktzeile den ersten Schritt abschließt
- **THEN** sind die Berufsbezeichnung geschrieben und Interessen wie Kontaktzeile
  **unverändert**

### Requirement: Die Auswahl der Kategorien ist rein additiv

Die Kategorien SHALL über denselben Weg geschrieben werden, den der Profil-Editor
benutzt — den **Abgleich je Kategorie**. Sie **SHALL NOT** die Sammlung ersetzen.

Eine Kategorie, zu der das Mitglied bereits einen Eintrag hat, SHALL als gesetzt
erkennbar sein und **SHALL NOT** in dieser Strecke abwählbar sein. Abwählen
löscht alle eigenen Einträge dieser Kategorie samt Beschreibung, Tags und
Volumenband; dieser Weg SHALL dem Profil-Editor vorbehalten bleiben, der die
Rückfrage dafür führt.

Die Auswahl SHALL die Kategorien **je Seite** anbieten, wie die gemeinsame
Vokabularquelle sie führt. Eine feste Gesamtzahl **SHALL NOT** zugesichert
werden: die Werte überschneiden sich zwischen den Seiten.

Vorhandener Freitext des Mitglieds zu „Ich biete" beziehungsweise „Ich suche"
SHALL neben den Kategorien **derselben Seite** erscheinen, sofern vorhanden.
Fehlt er, SHALL nichts an seiner Stelle erscheinen.

#### Scenario: Gewählte Kategorien wirken im Verzeichnis

- **WHEN** ein Mitglied im zweiten Schritt eine Kategorie für „Ich biete" wählt
  und weitergeht
- **THEN** findet der Kategorienfilter des Mitgliederverzeichnisses dieses
  Mitglied unter dieser Kategorie

#### Scenario: Bestehende Einträge überleben die Strecke

- **WHEN** ein Mitglied mit einem vorhandenen, im Editor angelegten Eintrag zu
  einer Kategorie die Strecke durchläuft
- **THEN** bleiben Beschreibung, Tags und Volumenband dieses Eintrags unverändert

#### Scenario: Eine gesetzte Kategorie lässt sich hier nicht abwählen

- **WHEN** ein Mitglied im zweiten Schritt eine bereits gesetzte Kategorie
  anzuklicken versucht
- **THEN** bleibt sie gesetzt und es wird nichts gelöscht

#### Scenario: Ohne Freitext erscheint nichts an seiner Stelle

- **WHEN** ein Mitglied ohne hinterlegten Freitext den zweiten Schritt sieht
- **THEN** erscheinen die Kategorien allein, ohne leeren Platzhalter

### Requirement: Die Strecke hat zwei Auswege, und sie unterscheiden sich

Jeder Schritt SHALL **beide** Auswege anbieten:

- **Vertagen** SHALL den Merker **nicht** setzen. Die Strecke SHALL beim nächsten
  Aufruf der Startseite wieder erscheinen.
- **Überspringen** SHALL den Merker setzen. Die Strecke SHALL danach **nicht
  wieder** erscheinen, auch nicht auf einem anderen Gerät.

Vor dem Überspringen SHALL das System darauf hinweisen, was ohne die Angaben
fehlt — insbesondere, dass der Kompass-Filter des Verzeichnisses das Mitglied
ohne Kategorien nicht findet. Der Hinweis SHALL benennen, was zu gewinnen ist,
und **SHALL NOT** drohen oder beschämen.

Beide Auswege SHALL zur Startseite führen und **SHALL NOT** bereits geschriebene
Angaben verwerfen.

#### Scenario: Vertagen führt zur Startseite und die Strecke kehrt zurück

- **WHEN** ein Mitglied vertagt und die Startseite später erneut aufruft
- **THEN** erscheint die Strecke wieder

#### Scenario: Überspringen beendet dauerhaft

- **WHEN** ein Mitglied überspringt und die Startseite später erneut aufruft
- **THEN** erscheint die Startseite und nicht die Strecke

#### Scenario: Vor dem Überspringen steht ein Hinweis

- **WHEN** ein Mitglied das Überspringen auslöst
- **THEN** erscheint zuvor der Hinweis darauf, dass der Kompass-Filter es ohne
  Kategorien nicht findet

### Requirement: Ein Abbruch verliert nichts, und die Wiederkehr beginnt beim ersten leeren Feld

Jeder Schritt SHALL seine Angabe beim Weitergehen schreiben, nicht erst am Ende
der Strecke.

Wird die Strecke ohne Ausweg verlassen — geschlossener Tab, Wegnavigieren —
SHALL das Geschriebene erhalten bleiben.

Die Wiederkehr SHALL beim **ersten Schritt beginnen, dessen Feld leer ist**. Sie
**SHALL NOT** einen gespeicherten Fortschritt voraussetzen: aus den Daten
ist nicht ableitbar, ob ein Schritt bewusst leer weitergegangen oder nie gesehen
wurde. Wer einen Schritt leer weitergeht, SHALL ihn beim nächsten Mal erneut
sehen; wer die Strecke nicht mehr sehen will, SHALL den Weg des Überspringens
benutzen.

#### Scenario: Angaben aus abgebrochenen Schritten bleiben erhalten

- **WHEN** ein Mitglied den ersten Schritt ausfüllt, weitergeht und die Strecke
  danach ohne Ausweg verlässt
- **THEN** trägt sein Profil die Angabe aus dem ersten Schritt

#### Scenario: Die Wiederkehr überspringt das bereits Gefüllte

- **WHEN** dieses Mitglied die Startseite erneut aufruft
- **THEN** beginnt die Strecke beim ersten Schritt, dessen Feld leer ist, und
  nicht wieder beim ersten

### Requirement: Der Merker liegt in den eigenen Einstellungen, nicht am öffentlichen Profil

Der Zustand „Strecke beendet" SHALL in der Datenbank liegen und **SHALL NOT**
allein im Browserspeicher — er muss den Gerätewechsel überleben.

Er SHALL in einer Tabelle liegen, die **ausschließlich der Eigentümer** liest.
Er **SHALL NOT** in der Profilzeile liegen: deren Lesepolitik gibt vollständige
Zeilen ab der Stufe `discover` an fremde Mitglieder frei, und der Merker wäre
damit öffentlich, ohne dass es irgendwo stünde.

Der Schreibweg SHALL damit rechnen, dass die Einstellungszeile **noch nicht
existiert** — sie entsteht bei der Registrierung nicht. Ein Schreibvorgang, der
eine vorhandene Zeile voraussetzt, ändert nichts und meldet dabei keinen Fehler.

#### Scenario: Der Merker überlebt den Gerätewechsel

- **WHEN** ein Mitglied die Strecke auf einem Gerät überspringt und sich danach
  auf einem anderen Gerät anmeldet
- **THEN** erscheint die Strecke dort nicht

#### Scenario: Der Merker entsteht auch ohne vorhandene Einstellungszeile

- **WHEN** ein Mitglied ohne Einstellungszeile die Strecke beendet
- **THEN** existiert die Zeile danach und trägt den Merker

#### Scenario: Fremde sehen den Merker nicht

- **WHEN** ein Mitglied ab der Stufe `discover` die Daten eines anderen
  Mitglieds liest
- **THEN** ist dessen Onboarding-Merker nicht darunter

### Requirement: Der Fortschritt nennt die tatsächliche Zahl der Schritte

Die Strecke SHALL ihren Fortschritt sichtbar machen.

Die genannte Gesamtzahl SHALL die Zahl der Schritte sein, die dieses Mitglied
**tatsächlich** durchläuft, und **SHALL NOT** eine feste Zahl. Entfällt ein
Schritt, weil seine Felder bereits gefüllt sind, SHALL er auch nicht mitgezählt
werden.

#### Scenario: Ein entfallener Schritt wird nicht mitgezählt

- **WHEN** ein Mitglied die Strecke betritt, dessen Profilbild und Standort
  bereits gesetzt sind
- **THEN** nennt der Fortschritt zwei Schritte als Gesamtzahl und nicht drei

