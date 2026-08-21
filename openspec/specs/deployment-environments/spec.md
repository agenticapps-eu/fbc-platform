# Deployment-Umgebungen

## Purpose

Hält fest, wie sich die Produktivumgebung von der Entwicklungs-/Demo-Umgebung
unterscheidet und wie Änderungen an der Datenbank von der einen in die andere
gelangen. Entstanden mit AGE-496 (C4), das den Zustand aus ADR-0003 ablöst — bis
dahin teilten sich `dev` und `prod` **ein** Supabase-Projekt. Entscheidung:
`docs/decisions/0004-split-prod-dev-supabase.md`, Betriebsanleitung:
`docs/supabase-environments.md`.

Die tragende Idee ist nicht „zwei Projekte", sondern: **kein schreibender Befehl
bestimmt sein Ziel über einen unsichtbaren Zustand**, und **keine Prüfung wird
grün, weil sie nicht messen konnte**.
## Requirements
### Requirement: Zwei getrennte Supabase-Projekte mit festen Rollen

Das System SHALL zwei getrennte Supabase-Projekte betreiben: ein **PROD**-Projekt
und ein **DEV/DEMO**-Projekt. Die Rollenzuordnung SHALL dauerhaft sein und
SHALL NOT über ein Umgebungs-Flag umschaltbar sein.

Die Rollentrennung SHALL auf der **Schreibrichtung** ruhen, nicht auf der Art
der Daten: **PROD ist die einzige Quelle der Wahrheit, DEV ein ersetzbares
Abbild.** DEV SHALL echte Mitgliederdaten tragen dürfen, sofern sie als Kopie
aus PROD stammen und jederzeit verworfen werden können. Ein Datum, das nur auf
DEV existiert, SHALL NOT als erhaltenswert behandelt werden — ausgenommen der
ausdrücklich benannte DEV-Bestand aus `environment-sync`.

Kein Vorgang SHALL Daten von DEV nach PROD übertragen.

Der Wechsel des **Frontend-Laufzeit-Routings** einer Umgebung auf ein anderes
Projekt SHALL ausschließlich durch das Ändern der zwei Werte
`VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` in der betreffenden
Infisical-Umgebung plus einen Re-Deploy erfolgen. Beide SHALL dabei stets
gemeinsam und auf dasselbe Projekt gesetzt werden. Kein Anwendungscode SHALL das
Zielprojekt kennen oder unterscheiden.

Die Aufzählung SHALL abschließend sein: kein weiterer Wert SHALL für den Wechsel
des Frontend-Routings gesetzt werden müssen. Insbesondere SHALL
`SUPABASE_DB_PASSWORD` für diesen Wechsel NOT erforderlich sein und SHALL NOT im
ausgelieferten Client-Bundle erscheinen.

Diese Aussage SHALL NOT auf die übrige projektgebundene Konfiguration ausgedehnt
werden: Migrationsläufe, Function-Bereitstellung und Function-Secrets tragen ihr
Ziel jeweils eigenständig und wandern nicht mit diesen zwei Werten mit.

#### Scenario: Der Wechsel des Frontend-Routings lässt die Infrastruktur unberührt

- **WHEN** die zwei Frontend-Werte einer Umgebung auf ein anderes Projekt
  gesetzt werden
- **THEN** zeigt das ausgelieferte Bundle auf das neue Projekt, während
  Migrationsziele, Function-Bereitstellung und Function-Secrets unverändert auf
  ihre jeweils eigenen Ziele zeigen

#### Scenario: Das Datenbank-Passwort erreicht das Bundle nicht

- **WHEN** ein Build mit gesetztem `SUPABASE_DB_PASSWORD` erzeugt und das
  Erzeugnis nach diesem Wert durchsucht wird
- **THEN** kommt er darin nicht vor, während `VITE_SUPABASE_URL` darin
  auffindbar ist — ein Wechsel, der `SUPABASE_DB_PASSWORD` mitsetzt, ändert am
  Bundle also nichts

#### Scenario: Echte Daten auf DEV verletzen die Rollentrennung nicht

- **WHEN** DEV eine Kopie der PROD-Daten trägt
- **THEN** bleibt die Rollentrennung gewahrt, weil PROD weiterhin die einzige
  Quelle ist und der Bestand auf DEV jederzeit ersetzt werden darf

