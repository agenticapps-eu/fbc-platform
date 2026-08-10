## ADDED Requirements

### Requirement: Eine Selbstregistrierung löst den Bestätigungslink selbst aus

Das System SHALL nach einer erfolgreichen Selbstregistrierung den
Bestätigungslink **ohne weiteres Zutun des Registrierenden** ausgeben und
versenden. Der Versand SHALL über denselben sitzungsgebundenen Weg laufen wie
der Knopf auf dem Aktivierungsbildschirm; ein zweiter Versandweg SHALL NOT
entstehen.

Der Grund ist die Bauart des Zugangs: Ein selbst registriertes Konto trägt
keinen Aktivierungszeitpunkt und steht damit hinter dem Gate, und der Link ist
für dieses Konto die einzige Tür. Ohne einen Auslöser ist die Registrierung eine
Sackgasse, die wie ein Erfolg aussieht.

Der Knopf auf dem Aktivierungsbildschirm SHALL als zweiter Weg bestehen bleiben.
Er ist der Ausweg, wenn der automatische Versand fehlschlägt.

Ein fehlgeschlagener Versand SHALL die Registrierung NICHT ungültig machen: Das
Konto ist angelegt und die Sitzung besteht, bevor der Versand beginnt.

#### Scenario: Registrierung gibt ein Token aus, ohne dass jemand klickt

- **WHEN** sich jemand erfolgreich selbst registriert
- **THEN** ist für sein Profil genau ein Aktivierungstoken ausgegeben, ohne dass
  er den Bestätigungsknopf gedrückt hat

#### Scenario: Der Versand nach der Registrierung schlägt fehl

- **WHEN** die Registrierung erfolgreich war, der anschließende Versand aber
  fehlschlägt
- **THEN** bleiben Konto und Sitzung bestehen, und der Aktivierungsbildschirm
  bietet den Bestätigungsknopf an

### Requirement: Der Aktivierungsbildschirm meldet nur einen Versand, den es gab

Der Aktivierungsbildschirm SHALL einen Versand nur dann als erfolgt melden, wenn
tatsächlich ein Token ausgegeben wurde. Der Status der Anforderung SHALL bis zur
Oberfläche durchgereicht werden.

Eine Anforderung, die an einer Grenze abgewiesen wurde, SHALL NOT wie ein
Versand aussehen. Andernfalls entsteht genau der Fehler, den der automatische
Versand behebt: Der Nutzer wartet auf eine Mail, die niemand abgeschickt hat.

Das ist die unmittelbare Folge des automatischen Versands: Er verbraucht die
Sperrfrist sofort, und die nächste Anforderung innerhalb dieser Frist wird
abgewiesen. Ohne diese Zusage wäre der wahrscheinlichste Fall der, der falsch
gemeldet wird.

Ein **fehlgeschlagener Versand** SHALL ebenfalls als solcher erkennbar sein und
SHALL NOT im selben Zweig landen wie eine abgewiesene Anforderung. Der
Ausgabeweg antwortet auch dann mit einem Fehler, wenn ein Token ausgegeben, die
Mail aber nicht angenommen wurde; wer beides zusammenwirft, meldet dem Nutzer
eine Wartezeit, wo ein erneuter Versuch nötig ist.

#### Scenario: Anforderung innerhalb der Sperrfrist nach dem automatischen Versand

- **WHEN** ein Mitglied nach dem automatischen Versand innerhalb der Sperrfrist
  den Bestätigungsknopf drückt
- **THEN** meldet der Bildschirm keinen Versand, sondern dass der Link bereits
  unterwegs ist und ein erneuter Versuch erst nach kurzer Wartezeit möglich ist

#### Scenario: Der Versand wird abgelehnt

- **WHEN** eine Anforderung ein Token ausgibt, der Mailversand aber fehlschlägt
- **THEN** meldet der Bildschirm keinen Versand, sondern einen Fehlschlag mit
  der Möglichkeit, es erneut zu versuchen

#### Scenario: Ein ausgegebenes Token wird als Versand gemeldet

- **WHEN** eine Anforderung ein Token ausgibt
- **THEN** meldet der Bildschirm, dass der Link unterwegs ist

## MODIFIED Requirements

### Requirement: Der Aktivierungsversand ist gegen Selbstüberflutung begrenzt

Das System SHALL die Anzahl der Aktivierungsmails **pro Mitgliedsprofil**
begrenzen, nicht nur pro Absender-IP. Die Begrenzung SHALL serverseitig aus
gespeichertem Zustand abgeleitet werden, damit sie auch bei mehreren gleichzeitig
laufenden Instanzen gilt.

Die Grenzen SHALL benannte Werte tragen, sonst ist keines der folgenden
Szenarien prüfbar:

- Zwischen zwei Ausgaben für dasselbe Profil SHALL eine **Sperrfrist von 60
  Sekunden** liegen.
- Je Profil SHALL innerhalb von **24 Stunden** höchstens **fünf** Token
  ausgegeben werden. Das ist das „Tageskontingent", auf das sich die Szenarien
  berufen.
