# Member Profiles

## Purpose

Defines the member profile: how it is provisioned, which fields are public,
which are gated by membership rank, and which contact/private data is never
disclosed without an explicit action. Visibility is enforced by Postgres RLS on
the base tables, not by the client. Reconstructed from the code as of the
OpenSpec migration; supersedes the legacy 3-tier profile visibility described in
`docs/legacy-planning/`.
## Requirements
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

### Requirement: Public profile fields are exposed through a read-only view

The system SHALL expose a fixed public field subset (`id`, `name`, `avatar_url`,
`region`, `company`, `short_bio`, `tier`, `roles`, `cover_url`) of `is_public`
profiles through the `profiles_public` view, granting SELECT to `authenticated`
only. The view SHALL be read-only to clients: `anon` and `authenticated` hold no
INSERT/UPDATE/DELETE, and `anon` holds no SELECT.

Neue Felder SHALL an das **Ende** der Spaltenliste treten. `create or replace
view` verlangt, dass bestehende Spalten Name, Typ und Reihenfolge behalten; eine
Spalte in der Mitte einzufügen lässt die Anweisung scheitern. Die Reihenfolge
oben ist deshalb Vorschrift, nicht Darstellung.

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

Weil die Sicht für jede Feldergänzung vollständig neu deklariert werden muss,
SHALL jede solche Neudeklaration das Gate wortgleich mitführen. Eine Ergänzung,
die es beim Abschreiben verliert, öffnet das Verzeichnis lautlos und wäre an der
Sicht selbst nicht abzulesen.

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

#### Scenario: Das Hintergrundbild erreicht die fremde Profilansicht

- **GIVEN** ein bestätigtes, öffentliches Profil mit gesetztem `cover_url`
- **WHEN** ein anderes bestätigtes Mitglied `profiles_public` für dieses Profil liest
- **THEN** enthält das Ergebnis `cover_url`

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

#### Scenario: Below Discover a member sees only their own full row

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
(`email`, `phone`) whose SELECT policy `contacts_select_self_or_released`
returns a row only to its owner OR to a counterparty that shares an `accepted`
row in `contact_requests`. Contact data SHALL never be exposed through
`profiles_public` or the rank-gated profile row.

Die **vollständige Anschrift** SHALL Teil dieser Zeile sein und keine eigene
Sichtbarkeitsregel bekommen: `street`, `postal_code`, `city`, `state` und
`country` liegen auf `public.profile_contacts` und werden von derselben Policy
gedeckt wie E-Mail und Telefonnummer. Sie SHALL NOT auf `public.profiles`
liegen — dort wäre sie für jedes eingeloggte Mitglied lesbar, und die
Anschrift ist ein Stammdatum, das der Club braucht, aber nicht das Verzeichnis.

`public.profiles.region` SHALL davon unberührt bleiben und weiterhin die
**Regionalgruppe** bezeichnen (die FBC-Standortzugehörigkeit), nicht den
Wohnort. Die beiden SHALL NOT vermischt werden: `region` steuert Filter und
Zugehörigkeit, die Anschrift ist Stammdatum.

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

#### Scenario: Die Anschrift liefert ohne angenommene Kontaktanfrage nichts

- **GIVEN** ein bestätigtes Mitglied, dessen `profile_contacts`-Zeile eine
  vollständige Anschrift trägt
- **WHEN** ein anderes bestätigtes Mitglied ohne angenommene Kontaktanfrage
  `street`, `postal_code`, `city`, `state` oder `country` dieser Zeile abfragt
- **THEN** liefert RLS null Zeilen — die Anschrift ist genauso verschlossen wie
  Telefonnummer und E-Mail und SHALL NOT über eine eigene Spaltenauswahl
  erreichbar sein

#### Scenario: Nach der Annahme kommt die Anschrift mit

- **GIVEN** zwei bestätigte Mitglieder mit einer `accepted` Kontaktanfrage
- **WHEN** eines die Kontaktzeile des anderen liest
- **THEN** enthält dieselbe freigegebene Zeile neben E-Mail und Telefonnummer
  auch die fünf Adressfelder

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
`avatars_insert_own` / `avatars_update_own` / `avatars_delete_own`), SHALL store
Hintergrundbilder in einem **getrennten** Bucket `covers` unter denselben
Schreibregeln (`covers_insert_own` / `covers_update_own` / `covers_delete_own`),
and SHALL store an ordered `profiles.videos text[]` of provider URLs whose
visibility follows the existing `profiles` RLS (no separate access path).

