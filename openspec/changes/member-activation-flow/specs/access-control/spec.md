## ADDED Requirements

### Requirement: Eine Session allein gibt keine Mitgliederdaten frei

Das System SHALL jeden Zugriff auf **fremde** Mitgliederdaten zusätzlich davon
abhängig machen, dass das aufrufende Konto **aktiviert** ist. Aktiviert ist ein
Konto genau dann, wenn `profiles.activated_at` gesetzt ist; dieses Feld SHALL die
einzige Wahrheit für diese Entscheidung sein.

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
  sowie einen Anzeigenamen für die Anrede;
- eine, die dem **aufrufenden** Konto einen Aktivierungslink ausstellt.

Beide SHALL ihr Subjekt aus der Sitzung nehmen und SHALL NOT darüber hinaus
Profil-, Kontakt- oder Stufendaten preisgeben. Die zweite SHALL NOT eine im
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

### Requirement: Eine belegte Adresse verhindert die Übernahme eines Kontos nicht stillschweigend

Weil die Selbstregistrierung offen steht und keine Bestätigung voraussetzt, kann
eine E-Mail-Adresse bereits belegt sein, wenn die Mitgliedschaft dazu angelegt
werden soll. Das System SHALL für diesen Zusammenstoß ein bestimmtes,
aufgeschriebenes Verhalten haben und SHALL NOT ihn stillschweigend auflösen.

Es SHALL insbesondere NOT ein bestehendes, fremd angelegtes Konto durch bloße
Namensgleichheit der Adresse zu einer Mitgliedschaft erheben — sonst würde
gerade das vorab besetzte Konto zum Mitgliedskonto. Der Fall SHALL gemeldet und
von Hand entschieden werden.

Der Anlegevorgang selbst ist nicht Gegenstand dieses Changes; benannt wird hier
die Anforderung an ihn, die aus der offenen Selbstregistrierung folgt.

#### Scenario: Eine vorab besetzte Adresse

- **GIVEN** jemand hat sich mit der Adresse eines künftigen Mitglieds selbst
  registriert
- **WHEN** die Mitgliedschaft zu dieser Adresse angelegt werden soll
- **THEN** wird der Zusammenstoß gemeldet und von Hand entschieden; das
  bestehende Konto wird nicht automatisch zum Mitgliedskonto erhoben

### Requirement: Der Aktivierungsweg setzt ein Passwort nur gegen ein gültiges Token

Das System SHALL im Aktivierungsweg ein Passwort nur gegen ein gültiges,
einmalig verwendbares Token setzen. Die Anwendung SHALL keinen anderen Weg
anbieten — insbesondere keinen über die Einstellungen und keinen, der allein auf
einer bestehenden Sitzung beruht.

**Gemessen am 2026-08-05 gegen DEV, und deshalb hier ausgeschrieben statt
zugesagt:** Der Anmeldedienst selbst nimmt eine Passwortänderung **allein auf
Grundlage einer Sitzung** entgegen, ohne Token und ohne erneute Anmeldung. Er
liegt außerhalb der Datenbank; keine Policy erreicht ihn. Eine Anforderung, die
das verbietet, wäre in jeder Prüfung grün und im Betrieb falsch.

Was daraus folgt, SHALL das System stattdessen tragen:

- Wer ein verteiltes Passwort besitzt, SHALL dadurch **keinen Zugriff auf
  Mitgliederdaten** erlangen — das leistet das Aktivierungs-Gate, und es ist die
  eigentliche Zusage dieses Changes.
- Wer ein verteiltes Passwort ändert, SHALL das Mitglied damit **nicht dauerhaft
  aussperren** können. Der Weg zum Bestätigungslink SHALL ohne Anmeldung offen
  stehen, und die Einlösung SHALL das geänderte Passwort überschreiben.
- Aktivieren SHALL nur können, wer Zugriff auf das Postfach des Mitglieds hat.

