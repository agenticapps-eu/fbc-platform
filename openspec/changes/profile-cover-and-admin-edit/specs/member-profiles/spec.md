## ADDED Requirements

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
`authenticated` halten. Gelesen und geschrieben SHALL sie nur durch
`service_role` (Import) und durch die Admin-Funktionen werden.

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

## MODIFIED Requirements

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
