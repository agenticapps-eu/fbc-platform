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
dahinter. Ein nicht aktiviertes Konto SHALL weder Bild-URL noch Bild-Pfad
erhalten; ein Abruf mit bereits bekannter URL SHALL als benannte, vorbestehende
Restfläche gelten und nicht als Zusage dieses Requirements. Dasselbe SHALL für
abgelöste Bilder gelten: ein ersetztes oder entkoppeltes Objekt bleibt abrufbar.

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

Sample figures SHALL NOT survive as a fallback branch that fires when the real
source is empty. A branch of that shape is indistinguishable from real data for
every member who has not yet produced any — which, after an import, is nearly
all of them.

#### Scenario: Absent capability renders nothing

- **WHEN** a member opens their own profile and the platform holds no statistics,
  projects or investments for them
- **THEN** no such section is rendered, with or without sample values

#### Scenario: Present capability renders an empty state

- **WHEN** a member holds no event registrations, a capability the platform does
  have
- **THEN** an empty state invites them to the events page rather than listing
  sample events

#### Scenario: Ein Mitglied ohne Beiträge sieht keine fremden Beiträge

- **WHEN** ein Mitglied ohne eigene Beiträge seine Profilseite öffnet
- **THEN** erscheint kein Beitrag mit Titel, Gattung oder Reichweitenzahl, den es
  nicht selbst verfasst hat — auch nicht als Demo gekennzeichnet

#### Scenario: Die Netzwerk-Aufschlüsselung nennt keine erfundenen Gruppen

- **WHEN** ein Mitglied mit bestätigten Kontakten seine Kontaktseite öffnet
- **THEN** erscheint keine Aufschlüsselung nach Gruppen mit fest verdrahteten
  Zahlen; sichtbar ist die Zahl der tatsächlich bestätigten Kontakte

#### Scenario: Ohne Kontakte erscheint weder Null noch Aufschlüsselung

- **WHEN** ein Mitglied ohne bestätigte Kontakte seine Kontaktseite öffnet
- **THEN** lädt die Seite zum Entdecken anderer Mitglieder ein und zeigt weder
  eine Aufschlüsselung noch die Zahl null

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

Die Ansicht SHALL **keinen Erfolgsradar** zeigen. Die Ordnung oben ist damit
nicht abschließend beschrieben: nach den Eckdaten steht der Video-Abschnitt.
Videos bleiben, wo sie sind. Die Anforderung „Vertagte
Fähigkeiten erscheinen nicht auf dem eigenen Profil" hat die Kompass-Oberflächen
bereits entfernt, aber nur auf der eigenen Seite; dieselbe Begründung gilt
unverändert für die fremde. Ein Betrachter, der eine Oberfläche sieht, die dem
Eigentümer selbst nicht mehr gezeigt wird, sieht eine Fläche, über die niemand
mehr Auskunft geben kann.

Der Wert dieser Anzeige trug die Begründung zusätzlich: die Themen-Scores
kommen aus `recompute_potential_score`, dessen Primärquelle die
Kompass-Antworten sind. `compass_responses` war bei der Entfernung leer (25.08.
2026: 0 Zeilen, 0 Profile), also griff immer der Ersatzzweig `least(getaggte_zeilen * 2, 10)`. „Erfolgsradar 8.0" heißt damit
„vier Zeilen tragen diesen Themen-Tag" — eine erfundene Zahl über das Mitglied,
genau die Sorte, die AGE-539 und AGE-494 bereits zweimal entfernt haben.

Das Ausblenden SHALL **nicht** an der Leere der Daten hängen, aus demselben
Grund wie dort: eine Umsetzung, die nur bei fehlenden Scores ausblendet, zeigte
die Fläche genau den wenigen Profilen, die welche haben (bei der Entfernung:
drei von 74).

Die Tabelle `profile_theme_scores` und die Berechnung SHALL erhalten bleiben.
Die Abfrage, die die Scores für diese Ansicht holt, SHALL dagegen **mit**
entfallen — sie hat nach der Entfernung keinen Leser mehr, und ein Rundlauf ohne
Leser ist kein „Erhalten", sondern Ballast. Das Zurückholen verlangt damit
Oberfläche **und** Abfrage; „eine Zeile" wäre eine falsche Zusage.

