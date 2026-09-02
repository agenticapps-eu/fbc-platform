# Notifications

## Purpose

Provides per-member in-app notifications through a `notifications` table
(`profile_id`, `type`, `payload` jsonb, nullable `read_at`) whose visibility and
mutation are owner-only via RLS. Notification rows are created server-side by a
`SECURITY DEFINER` trigger on the contact-request lifecycle, because the owner-only
policy prevents one member from writing another member's notifications directly. As
of the OpenSpec migration this capability is partial (AGE-299): the table, RLS, and
server-side inserts exist, and a single transactional lifecycle email is delivered
via Resend, but the notification-bell UI is not yet wired to read or mark
notifications and no nudge system exists. Reconstructed from code.
## Requirements
### Requirement: Owner-only notification visibility

The system SHALL enforce via the `notifications_own` RLS policy that an authenticated
member can read only `notifications` rows whose `profile_id` equals their own auth id.
Each row SHALL carry a `profile_id` (NOT NULL, FK to `profiles`, `on delete cascade`),
a `type`, a jsonb `payload`, a nullable `read_at`, and a `created_at`.

#### Scenario: Member reads only their own notifications

- **WHEN** an authenticated member queries `notifications`
- **THEN** only rows where `profile_id = auth.uid()` are returned

#### Scenario: Another member's notifications are not visible

- **WHEN** a member queries for a `notifications` row belonging to a different profile
- **THEN** RLS excludes it from the result

### Requirement: Owner marks their own notifications read

The system SHALL allow an authenticated member to update only their own
`notifications` rows (via the `notifications_own` policy, `for all` with an owner
`with check`), so that marking a notification read by setting `read_at` is permitted
only for the owner.

#### Scenario: Owner sets read_at

- **WHEN** the owning member updates one of their notification rows to set `read_at`
- **THEN** the update is accepted

#### Scenario: Non-owner cannot mark another member's notification read

- **WHEN** a member attempts to update a `notifications` row whose `profile_id` is
  not their own auth id
- **THEN** the RLS policy rejects the update

### Requirement: Server-side notification creation for the counterparty

The system SHALL create notifications for the counterparty of a contact-request event
through a `SECURITY DEFINER` trigger (`handle_contact_request_change`) that bypasses
RLS, because `notifications_own` lets a member insert rows only for themselves. The
inserted row SHALL carry a `type` and a jsonb `payload` describing the event.

#### Scenario: New contact request notifies the recipient

- **WHEN** a contact request is inserted
- **THEN** the trigger inserts a `notifications` row for the recipient (`to_id`) with
  `type = 'contact_request'` and a `payload` carrying the request context

#### Scenario: Client cannot write the counterparty's notification directly

- **WHEN** a member attempts to insert a notification for the other party from the
  client
- **THEN** the `notifications_own` `with check` clause rejects it, and only the
  server-side trigger can create it

### Requirement: Transactional lifecycle email

The system SHALL send a branded transactional email via Resend for contact-request
lifecycle events, delivered by the `notify-contact-request` edge function triggered by
a database webhook. Email delivery SHALL be independent of the in-app notification rows,
which are written separately by the lifecycle trigger.

#### Scenario: New request sends an email to the recipient

- **WHEN** the `notify-contact-request` function processes a contact-request insert
  for a recipient with an email on file
- **THEN** it sends one Resend email to that recipient and does not itself write any
  in-app notification row

#### Scenario: Recipient without an email is skipped

- **WHEN** the recipient has no email address on file
- **THEN** the function acknowledges the webhook without sending an email

### Requirement: In-app bell reflects and clears unread notifications

The system SHALL wire the notification bell to the member's own `notifications`
rows, surfacing a live unread count and letting the member mark notifications
read — one at a time and all at once. Marking read SHALL set only `read_at`
(server time) through the existing owner-only `notifications_own` policy; no
other column is mutated from the bell, and the bell shows and mutates only the
member's own rows. The unread count SHALL stay current for the open session
(realtime subscription or poll).

