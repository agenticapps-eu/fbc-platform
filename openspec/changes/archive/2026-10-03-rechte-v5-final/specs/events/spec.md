## ADDED Requirements

### Requirement: Ein Event anzulegen verlangt das Recht dazu

Das System SHALL einen INSERT in `public.events` nur zulassen, wenn der Aufrufer
das Recht `events.erstellen` trägt (`min_rank = 6`, IMPACT) und selbst Host der
neuen Zeile ist. Die Schwelle SHALL in `public.berechtigungen` stehen, nicht im
Policy-Rumpf.

**Was heute gilt und hier endet.** `events_write_host` ist eine `ALL`-Policy und
prüft ausschliesslich `is_activated()` und `host_id = auth.uid()`. **Jedes
aktivierte Konto** kann damit Events anlegen — auf jeder Stufe, auch unterhalb
des Clubs. Detlevs SPEC 01 (V5 FINAL) führt „eigene Events erstellen" als Recht
allein für IMPACT; die Checkliste A8 führt es als go-live-kritisch.

**Bestehende Hosts verlieren ihre Events nicht.** UPDATE und DELETE eigener
Zeilen SHALL unverändert ohne das Recht möglich bleiben. Begründung: ein Host,
dessen Stufe sinkt, muss seinen Termin absagen, berichtigen und seine Anmeldungen
betreuen können. Nur das **Anlegen** fällt. Gemessen auf PROD am 03.10.2026:
alle 7 Events gehören einem Host auf Rang 6 — es verwaist nichts.

Die Teilnahme SHALL davon unberührt bleiben: sie liegt bei der Clubschwelle
(`has_level(4)`) und ist kein Recht aus `berechtigungen`.

#### Scenario: Ein IMPACT-Konto legt ein Event an

- **GIVEN** ein aktiviertes Mitglied, das `events.erstellen` trägt
- **WHEN** es ein Event mit sich selbst als Host anlegt
- **THEN** gelingt der INSERT

#### Scenario: Ein DISCOVER-Konto legt keines an

- **GIVEN** ein aktiviertes Mitglied auf Rang 4
- **WHEN** es ein Event mit sich selbst als Host anlegen will
- **THEN** wird der INSERT abgelehnt — und zwar von der Datenbank, nicht erst
  von der Oberfläche

#### Scenario: Ein FOCUS-Konto legt keines an

- **GIVEN** ein aktiviertes Mitglied auf Rang 5
- **WHEN** es dasselbe versucht
- **THEN** wird der INSERT abgelehnt

#### Scenario: Ein abgestiegener Host betreut seinen Termin weiter

- **GIVEN** ein Host mit einem bestehenden Event, dessen Stufe anschliessend auf
  Rang 4 gesetzt wird
- **WHEN** er dieses Event ändert oder absagt
- **THEN** gelingt beides

#### Scenario: Die Teilnahme bleibt an der Clubschwelle

- **GIVEN** ein aktiviertes Mitglied auf Rang 4
- **WHEN** es sich zu einem Event mit Sichtbarkeit `members` anmeldet
- **THEN** gelingt die Anmeldung

#### Scenario: Der Knopf verspricht nichts, was die Datenbank ablehnt

- **WHEN** ein Mitglied ohne `events.erstellen` die Eventliste öffnet
- **THEN** erscheint kein „Event anlegen" und kein Formular dafür

### Requirement: Eine Vorlage folgt dem Event, das sie erzeugt

Das System SHALL einen INSERT in `public.event_vorlagen` an dasselbe Recht
binden wie das Event selbst: `events.erstellen` (`min_rank = 6`). UPDATE, DELETE
und SELECT eigener Vorlagen SHALL unverändert beim Eigentum bleiben.

**Der Grund ist eine Kette, kein Prinzip.** `event_serie_erzeugen` ist
`SECURITY INVOKER` und legt die Termine als **Aufrufer** an. Ein Konto ohne
`events.erstellen` könnte also eine Vorlage anlegen, eine Wiederholungsregel
pflegen — und beim Erzeugen an der RLS scheitern. Das wäre eine Fläche, die auf
halbem Weg endet, und der Fehler erschiene erst nach der Arbeit.

Die abgelöste Policy `vorlagen_write_host` SHALL nicht mehr existieren; ihr
Kommentar nannte ausdrücklich, dass „Rechte wie bei Events" damals „aktiviert
und eigene Zeile" bedeute — und dieser Satz ist mit der neuen Insert-Schwelle
falsch geworden.

#### Scenario: Ein IMPACT-Konto legt eine Vorlage an

- **GIVEN** ein aktiviertes Mitglied, das `events.erstellen` trägt
- **WHEN** es eine Vorlage mit sich selbst als Host anlegt
- **THEN** gelingt der INSERT

#### Scenario: Ein DISCOVER-Konto legt keine an

- **GIVEN** ein aktiviertes Mitglied auf Rang 4
- **WHEN** es dasselbe versucht
- **THEN** wird der INSERT abgelehnt

#### Scenario: Ein abgestiegener Host pflegt seine Vorlage weiter

- **GIVEN** ein Host mit einer bestehenden Vorlage, dessen Stufe anschliessend
  auf Rang 4 gesetzt wird
- **WHEN** er sie berichtigt
- **THEN** gelingt es, und die Änderung steht in der Zeile

#### Scenario: Eine fremde Vorlage bleibt unsichtbar

- **WHEN** ein beliebiges aktiviertes Mitglied die Vorlage eines anderen Hosts
  liest
- **THEN** kommt keine Zeile zurück — das SELECT ist unverändert eng
