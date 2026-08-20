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

#### Scenario: Echte Daten auf DEV verletzen die Rollentrennung nicht

- **WHEN** DEV eine Kopie der PROD-Daten trägt
- **THEN** bleibt die Rollentrennung gewahrt, weil PROD weiterhin die einzige
  Quelle ist und der Bestand auf DEV jederzeit ersetzt werden darf

#### Scenario: Es gibt keinen Weg zurück nach PROD

- **WHEN** die Betriebswerkzeuge des Repositories durchgesehen werden
- **THEN** findet sich keines, das DEV als Quelle und PROD als Ziel trägt
