## ADDED Requirements

### Requirement: Der Trockenlauf ist der Standard

Der Import SHALL ohne einen ausdrücklichen Schreibschalter nichts schreiben.
Ein Aufruf **mit Quelldatei, aber ohne Schreibschalter** SHALL vollständig
durchlaufen, den Bericht erzeugen und jedes Ziel unverändert lassen.

Der Trockenlauf SHALL dieselbe Abbildung und dieselbe Fallklassifikation
durchlaufen wie der schreibende Lauf. Ein Trockenlauf, der einen anderen Weg
nimmt als der echte, sagt nichts über den echten aus. Abzweigen SHALL
ausschließlich die Menge der wirkenden Adapter — Datenbank, Dateiablage und
ausgehende Netzwerkaufrufe —, nicht die Logik davor.

#### Scenario: Aufruf ohne Schreibschalter wirkt nirgends

- **WHEN** der Import mit Quelldatei, aber ohne den Schreibschalter aufgerufen wird
- **THEN** erzeugt er den vollständigen Bericht, und die Zahl der Zeilen in
  `profiles`, `profile_contacts`, `profile_legacy` und im Anmeldedienst ist
  danach dieselbe wie davor, und in der Dateiablage ist kein Objekt hinzugekommen

#### Scenario: Der Trockenlauf benennt, was er schreiben würde

- **WHEN** der Trockenlauf einen Datensatz verarbeitet, der beim echten Lauf
  ein neues Konto ergäbe
- **THEN** weist der Bericht ihn als „würde angelegt" aus, mit der
  E-Mail-Adresse als Schlüssel

### Requirement: Ein zweiter Lauf legt keine Dubletten an

Der Import SHALL Datensätze über `profile_legacy.legacy_source_id`
wiedererkennen und bestehende Profile aktualisieren, statt neue anzulegen.

Weil das Anlegen des Anmeldekontos und das Schreiben des Profils nicht gemeinsam
atomar sein können, SHALL die Wiedererkennung **zusätzlich** über die
normalisierte Anmeldeadresse laufen. Ein Konto, das ohne Kennung zurückblieb,
SHALL beim nächsten Lauf als dasselbe erkannt und ergänzt werden, statt ein
zweites Mal angelegt zu werden.

Adresse und Kennung SHALL vor dem Vergleich normalisiert werden: Adressen
getrimmt und auf Kleinschreibung gefaltet, Kennungen getrimmt und als nichtleer
verlangt.

#### Scenario: Zweiter Lauf über denselben Bestand

- **GIVEN** ein vollständiger schreibender Lauf ist durchgelaufen
- **WHEN** derselbe Lauf ein zweites Mal über dieselbe Quelldatei läuft
- **THEN** ist die Zahl der Profile unverändert, und der Bericht weist jeden
  Datensatz als „aktualisiert" statt „angelegt" aus

#### Scenario: Ein Konto ohne Kennung wird wiedererkannt

- **GIVEN** ein früherer Lauf brach ab, nachdem er ein Anmeldekonto angelegt,
  aber noch keine Kennung geschrieben hatte
- **WHEN** der Import erneut über denselben Datensatz läuft
- **THEN** erkennt er das Konto an seiner Adresse, ergänzt die fehlende Kennung
  und legt kein zweites Konto an

### Requirement: Ein zweiter Lauf überschreibt keine Pflege des Mitglieds

Ein Lauf nach dem Go-Live trifft auf Profile, die Mitglieder selbst gepflegt
haben. Der Import SHALL ein Profilfeld nur schreiben, wenn das Ziel leer ist.
Ein Wert, den ein Mitglied gesetzt **oder gelöscht** hat, SHALL erhalten bleiben.

Ausgenommen SHALL sein: `paid_until`, `legacy_tier`, `legacy_price` und
`member_since`. Diese Felder gehören der Verwaltung und SHALL bei jedem Lauf
aktualisiert werden.

Der Aktivierungszeitpunkt und die Anmeldeadresse SHALL vom Import **nie**
verändert werden. Ein Import, der den Aktivierungszeitpunkt zurücksetzt, sperrt
ein bereits angekommenes Mitglied wieder aus.

