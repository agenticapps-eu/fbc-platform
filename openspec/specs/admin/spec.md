# Admin

## Purpose

Defines the platform's staff/administration surface: the server-controlled staff
roles that grant elevated capability, the admin-only platform settings, the
matching-manager routing queue, and the admin feedback view. Reconstructed from
code as of the OpenSpec migration. Elevated capability is provisioned out of band
(never from the client) and is enforced in the database via `is_admin()` /
`is_matching_manager()`, with the frontend acting only as convenience gating.
## Requirements
### Requirement: Server-controlled staff roles

The system SHALL hold elevated roles in a dedicated `staff_roles` table
(`role in ('matching_manager', 'admin')`), provisioned out of band via
`service_role`/admin SQL. A member MAY read only their own `staff_roles` row and
SHALL have no client write grant, so the member-writable `profiles.roles` chips can
never be used as an authorization source.

#### Scenario: Member reads only their own staff row

- **WHEN** an authenticated member selects from `staff_roles`
- **THEN** RLS (`staff_roles_select_self`) returns only the row where
  `profile_id = auth.uid()`, and no other member's role

#### Scenario: Client cannot grant itself a staff role

- **WHEN** a member attempts to INSERT/UPDATE/DELETE on `staff_roles`
- **THEN** the write is denied — the table carries only a SELECT grant to
  `authenticated`, and staff is provisioned exclusively by `service_role`/admin SQL

### Requirement: Admin capability is gated by is_admin()

The system SHALL expose a `SECURITY DEFINER` predicate `is_admin()` that returns
true only when the caller holds the `admin` role in `staff_roles`, and every
admin-only server rule SHALL gate on this predicate rather than on client-supplied
identity. The `/admin` route gate (`RequireAdmin`) is UI convenience only; the
enforcing boundary is the database.

#### Scenario: Non-admin route access falls through to the DB boundary

- **WHEN** a member without the `admin` staff role navigates to `/admin`
- **THEN** `RequireAdmin` redirects them away, and even if the client were bypassed
  the RLS/`is_admin()` gates would still deny any admin-only write

#### Scenario: is_admin() is server-controlled

- **WHEN** `is_admin()` evaluates for a caller
- **THEN** it returns true only if `staff_roles` has an `admin` row for
  `auth.uid()`, independent of the caller's `profiles.roles`

### Requirement: Admin-only platform settings singleton

The system SHALL store platform-wide settings in a singleton table
`platform_settings` (`id boolean primary key check (id)`, enforcing exactly one
row). Any authenticated member MAY read it (it drives UI and policies), but only
`is_admin()` MAY update it, and `updated_at`/`updated_by` SHALL be set by the server
trigger, never by the client.

#### Scenario: Admin toggles a setting

- **WHEN** an admin updates `platform_settings.open_contact` via `/admin`
- **THEN** the `platform_settings_update_admin` policy permits the write and the
  server trigger stamps `updated_at`/`updated_by`

#### Scenario: Non-admin write changes nothing

- **WHEN** a non-admin member issues an UPDATE on `platform_settings`
- **THEN** the statement does not error but RLS (`using is_admin()`) matches zero
  rows, so the setting is unchanged

### Requirement: Matching managers triage the routing queue

The system SHALL route large-volume (`dkri`) contact requests into a `routing_queue`
table, populated only by the `SECURITY DEFINER` lifecycle trigger. Only a caller
satisfying `is_matching_manager()` MAY read the queue or update a case's `status`
and `assigned_to`; the enriched joined view SHALL be served by the
`list_routing_queue()` RPC, which returns nothing to non-managers.

#### Scenario: Manager sees and advances a case

- **WHEN** a matching manager opens the internal routing page and moves a case to
  `in_review` or assigns it to themselves
- **THEN** `routing_queue_select_staff`/`routing_queue_update_staff` permit the read
  and the `status`/`assigned_to` update (the only client-writable columns)

#### Scenario: Non-manager gets an empty queue

- **WHEN** a member without a `matching_manager`/`admin` staff role calls
  `list_routing_queue()`