The bell SHALL show no count when nothing is unread, rather than a zero.

The notification payload is text a member may have written — the existing
`contact_request` type carries a free-form `message`. The bell SHALL render it
as text and never as markup.

The bell SHALL tolerate a payload whose subject no longer exists or whose fields
are absent, rendering a sentence rather than an empty row or a raw type name.

#### Scenario: Bell shows the member's unread count

- **WHEN** a member with unread `notifications` rows opens the app
- **THEN** the bell surfaces the count of their own rows where `read_at` is null

#### Scenario: Nothing unread shows no number

- **WHEN** a member has no unread notifications
- **THEN** the bell shows no count and offers no mark-read action

#### Scenario: Marking a notification read sets only read_at

- **WHEN** the member marks a notification read from the bell
- **THEN** only its `read_at` is set to the server time via the owner-only
  policy and the unread count decreases

#### Scenario: Marking everything read is one request

- **WHEN** the member marks all notifications read
- **THEN** a single request clears them, rather than one request per row

#### Scenario: A member cannot mark another member's notification read

- **WHEN** a mark-read is attempted against a row the member does not own
- **THEN** the owner-only policy denies it and no row changes

#### Scenario: A payload with a dangling subject still reads as a sentence

- **WHEN** a notification's payload is empty, or names an object that has since
  been deleted
- **THEN** the bell renders a sentence for it and does not show a raw type name

#### Scenario: The three existing types are visible at last

- **WHEN** a member has a `contact_request`, `contact_request_accepted` or
  `contact_request_declined` row
- **THEN** the bell surfaces it like any other type, with no per-type exception

### Requirement: Four member-activity events raise in-app notifications

The system SHALL raise an in-app notification, written server-side, for each of
four events: a post being created, an event being created, a comment being made
on a member's own post, and a like being placed on a member's own post.

The notification SHALL carry the identifiers needed to reach its subject and a
short display text naming the origin — the acting member's name, or the event's
title. It SHALL NOT carry post or comment body text: a notification row is not
subject to the subject's visibility once written, and body text would outlive a
later tightening of it.

A member SHALL NOT be notified about their own action.

**An event SHALL be announced exactly once.** An event with a host is mirrored
into `posts` as a `kind='event'` row by an existing trigger; announcing both the
event and its mirror would notify the same members twice. The post-created
announcement SHALL therefore apply only to member-written posts, and the event
announcement SHALL come from the event itself — so that an event **without** a
host, for which no mirror row exists, is still announced.

#### Scenario: A new post notifies the other members

- **WHEN** a member creates a post
- **THEN** a notification row is written for each eligible member, carrying the
  post's identifier and the author's name, and none is written for the author

#### Scenario: An event is announced once, not twice

- **WHEN** an event with a host is created and its mirror post row is written by
  the existing trigger
- **THEN** exactly one announcement reaches each eligible member

#### Scenario: An event without a host is still announced

- **WHEN** an event is created with no host, so no mirror post row exists
- **THEN** the event announcement is written for each eligible member

#### Scenario: A comment reaches the post's owner

- **WHEN** a member comments on another member's post
- **THEN** exactly one notification is written, to the post's owner, naming the
  commenting member

#### Scenario: A like reaches the post's owner

- **WHEN** a member likes another member's post
- **THEN** exactly one notification is written, to the post's owner, naming the
  liking member

#### Scenario: Acting on your own post notifies nobody

- **WHEN** a member comments on or likes their own post
- **THEN** no notification is written

#### Scenario: A notification carries no body text

- **WHEN** any of the four notifications is written
- **THEN** its payload contains identifiers and an origin name or title, and no
  post or comment body

### Requirement: Every recipient of a broadcast can see what it announces

Where a notification is broadcast rather than addressed to one member, every
recipient SHALL be permitted to read the announced object under that object's
own row-level policy at the moment the notification is written.