#### Scenario: Ein geändertes Feld bleibt geändert

- **GIVEN** ein Mitglied hat nach dem Import seine Berufsbezeichnung geändert
- **WHEN** der Import ein zweites Mal über denselben Datensatz läuft
- **THEN** trägt das Profil weiterhin die Fassung des Mitglieds, nicht die der
  Quelle

#### Scenario: Ein geleertes Feld bleibt leer

- **GIVEN** ein Mitglied hat einen aus der Quelle übernommenen Text gelöscht
- **WHEN** der Import ein zweites Mal läuft
- **THEN** bleibt das Feld leer, statt aus der Quelle erneut gefüllt zu werden

#### Scenario: Ein Verwaltungsfeld wird aktualisiert

- **GIVEN** eine nachgelieferte Liste trägt einen Zahlungsstand für ein bereits
  importiertes Mitglied
- **WHEN** der Import ein zweites Mal läuft
- **THEN** trägt das Profil den neuen Zahlungsstand, und der
  Aktivierungszeitpunkt des Mitglieds ist unverändert

### Requirement: Die ganze Datei wird geprüft, bevor irgendetwas geschrieben wird

Ein Abbruch mitten im Lauf hinterließe einen Teil der Datensätze geschrieben.
Der Import SHALL deshalb in zwei Abschnitten laufen: eine Vorabprüfung über die
**vollständige** Quelldatei, die nichts schreibt, und erst danach der schreibende
Abschnitt.

Die Vorabprüfung SHALL die Kopfzeile, mehrfach vorkommende Adressen, ungültige
Adressen und Kollisionen mit bereits vorhandenen Konten erfassen. Scheitert sie,
SHALL der Lauf enden, ohne einen einzigen Datensatz geschrieben zu haben.

Die Vorabprüfung SHALL im schreibenden Lauf **erneut** ausgeführt werden und
SHALL NOT aus einem vorangegangenen Trockenlauf übernommen werden: zwischen
beiden kann sich der Bestand geändert haben.

#### Scenario: Eine Dublette im letzten Datensatz verhindert jeden Schreibvorgang

- **GIVEN** die Quelldatei enthält erst im letzten Datensatz eine doppelte Adresse
- **WHEN** ein schreibender Lauf gestartet wird
- **THEN** endet er ohne jeden Schreibvorgang, und die Zahl der Profile ist
  unverändert

### Requirement: Bestandskonten werden nicht übernommen und nicht erhoben

Auf der Zielplattform existieren Konten ohne Kennung aus dem Altsystem —
Testkonten, Zweitkonten und jede Selbstregistrierung.

Trifft die Vorabprüfung eine Quelladresse, zu der bereits ein solches Konto
besteht, SHALL sie den schreibenden Lauf blockieren und den Fall auflisten.

Der Import SHALL NOT ein bestehendes Konto auf die höchste Mitgliedsstufe heben.
Andernfalls genügte eine Selbstregistrierung unter einer bekannten
Mitgliedsadresse, um sie geschenkt zu bekommen.

#### Scenario: Eine bereits vergebene Adresse blockiert den Schreiblauf

- **GIVEN** auf der Zielplattform besteht ein Konto mit einer Adresse aus der
  Quelldatei, ohne Kennung aus dem Altsystem
- **WHEN** ein schreibender Lauf gestartet wird
- **THEN** endet er ohne Schreibvorgang, nennt das betroffene Konto, und dessen
  Mitgliedsstufe ist unverändert

### Requirement: Der Import verschickt keine Mail

Der Zugang entsteht dadurch, dass ein Mitglied seine Adresse auf der Plattform
eingibt und den Versand damit selbst auslöst. Der Import SHALL keinen Versand
auslösen und SHALL kein Aktivierungstoken ausstellen.

Ein Versand aus dem Import heraus verschickte Links, bevor die Ankündigung
draußen ist, und ein späterer Lauf entwertete sie wieder — ein Mitglied hielte
dann eine echte Mail mit einem toten Link in der Hand.

