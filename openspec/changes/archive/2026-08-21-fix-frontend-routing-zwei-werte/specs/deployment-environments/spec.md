## MODIFIED Requirements

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