Das Token SHALL die Identität des Mitglieds tragen, nicht die Session. Es SHALL
deshalb auch dann einlösbar sein, wenn es in einem anderen Browser oder auf einem
anderen Gerät geöffnet wird als dem, auf dem es angefordert wurde.

Das System SHALL vom Token **ausschließlich einen kryptografischen Hashwert**
speichern; der Klartext SHALL das System nur in der Mail an das Mitglied
verlassen. Das Token SHALL nach spätestens **72 Stunden** verfallen und SHALL
nach der ersten Einlösung verbraucht sein.

Die Tabelle der Token SHALL für die Client-Rollen unerreichbar sein: weder
`anon` noch `authenticated` SHALL Rechte auf ihr halten, und es SHALL keine
Policy für sie geben. Lesender und schreibender Zugriff SHALL ausschließlich
serverseitig erfolgen.

Je Profil SHALL höchstens **ein** Token einlösbar sein. Diese Eigenschaft SHALL
von der Datenbank erzwungen werden — durch eine Bedingung, die einen zweiten
ausstehenden Eintrag desselben Profils unmöglich macht — und SHALL NOT allein
auf einer vorangehenden Abfrage beruhen: zwei gleichzeitige Anforderungen kämen
sonst beide durch. Ein neuer Versand SHALL das ausstehende Token entwerten,
ebenso die erfolgreiche Einlösung. Andernfalls bliebe ein alter, nie geöffneter
Link monatelang ein Weg, das Passwort zu ändern.

Weil das System vom Token nur den Hashwert kennt, SHALL ein erneuter Versand
zwangsläufig ein **neues** Token erzeugen; der alte Link wird dadurch ungültig,
bevor seine Frist abgelaufen ist. Der Mailtext SHALL das benennen, sonst trifft
ein Mitglied, das zweimal anfordert und den ersten Link öffnet, auf eine
unerklärte Ablehnung.

Daraus folgt eine Restfläche, die hier benannt und nicht verschwiegen wird: Wer
die Adresse eines Mitglieds kennt, kann durch wiederholtes Anfordern dessen
ausstehenden Link immer wieder entwerten. Die Ratengrenze je Profil SHALL
deshalb ausdrücklich auch als Begrenzung dieses Falls gelten. Ein Zugang geht
dabei nicht verloren — das Mitglied fordert einen neuen Link an.

Das Token SHALL aus einem kryptografisch sicheren Zufallsgenerator stammen und
mindestens **256 Bit** Entropie tragen. Es ist der einzige Nachweis, den ein
öffentlich erreichbarer Einlöse-Endpunkt verlangt; seine Unerratbarkeit ist die
Eigenschaft, auf der das ganze Verfahren ruht. Der Einlöse-Endpunkt SHALL
zusätzlich die Versuchsrate begrenzen — nicht weil ein solches Token erraten
werden könnte, sondern damit ein ungedrosselter öffentlicher Endpunkt nicht als
Lastfläche dient.

Gezählt SHALL dabei **ausschließlich der fehlgeschlagene Versuch** werden, und
die Zählung SHALL **nach** dem Beanspruchen des Tokens stattfinden. Ein gültiges
Token SHALL deshalb **niemals** abgewiesen werden, auch nicht von einer bereits
gesperrten Herkunft. Das ist die Eigenschaft, die das Subjekt der Drossel
überhaupt erst wählbar macht: die Netzwerkadresse taugt als Subjekt genau dann,
wenn ein legitimer Aufruf nicht in sie hineinlaufen kann — sonst sperrte eine
geteilte Adresse (NAT) das echte Mitglied mit aus. Aus demselben Grund SHALL
eine gefälschte Herkunftsangabe folgenlos bleiben: sie füllt einen Zähler, der
niemanden aussperrt.

Die gespeicherte Herkunftsangabe ist ein personenbezogenes Datum und SHALL
deshalb nur im Fenster der Drossel gehalten und danach gelöscht werden; ein
Verlauf SHALL NOT entstehen. Für Client-Rollen SHALL sie unerreichbar sein —
kein Recht, keine Policy.