Der getrennte Bucket SHALL gewählt sein, damit Dateigröße und Dateityp
**serverseitig** an das Objekt gebunden sind (`file_size_limit`,
`allowed_mime_types`) und nicht nur an das Formular. Beide Werte SHALL beziffert
sein, und das Anlegen SHALL eine abweichende Bestandskonfiguration
**überschreiben** statt sie zu konservieren — sonst liefe der Test grün gegen
einen falsch eingestellten Bucket.

Die Schreib-Policies **beider** Buckets SHALL zusätzlich die Aktivierung
voraussetzen: ein übernommenes Konto SHALL weder das Profilbild noch das
Hintergrundbild des Mitglieds austauschen können. Weil dieselbe Regel damit an
sechs Stellen steht, SHALL ein Test dieselbe Falltabelle gegen **beide** Buckets
führen; eine Änderung an nur einem Bucket SHALL dadurch rot werden.

Weil beide Policies den ersten Pfadabschnitt gegen die `auth.uid()` **des
Aufrufers** prüfen, SHALL ein Bild **nur vom Mitglied selbst** hochgeladen
werden können. Ein Admin, der ein fremdes Profil bearbeitet, SHALL diese
Steuerung nicht angeboten bekommen, statt an der Policy zu scheitern.

Für **Lesezugriffe** SHALL ausgeschrieben sein, was das Gate konstruktionsbedingt
nicht erreicht: beide Buckets sind `public` und tragen bewusst keine
SELECT-Policy, Objekte rendern über ihre URL. Wovor das Gate schützt, ist das
**Erfahren** der URL — `profiles.avatar_url` und `profiles.cover_url` liegen
dahinter. Ein nicht aktiviertes Konto SHALL keine Bild-URL erhalten; ein Abruf
mit bereits bekannter URL SHALL als benannte, vorbestehende Restfläche gelten
und nicht als Zusage dieses Requirements. Dasselbe SHALL für abgelöste Bilder
gelten: ein ersetztes oder entkoppeltes Objekt bleibt abrufbar.

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

#### Scenario: Ein Mitglied schreibt Hintergrundbilder nur in seinen eigenen Ordner

- **WHEN** ein bestätigtes Mitglied ein Objekt in `covers` unter einem ersten
  Pfadabschnitt gleich seiner `auth.uid()` ablegt
- **THEN** wird der Schreibzugriff angenommen; ein Schreibzugriff unter der
  `auth.uid()` eines anderen Mitglieds wird abgelehnt

#### Scenario: Ein nicht bestätigtes Konto lädt kein Hintergrundbild hoch

- **GIVEN** ein angemeldetes, nicht bestätigtes Konto
- **WHEN** es ein Objekt in seinen eigenen `{uid}/…`-Ordner in `covers` schreibt
- **THEN** wird der Schreibzugriff abgelehnt

#### Scenario: Ein zu großes oder falsch typisiertes Bild wird abgewiesen

- **WHEN** ein bestätigtes Mitglied ein Objekt über der Größengrenze oder mit
  einem anderen Typ als WebP in `covers` ablegt
- **THEN** weist die Storage-Schnittstelle es ab, unabhängig davon, was der
  Client geprüft hat

#### Scenario: Der Admin bekommt im Fremd-Modus keine Bild-Steuerung

- **WHEN** ein Admin ein fremdes Profil bearbeitet
- **THEN** sind Profilbild- und Hintergrundbild-Steuerung nicht vorhanden

### Requirement: Completion and potential scores are server-maintained

The system SHALL compute `profiles.profile_completion` on every profile
insert/update via the `set_profile_completion` trigger (12 equally weighted
fields → 0–100), and SHALL expose potential-score recomputation only through the
`SECURITY DEFINER` RPC `recompute_potential_score(profile_id)`, which a member
may invoke only for their own profile. Neither `profile_completion` nor
`potential_score` SHALL be in the client UPDATE grant.

