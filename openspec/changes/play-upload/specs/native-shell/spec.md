## MODIFIED Requirements

### Requirement: Ein nativer Bau läuft nur, wenn er angefordert wird

Der Workflow, der die Web-Fläche ausliefert, SHALL NOT nativ bauen. Der native
Bau SHALL in einem **eigenen** Workflow liegen, der von Hand oder über ein Tag
ausgelöst wird, und SHALL NOT bei jedem Push oder Pull Request laufen.

Sonst wird aus jeder Textänderung ein Xcode-Lauf auf einem macOS-Runner, samt
Signaturzertifikat, für einen Bau, den niemand angefordert hat.

Dieselbe Zurückhaltung gilt eine Stufe schärfer für die **Übertragung an den
Store**. Ein gebautes Bündel SHALL nur dann an den Store übertragen werden,
wenn der Lauf **durch ein Tag ausgelöst** wurde, und erst **nachdem** der
Nachweis am Artefakt bestanden ist.

Zugesagt ist damit die Übertragung nach außen, nicht die Ablage im Lauf: Ein
Handstart SHALL weiterhin ein Artefakt zur Abholung ablegen dürfen. Der
Unterschied ist, wer es bekommt — ein Artefakt liegt im Lauf und wird abgeholt,
eine Übertragung ist beim Store und kommt nicht zurück.

Denn der Unterschied zum Bau ist die Umkehrbarkeit. Ein unangeforderter Bau
kostet Runner-Minuten; eine unangeforderte Übertragung verbraucht eine
Build-Nummer, die nicht zurückkommt. Deshalb bleibt der Handstart das
gefahrlose Werkzeug — bauen, prüfen, Artefakt ansehen — und das Tag ist die
eine benannte Handlung, die etwas nach außen gibt.

Die Bedingung SHALL den **Auslöser** prüfen, nicht allein die Referenz. Ein
Handstart kann auf eine Tag-Referenz gerichtet werden; eine Bedingung, die nur
den Namen der Referenz liest, hielte diese Zusage nicht und bliebe dabei grün.

Die Reihenfolge ist Teil der Zusage, nicht ihrer Umsetzung überlassen: Ein
Artefakt, dessen Nachweis fehlschlägt, ist genau das Artefakt, das niemand
bekommen darf. Stünde die Übertragung davor, wäre der Nachweis eine Meldung
über etwas bereits Geschehenes.

Ebenso SHALL das Artefakt **vor** der Übertragung abgelegt werden. Scheitert die
Übertragung, ist das der Fall, in dem das geprüfte Bündel am dringendsten
gebraucht wird; stünde die Ablage dahinter, entfiele sie nach der üblichen
Regel, dass ein fehlgeschlagener Schritt die folgenden überspringt.

Fehlen die Zugangsdaten für die Übertragung, SHALL der Lauf **abbrechen** und
die fehlende Stelle benennen. Er SHALL NOT die Übertragung still überspringen.

Ein grüner Lauf auf einem Versions-Tag ist die Aussage „ausgeliefert". Wer ihn
grün lässt, ohne etwas übertragen zu haben, macht aus einer fehlenden
Einstellung ein stilles Nichts — und das fällt erst auf, wenn jemand im Store
nach einer Fassung sucht, die nie ankam.

Die Store-Einreichung selbst — Konto, Angaben, Prüfgruppen, Freigabe — bleibt
davon unberührt und außerhalb dieser Spezifikation. Zugesagt ist nur, **wohin
ein gebautes Bündel geht und unter welcher Bedingung**.

#### Scenario: Ein Pull Request löst keinen nativen Bau aus

- **WHEN** ein Pull Request geöffnet wird, der nur Web-Dateien ändert
- **THEN** läuft der Web-Deploy wie bisher
- **AND** kein nativer Bau startet

#### Scenario: Ein Handstart baut und legt ab, überträgt aber nicht

- **WHEN** der native Release-Workflow von Hand ausgelöst wird
- **THEN** entsteht ein signiertes Artefakt, der Nachweis läuft, und das
  Artefakt liegt zur Abholung bereit
- **AND** das Bündel wird **nicht** an den Store übertragen

#### Scenario: Ein Handstart auf eine Tag-Referenz überträgt ebenfalls nicht

- **WHEN** der Workflow von Hand ausgelöst wird und dabei auf eine
  Tag-Referenz gerichtet ist
- **THEN** wird das Bündel **nicht** an den Store übertragen
- **AND** der Lauf unterscheidet sich darin nicht von einem Handstart auf einen
  Branch

#### Scenario: Ein Tag überträgt

- **WHEN** der native Release-Workflow durch das Schieben eines Versions-Tags
  ausgelöst wird
- **THEN** wird das Bündel nach bestandenem Nachweis an den Store übertragen
- **AND** die Zugangsdaten für die Übertragung liegen in der
  Geheimnisverwaltung, nicht im Repository — ob es dieselben sind, die
  signiert haben, entscheidet die Plattform und nicht diese Zusage

#### Scenario: Ein Bündel ohne bestandenen Nachweis erreicht den Store nicht

- **WHEN** der Nachweis am Artefakt fehlschlägt — auf der einen Plattform
  fremdes Team, Entwickler- statt Verteil-Zertifikat, Geräteliste im Profil,
  falsche Push-Umgebung oder eine Build-Nummer, die nicht aus dem Lauf stammt;
  auf der anderen ein Fingerabdruck, der nicht dem erwarteten Upload-Schlüssel
  entspricht, oder ein Bündel, dessen Signatur sich nicht verifizieren lässt
- **THEN** bricht der Lauf ab
- **AND** es wird nichts übertragen, unabhängig davon, ob ein Tag den Lauf
  ausgelöst hat

#### Scenario: Eine gescheiterte Übertragung lässt das geprüfte Bündel zurück

- **WHEN** der Nachweis besteht, die Übertragung an den Store aber fehlschlägt
- **THEN** ist der Lauf rot
- **AND** das geprüfte Artefakt liegt trotzdem zur Abholung bereit

#### Scenario: Fehlende Zugangsdaten brechen den Lauf, statt ihn zu überspringen

- **WHEN** ein Versions-Tag den Lauf auslöst, die Zugangsdaten für die
  Übertragung aber nicht hinterlegt sind
- **THEN** bricht der Lauf ab und nennt, welches Geheimnis fehlt
- **AND** der Lauf ist **nicht** grün

