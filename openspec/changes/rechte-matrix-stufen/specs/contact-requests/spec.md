## ADDED Requirements

### Requirement: Kontaktanfragen sind nach Absender- und Empfängerstufe gestaffelt

Das System SHALL die Erlaubnis, eine Kontaktanfrage einzufügen, aus **beiden**
Stufen ableiten — der des Absenders und der des Empfängers:

- Ein Absender mit Rang 1 (`basic`) SHALL **keine** Kontaktanfrage senden
  dürfen.
- Ein Absender mit Rang 2 (`connect`) SHALL nur an einen Empfänger mit **genau**
  Rang 2 senden dürfen. „`connect` und darüber" ist ausdrücklich **nicht**
  gemeint; die Auslegung ist am 25.08.2026 entschieden worden, samt der
  benannten Folge, dass ein `connect`-Mitglied bei heutigem Bestand niemanden
  erreicht.
- Ein Absender ab Rang 3 (`discover`) SHALL an jeden Empfänger senden dürfen.

Die Regel SHALL in einem benannten Prädikat stehen, nicht als Bedingungskette in
der Policy, und SHALL die Empfängerstufe mit den Rechten der Funktion lesen
(`SECURITY DEFINER`, `search_path` leer, `execute` nur für `authenticated`).
Ohne erhöhte Rechte fiele die Prüfung für einen Absender unterhalb Rang 3 still
auf „kein Recht" und verböte **jede** Anfrage — derselbe Grund, aus dem
`is_new_member` bereits DEFINER ist.

Der Admin-Schalter `platform_settings.open_contact` SHALL diese Staffelung —
und nur sie — aufheben können, solange er `true` ist. Nur `is_admin()`-Mitglieder
SHALL den Schalter schreiben dürfen.

Unabhängig vom Schalter und in **jedem** Modus SHALL weiterhin gelten: der
Absender SHALL sich selbst als `from_id` eintragen, der Status SHALL `pending`
sein, ein mitgegebenes `match_id` SHALL dem Paar gehören, und das Opt-out des
Empfängers (`is_contactable`) SHALL greifen.

#### Scenario: Ein basic-Konto darf nicht senden

- **WHEN** `open_contact` false ist und ein Mitglied mit Rang 1 (`basic`) eine
  Anfrage an einen kontaktierbaren Empfänger einfügt
- **THEN** wird das INSERT abgelehnt (SQLSTATE 42501), und die Oberfläche nennt
  die Stufe als Grund statt den rohen Postgres-Fehler zu zeigen

#### Scenario: Ein connect-Konto erreicht ein anderes connect-Konto

- **WHEN** `open_contact` false ist und ein Mitglied mit Rang 2 an einen
  Empfänger mit Rang 2 sendet
- **THEN** lässt die Policy das INSERT zu

#### Scenario: Ein connect-Konto erreicht ein impact-Konto nicht

- **WHEN** `open_contact` false ist und dasselbe Mitglied an einen Empfänger mit
  Rang 6 (`impact`) sendet
- **THEN** wird das INSERT abgelehnt — die Zielstufe ist nicht genau `connect`

#### Scenario: Ab discover ist jeder Empfänger erreichbar

- **WHEN** `open_contact` false ist und ein Mitglied ab Rang 3 an einen
  Empfänger beliebiger Stufe sendet
- **THEN** lässt die Staffelung das INSERT zu

#### Scenario: Der Schalter hebt die Staffelung auf

- **WHEN** `open_contact` true ist und ein `basic`-Mitglied an einen
  kontaktierbaren Empfänger sendet
- **THEN** lässt die Staffelungsklausel das INSERT zu

#### Scenario: Der Schalter hebt die übrigen Prüfungen nicht auf

- **WHEN** `open_contact` true ist und ein Mitglied eine Anfrage mit fremdem
  `from_id`, mit Status `accepted` oder an ein Konto mit gesetztem Opt-out
  einfügt
- **THEN** wird das INSERT abgelehnt

#### Scenario: Nur Admins schreiben den Schalter

- **WHEN** ein Mitglied ohne `is_admin()` `platform_settings.open_contact`
  aktualisiert
- **THEN** verweigert die Policy `platform_settings_update_admin` den Schreibzugriff

### Requirement: Der Welpenschutz hat einen eigenen Schalter

Das System SHALL den 30-Tage-Welpenschutz über eine **eigene** Einstellung
`platform_settings.welpenschutz_aktiv` steuern, mit demselben
`is_admin()`-Schreibrecht wie `open_contact`. Solange sie `true` ist, SHALL
eine Kaltanfrage — eine Anfrage ohne `match_id` — an ein Mitglied, das sich
innerhalb der letzten 30 Tage registriert hat (`is_new_member`), abgelehnt
werden.

`platform_settings.open_contact` SHALL diese Regel **nicht** mehr beeinflussen,
und `welpenschutz_aktiv` SHALL die Staffelung nicht beeinflussen. Zwei Regeln,
zwei Schalter — das ist der Zweck dieser Änderung.