#### Scenario: Completion recomputes on write

- **WHEN** a member updates their profile row
- **THEN** `profile_completion` is recomputed by the trigger from the row's fields, not from a client-supplied value

#### Scenario: A member cannot recompute another member's score

- **WHEN** an authenticated member calls `recompute_potential_score` for a
  `profile_id` other than their own
- **THEN** the function raises an authorization error (errcode 42501)

### Requirement: The profile editor carries the offer and need categories

The system SHALL let a member declare what they offer and what they seek directly
in the profile editor, as two chip groups with multiple selection drawn from the
compass category vocabulary — the offer side and the need side listed separately,
because the two sets differ.

The selection SHALL be the member's own `offers` and `needs`, not a second copy of
them: opening the editor SHALL show a category as selected exactly when the member
holds at least one row in it, and saving SHALL reconcile per category rather than
replace the collection. A member SHALL be able to reach this without visiting the
Kompass page, which carries no menu entry.

Removing a category discards content that is not visible on this screen — a
description, tags and a volume band authored in the rich editor. The editor SHALL
therefore require an **explicit confirmation** naming what will be lost, not a
passive hint, before such a deselection is saved.

Whether confirmation is due SHALL be decided by the row's recorded authoring
surface, not by which of its columns happen to be empty: a category holding any
editor-authored row requires it, a category holding only chip-authored rows does
not. A prompt that always fires is a prompt nobody reads, and a structural guess
would delete a title-only rich entry without asking.

#### Scenario: Existing rows pre-select their categories

- **WHEN** a member with an offer in `kapital` opens the profile editor
- **THEN** the `kapital` chip is shown as selected

#### Scenario: Selection survives a round trip

- **WHEN** a member selects `mentoring`, saves, and reopens the editor
- **THEN** `mentoring` is still selected and one `offers` row backs it

#### Scenario: The member confirms before losing a rich entry

- **WHEN** a member deselects a category in which they hold an entry with a
  description or tags
- **THEN** an explicit confirmation names that entry and the save proceeds only
  after it is given

#### Scenario: Removing a chip-authored category asks nothing

- **WHEN** a member deselects a category whose rows were all created by chip
- **THEN** they are removed on save without a confirmation prompt

### Requirement: A member's own profile shows no invented data about them

A surface that presents a member's own activity, holdings or history SHALL show
only data the system actually holds. Where a capability does not exist yet, the
surface SHALL omit the section rather than fill it with sample figures.

A "Demo" badge SHALL NOT be treated as sufficient: it explains the numbers to
whoever built them, not to a member reading their own profile, and a member who
believes a figure about themselves has been misinformed regardless of the label.

Omission SHALL be preferred to an empty state where the capability itself is
absent — an empty state announces a feature that is coming, which is only honest
when one is.

#### Scenario: Absent capability renders nothing

- **WHEN** a member opens their own profile and the platform holds no statistics,
  projects or investments for them
- **THEN** no such section is rendered, with or without sample values

#### Scenario: Present capability renders an empty state

- **WHEN** a member holds no event registrations, a capability the platform does
  have
- **THEN** an empty state invites them to the events page rather than listing
  sample events

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

### Requirement: Ein Profil trägt ein Hintergrundbild

Das System SHALL auf `public.profiles` eine Spalte `cover_url text` führen, die
auf ein Hintergrundbild der Profilansicht zeigt. Sie SHALL im
Client-UPDATE-Grant liegen: das Hintergrundbild ist eine Angabe des Mitglieds
über sich selbst, wie `avatar_url`.

