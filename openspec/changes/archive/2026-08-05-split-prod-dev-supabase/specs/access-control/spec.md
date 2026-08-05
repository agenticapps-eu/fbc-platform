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

**Korrigiert nach Messung am 2026-08-05.** Der ursprüngliche Entwurf verlangte
hier „mindestens 30 Auth-Mails pro Stunde". Das ist nicht erfüllbar: Supabase
weist eine Erhöhung ab, solange kein eigener SMTP-Server konfiguriert ist —

```
PATCH /v1/projects/<ref>/config/auth  {"rate_limit_email_sent": 30}
→ HTTP 401  Custom SMTP required to configure ... RATE_LIMIT_EMAIL_SENT
```

Eine Anforderung, die das System nicht erfüllen kann, gehört nicht in die
durable Wahrheit — sie wäre in jeder Prüfung grün und im Betrieb falsch.

Das System SHALL einen eigenen SMTP-Dienst als Auth-Mailer verwenden, **bevor**
echte Mitglieder auf „Passwort vergessen" angewiesen sind. Erst damit ist die
projektweite Grenze überhaupt einstellbar; danach SHALL sie **mindestens 30**
Mails pro Stunde zulassen.

Solange das nicht gilt, SHALL der Betrieb wissen, dass die Grenze bei **zwei**
Mails pro Stunde liegt — projektweit, nicht pro Mitglied — und dass das
Zurücksetzen eines Passworts über das Dashboard erfolgt statt über die Mail.

Weil eine höhere projektweite Grenze zugleich mehr unaufgeforderte Mail
ermöglicht, SHALL die Zusage nicht allein auf ihr ruhen: die vorhandenen Grenzen
pro Absender-IP für Anmeldung und Zurücksetzung SHALL erhalten bleiben.

Die Bestätigung der E-Mail-Adresse durch Supabase Auth SHALL ausgeschaltet
bleiben; der Aktivierungsweg wird eigenständig über den Transaktionsmail-Dienst
gebaut.

#### Scenario: Mehrere Mitglieder setzen gleichzeitig ihr Passwort zurück

- **GIVEN** ein eigener SMTP-Dienst ist als Auth-Mailer konfiguriert
- **WHEN** mehrere Mitglieder innerhalb einer Stunde eine Zurücksetzung anfordern
- **THEN** erhalten alle ihre Mail, weil die Ratengrenze nicht bei einer
  einstelligen Zahl liegt

#### Scenario: Solange kein eigener SMTP-Dienst konfiguriert ist

- **GIVEN** der Auth-Mailer ist der eingebaute Dienst der Plattform
- **WHEN** die dritte Zurücksetzung innerhalb einer Stunde angefordert wird
- **THEN** wird keine Mail zugestellt, ohne dass die Oberfläche einen Fehler
  zeigt
- **AND** der Betriebsweg ist das Zurücksetzen im Dashboard, nicht das Warten
  auf die Mail