#### Scenario: Es gibt keinen Weg zurück nach PROD

- **WHEN** die Betriebswerkzeuge des Repositories durchgesehen werden
- **THEN** findet sich keines, das DEV als Quelle und PROD als Ziel trägt

### Requirement: Bis zum Import trägt allein DEV die Rolle beider Umgebungen

Solange der Mitglieder-Import nicht erfolgt ist, SHALL die Infisical-Umgebung
`prod` weiterhin auf das DEV/DEMO-Projekt zeigen. Das PROD-Projekt SHALL in
dieser Zeit vollständig aufgesetzt, aber von keiner ausgelieferten Umgebung
angesprochen werden.

Der Übergang SHALL ein eigener, ausdrücklich ausgeführter Schritt sein und
SHALL NOT als Nebenwirkung des Aufsetzens eintreten.

#### Scenario: Das Aufsetzen von PROD lenkt keinen Verkehr um

- **WHEN** das PROD-Projekt angelegt, migriert und bestückt ist
- **THEN** zeigt `main` weiterhin auf das DEV/DEMO-Projekt, bis die zwei
  Frontend-Werte bewusst umgestellt werden

#### Scenario: Demo-Daten erreichen PROD nicht

- **WHEN** ein Migrations-Push gegen das PROD-Projekt läuft
- **THEN** wird keine Demo-Persona angelegt, weil das Repository keine
  `supabase/seed.sql` enthält und der Demo-Seed ein eigener, ausdrücklich
  bestätigter Lauf ist

#### Scenario: Ein Umgebungs-Flag kann die Zuordnung nicht umkehren

- **WHEN** `VITE_ENVIRONMENT` auf einen anderen Wert gesetzt wird
- **THEN** ändert sich das angesprochene Supabase-Projekt nicht, weil
  `VITE_ENVIRONMENT` ausschließlich ein Anzeige-Label ist

### Requirement: Das Repository trägt keine Seed-Datei, die `db push` mitnehmen kann

Das System SHALL keine `supabase/seed.sql` führen. `supabase/config.toml`
verweist unter `[db.seed]` auf diesen Pfad; solange die Datei nicht existiert,
kann `supabase db push` — auch mit `--include-seed` — keine Demo-Daten auf ein
Zielprojekt übertragen.

Diese Abwesenheit SHALL als Sicherheitseigenschaft behandelt werden: wer eine
`seed.sql` anlegt, hebt sie auf.

#### Scenario: `--include-seed` gegen PROD bleibt folgenlos

- **WHEN** `supabase db push --include-seed` gegen das PROD-Projekt läuft
- **THEN** werden nur Migrationen angewendet und keine Seed-Daten geschrieben

### Requirement: Migrationen erreichen DEV automatisch und PROD nur bewusst

Das System SHALL `supabase/migrations/` als einzige Quelle des Schemas beider
Projekte führen. Nach einem Merge auf `main` SHALL die Deploy-Pipeline alle
ausstehenden Migrationen automatisch auf das DEV-Projekt anwenden. Auf das
PROD-Projekt SHALL sie ausschließlich durch einen ausdrücklich ausgelösten Lauf
angewendet werden.

Vor jedem Frontend-Deploy SHALL die Pipeline die Migrationshistorie **desjenigen
Projekts, das der auszuliefernde Build anspricht**, gegen `supabase/migrations/`
vergleichen und den Deploy bei **jeder** Abweichung abbrechen. Das zu messende
Projekt SHALL aus derselben Quelle stammen wie der Build selbst — nicht aus einer
zweiten, nachzuführenden Angabe. Lässt sich das angesprochene Projekt keinem der
beiden versionierten Projekt-Refs zuordnen, SHALL die Prüfung fehlschlagen.

Diese Wahl ist keine Lockerung, sondern die Auflösung eines Widerspruchs: solange
„Bis zum Import trägt allein DEV die Rolle beider Umgebungen" gilt, ist das
PROD-Projekt nicht die Datenbank des ausgelieferten Frontends, und eine Prüfung
gegen es beantwortet die Frage nicht, die das Gate stellt.

Als Abweichung SHALL gelten: lokal vorhandene, remote fehlende Migrationen;
remote vorhandene, lokal fehlende; sowie eine abweichende Reihenfolge. Diese
Prüfung SHALL fehlschlagen, wenn sie nicht durchgeführt werden kann — ein
fehlendes Secret oder eine nicht erreichbare Datenbank SHALL NOT als „keine
Abweichung" gewertet werden.

