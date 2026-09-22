## ADDED Requirements

### Requirement: Nur wer das geteilte Geheimnis trägt, darf einreichen

Die Edge Function `anforderung-eingang` SHALL jeden Aufruf ablehnen, dessen
Header `x-anforderung-schluessel` fehlt, länger als 512 Zeichen ist oder nicht
byte-genau dem Secret `ANFORDERUNG_SCHLUESSEL` entspricht. Der Vergleich MUST
über gleich lange SHA-256-Digests in konstanter Zeit erfolgen. Die Function MUST
in `supabase/config.toml` mit `verify_jwt = false` stehen, weil die
ChatGPT-Action kein Supabase-JWT trägt. Ein abgelehnter Aufruf MUST vor jedem
Zugriff auf Linear, auf Dateilinks und auf die Datenbank enden.

#### Scenario: Richtiger Schlüssel

- **WHEN** ein POST mit gültigem Rumpf und korrektem `x-anforderung-schluessel`
  eintrifft
- **THEN** wird die Anforderung verarbeitet

#### Scenario: Fehlender oder falscher Schlüssel

- **WHEN** der Header fehlt, leer ist, länger als 512 Zeichen ist oder einen
  anderen Wert trägt
- **THEN** antwortet die Function mit 401 und `{ fehler }`
- **AND** es wird weder Linear aufgerufen noch eine Datei geladen noch die
  Datenbank berührt

#### Scenario: Secret nicht gesetzt

- **WHEN** `ANFORDERUNG_SCHLUESSEL` oder `LINEAR_API_KEY` in der Umgebung fehlt
- **THEN** antwortet die Function mit 500 und `{ fehler }` und legt nichts an
- **AND** ein leerer Header gilt nie als Übereinstimmung mit einem leeren Secret

### Requirement: Jede Ablehnung ist ein vorlesbarer Satz

Jede Antwort mit einem Status von 400 oder höher SHALL den Rumpf `{ fehler }`
tragen, mit `content-type: application/json`, wobei `fehler` aus ganzen
deutschen Sätzen besteht, die der GPT vorlesen kann. Das gilt für 400, 401, 405,
429, 500 und 502.

#### Scenario: Kein JSON

- **WHEN** der Rumpf kein gültiges JSON ist
- **THEN** kommt 400 mit einem Satz, der sagt, dass die Anfrage nicht lesbar war

#### Scenario: Gedrosselt

- **WHEN** die Drossel greift
- **THEN** kommt 429 mit einem Satz, der sagt, dass es später noch einmal
  versucht werden soll

### Requirement: Eine Anforderung trägt vier Pflichtfelder, serverseitig geprüft

Die Function SHALL `titel` (1–200 Zeichen nach Trimmen), `beschreibung`
(1–8000), `art` (genau einer von `fehler`, `aenderung`, `funktion`, `idee`) und
`einreicher` (1–120) verlangen. `route` ist optional (höchstens 200 Zeichen).
Zeichen sind Unicode-Codepoints, wie bei `maxLength` im OpenAPI-Schema. Verletzt
der Rumpf eine dieser Regeln, ist er kein JSON-Objekt oder ist
`openaiFileIdRefs` vorhanden, aber keine Liste, MUST die Function mit 400
antworten und alle Mängel in einem `fehler` nennen. Bei 400 MUST nichts
angelegt werden.

#### Scenario: Pflichtfeld fehlt

- **WHEN** `art` im Rumpf fehlt
- **THEN** kommt 400 mit einem Satz, der die fehlende Angabe benennt
- **AND** Linear wird nicht aufgerufen

#### Scenario: Unzulässige Art

- **WHEN** `art` den Wert `wunsch` trägt
- **THEN** kommt 400 mit einem Satz, der Fehler, Änderung, neue Funktion und
  Idee in normalen Worten nennt

#### Scenario: Zu langer Titel

- **WHEN** `titel` 201 Zeichen hat
- **THEN** kommt 400, und es wird nichts gekürzt und nichts angelegt

### Requirement: Das Ziel in Linear ist fest verdrahtet

Die Function SHALL jedes Issue im Team AgenticApps, im Zustand Triage und im
Projekt „eff.bee.zee — Backlog" anlegen, mit dem Label `von-detlev` und genau
einem Label nach Art: `fehler` → Bug, `aenderung` → Improvement, `funktion` →
Feature, `idee` → Idee. Diese IDs MUST Konstanten im Code sein. Kein Feld des
Rumpfs DARF Team, Projekt, Zustand, Labels, Zuständigkeit oder Priorität
beeinflussen, und unbekannte Felder MUST ignoriert werden.

#### Scenario: Art bestimmt das zweite Label

- **WHEN** eine gültige Anforderung mit `art = aenderung` eintrifft
- **THEN** trägt das angelegte Issue genau die Labels `von-detlev` und
  Improvement, im Zustand Triage und im Projekt „eff.bee.zee — Backlog"

#### Scenario: Aufrufer versucht, das Ziel zu wählen

- **WHEN** der Rumpf zusätzlich `teamId`, `stateId` oder `labelIds` trägt
- **THEN** werden diese Felder ignoriert, und das Issue landet am fest
  verdrahteten Ziel