This SHALL be verified as **parity with the policy**, not as membership of a
transcribed set: for each row written, the check SHALL act as that recipient and
assert that the recipient can select the announced object.

The distinction is the whole requirement. A transcribed predicate is a copy with
an expiry date: while this change was being planned, the posts policy had
already been rewritten a day earlier — the transcription described a threshold
that no longer existed, and every test built on it would have passed while
describing the wrong system. A parity check cannot drift, because it asks the
policy instead of repeating it.

#### Scenario: Each recipient can read the post announced to them

- **WHEN** a post-created notification has been written
- **THEN** acting as each recipient in turn, that recipient can select the
  announced post

#### Scenario: Each recipient can read the event announced to them

- **WHEN** an event-created notification has been written
- **THEN** acting as each recipient in turn, that recipient can select the
  announced event

#### Scenario: A member who cannot read the object receives nothing

- **WHEN** a member exists who cannot select the announced object
- **THEN** no notification row was written for that member

#### Scenario: The parity check can fail

- **WHEN** the recipient set is deliberately widened beyond what the policy
  permits
- **THEN** the parity check fails, naming the recipient who cannot see the
  object

#### Scenario: A member who is not activated receives nothing

- **WHEN** any broadcast notification is raised
- **THEN** no row is written for a member whose account is not activated,
  deactivated or deleted

### Requirement: Each member can switch off any notification type

The system SHALL let each member switch off any of the four notification types
individually, from their settings. Each switch SHALL default to on, so that a
member who has never opened the setting is notified. A switched-off type SHALL
produce no row for that member — the notification is not written, not merely
hidden.

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
- **THEN** the remaining three types continue to produce notifications for them

#### Scenario: A member cannot read or change another member's switches

- **WHEN** a member attempts to read or write another member's notification
  settings
- **THEN** the owner-only policy denies it

#### Scenario: The opt-out lookup is not reachable from any client role

- **WHEN** a client role attempts to execute the function that reads a
  recipient's switches
- **THEN** it is refused, because no client role holds execute on it

### Requirement: Eine Release-Note wird höchstens einmal zugestellt

Das System SHALL eine `SECURITY DEFINER`-Funktion mit `set search_path = ''`
führen, die eine Release-Note zustellt, und diese SHALL die Mehrfachzustellung
**in der Datenbank** ausschliessen, nicht in der Bedienoberfläche.

Der Zustandswechsel von `draft` auf `sent` SHALL **bedingt** erfolgen und
**vor** jeder erzeugten Benachrichtigung stehen. Trifft er keine Zeile, SHALL
die Funktion abbrechen, ohne eine einzige `notifications`-Zeile zu erzeugen.

Ein Fan-out ist die einzige Schreiblast dieser Anwendung, die mit der
Mitgliederzahl multipliziert. Ein zweiter Klick ist der Normalfall, nicht die
Ausnahme, und `notifications` trägt keinen Schlüssel, an dem eine Dopplung
auffiele.

Die Funktion SHALL ausschliesslich einem Admin offenstehen und dies über
dieselbe Funktion prüfen, die die Policies rufen, statt deren Bedingung zu
wiederholen.

`authenticated` SHALL **kein** INSERT-Recht auf `notifications` für fremde
Zeilen erhalten; die Zustellung SHALL allein über die Funktion laufen.

#### Scenario: Zweimal zustellen erzeugt nichts

- **WHEN** die Zustellfunktion für eine bereits zugestellte Release-Note erneut
  aufgerufen wird
- **THEN** bricht sie ab, und die Zahl der Benachrichtigungen bleibt unverändert

#### Scenario: Ein Nicht-Admin stellt nichts zu

- **WHEN** ein Mitglied ohne Admin-Rolle die Zustellfunktion aufruft
- **THEN** bricht sie ab, und es entsteht keine Benachrichtigung

#### Scenario: Der Zustand wechselt vor dem Fan-out

