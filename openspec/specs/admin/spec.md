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

### Requirement: Die Admin-Fläche kennt eine Mitgliederliste, aber keinen Massenversand

The system SHALL NOT provide, in the current prototype, a mass-mail/broadcast
capability, an in-platform CRM, or topic newsletters (AGE-304). Die gebaute
Admin-Fläche SHALL begrenzt sein auf: den Plattform-Einstellungs-Schalter, die
Routing-Queue der Matching-Manager, die lesende Feedback-Sicht, die **Suche nach
einem einzelnen Mitglied** über `admin_find_profile`, die Bearbeitung von dessen
Stamm-, Kontakt- und Altdaten über `admin_update_profile`, die Änderung seiner
Login-Adresse, und die **Mitgliederliste** über `admin_list_members`.

Die Mitgliederliste SHALL NOT als Empfängerauswahl dienen. Sie listet, filtert
und blättert; eine Fläche, aus der ein Admin Empfänger für einen Massenversand
zusammenstellt, SHALL weiterhin nicht bestehen — das ist AGE-304.

Der Unterschied zwischen Suche und Liste SHALL benannt bleiben:
`admin_find_profile` beantwortet „wo ist diese Person?" und entschärft dafür
Jokerzeichen; `admin_list_members` beantwortet „wer ist da und wer wartet noch?"
und darf deshalb ohne Suchbegriff aufgerufen werden. Die
Jokerzeichen-Entschärfung SHALL in **beiden** bestehen — sie schützt vor kaputten
Mustern, nicht mehr vor dem Aufzählen.

#### Scenario: No mass-mail, CRM or newsletter surface exists

- **WHEN** an admin looks for a mass-mail action, a CRM surface or a newsletter editor
- **THEN** none is present in the code — only `AdminSettingsPage` (settings toggle),
  the routing queue, `admin_list_feedback()`, die Bearbeitung **eines** gesuchten
  Mitglieds und die Mitgliederliste sind verfügbar

#### Scenario: Die Liste ist keine Empfängerauswahl

- **WHEN** ein Admin die Mitgliederliste öffnet
- **THEN** bietet sie Filtern, Blättern und die Handlungen je **einzelnem**
  Mitglied — und keine Mehrfachauswahl, kein „an alle", keine Übernahme der
  Treffermenge in eine andere Fläche

### Requirement: Ein Admin listet Mitglieder über eine Funktion, die unbestätigte einschliesst

Das System SHALL eine `SECURITY DEFINER`-Funktion
`admin_list_members(p_query text default null, p_status text default null,
p_limit int default 50, p_offset int default 0)` mit `set search_path = ''`
führen, die in ihrem Rumpf `is_admin()` prüft und andernfalls mit `42501`
abbricht.

**Alle vier Parameter SHALL einen Vorgabewert tragen.** Ohne ihn meldet Postgres
für einen argumentlosen Aufruf „function does not exist" statt der Prüfung, die
diese Anforderung zusagt — der Aufrufer bekäme also einen anderen Fehler als den
zugesicherten.

Sie SHALL Profile **unabhängig von `activated_at`** zurückgeben. Das ist ihr
Zweck: `activated_at` ist der Schalter der Verzeichnis-Sichtbarkeit, und ein
importiertes Mitglied trägt dort `null` — über jeden anderen Lesepfad ist es
für niemanden sichtbar, auch nicht für Admins.

`p_status` SHALL genau drei Werte kennen: `alle`, `aktiviert`, `offen`. `alle`
und `null` SHALL nicht filtern; `aktiviert` SHALL auf `activated_at is not null`
einschränken, `offen` auf `activated_at is null`. Ein **unbekannter** Wert SHALL
mit `22023` abbrechen und SHALL NOT stillschweigend wie `alle` wirken — ein
vertippter Filter, der alles zeigt, sieht aus wie ein leerer Filter.

`p_query` SHALL über `login_email` und `name` suchen, ohne Rücksicht auf
Gross- und Kleinschreibung, und SHALL bei `null` oder leer nicht filtern. Eine
Mindestlänge SHALL NOT bestehen.

Sie SHALL je Zeile `bestaetigt` als `(activated_at is not null)` mitliefern,
damit die Fläche den Zustand anzeigen kann, ohne ihn zu erraten.

Sie SHALL `login_email` mitliefern und SHALL NOT Spalten aus `profile_contacts`
liefern. Die Anmeldeadresse identifiziert das Konto; die Kontaktdaten sind das,
was der Rest des Systems hinter Kontaktanfragen hält.

Sie SHALL blättern: `p_limit` und `p_offset` SHALL die Ergebnismenge begrenzen
und verschieben, und die Fläche SHALL sie benutzen.