**Die Vorgabe SHALL `false` sein.** Sie bildet den heutigen *wirksamen* Zustand
ab: `open_contact` steht seit dem 05.08.2026 auf `true` und hebt den
Welpenschutz damit faktisch auf. Eine Vorgabe `true` stellte ihn beim Ausrollen
scharf, **ohne dass ein Mensch etwas entscheidet** — ein Mitglied, das heute ein
neues Konto anschreiben kann, könnte es danach nicht mehr. Diese Vorgabe erfüllt
die Zusage aus §2 des Stufenmodells damit **nicht**; sie erfüllt statt dessen
die Zusage, dass eine Migration nichts umlegt, was ein Mensch umlegen sollte.
Beides SHALL ausgesprochen bleiben, damit die Lücke nicht für ein Versehen
gehalten wird.

Der Fluchtweg SHALL eine bestehende Übereinstimmung bleiben. Er ist tragfähig
und nicht bloß theoretisch: Übereinstimmungen entstehen weiterhin beim Speichern
von Kompass, Profil und Biete/Suche, und die Kontaktbeziehung reicht ein
vorhandenes `match_id` beim Senden von sich aus mit — ohne dass eine
Matching-Oberfläche existiert.

#### Scenario: Die Vorgabe ändert beim Ausrollen nichts

- **WHEN** die Migration angewandt wurde und niemand eine Einstellung geändert
  hat, und ein Mitglied eine Kaltanfrage an ein Konto jünger als 30 Tage sendet
- **THEN** wird das INSERT zugelassen — genau wie vor der Migration

#### Scenario: Eingeschaltet lehnt der Welpenschutz die Kaltanfrage ab

- **WHEN** `welpenschutz_aktiv` true ist und ein Mitglied eine Anfrage ohne
  `match_id` an einen Empfänger sendet, der sich vor weniger als 30 Tagen
  registriert hat
- **THEN** wird das INSERT von der Welpenschutz-Klausel abgelehnt

#### Scenario: Der offene Kontakt-Schalter rettet die Kaltanfrage nicht

- **WHEN** `welpenschutz_aktiv` true und `open_contact` **ebenfalls true** ist
  und dieselbe Kaltanfrage gesendet wird
- **THEN** wird das INSERT weiterhin abgelehnt — `open_contact` wirkt nur noch
  auf die Staffelung

#### Scenario: Mit Übereinstimmung geht dieselbe Anfrage durch

- **WHEN** `welpenschutz_aktiv` true ist und dasselbe Mitglied dieselbe Anfrage
  mit einem `match_id` sendet, das dem Paar gehört
- **THEN** lässt die Welpenschutz-Klausel das INSERT zu

#### Scenario: Nach 30 Tagen entfällt der Schutz

- **WHEN** `welpenschutz_aktiv` true ist und eine Kaltanfrage an einen Empfänger
  geht, der sich vor mehr als 30 Tagen registriert hat
- **THEN** lässt die Welpenschutz-Klausel das INSERT zu

#### Scenario: Nur Admins schreiben den neuen Schalter

- **WHEN** ein Mitglied ohne `is_admin()` `platform_settings.welpenschutz_aktiv`
  aktualisiert
- **THEN** verweigert die Policy den Schreibzugriff

## REMOVED Requirements

### Requirement: Cold-request gates open under the admin toggle

**Reason**: Die Anforderung band **zwei** Regeln an **einen** Schalter — das
Level-Gate (`exchange`, Rang 4) und den 30-Tage-Welpenschutz. Genau diese
Kopplung machte die Stufenstaffelung unauslieferbar: `open_contact` abzuschalten
hätte beide zugleich scharf gestellt, und es gab keinen Weg, das eine ohne das
andere zu haben. Ausserdem nannte sie mit `exchange` eine flache Schwelle, die
die gestaffelte Regel ersetzt.

**Migration**: Ersetzt durch die beiden ADDED-Anforderungen oben. Die vier
Zusagen, die in dieser Anforderung **wahr geblieben** sind, gehen dabei nicht
verloren, sondern wandern ausdrücklich in „Kontaktanfragen sind nach Absender-
und Empfängerstufe gestaffelt": Selbst-`from_id`, Status `pending`,
Paarbindung des `match_id` und das Opt-out des Empfängers gelten weiterhin in
jedem Modus, und der Schalter bleibt `is_admin()`-schreibbar. Was entfällt, ist
allein die Formulierung „both the level gate and the Welpenschutz SHALL be
lifted" und die Nennung von `exchange`.

**Kein Bruch beim Ausrollen**: Wer heute eine Kaltanfrage senden darf, darf es
nach der Migration weiterhin — `open_contact` steht auf `true` und hebt die
Staffelung auf, `welpenschutz_aktiv` steht per Vorgabe auf `false`. Die
Ablösung verschiebt die Regeln, sie stellt keine scharf.