Die Prüfung SHALL gegen denselben Commit erfolgen, den der Frontend-Deploy
ausliefert. Sie SHALL erst laufen, nachdem der automatische Lauf gegen DEV
abgeschlossen ist — andernfalls misst sie das DEV-Projekt vor dessen eigener
Migration und scheitert an der Reihenfolge der Pipeline statt an einer echten
Abweichung.

Jeder Lauf SHALL das gemessene Projekt im Protokoll nennen, auch der
unauffällige. Der Migrationsstand des jeweils **nicht** gemessenen Projekts SHALL
zusätzlich ermittelt und berichtet werden, ohne den Deploy zu blockieren; er ist
die Frühwarnung für den nächsten Lauf gegen PROD, nicht eine zweite Zusage.

Der Frontend-Deploy SHALL auch dann unterbleiben, wenn der automatische Lauf
gegen DEV fehlgeschlagen ist. Ein Fehlschlag der Frühwarnung SHALL NOT folgenlos
bleiben.

Der Lauf gegen PROD SHALL ausschließlich von Hand ausgelöst werden können und
SHALL vor dem Anwenden den aufgelösten Zielhost sowie die Liste der
anzuwendenden Migrationen ausgeben. Er SHALL abbrechen, wenn für denselben
Commit kein erfolgreicher Lauf gegen DEV vorliegt. Der schreibende Schritt
SHALL sein eigenes Ziel prüfen, nicht nur ein vorgelagerter Schritt in einem
anderen Lauf.

**Stand 2026-08-05:** eine _zusätzliche_ Freigabe durch einen zweiten Menschen
(geschützte Umgebung mit Reviewer-Regel) ist bewusst **zurückgestellt**, weil
derzeit nur eine Person am Repository schreibt. Der Auslöser von Hand bleibt
damit die einzige Kontrolle vor dem Anwenden — der ausgegebene Dry-Run steht im
Log, aber niemand muss ihn gelesen haben. Sobald ein zweiter Mensch
Schreibrechte erhält, SHALL die Reviewer-Regel gesetzt werden.

**Stand 2026-08-13:** solange das ausgelieferte Frontend das DEV-Projekt
anspricht, misst das Gate eine Datenbank, die unmittelbar zuvor im selben Lauf
automatisch migriert wurde. Es SHALL in dieser Zeit als Nachkontrolle des
automatischen Laufs verstanden werden und nicht als Zusage, dass ein Mensch die
Migration freigegeben hätte; die Zusage, die in dieser Phase trägt, ist der
Abbruch des Deploys bei fehlgeschlagenem DEV-Lauf. Mit dem Umzug auf das
PROD-Projekt greift dieselbe Regel wieder als vollwertiges Gate, ohne Änderung
am Text.

Es SHALL keinen Weg geben, die Prüfung zu übergehen. Dass eine ausstehende
Migration auch einen von ihr unabhängigen Frontend-Deploy blockiert, ist die
beabsichtigte Folge.

#### Scenario: Frontend deployt nicht, während Migrationen fehlen

- **WHEN** ein Merge auf `main` Code enthält, der eine noch nicht auf dem
  angesprochenen Projekt angewendete Migration voraussetzt
- **THEN** bricht die Pipeline vor dem Frontend-Deploy ab, statt eine
  Oberfläche live zu stellen, deren Datenbank sie nicht trägt

#### Scenario: Das Gate misst das Projekt des ausgelieferten Builds

- **WHEN** die Infisical-Umgebung, mit der `main` baut, auf das DEV-Projekt zeigt
- **THEN** vergleicht das Gate gegen das DEV-Projekt und nicht gegen das
  PROD-Projekt, und nennt das gemessene Projekt im Protokoll

#### Scenario: Ein unbekanntes Projekt macht das Gate rot

- **WHEN** das vom Build angesprochene Projekt weder dem Ref in
  `scripts/dev-project-ref.txt` noch dem in `scripts/prod-project-ref.txt`
  entspricht
- **THEN** schlägt das Gate fehl, statt sich auf eines der beiden zu verlegen

#### Scenario: Das Gate misst erst nach dem automatischen Lauf gegen DEV

