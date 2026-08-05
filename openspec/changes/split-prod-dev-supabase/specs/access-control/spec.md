## ADDED Requirements

### Requirement: Die Auth-Konfiguration jedes Projekts steht in der Versionskontrolle

Das System SHALL die Auth-Einstellungen eines Supabase-Projekts aus
`supabase/config.toml` beziehen und diese Datei als deren Quelle der Wahrheit
führen. Werte, die nur im Dashboard gesetzt sind, SHALL als abweichend gelten.

Vor dem ersten Übertragen der Datei auf ein bestehendes Projekt SHALL die
Live-Konfiguration dieses Projekts als Rückrollpunkt gesichert werden, weil das
Übertragen jeden dort gesetzten Wert überschreibt — auf jedem Ziel, nicht nur auf
PROD. Dieser Rückrollpunkt SHALL außerhalb des Repositories und mit auf den
Eigentümer beschränkten Rechten abgelegt werden: er kann je nach Projekt
Zugangsdaten für Mailversand oder externe Anmeldeverfahren enthalten.

Ob das Übertragen Felder, die die Datei nicht führt, auf Vorgabewerte
zurücksetzt, SHALL an einem Projekt ohne Daten gemessen werden, bevor die Datei
je auf ein Projekt mit Daten übertragen wird.

Die Datei SHALL die Konfiguration **des PROD-Projekts** führen und SHALL NOT auf
das DEV/DEMO-Projekt übertragen werden. Sie SHALL eine erreichbare `site_url`
tragen und SHALL NOT eine Localhost-Adresse als `site_url` eines gehosteten
Projekts führen.

Die Redirect-Allow-List des PROD-Projekts SHALL ausschließlich Adressen unter
der Kontrolle des Betreibers enthalten. Sie SHALL NOT eine Localhost- oder
Loopback-Adresse enthalten: eine solche Adresse ist auf einem Projekt mit echten
Mitgliedern ein Abflussweg für Anmelde- und Zurücksetzungslinks.

#### Scenario: Ein Anmeldelink kann nicht auf einen fremden Rechner umgeleitet werden

- **WHEN** eine Anmeldung oder Passwort-Zurücksetzung auf PROD eine Umleitung
  auf eine Loopback-Adresse anfordert
- **THEN** wird sie abgelehnt, weil die Allow-List des PROD-Projekts keine
  solche Adresse führt

#### Scenario: Ein Übertragen auf DEV findet nicht statt

- **WHEN** die Datei die strikten PROD-Werte trägt
- **THEN** wird sie nicht auf das DEV/DEMO-Projekt übertragen, dessen
  Konfiguration eigenständig geführt wird

#### Scenario: Ein Übertragen der Konfiguration setzt die Produktion nicht auf localhost

- **WHEN** `supabase/config.toml` auf ein gehostetes Projekt übertragen wird
- **THEN** trägt die Datei die tatsächliche öffentliche Adresse des Projekts, und
  Anmelde- sowie Aktivierungslinks bleiben einlösbar

#### Scenario: Der vorherige Zustand ist wiederherstellbar

- **WHEN** ein Übertragen eine Einstellung verschlechtert
- **THEN** liegt die vorherige Konfiguration als gesicherter Stand vor und kann
  zurückgeschrieben werden

### Requirement: Passwörter und Mail-Ratengrenzen sind für echte Mitglieder ausgelegt

Das System SHALL Passwörter unterhalb von **zehn** Zeichen als zu schwach
zurückweisen.

Das System SHALL auf dem PROD-Projekt **mindestens 30** Auth-Mails pro Stunde
zulassen. Der heutige Wert von 2 blockiert bei ~70 Mitgliedern den Versand für
alle übrigen, sobald zwei Menschen zugleich ihr Passwort zurücksetzen.

Weil eine höhere projektweite Grenze zugleich mehr unaufgeforderte Mail
ermöglicht, SHALL die Zusage nicht allein auf ihr ruhen: die vorhandenen Grenzen
pro Absender-IP für Anmeldung und Zurücksetzung SHALL erhalten bleiben.

Die Bestätigung der E-Mail-Adresse durch Supabase Auth SHALL ausgeschaltet
bleiben; der Aktivierungsweg wird eigenständig über den Transaktionsmail-Dienst
gebaut.

#### Scenario: Mehrere Mitglieder setzen gleichzeitig ihr Passwort zurück

- **WHEN** mehrere Mitglieder innerhalb einer Stunde eine Zurücksetzung anfordern
- **THEN** erhalten alle ihre Mail, weil die Ratengrenze nicht bei einer
  einstelligen Zahl liegt
