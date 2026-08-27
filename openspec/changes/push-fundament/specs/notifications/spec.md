## ADDED Requirements

### Requirement: Ein Gerätetoken gehört genau einem Mitglied

Das System SHALL Gerätetoken für Push in einer eigenen Tabelle führen, in der
jede Zeile genau einem Profil gehört. Lesen, Anlegen, Ändern und Löschen SHALL
allein dem Eigentümer offenstehen; die Grenze SHALL in der Datenbank liegen und
SHALL NOT von der Fläche abhängen.

Ein Gerätetoken ist ein Zustellweg zu einer Person. Wer fremde Token lesen kann,
kann fremden Menschen Benachrichtigungen schicken — die Sichtbarkeitsgrenze ist
hier keine Frage der Datensparsamkeit, sondern die Zustellgrenze selbst.

Mehrere Geräte je Mitglied SHALL der Normalfall sein: das System SHALL NOT die
Zahl der Token je Profil begrenzen. Ein Token SHALL global eindeutig sein — ein
Gerät, das den Besitzer wechselt, gehört nicht beiden.

Wird ein Profil gelöscht, SHALL das System seine Token mitlöschen.

#### Scenario: Das eigene Gerät ist lesbar

- **WHEN** ein Mitglied seine Gerätetoken abfragt
- **THEN** es erhält die eigenen und keine fremden

#### Scenario: Fremde Token sind nicht lesbar

- **WHEN** ein Mitglied die Token eines anderen Mitglieds abzufragen versucht
- **THEN** die Abfrage liefert keine Zeile

#### Scenario: Fremde Token sind nicht änderbar und nicht löschbar

- **WHEN** ein Mitglied ein fremdes Token zu ändern oder zu löschen versucht
- **THEN** es wird keine Zeile berührt

#### Scenario: Ein Token lässt sich nicht auf ein fremdes Profil schreiben

- **WHEN** ein Mitglied ein Token mit fremder `profile_id` anzulegen versucht
- **THEN** die Prüfung beim Schreiben weist es ab

#### Scenario: Zwei Geräte desselben Mitglieds bestehen nebeneinander

- **WHEN** ein Mitglied sich von einem zweiten Gerät registriert
- **THEN** beide Token bestehen, und eine Zustellung erreicht beide

#### Scenario: Ein gelöschtes Profil hinterlässt keine Token

- **WHEN** ein Profil gelöscht wird
- **THEN** seine Gerätetoken verschwinden mit ihm

### Requirement: Eine Chat-Nachricht erhebt einen Hinweis, der ihren Text nicht trägt

Das System SHALL beim Eingang einer Chat-Nachricht einen Hinweis für den
Empfänger schreiben, serverseitig, und SHALL NOT einen für den Absender
schreiben.

Der Hinweis SHALL nennen, **wer** geschrieben hat und **in welchem Gespräch**,
und SHALL NOT den Nachrichtentext tragen — auch nicht gekürzt, auch nicht als
Vorschau.

Diese Grenze SHALL an der Quelle liegen: der Text SHALL schon in der
Hinweiszeile fehlen, nicht erst im Transport gefiltert werden. Ein Transport,
der ihn nicht bekommt, kann ihn nicht ausliefern — und ein Sperrbildschirm liegt
in einer Besprechung offen herum.

#### Scenario: Der Empfänger bekommt einen Hinweis, der Absender nicht

- **WHEN** ein Mitglied eine Nachricht in einem Gespräch schreibt
- **THEN** für das Gegenüber wird ein Hinweis geschrieben und für den Absender
  keiner

#### Scenario: Der Hinweis trägt keinen Nachrichtentext

- **WHEN** ein Hinweis zu einer Nachricht geschrieben wird
- **THEN** seine Nutzlast trägt Absendername und Gesprächs-Kennung, und der
  Nachrichtentext kommt darin nicht vor