Die Drossel ist eine Lastbremse, keine Sicherheitsgrenze. Fällt sie aus, SHALL
der Einlöseweg trotzdem tragen.

Das Klartext-Token SHALL NOT in einem Teil der Adresse stehen, den Browser,
Zwischenspeicher oder Server protokollieren. Es SHALL nach dem Auslesen aus der
Adresszeile entfernt werden, und die Seite SHALL keine verweisende Adresse an
Dritte weitergeben.

**Die Einlösung SHALL das Token zuerst beanspruchen.** Prüfung und Verbrauch
SHALL in **einer** Datenbankoperation zusammenfallen, die nur dann etwas
zurückgibt, wenn das Token in diesem Moment unbenutzt und unverfallen war. Ein
Prüfen mit anschließendem Vermerken SHALL NOT genügen: zwei gleichzeitige
Einlösungen desselben Tokens kämen beide durch und setzten verschiedene
Passwörter, und das Mitglied wüsste nicht, welches gilt.

Das Setzen des Passworts und das Setzen von `activated_at` können **nicht**
gemeinsam zurückgerollt werden: der Anmeldedienst liegt außerhalb der Datenbank.
Statt einer Zusage über Atomarität SHALL deshalb die **Reihenfolge** festgelegt
sein:

1. Token beanspruchen (atomar, siehe oben),
2. Passwort setzen,
3. alle bestehenden Sitzungen des Kontos beenden,
4. **erst danach** den Aktivierungsvermerk setzen.

Der Aktivierungsvermerk SHALL als **letzter** Schritt gesetzt werden, weil er das
Gate öffnet. Scheitert einer der Schritte davor, SHALL das Gate geschlossen
bleiben. Insbesondere SHALL NOT ein Konto aktiviert werden, dessen Sitzungen
nicht beendet werden konnten — sonst liefe genau die vorab angelegte Sitzung
eines Dritten hinter dem geöffneten Gate weiter, die dieser Change verhindern
soll.

**Was „Sitzungen beenden" nicht leistet — benannte Restfläche, keine Zusage.**
Das Beenden entfernt die Sitzung und ihre Erneuerungsmöglichkeit. Ein bereits
ausgegebener Zugriffs-Token ist jedoch **zustandslos**: er wird bei jeder
Abfrage anhand seiner Signatur geprüft, nicht gegen eine Sitzungstabelle, und
bleibt deshalb bis zu seiner Ablaufzeit gültig. Ein Dritter, der sich unmittelbar
vor der Aktivierung angemeldet hat, kann folglich **bis zum Ablauf dieses
Tokens** hinter dem geöffneten Gate weiterarbeiten.

Die Obergrenze dieser Restfläche SHALL die konfigurierte Token-Lebensdauer sein
und SHALL in der versionierten Auth-Konfiguration nachlesbar sein. Sie zu
schließen verlangt eine von zwei Entscheidungen — die Lebensdauer senken oder
die Sitzungskennung bei **jeder** Abfrage gegen die Sitzungstabelle prüfen
(teuer) — und beide sind ausdrücklich **nicht** Teil dieses Changes. Bis dahin
gilt: die Zusage ist „kein neuer Zugang mit dem verteilten Passwort", nicht
„jeder bestehende Zugriff endet sofort".

Ein Abbruch nach Schritt 2 SHALL ein Konto mit **neuem** Passwort und ohne
Aktivierung hinterlassen: das Mitglied kommt herein, sieht den
Aktivierungsbildschirm und fordert einen neuen Link an. Ein aktiviertes Konto,
das noch auf dem verteilten Passwort steht, SHALL NOT entstehen können.

Die Mindestlänge des Passworts SHALL serverseitig geprüft werden und SHALL in
der Oberfläche **dieselbe** sein. Eine Oberfläche, die eine kürzere Eingabe
annimmt, verwandelt eine Feldmeldung in einen Serverfehler und lässt das
Mitglied im Unklaren darüber, was von ihm verlangt wird.

