## ADDED Requirements

### Requirement: Nur wer das geteilte Geheimnis trägt, darf einreichen

Die Edge Function `anforderung-eingang` SHALL jeden Aufruf ablehnen, dessen
Header `x-anforderung-schluessel` fehlt oder nicht byte-genau dem Secret
`ANFORDERUNG_SCHLUESSEL` entspricht. Der Vergleich MUST in konstanter Zeit
erfolgen. Die Function MUST in `supabase/config.toml` mit `verify_jwt = false`
stehen, weil die ChatGPT-Action kein Supabase-JWT trägt. Ein abgelehnter Aufruf
MUST vor jedem Zugriff auf Linear, auf Dateilinks und auf die Datenbank enden.

#### Scenario: Richtiger Schlüssel

- **WHEN** ein POST mit gültigem Rumpf und korrektem `x-anforderung-schluessel`
  eintrifft
- **THEN** wird die Anforderung verarbeitet

#### Scenario: Fehlender oder falscher Schlüssel

- **WHEN** der Header fehlt, leer ist oder einen anderen Wert trägt
- **THEN** antwortet die Function mit 401
- **AND** es wird weder Linear aufgerufen noch eine Datei geladen

#### Scenario: Secret nicht gesetzt

- **WHEN** `ANFORDERUNG_SCHLUESSEL` oder `LINEAR_API_KEY` in der Umgebung fehlt
- **THEN** antwortet die Function mit 500 und legt nichts an
- **AND** ein leerer Header gilt nie als Übereinstimmung mit einem leeren Secret

### Requirement: Eine Anforderung trägt vier Pflichtfelder, serverseitig geprüft

Die Function SHALL `titel` (1–200 Zeichen nach Trimmen), `beschreibung`
(1–8000), `art` (genau einer von `fehler`, `aenderung`, `funktion`, `idee`) und
`einreicher` (1–120) verlangen. `route` ist optional (höchstens 200 Zeichen).
Verletzt der Rumpf eine dieser Regeln oder ist er kein JSON-Objekt, MUST die
Function mit 400 und `{ fehler }` antworten. `fehler` MUST ein ganzer deutscher
Satz sein, der benennt, was fehlt oder unzulässig ist, damit der GPT ihn
vorlesen kann. Bei 400 MUST nichts angelegt werden.

#### Scenario: Pflichtfeld fehlt

- **WHEN** `art` im Rumpf fehlt
- **THEN** kommt 400 mit einem Satz, der die Art als fehlend benennt
- **AND** Linear wird nicht aufgerufen

#### Scenario: Unzulässige Art

- **WHEN** `art` den Wert `wunsch` trägt
- **THEN** kommt 400 mit einem Satz, der die vier zulässigen Arten in normalen
  Worten nennt

#### Scenario: Zu langer Titel

- **WHEN** `titel` länger als 200 Zeichen ist
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
schließt.

#### Scenario: Zweimal dieselbe Anforderung

- **WHEN** derselbe Rumpf zweimal eingereicht wird
- **THEN** entstehen zwei Issues. Doppelte führt Donald in der Triage zusammen.

### Requirement: Die Beschreibung im Issue hat eine feste Gliederung

