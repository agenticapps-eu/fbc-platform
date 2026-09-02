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

### Requirement: Eine Kaltanfrage hängt nicht am Alter des Empfängers

Das System SHALL die Erlaubnis, eine Kontaktanfrage einzufügen, **nicht** vom
Registrierungsdatum des Empfängers abhängig machen. Ein Mitglied, das nach der
Staffelung senden darf, SHALL auch an ein frisch registriertes Konto senden
dürfen, mit oder ohne `match_id`.

Das Prädikat `is_new_member(uuid)` SHALL nach dieser Änderung **nicht mehr
existieren**. Es hatte genau einen lebenden Aufrufer — die entfallende
Welpenschutz-Klausel — und ein Prädikat ohne Aufrufer ist eine Einladung, es
später falsch wieder anzuschliessen.

Was den Schutz übernimmt, SHALL die Staffelung selbst sein: ein `basic`-Konto
darf gar nicht senden, ein `connect`-Konto nur an `connect`. Sie fragt, **wer
sendet**, statt wer empfängt.

#### Scenario: Kaltanfrage an ein frisch registriertes Konto geht durch

- **WHEN** ein sendeberechtigtes Mitglied eine Anfrage **ohne** `match_id` an
  einen Empfänger sendet, der sich am selben Tag registriert hat
- **THEN** lässt die Policy das INSERT zu

#### Scenario: Auch bei geschlossenem Schalter zählt nur die Stufe

- **WHEN** `open_contact` false ist und ein Mitglied ab Rang 3 dieselbe Anfrage
  an dasselbe frische Konto sendet
- **THEN** lässt die Policy das INSERT zu — es entscheidet die Staffelung, nicht
  das Alter des Empfängers

#### Scenario: Das Prädikat ist fort

- **WHEN** `public.is_new_member(uuid)` aufgerufen wird
- **THEN** existiert die Funktion nicht

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

**Der Welpenschutz kehrt nicht wieder.** Diese Anforderung war seine einzige
Fundstelle in den Specs; mit ihr endet die Zusage aus §2 des Stufenmodells,
neue Mitglieder seien 30 Tage lang nur über eine Übereinstimmung erreichbar.
Das ist eine Produktentscheidung vom 02.09.2026, keine Auslassung — sie steht
ausgeschrieben in „Eine Kaltanfrage hängt nicht am Alter des Empfängers".

**Kein Bruch beim Ausrollen**: Wer heute eine Kaltanfrage senden darf, darf es
nach der Migration weiterhin. `open_contact` steht auf `true` und hebt die
Staffelung auf; der Welpenschutz, der heute ohnehin nicht greift, ist danach
fort. Die Ablösung lockert, sie verschärft nichts.