- **WHEN** derselbe Lauf Migrationen auf DEV anwendet und das DEV-Projekt zugleich
  das Ziel der Prüfung ist
- **THEN** läuft die Prüfung erst nach dem Anwenden, sodass sie den Stand nach der
  Migration misst

#### Scenario: Der Stand des anderen Projekts wird berichtet, nicht erzwungen

- **WHEN** das gemessene Projekt abweichungsfrei ist, das jeweils andere aber
  Migrationen vermissen lässt
- **THEN** steht dieser Rückstand im Protokoll und der Deploy läuft weiter

#### Scenario: Eine Migration scheitert an vorhandenen Zeilen, bevor sie PROD erreicht

- **WHEN** eine Migration gegen eine leere Datenbank sauber läuft, aber an
  vorhandenen Zeilen scheitert — etwa eine `not null`-Ergänzung ohne Default
  auf einer nicht leeren Tabelle
- **THEN** scheitert sie beim automatischen Lauf gegen DEV und erreicht PROD
  nicht

> Diese Zusage reicht nur so weit wie DEVs Datenbestand. DEV trägt Demo-Daten;
> was an der Beschaffenheit echter Mitgliederdaten hängt — Dubletten unter einem
> neuen Unique-Index, gewachsene Altwerte, Kardinalitäten — fängt es nicht. Der
> Lauf gegen PROD bleibt deshalb ein gelesener Dry-Run, kein Durchreichen.

#### Scenario: Remote-only-Drift fällt ebenfalls auf

- **WHEN** auf dem gemessenen Projekt eine Migration verzeichnet ist, die es lokal
  nicht gibt
- **THEN** bricht die Prüfung ab, statt nur in die andere Richtung zu vergleichen

#### Scenario: Das Gate schweigt nicht bei Nichtwissen

- **WHEN** dem Drift-Gate die Zugangsdaten zum gemessenen Projekt fehlen oder das
  angesprochene Projekt nicht bestimmt werden kann
- **THEN** schlägt es fehl, statt den Deploy durchzulassen

#### Scenario: Eine fehlgeschlagene Generalprobe hält den Deploy an

- **WHEN** der automatische Lauf gegen DEV fehlschlägt, während das gemessene
  Projekt abweichungsfrei ist
- **THEN** unterbleibt der Frontend-Deploy, statt an der stillen Frühwarnung
  vorbeizulaufen

#### Scenario: Ein Lauf gegen PROD ohne vorherige Generalprobe unterbleibt

- **WHEN** ein Lauf gegen PROD für einen Commit ausgelöst wird, für den kein
  erfolgreicher DEV-Lauf vorliegt
- **THEN** bricht er ab

### Requirement: Ein Push auf PROD nennt sein Ziel und verlangt eine getippte Bestätigung

Das System SHALL einen von `pnpm db:push` getrennten, ausdrücklich benannten Weg
für Migrations-Pushes auf PROD bereitstellen. Dieser Weg SHALL sein Ziel aus
einer eigenen, für PROD bestimmten Verbindungszeichenfolge beziehen und SHALL
NOT vom verlinkten Projekt abhängen.

Der Weg SHALL das Ziel **maschinell** prüfen, bevor ein Mensch etwas bestätigt:
der aus der Verbindungszeichenfolge abgeleitete Projekt-Ref SHALL gegen einen im
Repository festgeschriebenen Sollwert gehalten werden, und bei Abweichung SHALL
abgebrochen werden. Der erwartete Ref SHALL NOT aus derselben Quelle stammen,
die geprüft wird.

Danach SHALL der Weg den **aufgelösten** Zielhost anzeigen, die Liste der
anzuwendenden Migrationen ausgeben und eine Bestätigung verlangen, die den
Projekt-Ref trägt. Eine Bestätigung durch ein Flag oder eine Ja/Nein-Eingabe
SHALL NOT genügen.

Der Weg SHALL das Mitführen von Seed-Daten ausdrücklich zurückweisen, statt sich
darauf zu verlassen, dass die konfigurierte Seed-Datei nicht existiert.

#### Scenario: Eine falsch hinterlegte Verbindung wird abgewiesen, ohne einen Menschen zu fragen

- **WHEN** die für PROD hinterlegte Verbindungszeichenfolge auf ein anderes
  Projekt zeigt
