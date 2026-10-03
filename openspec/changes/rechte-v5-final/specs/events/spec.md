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
