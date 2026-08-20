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
