## MODIFIED Requirements

### Requirement: Eine Session allein gibt keine Mitgliederdaten frei

Das System SHALL jeden Zugriff auf **fremde** Mitgliederdaten zusätzlich davon
abhängig machen, dass das aufrufende Konto **zugangsberechtigt** ist.
Zugangsberechtigt ist ein Konto genau dann, wenn `profiles.activated_at` gesetzt
und **weder `profiles.disabled_at` noch `profiles.deleted_at` gesetzt** ist.
Diese drei Felder SHALL zusammen die einzige Wahrheit für diese Entscheidung
sein.

**Geändert mit AGE-581.** Zuvor stand `activated_at` allein. Es beantwortet
aber nur, ob jemand je hereingekommen ist — nicht, ob er noch hereinkommen darf.
Ein Verein, der niemanden ausschliessen kann, hat kein Gate, sondern eine
Einbahnstrasse.

Die drei Felder SHALL an **derselben** Stelle geprüft werden und SHALL NOT auf
verschiedene Prädikate verteilt werden. Eine Bedingung, die an einer Stelle zwei
und an einer anderen drei Felder prüft, ist keine Bedingung, sondern zwei.

Die Prüfung SHALL in der Datenbank stattfinden, nicht im Client. Ein Konto mit
gültiger Session, das sich mit einem eigenen Datenbank-Client anmeldet und die
Tabellen unmittelbar abfragt, SHALL keine fremden Mitgliederdaten erhalten.

Weil ein solches Konto die volle Mitgliedsstufe tragen kann, SHALL sich das Gate
nicht darauf verlassen, dass eine Stufenprüfung dahinter noch greift. Es SHALL
deshalb an **jeder** Stelle gesetzt sein, über die fremde Mitgliederdaten das
System verlassen:

- in den Policies der betroffenen Tabellen,
- im Rumpf jeder Sicht, die mit den Rechten ihres Eigentümers läuft und die
  Policies der Basistabelle damit umgeht,
- im Rumpf jeder privilegierten Funktion, die ihr Sichtbarkeitsprädikat selbst
  führt statt sich auf die Policies zu verlassen.

Das Gate SHALL **beide Seiten** prüfen. Ein Profil SHALL im Verzeichnis erst
erscheinen, wenn **sein Inhaber** bestätigt hat — nicht erst, wenn der Abfragende
bestätigt hat. Andernfalls sähen bereits bestätigte Mitglieder genau die Profile,
deren Inhaber sich nie ausgewiesen haben, und die Zusage an das Mitglied, sein
Profil sei bis zur Bestätigung für kein anderes Mitglied sichtbar, wäre unwahr.

Für Inhalte — Beiträge, Veranstaltungen, Kommentare und die zugehörigen
Interaktionen — SHALL diese zweite Prüfung entfallen: sie können keinen
unbestätigten Urheber haben, weil die schreibenden Zugriffe bereits gegatet sind.

Das Gate SHALL **auch die Daten des angemeldeten Kontos selbst** umfassen —
Kontaktdaten, Ziele, Benachrichtigungen, Einstellungen und das eigene Profil.
Wer sich mit einem weitergegebenen Passwort anmeldet, ist gegenüber der
Datenbank nicht ein Fremder, sondern **das Mitglied**; „eigene Daten" sind in
diesem Fall die Daten des Bestohlenen. Eine Ausnahme für den eigenen Datensatz
wäre deshalb keine Ausnahme, sondern die Lücke.

Maßgeblich ist die **Datenklasse, nicht eine Anzahl**. Unter das Gate SHALL
jede privilegierte Funktion fallen, die Mitgliederdaten **liefert oder
verändert** — Profil-, Kontakt-, Inhalts-, Teilnahme- oder Stufendaten, eigene
wie fremde. Nicht darunter SHALL fallen: Funktionen, die ausschließlich den
**Stand des Aufrufers gegenüber der Plattform** zurückgeben (seine Stufe, seine
Rolle, sein Aktivierungszustand), Funktionen über plattformweite Merker, sowie
Funktionen, die keiner API-Rolle zum Aufruf offenstehen. Sie tragen kein
Mitgliederdatum und brauchen das Gate nicht; eine Anzahl ungegateter Funktionen
zu nennen wäre irreführend, weil sie mit jeder Trigger- oder Prädikatfunktion
wächst, ohne dass sich die Fläche ändert.

