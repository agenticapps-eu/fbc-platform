# environment-sync Specification

## Purpose
TBD - created by archiving change sync-dev-from-prod. Update Purpose after archive.
## Requirements
### Requirement: Der Wächter prüft Quelle und Ziel, und jedes Zugangspaar einzeln

Das System SHALL vor dem ersten Zugriff die Projektkennung **beider** Seiten
prüfen: die Quelle SHALL exakt die PROD-Kennung tragen, das Ziel exakt die
DEV-Kennung. Ein unbekanntes, gleiches oder nicht auflösbares Paar SHALL zum
Abbruch führen.

Die Prüfung SHALL NOT über den Host erfolgen: der Pooler-Host ist regionsweit
gleich und unterscheidet die Projekte nicht. Die Kennung steht im
Datenbank-Benutzernamen (`postgres.<ref>`).

Die Prüfung SHALL **jedes projektgebundene Wertepaar einzeln** erfassen —
Datenbank-URL, Storage-URL und Service-Key — und belegen, dass alle demselben
Projekt zugeordnet sind. Eine Prüfung, die nur die Datenbank erfasst, ist
unzureichend: eine DEV-Datenbank-URL neben einem PROD-Service-Key leert
PROD-Buckets oder legt Konten in PROD an, während die Datenbankprüfung grün ist.
Dass diese Werte im Projekt bereits auseinanderlaufen, ist dokumentiert.

#### Scenario: Ein Lauf gegen PROD als Ziel bricht ab

- **WHEN** der Lauf mit einer Ziel-Zugangszeile gestartet wird, deren
  Benutzername die PROD-Kennung trägt
- **THEN** endet er mit einem Fehler, nennt die erkannte Kennung, und in PROD
  ist keine Zeile und kein Objekt verändert

#### Scenario: Eine vertauschte Quelle besteht die Prüfung nicht

- **WHEN** als Quelle ein anderes Projekt als PROD angegeben wird — auch DEV
  selbst
- **THEN** bricht der Lauf ab, bevor er liest

#### Scenario: Gemischte Zugangsdaten brechen ab

- **WHEN** Datenbank-URL, Storage-URL und Service-Key nicht alle auf dasselbe
  Projekt zeigen
- **THEN** bricht der Lauf ab und benennt, welcher Wert abweicht — auch dann,
  wenn die Datenbank-URL für sich genommen korrekt ist

#### Scenario: Gleicher Host, anderes Projekt wird erkannt

- **WHEN** Quelle und Ziel denselben Pooler-Host tragen, aber verschiedene
  Kennungen im Benutzernamen
- **THEN** unterscheidet der Lauf sie korrekt

### Requirement: Der Restore ist nachweislich frei von Nebenwirkungen durch Trigger

Das System SHALL vor dem Zurückspielen **jeden mutierenden Trigger** auf den
betroffenen Schemata inventarisieren und für jeden festhalten, ob er beim
Restore feuern darf.

Der Grund SHALL NOT auf den Signup-Trigger verengt werden: `public` trägt
(gemessen am 2026-08-20) **13 nicht-interne Trigger**. `trg_event_feed_post`
erzeugt zu jedem zurückgespielten Termin einen zusätzlichen Beitrag,
`contact_requests_lifecycle` zusätzliche Benachrichtigungen und Threads — und
`contact_requests_email_webhook` kann **Post verschicken**. Ein Restore, der
E-Mails auslöst, ist kein Restore.

Ein Trigger, der beim Restore nicht feuern darf und nicht zuverlässig
stillgelegt werden kann, SHALL den Ansatz zu Fall bringen, nicht zu einer
Ausnahme führen.

Der triggerfreie Restore SHALL vollständig gegen den lokalen Stack belegt sein,
bevor er DEV berührt.

#### Scenario: Ein zurückgespielter Termin erzeugt keinen zusätzlichen Beitrag

- **WHEN** ein Restore Termine zurückspielt
- **THEN** entspricht die Zahl der Beiträge danach der des Auszugs, ohne die
  vom Terminsatz erzeugten