- **WHEN** die Zustellung mitten im Fan-out fehlschlägt
- **THEN** ist die Release-Note nicht als `draft` zurückgeblieben, aus dem ein
  zweiter Lauf denselben Fan-out ein zweites Mal erzeugen könnte

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

Die bestehenden Schalter (`notify_inapp_post`, `_event`, `_comment`, `_like`)
SHALL auf diesen Typ **keine** Wirkung haben.

#### Scenario: Jedes aktivierte Mitglied bekommt genau eine Zeile

- **WHEN** eine Release-Note zugestellt wird
- **THEN** trägt jedes aktivierte Mitglied genau eine neue Benachrichtigung vom
  Typ `release_note`

#### Scenario: Ein unbestätigtes Konto bekommt nichts

- **WHEN** eine Release-Note zugestellt wird und ein Profil hat kein
  `activated_at`
- **THEN** entsteht für dieses Profil keine Zeile

#### Scenario: Die Schalter der anderen Typen greifen nicht

- **WHEN** ein Mitglied alle vier In-App-Schalter abgeschaltet hat
- **THEN** bekommt es die Release-Note trotzdem

### Requirement: Eine zugestellte Release-Note bleibt auffindbar

Das System SHALL eine Fläche führen, die alle **zugestellten** Release-Notes in
umgekehrt chronologischer Reihenfolge zeigt, und der Hinweis in der Glocke SHALL
dorthin führen.

Ohne sie wäre ein weggeklickter Hinweis unwiederbringlich: die Glocke liest nur
ungelesene und deckelt bei 50.

Ein **Entwurf** SHALL auf dieser Fläche NICHT erscheinen. Sie zeigt, was
mitgeteilt wurde, nicht was jemand vorhat.

Die Fläche SHALL jedem angemeldeten, aktivierten Mitglied offenstehen und keine
Mitgliedsstufe verlangen — was die Anwendung kann, ist keine Frage der Stufe.

#### Scenario: Der Hinweis führt auf die Fläche

- **WHEN** ein Mitglied den Release-Hinweis in der Glocke aktiviert
- **THEN** öffnet sich die Fläche mit den zugestellten Release-Notes

#### Scenario: Auch nach dem Lesen noch da

- **WHEN** ein Mitglied den Hinweis als gelesen markiert hat
- **THEN** steht die Release-Note weiterhin auf der Fläche

#### Scenario: Ein Entwurf ist nicht sichtbar

- **WHEN** ein Admin einen Entwurf gespeichert, aber nicht zugestellt hat
- **THEN** erscheint er für kein Mitglied auf der Fläche

### Requirement: Der Release-Hinweis hat einen eigenen Renderer in der Glocke

Das System SHALL den Typ `release_note` in der Glocke mit eigenem Text
darstellen. Ein Typ ohne Renderer fällt auf einen Ersatztext zurück, und ein
Hinweis, der nicht sagt, worum es geht, ist kein Hinweis.

Der Hinweis SHALL den Titel der Release-Note nennen.

#### Scenario: Der Hinweis nennt den Titel

- **WHEN** ein Mitglied die Glocke öffnet und eine Release-Note ungelesen ist
- **THEN** nennt der Eintrag deren Titel, nicht einen Ersatztext

### Requirement: Eine Release-Note öffnet sich mittig und kann Bilder tragen

Das System SHALL eine zugestellte Release-Note auf Anforderung als **zentriertes
Modal** zeigen, mit gesperrtem Seiten-Scroll und einer Fokus-Falle, und SHALL
sie über Kreuz, `Escape` und einen Klick auf den Hintergrund wieder schliessen.

Das Overlay SHALL an `document.body` portalisiert werden. Ein `fixed`-Overlay
innerhalb der Kartenliste wird in dieser Anwendung zweifach eingefangen — die
Karte trägt beim Überfahren ein `transform`, der Seitenkopf ein
`backdrop-filter`; beides erzeugt einen neuen Bezugsrahmen, in dem `fixed` nicht
mehr am Viewport hängt.