#### Scenario: Ein nicht aktiviertes Konto bekommt keinen Hinweis

- **WHEN** eine Nachricht an ein Konto geht, das nicht aktiviert ist
- **THEN** es wird kein Hinweis geschrieben

### Requirement: Ein Hinweis zu einer Kontaktanfrage trägt deren Freitext nicht

Eine Kontaktanfrage führt eine **von einem Mitglied geschriebene Nachricht** mit
sich. Das System SHALL diesen Text NOT in die Hinweiszeile schreiben — aus
demselben Grund wie beim Chat: was in der Zeile steht, kann jeder Transport
ausliefern, und auf einem Sperrbildschirm steht es dann offen.

Der Hinweis SHALL nennen, **wer** die Anfrage gestellt oder beantwortet hat, und
die Kennungen, die zur Anfrage führen. Die Glocke SHALL dadurch nichts verlieren:
sie zeigt den Freitext nicht an und hat ihn nie angezeigt.

Bestehende Zeilen, die den Text noch tragen, SHALL das System NOT nachträglich
ändern. Der Schutz für sie SHALL im Transport liegen.

#### Scenario: Die Nutzlast einer neuen Kontaktanfrage trägt keinen Freitext

- **WHEN** eine Kontaktanfrage mit einer Nachricht gestellt wird
- **THEN** trägt die Hinweiszeile Absendername und Kennungen, und der Text der
  Anfrage kommt darin nicht vor

#### Scenario: Die Glocke sagt dasselbe wie zuvor

- **WHEN** ein Mitglied den Hinweis zu einer Kontaktanfrage liest
- **THEN** steht dort derselbe Satz wie vor der Änderung

### Requirement: Push ist ein zweiter Transport auf denselben Hinweisen

Das System SHALL Push aus vorhandenen Hinweiszeilen zustellen und SHALL NOT eine
zweite Ereignis-Ebene daneben führen. Es SHALL NOT dafür abfragen, ob etwas
anliegt: die Zeile selbst ist der Auslöser.

Welcher Hinweistyp gepusht wird, SHALL als **Daten** vorliegen und SHALL NOT im
Quelltext des Auslösers stehen, sodass die Liste sich ändern lässt, ohne dass
Trigger oder Function neu geschrieben werden. Ein Typ **ohne** Eintrag SHALL NOT
gepusht werden: eine fehlende Zeile ist keine Erlaubnis, und ein neuer Typ soll
nicht dadurch auf den Geräten landen, dass niemand an ihn gedacht hat.

Der Zustellweg SHALL denselben Schalter lesen wie die Glocke. Für ein Ereignis
SHALL es genau **einen** Schalter geben und SHALL NOT je Transport einen eigenen
geben — wer einen Hinweis in der Glocke abbestellt hat, will ihn auch nicht auf
dem Gerät.

Das System SHALL vor jeder Zustellung prüfen, dass das Empfängerkonto aktiviert
ist, auch wenn die Hinweiszeile älter ist als eine zwischenzeitliche
Deaktivierung.

**Die Benachrichtigung SHALL aus einer festen Feldliste gebaut werden** und
SHALL NOT die Nutzlast der Hinweiszeile durchreichen. Ältere Zeilen können Text
tragen, den heutige Zeilen nicht mehr tragen; ein durchgereichter Payload
lieferte ihn aus. Was nicht ausdrücklich in die Benachrichtigung aufgenommen
wird, SHALL NOT darin erscheinen.

Der lesende Zugriff des Zustellwegs SHALL über eine Funktion mit definierten
Rechten laufen und SHALL NOT auf Tabellenrechte der Dienstrolle bauen: welche
Rechte diese Rolle hält, entscheidet die Instanz und nicht dieses Repository.
Diese Funktion SHALL für keine Client-Rolle aufrufbar sein — sie wäre sonst ein
Orakel auf fremde Gerätetoken und fremde Schalter.