#### Scenario: Die Anwendung bietet keinen Weg am Token vorbei

- **WHEN** ein angemeldetes, nicht aktiviertes Konto in der Anwendung nach einem
  Weg sucht, ein Passwort ohne Token zu setzen
- **THEN** gibt es keinen: weder in den Einstellungen noch auf einer anderen
  Oberfläche

#### Scenario: Ein am Anmeldedienst geändertes Passwort öffnet nichts

- **GIVEN** jemand hat mit dem verteilten Passwort eine Sitzung angelegt und das
  Passwort über den Anmeldedienst geändert
- **WHEN** er anschließend Mitgliederdaten abfragt
- **THEN** erhält er keine — das Gate hängt am Aktivierungsvermerk, nicht am
  Passwort

#### Scenario: Das Mitglied holt sein Konto zurück

- **GIVEN** dasselbe geänderte Passwort
- **WHEN** das Mitglied seinen Bestätigungslink einlöst und ein eigenes Passwort
  vergibt
- **THEN** ist das Passwort des Dritten überschrieben und dessen Sitzungen sind
  beendet

#### Scenario: Oberfläche und Server verlangen dieselbe Passwortlänge

- **WHEN** ein Mitglied im Aktivierungsformular ein zu kurzes Passwort eingibt
- **THEN** meldet die Oberfläche das am Feld, statt die Eingabe anzunehmen und
  einen Serverfehler zu zeigen

#### Scenario: Ein Token wirkt genau einmal

- **GIVEN** ein bereits eingelöstes Token
- **WHEN** derselbe Link erneut geöffnet wird
- **THEN** wird die Einlösung abgelehnt und dem Mitglied gesagt, dass sein Konto
  bereits aktiviert ist

#### Scenario: Ein abgelaufenes Token wird abgelehnt

- **GIVEN** ein Token, dessen Ablaufzeitpunkt überschritten ist
- **WHEN** der Link geöffnet wird
- **THEN** wird die Einlösung abgelehnt und ein Weg zu einem neuen Link
  angeboten

#### Scenario: Der Link wirkt in einem anderen Browser

- **GIVEN** ein Mitglied öffnet den Link auf einem Gerät ohne Session
- **WHEN** es das Token einlöst
- **THEN** gelingt das, weil das Token die Identität trägt

#### Scenario: Die Token-Tabelle ist für Clients nicht erreichbar

- **WHEN** eine Client-Rolle die Token-Tabelle zu lesen oder zu schreiben
  versucht
- **THEN** scheitert das mangels Rechten — unabhängig von jeder Policy

#### Scenario: Ein neuer Link entwertet den alten

- **GIVEN** ein Mitglied hat einen Bestätigungslink erhalten und fordert einen
  weiteren an
- **WHEN** es danach den **ersten** Link öffnet
- **THEN** wird dieser abgelehnt; einlösbar ist nur der zuletzt versendete

#### Scenario: Das Token landet nicht im Protokoll

- **WHEN** ein Mitglied den Bestätigungslink öffnet
- **THEN** steht das Klartext-Token in keinem Teil der Adresse, den der Server
  erhält, und es wird nach dem Auslesen aus der Adresszeile entfernt

#### Scenario: Ein Abbruch mitten in der Einlösung sperrt nicht aus

- **GIVEN** das Passwort wurde gesetzt, der Aktivierungsvermerk schlägt fehl
- **WHEN** das Mitglied sich anschließend anmeldet
- **THEN** gelangt es mit seinem **neuen** Passwort herein, sieht den
  Aktivierungsbildschirm und kann einen neuen Link anfordern

#### Scenario: Eine vorab angelegte Sitzung überdauert die Aktivierung nicht

- **GIVEN** jemand hat sich vor der Aktivierung mit dem verteilten Passwort
  angemeldet und hält eine Sitzung
- **WHEN** das Mitglied seinen Bestätigungslink einlöst
- **THEN** ist jene Sitzung beendet und lässt sich nicht erneuern