#### Scenario: Der Restore verschickt keine Post

- **WHEN** ein Restore Zeilen in `contact_requests` zurückspielt
- **THEN** wird kein Webhook ausgelöst und keine Nachricht versendet

#### Scenario: Ein nicht stilllegbarer Trigger bricht den Entwurf, nicht die Regel

- **WHEN** ein mutierender Trigger beim Restore feuern müsste und nicht
  stillgelegt werden kann
- **THEN** endet der Lauf mit einem Fehler, der ihn benennt

### Requirement: Der Auth-Umfang ist gemessen, nicht angenommen

Das System SHALL den zur Anmeldefähigkeit nötigen Umfang des `auth`-Schemas
übertragen und diesen Umfang aufgeschrieben haben.

`auth.users` allein SHALL NOT als Auth-Restore gelten: GoTrue pflegt Identitäten
ausserhalb dieser Tabelle, und der Spiegel SHALL PROD abbilden statt einer
Teilmenge, die zufällig noch funktioniert. Gemessen am 2026-08-20 trägt
`auth.identities` **72 Zeilen**.

Die Begründung SHALL NOT lauten, ohne Identitäten sei keine Anmeldung möglich —
das ist nachgemessen **falsch**: die drei DEV-Demo-Zugänge tragen null
Identitätszeilen und melden sich per Passwort an. Der Grund ist ein anderer:
alles, was an Identitäten hängt — Verknüpfung von Anmeldeverfahren,
`identity_data`, das Verhalten künftiger GoTrue-Fassungen — wäre ohne sie
stillschweigend anders, und ein Unterschied, den kein Test sieht, ist die
teuerste Sorte.

#### Scenario: Ein übertragenes Konto ist anmeldefähig

- **WHEN** ein Lauf abgeschlossen ist
- **THEN** kann sich ein übertragenes Konto mit seinem Verfahren anmelden —
  belegt an `last_sign_in_at`, nicht am Vorhandensein einer Zeile

#### Scenario: Fehlende Identitäten brechen den Lauf, statt still zu bleiben

- **WHEN** der Auszug Konten enthält, deren Identitätszeilen in PROD vorhanden
  sind, in DEV nach dem Lauf aber fehlen
- **THEN** endet der Lauf mit einem Fehler, statt eine unbemerkte Abweichung
  zu hinterlassen

### Requirement: Der Auszug entsteht vollständig, bevor das Ziel angefasst wird

Das System SHALL den Auszug aus PROD vollständig erzeugt und abgelegt haben,
bevor es den ersten schreibenden Befehl gegen DEV absetzt. Bricht das Erzeugen
ab, SHALL DEV unverändert bleiben.

Der Auszug SHALL ausserhalb des Arbeitsbaums liegen, in einem Verzeichnis mit
Rechten `0700`, jede Datei mit `0600`, und der Ablageort SHALL über `realpath`
gegen den Arbeitsbaum geprüft werden — ein Symlink darf ihn nicht hineinziehen.
Er enthält Namen, Anschriften und Anmeldeadressen echter Menschen, und das
Repository ist öffentlich.

Zum Auszug SHALL ein Manifest gehören: je Tabelle die Zeilenzahl und ein Hash
über die Zeilen, je Objekt Größe und Prüfsumme, **und für jede der beiden
SQL-Dateien ebenfalls Größe und Prüfsumme**. Das Werkzeug SHALL beide Dateien
byteweise gegen das Manifest halten, bevor es den ersten löschenden Befehl
absetzt — dieselbe Zusage wie für die Objekte. Ein Auszug, dessen Manifest diese
Prüfsummen nicht führt, SHALL abgewiesen werden; er SHALL NOT mit einer Warnung
durchgelassen werden.

Das Werkzeug SHALL ausserdem die Bucket-Liste des Manifests gegen die des Ziels
halten, ebenfalls vor dem ersten löschenden Befehl, und in **beide** Richtungen:
ein auf dem Ziel fehlender Bucket SHALL genauso zum Abbruch führen wie ein
zusätzlicher.