Ein Token, das der Anbieter **dauerhaft** ablehnt, SHALL entfernt werden. Ein
vorübergehender Fehler SHALL NOT zum Entfernen führen. Auch das Entfernen SHALL
über denselben Weg mit definierten Rechten laufen: es steht sonst auf derselben
Eigenschaft der Instanz, die für das Lesen ausdrücklich verworfen wurde.

#### Scenario: Ein Typ, der nicht gepusht wird, erzeugt keine Zustellung

- **WHEN** ein Hinweis eines Typs entsteht, der in der Zuordnung auf „nicht
  pushen" steht
- **THEN** die Hinweiszeile wird geschrieben und keine Push-Zustellung versucht

#### Scenario: Ein unverzeichneter Typ wird nicht gepusht

- **WHEN** ein Hinweis eines Typs entsteht, für den es gar keinen Eintrag in der
  Zuordnung gibt
- **THEN** wird nichts zugestellt

#### Scenario: Der abgeschaltete Schalter greift für beide Wege

- **WHEN** ein Mitglied einen Hinweistyp abgeschaltet hat und ein Ereignis
  dieses Typs eintritt
- **THEN** es entsteht weder ein Eintrag in der Glocke noch eine Zustellung auf
  ein Gerät

#### Scenario: Ein deaktiviertes Konto bekommt nichts, auch mit Token

- **WHEN** für ein deaktiviertes Konto Gerätetoken vorliegen und ein Hinweis für
  es ansteht
- **THEN** es wird nichts zugestellt

#### Scenario: Eine alte Zeile mit Freitext liefert ihn nicht aus

- **WHEN** eine Hinweiszeile zugestellt wird, deren Nutzlast noch einen Freitext
  aus der Zeit vor dieser Änderung trägt
- **THEN** erscheint dieser Text nicht in der Benachrichtigung

#### Scenario: Die Zustellfunktion ist von keiner Client-Rolle aufrufbar

- **WHEN** eine Client-Rolle die Funktion aufzurufen versucht, die Token und
  Schalter des Empfängers liest
- **THEN** der Aufruf wird abgewiesen, weil keine Client-Rolle `execute` hält

#### Scenario: Ein dauerhaft abgelehntes Token wird entfernt

- **WHEN** der Anbieter ein Token als dauerhaft ungültig meldet
- **THEN** die Zeile wird gelöscht, während ein vorübergehender Fehler sie
  stehen lässt

#### Scenario: Die Zuordnung ändert sich ohne Deploy

- **WHEN** die Entscheidung, ob ein Typ gepusht wird, geändert wird
- **THEN** wirkt die Änderung, ohne dass Trigger oder Function neu ausgeliefert
  werden

## MODIFIED Requirements

### Requirement: Each member can switch off any notification type

The system SHALL let each member switch off any notification type individually,
from their settings. Each switch SHALL default to on, so that a member who has
never opened the setting is notified. A switched-off type SHALL produce no row
for that member — the notification is not written, not merely hidden.

Each switch SHALL govern **every** transport for its event — the in-app bell and
push delivery alike. The system SHALL NOT hold a separate switch per transport:
two switches for one event would let a member silence the bell and still be
woken by the phone.

The switches SHALL therefore be named for the surface they govern rather than
for one transport of it. The naming SHALL stay consistent with the transport
that already has its own switches — email — so that the two sets remain
distinguishable.

Every type that raises a notification about **what other members do** SHALL have
a switch, including the contact request types. A type that is delivered by push
and cannot be switched off is the one that makes a member switch off push
altogether. The three contact request types SHALL share **one** switch: a
setting on which a member unsubscribes from the request but keeps the reply is
one nobody wants.

The one deliberate exception SHALL be `release_note`, and it SHALL stay one: a
message about the tool itself is not noise made by other members, it is rare,
and it concerns everyone who uses the tool. The requirement that governs that
type states this, and it SHALL keep precedence over the rule above.