- **THEN** bricht der Ablauf ab, bevor er eine Bestätigung anfordert, weil der
  abgeleitete Ref nicht zum festgeschriebenen Sollwert passt

> Ohne die unabhängige Quelle wäre die Prüfung zirkulär: eine falsche
> Verbindung zeigte einen falschen Host, der Mensch tippte den falschen Ref ab,
> und die Bestätigung ginge durch.

#### Scenario: Die Bestätigung lässt sich nicht versehentlich geben

- **WHEN** ein Bedienender die Bestätigung gedankenlos quittiert
- **THEN** wird nichts angewendet, weil die Eingabe den Projekt-Ref des Ziels
  tragen muss

#### Scenario: Seed-Daten werden nicht mitgeführt

- **WHEN** ein Lauf gegen PROD das Mitführen von Seed-Daten verlangt
- **THEN** wird er zurückgewiesen, unabhängig davon, ob eine Seed-Datei
  vorhanden ist

### Requirement: Jedes Projekt trägt eigene Datenbank-Zugangsdaten

Das System SHALL für PROD und DEV/DEMO getrennte Datenbank-Zugangsdaten führen.
Ein Passwort SHALL NOT für beide Projekte gelten.

**Diese Zusage gilt für die Datenbank — für die Function-Secrets gilt sie nur
teilweise.** Am 2026-08-05 gemessen: von fünfzehn selbst gesetzten
Edge-Function-Secrets sind drei getrennt und zwölf auf beiden Projekten
byte-identisch (Transaktionsmail-Schlüssel und die Zahlungsanbieter-Werte).
Das ist heute tragbar, weil der Zahlungsanbieter im Testmodus läuft. Sobald ein
produktiver Zahlungsschlüssel gesetzt wird, SHALL er ausschließlich auf PROD
gesetzt werden und NOT aus der DEV-Umgebung übernommen werden.

#### Scenario: Ein erbeuteter DEV-Datenbankzugang öffnet die PROD-Datenbank nicht

- **WHEN** die Zugangsdaten der DEV/DEMO-Datenbank bekannt werden
- **THEN** gewähren sie keinen Zugriff auf das PROD-Projekt

#### Scenario: Ein geteiltes Function-Secret ist kein getrenntes Zugangsdatum

- **WHEN** ein Function-Secret auf beiden Projekten denselben Wert trägt
- **THEN** öffnet die Kenntnis des DEV-Werts auch den entsprechenden Weg auf PROD
- **AND** dieser Fall SHALL benannt sein statt als getrennt zu gelten

### Requirement: Edge Functions und ihre Secrets gehören zum Aufsetzen eines Projekts

Das System SHALL beim Aufsetzen eines Zielprojekts alle im Repository geführten
Edge Functions dorthin ausliefern und ihre nicht plattform-injizierten Secrets
für dieses Projekt setzen. Secrets, die die Plattform selbst bereitstellt,
SHALL NOT gesetzt werden.

Adressbezogene Secrets SHALL den Wert des jeweiligen Projekts tragen und
SHALL NOT von einem anderen Projekt übernommen werden.

Jede ausgelieferte Function SHALL daraufhin geprüft werden, dass sie eine
unberechtigte Anfrage **zurückweist**. Dass sie antwortet, SHALL NOT als
Nachweis gelten, dass ihre Secrets gesetzt sind.

#### Scenario: Eine Function ohne Secret fällt bei der Abnahme auf

- **WHEN** eine ausgelieferte Function ohne ihr Secret angesprochen wird
- **THEN** zeigt die Abnahme das, weil sie die Zurückweisung prüft und nicht
  die bloße Erreichbarkeit

### Requirement: Geänderte Edge Functions erreichen beide Projekte ohne Zutun

Ändert sich eine Edge Function im Repository, SHALL das System sie nach dem
Zusammenführen auf **beide** Zielprojekte ausliefern, ohne dass jemand daran
denken muss. Andernfalls trägt das Repository einen Stand, den kein Projekt
ausführt — und weil nichts diesen Unterschied anzeigt, gilt die Änderung als
ausgeliefert, obwohl sie es nicht ist.

Das SHALL für **alle** im Repository geführten Functions gelten, nicht nur für
die einer bestimmten Fachlichkeit.