#### Scenario: Ein Abbruch beim Auszug lässt DEV unberührt

- **WHEN** das Erzeugen des Auszugs mit einem Fehler endet
- **THEN** sind die Zeilenzahlen in DEV dieselben wie vor dem Lauf, weil noch
  kein schreibender Befehl abgesetzt wurde

#### Scenario: Der Ablageort liegt nachweislich nicht im Arbeitsbaum

- **WHEN** ein Lauf beginnt
- **THEN** ist der über `realpath` aufgelöste Ablageort kein Pfad unterhalb des
  Arbeitsbaums, und der Lauf bricht sonst ab

#### Scenario: Eine beschädigte SQL-Datei fällt auf, bevor gelöscht wird

- **WHEN** `public.sql` nach dem Erzeugen des Auszugs auch nur um ein Byte
  gekürzt oder verändert wird
- **THEN** bricht der Lauf mit dem Verweis auf Größe und Prüfsumme ab, und zwar
  bevor eine Verbindung zum Ziel aufgebaut ist — nicht erst, wenn das Ziel
  bereits geleert ist

#### Scenario: Ein Auszug ohne Prüfsummen für die SQL-Dateien wird abgewiesen

- **WHEN** ein Auszug eingespielt werden soll, dessen Manifest das Feld für die
  SQL-Dateien nicht führt
- **THEN** bricht der Lauf ab mit der Aufforderung, den Auszug neu zu ziehen —
  ein fehlendes Feld zu tolerieren liesse die Lücke für genau die Auszüge offen,
  die sie haben

#### Scenario: Abweichende Buckets fallen auf, bevor gelöscht wird

- **WHEN** die Bucket-Liste des Ziels von der des Auszugs abweicht, in welcher
  Richtung auch immer
- **THEN** bricht der Lauf ab, bevor der erste Bucket geleert wird

#### Scenario: Der Arbeitsbaum wächst durch den Lauf nicht

- **WHEN** `git status --porcelain --ignored` vor und nach einem Lauf verglichen
  wird
- **THEN** ist die Differenz leer — die Ausgabe selbst ist es nicht, sie führt
  schon vorher ignorierte Pfade

### Requirement: Die übernommenen Passwort-Hashes werden neutralisiert, so früh wie möglich

Der Spiegel überträgt echte Personendaten ohne Anonymisierung. Einer der zwei
Ausgleiche dafür ist, dass **kein übernommenes Konto auf DEV anmeldefähig ist**:
das Werkzeug SHALL jeden Passwort-Hash durch einen Zufallswert ersetzen.

Das SHALL unmittelbar nach dem Einspielen der Konten geschehen — an der
frühestmöglichen Stelle, an der es überhaupt Hashes gibt — und SHALL NOT hinter
weitere Schritte gestellt werden. Jeder Abbruch zwischen dem Einspielen und der
Neutralisierung liesse das Ziel mit gültigen Produktions-Hashes zurück, und die
Selbstregistrierung auf DEV ist offen.

Das Ergebnis SHALL gemessen und nicht behauptet werden: das Werkzeug SHALL
belegen, dass **kein** Konto mehr einen Hash aus dem Auszug trägt.

Ausgenommen ist allein der ausdrückliche Sicherungslauf, dessen Zweck der
anmeldefähige Bestand ist und der gegen DEV abgelehnt wird.

#### Scenario: Nach einem Lauf gegen DEV ist kein übernommenes Konto anmeldefähig

- **WHEN** ein Lauf gegen DEV beendet ist
- **THEN** trägt keines der übernommenen Konten noch seinen Hash aus dem Auszug,
  und eine Anmeldung mit einem Produktionspasswort scheitert

#### Scenario: Ein Abbruch nach dem Einspielen lässt keine echten Hashes zurück