Damit die Oberfläche, die zur Aktivierung führt, sich anzeigen **und ihren Link
anfordern** kann, SHALL das Gate **innerhalb dieser Datenklasse** für genau
zwei Funktionen ausgenommen sein und für keine weitere:

- eine, die ausschließlich zurückgibt, ob das aufrufende Konto aktiviert ist,
  **ob ihm der Zugang entzogen wurde**, sowie einen Anzeigenamen für die Anrede;
- eine, die dem **aufrufenden** Konto einen Aktivierungslink ausstellt.

Beide SHALL ihr Subjekt aus der Sitzung nehmen und SHALL NOT darüber hinaus
Profil-, Kontakt- oder Stufendaten preisgeben.

**Geändert mit AGE-581: aus zwei Feldern werden drei.** Die
Zustandsauskunft trägt zusätzlich einen Wahrheitswert `blocked`, der wahr ist,
wenn das Konto deaktiviert **oder** gelöscht ist. Ohne ihn zeigte die Oberfläche
einem gesperrten Konto den Aktivierungsbildschirm und lüde es ein, sich einen
Zugangslink schicken zu lassen — für einen Zugang, den es nicht mehr gibt.

**Ein Wahrheitswert, kein Zustandswort.** Ein Feld mit den Werten
`deaktiviert`/`gelöscht` verriete dem Betroffenen, welche der beiden Handlungen
ein Admin vorgenommen hat; das geht ihn so wenig an wie einen Leser des Feeds.
`blocked` fasst beide zusammen, und die Oberfläche braucht die Unterscheidung
nicht: sie zeigt in beiden Fällen denselben Hinweis und denselben Weg — sich
abzumelden und den Verein anzuschreiben.

