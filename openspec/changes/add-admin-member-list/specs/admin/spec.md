## MODIFIED Requirements

### Requirement: Admin member management is not implemented

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

## ADDED Requirements

### Requirement: Ein Admin listet Mitglieder über eine Funktion, die unbestätigte einschliesst

Das System SHALL eine `SECURITY DEFINER`-Funktion
`admin_list_members(p_query text, p_status text, p_limit int, p_offset int)` mit
`set search_path = ''` führen, die in ihrem Rumpf `is_admin()` prüft und
andernfalls mit `42501` abbricht.

Sie SHALL Profile **unabhängig von `activated_at`** zurückgeben. Das ist ihr
Zweck: `activated_at` ist der Schalter der Verzeichnis-Sichtbarkeit, und ein
importiertes Mitglied trägt dort `null` — über jeden anderen Lesepfad ist es
für niemanden sichtbar, auch nicht für Admins.

Sie SHALL je Zeile `bestaetigt` als `(activated_at is not null)` mitliefern,
damit die Fläche den Zustand anzeigen kann, ohne ihn zu erraten.

Sie SHALL `login_email` mitliefern und SHALL NOT Spalten aus `profile_contacts`
liefern. Die Anmeldeadresse identifiziert das Konto; die Kontaktdaten sind das,
was der Rest des Systems hinter Kontaktanfragen hält.

Sie SHALL blättern: `p_limit` und `p_offset` SHALL die Ergebnismenge begrenzen
und verschieben, und die Fläche SHALL sie benutzen.

Ihre übrigen Spalten SHALL denen von `search_directory` entsprechen, damit die
Verzeichnis-Ansicht die vorhandene Karte speist statt sie nachzubauen. Diese
Übereinstimmung SHALL geprüft werden — die Projektion besteht damit zweimal und
liefe sonst still auseinander.

Platzhalterzeichen des Mustervergleichs SHALL die Funktion entschärfen.

#### Scenario: Ein Nicht-Admin bekommt nichts

- **WHEN** ein Mitglied ohne Admin-Rolle `admin_list_members()` aufruft
- **THEN** bricht die Funktion mit `42501` ab — nicht mit einer leeren Liste,
  die wie ein leerer Verein aussähe

#### Scenario: Ein unbestätigtes Mitglied steht in der Liste

- **WHEN** ein Admin die Liste über einen Bestand aufruft, in dem ein Profil
  `activated_at is null` trägt
- **THEN** ist dieses Profil enthalten und trägt `bestaetigt = false`

#### Scenario: Kontaktdaten kommen nicht vor

- **WHEN** die Rückgabe der Funktion untersucht wird
- **THEN** enthält sie `login_email`, aber keine Spalte aus `profile_contacts` —
  weder Adresse noch Telefonnummer

#### Scenario: Die Seiten schneiden richtig

- **WHEN** ein Admit die Liste mit `p_limit = 2, p_offset = 2` über fünf Mitglieder aufruft
- **THEN** kommen genau die Mitglieder drei und vier zurück, in stabiler Reihenfolge

#### Scenario: Ein Suchbegriff aus Jokerzeichen findet nicht alles

- **WHEN** ein Admin `%` als Suchbegriff übergibt
- **THEN** wird es als Text gesucht, nicht als Muster — die Funktion liefert die
  Treffer zu diesem Zeichen und nicht die gesamte Mitgliedschaft

#### Scenario: Die Spalten laufen nicht auseinander

- **WHEN** die Spaltenliste von `admin_list_members` gegen die von
  `search_directory` gehalten wird
- **THEN** stimmen die Verzeichnisspalten überein, und eine Abweichung lässt die
  Prüfung fehlschlagen und benennt die abweichende Spalte

### Requirement: Ein Admin aktiviert ein Mitglied über eine eigene, gesicherte Funktion

Das System SHALL eine `SECURITY DEFINER`-Funktion
`admin_activate_member(target uuid)` mit `set search_path = ''` führen, die
`is_admin()` prüft und andernfalls mit `42501` abbricht.

Sie SHALL **neben** `mark_activated` bestehen, nicht an deren Stelle.
`mark_activated` SHALL unverändert bleiben: sie wird von `redeem-activation` mit
`service_role` gerufen und prüft `is_admin()` deshalb bewusst nicht. Ihr eine
Admin-Prüfung hinzuzufügen bräche den Einlöseweg.

#### Scenario: Ein Nicht-Admin kann nicht aktivieren

- **WHEN** ein Mitglied ohne Admin-Rolle `admin_activate_member()` für ein
  fremdes Profil aufruft
- **THEN** bricht die Funktion mit `42501` ab und `activated_at` bleibt unverändert

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

Die Fläche SHALL NOT einen Versand behaupten. `send-activation` antwortet zur
Abwehr von Adressaufzählung **immer** mit 202; der Statuscode belegt keinen
Versand. Die Rückmeldung SHALL deshalb die angeforderte Handlung benennen, nicht
ihr Ergebnis.

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

#### Scenario: Der Zustand ist in jeder Sicht sichtbar

- **WHEN** ein Admin zwischen Tabelle, Karten und Verzeichnis-Ansicht umschaltet
- **THEN** ist ein unbestätigtes Mitglied in jeder der drei als „nicht aktiviert"
  gekennzeichnet

#### Scenario: Die Verzeichnis-Ansicht führt nicht in die Sackgasse

- **WHEN** ein Admin in der Verzeichnis-Ansicht die Karte eines unbestätigten
  Mitglieds anklickt
- **THEN** landet er auf `/admin/mitglied/:id` und sieht das Profil — nicht auf
  `/p/:id` mit „nicht gefunden"