#### Scenario: Der bereits ausgegebene Zugriffs-Token läuft aus, statt zu enden

- **GIVEN** dieselbe vorab angelegte Sitzung, deren Zugriffs-Token noch nicht
  abgelaufen ist
- **WHEN** die Aktivierung abgeschlossen ist und das Gate sich öffnet
- **THEN** trägt dieser Token bis zu seiner Ablaufzeit weiter — das ist die
  benannte Obergrenze der Restfläche, keine Zusage, und sie endet ohne weiteres
  Zutun, weil eine Erneuerung nicht mehr möglich ist

#### Scenario: Ein misslungener Sitzungswiderruf öffnet das Gate nicht

- **GIVEN** das Beenden der bestehenden Sitzungen schlägt fehl
- **WHEN** die Einlösung an dieser Stelle abbricht
- **THEN** bleibt der Aktivierungsvermerk ungesetzt und das Gate geschlossen;
  das Mitglied kann die Einlösung mit einem neuen Link wiederholen

#### Scenario: Zwei gleichzeitige Einlösungen desselben Links

- **WHEN** derselbe Bestätigungslink zweimal gleichzeitig eingelöst wird
- **THEN** setzt genau einer der beiden Vorgänge ein Passwort; der andere wird
  abgelehnt, weil das Token bereits beansprucht war

#### Scenario: Wiederholte ungültige Einlösungen werden gedrosselt

- **GIVEN** von derselben Herkunft kamen bereits mehr fehlgeschlagene Versuche
  als die Grenze zulässt
- **WHEN** von dort ein weiterer **ungültiger** Link eingelöst wird
- **THEN** wird der Versuch abgewiesen, und die Oberfläche nennt den Weg nach
  vorn — einen neuen Link anfordern

#### Scenario: Die Drossel sperrt kein Mitglied mit gültigem Link aus

- **GIVEN** dieselbe, bereits gesperrte Herkunft — etwa der geteilte Anschluss
  eines Unternehmens
- **WHEN** von dort ein **gültiger** Bestätigungslink eingelöst wird
- **THEN** gelingt die Aktivierung, weil die Zählung erst hinter dem
  Beanspruchen des Tokens steht und einen gelungenen Versuch nie erfasst

#### Scenario: Zwei gleichzeitige Anforderungen erzeugen nicht zwei gültige Links

- **WHEN** zweimal gleichzeitig ein Bestätigungslink angefordert wird
- **THEN** bleibt höchstens ein Token ausstehend — die Datenbank lässt einen
  zweiten nicht zu

### Requirement: Der Weg zur Aktivierung setzt keine Anmeldung voraus

Das System SHALL einen Bestätigungslink auch dann anfordern lassen, wenn keine
Sitzung besteht — allein anhand der E-Mail-Adresse. Andernfalls hätte ein
Mitglied, dessen verteiltes Passwort von einem Dritten geändert wurde, keinen
Weg mehr zu seinem Konto: es käme nicht an der Anmeldung vorbei und erreichte
den Aktivierungsbildschirm nie.

Die Anforderung SHALL das Empfängerprofil **ausschließlich** aus der genannten
E-Mail-Adresse bestimmen. Sie SHALL NOT eine Angabe aus einem mitgesendeten
Anmeldenachweis verwenden: Auf einem Endpunkt, der ohne Sitzung erreichbar ist,
prüft niemand einen solchen Nachweis, und eine daraus gelesene Kennung wäre vom
Aufrufer frei wählbar.

Dieser sitzungsfreie Weg SHALL dem Wiederherstellungsfall vorbehalten sein. Für
ein angemeldetes Konto SHALL ein **getrennter, authentifizierter** Weg bestehen,
dessen Subjekt die Sitzung ist. Ein gemeinsamer Weg für beide wäre für den
Hauptfall unnötig offen: wer die Login-Adresse eines Mitglieds kennt, könnte in
dessen Namen anfordern.

