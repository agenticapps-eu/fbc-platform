## ADDED Requirements

### Requirement: Ein Profil trägt den Zeitpunkt seiner Aktivierung

Das System SHALL auf jedem Profil festhalten, ob und wann sein Inhaber den
Zugang bestätigt hat (`profiles.activated_at`, leer solange unbestätigt). Dieses
Feld SHALL die einzige Wahrheit dafür sein; ein zweiter Merker an anderer Stelle
SHALL NOT eingeführt werden.

Das Feld SHALL ausschließlich serverseitig gesetzt werden. Client-Rollen SHALL
kein Schreibrecht darauf halten — auch nicht mittelbar über ein
Spalten-Schreibrecht auf `profiles`.

Profile, die vor Einführung dieses Feldes bestanden, SHALL als aktiviert gelten
— **aber nur, wenn ihr Inhaber ein Postfach nachgewiesen hat**. Weil die
E-Mail-Bestätigung beim Anmeldedienst abgeschaltet ist, kann unter den
Bestandsprofilen jedes sein, das nie einen Nachweis erbracht hat; die
Nachtragung SHALL diese **nicht** erfassen, sonst kennzeichnet sie genau die
Konten als bestätigt, für die der Bestätigungsweg gebaut wurde. Maßgeblich ist
der beim Anmeldedienst hinterlegte Bestätigungszeitpunkt der Adresse.

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
vorfindet, der auf einen bereits erfolgten Import hindeutet. Geprüft SHALL dabei
**nicht nur die Gesamtzahl** der Profile werden, sondern auch die Zahl der
Profile auf der **höchsten Mitgliedsstufe**: importierte Konten tragen sie,
Selbstregistrierer nicht. Eine Prüfung allein auf die Gesamtzahl bräche bei
jeder organischen Selbstregistrierung zwischen Messung und Ausführung ab und
könnte „der Import lief zu früh" nicht von „jemand hat sich angemeldet"
unterscheiden. Lieber eine abgebrochene Migration als eine stille
Fehlkennzeichnung.

#### Scenario: Ein importiertes Profil startet unbestätigt

- **WHEN** ein Profil im Zuge des Mitglieder-Imports angelegt wird
- **THEN** ist sein Aktivierungszeitpunkt leer, und das Konto bleibt hinter dem
  Aktivierungs-Gate, bis der Bestätigungslink eingelöst wurde

#### Scenario: Ein Bestandsprofil bleibt nutzbar

- **WHEN** die Einführung des Feldes auf einen vorhandenen Datenbestand trifft
- **THEN** tragen alle bestehenden Profile **mit nachgewiesenem Postfach** einen
  gesetzten Aktivierungszeitpunkt und werden nicht ausgesperrt

#### Scenario: Ein Bestandsprofil ohne Nachweis wird nicht mitgestempelt

- **GIVEN** ein vor der Einführung entstandenes Profil, dessen Adresse beim
  Anmeldedienst nie bestätigt wurde
- **WHEN** die Nachtragung läuft
- **THEN** bleibt sein Aktivierungszeitpunkt leer, und es durchläuft denselben
  Bestätigungsweg wie ein importiertes Konto

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

### Requirement: Full profile and extended data are gated by membership rank

The system SHALL restrict SELECT of a full `profiles` base-table row (including
`interests`, `competencies`, free-text `goals`, `headline`, `dev_focus`, and
other extended columns) to the profile's owner OR a caller with `level_rank >= 3`
(`discover`), via the policy `profiles_select_self_or_discover` using
`has_level(3)`. The extended sub-tables `profile_theme_scores`,
`profile_interests`, and `profile_badges` SHALL follow the same threshold for
SELECT (own profile OR `has_level(3)`), while `profile_theme_scores` and
`profile_interests` remain client-writable only for the owner and
`profile_badges` has no client write policy (awarded server-side).

Der Rang SHALL **zusätzlich** zur Aktivierung wirken, nicht an ihrer Stelle. Ein
nicht aktiviertes Konto SHALL keine dieser Zeilen erhalten — **auch nicht die
eigene**. Die Zusage „nur die eigene Zeile" gilt erst ab der Bestätigung; davor
ist auch die eigene Zeile verschlossen, weil ein übernommenes Konto gegenüber
der Datenbank das Mitglied ist.