Der Hinweistext für Betrachter unterhalb der Schwelle SHALL den Erfolgsradar
NICHT unter dem nennen, was „ab der Discover-Stufe" sichtbar sei: eine Fähigkeit
zu bewerben, die es nicht mehr gibt, ist ein falsches Produktversprechen, und es
stünde ausgerechnet vor denen, die kaufen sollen.

Dass erweiterte Angaben ab `discover` sichtbar sind, SHALL weiterhin an einem
erweiterten Feld nachgewiesen werden. Bis zur Entfernung diente dafür der
Erfolgsradar; mit der Anzeige darf die Zusage über den **Zugriff** nicht
verschwinden.

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

#### Scenario: Videos bleiben stehen

- **WHEN** ein Profil mit Videos geöffnet wird
- **THEN** erscheint der Video-Abschnitt weiterhin, obwohl der Erfolgsradar
  davor entfallen ist

#### Scenario: Der Hinweis für die eingeschränkte Ansicht nennt den Radar nicht mehr

- **WHEN** ein Betrachter unterhalb der Schwelle den Hinweis auf die
  erweiterten Angaben sieht
- **THEN** ist der Erfolgsradar dort nicht als Leistung genannt

#### Scenario: Die fremde Profilansicht zeigt keinen Erfolgsradar

- **WHEN** ein Profil **mit** gesetzten Themen-Scores von einem anderen Mitglied
  geöffnet wird
- **THEN** erscheint kein Erfolgsradar

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

### Requirement: Vertagte Fähigkeiten erscheinen nicht auf dem eigenen Profil

Wird eine Fähigkeit für den Go-Live vertagt, SHALL ihre Oberfläche auf der
eigenen Profilseite entfallen — nicht leer stehen bleiben. Das gilt für die
Kompass-Oberflächen (Erfolgsradar, Ziele, Entwicklungsfortschritt), für
Auszeichnungen, solange keine vergeben werden, und für Zähler auf Fähigkeiten,
die unerreichbar sind.

Ein Zähler auf eine unerreichbare Fähigkeit SHALL entfallen, **unabhängig von
seinem Wert**. Der Wert kann echt und von null verschieden sein — ein Mitglied
kann Matches aus der Zeit vor der Vertagung tragen. Er verweist dann auf eine
Oberfläche, die niemand öffnen kann, und ist damit nicht falsch, sondern
unbeantwortbar.

Das Ausblenden SHALL **nicht** an der Leere der Daten hängen. Eine Umsetzung,
die nur bei leeren Daten ausblendet, erfüllt diese Anforderung nicht: sie zeigt
die vertagte Oberfläche genau denjenigen, die etwas darin haben.

Die zugehörigen Komponenten und Datenbankspalten SHALL erhalten bleiben. Das
Zurückholen einer vertagten Fähigkeit SHALL nichts weiter verlangen als das
Wiedereinsetzen der Oberfläche.

#### Scenario: Die Kompass-Oberflächen sind auf dem Profil nicht sichtbar

- **WHEN** ein bestätigtes Mitglied ohne Themen-Scores, Auszeichnungen, Ziele und
  Entwicklungsdaten seine eigene Profilseite öffnet
- **THEN** erscheinen weder Erfolgsradar noch Auszeichnungen, Ziele oder
  Entwicklungsfortschritt

#### Scenario: Auch mit Daten bleiben die vertagten Oberflächen fort

- **WHEN** ein Mitglied **mit** Themen-Scores, vergebenen Auszeichnungen,
  gepflegten Zielen und gesetztem Entwicklungsfokus seine Profilseite öffnet
- **THEN** erscheint keine dieser vier Oberflächen

#### Scenario: Kein Zähler für eine unerreichbare Fähigkeit

- **WHEN** die Kennzahlen im Profilkopf für ein Mitglied mit einem Matchstand
  über null gezeigt werden
- **THEN** steht dort keine Kachel für Matches, solange Matching unerreichbar ist

#### Scenario: Kein Weg in eine Oberfläche, die es nicht gibt

- **WHEN** die eigene Profilseite gerendert wird
- **THEN** führt von ihr keine Schaltfläche auf eine persönliche Roadmap

### Requirement: Ein leerer Bereich der eigenen Profilseite rendert nicht

Ein Bereich der eigenen Profilseite ohne Inhalt SHALL nicht gerendert werden,
statt eine Feststellung der Leere zu zeigen. Mehrere Kacheln nebeneinander, die
alle „Noch keine …" sagen, lassen ein frisches Profil tot wirken — und nach dem
Import sind fast alle Profile frisch.

