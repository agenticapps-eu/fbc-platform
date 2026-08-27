## ADDED Requirements

### Requirement: Kein Inhalt liegt unter Notch, Statusleiste oder Home-Indikator

Die Anwendung SHALL die sicheren Bereiche des Geräts achten. Flächen, die den
Fensterrand berühren — die Kopfzeile, die beiden angedockten Leisten und das
Chatfenster —, SHALL ihren Abstand zum Rand um die jeweiligen
`env(safe-area-inset-*)` ergänzen.

Das Dokument SHALL dafür `viewport-fit=cover` in seiner `viewport`-Angabe
tragen. **Ohne diese Angabe sind sämtliche `env(safe-area-inset-*)` null** — die
Abstände zu setzen und das Meta zu vergessen, sieht aus wie erledigt und wirkt
nicht.

Die Abstände SHALL **ergänzt** und SHALL NOT ersetzt werden. Ein Rand, der auf
einem Gerät ohne Notch zu null wird, nimmt dort den gestalteten Abstand mit.

Dies ist die senkrechte Fortsetzung der Zusage, dass sich keine Seite seitlich
schieben lässt. Sie SHALL wie jene **auf dem Gerät** geprüft werden und SHALL
NOT in einer Testumgebung ohne echte Insets als erfüllt gelten: dort sind alle
Insets null, und eine Zusage darüber wäre grün, gleich was die Anwendung tut.

#### Scenario: Die Kopfzeile beginnt unter der Statusleiste

- **WHEN** die Anwendung auf einem Gerät mit Notch im Hochformat läuft
- **THEN** liegt kein Text und kein Bedienelement der Kopfzeile unter der
  Statusleiste oder der Notch

#### Scenario: Die unterste Zeile bleibt über dem Home-Indikator

- **WHEN** das Chatfenster auf einem Gerät mit Home-Indikator geöffnet ist
- **THEN** liegt das Eingabefeld vollständig über dem Indikator und ist
  bedienbar

#### Scenario: Ein Gerät ohne Notch verliert seinen Abstand nicht

- **WHEN** dieselbe Fläche auf einem Gerät ohne sichere Bereiche dargestellt
  wird
- **THEN** trägt sie weiterhin den gestalteten Abstand zum Rand
