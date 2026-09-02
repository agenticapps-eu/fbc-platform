## ADDED Requirements

### Requirement: Ein vom Admin eröffnetes Gespräch ist für beide Seiten offen

Das System SHALL an `message_threads` festhalten, dass ein Gespräch von einem
Admin ohne angenommene Kontaktanfrage eröffnet wurde, und SHALL in einem so
markierten Gespräch **beiden** Teilnehmern das Senden erlauben.

Der Grund ist, dass die Ausnahme sonst nur halb greift: der Admin dürfte
schreiben, sein Gegenüber nicht antworten. Ein Faden, in dem eine Seite
„Nachricht nicht gesendet" bekommt, ist keine Unterhaltung, sondern eine
Durchsage — und die Fläche, die ihn öffnet, verspricht ein Gespräch.

Die Markierung SHALL am **Gespräch** hängen und nicht an der Rolle des
Sendenden. Damit ist die Freischaltung auf genau den einen Faden begrenzt: das
Mitglied gewinnt kein Senderecht gegenüber irgendjemand anderem, und es verliert
keines, wenn der Admin später seine Rolle verliert.

Die Markierung SHALL beim Anlegen gesetzt werden und SHALL NOT nachträglich von
einem Mitglied setzbar sein.

#### Scenario: Der Feedback-Geber antwortet dem Admin

- **WHEN** ein Admin ein Gespräch ohne angenommene Kontaktanfrage eröffnet hat
  und das andere Mitglied darin eine Nachricht mit `sender_id = auth.uid()`
  einfügt
- **THEN** lässt `messages_insert` das Einfügen zu

#### Scenario: Die Freischaltung gilt nur für diesen Faden

- **WHEN** dasselbe Mitglied in einem **anderen** Gespräch ohne angenommene
  Kontaktanfrage eine Nachricht einfügen will
- **THEN** weist `messages_insert` das Einfügen ab

#### Scenario: Ein Mitglied kann sich nicht selbst freischalten

- **WHEN** ein Mitglied ohne Admin-Rolle die Markierung an einem Gespräch setzen
  oder ändern will
- **THEN** weist die Datenbank den Schreibzugriff ab

### Requirement: Der Sprung ins Gespräch läuft über einen serverseitigen Weg

Das System SHALL das Öffnen eines Gesprächs aus dem Feedback heraus über **einen
serverseitigen, atomaren Aufruf** abwickeln, der das Paar normalisiert, ein
bestehendes Gespräch zurückgibt statt ein zweites anzulegen, die
Admin-Markierung nur beim Neuanlegen setzt und ein Selbstgespräch abweist.

Ein Nachsehen-dann-Anlegen im Browser SHALL NOT der Weg sein. Zwei Gründe, beide
gemessen: die Tabelle trägt nur `unique (a_profile_id, b_profile_id)` und
**keine** Bedingung, die die Normalisierung erzwingt — ein vertauschtes Paar
verletzt den Index nicht und läge als zweites Gespräch daneben. Und zwischen dem
Nachsehen und dem Anlegen liegt ein Wettrennen, das genau dann zuschlägt, wenn
zwei Admins dieselbe Feedback-Zeile öffnen.

#### Scenario: Ein bestehendes Gespräch wird zurückgegeben, nicht verdoppelt

- **WHEN** ein Admin den Weg benutzt und zwischen beiden bereits ein Gespräch
  besteht
- **THEN** liefert der Aufruf dessen Kennung
- **AND** die Zahl der Gespräche zwischen den beiden bleibt eins

#### Scenario: Das vertauschte Paar erzeugt kein zweites Gespräch

- **WHEN** der Aufruf mit den beiden Kennungen in der umgekehrten Reihenfolge
  geschieht, verglichen mit dem bestehenden Gespräch
- **THEN** liefert er dasselbe bestehende Gespräch

#### Scenario: Zwei gleichzeitige Aufrufe erzeugen kein zweites Gespräch

- **WHEN** derselbe Aufruf zweimal nebenläufig für dasselbe Paar geschieht
- **THEN** existiert danach genau ein Gespräch, und beide Aufrufe liefern
  dieselbe Kennung

#### Scenario: Ein Selbstgespräch wird abgewiesen

- **WHEN** ein Admin den Weg an einem Feedback benutzt, das er selbst
  geschrieben hat
- **THEN** weist der Aufruf ab und legt kein Gespräch an

## MODIFIED Requirements

### Requirement: Thread visibility is limited to its participants

The system SHALL permit an authenticated member to SELECT a `message_threads`
row only when they are `a_profile_id` or `b_profile_id`, and SHALL permit a
thread INSERT only by a participant — **and only when either an `accepted`
contact request exists between the two profiles, or `is_admin()` is true for
the caller.**

Die Teilnahmeprüfung SHALL eine **eigenständige** Bedingung bleiben und SHALL
NOT mit der Freigabe-Bedingung zusammen unter die Ausnahme fallen. Sonst
erlaubte die Ausnahme einem Admin das Anlegen von Gesprächen zwischen zwei
Fremden.