#### Scenario: Ein Lauf löst keinen Versand aus

- **WHEN** ein schreibender Lauf 70 Konten anlegt
- **THEN** wurde kein Aktivierungstoken ausgestellt und keine Mail verschickt

### Requirement: Die Zugangsdaten des Altsystems werden nicht übernommen

Die Quelle führt die Passwort-Hashes des Altsystems. Der Import SHALL sie weder
lesen noch schreiben noch protokollieren, und angelegte Konten SHALL ohne
Passwort entstehen.

#### Scenario: Ein importiertes Konto trägt kein Passwort

- **WHEN** der Import ein Konto anlegt
- **THEN** trägt es kein Passwort, und eine Anmeldung mit dem Passwort des
  Altsystems ist nicht möglich

### Requirement: Jeder Lauf endet mit einem Bericht

Der Import SHALL jeden Lauf mit einem Bericht abschließen, der jeden Datensatz
der Quelldatei genau einer Klasse zuordnet: angelegt, aktualisiert,
übersprungen oder fehlerhaft. Übersprungen und fehlerhaft SHALL je einen Grund
tragen.

Der Bericht SHALL zusätzlich die Datensätze ausweisen, die zwar durchlaufen,
aber Handarbeit brauchen — insbesondere aufgefüllte Beitrittsdaten, unsicher
zerlegte Ortsangaben und fehlende Zahlungsstände.

Die Summe der vier Klassen SHALL der Zahl der Datensätze in der Quelldatei
entsprechen. Ein Datensatz, der in keiner Klasse auftaucht, ist ein stiller
Verlust.

Ein Lauf, den die Vorabprüfung beendet, SHALL stattdessen einen eigenen
Berichtstyp erzeugen, der den Grund des Abbruchs und die betroffenen Datensätze
führt und **keine** Datensatzklassen ausweist. Die Klassensumme gilt nur für
Läufe, die den verarbeitenden Abschnitt erreichen — andernfalls wäre die Regel
bei jedem Vorab-Abbruch verletzt und damit wertlos.

#### Scenario: Die Klassen decken die Quelle vollständig ab

- **WHEN** ein Lauf den verarbeitenden Abschnitt über eine Quelldatei mit N
  Datensätzen beendet
- **THEN** ist die Summe aus angelegt, aktualisiert, übersprungen und fehlerhaft
  gleich N

#### Scenario: Ein Vorab-Abbruch berichtet seinen Grund

- **WHEN** die Vorabprüfung den Lauf beendet
- **THEN** nennt der Bericht den Grund und die betroffenen Datensätze und weist
  keine Datensatzklassen aus

#### Scenario: Ein Fehler beendet den Lauf nicht

- **WHEN** ein einzelner Datensatz nicht verarbeitet werden kann
- **THEN** läuft der Import über die übrigen Datensätze weiter und führt den
  gescheiterten mit seinem Grund im Bericht

### Requirement: Fälle, die Handarbeit brauchen, werden vorher benannt

Der Import SHALL die folgenden Fälle erkennen und im Bericht ausweisen, statt
sie stillschweigend zu behandeln:

- mehrfach vorkommende E-Mail-Adressen — der Lauf SHALL abbrechen und die
  betroffenen Datensätze auflisten, weil nur ein Mensch entscheiden kann,
  welcher gilt
- fehlende oder syntaktisch ungültige E-Mail-Adresse — SHALL nicht importiert,
  sondern aufgelistet werden, weil die Adresse der Schlüssel des Zugangs ist
- ein Datensatz auf der Liste der Ausgetretenen — SHALL nicht importiert werden
- ein Datensatz ohne Zahlungsstand — SHALL importiert und aufgelistet werden
- ein Profil mit wenig Inhalt — SHALL importiert werden; ein dünnes Profil ist
  besser als ein fehlendes Mitglied