Ausgeliefert SHALL nur werden, was sich geändert hat. Ein pauschales Ausliefern
aller Functions SHALL NOT stattfinden: Es überschriebe einen bewusst
abweichenden Stand auf einem Projekt, ohne dass jemand es bemerkt. Was dabei
übergangen wird, SHALL **namentlich** protokolliert werden — eine Beschränkung,
die nicht ausgesprochen wird, liest sich hinterher wie Vollständigkeit.

Das Ausliefern SHALL denselben Vorbedingungen unterliegen wie das Ausliefern der
Anwendung. Eine Function kann eine Datenbankfunktion aufrufen, die auf einem
Projekt noch nicht angelegt ist; liefe sie voraus, wäre die Function dort
sofort kaputt. Weicht der Migrationsstand eines Zielprojekts vom Repository ab,
SHALL deshalb **weder** Anwendung **noch** Function ausgeliefert werden.

Nach dem Ausliefern SHALL das System je Projekt nachlesen, welche Fassung dort
nun läuft, und das protokollieren. Dass ein Befehl ohne Fehler zurückkam,
SHALL NOT als Nachweis gelten, dass das Ziel den neuen Stand trägt.

Das Ziel SHALL aus einer versionierten Datei des Repositories stammen und
SHALL NOT allein aus einem Secret. Ein Ziel, das nur im Secret steht, ist im
Review nicht sichtbar.

Als geändert SHALL gelten, was sich seit dem zuletzt **nachweislich
ausgelieferten** Stand geändert hat — nicht, was sich seit dem vorigen Commit
geändert hat. Sonst fällt jede Änderung, deren Auslieferung ausfiel oder
übersprungen wurde, dauerhaft heraus: der nächste Lauf sieht sie nicht mehr an,
und nichts holt sie je nach. Wovon ausgegangen wird, SHALL das System **selbst
gemessen** haben — dass eine Auslieferung stattfand, SHALL NOT aus dem Ergebnis
anderer Arbeitsschritte erschlossen werden.

Lässt sich dieser Stand nicht ermitteln, SHALL das System auf den vorigen Commit
zurückfallen, das **ausdrücklich** melden — und der Lauf SHALL NOT als Nachweis
einer Auslieferung gelten. Andernfalls würde er selbst zum Ausgangspunkt des
nächsten Vergleichs und verwandelte damit eine vorübergehende Lücke in eine
dauerhafte: was vor ihm ausfiel, läge ab dann außerhalb jedes künftigen
Vergleichs, und nichts könnte es je wieder herleiten.

Die gewählte Vergleichsbasis und der Grund für ihre Wahl SHALL bei **jedem** Lauf
protokolliert werden, auch im Normalfall — eine Basis, die nur im Ausnahmefall
genannt wird, ist im Normalfall unbelegt.

Ein Fehlschlag beim Ermitteln des Standes SHALL vom Zustand „es gibt ihn nicht"
unterscheidbar gemeldet werden. Ein dauerhafter Schaden — etwa eine Suche, die
ins Leere greift, weil sich benannte Voraussetzungen geändert haben — SHALL NOT
dieselbe Meldung erzeugen wie ein vorübergehender Zustand, sonst liest er sich
als Rauschen.

#### Scenario: Eine geänderte Function geht auf beide Projekte

- **GIVEN** ein Merge verändert genau eine Edge Function
- **WHEN** die Auslieferung läuft
- **THEN** trägt diese Function auf **beiden** Projekten den neuen Stand, und
  das Protokoll nennt für jedes Projekt die dort laufende Fassung

#### Scenario: Unveränderte Functions bleiben unangetastet

- **GIVEN** auf einem Projekt liegt für eine Function bewusst ein älterer Stand
- **WHEN** ein Merge eine **andere** Function verändert
- **THEN** bleibt der ältere Stand erhalten, und das Protokoll nennt die
  übergangene Function beim Namen

#### Scenario: Ein Merge ohne Function-Änderung liefert nichts aus

- **WHEN** ein Merge keine Edge Function berührt
- **THEN** wird nichts ausgeliefert, und das Protokoll sagt das ausdrücklich,
  statt zu schweigen

#### Scenario: Eine ausgefallene Auslieferung wird nachgeholt

- **GIVEN** ein Merge verändert eine Edge Function, und ihre Auslieferung fällt
  aus oder wird übersprungen — etwa weil der Migrationsstand abwich