Eine Release-Note SHALL **Bilder** tragen können. Diese SHALL zur Bauzeit
feststehen und mit dem Bündel ausgeliefert werden, aus demselben Grund wie die
Eintragsliste: was im Bündel steht, ist per Konstruktion ausgeliefert. Ein
Upload-Weg SHALL für Release-Bilder NICHT bestehen.

Die Bildfläche SHALL ihre Abmessungen vor dem Laden kennen, damit der Text
darunter beim Eintreffen des Bildes nicht verrutscht.

Der Hinweis in der Glocke SHALL die **betroffene** Note öffnen, nicht nur die
Fläche zeigen.

#### Scenario: Ein Klick öffnet die Note mittig

- **WHEN** ein Mitglied auf eine Release-Note in der Liste klickt
- **THEN** öffnet sie sich als zentriertes Modal, und die Seite dahinter scrollt
  nicht mit

#### Scenario: Escape schliesst

- **WHEN** das Modal offen ist und das Mitglied `Escape` drückt
- **THEN** schliesst es, und der Blick steht wieder an derselben Stelle der Liste

#### Scenario: Die Glocke öffnet die gemeinte Note

- **WHEN** ein Mitglied den Release-Hinweis in der Glocke aktiviert
- **THEN** öffnet sich `/neues` mit genau der angekündigten Note offen

#### Scenario: Eine Note ohne Bilder zeigt keine leere Fläche

- **WHEN** eine zugestellte Note zu keinem ihrer Changes ein Bild hat
- **THEN** steht im Modal der Text allein, ohne Platzhalter und ohne Lücke

#### Scenario: Kein Bild wird hochgeladen

- **WHEN** ein Admin eine Release-Note zusammenstellt
- **THEN** gibt es an keiner Stelle einen Weg, ein Bild hochzuladen — die Bilder
  stehen im Bündel

### Requirement: Ein Gerät setzt beim Start ein Lebenszeichen, ohne zu fragen

Startet die App auf einer nativen Fläche und ist die Push-Erlaubnis **bereits
erteilt**, SHALL das Gerätetoken erneut abgelegt werden — ohne Systemdialog,
ohne sichtbare Wirkung, ohne Zutun des Mitglieds.

Ist die Erlaubnis **nicht** erteilt — offen, abgelehnt oder zurückgenommen —,
SHALL beim Start nichts geschehen. Insbesondere SHALL keine Erlaubnis
angefordert werden. Das bleibt allein dem Weg über die Nachrichten vorbehalten,
aus dem dort genannten Grund: iOS zeigt den Dialog einmal.

Auf der Web-Fläche SHALL weiterhin nichts geschehen.

Der Zweck ist nicht die Registrierung — die steht bereits — sondern der
**Zeitstempel**. Ohne ihn misst `push_tokens.letzter_kontakt` nur, wann ein
Mitglied zuletzt die Nachrichten geöffnet hat, und ist als Lebenszeichen
unbrauchbar. Der Anbieter Firebase verlangt für dasselbe Verfahren ein
monatliches Erneuern; ein Erneuern je Start erfüllt das mit Abstand.

#### Scenario: Ein Start mit erteilter Erlaubnis erneuert den Zeitstempel

- **WHEN** die App auf einer nativen Fläche startet, ein Mitglied angemeldet ist
  und die Push-Erlaubnis bereits erteilt war
- **THEN** wird das Gerätetoken erneut abgelegt und `letzter_kontakt` trägt den
  Zeitpunkt dieses Starts

#### Scenario: Ein Start ohne Erlaubnis fragt nicht

- **WHEN** die App startet und die Push-Erlaubnis nicht erteilt ist
- **THEN** wird kein Systemdialog gezeigt und keine Erlaubnis angefordert

#### Scenario: Die Web-Fläche bleibt still