- Auf dem **sitzungsgebundenen** Ausgabeweg SHALL für ein Profil, das **jünger
  als 10 Minuten** ist, kein Token ausgegeben werden, wenn in der **letzten
  Stunde** bereits **einhundert** Token ausgegeben wurden. Gezählt werden dabei
  die Ausgaben **aller** Profile und **beider** Ausgabewege.

Diese Grenze ist bewusst **nicht** als plattformweite Zusage formuliert. Der
adressbasierte Ausgabeweg, den ein Admin für importierte Mitglieder anstößt,
zählt in das Kontingent hinein, wird aber nicht von ihm gebremst. Eine Zusage
über „alle Token der Plattform" verspräche eine Schranke an einer Stelle, an der
dieser Change keine baut.

Die Grenze schützt das Versandkontingent gegen den einen Fall, den der
automatische Versand neu erzeugt: den Registrierungsschwall. Sie SHALL NOT davon
abhängen, was der Aufrufer über sich selbst behauptet — ein Feld im Anfragerumpf
setzte der Missbrauchende selbst. Das Alter des Profils ist serverseitig
prüfbar, die Absicht des Aufrufers nicht.

Die Beschränkung auf junge Profile ist kein Nachlass, sondern der Zweck: Ein
Mitglied, dessen Konto älter ist, SHALL über den Bestätigungsknopf immer
durchkommen. Andernfalls sperrte ein verbrauchtes Stundenkontingent echte
Mitglieder aus, und der Missbrauch würde zur Aussperrung.

**Was diese Grenze kostet, SHALL benannt bleiben:** Ist das Kontingent
erschöpft, bekommt ein frisch registriertes Konto keine automatische Mail. Die
Sperre SHALL sich von selbst lösen — sobald das Profil 10 Minuten alt ist,
greift die Grenze für es nicht mehr, und der Bestätigungsknopf trägt. Der
Zugangsweg ist damit verzögert, nicht verschlossen. Ein Missbrauchender, der das
Kontingent verbrennt, SHALL kein Konto dauerhaft aussperren können.

Die Prüfung dieser Grenze SHALL **atomar** zur Ausgabe erfolgen. Eine Zählung,
die nur vor dem Schreiben liest, hält die Grenze genau in dem Fall nicht ein,
für den sie existiert: Mehrere gleichzeitige Registrierungen lesen denselben
Stand unterhalb der Schwelle und schreiben alle. Das ist dieselbe Pflicht, die
für Sperrfrist und Tageskontingent bereits gilt — nur greift die Sperre auf der
eigenen Profilzeile hier nicht, weil die Grenze profilübergreifend ist.

Der Wert **einhundert** trägt den Fall „siebzig Mitglieder an einem Abend", auf
den sich diese Anforderung schon vorher berief, auch dann, wenn der Abend sich
in einer Stunde verdichtet.

Auch eine an dieser Grenze abgewiesene Anforderung SHALL keinen Zugang kosten:
Es wird kein Token ausgegeben, und der zuletzt ausgegebene Link bleibt gültig.

Eine über diese Grenzen hinausgehende Anforderung SHALL abgewiesen werden, ohne
dass ein Zugang verlorengeht: der zuletzt ausgegebene Link SHALL gültig bleiben.

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

#### Scenario: Das Tageskontingent ist erschöpft

- **WHEN** für dasselbe Profil innerhalb von 24 Stunden ein sechster
  Bestätigungslink angefordert wird
- **THEN** wird weder ein weiteres Token ausgegeben noch eine weitere Mail
  versendet, und der zuletzt ausgegebene Link bleibt gültig

#### Scenario: Aktivierung anfordern für ein bereits aktiviertes Konto

- **WHEN** ein bereits aktiviertes Konto über den Aktivierungsbildschirm einen
  Bestätigungslink anfordert
- **THEN** wird keine Aktivierungsmail versendet und der Aufruf gilt als
  erfolgreich

#### Scenario: Das Stundenkontingent ist erschöpft und ein frisches Konto fordert an

- **WHEN** in der letzten Stunde bereits einhundert Token ausgegeben wurden und
  ein Profil, das jünger als 10 Minuten ist, einen Bestätigungslink anfordert
- **THEN** wird kein weiteres Token ausgegeben und keine Mail versendet, und der
  zuletzt ausgegebene Link bleibt gültig

#### Scenario: Das Stundenkontingent ist erschöpft und ein bestehendes Mitglied fordert an

- **WHEN** in der letzten Stunde bereits einhundert Token ausgegeben wurden und
  ein Profil, das älter als 10 Minuten ist, einen Bestätigungslink anfordert
- **THEN** wird ein Token ausgegeben und die Mail versendet

#### Scenario: Das gesperrte frische Konto kommt nach zehn Minuten durch

- **WHEN** ein frisch registriertes Konto am erschöpften Stundenkontingent
  abgewiesen wurde und zehn Minuten später erneut anfordert
- **THEN** wird ein Token ausgegeben, auch wenn das Kontingent noch erschöpft ist

#### Scenario: Gleichzeitige Anforderungen an der Schwelle

- **WHEN** mehrere Anforderungen frischer Profile gleichzeitig laufen, während
  das Kontingent fast erschöpft ist
- **THEN** werden insgesamt nicht mehr als einhundert Token in der Stunde
  ausgegeben