Damit der Wert die Ansicht fremder Profile erreicht, SHALL er zusätzlich in der
öffentlichen Projektion stehen (siehe „Public profile fields are exposed through
a read-only view"). Eine Spalte, die nur auf der Basistabelle liegt, bleibt für
jeden Betrachter außer dem Eigentümer unsichtbar.

Das Hintergrundbild SHALL auch auf dem **eigenen** Profil erscheinen. Diese
Ansicht liest über einen anderen Weg als die fremde (`dashboard`, nicht
`profiles_public`); wird nur einer der beiden ergänzt, lädt ein Mitglied ein
Bild hoch und sieht es an der Stelle nicht, an der es danach sucht.

Das Hintergrundbild SHALL NOT in die Vollständigkeitsberechnung
(`set_profile_completion`) eingehen. Die zwölf gewichteten Felder und ihre
Schwelle bleiben unverändert; eine Änderung verschöbe rückwirkend den
Vollständigkeitsgrad jedes bestehenden Profils, ohne dass jemand etwas an
seinem Profil getan hätte.

Das Entfernen eines Hintergrundbildes SHALL als **Entkoppeln** gelten, nicht als
Löschen: `cover_url` wird geleert, das Objekt im Bucket bleibt bestehen und über
seine URL abrufbar. Das entspricht dem Verhalten beim Avatar und SHALL benannt
sein, statt als Löschung versprochen zu werden.

#### Scenario: Ein Mitglied setzt sein eigenes Hintergrundbild

- **WHEN** ein bestätigtes Mitglied `cover_url` auf seiner eigenen Profilzeile schreibt
- **THEN** wird der Schreibzugriff angenommen

#### Scenario: Das eigene Profil zeigt das eigene Hintergrundbild

- **WHEN** ein Mitglied nach dem Hochladen seine eigene Profilansicht öffnet
- **THEN** erscheint das Hintergrundbild dort ebenso wie auf der fremden Ansicht

#### Scenario: Die Vollständigkeit bleibt unverändert

- **WHEN** ein Mitglied ausschließlich `cover_url` setzt
- **THEN** ändert sich `profile_completion` nicht

### Requirement: Herkunft und Laufzeit der Altmitgliedschaft liegen außerhalb der Profilzeile

Das System SHALL die Daten des Übergangs aus dem Altsystem in einer eigenen
Tabelle `public.profile_legacy` führen (1:1 zu `profiles`, `profile_id` als
Primärschlüssel), mit `paid_until date`, `legacy_tier text`,
`legacy_price numeric` und `legacy_source_id text`.

Diese Felder SHALL NOT Spalten auf `public.profiles` sein. Ein Spalten-Grant
regelt nur das **Schreiben**; gelesen wird `public.profiles` über ein
Tabellen-SELECT für `authenticated`, und die geltende Policy gibt jedem
bestätigten Mitglied ab `discover` die **volle Zeile** jedes anderen bestätigten
Mitglieds. Der tatsächlich gezahlte Preis stünde damit offen. Postgres kennt
kein spaltenweises Leseverbot bei erteiltem Tabellen-SELECT — die Trennung SHALL
deshalb über die Tabelle laufen.

Die Tabelle SHALL RLS tragen und **keinerlei** Grant für `anon` oder
`authenticated` halten. Geschrieben SHALL sie auf zwei Wegen werden: durch den
Import über eine **direkte Datenbankverbindung** und durch die
Admin-Funktionen.

`service_role` SHALL dafür NOT in Betracht kommen. Es hält seit dem
Grant-Lockdown auf keiner Tabelle in `public` ein Lese- oder Schreibrecht;
alles, was es tut, geht durch `SECURITY DEFINER`-Funktionen. Ein Importweg über
die REST-Fläche bräuchte deshalb eine eigene solche Funktion — kein Grant.

`paid_until` SHALL den **letzten eingeschlossenen** Kalendertag der bereits
bezahlten Mitgliedschaft tragen. `null` SHALL **unbekannt** bedeuten und nicht
„unbefristet". Der Typ SHALL `date` sein und nicht `timestamptz`: der Ablauf
einer Mitgliedschaft ist ein Kalendertag, und eine Zeitzone verschöbe den
Stichtag je nach Betrachter um einen Tag.

Das Feld SHALL angelegt sein, **bevor** der Import läuft: alle
Bestandsmitglieder erhalten die höchste Stufe, aber nur bis zu diesem Tag. Wird
das Datum beim Import nicht mitgeschrieben, ist die Zusage danach **nicht
rekonstruierbar** — die Stufe allein unterscheidet ein befristetes
Bestandsrecht nicht von einer dauerhaften Mitgliedschaft, und das Fehlen fällt
nicht beim Import auf, sondern erst bei der ersten Verlängerung.

Was beim **Erreichen** von `paid_until` geschieht, SHALL hier NOT festgelegt
sein — das ist eine Abrechnungsentscheidung. Festgelegt ist, dass die Tatsache
festgehalten wird.

`legacy_tier` SHALL die **rohe** Bezeichnung aus dem Altsystem tragen; eine
Normalisierung beim Import nähme die Herkunft weg. `legacy_price` SHALL der
tatsächlich gezahlte Bruttobetrag in Euro für die abgelaufene Periode sein.

`legacy_source_id` SHALL die Kennung des Datensatzes im Altsystem tragen und
SHALL durch einen Unique-Index über den **getrimmten** Wert eindeutig sein
(`nullif(btrim(legacy_source_id), '')`, partiell auf `is not null`). Ohne das
Trimmen kollidieren eine leere und eine aus Leerzeichen bestehende Kennung
nicht, obwohl beide „keine Kennung" bedeuten.

Der Index SHALL als **Wiederholbarkeit** gelten, nicht als Atomarität: bricht
der Import zwischen dem Anlegen des Anmeldekontos und dem Schreiben der Kennung
ab, bleibt ein Konto ohne Kennung zurück, das ein zweiter Lauf nicht
wiedererkennt. Das Import-Script SHALL die Kennung deshalb vor oder gemeinsam
mit dem Profil schreiben.

#### Scenario: Ein Mitglied sieht die Altdaten eines anderen nicht

- **GIVEN** zwei bestätigte Mitglieder, das lesende ab Stufe `discover`
- **WHEN** es `profile_legacy` des anderen abfragt
- **THEN** erhält es null Zeilen — es hält weder Grant noch Policy

#### Scenario: Ein Mitglied sieht auch die eigenen Altdaten nicht über den Client

- **WHEN** ein bestätigtes Mitglied seine eigene `profile_legacy`-Zeile abfragt
- **THEN** erhält es null Zeilen; der Weg dorthin führt über die Admin-Funktionen

#### Scenario: Der Import ist wiederholbar

- **GIVEN** eine `profile_legacy`-Zeile mit gesetztem `legacy_source_id`
- **WHEN** ein zweiter Datensatz mit derselben Kennung angelegt werden soll
- **THEN** verhindert der Unique-Index den zweiten Eintrag

#### Scenario: Leere Kennungen kollidieren nicht mit echten

- **WHEN** mehrere Zeilen `legacy_source_id` als `null`, als `''` oder als
  Leerzeichenfolge tragen
- **THEN** greift der Index für keine von ihnen und alle bestehen nebeneinander

### Requirement: Die Profilansicht folgt dem Mockup

Das System SHALL die Ansicht eines Mitgliedsprofils in dieser Ordnung zeigen:
Hintergrundbild, davor überlappend das Profilbild, Name mit Stufen-Badge,
Kurzbeschreibung, Kontakt-Schaltflächen, danach die Abschnitte „Über mich",
„Beruf", „Hobbys", „Ich biete" und „Ich suche", darunter die eigenen
Aktivitäten und zuletzt die Eckdaten (Mitglied seit, Stufe, Standort).

Jeder Abschnitt SHALL eine benannte Quelle haben, damit keiner erfunden wird:

| Abschnitt | Quelle |
|---|---|
| Über mich | `profiles.short_bio` |
| Beruf | `profiles.company`, `branche`, `headline`, `competencies` |
| Hobbys | `profile_interests` |
| Ich biete / Ich suche | `offers` / `needs` (Kompass, C2) |
| Aktivitäten | die Beiträge des Mitglieds aus dem Feed |
| Eckdaten | `profiles.member_since`, `tier`, `region` |

Eine **zweite Kategorienliste** SHALL NOT eingeführt werden.

Ein Abschnitt ohne Inhalt SHALL entfallen, statt mit erfundenen Daten gefüllt zu
werden — dieselbe Regel, die die eigene Profilansicht bereits trägt.

Die Ansicht SHALL in hellem und dunklem Theme tragen. Fehlt das
Hintergrundbild, SHALL der bestehende Akzent-Verlauf einspringen; die Ansicht
SHALL NOT von einem gesetzten Bild abhängen.

#### Scenario: Ein Profil ohne Hintergrundbild bleibt vollständig

- **WHEN** ein Profil ohne `cover_url` angezeigt wird
- **THEN** erscheint der Akzent-Verlauf, und alle übrigen Abschnitte stehen unverändert

#### Scenario: Angebote und Gesuche stammen aus dem Kompass

- **WHEN** die Abschnitte „Ich biete" und „Ich suche" gefüllt werden
- **THEN** stammen die Einträge aus `offers` und `needs` und aus keiner zweiten Quelle

#### Scenario: Ein leerer Abschnitt verschwindet

- **WHEN** ein Mitglied keine Interessen gepflegt hat
- **THEN** fehlt der Abschnitt „Hobbys", statt einen Platzhalter zu zeigen

### Requirement: Ein Mitglied pflegt seine Kontaktzeile selbst

Das System SHALL einem bestätigten Mitglied erlauben, seine eigene Zeile in
`public.profile_contacts` über den Profil-Editor anzulegen und zu ändern —
Anschrift, Kontakt-E-Mail und Telefonnummer. Bis zu diesem Change schrieb dort
ausschließlich `admin_update_profile()`; ein Mitglied konnte seine eigene
Telefonnummer nicht ändern, obwohl Policy und Grant es längst erlaubten.

Der Schreibweg SHALL die bestehenden Policies `profile_contacts_insert_own` und
`profile_contacts_update_own` benutzen und SHALL NOT eine neue Policy, eine
`SECURITY DEFINER`-Funktion oder eine Grant-Änderung erfordern:
`profile_contacts` trägt einen **Tabellen**-Grant, keine Spaltenliste wie
`profiles`, weshalb neue Spalten für `authenticated` ohne weiteres Zutun
schreibbar sind.

Keines der Felder SHALL Pflicht sein. Ein Mitglied ohne Kontaktzeile SHALL beim
ersten Speichern eine bekommen (Upsert auf `profile_id`), ohne dass die
Oberfläche zwischen „anlegen" und „ändern" unterscheidet.

Das Formular SHALL **kein** Land erfinden. `country` bleibt leer, bis ein
Mitglied es einträgt; die Oberfläche SHALL „DE" höchstens als Platzhalter
zeigen. Eine Vorbelegung im Formular machte aus einer bewussten Leerung beim
nächsten Laden wieder „DE" und legte bei einer Speicherung, die mit der
Anschrift nichts zu tun hat, eine Kontaktzeile an, deren einziger Inhalt ein
erfundenes Land wäre. Die Vorgabe `DE` gehört dorthin, wo sie gebraucht wird:
in den Import (C10), der ein Feld füllt, das WordPress nicht erhebt.

Die Kontakt-E-Mail SHALL vor dem Speichern auf ihre Form geprüft werden. Sie ist
die Adresse, an die `notify-contact-request` schickt; ein Tippfehler dort ist
keine Anzeigefrage, sondern eine Benachrichtigung, die niemanden erreicht. Die
**Login**-Adresse in `auth.users` SHALL davon unberührt bleiben.

#### Scenario: Ein Mitglied trägt seine Anschrift ein

- **GIVEN** ein bestätigtes Mitglied ohne Zeile in `profile_contacts`
- **WHEN** es im Profil-Editor den Kontaktblock ausfüllt und speichert
- **THEN** entsteht die Zeile mit den eingetragenen Feldern, und ein erneutes
  Speichern ändert dieselbe Zeile, statt eine zweite anzulegen

#### Scenario: Der Kontaktblock deckt auch E-Mail und Telefon ab

- **WHEN** ein bestätigtes Mitglied im Profil-Editor Kontakt-E-Mail oder
  Telefonnummer ändert
- **THEN** wird der Wert in `profile_contacts` geschrieben, ohne dass ein Admin
  eingreifen muss

#### Scenario: Leere Felder bleiben leer

- **WHEN** ein Mitglied den Kontaktblock ganz oder teilweise leer speichert
- **THEN** wird der Vorgang angenommen und die betroffenen Spalten stehen auf
  NULL — kein Feld des Blocks ist Pflicht

#### Scenario: Das Formular erfindet kein Land

- **GIVEN** ein Profil ohne Anschrift
- **WHEN** das Mitglied den Profil-Editor öffnet und etwas speichert, das mit
  der Anschrift nichts zu tun hat
- **THEN** bleibt `country` leer — es entsteht keine Kontaktzeile, deren
  einziger Inhalt ein nicht eingetragenes Land wäre

#### Scenario: Eine unbrauchbare Kontakt-E-Mail wird abgewiesen

- **WHEN** ein Mitglied im Kontaktblock eine Zeichenkette speichert, die keine
  E-Mail-Adresse ist
- **THEN** meldet das Formular den Fehler und schreibt nichts — weder die
  Adresse noch die übrigen Felder des Vorgangs

### Requirement: Die Branche kommt aus einer kuratierten Liste

Das System SHALL eine feste, versionierte Liste von Branchenwerten führen und
das Profilfeld `branche` daraus befüllen lassen, statt es als Freitext zu
erheben. Vorbild sind die Kompass-Kategorien: eine deklarative Quelle, aus der
**der Editor und die Import-Zuordnung** lesen.

Der Filterweg im Verzeichnis SHALL davon unberührt bleiben und seine Optionen
weiter als **Facette aus den vorhandenen Werten** bilden. Die Liste steuert, was
neu eingetragen wird; sie beschreibt nicht, was in den Daten steht.

Grund ist der Import: In WordPress gibt es kein Branchenfeld, und der Filter im
Mitgliederverzeichnis zieht seine Optionen als Facette aus den vorhandenen
Werten. Ohne Zielvokabular würde die Facettenliste zum Spiegel des
Import-Rauschens — neunundsechzig Freitexte ergäben Dutzende „Branchen".

Das System SHALL dafür eine **reine Funktion** bereitstellen, die einen
Freitext auf höchstens einen Wert dieser Liste abbildet, per Stichwortzuordnung
und ohne Sprachmodell. Ein nicht zuzuordnender Text SHALL kein Ergebnis liefern
und SHALL NOT geraten werden.

Trifft ein Freitext Stichwörter **mehrerer** Branchen, SHALL die Funktion
ebenfalls kein Ergebnis liefern. Sonst entschiede die Reihenfolge der Liste,
welche Branche gewinnt — und die Reihenfolge ist Redaktion, keine Aussage über
den Text. Ein leeres Feld, das ein Mitglied selbst füllt, ist besser als eine
Zuordnung, die von der Sortierung einer Konfigurationsdatei abhängt. Die Zuordnung SHALL ungenau sein dürfen: jedes
Mitglied kann die Branche im Profil ändern, und ein grob gefüllter Filter ist
besser als ein leerer.

Die Spalte SHALL `text` bleiben und SHALL NOT durch eine Fremdschlüssel- oder
`check`-Beziehung an die Liste gebunden werden — Bestandswerte aus der Zeit vor
diesem Change bleiben so lesbar, und das Verzeichnis zeigt weiterhin, was in
den Daten steht.

#### Scenario: Der Editor bietet die Liste an

- **WHEN** ein Mitglied im Profil-Editor die Branche setzt
- **THEN** wählt es aus der kuratierten Liste, statt freien Text einzugeben

#### Scenario: Ein Freitext wird zugeordnet

- **WHEN** die Zuordnungsfunktion einen Freitext erhält, der ein Stichwort einer
  Branche enthält
- **THEN** liefert sie genau diesen Branchenwert aus der Liste

#### Scenario: Was nicht passt, bleibt leer

- **WHEN** die Zuordnungsfunktion einen Freitext ohne erkennbares Stichwort
  erhält
- **THEN** liefert sie kein Ergebnis, und das Feld bleibt leer

#### Scenario: Ein mehrdeutiger Freitext bleibt ebenfalls leer

- **WHEN** ein Freitext Stichwörter zweier verschiedener Branchen enthält
- **THEN** liefert die Funktion kein Ergebnis — sie entscheidet nicht nach der
  Reihenfolge der Liste

#### Scenario: Ein Bestandswert außerhalb der Liste bleibt erhalten

- **GIVEN** ein Profil, dessen `branche` vor diesem Change als Freitext gesetzt
  wurde und in der Liste nicht vorkommt
- **WHEN** das Verzeichnis seine Branchenfacette bildet
- **THEN** erscheint der Wert weiterhin — die Liste steuert die Eingabe, nicht
  den Bestand

