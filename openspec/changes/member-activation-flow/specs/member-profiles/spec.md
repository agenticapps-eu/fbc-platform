## ADDED Requirements

### Requirement: Ein Profil trägt den Zeitpunkt seiner Aktivierung

Das System SHALL auf jedem Profil festhalten, ob und wann sein Inhaber den
Zugang bestätigt hat (`profiles.activated_at`, leer solange unbestätigt). Dieses
Feld SHALL die einzige Wahrheit dafür sein; ein zweiter Merker an anderer Stelle
SHALL NOT eingeführt werden.

Das Feld SHALL ausschließlich serverseitig gesetzt werden. Client-Rollen SHALL
kein Schreibrecht darauf halten — auch nicht mittelbar über ein
Spalten-Schreibrecht auf `profiles`.

Profile, die vor Einführung dieses Feldes bestanden, SHALL als aktiviert gelten.
Profile, die durch den Import bestehender Mitgliedschaften entstehen, SHALL als
**nicht** aktiviert angelegt werden: für sie ist der Bestätigungsweg der Zweck
des Feldes.

Die Einführung des Feldes SHALL dem Import zeitlich vorausgehen. Liefe der
Import zuerst, würde die Nachtragung genau die Konten als bestätigt
kennzeichnen, für die der Bestätigungsweg gebaut wurde — und **kein Test würde
davon rot**.

Eine Einschränkung der Nachtragung auf ein Entstehungsdatum SHALL NOT als
Sicherung dagegen gelten. Sie trägt nicht: importierte Profile entstehen
ebenfalls vor dem Zeitpunkt der Ausführung, und ein Import darf das
Entstehungsdatum auf den historischen Beitritt zurückdatieren. Eine Bedingung,
die im Schadensfall wahr ist, ist keine Sicherung, sondern eine, die beruhigt.

Stattdessen SHALL die Einführung **laut scheitern**, wenn sie einen Datenbestand
vorfindet, der auf einen bereits erfolgten Import hindeutet — geprüft an der
Anzahl vorhandener Profile gegen den bei Abfassung gemessenen Stand. Lieber eine
abgebrochene Migration als eine stille Fehlkennzeichnung.

#### Scenario: Ein importiertes Profil startet unbestätigt

- **WHEN** ein Profil im Zuge des Mitglieder-Imports angelegt wird
- **THEN** ist sein Aktivierungszeitpunkt leer, und das Konto bleibt hinter dem
  Aktivierungs-Gate, bis der Bestätigungslink eingelöst wurde

#### Scenario: Ein Bestandsprofil bleibt nutzbar

- **WHEN** die Einführung des Feldes auf einen vorhandenen Datenbestand trifft
- **THEN** tragen alle bestehenden Profile einen gesetzten Aktivierungszeitpunkt
  und werden nicht ausgesperrt

#### Scenario: Eine vertauschte Reihenfolge bricht laut ab

- **GIVEN** der Import liefe entgegen der Vorgabe vor der Einführung des Feldes
- **WHEN** die Einführung ausgeführt wird und mehr Profile vorfindet als bei
  ihrer Abfassung gemessen
- **THEN** bricht sie mit einem Fehler ab und kennzeichnet nichts, statt die
  importierten Konten stillschweigend als bestätigt zu führen

#### Scenario: Ein Mitglied kann sich nicht selbst aktivieren

- **WHEN** ein Mitglied den Aktivierungszeitpunkt seines Profils unmittelbar
  schreiben will
- **THEN** wird das abgelehnt; gesetzt wird er allein beim Einlösen eines
  gültigen Tokens

## MODIFIED Requirements

### Requirement: Public profile fields are exposed through a read-only view

The system SHALL expose a fixed public field subset (`id`, `name`, `avatar_url`,
`region`, `company`, `short_bio`, `tier`, `roles`) of `is_public` profiles
through the `profiles_public` view, granting SELECT to `authenticated` only. The
view SHALL be read-only to clients: `anon` and `authenticated` hold no
INSERT/UPDATE/DELETE, and `anon` holds no SELECT.