Weil eine Ausgabe den zuvor ausgegebenen Link entwertet, SHALL der sitzungsfreie
Weg einen noch gültigen, unbenutzten Link **nicht** entwerten. Er SHALL die
Anforderung stattdessen folgenlos lassen und den bestehenden Link stehen lassen.
Andernfalls ist er kein Weg zurück ins Konto, sondern ein Weg, ein Mitglied
auszusperren.

Weil die Antwort dem Aufrufer zugestellt wird, **bevor** der Versand feststeht,
SHALL ein danach **abgelehnter** Versand das dabei ausgegebene Token entwerten.
Andernfalls liegt ein gültiges Token im System, zu dem es keinen zugestellten
Link gibt — und der schützende Nichtversand von oben hält genau diesen Zustand
bis zu einen Tag lang fest. Ein stiller Fehlschlag würde so zu der Aussperrung,
die dieselbe Regel verhindern soll.

Bleibt dagegen **ungewiss**, ob die Mail hinausging — etwa weil die Antwort des
Versanddienstes verlorenging, nachdem er sie angenommen hatte —, SHALL das Token
**gültig bleiben**. Ein zugestellter Link, den das System nachträglich entwertet,
wäre für das Mitglied schlimmer als ein offenes Schutzfenster: Es hielte eine
echte Mail in der Hand, deren Link „überholt" meldet, also die Auskunft für einen
Fall, der nicht eingetreten ist. Dieser Zustand SHALL stattdessen protokolliert
werden, weil er sonst nirgends sichtbar wird.

Weil die Antwort in allen diesen Fällen ununterscheidbar bleiben muss, SHALL die
Meldung an das Mitglied **alle** Ausgänge abdecken, statt einen Versand
zuzusagen, den es nicht gegeben haben muss. Sie SHALL benennen, dass ein in den
letzten 24 Stunden bereits angeforderter Link weiter gilt, und einen Rückkanal
nennen. Andernfalls wartet, wer die Mail nie bekommen hat, auf etwas, das nicht
mehr kommt — und liest dabei eine Erfolgsmeldung.

Der Empfänger SHALL in jedem Fall die hinterlegte Adresse des Profils sein,
niemals eine im Aufruf mitgegebene. Andernfalls wäre der Endpunkt ein Weg, sich
den Bestätigungslink eines fremden Kontos zusenden zu lassen.

Damit der Weg des Mitglieds das verteilte Passwort nicht berühren muss, SHALL
der Versand bereits angestoßen sein, bevor sich jemand anmelden kann. Das
Anlegen der Konten ist nicht Gegenstand dieses Changes; dieser SHALL die
Anforderung lediglich als Schnittstelle bereitstellen, die ohne Sitzung und für
ein einzelnes Profil aufrufbar ist, und die Erwartung an den Anlegevorgang
benennen.

Die Antwort auf eine solche Anforderung SHALL unabhängig davon gleich ausfallen,
ob zu der Adresse ein Konto besteht. Andernfalls wäre die Schnittstelle ein
Verzeichnis der Mitgliedsadressen.

#### Scenario: Ein übernommenes Passwort sperrt nicht dauerhaft aus

- **GIVEN** ein Dritter hat das verteilte Passwort eines Kontos geändert
- **WHEN** das Mitglied ohne Anmeldung einen Bestätigungslink über seine Adresse
  anfordert
- **THEN** erhält es ihn und kann sein Konto zurückholen; das Passwort des
  Dritten wird dabei überschrieben

#### Scenario: Die Anforderung verrät keine Adressen

- **WHEN** ein Bestätigungslink für eine Adresse angefordert wird, zu der kein
  Konto besteht
- **THEN** ist die Antwort nicht von der für eine bestehende Adresse zu
  unterscheiden

#### Scenario: Ein Fremder kann ein Mitglied nicht aussperren

- **GIVEN** ein Mitglied hat einen gültigen, unbenutzten Bestätigungslink im
  Postfach
- **WHEN** ein Dritter über die bekannte Login-Adresse **ohne Sitzung** einen
  neuen Link anfordert
