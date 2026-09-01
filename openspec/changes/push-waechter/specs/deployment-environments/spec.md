## MODIFIED Requirements

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

Dasselbe SHALL für den Webhook auf `public.notifications` gelten — die Funktion
`notify_push_webhook()` und der Trigger `notifications_push_webhook` — sowie für
die Funktion `push_wiederholung()`. Sie tragen denselben Bearer inline und sind
aus demselben Grund keine Migration.

Die Zeitplanungen im Schema `cron` SHALL ebenfalls als solche Objekte geführt
werden. Es sind zwei — der Wiederholungslauf der Push-Zustellung und die
Ankündigung geplanter Beiträge. Ihre Funktionen stehen in Migrationen, ihre
Zeitplanung nicht: ein `cron.schedule` in einer Migration bräche den CI-Lauf
gegen eine frische Datenbank. Ohne Zeitplanung ist die Anspruchsfrist der
Zustellung wirkungslos — sie sagt, wann ein Auftrag wieder fällig wird, aber
niemand holt ihn ab.

Die Prüfung SHALL nicht nur beim Aufsetzen laufen. Sie SHALL bei jedem Lauf gegen
PROD wiederholt werden und darüber hinaus regelmäßig gegen **beide** Projekte
laufen, DEV wie PROD. Ein nachträglich entferntes oder verändertes Objekt SHALL
auffallen, auch auf DEV, wo ein `supabase db reset` die Webhook-Objekte, die
Funktion und beide Zeitplanungen in einem Zug entfernt.

Die Prüfung SHALL das zu messende Projekt als Pflichtangabe verlangen und das
gemessene Projekt in ihrer Ausgabe benennen. Sie SHALL NOT auf ein Projekt
zurückfallen, wenn die Angabe fehlt: ein Lauf, der unbemerkt zweimal dieselbe
Seite misst, ist zweimal grün und sagt über die andere nichts.

Die Prüfung SHALL dabei nicht nur das Schema `public` abdecken, sondern auch die
Zeitplanungen im Schema `cron`. Sie SHALL je Zeitplanung Name, Zeitplan,
Aktivzustand **und** auszuführenden Befehl vergleichen — ein Eintrag mit
richtigem Namen und leerem oder verändertem Befehl SHALL auffallen. Für Trigger
SHALL sie zusätzlich den Aktivzustand prüfen: ein abgeschalteter Trigger steht
weiter im Katalog, und sein Versand ist trotzdem tot.

Was die Prüfung **nicht** leistet, SHALL in ihrem Kopf benannt bleiben: sie
vergleicht Namen und die oben genannten Eigenschaften, nicht Funktionsrümpfe.
Ein verändertes Innenleben einer Funktion fällt ihr nicht auf.

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

#### Scenario: Ein abgeschalteter Trigger fällt ebenfalls auf

- **WHEN** der Webhook-Trigger nicht entfernt, sondern abgeschaltet wird und
  damit weiter im Katalog steht
- **THEN** meldet die Prüfung seinen Aktivzustand als Befund

#### Scenario: Ein `db reset` auf DEV bleibt nicht unbemerkt

- **WHEN** DEV per `supabase db reset` zurückgesetzt wird und dabei die
  Webhook-Objekte, die Funktion `push_wiederholung()` und beide Zeitplanungen
  verliert
- **THEN** meldet die nächste regelmäßige Prüfung deren Fehlen, ohne dass jemand
  sie von Hand anstößt

#### Scenario: Eine abbestellte Zeitplanung fällt auf

- **WHEN** der cron-Eintrag des Wiederholungslaufs entfernt oder inaktiv gesetzt
  wird, während alle Objekte in `public` unverändert bleiben
- **THEN** meldet die Prüfung den Befund, statt grün zu bleiben

#### Scenario: Eine ausgehöhlte Zeitplanung fällt auf

- **WHEN** ein cron-Eintrag seinen Namen und Zeitplan behält, sein Befehl aber
  nichts mehr ausführt
- **THEN** meldet die Prüfung den abweichenden Befehl

#### Scenario: Ein Lauf ohne Zielangabe misst nicht die falsche Seite

- **WHEN** die Prüfung ohne Angabe des zu messenden Projekts gestartet wird
- **THEN** bricht sie ab, statt auf ein Projekt zurückzufallen