The view runs with its owner's privileges (`security_invoker = off`) and
therefore does **not** evaluate the base table's policies. That is deliberate —
it is what lets a `basic` member see the directory's base fields that the base
table reserves for higher ranks. The consequence SHALL be carried explicitly:
**every access condition that must hold for the directory SHALL be stated in the
view's own body**, because a condition placed only in the base table's policies
does not reach callers of the view.

The activation gate SHALL therefore be part of the view's body, **on both
sides**: an unactivated caller SHALL receive no rows, and a profile whose own
owner has not activated SHALL NOT appear for anyone.

#### Scenario: Authenticated member reads public fields of any listed profile

- **WHEN** an **activated** authenticated member selects from `profiles_public`
- **THEN** the public field subset of every `is_public` profile is returned

#### Scenario: Ein unbestätigtes Profil steht für niemanden in der Sicht

- **GIVEN** ein bestätigtes Mitglied und ein Profil, dessen Inhaber nicht
  bestätigt hat
- **WHEN** das bestätigte Mitglied `profiles_public` abfragt
- **THEN** fehlt die Zeile des unbestätigten Profils, weil die Sicht auch auf
  den Aktivierungszeitpunkt der **Zeile** filtert

#### Scenario: Ein nicht aktiviertes Konto erhält aus der Sicht nichts

- **GIVEN** ein angemeldetes Konto, dessen Aktivierungszeitpunkt leer ist —
  unabhängig von seiner Mitgliedsstufe
- **WHEN** es `profiles_public` abfragt
- **THEN** erhält es null Zeilen — **einschließlich der eigenen** —, weil die
  Bedingung im Rumpf der Sicht steht und nicht in einer Policy, an der die Sicht
  vorbeiliefe. Die eigene Zeile ist hier keine Ausnahme: wer sich mit einem
  weitergegebenen Passwort anmeldet, ist gegenüber der Sicht das Mitglied

#### Scenario: Writes through the view are rejected

- **WHEN** any client issues INSERT/UPDATE/DELETE against `profiles_public`
- **THEN** the write is denied (write privileges were revoked from `anon` and
  `authenticated`)

#### Scenario: Anonymous visitor cannot read the view

- **WHEN** an anonymous (`anon`) caller selects from `profiles_public`
- **THEN** no rows are returned (SELECT was revoked from `anon`)

### Requirement: Sign-up auto-provisions a profile

The system SHALL create exactly one `profiles` row for every new auth user via
the `SECURITY DEFINER` trigger `handle_new_user`, seeding `name` from the auth
user's metadata (`full_name` or `name`) and `tier = 'basic'`. Clients SHALL NOT
hold INSERT on `profiles`; profile creation is trigger-only.

Ein so entstandenes Profil SHALL **unbestätigt** sein: der Trigger SHALL keinen
Aktivierungszeitpunkt setzen. Eine Selbstregistrierung führt damit auf die
niedrigste Stufe **und** hinter das Aktivierungs-Gate; erst das Einlösen eines
Tokens öffnet beides nicht, sondern nur Letzteres.

#### Scenario: A new auth user gets a Basic profile

- **WHEN** a row is inserted into `auth.users`
- **THEN** a matching `profiles` row is created with `tier = 'basic'` and `name`
  copied from the user's `full_name`/`name` metadata

#### Scenario: Eine Selbstregistrierung ist nicht sofort aktiviert

- **WHEN** sich jemand selbst registriert
- **THEN** trägt sein Profil `tier = 'basic'` und keinen Aktivierungszeitpunkt

#### Scenario: Client cannot insert a profile directly

- **WHEN** an authenticated client attempts to INSERT into `profiles`
- **THEN** the write is denied (no client INSERT grant/policy; the trigger owns
  provisioning)