- **THEN** bleibt der Link im Postfach gültig, es wird kein neuer ausgegeben,
  und das Tageskontingent des Mitglieds bleibt unberührt

#### Scenario: Ein fehlgeschlagener Versand sperrt nicht bis zum nächsten Tag

- **GIVEN** eine Anforderung wurde angenommen und der Versand der Mail schlägt
  danach fehl
- **WHEN** für dieselbe Adresse erneut ein Bestätigungslink angefordert wird
- **THEN** gilt das Token des Fehlversands nicht mehr als ausstehend, und die
  erneute Anforderung gibt einen Link aus, statt folgenlos zu bleiben

#### Scenario: Ein ungewisser Versand entwertet den Link nicht

- **GIVEN** eine Anforderung wurde angenommen und der Versanddienst hat die Mail
  angenommen, seine Antwort ging aber verloren
- **WHEN** das Mitglied den Link aus der zugestellten Mail öffnet
- **THEN** wirkt er — das System hat ihn nicht nachträglich entwertet

#### Scenario: Die Meldung sagt nichts zu, was nicht geschehen sein muss

- **WHEN** eine Anforderung ohne Anmeldung angenommen wurde
- **THEN** nennt die Meldung sowohl den soeben verschickten Link als auch den
  bereits vorhandenen und einen Rückkanal — und sie unterscheidet die Fälle nicht

#### Scenario: Der Hauptweg nimmt keine Adresse entgegen

- **WHEN** ein angemeldetes, nicht aktiviertes Konto den Bestätigungslink vom
  Aktivierungsbildschirm anfordert
- **THEN** bestimmt sich der Empfänger aus der Sitzung; eine im Aufruf
  mitgegebene Adresse gibt es nicht und kann folglich nicht gefälscht werden

### Requirement: Der Aktivierungsversand ist gegen Selbstüberflutung begrenzt

Das System SHALL die Anzahl der Aktivierungsmails **pro Mitgliedsprofil**
begrenzen, nicht nur pro Absender-IP. Die Begrenzung SHALL serverseitig aus
gespeichertem Zustand abgeleitet werden, damit sie auch bei mehreren gleichzeitig
laufenden Instanzen gilt.

Eine erneute **Aktivierungs**anforderung für ein bereits aktiviertes Konto SHALL
keine **Aktivierungsmail** auslösen — an einem aktivierten Konto gibt es nichts
zu aktivieren — und SHALL NOT als Fehler des Aufrufers behandelt werden. Ein
Versand zu **anderem Zweck** über denselben Endpunkt bleibt davon unberührt: den
Weg zurück für ein Konto mit vergessenem Passwort regelt AGE-505
(`password-reset-flow`). Ohne diese Verengung sagte der Satz mehr, als er
schützen soll, und die beiden Changes widersprächen einander.

Der Aktivierungsversand SHALL NOT über den eingebauten Mailversand der
Auth-Plattform laufen. Dessen projektweite Grenze ist ohne eigenen SMTP-Dienst
nicht erhöhbar und für den Fall „siebzig Mitglieder an einem Abend" zu klein;
außerdem SHALL Absender und Text unter der Kontrolle des Betreibers stehen.

#### Scenario: Zweimal hintereinander anfordern

- **WHEN** ein Mitglied den Bestätigungslink zweimal innerhalb der Sperrfrist
  anfordert
- **THEN** wird nur die erste Mail versendet

#### Scenario: Aktivierung anfordern für ein bereits aktiviertes Konto

- **WHEN** ein bereits aktiviertes Konto über den Aktivierungsbildschirm einen
  Bestätigungslink anfordert
- **THEN** wird keine Aktivierungsmail versendet und der Aufruf gilt als
  erfolgreich

## MODIFIED Requirements

### Requirement: Visibility follows membership tier rank

