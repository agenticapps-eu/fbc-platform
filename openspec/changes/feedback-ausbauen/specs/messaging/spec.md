## MODIFIED Requirements

### Requirement: Thread visibility is limited to its participants

The system SHALL permit an authenticated member to SELECT a `message_threads`
row only when they are `a_profile_id` or `b_profile_id`, and SHALL permit a
thread INSERT only by a participant for whom an `accepted` contact request
exists between the two profiles — **or by a participant for whom `is_admin()`
is true.**

Die Ausnahme ist ausgesprochen und nicht umgangen: sie steht in der Policy, nicht
im Frontend. Ein Gate, das nur die Oberfläche kennt, ist bei dieser Fähigkeit
besonders wertlos, weil die Sichtbarkeit hier per RLS erzwungen wird und die
Oberfläche nur Komfort ist.

Die Ausnahme SHALL NOT die Teilnehmerprüfung aufheben: auch ein Admin SHALL nur
Gespräche anlegen, an denen er selbst beteiligt ist. Sie hängt an der
Admin-Rolle aus `staff_roles`, nicht an einem vom Mitglied schreibbaren Feld.

#### Scenario: Non-participant cannot see a thread

- **WHEN** a member who is neither `a_profile_id` nor `b_profile_id` queries a
  thread
- **THEN** the `threads_select` policy returns no row

#### Scenario: Der Admin legt ein Gespräch ohne angenommene Kontaktanfrage an

- **WHEN** ein Admin ein `message_threads`-Paar einfügt, an dem er selbst
  beteiligt ist, und zwischen beiden **keine** angenommene Kontaktanfrage steht
- **THEN** lässt `threads_insert` das Einfügen zu

#### Scenario: Ein Nicht-Admin darf das weiterhin nicht

- **WHEN** ein Mitglied ohne Admin-Rolle dasselbe versucht
- **THEN** weist `threads_insert` das Einfügen weiterhin ab

#### Scenario: Auch der Admin bleibt an die Teilnahme gebunden

- **WHEN** ein Admin ein Gespräch zwischen **zwei anderen** Mitgliedern anlegen
  will
- **THEN** weist `threads_insert` das Einfügen ab, weil er selbst weder
  `a_profile_id` noch `b_profile_id` ist

### Requirement: Sending requires an accepted contact request

The system SHALL permit a `messages` INSERT only when `sender_id` equals the
caller, the caller participates in the target thread, AND an `accepted`
`contact_requests` row exists between the thread's two profiles — **or
`is_admin()` is true for the caller**; a message SHALL NOT be sendable on a
thread whose contact request is not accepted by a caller who is not an admin.

Die Ausnahme steht in **beiden** Policies — hier und in `threads_insert`. Wer
nur eine von beiden anfasst, baut einen Admin, der ein Gespräch anlegen, aber
nicht hineinschreiben kann, oder umgekehrt: in beiden Fällen bricht der Weg auf
halber Strecke, und zwar erst zur Laufzeit.

Die Ausnahme SHALL NOT die übrigen Bedingungen aufheben: `sender_id` SHALL
weiterhin dem Aufrufer entsprechen, und der Aufrufer SHALL weiterhin am
Gespräch beteiligt sein.

#### Scenario: Participant sends after acceptance

- **WHEN** a thread participant inserts a message with `sender_id = auth.uid()`
  and the pair's contact request is `accepted`
- **THEN** the `messages_insert` policy permits the INSERT

#### Scenario: Send is denied without acceptance

- **WHEN** a member who is not an admin attempts to insert a message on a thread
  whose contact request is not `accepted`
- **THEN** the INSERT is denied by RLS and the client rolls back the optimistic
  message and shows a "Nachricht nicht gesendet" error

#### Scenario: Spoofed sender is denied

- **WHEN** a member inserts a message with `sender_id` other than their own auth
  uid
- **THEN** the INSERT is denied by the policy's `sender_id = auth.uid()` check

#### Scenario: Der Admin schreibt ohne angenommene Kontaktanfrage

- **WHEN** ein Admin auf einem Gespräch, an dem er beteiligt ist, eine Nachricht
  mit `sender_id = auth.uid()` einfügt und zwischen beiden **keine** angenommene
  Kontaktanfrage steht
- **THEN** lässt `messages_insert` das Einfügen zu

#### Scenario: Auch der Admin kann keinen fremden Absender vortäuschen

- **WHEN** ein Admin eine Nachricht mit einem `sender_id` einfügt, das nicht sein
  eigenes ist
- **THEN** weist die Policy das Einfügen weiterhin ab

#### Scenario: Auch der Admin schreibt nicht in fremde Gespräche

- **WHEN** ein Admin eine Nachricht in ein Gespräch einfügt, an dem er nicht
  beteiligt ist
- **THEN** weist die Policy das Einfügen ab