Die Reihenfolge SHALL **unbestätigte zuerst**, dann nach `name`, dann nach `id`
sortieren. Der Stichentscheid über `id` ist nicht schmückend: nach `name` allein
ist die Reihenfolge bei Namensdubletten und bei `null` nicht bestimmt, und eine
unbestimmte Reihenfolge lässt Zeilen zwischen zwei Seitenaufrufen verschwinden
oder doppelt erscheinen.

Ihre übrigen Spalten SHALL denen von `search_directory` entsprechen, damit die
Verzeichnis-Ansicht die vorhandene Karte speist statt sie nachzubauen. Diese
Übereinstimmung SHALL geprüft werden — die Projektion besteht damit zweimal und
liefe sonst still auseinander. Geprüft SHALL **beides** werden: die Spaltenliste,
und für ein bestätigtes Mitglied der Zeileninhalt beider Funktionen.

Platzhalterzeichen des Mustervergleichs SHALL die Funktion entschärfen.

#### Scenario: Ein Nicht-Admin bekommt nichts

- **WHEN** ein Mitglied ohne Admin-Rolle `admin_list_members()` ohne Argumente aufruft
- **THEN** bricht die Funktion mit `42501` ab — nicht mit „function does not
  exist", und nicht mit einer leeren Liste, die wie ein leerer Verein aussähe

#### Scenario: Ein unbestätigtes Mitglied steht in der Liste

- **WHEN** ein Admin die Liste über einen Bestand aufruft, in dem ein Profil
  `activated_at is null` trägt
- **THEN** ist dieses Profil enthalten und trägt `bestaetigt = false`

#### Scenario: Der Status-Filter trennt die beiden Gruppen

- **WHEN** ein Admin `p_status = 'offen'` über einen Bestand aus bestätigten und
  unbestätigten Mitgliedern aufruft
- **THEN** kommen genau die unbestätigten zurück; mit `'aktiviert'` genau die
  bestätigten; mit `'alle'` und mit `null` alle

#### Scenario: Ein unbekannter Status ist ein Fehler, keine stille Vollansicht

- **WHEN** ein Admin `p_status = 'offfen'` übergibt
- **THEN** bricht die Funktion mit `22023` ab

#### Scenario: Die Suche findet über Name und Anmeldeadresse

- **WHEN** ein Admin einen Teil eines Namens übergibt, und getrennt davon einen
  Teil einer Anmeldeadresse
- **THEN** liefert jeder der beiden Aufrufe das zugehörige Mitglied, unabhängig
  von Gross- und Kleinschreibung

#### Scenario: Kontaktdaten kommen nicht vor

- **WHEN** die Spaltenliste der Funktion untersucht wird
- **THEN** enthält sie `login_email`, aber keine Spalte aus `profile_contacts` —
  weder Adresse noch Telefonnummer. Geprüft wird die **Spaltenliste**, nicht ein
  Beispieldatensatz: ein leeres Feld sähe sonst aus wie ein fehlendes

#### Scenario: Die Seiten schneiden richtig und wiederholbar

- **WHEN** ein Admin die Liste mit `p_limit = 2, p_offset = 2` über fünf
  Mitglieder aufruft, darunter zwei mit gleichem Namen und eines ohne Namen
- **THEN** kommen genau die Mitglieder drei und vier zurück, und ein zweiter
  Aufruf liefert dieselben zwei in derselben Reihenfolge

#### Scenario: Ein Suchbegriff aus Jokerzeichen findet nicht alles

- **WHEN** ein Admin `%` als Suchbegriff übergibt
- **THEN** wird es als Text gesucht, nicht als Muster — die Funktion liefert die
  Treffer zu diesem Zeichen und nicht die gesamte Mitgliedschaft

#### Scenario: Die Spalten laufen nicht auseinander

- **WHEN** die Spaltenliste von `admin_list_members` gegen die von
  `search_directory` gehalten wird
- **THEN** stimmen die Verzeichnisspalten überein, und eine Abweichung lässt die
  Prüfung fehlschlagen und benennt die abweichende Spalte

#### Scenario: Dieselbe Zeile in beiden Funktionen

- **WHEN** ein **bestätigtes** Mitglied über `admin_list_members` und über
  `search_directory` gelesen wird
- **THEN** stimmen die Werte der Verzeichnisspalten überein — die Prüfung fasst
  damit auch eine Abweichung, die die Spaltennamen unberührt lässt

### Requirement: Ein Admin aktiviert ein Mitglied über eine eigene, gesicherte Funktion — und hinterlässt dabei eine Spur