The system SHALL gate tier-scoped visibility on the caller's numeric tier rank
via `current_tier_rank()` and the derived parametric predicate
`has_level(min_rank)`, so that a member below the required rank cannot read a
higher-tier resource while a member at or above it can. The rank comparison —
not a client flag — SHALL be the deciding factor.

**Korrigiert 2026-08-05.** Der bisherige Text nannte `is_prime_plus()` als
lebendes Prädikat. Die Funktion existiert seit AGE-311 nicht mehr: sie wurde
gedroppt, nachdem alle sieben abhängigen Policies auf `has_level()` umgehängt
worden waren. Gemessen gegen die Datenbank, nicht aus den Migrationen gelesen.

Die Rangprüfung SHALL NOT als alleinige Hürde vor Mitgliederdaten stehen, wo
Konten mit hoher Stufe provisioniert werden, ohne dass ihr Inhaber sich je
ausgewiesen hat. In diesem Fall SHALL das Aktivierungs-Gate zusätzlich greifen.

#### Scenario: Below-threshold member is excluded from the full directory

- **WHEN** a member below the directory threshold selects another member's full
  `profiles` row (extended fields) or their `offers`/`needs`
- **THEN** the tier-gated policy (via `has_level()`/`current_tier_rank()`)
  returns no row

#### Scenario: At-or-above-threshold member gains access

- **WHEN** an **activated** member at or above the threshold reads the same
  resource
- **THEN** the tier gate permits it (e.g. a `discover`-rank member reads a full
  foreign profile and its extended interests)

#### Scenario: Eine hohe Stufe ersetzt die Aktivierung nicht

- **GIVEN** ein Konto auf der höchsten Stufe, das nie aktiviert wurde
- **WHEN** es dieselbe Ressource liest
- **THEN** wird sie verweigert — die Stufe öffnet nichts, solange die
  Aktivierung fehlt

### Requirement: Helper predicates are the single authority for gating

The system SHALL centralise every authorization decision in the
server-controlled predicates `current_tier_rank()`, `has_level(int)`,
`is_activated()`, `is_matching_manager()`, and `is_admin()`, sourced from
`membership_tiers`/`profiles.tier`, `profiles.activated_at` and `staff_roles`.
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

### Requirement: SECURITY DEFINER functions are pinned and locked down

The system SHALL define privileged helper and trigger functions as
`SECURITY DEFINER` with a pinned `search_path`, and SHALL grant EXECUTE only to
the roles that need it — revoking the default `PUBLIC`/`anon` grant so these
functions are not exposed as PostgREST `/rest/v1/rpc` endpoints. Trigger-only
functions SHALL carry no API-role EXECUTE grant at all.

Where such a function reproduces a table's visibility predicate instead of
relying on that table's policies, the reproduction SHALL be kept in step with
the policies it mirrors. A gate added to the policies SHALL be added to these
functions in the same change; otherwise the function is the way around the gate.

#### Scenario: Predicate helpers are not callable by anon

- **WHEN** the `anon` role attempts to call `is_admin()`, `has_level(int)`,
  `is_activated()`, `is_matching_manager()`, or `current_tier_rank()` via
  PostgREST
- **THEN** EXECUTE is denied (`has_function_privilege('anon', ...)` is false);
  only `authenticated` (and `service_role` where required) may call them

#### Scenario: Trigger-only functions are off the API surface

- **WHEN** any role tries to invoke a trigger helper (e.g. `handle_new_user`,
  `set_updated_at`, `platform_settings_touch`) as an RPC
- **THEN** EXECUTE has been revoked from `public`/`anon`/`authenticated`, while
  the trigger still fires (triggers do not check the caller's EXECUTE privilege)

#### Scenario: Eine spiegelnde Funktion trägt dasselbe Gate wie ihre Tabelle

- **WHEN** eine privilegierte Funktion das Sichtbarkeitsprädikat einer Tabelle
  nachbildet und diese Tabelle ein neues Gate erhält
- **THEN** trägt die Funktion dasselbe Gate, sodass ihr Aufruf nicht mehr
  freigibt als eine unmittelbare Abfrage
