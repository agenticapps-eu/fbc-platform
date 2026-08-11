## ADDED Requirements

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
Trefferzahl begrenzen. Es SHALL bestehen, weil es keine Mitgliederliste gibt
und die Profilseite für unbestätigte Profile nicht existiert — ohne Suche müsste
der Admin die Kennung aus der Datenbank holen, also genau das tun, was diese
Fähigkeit abschaffen soll.

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

## MODIFIED Requirements

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