Die Ausnahme SHALL an `is_admin()` hängen — servergesteuert aus `staff_roles`,
nicht an einem vom Mitglied schreibbaren Feld — und SHALL zusätzlich
`is_activated()` voraussetzen, wie jede andere Schreibzusage in diesem Modell.

#### Scenario: Non-participant cannot see a thread

- **WHEN** a member who is neither `a_profile_id` nor `b_profile_id` queries a
  thread
- **THEN** the `threads_select` policy returns no row

#### Scenario: Der Admin legt ein Gespräch ohne angenommene Kontaktanfrage an

- **WHEN** ein aktivierter Admin ein `message_threads`-Paar einfügt, an dem er
  selbst beteiligt ist, und zwischen beiden **keine** angenommene
  Kontaktanfrage steht
- **THEN** lässt `threads_insert` das Einfügen zu

#### Scenario: Ein Nicht-Admin darf das weiterhin nicht

- **WHEN** ein aktiviertes Mitglied ohne Admin-Rolle dasselbe versucht
- **THEN** weist `threads_insert` das Einfügen ab

#### Scenario: Auch der Admin bleibt an die Teilnahme gebunden

- **WHEN** ein Admin ein Gespräch zwischen **zwei anderen** Mitgliedern anlegen
  will
- **THEN** weist `threads_insert` das Einfügen ab, weil er selbst weder
  `a_profile_id` noch `b_profile_id` ist

#### Scenario: Ein deaktivierter Admin darf nicht

- **WHEN** ein Konto mit gesetzter Admin-Rolle, aber deaktiviert, ein Gespräch
  anlegen will
- **THEN** weist `threads_insert` das Einfügen ab

### Requirement: Sending requires an accepted contact request

The system SHALL permit a `messages` INSERT only when `sender_id` equals the
caller **and** the caller participates in the target thread **and** at least one
of the following holds: an `accepted` `contact_requests` row exists between the
thread's two profiles; `is_admin()` is true for the caller; or the thread is
marked as opened by an admin.

**Die Teilnahmeprüfung ist eine eigenständige Bedingung.** Das ist der Kern
dieser Änderung und der Grund, warum sie nicht als „ein `or` an die bestehende
Bedingung" formuliert werden darf: die heutige Policy prüft Kontaktanfrage und
Teilnahme in **einem** `exists`, das über `message_threads` und
`contact_requests` verbindet. Wer diesen Ausdruck als Ganzes klammert, hebt mit
der Kontaktanfrage auch die Teilnahme auf — und erlaubt einem Admin das
Schreiben in jedes fremde Gespräch. Die Ersetzung SHALL beide Bedingungen
getrennt führen.

Die Ausnahme SHALL `is_activated()` unverändert voraussetzen.

#### Scenario: Participant sends after acceptance

- **WHEN** a thread participant inserts a message with `sender_id = auth.uid()`
  and the pair's contact request is `accepted`
- **THEN** the `messages_insert` policy permits the INSERT

#### Scenario: Send is denied without acceptance

- **WHEN** a member who is not an admin attempts to insert a message on a thread
  that is neither backed by an `accepted` contact request nor marked as opened
  by an admin
- **THEN** the INSERT is denied by RLS and the client rolls back the optimistic
  message and shows a "Nachricht nicht gesendet" error

#### Scenario: Spoofed sender is denied

- **WHEN** a member inserts a message with `sender_id` other than their own auth
  uid
- **THEN** the INSERT is denied by the policy's `sender_id = auth.uid()` check

#### Scenario: Der Admin schreibt ohne angenommene Kontaktanfrage

- **WHEN** ein aktivierter Admin auf einem Gespräch, an dem er beteiligt ist,
  eine Nachricht mit `sender_id = auth.uid()` einfügt und zwischen beiden
  **keine** angenommene Kontaktanfrage steht
- **THEN** lässt `messages_insert` das Einfügen zu

#### Scenario: Der Admin schreibt NICHT in fremde Gespräche

- **WHEN** ein Admin eine Nachricht in ein Gespräch einfügt, an dem er weder
  `a_profile_id` noch `b_profile_id` ist
- **THEN** weist die Policy das Einfügen ab, weil die Teilnahmeprüfung
  eigenständig ist und von der Ausnahme nicht berührt wird

#### Scenario: Auch der Admin kann keinen fremden Absender vortäuschen

- **WHEN** ein Admin eine Nachricht mit einem `sender_id` einfügt, das nicht sein
  eigenes ist
- **THEN** weist die Policy das Einfügen ab

#### Scenario: Ein deaktivierter Admin schreibt nicht

- **WHEN** ein Konto mit gesetzter Admin-Rolle, aber deaktiviert, eine Nachricht
  ohne angenommene Kontaktanfrage einfügen will
- **THEN** weist die Policy das Einfügen ab