`activated` SHALL seine Bedeutung behalten („hat je bestätigt") und SHALL NOT
umgedeutet werden. Ein gesperrtes, zuvor bestätigtes Konto trägt also
`activated = true, blocked = true` — beide Felder sind einzeln wahr und
zusammen eindeutig.

Der Test, der die Signatur dieser Funktion **wörtlich** festhält, SHALL
mitgeändert werden. Dass er bricht, ist seine Aufgabe: er hält fest, dass jedes
weitere Feld eine Entscheidung ist und kein Versehen. Die zweite SHALL NOT eine im
Aufruf mitgegebene Adresse annehmen — sonst wäre sie ein Weg, den ausstehenden
Link eines fremden Kontos zu entwerten.

Eine Funktion, die ein einzelnes Boolean über einen dem Aufrufer **bereits
bekannten** Fremdschlüssel zurückgibt, SHALL als benannte Restfläche geführt
werden statt als Ausnahme: sie gibt nichts preis, was ein Aufzählen erlaubte,
verrät aber die Existenz eines Profils.

Zugriffe der Rolle `anon` SHALL von diesem Gate unberührt bleiben: öffentliche
Beiträge und Veranstaltungen SHALL für ausgeloggte Besucher sichtbar bleiben.
Ebenfalls unberührt SHALL das Lesen plattformweiter Einstellungen bleiben, die
kein Mitgliedsdatum tragen.

#### Scenario: Ein nicht aktiviertes Konto sieht keine fremden Profile

- **GIVEN** ein Konto mit gültiger Session, höchster Mitgliedsstufe und
  `activated_at = null`
- **WHEN** es `profiles`, die öffentliche Profilsicht, `posts`, `events`,
  `offers`, `needs` oder `matches` unmittelbar abfragt
- **THEN** liefert jede dieser Abfragen **null Zeilen**

#### Scenario: Das Gate greift auch an der Sicht vorbei nicht

- **GIVEN** dasselbe nicht aktivierte Konto
- **WHEN** es die öffentliche Profilsicht abfragt, die mit den Rechten ihres
  Eigentümers läuft und die Policies der Basistabelle nicht auswertet
- **THEN** liefert auch sie null Zeilen, weil das Gate im Rumpf der Sicht steht

#### Scenario: Privilegierte Funktionen sind kein Seitenweg

- **GIVEN** dasselbe nicht aktivierte Konto
- **WHEN** es eine Funktion aufruft, die an den Policies vorbei zählt oder
  schreibt — etwa die Zählfunktionen für Beitrags- und Veranstaltungsresonanz
  oder die Anmeldung zu einer Veranstaltung
- **THEN** liefert die Zählfunktion leer und die schreibende Funktion lehnt ab

#### Scenario: Ein unbestätigtes Profil erscheint für niemanden im Verzeichnis

- **GIVEN** ein bereits bestätigtes Mitglied und ein Profil, dessen Inhaber noch
  nicht bestätigt hat
- **WHEN** das bestätigte Mitglied das Verzeichnis abfragt
- **THEN** ist das unbestätigte Profil nicht darin enthalten — die Zusage, bis
  zur Bestätigung für kein anderes Mitglied sichtbar zu sein, hält

#### Scenario: Das Verzeichnis füllt sich mit den Bestätigungen

- **GIVEN** ein frisch angelegter Bestand, in dem nur die Bestandskonten
  bestätigt sind
- **WHEN** das erste Mitglied nach seiner Bestätigung das Verzeichnis öffnet
- **THEN** sieht es ausschließlich die bestätigten Konten. Das ist der
  beabsichtigte Zustand und SHALL NOT als Fehler behandelt werden

#### Scenario: Auch die Daten des Kontos selbst bleiben verschlossen

- **GIVEN** ein Angreifer, der sich mit einem weitergegebenen Passwort als das
  Mitglied angemeldet hat
- **WHEN** er die Kontaktdaten, Ziele, Benachrichtigungen oder Einstellungen
  **dieses** Kontos liest oder dessen Profil ändern will
- **THEN** wird jeder dieser Zugriffe verweigert — insbesondere bleiben E-Mail
  und Telefonnummer des Mitglieds unlesbar

#### Scenario: Der Aktivierungsweg bleibt darstellbar

- **GIVEN** dasselbe nicht aktivierte Konto
- **WHEN** die Oberfläche den Aktivierungszustand abfragt
- **THEN** erhält sie ausschließlich die Auskunft „nicht aktiviert" und einen
  Anzeigenamen, und nichts sonst

#### Scenario: Unter fremdem Namen veröffentlichen ist ausgeschlossen

- **GIVEN** dasselbe nicht aktivierte Konto
- **WHEN** es einen Beitrag, ein Angebot, ein Gesuch oder eine Veranstaltung
  anlegen will
- **THEN** wird das verweigert, sodass kein Inhalt unter dem echten Namen eines
  Mitglieds erscheinen kann

#### Scenario: Der ausgeloggte Besucher sieht das Schaufenster weiter

- **WHEN** ein ausgeloggter Besucher öffentliche Beiträge oder Veranstaltungen
  abruft
- **THEN** erhält er sie unverändert — das Gate gilt nur für angemeldete Konten

#### Scenario: Ein nicht aktiviertes Konto sieht weniger als ein ausgeloggter Besucher

- **GIVEN** die öffentlichen Freigaben gelten für die ausgeloggte Rolle, und ein
  angemeldetes Konto fragt nicht als diese Rolle
- **WHEN** ein nicht aktiviertes Konto öffentliche Beiträge abruft
- **THEN** erhält es keine — die Oberfläche SHALL diesen Zustand benennen und
  den Weg zum Abmelden anbieten, damit er nicht als Fehler erscheint

#### Scenario: Ein deaktiviertes Konto sieht nichts mehr

- **GIVEN** ein Konto, das bestätigt hat und danach deaktiviert wurde, mit einer
  Sitzung, die noch gültig ist
- **WHEN** es `profiles`, die öffentliche Profilsicht, `posts` oder `events`
  unmittelbar abfragt
- **THEN** liefert jede dieser Abfragen **null Zeilen** — die noch laufende
  Sitzung hilft ihm nicht, weil das Gate in der Datenbank steht

#### Scenario: Ein deaktiviertes Profil verschwindet aus dem Verzeichnis

- **GIVEN** ein bestätigtes Mitglied und ein zweites, das deaktiviert wurde
- **WHEN** das erste das Verzeichnis abfragt
- **THEN** ist das deaktivierte Profil nicht darin enthalten — geprüft über
  Policy, öffentliche Profilsicht und Verzeichnisfunktion, weil alle drei die
  Bedingung führen

#### Scenario: Ein gelöschtes Profil ebenso

- **GIVEN** dieselbe Ausgangslage mit einem gelöschten statt deaktivierten
  Mitglied
- **WHEN** das erste das Verzeichnis abfragt
- **THEN** ist auch dieses Profil nicht enthalten

#### Scenario: Die Sperre steht schon vor der Sitzung

- **GIVEN** ein deaktiviertes Konto ohne laufende Sitzung
- **WHEN** es sich mit seinem gültigen Passwort anzumelden versucht
- **THEN** weist der Auth-Dienst die Anmeldung ab, es entsteht keine Sitzung —
  das Datenbank-Gate ist die zweite Sperre, nicht die einzige


### Requirement: Helper predicates are the single authority for gating

The system SHALL centralise every authorization decision in the
server-controlled predicates `current_tier_rank()`, `has_level(int)`,
`is_activated()`, `is_matching_manager()`, and `is_admin()`, sourced from
`membership_tiers`/`profiles.tier`, `profiles.activated_at`,
`profiles.disabled_at`, `profiles.deleted_at` and `staff_roles`.

**Geändert mit AGE-581.** `is_activated()` und `is_activated_profile(uuid)`
tragen seither die vollständige Zugangsbedingung — aktiviert, nicht deaktiviert,
nicht gelöscht. Dass sie den alten Namen behalten, ist Absicht: rund vierzig
Policies rufen sie, und diese Policies einzeln umzuhängen hiesse, die Bedingung
vierzigmal neu zu schreiben und vierzig Gelegenheiten zu schaffen, sie falsch zu
schreiben. Der Preis ist ein Name, der weniger sagt, als die Funktion tut, und
er ist im Funktionskommentar auszugleichen.
Policies SHALL call these predicates rather than duplicating thresholds, and
elevated standing SHALL never derive from the member-writable `profiles.roles`.

Each predicate SHALL be `SECURITY DEFINER` with a pinned `search_path`, SHALL
return `false` rather than `null` for a caller without a session, and SHALL have
EXECUTE revoked from `public`/`anon`.

**Korrigiert 2026-08-05:** `is_prime_plus()` ist aus dieser Aufzählung
entfernt — die Funktion existiert seit AGE-311 nicht mehr. `has_level(int)` und
`is_activated()` sind an ihre Stelle getreten.

#### Scenario: Elevated standing is not member-forgeable

- **WHEN** a member sets `profiles.roles` to include `'admin'` or
  `'matching_manager'`
- **THEN** `is_admin()`/`is_matching_manager()` still return false, because they
  read `staff_roles`, which the client cannot write

#### Scenario: Tier threshold lives in one predicate

- **WHEN** a tier-gated policy needs a rank threshold
- **THEN** it calls `has_level(n)` (which encapsulates the `current_tier_rank()`
  comparison) rather than re-encoding the rank, so the threshold cannot drift
  between policies

#### Scenario: Die Aktivierung ist nicht vom Mitglied setzbar

- **WHEN** ein Mitglied versucht, `profiles.activated_at` selbst zu schreiben
- **THEN** wird das abgelehnt: auf dieser Spalte besteht kein Schreibrecht für
  Client-Rollen; sie wird ausschließlich serverseitig gesetzt

#### Scenario: Die Sperrfelder sind nicht vom Mitglied setzbar

- **WHEN** ein Mitglied versucht, `profiles.disabled_at` oder
  `profiles.deleted_at` selbst zu schreiben
- **THEN** wird das abgelehnt: auf diesen Spalten besteht kein Schreibrecht für
  Client-Rollen, wie auf `activated_at` auch

#### Scenario: Eine neue Policy erbt die vollständige Bedingung

- **WHEN** eine Policy `is_activated()` aufruft, ohne `disabled_at` oder
  `deleted_at` selbst zu nennen
- **THEN** schliesst sie deaktivierte und gelöschte Konten dennoch aus — die
  Bedingung steht im Prädikat, nicht in seinen Aufrufern


#### Scenario: Ein gesperrtes Konto sieht keinen Aktivierungsbildschirm

- **GIVEN** ein Konto, das bestätigt hat und danach deaktiviert wurde
- **WHEN** die Oberfläche seinen Zustand abfragt
- **THEN** erhält sie `activated = true` und `blocked = true`, und sie zeigt
  einen Sperrhinweis — nicht den Aktivierungsbildschirm und nicht die
  Möglichkeit, einen Zugangslink anzufordern

#### Scenario: Der Grund der Sperre bleibt drin

- **GIVEN** zwei gesperrte Konten, eines deaktiviert, eines gelöscht
- **WHEN** beide ihren Zustand abfragen
- **THEN** erhalten beide dieselbe Auskunft — welche Handlung ein Admin
  vorgenommen hat, geht aus ihr nicht hervor

#### Scenario: Die Auskunft bleibt schmal

- **WHEN** die Signatur der Zustandsfunktion untersucht wird
- **THEN** trägt sie genau drei Felder — Aktivierungszustand, Sperrzustand und
  Anzeigename — und kein Profil-, Kontakt- oder Stufendatum