**Die Ausnahme** greift, wenn **beide** Bedingungen erfüllt sind: die Fähigkeit
existiert und das Mitglied kann sie selbst füllen — **und** das Ziel der
Einladung steht nicht bereits an anderer Stelle derselben Seite. Fehlt die erste
Bedingung, verspricht der Leerzustand eine Funktion, die niemand gebaut hat;
fehlt die zweite, ist er eine Wiederholung, und mehrere Einladungen mit
demselben Ziel erzeugen genau die tote Seite, die diese Anforderung verhindert.

Eine Eckdatenzeile ohne Wert SHALL entfallen, statt einen Platzhalter zu zeigen.
Wo mehrere Eckdaten in einer Zeile stehen, SHALL jedes für sich entfallen: das
Fehlen des einen SHALL das andere nicht verdecken.

#### Scenario: Ein Mitglied ohne Beiträge wird zum Schreiben eingeladen

- **WHEN** ein Mitglied ohne eigene Beiträge seine Profilseite öffnet
- **THEN** fordert der Beitragsbereich es ausdrücklich zum Schreiben auf und
  führt auf die Aktivitätsseite

#### Scenario: Mit Beiträgen entfällt die Einladung

- **WHEN** ein Mitglied mit eigenen Beiträgen seine Profilseite öffnet
- **THEN** stehen dort seine Beiträge und keine Einladung zum Schreiben

#### Scenario: Ein leerer Interessenbereich entfällt

- **WHEN** ein Mitglied ohne gepflegte Interessen seine Profilseite öffnet
- **THEN** erscheint kein Interessenbereich — auch kein einladender: die
  Einladung in denselben Profil-Editor steht bereits weiter oben auf der Seite

#### Scenario: Ohne Beitrittsdatum entfällt die Zeile

- **WHEN** ein Profil ohne `member_since`, aber mit `member_number` angezeigt
  wird
- **THEN** erscheint keine Angabe „Mitglied seit", auch kein Gedankenstrich —
  die Mitgliedsnummer steht weiterhin

#### Scenario: Ohne Mitgliedsnummer steht das Beitrittsdatum allein

- **WHEN** ein Profil mit `member_since`, aber ohne `member_number` angezeigt
  wird
- **THEN** erscheint „Mitglied seit" mit Monat und Jahr, ohne Trennzeichen zu
  einer fehlenden Nummer

#### Scenario: Ohne beides entfällt die Zeile ganz

- **WHEN** ein Profil ohne `member_since` und ohne `member_number` angezeigt wird
- **THEN** erscheint keine Eckdatenzeile im Profilkopf

### Requirement: Bildspalten tragen Pfade, keine projektgebundenen URLs

Der Geltungsbereich SHALL auf **Supabase-verwaltete** Profilmedien begrenzt sein:
Objekte in den Buckets `avatars` und `covers`. Ein fremd gehostetes Bild — etwa
aus dem Demo-Seed — SHALL weiterhin als absolute URL zulässig sein; diese
Anforderung SHALL NOT als Verbot fremder Hosts gelesen werden.

Für Supabase-verwaltete Bilder SHALL `profiles.avatar_url` und
`profiles.cover_url` den **Pfad des Objekts innerhalb seines Buckets** tragen.
Die Projektkennung der Supabase-Instanz SHALL NOT in einem solchen Spaltenwert
vorkommen. **Sollzustand:** nach abgeschlossener Migration SHALL kein
Spaltenwert mehr auf ein Objekt der eigenen Instanz über eine absolute URL
zeigen.

Die anzeigende Fläche SHALL die URL beim Lesen aus Bucket und Pfad herstellen.
Beide Buckets sind öffentlich; die Herstellung SHALL deshalb ohne Signatur und
ohne Netzwerkrunde auskommen.

Der Auflöser SHALL als **absolut** behandeln, was ein URI-Schema trägt, und
SHALL NOT eine Liste einzelner erlaubter Schemata führen. Diese Unterscheidung
ist tragend: der lokale Entwicklungs-Stack liefert `http:`-URLs, die eine Liste
aus `https`, `blob` und `data` beschädigt hätte.

