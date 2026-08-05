## ADDED Requirements

### Requirement: Zwei getrennte Supabase-Projekte mit festen Rollen

Das System SHALL zwei getrennte Supabase-Projekte betreiben: ein **PROD**-Projekt,
das ausschließlich echte Mitgliederdaten trägt, und ein **DEV/DEMO**-Projekt, das
ausschließlich Demo-Daten trägt. Die Rollenzuordnung SHALL dauerhaft sein und
SHALL NOT über ein Umgebungs-Flag umschaltbar sein.

Der Wechsel des **Frontend-Laufzeit-Routings** einer Umgebung auf ein anderes
Projekt SHALL ausschließlich durch das Ändern der drei Werte
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` und `SUPABASE_DB_PASSWORD` in der
betreffenden Infisical-Umgebung plus einen Re-Deploy erfolgen. Kein
Anwendungscode SHALL das Zielprojekt kennen oder unterscheiden.

Diese Aussage SHALL NOT auf die übrige projektgebundene Konfiguration ausgedehnt
werden: Migrationsläufe, Function-Bereitstellung und Function-Secrets tragen ihr
Ziel jeweils eigenständig und wandern nicht mit diesen drei Werten mit.

#### Scenario: Der Wechsel des Frontend-Routings lässt die Infrastruktur unberührt

- **WHEN** die drei Frontend-Werte einer Umgebung auf ein anderes Projekt
  gesetzt werden
- **THEN** zeigt das ausgelieferte Bundle auf das neue Projekt, während
  Migrationsziele, Function-Bereitstellung und Function-Secrets unverändert auf
  ihre jeweils eigenen Ziele zeigen

### Requirement: Bis zum Import trägt allein DEV die Rolle beider Umgebungen

Solange der Mitglieder-Import nicht erfolgt ist, SHALL die Infisical-Umgebung
`prod` weiterhin auf das DEV/DEMO-Projekt zeigen. Das PROD-Projekt SHALL in
dieser Zeit vollständig aufgesetzt, aber von keiner ausgelieferten Umgebung
angesprochen werden.

Der Übergang SHALL ein eigener, ausdrücklich ausgeführter Schritt sein und
SHALL NOT als Nebenwirkung des Aufsetzens eintreten.

#### Scenario: Das Aufsetzen von PROD lenkt keinen Verkehr um

- **WHEN** das PROD-Projekt angelegt, migriert und bestückt ist
- **THEN** zeigt `main` weiterhin auf das DEV/DEMO-Projekt, bis die drei
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

Vor jedem Frontend-Deploy SHALL die Pipeline die Migrationshistorie des
PROD-Projekts gegen `supabase/migrations/` vergleichen und den Deploy bei
**jeder** Abweichung abbrechen. Als Abweichung SHALL gelten: lokal vorhandene,
remote fehlende Migrationen; remote vorhandene, lokal fehlende; sowie eine
abweichende Reihenfolge. Diese Prüfung SHALL fehlschlagen, wenn sie nicht
durchgeführt werden kann — ein fehlendes Secret oder eine nicht erreichbare
Datenbank SHALL NOT als „keine Abweichung" gewertet werden.

Die Prüfung SHALL gegen denselben Commit erfolgen, den der Frontend-Deploy
ausliefert.

Der Frontend-Deploy SHALL auch dann unterbleiben, wenn der automatische Lauf
gegen DEV fehlgeschlagen ist. Ein Fehlschlag der Frühwarnung SHALL NOT folgenlos
bleiben.

Der Lauf gegen PROD SHALL eine ausdrückliche Freigabe erfordern und SHALL vor
dem Anwenden den aufgelösten Zielhost sowie die Liste der anzuwendenden
Migrationen ausgeben. Er SHALL abbrechen, wenn für denselben Commit kein
erfolgreicher Lauf gegen DEV vorliegt.

Es SHALL keinen Weg geben, die Prüfung zu übergehen. Dass eine ausstehende
Migration auch einen von ihr unabhängigen Frontend-Deploy blockiert, ist die
beabsichtigte Folge.

#### Scenario: Frontend deployt nicht, während Migrationen fehlen

- **WHEN** ein Merge auf `main` Code enthält, der eine noch nicht auf PROD
  angewendete Migration voraussetzt
- **THEN** bricht die Pipeline vor dem Frontend-Deploy ab, statt eine
  Oberfläche live zu stellen, deren Datenbank sie nicht trägt

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

- **WHEN** auf dem PROD-Projekt eine Migration verzeichnet ist, die es lokal
  nicht gibt
- **THEN** bricht die Prüfung ab, statt nur in die andere Richtung zu vergleichen

#### Scenario: Das Gate schweigt nicht bei Nichtwissen

- **WHEN** dem Drift-Gate die Zugangsdaten zum PROD-Projekt fehlen
- **THEN** schlägt es fehl, statt den Deploy durchzulassen

#### Scenario: Eine fehlgeschlagene Generalprobe hält den Deploy an

- **WHEN** der automatische Lauf gegen DEV fehlschlägt, während PROD
  abweichungsfrei ist
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

#### Scenario: Ein erbeuteter DEV-Zugang öffnet PROD nicht

- **WHEN** die Zugangsdaten der DEV/DEMO-Datenbank bekannt werden
- **THEN** gewähren sie keinen Zugriff auf das PROD-Projekt

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