- **THEN** the `is_matching_manager()` guard in the WHERE clause returns no rows

### Requirement: Admins review aggregated member feedback

The system SHALL provide a `SECURITY DEFINER` RPC `admin_list_feedback()` that
returns all feedback rows joined to the author's name, gated so it returns rows only
when `is_admin()`. The admin capability over feedback SHALL be read-only — the admin
reviews QM feedback but does not manage it (no admin delete of others' rows).

#### Scenario: Admin reads all feedback with author names

- **WHEN** an admin calls `admin_list_feedback()`
- **THEN** every feedback row is returned with `author_name` resolved past the
  `profiles` RLS (owner-rights join)

#### Scenario: Non-admin (incl. matching manager) gets nothing

- **WHEN** a matching manager or ordinary member calls `admin_list_feedback()`
- **THEN** the `where is_admin()` filter returns zero rows — QM is not the deal queue

### Requirement: Admin member management is not implemented

The system SHALL NOT provide, in the current prototype, an admin member-list view or
a mass-mail/broadcast capability (AGE-304 partial). Die gebaute Admin-Fläche
SHALL begrenzt sein auf: den Plattform-Einstellungs-Schalter, die
Routing-Queue der Matching-Manager, die lesende Feedback-Sicht, die **Suche nach
einem einzelnen Mitglied** über `admin_find_profile`, die Bearbeitung von dessen
Stamm-, Kontakt- und Altdaten über `admin_update_profile`, und die Änderung
seiner Login-Adresse.

Der Unterschied SHALL benannt bleiben: die Suche liefert Treffer zu einer
eingegebenen Kennung und SHALL NOT als Mitgliederliste dienen — kein Blättern,
kein Filtern, keine Gesamtansicht, und eine begrenzte Trefferzahl. Eine Liste,
aus der ein Admin Mitglieder heraussucht oder Empfänger auswählt, SHALL
weiterhin nicht bestehen; das ist AGE-304.

#### Scenario: No member-list or mass-mail surface exists

- **WHEN** an admin looks for a member-management list or a mass-mail action
- **THEN** none is present in the code — only `AdminSettingsPage` (settings toggle),
  the routing queue, `admin_list_feedback()`, und die Bearbeitung **eines**
  gesuchten Mitglieds sind verfügbar

### Requirement: Ein Admin bearbeitet fremde Profile über eine Funktion, nicht über eine Policy

Das System SHALL Admins erlauben, die Stammdaten eines anderen Mitglieds zu
ändern, und SHALL dafür eine `SECURITY DEFINER`-Funktion
`admin_update_profile(target uuid, patch jsonb)` mit `set search_path = ''`
führen, die in ihrem Rumpf `is_admin()` prüft und andernfalls mit einer Ausnahme
abbricht.

Eine zusätzliche RLS-Policy auf `public.profiles` SHALL NOT als Weg dafür
gelten. `public.profiles` trägt **spaltenweise** UPDATE-Grants zusätzlich zur
Policy, und Postgres prüft das Grant **vor** der Policy: ein Admin liefe trotz
passender Policy in `permission denied for table profiles`. Wirksam würde eine
Policy erst durch ein Aufmachen des Spalten-Grants — und das gälte dann für
**jedes** Mitglied, nicht nur für Admins.

Die Funktion SHALL drei Zeilen schreiben können: die Profilzeile, die
Kontaktzeile (`profile_contacts`) und die Altdatenzeile (`profile_legacy`).
Interessen, Ziele und Kompass-Kategorien SHALL sie NOT schreiben; die
Oberfläche SHALL diese Abschnitte im Admin-Modus ausblenden, statt einen
Schreibversuch scheitern zu lassen.

Die Weißliste SHALL fest in der Funktion stehen und `tier`, `potential_score`,
`profile_completion`, `search_doc`, `member_number` und `activated_at`
ausschließen — für diese gibt es eigene Wege, und ein Admin-Patch wäre ein
stiller Nebeneingang.

Sie SHALL außerdem die Profilspalten `goals` und `interests` ausschließen. Sie
sind zwar client-schreibbar, heißen aber wie die gleichnamigen Kind-Tabellen und
tragen etwas anderes; die Oberfläche schickt sie nie. Ein Feld offenzuhalten,
das kein Aufrufer benutzt, ist Fläche ohne Nutzen — und der erste Fehlgriff
schriebe die Formularform der Kind-Tabelle in die Profilspalte.

Ein Schlüssel außerhalb der Weißliste SHALL die Funktion abbrechen lassen und
SHALL NOT stillschweigend übergangen werden: ein ignoriertes Feld meldet dem
Admin Erfolg für etwas, das nicht geschehen ist. Ebenso SHALL ein `patch`
abbrechen, der kein JSON-Objekt ist.

Die Werte SHALL **feldweise** dekodiert werden: Textfelder als Text,
`roles` / `competencies` / `videos` als Textfelder-Array, `socials` als jsonb,
`paid_until` als Datum, `legacy_price` als Zahl, `is_public` als Wahrheitswert.
Ein fehlschlagender Cast SHALL die Funktion abbrechen lassen und SHALL NOT eine
Teilzeile schreiben — ein ungültiges Datum ist ein Fehler, kein NULL.

Ein **fehlender** Schlüssel SHALL das Feld unverändert lassen; ein Schlüssel mit
JSON-`null` SHALL es leeren. Diese beiden Fälle SHALL unterscheidbar sein.

Die Funktion SHALL für `authenticated` ausführbar sein, damit die Abwehr **in**
der Funktion stattfindet und prüfbar ist. `anon` und `public` SHALL kein
EXECUTE halten.

#### Scenario: Ein Admin ändert ein fremdes Profil

- **WHEN** ein Konto mit `admin`-Rolle in `staff_roles` `admin_update_profile`
  für ein fremdes Profil mit gültigen Feldern aufruft
- **THEN** wird die Profilzeile geschrieben, auch wenn das Zielkonto nicht
  bestätigt ist

#### Scenario: Ein normales Mitglied prallt an der RPC ab

- **WHEN** ein bestätigtes Mitglied ohne `admin`-Rolle `admin_update_profile`
  direkt aufruft — an der Oberfläche vorbei
- **THEN** bricht die Funktion mit einer Ausnahme ab und keine Zeile wird geändert

#### Scenario: Ein unbekanntes Feld bricht ab

- **WHEN** ein Admin einen `patch` mit einem Schlüssel außerhalb der Weißliste
  schickt — etwa `tier` oder `potential_score`
- **THEN** bricht die Funktion mit einer Ausnahme ab und schreibt auch die
  gültigen Felder desselben Aufrufs nicht

#### Scenario: Ein ungültiger Wert bricht ab

- **WHEN** ein Admin `paid_until` als nicht interpretierbaren Text schickt
- **THEN** bricht die Funktion ab und hinterlässt keine teilweise geschriebene Zeile

#### Scenario: Fehlend und leer sind zweierlei

- **WHEN** ein `patch` ein Feld nicht enthält und ein zweites als JSON-`null` enthält
- **THEN** bleibt das erste unverändert und das zweite wird geleert

#### Scenario: Die Client-Grant-Fläche bleibt unverändert bis auf `cover_url`

- **WHEN** die Spalten-Grants auf `public.profiles` nach dieser Änderung gelesen werden
- **THEN** ist gegenüber vorher genau `cover_url` hinzugekommen, und die
  Altdatenfelder liegen überhaupt nicht auf dieser Tabelle

### Requirement: Ein Admin erreicht auch ein unbestätigtes Profil

Das System SHALL Admins einen **Lesepfad** auf fremde Profile geben, der an der
RLS und am Aktivierungs-Gate vorbeiführt: `admin_get_profile(target uuid)` und
`admin_find_profile(needle text)`, beide `SECURITY DEFINER` mit `is_admin()` im
Rumpf.

Ohne diesen Pfad wäre die Bearbeitungsfähigkeit für ihren Anlassfall
**unerreichbar**. `profiles_select_self_or_discover` und `profiles_public`
verlangen beide, dass das **Zielprofil** bestätigt ist. Ein importiertes, noch
nicht bestätigtes Mitglied — genau das ausgesperrte — ist damit für niemanden
sichtbar: die Profilseite meldet „nicht gefunden", der Bearbeiten-Button
erscheint nie, und das Nachladen der Formulardaten liefert null Zeilen. Ein
Schreibweg ohne Lesepfad griffe nur an den Profilen, die ihn nicht brauchen.

`admin_find_profile` SHALL über die Login-Adresse und den Namen suchen und die
Trefferzahl begrenzen. Es SHALL bestehen, weil es keine Mitgliederliste gibt und
die Profilseite für unbestätigte Profile nicht existiert — ohne Suche müsste der
Admin die Kennung aus der Datenbank holen, also genau das tun, was diese
Fähigkeit abschaffen soll.

Platzhalterzeichen des Mustervergleichs SHALL die Funktion **entschärfen**.
Sonst kommt ein Suchbegriff aus lauter Jokerzeichen durch die Mindestlänge und
liefert die Trefferobergrenze quer durch die Mitgliedschaft — also genau die
Liste, die es nicht geben soll, nur mit einem anderen Namen.

Beide Funktionen SHALL dieselbe Feld-Weißliste bedienen wie der Schreibweg und
SHALL NOT zu einem allgemeinen Auskunftsweg über Mitglieder werden.

#### Scenario: Ein Admin öffnet ein unbestätigtes Profil

- **WHEN** ein Admin `admin_get_profile` für ein Profil aufruft, dessen
  Aktivierungszeitpunkt leer ist
- **THEN** erhält er dessen Stamm-, Kontakt- und Altdaten

#### Scenario: Ein normales Mitglied erhält nichts

- **WHEN** ein bestätigtes Mitglied ohne `admin`-Rolle `admin_get_profile` oder
  `admin_find_profile` aufruft
- **THEN** bricht die Funktion mit einer Ausnahme ab

#### Scenario: Ein Admin findet ein Mitglied über seine Login-Adresse

- **WHEN** ein Admin `admin_find_profile` mit einer E-Mail-Adresse aufruft
- **THEN** erhält er die zugehörige Profilkennung, auch wenn das Profil
  unbestätigt und damit sonst unsichtbar ist

#### Scenario: Ein Suchbegriff aus Jokerzeichen öffnet die Suche nicht

- **WHEN** ein Admin `admin_find_profile` mit einem Suchbegriff aufruft, der nur
  aus Platzhalterzeichen des Mustervergleichs besteht
- **THEN** erhält er keine Treffer — nicht die halbe Mitgliedschaft

### Requirement: Ein Admin ändert die Login-Adresse eines Mitglieds

Das System SHALL Admins erlauben, die Login-Adresse eines Mitglieds zu ändern.
Das ist der Fallback zum Bestätigungsweg: kommt ein Mitglied nicht mehr an das
Postfach, an das sein Aktivierungslink ging, ist es ohne diesen Weg **dauerhaft
ausgesperrt** — der Link erreicht es nicht, und einen zweiten Nachweis kennt das
System nicht.

Weil die Adresse in `auth.users` steht und vom Anmeldedienst verwaltet wird,
SHALL die Änderung über dessen Admin-Schnittstelle laufen und damit über eine
Edge Function mit `service_role`. Ein direktes `update auth.users` SHALL NOT
verwendet werden: dieselbe Adresse steht ein zweites Mal in
`auth.identities.identity_data`, und ein Schreibzugriff nur auf `auth.users`
hinterließe das Konto in einem Zustand, den der Anmeldedienst nicht kennt.

Die Funktion SHALL die Aufruferkennung aus dem vom Gateway geprüften JWT lesen
und SHALL NOT auf `getUser()` oder `getClaims()` bauen: unter den asymmetrischen
Signaturschlüsseln der Produktion scheitern beide in Edge Functions. Weil damit
die Grenze am **Gateway** hängt und nicht im Handler, SHALL sie gegen eine
bereitgestellte Umgebung geprüft werden; ein Unit-Test am Handler kann sie nicht
belegen.

Die Admin-Eigenschaft SHALL serverseitig gegen `staff_roles` geprüft werden;
eine im Aufruf mitgeschickte Kennung SHALL NOT genügen.

Die neue Adresse SHALL sofort gelten, ohne Bestätigungsmail — eine Bestätigung
ginge an das Postfach, an das das Mitglied gerade nicht herankommt, und
verfehlte damit den Zweck. Genau deshalb SHALL der Weg Admins vorbehalten sein.

Scheitert der Eintrag in die Spur, SHALL die Antwort das **eigens benennen**.
Als Erfolg gemeldet bräche sie die Zusage unbemerkt; als Gesamtfehler gemeldet
lüde sie zum Wiederholen einer Änderung ein, die bereits gilt.

Nach der Änderung SHALL das System die Sitzungen des Kontos beenden. Die Zusage
SHALL dabei **nicht überschrieben** werden: gelöscht werden Sitzung und
Refresh-Token, womit die Erneuerung entfällt. Ein bereits ausgegebener
Access-Token ist zustandslos und bleibt bis zu seinem Ablauf gültig (derzeit
3600 s). Die Zusage lautet daher „keine neue Anmeldung mit der alten Adresse",
nicht „sofort abgemeldet"; diese Restfläche SHALL benannt bleiben.

Die Reihenfolge SHALL Teil der Zusage sein: erst die Adresse, dann die
Sitzungen. Umgekehrt entstünde ein Fenster, in dem die Sitzungen beendet sind
und die alte Adresse noch gilt. Schlägt das Beenden **nach** erfolgreicher
Adressänderung fehl, SHALL die Antwort das unterscheidbar melden und SHALL NOT
als Gesamtfehler ausgegeben werden — sonst wiederholt der Admin eine Änderung,
die bereits gilt.

**Login-Adresse und Kontaktadresse SHALL getrennte Begriffe bleiben.** Die eine
steht in `auth.users`, die andere in `profile_contacts.email`, und letztere wird
von den Benachrichtigungen gelesen. Sie SHALL NOT automatisch gleichgesetzt
werden — ein Mitglied darf sich unter einer Adresse anmelden und unter einer
anderen erreichbar sein. Die Oberfläche SHALL beide nebeneinander zeigen, damit
ein Admin, der den Zugang repariert, nicht übersieht, dass die
Benachrichtigungen weiter an das unerreichbare Postfach gehen.

#### Scenario: Ein Admin setzt eine neue Login-Adresse

- **WHEN** ein Admin die Adresse eines Mitglieds über die Edge Function ändert
- **THEN** kann sich das Mitglied mit der neuen Adresse anmelden, die alte führt
  zu keiner neuen Anmeldung, und Sitzung und Refresh-Token des Kontos sind gelöscht

#### Scenario: Ein laufender Zugriffstoken bleibt bis zum Ablauf gültig

- **GIVEN** ein Access-Token, das vor der Änderung ausgegeben wurde
- **WHEN** es nach der Änderung verwendet wird
- **THEN** wird es bis zu seinem Ablauf akzeptiert — benannte Restfläche, kein Fehler

#### Scenario: Ein Nicht-Admin kommt an der Function nicht durch

- **WHEN** ein bestätigtes Mitglied ohne `admin`-Rolle die Edge Function mit
  gültigem eigenem Token aufruft
- **THEN** antwortet sie mit 403, und in `auth.users` ändert sich nichts — auch
  nicht die eigene Adresse

#### Scenario: Eine Änderung ohne Spur wird als solche gemeldet

- **GIVEN** eine erfolgreich geänderte Login-Adresse
- **WHEN** der Eintrag in die Spur fehlschlägt
- **THEN** meldet die Antwort das eigens — weder als schlichten Erfolg noch als
  Gesamtfehler, der zum Wiederholen einlüde

#### Scenario: Die Kontaktadresse folgt nicht von selbst

- **WHEN** ein Admin die Login-Adresse ändert, ohne die Kontaktadresse anzufassen
- **THEN** bleibt `profile_contacts.email` unverändert, und die Oberfläche zeigt
  beide Adressen, damit der Unterschied sichtbar ist

### Requirement: Privilegierte Änderungen hinterlassen eine Spur

Das System SHALL jede Änderung, die ein Admin an einem fremden Konto vornimmt,
in `public.admin_audit` festhalten: handelndes Konto, Art der Änderung,
Zielkonto, der übermittelte Patch und der Zeitpunkt.

Geschrieben SHALL ausschließlich aus den `SECURITY DEFINER`-Funktionen und der
Edge Function werden; `authenticated` SHALL kein INSERT halten, damit kein
Eintrag von außen erfunden werden kann. Gelesen SHALL nur werden, wer
`is_admin()` erfüllt.

Festgehalten SHALL der **Patch** werden, nicht die vollständige Zeile: was
geändert werden sollte, genügt zum Nachvollziehen, und ein Zeilenabbild
verdoppelte bei jedem Speichern das Profil in eine Tabelle, die niemand
aufräumt.

Die Spur SHALL mit der Fähigkeit zusammen entstehen und SHALL NOT nachgereicht
werden. Ohne sie ändert ein Admin Sichtbarkeit, Identität, bezahlte Laufzeiten
und Preise, ohne dass hinterher jemand sagen kann, wer es war.

#### Scenario: Eine Profiländerung wird festgehalten

- **WHEN** ein Admin ein fremdes Profil über `admin_update_profile` ändert
- **THEN** entsteht eine `admin_audit`-Zeile mit seinem Konto, dem Zielkonto und
  dem übermittelten Patch

#### Scenario: Eine Adressänderung wird festgehalten

- **WHEN** ein Admin die Login-Adresse eines Mitglieds ändert
- **THEN** entsteht eine `admin_audit`-Zeile, auch wenn das anschließende
  Beenden der Sitzungen fehlschlägt

#### Scenario: Niemand schreibt sich einen Eintrag selbst

- **WHEN** ein Mitglied — auch ein Admin — direkt in `admin_audit` einzufügen versucht
- **THEN** wird der Schreibzugriff abgelehnt

### Requirement: Ein Admin erreicht auch die Anschrift eines Mitglieds

Das System SHALL die fünf Adressfelder `street`, `postal_code`, `city`, `state`
und `country` in die Weißliste von `admin_update_profile(target, patch)`
aufnehmen und sie in denselben Upsert auf `public.profile_contacts` schreiben,
der heute `email` und `phone` trägt. Ohne das bräche der Admin-Weg an genau der
Stelle ab, an der er gebraucht wird: beim Nacharbeiten importierter Datensätze.

Der Lesepfad `admin_get_profile(target)` SHALL die Felder mitliefern; er gibt
die Kontaktzeile bereits als Ganzes zurück und braucht dafür keine Aufzählung.

Die Regeln der Funktion SHALL unverändert gelten: ein Schlüssel außerhalb der
Weißliste bricht ab, ein fehlender Schlüssel lässt das Feld unverändert, ein
Schlüssel mit JSON-`null` leert es, und jeder Aufruf hinterlässt eine Zeile in
`admin_audit`.

#### Scenario: Ein Admin trägt eine Anschrift nach

- **WHEN** ein Konto mit `admin`-Rolle `admin_update_profile` mit Adressfeldern
  im `patch` aufruft
- **THEN** wird die Kontaktzeile des Zielprofils geschrieben oder angelegt, auch
  wenn das Zielkonto noch nicht bestätigt ist

#### Scenario: Die Anschrift kommt im Admin-Lesepfad mit

- **WHEN** ein Admin `admin_get_profile` für ein Profil mit Anschrift aufruft
- **THEN** enthält der zurückgegebene Kontaktabschnitt die fünf Adressfelder

#### Scenario: Ein normales Mitglied kommt auch über die Adressfelder nicht durch

- **WHEN** ein bestätigtes Mitglied ohne `admin`-Rolle `admin_update_profile`
  mit Adressfeldern für ein fremdes Profil aufruft
- **THEN** bricht die Funktion mit einer Ausnahme ab und keine Zeile wird
  geändert