### Requirement: Der Eingang legt an und ändert nie

Die Function SHALL je angenommenem Aufruf höchstens ein Issue anlegen. Sie MUST
keinen Pfad haben, der ein bestehendes Issue liest, kommentiert, ändert oder
schließt. Eine Doppelerkennung gibt es nicht.

#### Scenario: Zweimal dieselbe Anforderung

- **WHEN** derselbe Rumpf zweimal eingereicht wird
- **THEN** entstehen zwei Issues. Doppelte führt Donald in der Triage zusammen.

### Requirement: Die Beschreibung im Issue hat eine feste Gliederung

Die Beschreibung des Issues SHALL in dieser Reihenfolge bestehen aus: dem Text
aus `beschreibung` unverändert; einem Abschnitt „Bilder" mit allen übernommenen
Dateien (Bilder eingebettet als `![name](assetUrl)`, Videos als
`[name](assetUrl)`) und allen nicht übernommenen Dateien mit Namen und Grund;
einer Fußzeile „Eingereicht von {einreicher} über ChatGPT · {TT.MM.JJJJ, HH:MM}
· Route: {route oder „unklar"}", die Uhrzeit in Europe/Berlin. Der Abschnitt
„Bilder" MUST entfallen, wenn keine Datei mitkam. Dateinamen, `einreicher` und
`route` MUST vor dem Einsetzen von Steuerzeichen befreit, auf 100 Zeichen
begrenzt und so maskiert werden, dass sie kein Markdown öffnen oder schließen
können. Der Issue-Titel SHALL `titel` unverändert sein.

#### Scenario: Anforderung ohne Dateien und ohne Route

- **WHEN** eine gültige Anforderung ohne `openaiFileIdRefs` und ohne `route`
  eintrifft
- **THEN** besteht die Beschreibung aus dem Text und der Fußzeile mit
  „Route: unklar", ohne Abschnitt „Bilder"

#### Scenario: Screenshot und Bildschirmaufnahme

- **WHEN** ein PNG und ein MP4 mitkommen und beide übernommen werden
- **THEN** steht das PNG als eingebettetes Bild und das MP4 als Link im
  Abschnitt „Bilder"

#### Scenario: Dateiname mit Markdown

- **WHEN** eine Datei `a](https://x.example)![b.png` heißt
- **THEN** erscheint der Name als Text im Linktext, und die Beschreibung enthält
  keinen Link, den der Name selbst geöffnet hat

### Requirement: Dateien werden im selben Aufruf übernommen, und ein Fehlschlag verhindert das Issue nicht

Die Function SHALL jede Datei aus `openaiFileIdRefs` noch im selben Aufruf von
ihrem `download_link` laden und per Linear-`fileUpload` ablegen, weil die Links
nach fünf Minuten verfallen. Es SHALL höchstens 10 Dateien geben, mit den Typen
`image/png`, `image/jpeg`, `image/webp`, `image/gif`, `video/mp4` und
`video/quicktime` und höchstens 25 MB je Datei. Geladen wird nur über `https`
von einem Host aus einer festen Liste (`files.oaiusercontent.com`), ohne
Weiterleitungen zu folgen. Der erklärte `mime_type` MUST zur Dateisignatur der
geladenen Bytes passen.

Ein Eintrag, der ein String statt eines Objekts ist, keinen `download_link`
hat, auf einen nicht erlaubten Host zeigt, weiterleitet, einen unzulässigen oder
nicht zur Signatur passenden Typ trägt, zu groß ist oder nicht geladen oder
hochgeladen werden kann, MUST mit Namen und Grund als nicht übertragen vermerkt
werden. Hat der Eintrag keinen Namen, wird der String selbst oder „Datei {n}"
genannt. Das Issue MUST trotzdem angelegt werden.

Jede Datei SHALL höchstens 12 Sekunden und die Dateiarbeit eines Aufrufs
insgesamt höchstens 25 Sekunden brauchen. Laufende Anfragen MUST bei Ablauf
abgebrochen werden, und was bis dahin nicht übernommen ist, MUST mit dem Grund
„Zeit überschritten" vermerkt werden.

#### Scenario: Link ist abgelaufen

- **WHEN** ein `download_link` mit 403 antwortet
- **THEN** wird das Issue angelegt
- **AND** der Abschnitt „Bilder" nennt die Datei und den Grund „nicht mehr
  abrufbar"

#### Scenario: Eintrag ist ein bloßer String

- **WHEN** `openaiFileIdRefs` den String `file-abc123` enthält
- **THEN** wird er unter dem Namen `file-abc123` als nicht übertragen
  vermerkt, und die Function wirft nicht

#### Scenario: Fremder Host oder Weiterleitung

- **WHEN** ein `download_link` auf einen anderen Host zeigt oder mit einer
  Weiterleitung antwortet
- **THEN** wird ihr nicht gefolgt, und die Datei wird mit dem Grund und dem
  Zielhost vermerkt

#### Scenario: Datei über der Grenze

- **WHEN** eine Datei größer als 25 MB ist
- **THEN** wird sie nicht vollständig in den Speicher geladen, nicht hochgeladen
  und mit dem Grund „zu groß" vermerkt

#### Scenario: Erklärter Typ passt nicht zum Inhalt

- **WHEN** ein Eintrag `image/png` erklärt, die Bytes aber kein PNG sind
- **THEN** wird die Datei mit dem Grund „Inhalt passt nicht zum Typ" vermerkt

#### Scenario: Langsame Datei

- **WHEN** die erste Datei nach 12 Sekunden noch lädt
- **THEN** wird ihr Download abgebrochen und vermerkt, und die nächste Datei
  wird geladen

#### Scenario: Elf Dateien

- **WHEN** `openaiFileIdRefs` 11 Einträge hat
- **THEN** kommt 400 mit einem Satz, der die Grenze von zehn Dateien nennt

### Requirement: Der Einreicher bekommt eine Nummer, keine Adresse

Nach erfolgreichem Anlegen SHALL die Function mit 201 und
`{ nummer, hinweis }` antworten, wobei `nummer` der Linear-Bezeichner ist (z. B.
`AGE-901`) und `hinweis` ein deutscher Satz zum weiteren Verlauf. Die Antwort
MUST keine URL enthalten. Liefert `issueCreate` einen Fehler, ist Linear nicht
erreichbar oder läuft die Frist von 8 Sekunden ab, MUST die Function mit 502
antworten. `fehler` MUST dann sagen, dass die Übergabe nicht bestätigt ist, und
nicht behaupten, dass nichts angekommen ist.

#### Scenario: Angelegt

- **WHEN** Linear das Issue anlegt
- **THEN** kommt 201 mit `nummer` und `hinweis`, und keine der beiden enthält
  `linear.app`

#### Scenario: Linear antwortet nicht oder lehnt ab

- **WHEN** `issueCreate` einen Fehler liefert oder nicht rechtzeitig antwortet
- **THEN** kommt 502 mit einem Satz, der sagt, dass die Übergabe nicht bestätigt
  werden konnte

### Requirement: Der Eingang ist gedrosselt

Die Function SHALL vor dem ersten Download prüfen, wie viele Issues sie in den
letzten 60 Minuten angelegt hat, gezählt über alle Aufrufer. Sind es 20 oder
mehr, MUST sie mit 429 enden, bevor eine Datei geladen oder Linear aufgerufen
wird. Gezählt wird nur ein Issue, das Linear bestätigt hat; Aufrufe, die mit
400, 401, 429 oder 502 enden, und Probeläufe zählen nicht. Parallele Aufrufe
können die Grenze um die Zahl der gleichzeitig laufenden überschreiten; das ist
hingenommen. Gezählt wird in einer eigenen Tabelle ohne personenbezogene Daten,
die nur `service_role` über `SECURITY DEFINER`-Funktionen erreicht, mit RLS ohne
Policy. Einträge außerhalb des Fensters MUST beim Vermerken entfernt werden.

#### Scenario: Einundzwanzigste Anforderung in einer Stunde

- **WHEN** in den letzten 60 Minuten 20 Issues angelegt wurden und eine weitere
  gültige Anforderung eintrifft
- **THEN** kommt 429, und es wird nichts angelegt

#### Scenario: Gescheiterte Aufrufe zählen nicht

- **WHEN** ein Aufruf mit 400, 401, 429 oder 502 endet
- **THEN** erhöht er den Zähler nicht

### Requirement: Ein Probelauf legt nichts an und sagt das

Ist das Secret `ANFORDERUNG_PROBELAUF` auf `1` gesetzt, SHALL die Function
Schlüssel, Rumpf, Drossel und Datei-Downloads wie im Ernstfall prüfen, aber
weder `fileUpload` noch `issueCreate` aufrufen und den Zähler nicht erhöhen. Sie
MUST mit 200 und `{ probelauf: true, hinweis }` antworten, ohne `nummer`, und
`hinweis` MUST sagen, dass nichts angelegt wurde. Ins Log gehen je Datei nur Typ,
Größe und Ergebnis, nie Beschreibungstext, Dateinamen oder Links.

#### Scenario: Probelauf gegen DEV

- **WHEN** `ANFORDERUNG_PROBELAUF=1` gesetzt ist und eine gültige Anforderung
  mit einem Bild eintrifft
- **THEN** wird das Bild geladen, Linear aber nicht aufgerufen
- **AND** die Antwort ist 200, trägt keine `nummer` und nennt den Probelauf im
  `hinweis`

### Requirement: Das Log trägt keine Inhalte

Die Function SHALL weder den Schlüssel noch `beschreibung`, `titel`,
`einreicher`, Dateinamen, Dateiinhalte oder Download-Links ins Log schreiben.
Erlaubt sind Status, Art, Anzahl und Größen der Dateien, Gründe für
Fehlschläge, Hosts und die Linear-Nummer.

#### Scenario: Erfolgreiche Anforderung

- **WHEN** eine Anforderung mit Screenshot angelegt wird
- **THEN** enthält der Logeintrag die Nummer und Typ und Größe der Datei, aber
  weder Text noch Namen noch Link