Das System SHALL eine `SECURITY DEFINER`-Funktion
`admin_activate_member(target uuid)` mit `set search_path = ''` führen, die
`is_admin()` prüft und andernfalls mit `42501` abbricht.

Sie SHALL in **derselben Transaktion** eine Zeile in `public.admin_audit`
schreiben: handelndes Konto, Art der Änderung, Zielkonto und Zeitpunkt. Das ist
keine Zutat, sondern die Erfüllung der bestehenden Anforderung „Privilegierte
Änderungen hinterlassen eine Spur", die für **jede** Admin-Änderung an einem
fremden Konto gilt und ausdrücklich verlangt, dass die Spur mit der Fähigkeit
zusammen entsteht. Gerade hier wiegt sie schwer: die Änderung macht die
Altdaten eines Menschen für andere sichtbar.

Sie SHALL mit `22023` abbrechen, wenn das Zielprofil bereits bestätigt ist. Ein
zweiter Aufruf ist entweder ein Irrtum oder ein Doppelklick; beides soll nicht
zu einem zweiten Protokolleintrag über eine Änderung führen, die nicht
stattfand.

Sie SHALL **neben** `mark_activated` bestehen, nicht an deren Stelle.
`mark_activated` SHALL unverändert bleiben: sie wird von `redeem-activation` mit
`service_role` gerufen und prüft `is_admin()` deshalb bewusst nicht. Ihr eine
Admin-Prüfung hinzuzufügen bräche den Einlöseweg.

#### Scenario: Ein Nicht-Admin kann nicht aktivieren

- **WHEN** ein Mitglied ohne Admin-Rolle `admin_activate_member()` für ein
  fremdes Profil aufruft
- **THEN** bricht die Funktion mit `42501` ab, `activated_at` bleibt unverändert,
  und es entsteht **keine** `admin_audit`-Zeile

#### Scenario: Die Aktivierung wird festgehalten

- **WHEN** ein Admin ein unbestätigtes Mitglied aktiviert
- **THEN** trägt das Profil `activated_at`, und es besteht eine
  `admin_audit`-Zeile mit seinem Konto, dem Zielkonto und der Art der Änderung

#### Scenario: Schlägt das Protokoll fehl, aktiviert niemand

- **WHEN** das Schreiben nach `admin_audit` fehlschlägt
- **THEN** ist auch `activated_at` nicht gesetzt — beides steht in einer
  Transaktion, damit keine Änderung ohne Spur bestehen kann

#### Scenario: Ein zweiter Aufruf ändert nichts

- **WHEN** ein Admin `admin_activate_member()` für ein bereits bestätigtes
  Mitglied aufruft
- **THEN** bricht die Funktion mit `22023` ab und es entsteht keine zweite
  `admin_audit`-Zeile

#### Scenario: Der Einlöseweg bleibt unangetastet

- **WHEN** `redeem-activation` mit `service_role` `mark_activated` ruft
- **THEN** gelingt das weiterhin ohne Admin-Rolle

### Requirement: Ein Admin stösst den Zugang eines Mitglieds an, statt sein Passwort zu setzen

Das System SHALL Admins erlauben, für ein fremdes Konto einen Zugangslink
anzufordern, und SHALL dafür die bestehende Kette `send-activation` →
`issue_activation_token` benutzen. Für ein bestätigtes Konto entsteht dabei
`issued_reset`, für ein unbestätigtes `issued`.

Das System SHALL NOT Admins erlauben, das Passwort eines anderen Mitglieds zu
setzen. Ein gesetztes Passwort erlaubte die Anmeldung als dieses Mitglied und
damit den Zugriff auf dessen Nachrichten, Kontaktanfragen und Kontaktdaten, ohne
dass das Mitglied davon erführe — die Ausnahme wäre grösser als die Regel, die
der Rest des Systems durchhält.

Die Fläche SHALL NOT einen Versand behaupten. `send-activation` antwortet auf dem
**angenommenen** Pfad zur Abwehr von Adressaufzählung mit 202, gleichgültig ob es
die Adresse gibt; dieser Statuscode belegt also keinen Versand. Er ist aber
**nicht** die einzige mögliche Antwort — der Handler liefert auch 405, 400, 500
und 502. Die Fläche SHALL deshalb bei 202 die angeforderte Handlung benennen und
SHALL bei jeder Nicht-2xx-Antwort einen Fehler zeigen statt einer Bestätigung.

#### Scenario: Der Zugangslink für ein bestätigtes Konto