Der **Trockenlauf** SHALL ohne die Liste der Ausgetretenen und ohne die
Zahlungsstände lauffähig sein und ihr Fehlen im Bericht vermerken. Diese Angaben
stammen von außerhalb des Systems; ein Import, der auf sie wartet, kann den
Bericht nicht erzeugen, mit dem sie eingefordert werden.

Der **schreibende** Lauf SHALL ohne die Liste der Ausgetretenen verweigern. Ohne
sie ist nicht entscheidbar, wer nicht mitkommen soll, und ein Ex-Mitglied im
Verzeichnis ist nach dem Anlegen nicht folgenlos rückgängig zu machen. Fehlende
Zahlungsstände SHALL den schreibenden Lauf dagegen **nicht** verweigern — sie
sind nachtragbar, und die betroffenen Mitglieder stehen im Bericht.

#### Scenario: Doppelte Adresse bricht ab

- **WHEN** die Quelldatei dieselbe E-Mail-Adresse mehr als einmal enthält
- **THEN** bricht der Lauf ab, nennt die betroffenen Datensätze und schreibt
  nichts

#### Scenario: Der Trockenlauf kommt ohne die Listen aus

- **WHEN** ein Trockenlauf ohne Liste der Ausgetretenen ausgeführt wird
- **THEN** läuft er vollständig durch und vermerkt im Bericht, dass die Liste
  fehlte und deshalb niemand als ausgetreten behandelt wurde

#### Scenario: Der schreibende Lauf verweigert ohne die Ausgetretenen-Liste

- **WHEN** ein schreibender Lauf ohne Liste der Ausgetretenen gestartet wird
- **THEN** endet er ohne Schreibvorgang und nennt die fehlende Liste als Grund

### Requirement: Unvollständige Beitrittsdaten werden aufgefüllt und ausgewiesen

Die Quelle führt das Beitrittsdatum als Freitext in wechselnden Schreibweisen,
und ein Teil der Angaben trägt keinen Tag oder nicht einmal einen Monat. Das
Zielfeld ist ein Datum und erzwingt einen Tag.

Der Import SHALL eine fehlende Tagesangabe auf den ersten Tag des Monats und
einen fehlenden Monat auf den ersten Januar auffüllen. Jeder aufgefüllte
Datensatz SHALL im Bericht mit seiner Rohangabe erscheinen.

Der Import SHALL das Beitrittsdatum dem Registrierungsdatum des Altsystems
vorziehen, weil Mitglieder, die dem Club vor dem Bau der alten Seite beitraten,
nur so ihr wirkliches Datum behalten.

#### Scenario: Eine Jahresangabe wird aufgefüllt

- **WHEN** die Quelle als Beitrittsdatum nur ein Jahr führt
- **THEN** trägt das Profil den ersten Januar dieses Jahres, und der Bericht
  führt den Datensatz mit der Rohangabe als aufgefüllt

#### Scenario: Ein vollständiges Datum bleibt unberührt

- **WHEN** die Quelle ein tagesgenaues Datum führt
- **THEN** übernimmt das Profil genau dieses Datum, und der Bericht führt den
  Datensatz nicht als aufgefüllt

### Requirement: Bilder werden in voller Auflösung übernommen

Das Altsystem legt neben jedem Bild verkleinerte Ableitungen mit einem
Größensuffix ab. Der Import SHALL die Datei **ohne** Größensuffix ziehen.

Der Dateiname nennt die Endung, und diese wechselt zwischen den Konten. Der
Import SHALL die im Datensatz genannte Endung verwenden und SHALL NOT eine
Endung raten.

Ein fehlendes, nicht erreichbares oder unlesbares Bild SHALL kein Abbruchgrund
sein, sondern eine Zeile im Bericht.

Das Holen der Bilder SHALL ein **eigener, für sich wiederholbarer Abschnitt**
sein, der die Dateien außerhalb des Arbeitsbaums zwischenlagert, und der Import
SHALL bevorzugt aus dieser Zwischenablage lesen. Andernfalls hinge eine
Datenübernahme an der Erreichbarkeit eines fremden Servers, und die Bilder wären
mit dem Abschalten des Altsystems endgültig verloren.