Die Beschreibung des Issues SHALL in dieser Reihenfolge bestehen aus: dem Text
aus `beschreibung` unverändert; einem Abschnitt „Bilder" mit allen übernommenen
Dateien (Bilder eingebettet als `![name](assetUrl)`, Videos als
`[name](assetUrl)`) und allen nicht übernommenen Dateien mit Namen und Grund;
einer Fußzeile „Eingereicht von {einreicher} über ChatGPT · {Datum in
Europe/Berlin} · Route: {route oder „unklar"}". Der Abschnitt „Bilder" MUST
entfallen, wenn keine Datei mitkam. Der Issue-Titel SHALL `titel` unverändert
sein.

#### Scenario: Anforderung ohne Dateien und ohne Route

- **WHEN** eine gültige Anforderung ohne `openaiFileIdRefs` und ohne `route`
  eintrifft
- **THEN** besteht die Beschreibung aus dem Text und der Fußzeile mit
  „Route: unklar", ohne Abschnitt „Bilder"

#### Scenario: Screenshot und Bildschirmaufnahme

- **WHEN** ein PNG und ein MP4 mitkommen und beide übernommen werden
- **THEN** steht das PNG als eingebettetes Bild und das MP4 als Link im
  Abschnitt „Bilder"

### Requirement: Dateien werden im selben Aufruf übernommen, und ein Fehlschlag verhindert das Issue nicht

Die Function SHALL jede Datei aus `openaiFileIdRefs` noch im selben Aufruf von
ihrem `download_link` laden und per Linear-`fileUpload` ablegen, weil die Links
nach fünf Minuten verfallen. Es SHALL höchstens 10 Dateien geben, mit den Typen
`image/png`, `image/jpeg`, `image/webp`, `image/gif`, `video/mp4` und
`video/quicktime` und höchstens 25 MB je Datei. Ein Eintrag, der ein String statt
eines Objekts ist, keinen `download_link` hat, einen unzulässigen Typ trägt, zu
groß ist oder nicht geladen oder hochgeladen werden kann, MUST mit Namen (sofern
vorhanden) und Grund als nicht übertragen vermerkt werden. Das Issue MUST
trotzdem angelegt werden. Mehr als 10 Einträge MUST mit 400 abgelehnt werden.

#### Scenario: Link ist abgelaufen

- **WHEN** ein `download_link` mit 403 antwortet
- **THEN** wird das Issue angelegt
- **AND** der Abschnitt „Bilder" nennt die Datei und den Grund „nicht mehr
  abrufbar"

#### Scenario: Eintrag ist ein bloßer String

- **WHEN** `openaiFileIdRefs` den String `file-abc123` enthält
- **THEN** wird er als nicht übertragen vermerkt, und die Function wirft nicht

#### Scenario: Datei über der Grenze

- **WHEN** eine Datei größer als 25 MB ist
- **THEN** wird sie nicht vollständig in den Speicher geladen, nicht hochgeladen
  und mit dem Grund „zu groß" vermerkt

#### Scenario: Elf Dateien

- **WHEN** `openaiFileIdRefs` 11 Einträge hat
- **THEN** kommt 400 mit einem Satz, der die Grenze von zehn Dateien nennt

### Requirement: Der Einreicher bekommt eine Nummer, keine Adresse

Nach erfolgreichem Anlegen SHALL die Function mit 201 und
`{ nummer, hinweis }` antworten, wobei `nummer` der Linear-Bezeichner ist (z. B.
`AGE-901`) und `hinweis` ein deutscher Satz zum weiteren Verlauf. Die Antwort
MUST keine URL enthalten. Scheitert `issueCreate`, MUST die Function mit 502 und
`{ fehler }` in einem ganzen deutschen Satz antworten.

#### Scenario: Angelegt

- **WHEN** Linear das Issue anlegt
- **THEN** kommt 201 mit `nummer` und `hinweis`, und keine der beiden enthält
  `linear.app`

#### Scenario: Linear lehnt ab

- **WHEN** `issueCreate` einen Fehler liefert oder nicht erreichbar ist
- **THEN** kommt 502 mit einem Satz, der sagt, dass die Anforderung nicht
  angekommen ist

### Requirement: Der Eingang ist gedrosselt

Die Function SHALL höchstens 20 angenommene Anforderungen in 60 Minuten
verarbeiten, gezählt über alle Aufrufer. Der erste Aufruf darüber MUST mit 429
enden, bevor eine Datei geladen oder Linear aufgerufen wird. Gezählt wird in
einer eigenen Tabelle, die nur `service_role` über eine
`SECURITY DEFINER`-Funktion erreicht, mit RLS ohne Policy. Einträge außerhalb
des Fensters MUST bei jedem Aufruf entfernt werden.

#### Scenario: Einundzwanzigste Anforderung in einer Stunde

- **WHEN** innerhalb von 60 Minuten die 21. gültige Anforderung eintrifft
- **THEN** kommt 429, und es wird nichts angelegt

#### Scenario: Abgelehnte Aufrufe zählen nicht

- **WHEN** ein Aufruf mit 401 oder 400 endet
- **THEN** erhöht er den Zähler nicht

### Requirement: Ein Probelauf legt nichts an und sagt das

Ist das Secret `ANFORDERUNG_PROBELAUF` auf `1` gesetzt, SHALL die Function
Schlüssel, Rumpf, Drossel und Datei-Downloads wie im Ernstfall prüfen, aber
weder `fileUpload` noch `issueCreate` aufrufen. Sie MUST mit 201 antworten, und
`hinweis` MUST ausdrücklich sagen, dass es ein Probelauf war und nichts angelegt
wurde. Die Beschreibung, die angelegt worden wäre, MUST im Log stehen.

#### Scenario: Probelauf gegen DEV

- **WHEN** `ANFORDERUNG_PROBELAUF=1` gesetzt ist und eine gültige Anforderung
  mit einem Bild eintrifft
- **THEN** wird das Bild geladen, Linear aber nicht aufgerufen
- **AND** die Antwort nennt den Probelauf im `hinweis`