- **WHEN** ein Admin für ein bestätigtes Mitglied „Zugangslink schicken" auslöst
- **THEN** läuft der Aufruf über `send-activation`, `issue_activation_token`
  liefert `issued_reset`, und `activated_at` des Mitglieds bleibt unverändert

#### Scenario: Kein Weg, ein fremdes Passwort zu setzen

- **WHEN** die Admin-Fläche und die Admin-Funktionen durchsucht werden
- **THEN** besteht keine Handlung, die ein Passwort für ein fremdes Konto setzt

#### Scenario: Die Rückmeldung behauptet keinen Versand

- **WHEN** der Aufruf mit 202 zurückkommt
- **THEN** meldet die Fläche, dass ein Zugangslink **angefordert** wurde, und
  SHALL NOT melden, dass eine Mail zugestellt oder verschickt wurde

#### Scenario: Ein Betriebsfehler sieht nicht wie Erfolg aus

- **WHEN** `send-activation` mit 500 oder 502 antwortet
- **THEN** zeigt die Fläche einen Fehler und SHALL NOT „Zugangslink angefordert"
  melden

### Requirement: Die Admin-Mitgliederfläche zeigt drei Sichten auf dieselben Zeilen

Das System SHALL unter `/admin/mitglieder` hinter der bestehenden Admin-Schranke
drei umschaltbare Sichten auf das Ergebnis von `admin_list_members` führen:
eine Tabelle, Admin-Karten, und eine Verzeichnis-Ansicht, welche die Karte des
Mitgliederverzeichnisses benutzt.

Alle drei SHALL den Aktivierungszustand anzeigen; ein unbestätigtes Mitglied
SHALL als solches erkennbar sein.

Die Verzeichnis-Ansicht SHALL auf `/admin/mitglied/:id` verweisen und SHALL NOT
auf `/p/:id`. Die öffentliche Profilseite liest `profiles_public` und verlangt
ein bestätigtes **Zielprofil**; für ein importiertes, unbestätigtes Mitglied —
den Anlassfall dieser Fläche — meldet sie „nicht gefunden".

Das Ziel des Verweises SHALL an der Karte einstellbar sein, und das
Mitgliederverzeichnis SHALL dabei weiterhin auf `/p/:id` verweisen. Die Karte ist
heute nicht wiederverwendbar — sie ist privat und verdrahtet ihr Ziel fest;
sie zu öffnen ist Teil dieser Fähigkeit, und die unveränderte Wirkung im
Verzeichnis ist zuzusichern, nicht anzunehmen.

**Direktes Aktivieren SHALL eine Rückfrage verlangen**, die das betroffene
Mitglied **namentlich** nennt und die Folge benennt: seine Angaben werden für
andere Mitglieder sichtbar. Die Handlung ist durch die Anwendung nicht
umkehrbar — `mark_activated` schreibt `coalesce(activated_at, now())` und ein
Rücksetzweg besteht nicht. Eine optische Trennung allein SHALL NOT als Schutz
gelten.

Die Handlung SHALL nur auf unbestätigten Zeilen angeboten werden.

#### Scenario: Der Zustand ist in jeder Sicht sichtbar

- **WHEN** ein Admin zwischen Tabelle, Karten und Verzeichnis-Ansicht umschaltet
- **THEN** ist ein unbestätigtes Mitglied in jeder der drei als „nicht aktiviert"
  gekennzeichnet

#### Scenario: Die Verzeichnis-Ansicht führt nicht in die Sackgasse

- **WHEN** ein Admin in der Verzeichnis-Ansicht die Karte eines unbestätigten
  Mitglieds anklickt
- **THEN** landet er auf `/admin/mitglied/:id` und sieht das Profil — nicht auf
  `/p/:id` mit „nicht gefunden"

#### Scenario: Das öffentliche Verzeichnis bleibt, wie es war

- **WHEN** ein Mitglied im Mitgliederverzeichnis eine Karte anklickt
- **THEN** landet es auf `/p/:id` wie zuvor

#### Scenario: Aktivieren fragt namentlich nach

- **WHEN** ein Admin „direkt aktivieren" auslöst
- **THEN** erscheint eine Rückfrage, die das Mitglied beim Namen nennt und sagt,
  dass dessen Angaben danach für andere sichtbar sind

#### Scenario: Abbrechen ändert nichts

- **WHEN** ein Admin die Rückfrage abbricht
- **THEN** bleibt `activated_at` unverändert und es entsteht keine
  `admin_audit`-Zeile

#### Scenario: Kein Aktivieren-Knopf an bestätigten Zeilen

- **WHEN** ein Admin eine Zeile eines bereits bestätigten Mitglieds ansieht
- **THEN** wird „direkt aktivieren" dort nicht angeboten