Where a trigger writes a notification, that trigger SHALL consult the switch
itself. A switch that no writing path reads is decoration, and a decorative
switch in the settings is worse than none: it tells a member something is off
that is on.

The setting SHALL be readable and writable only by the member it belongs to. The
server-side path that raises notifications SHALL read the recipient's setting
even though that setting is owner-only, and that path SHALL NOT be callable by
any client role: it exists only to be used by the trigger functions, so granting
it back would make it an oracle on other members' settings for no gain.

#### Scenario: A switched-off type writes no row

- **WHEN** a member has switched a type off and an event of that type occurs
- **THEN** no notification row is written for that member, while members who
  have not switched it off still receive theirs

#### Scenario: A member who never opened the settings is notified

- **WHEN** an event occurs and the member has no stored preference for its type
- **THEN** the notification is written

#### Scenario: Switching one type off leaves the others on

- **WHEN** a member switches exactly one type off
- **THEN** the remaining types continue to produce notifications for them

#### Scenario: A member cannot read or change another member's switches

- **WHEN** a member attempts to read or write another member's notification
  settings
- **THEN** the owner-only policy denies it

#### Scenario: The opt-out lookup is not reachable from any client role

- **WHEN** a client role attempts to execute the function that reads a
  recipient's switches
- **THEN** it is refused, because no client role holds execute on it

#### Scenario: A contact request type can be switched off

- **WHEN** a member switches off the contact request type and a contact request
  reaches them
- **THEN** no notification row is written for them

#### Scenario: One switch covers request, acceptance and refusal

- **WHEN** a member switches off the contact request type and their own request
  is accepted or refused
- **THEN** no notification row is written for them either

### Requirement: Eine Release-Note erreicht jedes aktivierte Mitglied ohne Abbestellung

Das System SHALL je Mitglied mit gesetztem `activated_at` genau **eine**
`notifications`-Zeile vom Typ `release_note` erzeugen.

Der Empfängerkreis SHALL NOT wählbar sein. Es SHALL **keinen** Opt-out-Schalter
für diesen Typ geben: die Schalter für die anderen Typen schützen vor dem Lärm,
den andere Mitglieder machen, und der wächst mit deren Zahl. Eine Release-Note
ist eine Mitteilung über das Werkzeug selbst, kommt selten und betrifft jeden,
der es benutzt.

Ein Mitglied ohne gesetztes `activated_at` SHALL **keine** Zeile bekommen — es
sieht die Anwendung nicht, und eine Mitteilung über ihre Änderung ginge ins
Leere.

Die Schalter der anderen Typen (`notify_app_post`, `_event`, `_comment`,
`_like`, `_message`, `_contact`) SHALL auf diesen Typ **keine** Wirkung haben.

Aus demselben Grund SHALL `release_note` **nicht** gepusht werden: der eine Typ
ohne Abschalter ist der eine, der niemandem aufs Gerät gehört. Er SHALL in der
Glocke bleiben.

#### Scenario: Jedes aktivierte Mitglied bekommt genau eine Zeile

- **WHEN** eine Release-Note zugestellt wird
- **THEN** trägt jedes aktivierte Mitglied genau eine neue Benachrichtigung vom
  Typ `release_note`

#### Scenario: Ein unbestätigtes Konto bekommt nichts

- **WHEN** eine Release-Note zugestellt wird und ein Profil hat kein
  `activated_at`
- **THEN** entsteht für dieses Profil keine Zeile

#### Scenario: Die Schalter der anderen Typen greifen nicht

- **WHEN** ein Mitglied alle sechs App-Schalter abgeschaltet hat
- **THEN** bekommt es die Release-Note trotzdem

#### Scenario: Eine Release-Note geht nicht aufs Gerät

- **WHEN** eine Release-Note zugestellt wird und das Mitglied hat Gerätetoken
- **THEN** entsteht die Zeile in der Glocke und keine Push-Zustellung