- **WHEN** die App im Browser startet
- **THEN** wird weder ein Token abgelegt noch eine Erlaubnis geprüft, die einen
  Dialog auslösen könnte

### Requirement: Ein Gerätetoken ohne Lebenszeichen wird entfernt

Ein Gerätetoken, dessen letztes Lebenszeichen länger als **180 Tage**
zurückliegt, SHALL vom System entfernt werden — auch dann, wenn der Anbieter es
nie abgelehnt hat.

Das ist der Fall der deinstallierten App. APNs meldet ein solches Token
weiterhin als zustellbar, auf einem bewusst unscharfen und undokumentierten
Zeitplan; eine Ablehnung, aus der `dauerhaft` und damit das Löschen entstünde,
kommt womöglich nie.

Als Lebenszeichen SHALL ausschliesslich `push_tokens.letzter_kontakt` gelten.
Das System SHALL kein weiteres Signal heranziehen — insbesondere nicht den
Erfolg einer Zustellung, der bei genau diesem Fehlerbild fälschlich Leben
anzeigt.

Die Frist SHALL für **beide** Plattformen gleich sein. Auf Android verfällt ein
Token nach 270 Tagen Inaktivität ohnehin von selbst; 180 Tage greifen dort also
früher. Das ist gewollt: mit dem Lebenszeichen beim Start bedeutet die Frist auf
beiden Plattformen dasselbe, nämlich dass die App ein halbes Jahr nicht gelaufen
ist.

Die Frist SHALL nicht vom Aufrufer bestimmt werden. Es gibt einen Aufrufer, und
ein frei wählbarer Wert wäre ein Weg, versehentlich alle Token zu entfernen.

Das Entfernen SHALL keine Wirkung auf die Hinweise selbst haben: die Zeilen in
`notifications` bleiben, das Mitglied sieht sie weiterhin in der Glocke. Es
entfällt nur der Weg aufs Gerät — und der stellt sich beim nächsten Start der
App von selbst wieder her.

#### Scenario: Ein Token ohne Lebenszeichen verschwindet

- **WHEN** der Fälligkeitslauf ausgeführt wird und ein Gerätetoken ein
  Lebenszeichen trägt, das älter als die Frist ist
- **THEN** ist die Zeile aus `push_tokens` entfernt

#### Scenario: Ein Token mit frischem Lebenszeichen bleibt bestehen

- **WHEN** derselbe Lauf ausgeführt wird und ein weiteres Gerätetoken ein
  Lebenszeichen innerhalb der Frist trägt
- **THEN** besteht diese Zeile unverändert fort

#### Scenario: Ein Tag vor der Frist wird nicht entfernt

- **WHEN** ein Gerätetoken ein Lebenszeichen trägt, das einen Tag jünger als die
  Frist ist
- **THEN** besteht die Zeile fort

#### Scenario: Das Aufräumen geht der Vergabe voraus

- **WHEN** im selben Fälligkeitslauf ein fälliger Auftrag für ein Token
  vorliegt, dessen Lebenszeichen älter als die Frist ist
- **THEN** wird für dieses Token keine Zustellung mehr vergeben

#### Scenario: Ein Lebenszeichen setzt die Frist zurück

- **WHEN** ein Gerät sein Token erneut ablegt und damit `letzter_kontakt` neu
  setzt
- **THEN** bleibt die Zeile beim nächsten Lauf bestehen, unabhängig davon, wie
  alt der vorherige Wert war

#### Scenario: Keine Rolle ausserhalb der Datenbank kann das Aufräumen auslösen

- **WHEN** eine der Rollen `anon`, `authenticated` oder `service_role` die
  Aufräumfunktion aufzurufen versucht
- **THEN** wird der Aufruf mangels Ausführungsrecht abgewiesen

#### Scenario: Das Aufräumen lässt die Hinweise unangetastet

- **WHEN** ein Token wegen fehlender Lebenszeichen entfernt wird
- **THEN** bleiben die Zeilen dieses Mitglieds in `notifications` bestehen