Ebenso SHALL das Zielprofil bestätigt sein: eine Zeile SHALL für Dritte erst
erscheinen, wenn **ihr Inhaber** aktiviert hat. Das gilt für `profiles` und für
die drei genannten Untertabellen.

#### Scenario: Below Discover an activated member sees only their own full row

- **WHEN** a **bestätigtes** `basic`/`connect` member (rank < 3) selects another
  member's full `profiles` row or their extended sub-tables
- **THEN** RLS returns no row for the other member (only the caller's own row is visible)

#### Scenario: Discover-and-above sees full rows and extended data

- **WHEN** a **bestätigtes** member with `level_rank >= 3` selects other members'
  `profiles` rows, `profile_theme_scores`, `profile_interests`, or
  `profile_badges`
- **THEN** those rows are returned, sofern deren Inhaber ebenfalls bestätigt haben

#### Scenario: Ohne Bestätigung ist auch die eigene Zeile verschlossen

- **GIVEN** ein angemeldetes Konto mit `tier = 'impact'` und leerem
  Aktivierungszeitpunkt
- **WHEN** es seine **eigene** `profiles`-Zeile oder seine eigenen
  `profile_interests` / `profile_theme_scores` abfragt
- **THEN** liefert RLS null Zeilen — der Rang trägt hier nichts, weil das Gate
  davor sitzt

#### Scenario: A member cannot self-award a badge

- **WHEN** an authenticated member attempts to INSERT into `profile_badges`
- **THEN** the write is denied (no client write policy; badges are awarded by service_role/admin)

### Requirement: Contact data is disclosed only after an accepted contact request

The system SHALL keep contact details in a separate `profile_contacts` table
(`email`, `phone`, `website`) whose SELECT policy
`contacts_select_self_or_released` returns a row only to its owner OR to a
counterparty that shares an `accepted` row in `contact_requests`. Contact data
SHALL never be exposed through `profiles_public` or the rank-gated profile row.

Beide Zweige — Eigentümer wie freigegebene Gegenseite — SHALL zusätzlich die
Aktivierung des Aufrufers voraussetzen. Gerade die **eigene** Kontaktzeile ist
hier der Punkt: sie trägt E-Mail und Telefonnummer des Mitglieds, und wer sich
mit einem weitergegebenen Passwort anmeldet, holte sie sonst als Erstes ab.
Zusätzlich SHALL die Zeile des **Zielprofils** dessen Bestätigung voraussetzen.

#### Scenario: Owner reads their own contact data

- **WHEN** a **bestätigtes** member selects their own `profile_contacts` row
- **THEN** the row is returned

#### Scenario: Die eigene Kontaktzeile bleibt vor der Bestätigung verschlossen

- **GIVEN** ein angemeldetes, nicht bestätigtes Konto
- **WHEN** es seine eigene `profile_contacts`-Zeile abfragt
- **THEN** liefert RLS null Zeilen — E-Mail und Telefonnummer sind nicht
  abholbar, obwohl es formal die eigenen Daten sind

#### Scenario: Contact data stays hidden without acceptance

- **WHEN** a member selects another member's `profile_contacts` row and no
  `accepted` `contact_requests` row links the two
- **THEN** RLS returns no row

#### Scenario: Acceptance reveals contact data

- **WHEN** a `contact_requests` row between the two members reaches
  `status = 'accepted'`
- **THEN** each may thereafter SELECT the other's `profile_contacts` row, sofern
  beide bestätigt sind

### Requirement: Private profile data is strictly owner-only

The system SHALL restrict the `goals` table and the `member_settings` table to
the owning member for both read and write (policies `goals_own` and
`member_settings_own`, keyed on `profile_id = auth.uid()`), never exposing them
to higher tiers or to the public. `member_settings` SHALL hold the member's
notification, contactability and **presentation** preferences (e.g.
`notify_email_requests`, `contactable_by_prime`, `theme`).

„Owner-only" SHALL **Eigentümer und bestätigt** heißen. Ein nicht aktiviertes
Konto SHALL weder lesen noch schreiben können; die Oberfläche SHALL das als
regulären Zustand behandeln und nicht als Fehler melden.

The `theme` column SHALL accept only `hell` or `navy` and SHALL default to `hell`.
It carries no access-control meaning: it selects a presentation and SHALL NOT gate
what any member may read or write. It is governed by the existing owner-only policy
and the table's existing grants — the column adds no new policy and no new grant.

Owner-only describes the stored row. The same choice is additionally mirrored into
device-local `localStorage`, because the server value cannot arrive before the first
paint; that copy is readable by anything running on the device and is deliberately
not account-scoped. This is stated rather than fixed: the theme reveals nothing
about the member, and the alternative — no local copy — costs every member a visible
theme flash on every load.

Weil die gespeicherte Zeile hinter dem Gate liegt, die lokale Kopie aber nicht,
SHALL der Aktivierungsbildschirm mit der lokalen Kopie auskommen und den
Serverabgleich stillschweigend auslassen.

#### Scenario: Goals are invisible to everyone but the owner

- **WHEN** any member other than the owner selects the owner's `goals` rows
- **THEN** RLS returns no row, regardless of the caller's tier

#### Scenario: A member manages only their own settings

- **WHEN** a **bestätigtes** member reads or writes `member_settings`
- **THEN** only the row where `profile_id = auth.uid()` is accessible; writes to
  another member's row are denied

#### Scenario: Ziele und Einstellungen bleiben vor der Bestätigung verschlossen

- **GIVEN** ein angemeldetes, nicht bestätigtes Konto
- **WHEN** es seine eigenen `goals` oder `member_settings` liest oder schreibt
- **THEN** liefert das Lesen null Zeilen und das Schreiben wird abgelehnt, ohne
  dass die Oberfläche einen Fehler anzeigt

#### Scenario: A member's theme choice is private to them

- **WHEN** a member writes `theme` on their own `member_settings` row
- **THEN** the write succeeds, and no other member can read or change that value

#### Scenario: An unsupported theme value is rejected

- **WHEN** a write sets `theme` to any value other than `hell` or `navy`
- **THEN** the write is rejected by the database, not merely by the client

### Requirement: Profile media is stored and gated per member

The system SHALL store avatars in a public `avatars` storage bucket where writes
are restricted to the caller's own `{uid}/…` folder (policies
`avatars_insert_own` / `avatars_update_own` / `avatars_delete_own`), and SHALL
store an ordered `profiles.videos text[]` of provider URLs whose visibility
follows the existing `profiles` RLS (no separate access path).