Das Durchreichen absoluter Werte SHALL als Aussage über die **Eingabe der
Anzeigefunktion** gelten, nicht als Erlaubnis für Spaltenwerte — beides SHALL
NOT vermengt werden. Es deckt drei Eingaben, von denen nur die erste je in einer
Spalte steht: einen Bestandswert vor der Migration oder aus einer älteren
ausgelieferten Fassung (Übergang), eine fremd gehostete URL (dauerhaft erlaubt)
und die `blob:`-URL der Bildvorschau im Editor, die überhaupt nie gespeichert
wird.

Eine Migration SHALL die Bestandszeilen auf Pfade zurückschneiden. Sie SHALL
einen Wert nur dann umschneiden, wenn das bezeichnete Objekt **in der eigenen
Instanz nachweislich existiert**; sie SHALL jeden anderen Wert unangetastet
lassen. Damit SHALL sie ohne hart geschriebene Projektkennung auskommen und
zugleich eine gleich aufgebaute URL einer **fremden** Supabase-Instanz nicht
erfassen.

Die Auslieferung SHALL den Leser **vor** dem Schreiber in Betrieb nehmen. Eine
Reihenfolge, in der Spaltenwerte zu Pfaden werden, bevor die ausgelieferte
Fläche sie auflösen kann, SHALL NOT gewählt werden.

#### Scenario: Ein neu hochgeladenes Bild hinterlässt keine Projektkennung

- **WHEN** ein Mitglied ein Profil- oder Hintergrundbild hochlädt
- **THEN** trägt die Spalte den Pfad innerhalb des Buckets, und die
  Projektkennung kommt darin nicht vor

#### Scenario: Ein Bestandswert mit absoluter URL wird weiterhin angezeigt

- **WHEN** eine Spalte noch eine absolute URL trägt
- **THEN** reicht der Auflöser sie unverändert durch, und das Bild erscheint

#### Scenario: Die Vorschau im Editor überlebt den Auflöser

- **WHEN** im Profil-Editor ein Bild ausgewählt, aber noch nicht gespeichert ist
  und die Vorschau als `blob:`-URL vorliegt
- **THEN** reicht der Auflöser sie unverändert durch, statt ihr einen Bucket-Host
  voranzustellen

#### Scenario: Die Migration lässt fremde Werte in Ruhe

- **WHEN** ein Spaltenwert eine Storage-URL trägt, deren Objekt in der eigenen
  Instanz nicht existiert — etwa aus einer fremden Supabase-Instanz mit
  gleichnamigem Bucket
- **THEN** bleibt er unverändert, statt zugeschnitten zu werden

#### Scenario: Ein fremd gehostetes Bild bleibt zulässig

- **WHEN** ein Spaltenwert auf einen fremden Host zeigt, der kein Supabase-Bucket
  dieser Instanz ist
- **THEN** verstößt er nicht gegen diese Anforderung, und der Auflöser reicht ihn
  unverändert durch

#### Scenario: Eine lokale Entwicklungs-URL überlebt den Auflöser

- **WHEN** ein Wert eine `http:`-URL des lokalen Stacks trägt
- **THEN** reicht der Auflöser sie unverändert durch, weil „absolut" am
  vorhandenen URI-Schema erkannt wird und nicht an einer Liste

#### Scenario: Der Leser geht vor dem Schreiber in Betrieb

- **WHEN** die Umstellung ausgeliefert wird
- **THEN** ist die auflösende Fläche nachweislich live, bevor ein Spaltenwert zu
  einem Pfad wird — sonst renderte eine ältere Fassung den Pfad relativ zum
  Anwendungs-Origin

#### Scenario: Die Migration ist wiederholbar

- **WHEN** die Migration ein zweites Mal über denselben Bestand läuft
- **THEN** ändert sie nichts mehr, weil ein Pfad ihrem Muster nicht entspricht

#### Scenario: Ein Wechsel der Projektkennung lässt die Bilder stehen

- **WHEN** derselbe Bestand unter einer anderen Projektkennung betrieben wird
- **THEN** zeigen die Bilder weiterhin auf vorhandene Objekte, weil kein
  Spaltenwert die alte Kennung trägt

### Requirement: „Ich biete" und „Ich suche" trennen Kategorie von Fließtext

Das System SHALL die Einträge aus `offers` und `needs` nach ihrer Bauart
darstellen, statt beide Sorten in dieselbe Zeilenform zu zwingen.