- **WHEN** ein **späterer** Merge läuft, der diese Function nicht anfasst
- **THEN** wird sie trotzdem ausgeliefert, weil der Vergleich beim zuletzt
  ausgelieferten Stand ansetzt und nicht beim vorigen Commit

#### Scenario: Die Vergleichsbasis steht in jedem Protokoll

- **WHEN** die Auslieferung läuft
- **THEN** nennt das Protokoll die gewählte Vergleichsbasis und den Grund ihrer
  Wahl — auch dann, wenn nichts auszuliefern war

#### Scenario: Unermittelbare Basis fällt zurück und sagt es

- **GIVEN** der zuletzt ausgelieferte Stand ist nicht zu ermitteln
- **WHEN** die Auslieferung läuft
- **THEN** wird gegen den vorigen Commit verglichen und ausgeliefert, der Lauf
  gilt aber **nicht** als erfolgreich — sonst wäre er der Ausgangspunkt des
  nächsten Vergleichs

#### Scenario: Nach einem Rückfall holt der nächste Lauf die Lücke nach

- **GIVEN** ein Lauf musste auf den vorigen Commit zurückfallen und gilt deshalb
  nicht als Nachweis
- **WHEN** der nächste Merge läuft
- **THEN** setzt er beim letzten **echten** Nachweis an, und alles seither
  Übersprungene liegt wieder im Vergleich

#### Scenario: Abweichender Migrationsstand hält auch die Functions an

- **GIVEN** das Repository trägt Migrationen, die ein Zielprojekt noch nicht
  angewendet hat
- **WHEN** ein Merge eine Edge Function verändert
- **THEN** wird sie nicht ausgeliefert — sonst riefe sie dort eine
  Datenbankfunktion auf, die es noch nicht gibt

### Requirement: Datenbankobjekte außerhalb der Migrationen sind benannt und werden geprüft

Das System SHALL jedes Datenbankobjekt, das bewusst nicht als Migration geführt
wird, in `docs/supabase-environments.md` benennen und begründen. Beim Aufsetzen
eines Zielprojekts SHALL geprüft werden, ob die Datenbank Objekte enthält, die in
keiner Migration vorkommen.

Der Webhook auf `public.contact_requests` — die Funktion
`notify_contact_request_webhook()` und der Trigger `contact_requests_email_webhook`
— SHALL als solches Objekt geführt werden: er trägt einen Bearer-Token inline und
kann deshalb nicht in ein öffentliches Repository. Er SHALL beim Aufsetzen eines
Projekts von Hand angelegt werden, mit dem Projekt-Ref **dieses** Projekts in der
Ziel-URL.

Die Prüfung SHALL nicht nur beim Aufsetzen laufen, sondern bei jedem Lauf gegen
PROD wiederholt werden. Ein nachträglich entferntes oder verändertes Objekt
SHALL auffallen.

Weil der Bearer-Token damit im Schema-Abzug einer Sicherung liegt, SHALL jede
Sicherung außerhalb des Repositories und mit auf den Eigentümer beschränkten
Rechten abgelegt werden.

#### Scenario: Der Mailversand für Kontaktanfragen ist auf einem neuen Projekt nicht still tot

- **WHEN** ein neues Zielprojekt allein per `supabase db push` aufgesetzt wird
- **THEN** meldet die Prüfung den fehlenden Webhook, statt ihn unbemerkt zu
  lassen

#### Scenario: Ein später gelöschter Trigger fällt auf

- **WHEN** der Webhook-Trigger auf PROD nach dem Aufsetzen entfernt wird
- **THEN** meldet die nächste Prüfung im Zuge eines PROD-Laufs sein Fehlen,
  statt den Mailversand still sterben zu lassen

### Requirement: Die Umgebung ist in der laufenden Anwendung erkennbar

Das System SHALL in jeder Umgebung, die nicht PROD ist, einen dauerhaft
sichtbaren Hinweis anzeigen, der sie als Nicht-Produktion ausweist. Der Hinweis
SHALL aus `VITE_ENVIRONMENT` abgeleitet werden und SHALL in PROD nicht erscheinen.

#### Scenario: Zwei gleich aussehende Umgebungen bleiben unterscheidbar

- **WHEN** DEV und PROD dieselbe Oberfläche zeigen
- **THEN** trägt allein DEV den Hinweis, sodass eine Handlung in der falschen
  Umgebung auffällt, bevor sie Daten berührt