- **WHEN** der Lauf nach dem Einspielen der Konten aus einem beliebigen Grund
  abbricht
- **THEN** sind die Hashes zu diesem Zeitpunkt bereits ersetzt, weil die
  Neutralisierung vor allen weiteren Schritten steht

### Requirement: Der Spiegel überträgt Datenbank und Ablage gemeinsam

Das System SHALL neben den Tabellenzeilen auch die Objekte der Ablage
übertragen — `avatars`, `covers`, `event-covers` und `post-media`. Ein Lauf, der
nur die Datenbank überträgt, SHALL fehlschlagen.

Der Grund SHALL NOT als Kosmetik behandelt werden: Profilzeilen ohne die
zugehörigen Objekte tragen Bild-Adressen, die ins Leere zeigen, und als
Sicherung wäre ein solcher Auszug wertlos.

Das Auflisten der Buckets SHALL vollständig sein — rekursiv und über alle
Seiten. Die heutige Menge von 125 Objekten SHALL NOT als Beleg dafür gelten,
dass eine Seitengrenze nie erreicht wird.

Objektnamen SHALL beim Ablegen auf lokale Pfade abgebildet werden, ohne den
Ablageort verlassen zu können.

Beim Schreiben in die Ablage SHALL `upsert` abgeschaltet bleiben. In privaten
Buckets verlangt `ON CONFLICT` ein Leserecht, das für ein noch unverknüpftes
Objekt verweigert wird — der Fehler zeigt dann auf die RLS, obwohl die Policy
richtig ist.

#### Scenario: Jedes Objekt kommt an, nach Prüfsumme

- **WHEN** ein Lauf abgeschlossen ist
- **THEN** trägt jedes Objekt des Manifests in DEV dieselbe Größe und Prüfsumme

#### Scenario: Eine Seitengrenze verschluckt keine Objekte

- **WHEN** ein Bucket mehr Objekte trägt, als eine Antwortseite fasst
- **THEN** enthält das Manifest alle, nicht die erste Seite

#### Scenario: Ein Objektname kann den Ablageort nicht verlassen

- **WHEN** ein Objektname Pfadanteile trägt, die nach oben zeigen
- **THEN** bricht der Lauf ab, statt ausserhalb des Ablageorts zu schreiben

### Requirement: Der Lauf ist wiederholbar, gemessen am Inhalt

Das System SHALL bei jedem Lauf den übertragenen Bestand in DEV **vollständig
ersetzen**, nicht abgleichen. Zwei Läufe **aus demselben gespeicherten Auszug**
SHALL zum selben Zielzustand führen.

Die Wiederholbarkeit SHALL am Manifest gemessen werden — Zeilenhashes und
Objektprüfsummen —, nicht an Zeilen- und Objektzahlen. Gleiche Zahlen beweisen
weder gleichen Inhalt noch Idempotenz.

Zwei Läufe gegen die **laufende** Quelle SHALL NOT als Idempotenzbeleg gelten:
sie können verschiedene Stände gelesen haben.

Der Vollersatz SHALL der Grund für die Wiederholbarkeit sein: ein zeilenweiser
Abgleich müsste für jede künftig angelegte Tabelle `upsert`-treu gehalten werden
und veraltete still — eine neue Spalte würde nicht übertragen, und kein Test
könnte es bemerken.

#### Scenario: Zweimal aus demselben Auszug ergibt denselben Inhalt

- **WHEN** derselbe gespeicherte Auszug zweimal eingespielt wird
- **THEN** stimmen Zeilenhashes und Objektprüfsummen nach beiden Läufen überein

#### Scenario: Ein Bestand, den der Auszug nicht trägt, verschwindet

- **WHEN** in DEV Zeilen stehen, die der Auszug nicht enthält
- **THEN** sind sie fort, sofern sie nicht zum benannten DEV-Bestand gehören

### Requirement: Der benannte DEV-Bestand ist deklariert und wird verglichen

Das System SHALL nach dem Ersetzen einen Nachbereitungsschritt ausführen, der
den Bestand herstellt, den DEV braucht und PROD nicht kennt.