Unterschieden SHALL nach der Spalte **`source`** werden (`chip` oder `editor`),
nicht nach `category`. `source` benennt, welche Oberfläche die Zeile angelegt
hat, und ist damit die Aussage über die Bauart; `category` ist ein Feld, das der
Editor ebenfalls setzen darf. Heute fallen beide zusammen — gemessen über alle
112 Zeilen auf PROD: `chip` 19-mal, alle mit Kategorie, **keine** mit
Beschreibung; `editor` 93-mal, **keine** mit Kategorie, alle mit Beschreibung.
Diese Deckung ist ein **Momentzustand des Bestands, keine Invariante**: sobald
jemand im Editor eine Kategorie wählt, entsteht eine Zeile mit Kategorie *und*
Beschreibung, und eine Umsetzung, die auf `category` prüft, zeigte deren Text
nicht mehr an.

Wie beweglich dieser Zustand ist, hat sich beim Messen selbst gezeigt: zwischen
zwei Lesungen im Abstand von 23 Minuten wuchs der Bestand von 112 auf 117
Zeilen und die Marken von 19 auf 24. Keine Zahl in diesem Abschnitt ist eine
Zusage; sie tragen die Begründung, nicht die Regel.

**Jede Zeile mit bekannter Kategorie** SHALL eine Marke in einer gemeinsamen,
umlaufenden Reihe bekommen, mit dem lesbaren Namen der Kategorie. Der rohe
Schlüssel (`know_how`) SHALL NOT erscheinen — heute steht er als Marke neben
seinem eigenen Klartext, was jede Zeile doppelt.

Die Marke SHALL **nicht** an `source` hängen. Der reiche Editor unter
`/kompass` → „Suche & Biete" verlangt für jede Zeile eine Kategorie aus der
bekannten Liste, und `source` überlebt den Speicherlauf: sobald ein Mitglied
sein Such-/Bieteprofil dort einmal speichert, trägt **jede** seiner Zeilen eine
Kategorie, auch die mit `source = 'editor'`. Eine Markenreihe, die nur
`chip`-Zeilen betrachtet, verschwiege sie.

Ein `title` SHALL entfallen, wo er nur wiederholt, was ohnehin schon dasteht —
und zwar nach **zwei** Regeln, die dieselbe Begründung haben:

1. Er ist der **Klartext seiner eigenen Kategorie**. Über alle Profile trägt
   heute jede Kategorie genau einen einzigen Titel-Wert, und dieser ist exakt
   der Kategoriename; die Marke *ist* dann der Inhalt.
2. Er ist der **Anfang seiner Beschreibung** (Regel unten).

Er SHALL NOT allein deshalb entfallen, weil die Zeile `source = 'chip'` trägt.
Der Editor stellt für **jede** Zeile ein Pflichtfeld „Titel" — ein Mitglied kann
also den Chip „Kapital" wählen und ihn anschließend auf „Eigenkapital bis 500k"
ändern, ohne dass die Zeile aufhört, `chip` zu sein. Eine Umsetzung, die den
Titel an `source` festmacht, löschte diesen Satz von der Seite, während das
Formular ihn weiter anzeigt.

Trägt eine solche Zeile eine Beschreibung, SHALL diese unter der Markenreihe
erscheinen statt verloren zu gehen.

Für eine Kategorie ohne hinterlegten Klartext SHALL die Marke **entfallen**
statt den Schlüssel zu zeigen. Der vorhandene Helfer fällt auf eine
großgeschriebene Fassung des Schlüssels zurück (`future_key` → `Future_key`) und
hielte die Zusage „kein roher Schlüssel" damit nicht ein.

**Einträge aus dem Editor** (`source = 'editor'`) SHALL als Text erscheinen, mit
erhaltenen Zeilenumbrüchen. Ihr `title` SHALL entfallen, wenn er nur der Anfang
der Beschreibung ist. Der Vergleich SHALL **nach** dem Entfernen der
Aufzählungszeichen und nach dem Trimmen erfolgen, gegen die erste nichtleere
Zeile der Beschreibung, und SHALL einen vom Import gekürzten Titel als Treffer
werten. Er SHALL erscheinen, wo er eigenständig ist.

