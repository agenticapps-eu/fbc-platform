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
returns feedback rows joined to the author's name and the author's `profile_id`,
gated so it returns rows only when `is_admin()`, and paged through `p_limit` and
`p_offset`. The admin capability over feedback SHALL be read-only — the admin
reviews QM feedback but does not manage it (no admin delete of others' rows).

#### Scenario: Admin reads all feedback with author names

- **WHEN** an admin calls `admin_list_feedback()`
- **THEN** every feedback row on the requested page is returned with
  `author_name` resolved past the `profiles` RLS (owner-rights join)

#### Scenario: Non-admin (incl. matching manager) gets nothing

- **WHEN** a matching manager or ordinary member calls `admin_list_feedback()`
- **THEN** the `where is_admin()` filter returns zero rows — QM is not the deal queue

#### Scenario: The read stays read-only

- **WHEN** the admin capability over feedback is inspected
- **THEN** it offers no way for an admin to change or delete another member's
  feedback row

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
Login-Adresse, die **Mitgliederliste** über `admin_list_members`, und die
**Release-Notes-Fläche** (AGE-631).

Die Mitgliederliste SHALL NOT als Empfängerauswahl dienen. Sie listet, filtert
und blättert; eine Fläche, aus der ein Admin Empfänger für einen Massenversand
zusammenstellt, SHALL weiterhin nicht bestehen — das ist AGE-304.

Die Release-Notes-Fläche SHALL diese Zusage nicht aufweichen, und der Grund
SHALL benannt bleiben: sie kennt **keine Empfängerauswahl**. Der Kreis ist
festgelegt auf alle Mitglieder mit gesetztem `activated_at` und SHALL NOT
wählbar, filterbar oder eingrenzbar sein. Verboten war das Bilden und Bespielen
von Zielgruppen; eine einzelne, redigierte In-App-Mitteilung ohne Zielgruppe ist
davon nicht erfasst. Ein E-Mail-Weg SHALL für Release-Notes weiterhin nicht
bestehen.

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
  Mitglieds, die Mitgliederliste und die Release-Notes-Fläche sind verfügbar

#### Scenario: Die Liste ist keine Empfängerauswahl

- **WHEN** ein Admin die Mitgliederliste öffnet
- **THEN** bietet sie Filtern, Blättern und die Handlungen je **einzelnem**
  Mitglied — und keine Mehrfachauswahl, kein „an alle", keine Übernahme der
  Treffermenge in eine andere Fläche

#### Scenario: Die Release-Notes-Fläche wählt keine Empfänger

- **WHEN** ein Admin eine Release-Note zusammenstellt und zustellt
- **THEN** gibt es an keiner Stelle eine Auswahl, eine Filterung oder eine
  Eingrenzung der Empfänger — der Kreis ist alle aktivierten Mitglieder

#### Scenario: Release-Notes gehen nicht per E-Mail

- **WHEN** eine Release-Note zugestellt wird
- **THEN** entstehen ausschliesslich `notifications`-Zeilen, und kein
  E-Mail-Versand wird ausgelöst

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

Sie SHALL Profile **unabhängig von `activated_at`, `disabled_at` und
`deleted_at`** zurückgeben können. Das ist ihr Zweck: alle drei Felder schalten
Sichtbarkeit ab, und diese Funktion ist die einzige Fläche, auf der ein so
abgeschaltetes Mitglied noch vorkommt.

`p_status` SHALL genau fünf Werte kennen: `alle`, `aktiviert`, `offen`,
`deaktiviert`, `geloescht`. Ein **unbekannter** Wert SHALL mit `22023` abbrechen
und SHALL NOT stillschweigend wie `alle` wirken — ein vertippter Filter, der
alles zeigt, sieht aus wie ein leerer Filter.

**`alle`, `aktiviert` und `offen` SHALL Deaktivierte und Gelöschte
ausschliessen.** Sie beantworten Fragen über die Mitgliedschaft, und ein
entferntes Mitglied gehört nicht dazu. `deaktiviert` SHALL genau die mit
gesetztem `disabled_at` und ohne `deleted_at` liefern, `geloescht` genau die mit
gesetztem `deleted_at` — unabhängig davon, ob sie zusätzlich deaktiviert sind,
weil Löschen die Sperre mitbringt und beide Reiter sonst dieselben Zeilen
zeigten.

`p_query` SHALL über `login_email` und `name` suchen, ohne Rücksicht auf
Gross- und Kleinschreibung, und SHALL bei `null` oder leer nicht filtern. Eine
Mindestlänge SHALL NOT bestehen.

Sie SHALL je Zeile `bestaetigt` als `(activated_at is not null)` mitliefern,
damit die Fläche den Zustand anzeigen kann, ohne ihn zu erraten, und zusätzlich
`deaktiviert_seit` und `geloescht_seit` als die beiden Zeitstempel. **Zeitpunkte,
nicht Wahrheitswerte:** die Fläche soll sagen können, seit wann — und ein
Wahrheitswert liesse sich nicht nachträglich zu einem Zeitpunkt erweitern, ohne
jeden Aufrufer zu ändern.

Sie SHALL für den Reiter „Mitgliedschaft" zusätzlich `paid_until` und
`payment_type` mitliefern. Beide stehen in `profile_legacy` und SHALL über einen
`left join` kommen, damit ein Mitglied ohne Altdatenzeile nicht aus der Liste
fällt.

**Die Funktion SHALL abgeworfen und neu angelegt werden, nicht ersetzt.**
`create or replace function` kann den Rückgabetyp einer bestehenden Funktion
nicht ändern und bricht mit „cannot change return type of existing function" ab;
die neuen Spalten ändern ihn. Mit dem Abwurf SHALL die Migration Grants,
Kommentar und Parameter-Vorgabewerte **wiederherstellen** — ein `drop` nimmt sie
mit, und ein fehlender Vorgabewert bringt für einen argumentlosen Aufruf wieder
„function does not exist" statt der zugesicherten `42501`.

**Die Verbindung zu `auth.users` SHALL geprüft sein.** Sie ist heute ein
`join`, kein `left join`: ein Profil ohne Zeile in `auth.users` fiele lautlos
aus der Liste — auf genau der Fläche, die entstanden ist, weil Mitglieder
anderswo lautlos fehlten. Ob solche Zeilen bestehen können, SHALL an der
Datenbank geprüft und das Ergebnis festgehalten werden; die Verbindungsart
SHALL der Antwort folgen und nicht der Gewohnheit.

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
  bestätigten; mit `'alle'` und mit `null` alle — in allen drei Fällen ohne
  deaktivierte und ohne gelöschte

#### Scenario: Entfernte Mitglieder haben eigene Filter

- **WHEN** ein Admin `p_status = 'deaktiviert'` und danach `'geloescht'` über
  einen Bestand aufruft, der von beidem je eines enthält
- **THEN** liefert jeder Aufruf genau das zugehörige Mitglied, und ein Mitglied,
  das gelöscht **und** deaktiviert ist, erscheint unter `geloescht`

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

#### Scenario: Ein Mitglied ohne Altdatenzeile fällt nicht aus der Liste

- **WHEN** ein Admin die Liste über ein Mitglied ohne Zeile in `profile_legacy`
  aufruft
- **THEN** ist es enthalten und trägt `paid_until = null` und
  `payment_type = null`

#### Scenario: Kein Profil fällt still durch die Verbindung

- **WHEN** die Zahl der Zeilen in `profiles` gegen die Zahl der von
  `admin_list_members` gelieferten Zeilen ohne Filter gehalten wird
- **THEN** stimmen beide überein — und weichen sie ab, benennt die Prüfung die
  fehlenden Profile, statt eine kleinere Liste als vollständig auszugeben

#### Scenario: Die neu angelegte Funktion trägt ihre Vorgabewerte wieder

- **WHEN** nach der Migration ein Nicht-Admin `admin_list_members()` ohne
  Argumente aufruft
- **THEN** bricht sie mit `42501` ab — nicht mit „function does not exist", was
  ein beim Abwurf verlorener Vorgabewert verursacht hätte

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

### Requirement: Die Reiter der Mitgliederliste weisen ihre Anzahl aus

Each tab of the admin member list SHALL show how many members its state holds.
The counts SHALL come from a **separate** `SECURITY DEFINER` RPC and SHALL NOT be
obtained by extending `admin_list_members` — that function's signature and column
set are each guarded by an explicit assertion, and widening either turns a guard
into an obstacle rather than a protection.

The counting RPC SHALL apply the same state definitions the listing RPC applies
— **the same** definitions, shared, not a second copy of them, so that a tab's
number and the rows behind it cannot drift apart. A copy held together only by a
test can pass on a balanced fixture while a branch is wrong; a shared definition
has nothing to drift from.

The counts SHALL be global and SHALL NOT narrow with an active search term. It SHALL raise
for a non-admin caller rather than return zeroes: a zero is a statement about the
stock, and a caller with no right to the stock must not receive one.

Because "Alle" and "Mitgliedschaft" are two views over one and the same set, they
SHALL carry the same number. That is a property of the states, not a duplication.

#### Scenario: Each tab carries its number

- **WHEN** an admin opens the member list
- **THEN** each tab shows the count of members in its state next to its label

#### Scenario: The number matches the rows behind it

- **WHEN** a tab reports N members and the list is paged through entirely under
  that same tab **with no search term entered**
- **THEN** exactly N distinct members are seen

#### Scenario: A search narrows the list but not the number

- **WHEN** the admin enters a search term
- **THEN** the tabs keep reporting how many members exist in each state, while
  the list shows only the matches — the tab answers how many there are, not how
  many match

#### Scenario: Two views over one set carry one number

- **WHEN** the counts are read
- **THEN** the tab for all members and the tab for membership report the same
  number, because they filter the same set

#### Scenario: A non-admin gets no count

- **WHEN** an ordinary member or a matching manager calls the counting RPC
- **THEN** it raises, and does not return a row of zeroes

#### Scenario: The listing function keeps its signature and its columns

- **WHEN** the signature and the column set of `admin_list_members` are compared
  against the state before this change
- **THEN** both are unchanged — the shared definition changes how the function
  decides, never what it is called with or what it returns

#### Scenario: Both functions decide by the same definition

- **WHEN** a member is in a given state
- **THEN** the counting function and the listing function agree about it, because
  both ask the same shared definition rather than each carrying its own

### Requirement: Das Administrationsmenü trägt seine Flächen vollständig

Every admin route that is meant to be reached by navigating SHALL have an entry
in the administration menu. A route reachable only by typing its address is
undiscoverable, and a menu that omits one of its surfaces misleads about what the
administration can do.

Routes that exist only as the target of a link from another surface — those
carrying a parameter, such as a single member's page — SHALL NOT appear in the
menu, because there is no such thing as opening them without their parameter.

#### Scenario: The feedback surface is in the menu

- **WHEN** an admin views the administration menu
- **THEN** it lists the settings surface, the member list and the feedback
  surface

#### Scenario: A parameterised route stays out of the menu

- **WHEN** the administration menu is compared against the admin routes
- **THEN** the route for a single member is absent from the menu, and is reached
  from the member list instead

### Requirement: Ein Admin nimmt ein Mitglied aus dem Verkehr, ohne es zu löschen

Das System SHALL zwei `SECURITY DEFINER`-Funktionen mit `set search_path = ''`
führen, `admin_disable_member(target uuid, grund text default null)` und
`admin_enable_member(target uuid)`, die in ihrem Rumpf `is_admin()` prüfen und
andernfalls mit `42501` abbrechen.

`admin_disable_member` SHALL `profiles.disabled_at` auf `now()` setzen.
`admin_enable_member` SHALL es auf `null` zurücksetzen. Beide SHALL in
**derselben Transaktion** eine Zeile in `admin_audit` schreiben
(`disable_member` / `enable_member`); ein `exception`-Block um dieses INSERT
SHALL NOT bestehen, weil sonst eine Sichtbarkeitsänderung ohne Spur bestehen
könnte.

**Die Sperre SHALL zwei Sperren sein.** `disabled_at` allein hält eine bereits
bestehende Sitzung nicht auf, deren Zugriffe erst an den Policies scheitern —
und es hindert niemanden daran, sich anzumelden. Das System SHALL deshalb
zusätzlich `auth.users.banned_until` setzen, über eine Edge Function mit
`service_role`, weil `auth.users` GoTrue gehört und keiner API-Rolle zum
Schreiben offensteht.

**Die vier Funktionen SHALL NOT `authenticated` zum Aufruf offenstehen.** EXECUTE
SHALL bei `service_role` liegen, damit die Edge Function der **einzige** Eingang
ist. Läge es bei `authenticated`, könnte ein Admin die Datenbankfunktion
unmittelbar aufrufen und einen Zustand erzeugen, in dem `disabled_at` gesetzt ist
und der Ban fehlt — die zugesagte Doppelsperre wäre dann keine Zusage, sondern
eine Gewohnheit.

Das weicht bewusst vom Muster der übrigen `admin_*`-Funktionen ab, die bei
`authenticated` liegen, damit die Abwehr *in* der Funktion prüfbar stattfindet.
Der Unterschied ist, dass diese vier eine Wirkung **ausserhalb** der Datenbank
haben, die die Datenbank nicht selbst herstellen kann. Die `is_admin()`-Prüfung
im Rumpf SHALL dennoch bestehen bleiben: sie ist die zweite Schranke, nicht die
erste.

**Die Datenbank SHALL in BEIDEN Richtungen zuerst kommen**, der Ban danach.
Scheitert der erste Schritt, hat sich nichts geändert, und der Aufrufer bekommt
den übersetzten Fehlercode.

*Geändert am 2026-08-24.* Die erste Fassung schrieb für das Öffnen die
umgekehrte Reihenfolge vor, um zu vermeiden, dass ein Profil sichtbar wird,
während die Anmeldung noch gesperrt ist. Sie erzeugte dafür zwei Zustände, die
dieses Dokument an anderer Stelle ausdrücklich verbietet:

- **Lehnt die Datenbank ab, ist der Ban schon weg.** „Reaktivieren" auf ein
  gelöschtes Profil bricht mit `22023` ab — nach einem vorgezogenen Entbannen
  bleibt „ein gelöschtes Mitglied mit aufgehobener Sperre", also genau das, was
  die Übergangstabelle ausschliessen soll.
- **Die Antwort kommt zu spät.** `admin_restore_member` sagt in `entbannen`
  erst, OB entbannt werden soll; war das Mitglied vor dem Löschen deaktiviert,
  darf die Sperre nicht fallen. Wer vorher entbannt, kann die Antwort nicht mehr
  befolgen.

Der Preis ist der umgekehrte halbe Zustand — sichtbar, aber ausgesperrt. Er ist
über die Oberfläche erreichbar (deaktivieren, dann reaktivieren) und damit die
kleinere Hälfte des Schadens; dieselbe Abwägung wie beim Schliessen, nur
andersherum.

Beide Richtungen SHALL **wiederholbar** sein, solange der Zustand unvollständig
ist. Eine Handlung, die ihren eigenen halben Ausgang nicht heilen kann, ist keine
Handlung, sondern eine Falle.

**Der halbe Zustand SHALL benannt werden, nicht verschwiegen.** Gelingt der
Datenbankteil und scheitert der Ban-Schritt, SHALL die Edge Function mit
**`207`** antworten. Die Oberfläche SHALL daraufhin eine **Warnung** zeigen und
SHALL NOT diesen Ausgang als Erfolg darstellen.

**Verborgen und gesperrt SHALL zusammengehören, und der Statuscode SHALL genau
das ausdrücken:** `200` heisst, dass beide Hälften übereinstimmen, `207`, dass
sie es nicht tun. Welche fehlt, SHALL der Rumpf sagen — beim Schliessen
`{ hidden: true, banned: false }` (unsichtbar, aber anmeldefähig), beim Öffnen
`{ hidden: false, banned: true }` (sichtbar, aber ausgesperrt). Die beiden sind
**nicht** derselbe Zustand aus zwei Richtungen; ein Rumpf, der für beide
dasselbe meldet, sagt für eine der Richtungen das Gegenteil der Wahrheit.

Ein Wiederherstellen, das laut `entbannen` **nicht** entbannen soll, ist
`{ hidden: true, banned: true }` und damit ein **Erfolg**, kein halber Zustand:
das Mitglied ist zurück in der Mitgliedschaft und bleibt deaktiviert. Die
Oberfläche SHALL das als solches melden und SHALL NOT ein schlichtes
„wiederhergestellt" zeigen — sonst sucht jemand den Fehler, der keiner ist.

Die `admin_audit`-Zeile SHALL in diesem Fall dennoch entstehen — sie
protokolliert die Änderung an `disabled_at`, und die hat stattgefunden. Der
Teilfehlschlag SHALL im `payload` vermerkt sein, damit die Spur nicht mehr
behauptet, als geschehen ist.

Ein zweiter Aufruf auf ein bereits deaktiviertes Profil, **dessen Ban steht**,
SHALL mit `22023` abbrechen. `disabled_at` bliebe sonst unverändert, während
eine zweite Protokollzeile eine Änderung behauptet, die nicht stattfand.

Fehlt dagegen der Ban, SHALL derselbe Aufruf **nicht** abbrechen, sondern ihn
nachsetzen. Das ist keine Ausnahme von der Regel darüber, sondern ihre
Anwendung: der Zustand ist unvollständig, und ein Abbruch machte ihn durch die
Oberfläche unheilbar — der Admin müsste erst reaktivieren, um erneut
deaktivieren zu können, und liesse das Konto dabei kurz wieder sichtbar werden.

Ein Admin SHALL sich selbst nicht deaktivieren können; der Versuch SHALL mit
`22023` abbrechen. Ein Verein ohne erreichbaren Admin hat keinen Weg zurück.

#### Scenario: Ein Nicht-Admin kommt nicht durch

- **WHEN** ein Mitglied ohne Admin-Rolle `admin_disable_member()` aufruft
- **THEN** bricht die Funktion mit `42501` ab und `disabled_at` bleibt unverändert

#### Scenario: Deaktivieren macht unsichtbar

- **WHEN** ein Admin ein bestätigtes, öffentliches Mitglied deaktiviert
- **THEN** trägt dessen Profil `disabled_at`, und es erscheint danach weder über
  `profiles_select_self_or_discover`, noch in `profiles_public`, noch über
  `search_directory` — geprüft an allen dreien, nicht an einer

#### Scenario: Ein deaktiviertes Mitglied kommt nicht mehr herein

- **WHEN** ein deaktiviertes Mitglied sich mit seinem gültigen Passwort anmeldet
- **THEN** weist GoTrue die Anmeldung ab, weil `banned_until` in der Zukunft
  liegt — es entsteht gar keine Sitzung

#### Scenario: Das eigene Konto ist nicht deaktivierbar

- **WHEN** ein Admin sich selbst als `target` übergibt
- **THEN** bricht die Funktion mit `22023` ab

#### Scenario: Zweimal deaktivieren ist ein Fehler, keine zweite Protokollzeile

- **WHEN** ein Admin ein bereits deaktiviertes **und gebanntes** Profil erneut
  deaktiviert
- **THEN** bricht die Funktion mit `22023` ab und es entsteht keine zweite
  `admin_audit`-Zeile

#### Scenario: Der halbe Zustand wird als solcher gemeldet

- **GIVEN** ein Bestand, in dem der Auth-Dienst den Ban ablehnt
- **WHEN** ein Admin ein Mitglied deaktiviert
- **THEN** antwortet die Edge Function mit `207` und `banned: false`, das Profil
  trägt `disabled_at`, und die Oberfläche zeigt eine Warnung, die sagt, dass das
  Mitglied unsichtbar ist, sich aber weiterhin anmelden kann — kein Erfolgston

#### Scenario: Der halbe Zustand ist heilbar

- **GIVEN** ein Mitglied mit gesetztem `disabled_at`, dessen Ban fehlt
- **WHEN** ein Admin „deaktivieren" erneut auslöst
- **THEN** bricht die Funktion **nicht** mit `22023` ab, sondern setzt den Ban
  nach — ohne dass das Mitglied dazwischen wieder sichtbar wird

#### Scenario: Reaktivieren stellt beides wieder her

- **WHEN** ein Admin ein deaktiviertes Mitglied wieder freigibt
- **THEN** ist `disabled_at` null, `banned_until` ist aufgehoben, das Profil
  erscheint wieder im Verzeichnis, und in `admin_audit` steht `enable_member`

#### Scenario: Beim Öffnen geht der Ban zuerst

- **GIVEN** ein Bestand, in dem der Auth-Dienst die Entbannung ablehnt
- **WHEN** ein Admin ein deaktiviertes Mitglied freigibt
- **THEN** bleibt `disabled_at` gesetzt, das Profil bleibt unsichtbar, und die
  Handlung „reaktivieren" wird weiterhin angeboten — es entsteht **kein**
  Zustand, in dem das Profil sichtbar ist und die Anmeldung noch gesperrt

#### Scenario: Ein direkter Datenbankaufruf ist kein Weg vorbei

- **WHEN** ein Admin mit einer gewöhnlichen Sitzung `admin_disable_member`
  unmittelbar über die Datenbank-API aufruft
- **THEN** wird der Aufruf abgewiesen, weil EXECUTE nicht bei `authenticated`
  liegt — der Zustand „unsichtbar, aber nicht gesperrt" entsteht nicht aus
  Versehen

#### Scenario: Beide Richtungen hinterlassen eine Spur

- **WHEN** ein Admin ein Mitglied deaktiviert und danach wieder freigibt
- **THEN** stehen zwei Zeilen in `admin_audit`, jede mit dem handelnden Admin
  als `actor` und dem Mitglied als `target`

### Requirement: Ein Admin entfernt ein Mitglied, ohne seine Zeile zu löschen

Das System SHALL zwei `SECURITY DEFINER`-Funktionen mit `set search_path = ''`
führen, `admin_delete_member(target uuid, grund text default null)` und
`admin_restore_member(target uuid)`, die `is_admin()` prüfen und andernfalls mit
`42501` abbrechen.

`admin_delete_member` SHALL `profiles.deleted_at` setzen und **SHALL NOT** eine
Zeile aus `profiles` oder `auth.users` entfernen. Ein entferntes Mitglied SHALL
in keiner Fläche erscheinen ausser der Admin-Ansicht „Gelöscht", und von dort
SHALL es wiederherstellbar sein.

Löschen SHALL die Sperren des Deaktivierens **mitbringen**, nicht ersetzen: ein
gelöschtes Mitglied SHALL sich ebenfalls nicht anmelden können. Ein Admin, der
löscht, ohne vorher zu deaktivieren, SHALL kein Konto hinterlassen, das noch
hereinkommt.

**`admin_delete_member` SHALL `disabled_at` dabei NICHT verändern.** `deleted_at`
gatet selbstständig — sowohl die Sichtbarkeit als auch den Ban. Setzte das
Löschen zusätzlich `disabled_at`, ginge die Information verloren, ob das
Mitglied **vor** dem Löschen bereits deaktiviert war, und das Wiederherstellen
hätte keine richtige Antwort mehr: `deleted_at` allein zu leeren liesse einen
zuvor aktiven Menschen deaktiviert zurück, beide zu leeren gäbe einem zuvor
gesperrten seinen Zugang zurück. Ein Feld, das zwei Sachverhalte trägt, kann
keinen davon zurückgeben.

`admin_restore_member` SHALL entsprechend `deleted_at` leeren und den Ban **nur
dann** aufheben, wenn `disabled_at` null ist. War das Mitglied vor dem Löschen
deaktiviert, ist es danach wieder deaktiviert — und nichts sonst.

Ein Admin SHALL sich selbst nicht löschen können (`22023`).

**Was das Mitglied hinterlassen hat, SHALL stehen bleiben.** Beiträge,
Kommentare und Anmeldungen SHALL nicht mitgelöscht werden. Ein Beitrag, der aus
einem Gesprächsfaden verschwindet, in dem andere geantwortet haben, verändert
fremde Beiträge.

Der endgültige Entzug — Zeilen wirklich löschen, Auskunft nach DSGVO — SHALL
NOT Teil dieser Anforderung sein und bleibt `add-dsgvo-compliance`.

#### Scenario: Die Zeile bleibt bestehen

- **WHEN** ein Admin ein Mitglied löscht
- **THEN** existiert seine Zeile in `profiles` und in `auth.users` weiterhin und
  trägt `deleted_at`

#### Scenario: Gelöschte sind nirgends gelistet

- **WHEN** ein gelöschtes Mitglied über Verzeichnis, `profiles_public`,
  `search_directory` und die Teilnehmerliste einer Veranstaltung gesucht wird
- **THEN** erscheint es in keiner davon

#### Scenario: Löschen schliesst auch den Zugang

- **WHEN** ein Admin ein **aktives, nicht deaktiviertes** Mitglied löscht
- **THEN** kann dieses sich danach nicht mehr anmelden

#### Scenario: Wiederherstellen bringt es zurück

- **WHEN** ein Admin ein **aktives** Mitglied löscht und danach wiederherstellt
- **THEN** ist `deleted_at` null, `disabled_at` ist null, der Ban ist aufgehoben,
  das Mitglied erscheint wieder, und in `admin_audit` steht `restore_member`

#### Scenario: Wiederherstellen gibt keinen Zugang zurück, den es nicht gab

- **WHEN** ein Admin ein **bereits deaktiviertes** Mitglied löscht und danach
  wiederherstellt
- **THEN** ist `deleted_at` null, `disabled_at` steht **unverändert** auf seinem
  ursprünglichen Zeitpunkt, der Ban bleibt bestehen, und das Mitglied ist
  weiterhin unsichtbar — der Zustand vor dem Löschen, nicht ein besserer

#### Scenario: Beiträge überleben ihr Mitglied

- **WHEN** ein Mitglied gelöscht wird, das einen Beitrag mit Kommentaren anderer
  geschrieben hat
- **THEN** sind Beitrag und Kommentare weiterhin lesbar

### Requirement: Eine Rolle überlebt den Entzug des Zugangs nicht

Das System SHALL `is_admin()` und `is_matching_manager()` zusätzlich davon
abhängig machen, dass das aufrufende Konto **zugangsberechtigt** ist — aktiviert,
nicht deaktiviert, nicht gelöscht. Eine Zeile in `staff_roles` SHALL NOT allein
genügen.

**Warum das hierher gehört und nicht in einen Nachtrag:** ohne diese Bedingung
ist das Deaktivieren eines Admins wirkungslos gegenüber genau den Flächen, die
am meisten preisgeben. `is_admin()` liest heute ausschliesslich `staff_roles`;
die `SECURITY DEFINER`-Funktionen `admin_get_profile`, `admin_find_profile`,
`admin_update_profile`, `admin_list_members` und die Lesepolicy auf
`admin_audit` prüfen nichts darüber hinaus. Ein deaktivierter Admin mit noch
gültigem Token könnte damit weiterhin fremde Profile lesen und ändern, die
Mitgliedschaft aufzählen und das Protokoll mitlesen — während die gewöhnliche
RLS ihm bereits alles verweigert. Die Fähigkeit, jemanden auszuschliessen, wäre
für die am höchsten privilegierte Gruppe die einzige, die nicht wirkt.

Dass heute **jeder** Admin und jeder Matching-Manager in beiden Datenbanken
aktiviert ist, SHALL geprüft sein, bevor die Bedingung greift — die
Verschärfung sperrt sonst denjenigen aus, der sie zurücknehmen müsste.

Ein Admin SHALL sich weiterhin nicht selbst deaktivieren oder löschen können;
zusammen halten die beiden Regeln den Verein davon ab, ohne erreichbaren Admin
dazustehen.

#### Scenario: Ein deaktivierter Admin ist kein Admin mehr

- **GIVEN** ein Admin, der deaktiviert wurde, mit einem noch gültigen Token
- **WHEN** er `admin_list_members`, `admin_get_profile` oder
  `admin_update_profile` aufruft
- **THEN** bricht jeder dieser Aufrufe mit `42501` ab

#### Scenario: Auch das Protokoll bleibt ihm verschlossen

- **GIVEN** derselbe deaktivierte Admin
- **WHEN** er `admin_audit` liest
- **THEN** liefert die Abfrage null Zeilen

#### Scenario: Ein gelöschter Matching-Manager triagiert nicht mehr

- **GIVEN** ein Matching-Manager, dessen Konto gelöscht wurde
- **WHEN** er die Zuteilungsliste liest oder einen Eintrag ändern will
- **THEN** wird beides verweigert

#### Scenario: Die Verschärfung sperrt keinen bestehenden Admin aus

- **WHEN** vor dem Wirksamwerden geprüft wird, ob ein Admin oder
  Matching-Manager ohne `activated_at` besteht
- **THEN** gibt es keinen — die Prüfung ist Teil der Abnahme und nicht eine
  Annahme

### Requirement: Ein entferntes Mitglied wird zur Zahlungsart und zum Zeitpunkt geführt

Das System SHALL in `profile_legacy` eine Spalte `payment_type text` führen, die
auf genau acht Werte eingeschränkt ist: `rechnung`, `stripe`, `copecart`,
`paypal`, `digistore24`, `ehren`, `partner`, `offen`. Ein anderer Wert SHALL die
Einschränkung verletzen und abbrechen; `null` SHALL zulässig bleiben und
„nicht erfasst" bedeuten.

Die Einschränkung SHALL in der Datenbank stehen und SHALL NOT allein in der
Oberfläche bestehen. Eine Zahlungsart, die nur ein Auswahlfeld kennt, ist beim
nächsten Skript ein freier Text.

`admin_update_profile` SHALL `payment_type` in ihre Weissliste aufnehmen, damit
die Änderung denselben Weg und dieselbe Spur nimmt wie `paid_until`.

`paid_until` SHALL weiterhin in `profile_legacy` liegen und SHALL NOT nach
`profiles` wandern: dort kostete jede Spalte einen Grant, den Golden-Snapshot
und die Preisgabe ab Stufe `discover`.

#### Scenario: Eine unbekannte Zahlungsart wird abgewiesen

- **WHEN** `payment_type` auf `'bitcoin'` gesetzt wird
- **THEN** bricht die Datenbank ab — nicht die Oberfläche

#### Scenario: Nicht erfasst ist ein zulässiger Zustand

- **WHEN** ein Mitglied ohne belegte Zahlungsart gespeichert wird
- **THEN** bleibt `payment_type` null und die Fläche zeigt „nicht erfasst",
  nicht eine geratene Zahlungsart

#### Scenario: Die Änderung nimmt den Weg über die Spur

- **WHEN** ein Admin `payment_type` über `admin_update_profile` ändert
- **THEN** steht die Änderung in `admin_audit` im `payload`, wie `paid_until`
  auch

### Requirement: Jeder Übergang hat genau einen definierten Ausgang

Das System SHALL für jede der vier Lebenszyklus-Handlungen und jeden
Ausgangszustand festlegen, was geschieht. Ein Übergang ohne festgelegten Ausgang
ist keine Lücke in der Dokumentation, sondern eine im Verhalten: er endet
entweder in einer Protokollzeile über eine Änderung, die nicht stattfand, oder
in einem Fehler, den die Oberfläche nicht erwartet.

Zustand ist das Paar `(disabled_at, deleted_at)` zuzüglich der Frage, ob der Ban
gesetzt ist.

| Ausgangszustand | deaktivieren | reaktivieren | löschen | wiederherstellen |
|---|---|---|---|---|
| aktiv | setzt `disabled_at` + Ban | `22023` | setzt `deleted_at` + Ban | `22023` |
| deaktiviert, Ban gesetzt | `22023` | hebt beides auf | setzt `deleted_at`, lässt `disabled_at` | `22023` |
| deaktiviert, **Ban fehlt** | **setzt den Ban nach** | hebt beides auf | setzt `deleted_at` | `22023` |
| gelöscht | `22023` | `22023` | `22023` | leert `deleted_at`; entbannt nur, wenn `disabled_at` null |
| Ziel existiert nicht | `P0002` | `P0002` | `P0002` | `P0002` |
| Ziel ist der Aufrufer selbst | `22023` | — | `22023` | — |

Die Zeile „deaktiviert, Ban fehlt" ist der Grund für die Tabelle: sie ist der
einzige Fall, in dem dieselbe Handlung auf denselben sichtbaren Zustand nicht
abbricht, sondern nacharbeitet.

„Reaktivieren" auf ein gelöschtes Profil SHALL abbrechen und SHALL NOT
stillschweigend nur `disabled_at` leeren — das Ergebnis wäre ein gelöschtes
Mitglied mit aufgehobener Sperre, also genau der Zustand, den beide Handlungen
ausschliessen sollen.

**Jeder Übergang SHALL die Zeile sperren, die er liest** (`select … for update`
oder ein bedingtes `update … returning`). Zwei gleichzeitige Aufrufe SHALL NOT
zwei Protokollzeilen über eine Änderung erzeugen, die einmal stattfand.

Eine `admin_audit`-Zeile SHALL genau dann entstehen, wenn sich in derselben
Transaktion ein Feld **tatsächlich geändert** hat. Das Nachsetzen eines fehlenden
Bans SHALL keine zweite Zeile über eine Sichtbarkeitsänderung schreiben, sondern
den Nachtrag als solchen vermerken.

#### Scenario: Reaktivieren greift bei einem gelöschten Profil nicht

- **WHEN** ein Admin `admin_enable_member` auf ein gelöschtes Profil aufruft
- **THEN** bricht die Funktion mit `22023` ab und `deleted_at` bleibt gesetzt

#### Scenario: Wiederherstellen greift bei einem nicht gelöschten Profil nicht

- **WHEN** ein Admin `admin_restore_member` auf ein Profil ohne `deleted_at`
  aufruft
- **THEN** bricht die Funktion mit `22023` ab

#### Scenario: Ein nicht existierendes Ziel meldet sich als solches

- **WHEN** eine der vier Funktionen mit einer unbekannten `uuid` aufgerufen wird
- **THEN** bricht sie mit `P0002` ab — nicht mit einer stillen Nulländerung

#### Scenario: Zwei gleichzeitige Aufrufe schreiben eine Zeile, nicht zwei

- **WHEN** zwei Aufrufe von `admin_disable_member` auf dasselbe Ziel gleichzeitig
  laufen
- **THEN** gelingt genau einer, der andere bricht mit `22023` ab, und in
  `admin_audit` steht genau eine Zeile

### Requirement: Die Admin-Mitgliederfläche führt Handlungen in einem Menü je Zeile

Das System SHALL die Handlungen einer Zeile in einem Menü führen, das über eine
Schaltfläche am Zeilenende geöffnet wird, statt sie als einzelne Knöpfe
nebeneinanderzustellen.

Das Menü SHALL nur anbieten, was auf die jeweilige Zeile anwendbar ist:
„direkt aktivieren" SHALL NOT an bestätigten Zeilen erscheinen, „reaktivieren"
SHALL nur an deaktivierten. Einen Knopf anzubieten, dessen einziger Ausgang ein
Fehler ist, ist eine Einladung zum Fehlklick.

„deaktivieren" SHALL NOT an einer bereits deaktivierten Zeile erscheinen,
**deren Ban steht** — dort wäre `22023` der einzige Ausgang. **Fehlt der Ban,
SHALL es erscheinen**, denn dann ist der Aufruf kein Fehler, sondern der
Nachsetz-Weg aus der Anforderung weiter oben. Ohne diese Unterscheidung
widersprechen sich die beiden Zusagen: der halbe Zustand sieht in der Liste aus
wie jede andere deaktivierte Zeile, und die Handlung könnte ihren eigenen
halben Ausgang nicht heilen — nach der Formulierung dieses Dokuments also
„keine Handlung, sondern eine Falle".

Damit die Fläche das unterscheiden kann, SHALL die Mitgliederliste den
Ban-Zustand je Zeile mitliefern. Ein **abgelaufener** Ban SHALL NOT als Ban
zählen.

Für eine **gelöschte** Zeile besteht kein solcher Weg: die Übergangstabelle
bricht „löschen" dort in jedem Fall ab. Das Menü SHALL ihn folglich nicht
anbieten und SHALL NOT einen erfinden.

**Deaktivieren und Löschen SHALL je eine Rückfrage verlangen**, die das Mitglied
**namentlich** nennt und die Folge benennt. Beide sind umkehrbar, aber beide
nehmen einem Menschen den Zugang; eine optische Trennung allein SHALL NOT als
Schutz gelten.

Das Menü SHALL mit der Tastatur bedienbar sein und SHALL sich beim Verlassen
schliessen.

#### Scenario: Das Menü zeigt nur Anwendbares

- **WHEN** ein Admin das Menü einer bereits deaktivierten Zeile öffnet, deren
  Ban steht
- **THEN** steht dort „reaktivieren", aber nicht „deaktivieren"

#### Scenario: Der fehlende Ban macht die Handlung wieder sichtbar

- **GIVEN** eine deaktivierte Zeile, deren Ban fehlt — der halbe Zustand nach
  einem `207`
- **WHEN** ein Admin ihr Menü öffnet
- **THEN** steht dort „deaktivieren", und ein Aufruf setzt den Ban nach, statt
  mit `22023` abzubrechen

#### Scenario: Wiederherstellen weckt eine Deaktivierung nicht auf

- **GIVEN** ein Mitglied, das erst deaktiviert und danach gelöscht wurde
- **WHEN** ein Admin „wiederherstellen" auslöst
- **THEN** ist `deleted_at` geleert, `disabled_at` steht weiter, die Sperre
  bleibt bestehen — und die Oberfläche meldet „bleibt deaktiviert" statt eines
  schlichten „wiederhergestellt"

#### Scenario: Deaktivieren fragt namentlich nach

- **WHEN** ein Admin „deaktivieren" auslöst
- **THEN** erscheint eine Rückfrage, die das Mitglied beim Namen nennt und sagt,
  dass es sich danach nicht mehr anmelden kann

#### Scenario: Abbrechen ändert nichts

- **WHEN** ein Admin die Rückfrage zum Löschen abbricht
- **THEN** bleibt `deleted_at` unverändert und es entsteht keine
  `admin_audit`-Zeile

### Requirement: Die Admin-Mitgliederfläche trennt die Zustände in Reiter

Das System SHALL unter `/admin/mitglieder` fünf Reiter führen: **Alle**,
**Nicht aktiviert**, **Deaktiviert**, **Gelöscht** und **Mitgliedschaft**.

**Die Reiter sind NICHT die fünf `p_status`-Werte**, und die Abbildung SHALL
ausdrücklich festgeschrieben sein statt vermutet:

| Reiter | `p_status` | Darstellung |
|---|---|---|
| Alle | `alle` | Verwaltung |
| Nicht aktiviert | `offen` | Verwaltung |
| Deaktiviert | `deaktiviert` | Verwaltung |
| Gelöscht | `geloescht` | Verwaltung |
| Mitgliedschaft | `alle` | **Mitgliedschaft** |

„Mitgliedschaft" ist damit ein **Darstellungsmodus über derselben Menge wie
„Alle"**, kein eigener Filter. Der Wert `aktiviert` bleibt bestehen, hat aber
keinen Reiter: er ist über die Funktion erreichbar und wird von der Fläche
derzeit nicht benutzt. Das ist zu benennen und nicht zu verschweigen — ein
Parameterwert ohne Aufrufer sieht sonst wie ein vergessener aus.

**Deaktivierte und Gelöschte SHALL NOT unter „Alle" erscheinen.** „Alle" meint
die Mitgliedschaft, nicht den Datenbestand; ein entferntes Mitglied zwischen den
aktiven zu führen, macht jede Zählung auf dieser Fläche unbrauchbar. Für
„Mitgliedschaft" gilt dasselbe: wer nicht mehr dabei ist, hat keinen
Zahlungszeitraum, der noch etwas bedeutet.

Der Reiter „Mitgliedschaft" SHALL je Mitglied Stufe, `paid_until` und
`payment_type` zeigen. **Änderbar SHALL dabei nur `paid_until` und
`payment_type` sein; die Stufe SHALL hier nur lesbar sein.** Ein Stufenwechsel
berührt Rechte und Preise und hat einen eigenen Weg (AGE-516); ihn nebenbei in
einer Tabellenzeile zu erlauben, wäre die folgenreichste Änderung auf dieser
Fläche und zugleich die unauffälligste.

Ein Mitglied ohne `paid_until` SHALL ein LEERES Feld zeigen und SHALL NOT ein
geratenes Datum tragen. Das leere Feld ist die Auskunft; ein Wort daneben SHALL
NOT dieselbe Aussage ein zweites Mal machen.

*Geändert am 24.08. auf Donalds Befund an der laufenden Fläche.* Die erste
Fassung verlangte das Wort „unbekannt" neben dem Feld. Sie war für eine reine
Anzeige geschrieben; im Reiter steht dort aber ein Eingabefeld, und daneben ein
Auswahlfeld, das mit „nicht erfasst" bereits dasselbe sagt. Schlimmer als die
Dopplung war die Wirkung: das Wort erschien nur an den leeren Zeilen und schob
in jeder von ihnen die folgenden Felder um seine eigene Breite. Die eigentliche
Zusage — **es wird nichts vorbelegt** — hing nie an dem Wort.

Die drei bestehenden Sichten (Tabelle, Karten, Verzeichnis) SHALL erhalten
bleiben und SHALL innerhalb der Reiter umschaltbar sein.

Der gewählte Reiter SHALL in der Adresse stehen, damit ein Neuladen ihn nicht
verliert.

#### Scenario: Deaktivierte stehen nicht unter „Alle"

- **WHEN** ein Admin den Reiter „Alle" über einem Bestand öffnet, der ein
  deaktiviertes Mitglied enthält
- **THEN** erscheint dieses dort nicht, sondern nur unter „Deaktiviert"

#### Scenario: Ein Mitglied ohne bezahlt-bis wird nicht geraten

- **WHEN** der Reiter „Mitgliedschaft" ein Mitglied ohne `paid_until` zeigt
- **THEN** bleibt das Feld leer und trägt kein Datum — und kein Wort daneben
  wiederholt die Auskunft

#### Scenario: Der Reiter überlebt ein Neuladen

- **WHEN** ein Admin den Reiter „Gelöscht" wählt und die Seite neu lädt
- **THEN** steht er wieder auf „Gelöscht"

#### Scenario: Die Stufe lässt sich hier nicht ändern

- **WHEN** ein Admin im Reiter „Mitgliedschaft" die Stufe eines Mitglieds
  ansieht
- **THEN** wird sie angezeigt, aber nicht als Eingabefeld angeboten

#### Scenario: „Mitgliedschaft" zeigt dieselbe Menge wie „Alle"

- **WHEN** ein Admin zwischen „Alle" und „Mitgliedschaft" umschaltet
- **THEN** stehen dieselben Mitglieder in beiden — deaktivierte und gelöschte in
  keinem von beiden

### Requirement: Ein Admin stellt aus archivierten Changes eine redigierte Release-Note zusammen

Das System SHALL eine Admin-Fläche führen, auf der ein Admin die **noch nicht
angekündigten** archivierten Changes sieht, mehrere davon zu **einer** Nachricht
zusammenfasst, deren Text **vollständig überschreibt** und sie erst dann
zustellt.

Die Liste der Changes SHALL zur Bauzeit aus `openspec/changes/archive/`
entstehen und mit dem Bündel ausgeliefert werden, damit ein Eintrag per
Konstruktion nur dann erscheint, wenn er auch ausgeliefert wurde. Sie SHALL NOT
über einen schreibenden Weg aus der CI in die Datenbank gelangen.

Der Erzeuger SHALL auf den Verzeichnisnamen zurückfallen, wenn ein Proposal
keine Titelzeile trägt, und die Linear-Kennung als **optional** behandeln.
Gemessen am 27.08. fehlt bei 21 von 50 Archiven die Titelzeile und bei 19 die
Linear-Zeile; ein Erzeuger, der darauf besteht, erzeugte eine Fläche, die
niemand benutzen kann.

Der vorgeschlagene Text SHALL ein **Entwurf** sein. Das System SHALL NOT
Proposal-Text ungeprüft zustellen: er ist für Entwickler geschrieben und sagt
einem Mitglied nichts.

Ein Change SHALL nach der Zustellung nicht mehr in der Liste der noch nicht
angekündigten erscheinen.

#### Scenario: Nur was noch nicht angekündigt wurde

- **WHEN** ein Admin die Release-Notes-Fläche öffnet
- **THEN** listet sie die archivierten Changes, die von keiner zugestellten
  Release-Note abgedeckt sind, die jüngsten zuerst

#### Scenario: Mehrere Changes werden zu einer Nachricht

- **WHEN** ein Admin mehrere Einträge auswählt
- **THEN** entsteht **ein** Entwurf, der alle abdeckt — nicht einer je Eintrag

#### Scenario: Der Entwurf ist überschreibbar

- **WHEN** ein Admin den vorgeschlagenen Titel und Text ändert
- **THEN** wird der geänderte Text zugestellt, nicht der vorgeschlagene

#### Scenario: Ein Archiv ohne Titelzeile blockiert nichts

- **WHEN** ein archivierter Change keine `# Titel`-Zeile trägt
- **THEN** erscheint er trotzdem, benannt nach seinem Verzeichnis

#### Scenario: Angekündigtes verschwindet aus der Liste

- **WHEN** eine Release-Note zugestellt wurde
- **THEN** erscheinen die von ihr abgedeckten Changes nicht mehr als noch nicht
  angekündigt

### Requirement: Die Release-Notes-Fläche steht im Administrationsmenü

Das System SHALL die Release-Notes-Fläche im Administrationsmenü führen. Eine
Fläche, die nur über die getippte Adresse erreichbar ist, ist nicht auffindbar.

#### Scenario: Der Eintrag steht im Menü

- **WHEN** ein Admin das Administrationsmenü öffnet
- **THEN** enthält es einen Eintrag, der auf die Release-Notes-Fläche führt

### Requirement: Ein Admin setzt die Stufe eines Mitglieds in beide Richtungen

Das System SHALL eine `SECURITY DEFINER`-Funktion
`admin_set_tier(p_profile_id uuid, p_tier text, p_grund text)` mit
`set search_path = ''` führen, die in ihrem Rumpf `is_admin()` prüft und
andernfalls mit `42501` abbricht.

Sie SHALL die Stufe **anheben und senken** können. Das unterscheidet sie von
`apply_upgrade()`, die ausschliesslich anhebt und jede Gleich- oder
Tieferstufung als No-op behandelt — ein irrtümlich zu hoch importiertes
Mitglied ist über jenen Weg nicht korrigierbar.

Sie SHALL eine **Begründung verlangen** und bei leerer Begründung mit `22023`
abbrechen. Eine Spur ohne Grund beantwortet „wer" und „wann", aber nicht
„warum".

Jede erfolgreiche Änderung SHALL eine Zeile in `public.admin_audit` schreiben,
die die **alte und die neue** Stufe sowie die Begründung trägt. Nur die neue zu
speichern machte die Spur unlesbar, sobald zwei Änderungen aufeinanderfolgen.

Eine unbekannte Stufe SHALL mit `22023` abbrechen, ein unbekanntes Profil mit
`P0002`.

Die Fläche SHALL benennen, was ein späterer Stripe-Kauf mit der gesetzten Stufe
tut: ein Kauf einer **höheren** Stufe überschreibt sie, ein Kauf einer
niedrigeren nicht.

#### Scenario: Ein Nicht-Admin kommt nicht durch

- **WHEN** ein Mitglied ohne Admin-Rolle `admin_set_tier` aufruft
- **THEN** bricht der Aufruf mit `42501` ab, und die Stufe des Zielprofils ist
  unverändert

#### Scenario: Ein Admin senkt eine Stufe

- **WHEN** ein Admin ein Mitglied von `impact` auf `connect` setzt
- **THEN** trägt das Profil danach `connect` — anders als über `apply_upgrade`,
  die diesen Aufruf als No-op behandelte

#### Scenario: Die Spur nennt beide Stufen und den Grund

- **WHEN** ein Admin eine Stufe ändert
- **THEN** steht in `admin_audit` eine Zeile mit dem Aufrufer, dem Zielprofil,
  der alten Stufe, der neuen Stufe und der Begründung

#### Scenario: Ohne Begründung geschieht nichts

- **WHEN** ein Admin die Stufe ohne Begründung ändern will
- **THEN** bricht der Aufruf mit `22023` ab, und weder Stufe noch Spur ändern
  sich

#### Scenario: Eine unbekannte Stufe wird abgewiesen

- **WHEN** ein Admin eine Stufe setzt, die `membership_tiers` nicht kennt
- **THEN** bricht der Aufruf mit `22023` ab

### Requirement: Zugestelltes und als nicht relevant Markiertes steht in einem aufklappbaren Archiv

Das System SHALL jeden archivierten Change auf der Release-Notes-Fläche in genau
einem von zwei Zuständen führen: **offen** — er steht in der Auswahlliste — oder
**archiviert** — er steht im Archiv und SHALL NOT in der Auswahlliste
erscheinen.

Archiviert SHALL ein Change auf genau zwei Wegen werden:

- durch die **Zustellung** einer Release-Note, die ihn abdeckt. Dieser Weg SHALL
  endgültig sein: das System SHALL NOT einen zugestellten Change zurück in die
  Auswahlliste holen können, denn die Hinweise dazu stehen dann bereits in den
  Postfächern der Mitglieder.
- durch die Markierung **„nicht relevant"** durch einen Admin. Dieser Weg SHALL
  rücknehmbar sein.

Die Markierung „nicht relevant" SHALL für alle Admins gelten und SHALL NOT im
Browser des markierenden Admins verbleiben. Zwei Admins, die verschieden lange
Listen sehen, hätten keine gemeinsame Grundlage dafür, was noch anzukündigen
ist.

Nur ein aktivierter Admin SHALL Markierungen lesen, setzen und zurücknehmen
können, und die Grenze SHALL in der Datenbank liegen, nicht in der Fläche.

Trifft auf einen Change **beides** zu, SHALL das System „zugestellt" als Grund
nennen: ein verschickter Eintrag ist verschickt, unabhängig davon, was vorher
markiert wurde.

Ist ein Change von **mehreren** zugestellten Notes abgedeckt, SHALL das Archiv
die **früheste** nennen — den Zeitpunkt, an dem die Mitglieder es erfahren
haben. Die Auswahl SHALL NOT von der Reihenfolge der Abfrage abhängen.

Die Rechnung, was archiviert ist, SHALL **alle** zugestellten Notes umfassen und
SHALL NOT auf einer Seite davon beruhen. Eine Teilantwort ist von „nicht
angekündigt" nicht zu unterscheiden und holte Einträge stillschweigend zurück in
die Auswahlliste.

Solange die Markierungen nicht geladen sind oder ihre Abfrage gescheitert ist,
SHALL das System weder eine Auswahlliste noch einen Entwurf anbieten. Ein
Ausfall SHALL NOT als „nichts markiert" gelten — sonst stünden gerade die
abgeräumten Einträge wieder zur Wahl, die jüngeren davon vorangehakt.

Das Archiv SHALL zugeklappt beginnen, die Zahl seiner Einträge im Kopf tragen
und zu jedem Eintrag den Grund seiner Archivierung nennen.

Die Markierung „nicht relevant" SHALL den Eintrag zugleich aus der laufenden
Auswahl für den Entwurf nehmen. Ein Eintrag, der gerade als belanglos markiert
wurde, SHALL NOT angehakt in einer Mitteilung landen.

Das gilt auch, wenn bereits ein Entwurf **gespeichert** ist. Das System SHALL
NOT eine gespeicherte Note zustellen, die vom aktuellen Stand der Fläche
abweicht — weder in der Auswahl noch in Titel oder Text. Es SHALL stattdessen
erneutes Speichern verlangen. Andernfalls verschickte „speichern → markieren →
zustellen" genau den Eintrag, den der Admin gerade aussortiert hat.

Ein **Entwurf** SHALL weiterhin nichts archivieren. Nur eine zugestellte Note
zählt — sonst verschwände ein Change aus der Liste, sobald ihn jemand in einen
liegengebliebenen Entwurf gezogen hat.

#### Scenario: Nicht relevant räumt die Liste auf

- **WHEN** ein Admin einen offenen Eintrag als „nicht relevant" markiert
- **THEN** verschwindet er aus der Auswahlliste und steht im Archiv mit dem
  Grund „nicht relevant"

#### Scenario: Die Markierung nimmt den Eintrag aus der Auswahl

- **WHEN** ein Admin einen **vorangehakten** Eintrag als „nicht relevant"
  markiert und danach einen Entwurf erzeugt
- **THEN** deckt der Entwurf diesen Eintrag nicht ab

#### Scenario: Der Weg zurück steht offen

- **WHEN** ein Admin im Archiv einen als „nicht relevant" markierten Eintrag
  zurückholt
- **THEN** steht er wieder in der Auswahlliste

#### Scenario: Zugestelltes lässt sich nicht zurückholen

- **WHEN** ein Admin das Archiv öffnet und einen zugestellten Eintrag ansieht
- **THEN** nennt das Archiv Datum und Mitteilung, bietet aber keinen Weg zurück
  in die Auswahlliste

#### Scenario: Das Archiv beginnt zugeklappt und nennt seine Zahl

- **WHEN** ein Admin die Release-Notes-Fläche öffnet
- **THEN** ist das Archiv zugeklappt und trägt die Zahl der archivierten
  Einträge im Kopf

#### Scenario: Die Markierung gilt für alle Admins

- **WHEN** ein Admin einen Eintrag als „nicht relevant" markiert und ein
  **zweiter** Admin die Fläche öffnet
- **THEN** sieht auch dieser den Eintrag im Archiv und nicht in der Liste

#### Scenario: Ein Nicht-Admin kommt an die Markierungen nicht heran

- **WHEN** ein aktiviertes Mitglied ohne Adminrolle die Markierungen zu lesen,
  zu setzen oder zu löschen versucht
- **THEN** weist die Datenbank es ab

#### Scenario: Zugestellt schlägt nicht relevant

- **WHEN** ein Eintrag als „nicht relevant" markiert **und** von einer
  zugestellten Note abgedeckt ist
- **THEN** nennt das Archiv ihn als zugestellt

#### Scenario: Ein gespeicherter Entwurf lässt sich nach einer Markierung nicht unverändert zustellen

- **WHEN** ein Admin einen Entwurf speichert, danach einen darin enthaltenen
  Eintrag als „nicht relevant" markiert und zustellen will
- **THEN** ist das Zustellen gesperrt, bis er erneut gespeichert hat

#### Scenario: Fällt die Markierungsliste aus, bleibt die Fläche zu

- **WHEN** die Abfrage der Markierungen scheitert
- **THEN** zeigt die Fläche weder eine Auswahlliste noch einen Weg zum Entwurf,
  sondern sagt, dass sich gerade nicht bestimmen lässt, was offen ist

#### Scenario: Mehrfach zugestellt nennt die erste Zustellung

- **WHEN** zwei zugestellte Notes denselben Eintrag abdecken
- **THEN** nennt das Archiv die **frühere** von beiden

#### Scenario: Ein Entwurf archiviert nichts

- **WHEN** ein Eintrag nur in einem gespeicherten, aber nicht zugestellten
  Entwurf steht
- **THEN** bleibt er in der Auswahlliste und steht nicht im Archiv