Trifft der Import in der Ablage ein Objekt an, das dem Ziel entspricht, SHALL er
es überspringen und im Bericht nennen, statt es zu ersetzen oder am Konflikt zu
scheitern. Sonst scheiterte der zweite Lauf an dem, was der erste angelegt hat.

#### Scenario: Ein zweiter Lauf scheitert nicht am eigenen Bild

- **GIVEN** ein Lauf hat das Bild eines Mitglieds bereits abgelegt
- **WHEN** derselbe Lauf ein zweites Mal läuft
- **THEN** überspringt er das vorhandene Objekt, nennt es im Bericht und bricht
  nicht ab

#### Scenario: Die Ableitung wird nicht verwechselt

- **WHEN** der Import ein Profilbild überträgt
- **THEN** lädt er die Datei ohne Größensuffix, nicht die verkleinerte
  Ableitung

#### Scenario: Ein unerreichbares Bild bricht den Datensatz nicht

- **WHEN** das Bild eines Datensatzes nicht geladen werden kann
- **THEN** wird das Mitglied dennoch angelegt, und der Bericht führt das
  fehlende Bild mit Grund

### Requirement: Die Personendaten der Quelle bleiben außerhalb des Repositoriums

Die Quelldatei trägt Klarnamen, Anschriften, Telefonnummern und
Passwort-Hashes von Bestandsmitgliedern. Das Repository ist öffentlich.

Der Import SHALL den Pfad zur Quelldatei als Argument entgegennehmen. Ein Pfad,
der **innerhalb** des Arbeitsbaums liegt, SHALL abgelehnt werden — für Quelle
wie für Bericht. Ignorieren genügt nicht: eine ignorierte Datei ist vorhanden,
nur unsichtbar, und die nächste Änderung an den Ignorierregeln legt sie frei.

Der Bericht SHALL neben der Quelle abgelegt werden, mit auf den Eigentümer
beschränkten Rechten.

Die Standardausgabe SHALL ausschließlich nicht-personenbezogene Kennungen führen
— Zeilennummer und Kennung aus dem Altsystem. Namen, Adressen, Telefonnummern
und Anschriften SHALL ausschließlich im Bericht erscheinen. Andernfalls stehen
sie in der Kommandozeilenhistorie und in den Protokollen jeder Umgebung, die den
Lauf je ausführt.

#### Scenario: Ein Pfad im Arbeitsbaum wird abgelehnt

- **WHEN** der Import mit einer Quelldatei innerhalb des Arbeitsbaums aufgerufen
  wird
- **THEN** endet er mit einer Meldung, ohne die Datei zu lesen

#### Scenario: Kein Personendatum liegt im Arbeitsbaum

- **WHEN** ein vollständiger Lauf durchgelaufen ist
- **THEN** meldet die Versionsverwaltung keine neue Datei mit Personendaten,
  weder verfolgt noch ignoriert

#### Scenario: Die Standardausgabe trägt keine Personendaten

- **WHEN** ein Lauf über die vollständige Quelldatei läuft
- **THEN** enthält seine Standardausgabe keinen Namen, keine Adresse und keine
  Telefonnummer aus der Quelle

### Requirement: Tote Spalten der Quelle werden nicht übernommen

Der Export der Quelle enthält Spalten aus Formularfeldern, die es nicht mehr
gibt, sowie technische Spalten des Altsystems und seiner Erweiterungen. Ein
Import, der über alle Spalten läuft, zieht tote Daten mit.

Der Import SHALL ausschließlich eine ausdrücklich benannte Menge von
Quellfeldern lesen. Eine unbekannte Spalte SHALL ignoriert werden, und eine
erwartete, aber fehlende Spalte SHALL den Lauf mit einer Meldung beenden,
statt das Feld still als leer zu behandeln.

#### Scenario: Eine fehlende erwartete Spalte bricht laut ab

- **WHEN** der Quelldatei eine Spalte fehlt, die die Abbildung erwartet
- **THEN** bricht der Lauf mit einer Meldung ab, die die Spalte nennt, statt
  das Feld für alle Datensätze leer zu lassen