Wie der Import kürzt, ist **gemessen und nicht geraten** — die erste Fassung
dieser Anforderung hatte es falsch. Sie nahm an, bei 80 Zeichen werde mitten im
Wort gekappt, und verlangte deshalb einen unscharfen Vergleich bis zur letzten
Wortgrenze. Gemessen über alle 93 Editor-Zeilen auf PROD (25.08.,
`scripts/probe-age597-kompass-bestand.ts`) trifft das nicht zu: die drei Titel
mit exakt 80 Zeichen enden auf **U+2026** („…"), und die Beschreibung trägt an
genau dieser Stelle ein Leerzeichen — gekappt wird an der Wortgrenze, und das
Auslassungszeichen ist das Merkmal. Der Vergleich SHALL deshalb ein
abschließendes Auslassungszeichen abschneiden und danach wörtlich vergleichen.

Die unscharfe Wortgrenzen-Regel SHALL NOT verwendet werden. Sie fasst gemessen
**81** statt 61 Zeilen und verwürfe damit 20 Titel, die mit ihrer Beschreibung
nur die ersten Worte teilen — genau die Sorte, die diese Anforderung erhalten
will.

Was die scharfe Regel über den Bestand aussagt: **58** Titel sind wörtliche
Präfixe, **35** sind mit Auslassungszeichen gekürzte Präfixe, zusammen **alle
93**. Im heutigen Bestand überlebt kein einziger Editor-Titel — die Annahme des
Proposals, vier Zeilen trügen einen Titel ohne Bezug zur Beschreibung, ist
damit widerlegt. Das ist wieder ein **Momentzustand**: der Editor kann jederzeit
einen eigenständigen Titel anlegen, und die Regel erhält ihn dann.

Führende Aufzählungszeichen aus dem Altbestand — insbesondere die Folge
Apostroph-Bindestrich am Zeilenanfang, 13-mal vorhanden — SHALL beim Darstellen
entfernt werden. Die gespeicherten Werte SHALL NOT verändert werden: es sind
Inhalte der Mitglieder, und ein Schreibzugriff ohne deren Zutun wäre ein
Eingriff, den die Anzeige nicht rechtfertigt.

Die Darstellung SHALL über den **gesamten** Bestand tragen, nicht an einem
Beispiel geprüft werden. Die Ausreißer sind gemessen und benannt: eine
Beschreibung von 1048 Zeichen (vier über 500), 35 Titel mit Auslassungszeichen,
davon drei bei exakt 80 Zeichen, und **elf** Marken auf einem einzigen Profil —
die sich allerdings auf beide Abschnitte verteilen, sodass **eine Reihe**
höchstens **sechs** trägt. Über alle 97 gefüllten Abschnitte bleibt nach beiden
Regeln **kein** Abschnitt leer, und keiner trägt mehr als einen Textblock.

#### Scenario: Ein kategorisierter Eintrag wird zur Marke

- **WHEN** ein Eintrag eine `category` trägt
- **THEN** erscheint eine Marke mit dem lesbaren Kategorienamen
- **AND** weder der rohe Schlüssel noch der `title` erscheinen daneben

#### Scenario: Eine Marken-Zeile mit Beschreibung verliert sie nicht

- **WHEN** ein Eintrag mit `source = 'chip'` **und** einer Beschreibung
  dargestellt wird
- **THEN** erscheint die Marke, und die Beschreibung erscheint unter der
  Markenreihe

#### Scenario: Ein selbst geschriebener Titel auf einer Marken-Zeile bleibt

- **WHEN** eine Zeile mit `source = 'chip'` einen `title` trägt, der nicht der
  Klartext ihrer Kategorie ist
- **THEN** erscheint die Marke **und** der Titel

#### Scenario: Eine Editor-Zeile mit Kategorie bekommt ihre Marke

- **WHEN** eine Zeile mit `source = 'editor'` eine bekannte `category` trägt
- **THEN** erscheint deren Marke in der Reihe
- **AND** ihre Beschreibung erscheint unverändert darunter

#### Scenario: Eine unbekannte Kategorie zeigt keinen rohen Schlüssel

- **WHEN** ein Eintrag eine `category` trägt, für die kein Klartext hinterlegt
  ist
- **THEN** erscheint keine Marke — insbesondere nicht der großgeschriebene
  Schlüssel

#### Scenario: Mehrere Kategorien stehen in einer Reihe

- **WHEN** ein Abschnitt sechs kategorisierte Einträge trägt — der gemessene
  Höchstwert je Reihe; auf einem Profil sind es über beide Abschnitte elf
- **THEN** stehen sie als Marken in einer umlaufenden Reihe und nicht als sechs
  Kästen untereinander

#### Scenario: Ein Freitext-Eintrag zeigt seinen Text

- **WHEN** ein Eintrag keine `category` und eine mehrzeilige Beschreibung trägt
- **THEN** erscheint die Beschreibung mit ihren Zeilenumbrüchen

#### Scenario: Ein Titel, der die Beschreibung wiederholt, entfällt

- **WHEN** der `title` eines Freitext-Eintrags der Anfang seiner Beschreibung ist
- **THEN** erscheint er nicht zusätzlich über ihr

#### Scenario: Ein vom Import gekürzter Titel entfällt ebenfalls

- **WHEN** der `title` mit einem Auslassungszeichen endet und ohne dieses der
  Anfang der Beschreibung ist
- **THEN** erscheint er nicht zusätzlich über ihr

#### Scenario: Ein eigenständiger Titel bleibt

- **WHEN** der `title` kein Anfang der Beschreibung ist
- **THEN** erscheint er als Überschrift des Eintrags

#### Scenario: Import-Aufzählungszeichen verschwinden aus der Anzeige

- **WHEN** ein Titel oder eine Beschreibung mit Apostroph und Bindestrich beginnt
- **THEN** erscheint die Zeile ohne diese Zeichen
- **AND** der gespeicherte Wert bleibt unverändert

#### Scenario: Ein Abschnitt, von dem nichts übrig bleibt, verschwindet ganz

- **WHEN** die einzige Zeile eines Abschnitts eine unbekannte Kategorie und
  keine Beschreibung trägt, sodass weder Marke noch Text entstehen
- **THEN** fehlt die ganze Karte samt Überschrift, statt als Überschrift über
  nichts zu erscheinen

#### Scenario: Ein sehr langer Eintrag sprengt die Karte nicht

- **WHEN** eine Beschreibung 1048 Zeichen lang ist
- **THEN** bleibt sie innerhalb ihres Abschnitts lesbar umbrochen

### Requirement: Die Aktivitäten eines Profils sind begehbar

Each entry of a profile's activity list SHALL lead to that entry's post in the
feed. A list of posts that cannot be opened states that the member is active and
then refuses to show it — the entries look like links already, and behave like
none.

Each entry SHALL lead to **its own** post, not to the feed in general. A member
who clicks the third entry and lands at the top of the feed has been answered a
question they did not ask.

The promise SHALL hold on any profile, not only on one's own: a visitor reading a
member's profile is exactly the reader for whom the entries are interesting. What
the visitor may see is decided by the feed, not by this list.

#### Scenario: An entry opens its own post

- **WHEN** a member clicks an entry of a profile's activity list
- **THEN** the feed opens on that entry's post, not on the feed's first page

#### Scenario: The promise holds on a foreign profile

- **WHEN** a member opens another member's profile and clicks an activity entry
- **THEN** the same post is addressed as for the profile's owner

#### Scenario: Every entry is a link, not a clickable box

- **WHEN** an entry of the activity list is inspected
- **THEN** it is a link carrying its target address — so that it is focusable,
  triggerable by keyboard and openable in a new tab without any of that having
  to be rebuilt by hand

#### Scenario: Both profile surfaces carry the link

- **WHEN** the same member's posts are listed on the public profile and on the
  member's own profile
- **THEN** an entry on either surface leads to that entry's post

### Requirement: Ein Beitrag ohne Text wird benannt, nicht leer gezeigt

A post whose body is empty SHALL be shown with a description of what it is,
rather than as a blank line above a date. A post may legitimately carry no text —
the composer permits publishing an image with nothing written — and the list must
not render that as if something had been lost.

The description SHALL state only what the surface has actually established. It
SHALL NOT name what the post carries instead of text: nothing on this surface
reads the post's media, an empty body does not imply an image (the creating RPC
accepts neither text nor media, and a member may empty their own body
afterwards), and a description that named an image would assert something
unverified.

The promise SHALL hold on **every** surface that lists a member's posts. Two
surfaces show this list, and both render the body unguarded; fixing one leaves
the reader with a defect that appears only sometimes, which is worse to diagnose
than one that appears always.

#### Scenario: A textless post is described, not characterised

- **WHEN** a member's activity list contains a post with an empty body
- **THEN** the entry shows a description of the post instead of an empty line,
  and that description holds whether or not the post carries an image

#### Scenario: Both surfaces keep the promise

- **WHEN** the same textless post is shown on the public profile and on the
  member's own profile
- **THEN** both describe it, and neither renders a blank line

#### Scenario: A post with text is unaffected

- **WHEN** a post carries a body
- **THEN** the body is shown, and no description replaces it