Dieser Bestand SHALL an **einer** Stelle deklariert sein und nach dem Lauf
gegen die Deklaration verglichen werden. Er SHALL NOT dadurch entstehen, dass
der Ersatz bestimmte Zeilen „auslässt" — was ausgelassen wird, ist nicht
prüfbar; was hergestellt wird, ist es.

Die Abnahme SHALL ein **Manifestvergleich mit benannten Abweichungen** sein:
DEV trägt den Bestand des Auszugs **plus** den deklarierten DEV-Bestand. Eine
Abnahme, die gleiche Zeilenzahlen in allen Tabellen fordert, SHALL NOT
formuliert werden — sie ist mit dem Nachbereitungsschritt unvereinbar und damit
unerfüllbar.

Der Nachbereitungsschritt SHALL die Stelle sein, an der eine spätere
Anonymisierung ansetzt.

#### Scenario: Der deklarierte Bestand ist danach vollständig da

- **WHEN** ein Lauf abgeschlossen ist
- **THEN** entspricht der DEV-eigene Bestand der Deklaration — verglichen, nicht
  angenommen

#### Scenario: Die Demo-Zugänge sind anmeldefähig, nicht nur vorhanden

- **WHEN** ein Lauf abgeschlossen ist
- **THEN** kann sich jeder deklarierte Demo-Zugang anmelden, und sein Profil
  trägt die deklarierten Angaben — nicht die leere `basic`-Zeile, die der
  Signup-Trigger anlegt

#### Scenario: Die Abnahme rechnet die Abweichungen ein

- **WHEN** die Zahlen nach dem Lauf geprüft werden
- **THEN** wird gegen „Auszug plus deklarierter DEV-Bestand" verglichen, nicht
  gegen den Auszug allein

### Requirement: Der Auszug ist erst dann eine Sicherung, wenn er zurückgespielt wurde

Das System SHALL den Auszug so aufbewahren und beschreiben, dass er als
Rückweg für den PROD-Neuaufbau taugt: Wiederherstellungsziel, enthaltene Daten,
der Weg ins Format des bestehenden Importwegs, und Aufbewahrung mit eindeutigen,
einander nicht überschreibenden Namen.

Die Tauglichkeit SHALL durch einen vollständigen Wiederherstellungslauf gegen
ein **leeres Schema** belegt sein. Ohne diesen Beleg SHALL der Auszug NOT als
Sicherung bezeichnet werden — der Neuaufbauplan verlangt den Rückimport über den
bestehenden Importweg, nicht das rohe Wiedereinspielen von Tabellen.

#### Scenario: Der Rückweg ist einmal gegangen worden

- **WHEN** der Auszug gegen ein leeres, frisch migriertes Schema eingespielt
  wird
- **THEN** entsteht daraus der Bestand des Manifests, und die Konten sind
  anmeldefähig

#### Scenario: Ein Lauf überschreibt den vorigen Auszug nicht

- **WHEN** zwei Läufe nacheinander stattfinden
- **THEN** liegen zwei unterscheidbare Auszüge vor

### Requirement: Der Lauf wird angestossen und läuft nicht von selbst

Das System SHALL den Spiegel ausschließlich auf ausdrückliche Ausführung hin
starten. Es SHALL NOT einen Zeitplan einrichten, der ihn wiederkehrend auslöst.

Der Grund SHALL festgehalten sein: jeder Lauf verwirft den Arbeitsstand auf DEV,
und bis zur Umschaltung auf PROD liest die ausgelieferte Fläche diese Datenbank.
Ein Zeitplan darf erst entstehen, wenn der Lauf sich von Hand bewährt hat.

#### Scenario: Das Repository richtet keinen wiederkehrenden Lauf ein

- **WHEN** die Workflows und Zeitpläne des Repositories durchgesehen werden
- **THEN** findet sich kein Eintrag, der den Spiegel zeitgesteuert startet