Die drei Schreib-Policies SHALL zusätzlich die Aktivierung voraussetzen: ein
übernommenes Konto SHALL das Profilbild des Mitglieds nicht austauschen können.

Für **Lesezugriffe** SHALL ausgeschrieben sein, was das Gate konstruktionsbedingt
nicht erreicht: der Bucket ist `public` und trägt bewusst keine SELECT-Policy,
Objekte rendern über ihre URL. Wovor das Gate schützt, ist das **Erfahren** der
URL — `profiles.avatar_url` liegt dahinter. Ein nicht aktiviertes Konto SHALL
keine Bild-URL erhalten; ein Abruf mit bereits bekannter URL SHALL als benannte,
vorbestehende Restfläche gelten und nicht als Zusage dieses Requirements.

#### Scenario: A member uploads only into their own avatar folder

- **WHEN** an **activated** authenticated member uploads an object to the
  `avatars` bucket under a first path segment equal to their `auth.uid()`
- **THEN** the write is permitted; a write under any other member's folder is denied

#### Scenario: Ein nicht bestätigtes Konto tauscht kein Profilbild aus

- **GIVEN** ein angemeldetes, nicht bestätigtes Konto
- **WHEN** es ein Objekt in seinen eigenen `{uid}/…`-Ordner schreibt
- **THEN** wird der Schreibzugriff abgelehnt

#### Scenario: Profile videos inherit profile visibility

- **WHEN** a caller can read a given `profiles` row under RLS
- **THEN** that row's `videos` array is visible to them, and to no one who cannot read the row
