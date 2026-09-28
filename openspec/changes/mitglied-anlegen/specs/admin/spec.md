# admin — Delta für `mitglied-anlegen` (AGE-927)

## MODIFIED Requirements

### Requirement: Die Admin-Fläche kennt eine Mitgliederliste, aber keinen Massenversand

The system SHALL NOT provide, in the current prototype, a mass-mail/broadcast
capability, an in-platform CRM, or topic newsletters (AGE-304). Die gebaute
Admin-Fläche SHALL begrenzt sein auf: den Plattform-Einstellungs-Schalter, die
Routing-Queue der Matching-Manager, die lesende Feedback-Sicht, die **Suche nach
einem einzelnen Mitglied** über `admin_find_profile`, die Bearbeitung von dessen
Stamm-, Kontakt- und Altdaten über `admin_update_profile`, die Änderung seiner
Login-Adresse, die **Mitgliederliste** über `admin_list_members`, das **Anlegen
eines einzelnen Mitglieds** über `admin-create-member` (AGE-927), und die
**Release-Notes-Fläche** (AGE-631).

Die Mitgliederliste SHALL NOT als Empfängerauswahl für frei gestaltete
Mitteilungen dienen. Sie listet, filtert und blättert; eine Fläche, aus der ein
Admin Empfänger für einen Massenversand zusammenstellt, SHALL weiterhin nicht
bestehen — das ist AGE-304.

**Eine Mehrfachauswahl SHALL bestehen dürfen, und zwar ausschliesslich, um den
bestehenden Aktivierungslink auszulösen** (ADR-0007, AGE-927). Eng gefasst:

- Die Auswahl SHALL genau **eine** Wirkung haben — dieselbe Kette
  `send-activation` → `issue_activation_token`, die die Zeile heute einzeln
  auslöst.
- Es SHALL NOT freien Text, Betreff oder Textbaustein geben.
- Die gewählte Menge SHALL NOT in eine andere Fläche übernommen, exportiert oder
  weiterverwendet werden.
- Die Schutzriegel aus `issue_activation_token` SHALL unverändert gelten und
  SHALL NOT umgangen werden.

Der Grund für die enge Fassung SHALL benannt bleiben: der Empfängerkreis wird
dadurch nicht erweitert. Jedes dieser Mitglieder darf heute schon einzeln
eingeladen werden, von derselben Person, über denselben Weg, mit demselben Text
— die Auswahl spart Handgriffe, sie erschliesst nichts Neues. Verboten war das
**Bilden und Bespielen von Zielgruppen**, und das bleibt es.

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
  Mitglieds, die Mitgliederliste samt Anlegen und die Release-Notes-Fläche sind
  verfügbar

#### Scenario: Die Auswahl löst genau eine Handlung aus

- **WHEN** ein Admin in der Mitgliederliste mehrere Zeilen auswählt
- **THEN** ist die einzige angebotene Handlung „Ausgewählte einladen", und es
  gibt kein Feld für Betreff, Text oder Textbaustein und keinen Weg, die Menge
  zu exportieren oder in eine andere Fläche zu übernehmen

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

`p_status` SHALL genau sieben Werte kennen: `alle`, `aktiviert`, `offen`,
`angelegt`, `eingeladen`, `deaktiviert`, `geloescht`. Ein **unbekannter** Wert
SHALL mit `22023` abbrechen und SHALL NOT stillschweigend wie `alle` wirken — ein
vertippter Filter, der alles zeigt, sieht aus wie ein leerer Filter.

**`angelegt` und `eingeladen` SHALL `offen` in zwei Schritte teilen, ohne es zu
ersetzen.** `angelegt` sind die unbestätigten Profile, für die **nie** ein
Aktivierungstoken erzeugt wurde; `eingeladen` die, für die mindestens eines
erzeugt wurde. `offen` SHALL weiterhin die Vereinigung beider liefern. Der Wert
bleibt bestehen, weil er die Frage „wer wartet noch?" beantwortet, die von der
Frage „wer wartet worauf?" verschieden ist — und weil ihn Lesezeichen und
bestehende Aufrufer tragen.

**Der Einladungsstand SHALL aus `activation_tokens` abgeleitet werden, innerhalb
dieser Funktion.** Es SHALL NOT eine Policy oder ein Grant auf
`activation_tokens` entstehen: die Tabelle ist für `anon` und `authenticated`
absichtlich unerreichbar (AGE-495), und ihr Tabellenkommentar warnt ausdrücklich
davor, eine „fehlende" Policy nachzureichen. `SECURITY DEFINER` ist genau der
Weg, der dafür gebaut wurde.

**`alle`, `aktiviert`, `offen`, `angelegt` und `eingeladen` SHALL Deaktivierte
und Gelöschte ausschliessen.** Sie beantworten Fragen über die Mitgliedschaft,
und ein entferntes Mitglied gehört nicht dazu. `deaktiviert` SHALL genau die mit
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

Sie SHALL je Zeile `eingeladen_am` mitliefern: den **jüngsten** `created_at` aus
`activation_tokens` für dieses Profil, oder `null`, wenn nie eines erzeugt wurde.
Aus demselben Grund ein Zeitpunkt und kein Wahrheitswert — die Fläche soll „seit
sechs Tagen" sagen können, nicht nur „ja".

**Was `eingeladen_am` zusagt, SHALL eng gefasst bleiben:** ein Link wurde
**erzeugt**. Es SHALL NOT als Beleg gelesen oder beschriftet werden, dass eine
Mail zugestellt wurde — der Versand wird anderswo quittiert, und ein 202 belegt
nichts.

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
und für ein bestätigtes Mitglied der Zeileninhalt beider Funktionen. `bestaetigt`,
`eingeladen_am`, `deaktiviert_seit`, `geloescht_seit`, `login_email`,
`member_since`, `paid_until`, `payment_type` und `gebannt` gehören dabei
ausdrücklich **nicht** zu den Verzeichnisspalten.

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

#### Scenario: Angelegt und eingeladen teilen die Offenen auf

- **WHEN** ein Admin `p_status = 'angelegt'` und danach `'eingeladen'` über einen
  Bestand aufruft, in dem ein unbestätigtes Profil nie ein Token bekommen hat und
  ein zweites eines bekam
- **THEN** liefert `angelegt` genau das erste und `eingeladen` genau das zweite,
  beide zusammen genau das, was `offen` liefert

#### Scenario: Ein benutzter oder entwerteter Link zählt weiter als Einladung

- **WHEN** für ein unbestätigtes Profil ein Token besteht, dessen `expires_at`
  vergangen ist oder dessen `invalidated_at` gesetzt wurde
- **THEN** steht das Profil unter `eingeladen` und nicht unter `angelegt` — die
  Frage lautet „wurde je eingeladen?", nicht „liegt gerade ein gültiger Link?"

#### Scenario: `eingeladen_am` trägt den jüngsten Zeitpunkt

- **WHEN** für ein Profil zwei Token zu verschiedenen Zeiten erzeugt wurden
- **THEN** trägt `eingeladen_am` den späteren der beiden; für ein nie
  eingeladenes Profil trägt es `null`

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

- **WHEN** die Zahl der Zeilen in `profiles` **ohne deaktivierte und ohne
  gelöschte** gegen die Zahl der von `admin_list_members` ohne Filter
  gelieferten Zeilen gehalten wird
- **THEN** stimmen beide überein — und weichen sie ab, benennt die Prüfung die
  fehlenden Profile, statt eine kleinere Liste als vollständig auszugeben

  *Die Einschränkung ist am 28.09. nachgetragen und keine Abschwächung.* Ohne
  sie war das Szenario auf jedem Bestand unerfüllbar, der ein entferntes
  Mitglied enthält — `alle` schliesst beide Gruppen ausdrücklich aus, und kein
  `p_status` liefert sie zusammen. Gefunden im Plan-Review zu AGE-927.

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

#### Scenario: `activation_tokens` bleibt unerreichbar

- **WHEN** ein gewöhnliches Mitglied und ein anonymer Aufrufer versuchen,
  `activation_tokens` zu lesen
- **THEN** gelingt es keinem von beiden — die neue Spalte entsteht aus der
  `SECURITY DEFINER`-Funktion, nicht aus einer Policy oder einem Grant

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

**Die geteilte Zustandsbedingung SHALL den Einladungsstand als Argument
entgegennehmen** und SHALL ihn SHALL NOT selbst lesen. Sie bleibt damit
`immutable` und entscheidet weiterhin allein aus ihren Argumenten; beide
Aufrufer reichen den abgeleiteten Zeitpunkt herein. Eine Bedingung, die selbst
läse, wäre `stable` und müsste je Zeile als Blackbox aufgerufen werden.

The counts SHALL be global and SHALL NOT narrow with an active search term. It SHALL raise
for a non-admin caller rather than return zeroes: a zero is a statement about the
stock, and a caller with no right to the stock must not receive one.

Because "Alle" and "Mitgliedschaft" are two views over one and the same set, they
SHALL carry the same number. That is a property of the states, not a duplication.

**Die Zahlen der Aufnahmestrecke SHALL zusammenpassen:** die Anzahl zu `angelegt`
und die zu `eingeladen` SHALL zusammen die zu `offen` ergeben. Das ist keine
Dopplung, sondern die prüfbare Form der Zusage, dass die beiden Schritte `offen`
teilen und nicht ersetzen.

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

#### Scenario: Die beiden Aufnahmeschritte ergeben zusammen die Offenen

- **WHEN** die Zahlen gelesen werden
- **THEN** ist die Anzahl zu `angelegt` plus die zu `eingeladen` gleich der zu
  `offen`

#### Scenario: A non-admin gets no count

- **WHEN** an ordinary member or a matching manager calls the counting RPC
- **THEN** it raises, and does not return a row of zeroes

#### Scenario: Die Signatur ändert sich nur, wenn eine Anforderung es verlangt

- **WHEN** die Signatur und der Spaltensatz von `admin_list_members` gegen den
  Stand vor AGE-927 gehalten werden
- **THEN** ist genau eine Spalte hinzugekommen, `eingeladen_am`, und die
  Parameterliste ist unverändert — die Wächter, die beides festhalten, sind mit
  der Änderung mitgezogen worden und nicht abgeschaltet

#### Scenario: Both functions decide by the same definition

- **WHEN** a member is in a given state
- **THEN** the counting function and the listing function agree about it, because
  both ask the same shared definition rather than each carrying its own

### Requirement: Die Admin-Mitgliederfläche trennt die Zustände in Reiter

Das System SHALL unter `/admin/mitglieder` sieben Filter führen, in **zwei
Gruppen**, weil sie zwei verschiedene Fragen beantworten.

**Die Aufnahmestrecke** SHALL als Folge dargestellt sein und SHALL ihre
Reihenfolge zeigen: **① Angelegt → ② Eingeladen → ③ Bestätigt**. Sie beantwortet
„wo steht dieses Mitglied auf dem Weg herein?".

**Die übrigen Zustände** SHALL als Reiter bestehen bleiben: **Alle**,
**Deaktiviert**, **Gelöscht** und **Mitgliedschaft**. Sie beantworten „welcher
Ausschnitt des Bestands?".

Genau einer der sieben SHALL zugleich gewählt sein. Die Trennung in zwei Gruppen
ist eine Frage der Darstellung, nicht der Abfrage.

**Die Filter sind NICHT die sieben `p_status`-Werte**, und die Abbildung SHALL
ausdrücklich festgeschrieben sein statt vermutet:

| Filter | `p_status` | Darstellung |
|---|---|---|
| ① Angelegt | `angelegt` | Verwaltung |
| ② Eingeladen | `eingeladen` | Verwaltung |
| ③ Bestätigt | `aktiviert` | Verwaltung |
| Alle | `alle` | Verwaltung |
| Deaktiviert | `deaktiviert` | Verwaltung |
| Gelöscht | `geloescht` | Verwaltung |
| Mitgliedschaft | `alle` | **Mitgliedschaft** |

„Mitgliedschaft" ist damit ein **Darstellungsmodus über derselben Menge wie
„Alle"**, kein eigener Filter.

*Geändert für AGE-927.* Die frühere Fassung führte fünf Reiter, darunter „Nicht
aktiviert" auf `p_status = 'offen'`, und hielt fest, dass der Wert `aktiviert`
bestehe, aber keinen Reiter habe. Beides ist überholt: `offen` ist in ① und ②
geteilt, und `aktiviert` hat mit ③ seinen Reiter bekommen. Der Wert `offen`
bleibt in der Funktion bestehen — er hat jetzt keinen Filter mehr, und das ist
zu benennen und nicht zu verschweigen.

**Ein Lesezeichen auf `?tab=offen` SHALL auf ① Angelegt landen** und SHALL NOT
auf einen Fehler oder auf „Alle" fallen. Dort beginnt die Arbeit, die der alte
Reiter meinte; „Alle" wäre die stillste mögliche Antwort auf ein Lesezeichen,
das etwas Bestimmtes suchte.

Jeder Schritt der Aufnahmestrecke SHALL die **nächste Handlung** benennen: ①
„Einladung schicken", ② „Erinnern". ③ SHALL keine tragen — dort ist nichts mehr
zu tun.

**Deaktivierte und Gelöschte SHALL NOT unter „Alle" erscheinen.** „Alle" meint
die Mitgliedschaft, nicht den Datenbestand; ein entferntes Mitglied zwischen den
aktiven zu führen, macht jede Zählung auf dieser Fläche unbrauchbar. Für
„Mitgliedschaft" gilt dasselbe: wer nicht mehr dabei ist, hat keinen
Zahlungszeitraum, der noch etwas bedeutet. Dasselbe gilt für die drei Schritte
der Aufnahmestrecke.

Der Reiter „Mitgliedschaft" SHALL je Mitglied Stufe, `paid_until` und
`payment_type` zeigen. **Die Stufe SHALL in der Tabellenzeile nur lesbar sein**
und SHALL NOT dort als Eingabe- oder Auswahlfeld erscheinen; änderbar SHALL in
der Zeile nur `paid_until` und `payment_type` sein.

Das Verbot gilt der **beiläufigen** Änderung, nicht der Erreichbarkeit. Ein
Stufenwechsel berührt Rechte und Preise; ihn nebenbei in einer Tabellenzeile zu
erlauben, wäre die folgenreichste Änderung auf dieser Fläche und zugleich die
unauffälligste. Über das **Zeilenmenü** SHALL er dagegen erreichbar sein — dort
ist er weder beiläufig noch unauffällig: er verlangt einen eigenen Dialog, nennt
das Mitglied namentlich, verlangt eine Begründung und hinterlässt eine Spur.
Diese Anforderung SHALL NOT so gelesen werden, dass sie ihn von dieser Fläche
fernhält.

*Ergänzt für AGE-707.* Die frühere Fassung verwies für den Stufenwechsel auf
„einen eigenen Weg" und meinte damit die Einzelbearbeitung. Seit AGE-707 gibt es
zwei Wege, und die Unterscheidung, auf die es ankommt, ist nicht „welche Fläche",
sondern „beiläufig oder ausdrücklich".

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
bleiben und SHALL innerhalb der Filter umschaltbar sein.

Der gewählte Filter SHALL in der Adresse stehen, damit ein Neuladen ihn nicht
verliert.

#### Scenario: Deaktivierte stehen nicht unter „Alle"

- **WHEN** ein Admin den Reiter „Alle" über einem Bestand öffnet, der ein
  deaktiviertes Mitglied enthält
- **THEN** erscheint dieses dort nicht, sondern nur unter „Deaktiviert"

#### Scenario: Die Aufnahmestrecke zeigt ihre Reihenfolge

- **WHEN** ein Admin `/admin/mitglieder` öffnet
- **THEN** stehen ① Angelegt, ② Eingeladen und ③ Bestätigt als Folge in dieser
  Reihenfolge, jeder mit seiner Anzahl, und ① und ② benennen ihre nächste
  Handlung

#### Scenario: Ein Lesezeichen auf den alten Reiter landet in Schritt ①

- **WHEN** ein Admin `/admin/mitglieder?tab=offen` öffnet
- **THEN** steht die Fläche auf ① Angelegt — nicht auf „Alle" und nicht auf einem
  Fehler

#### Scenario: Ein Mitglied ohne bezahlt-bis wird nicht geraten

- **WHEN** der Reiter „Mitgliedschaft" ein Mitglied ohne `paid_until` zeigt
- **THEN** bleibt das Feld leer und trägt kein Datum — und kein Wort daneben
  wiederholt die Auskunft

#### Scenario: Der Filter überlebt ein Neuladen

- **WHEN** ein Admin „Gelöscht" wählt und die Seite neu lädt
- **THEN** steht sie wieder auf „Gelöscht"; dasselbe gilt für ② Eingeladen

#### Scenario: Die Stufe lässt sich hier nicht ändern

- **WHEN** ein Admin im Reiter „Mitgliedschaft" die Stufe eines Mitglieds
  ansieht
- **THEN** wird sie angezeigt, aber nicht als Eingabefeld angeboten

#### Scenario: Über das Zeilenmenü ist sie trotzdem erreichbar

- **WHEN** ein Admin im Reiter „Mitgliedschaft" das Menü einer Zeile öffnet
- **THEN** steht dort „Stufe setzen", und der Weg führt über den Dialog mit
  Pflichtbegründung — nicht über ein Feld in der Zeile

#### Scenario: „Mitgliedschaft" zeigt dieselbe Menge wie „Alle"

- **WHEN** ein Admin zwischen „Alle" und „Mitgliedschaft" umschaltet
- **THEN** stehen dieselben Mitglieder in beiden — deaktivierte und gelöschte in
  keinem von beiden

## ADDED Requirements

### Requirement: Ein Admin legt ein einzelnes Mitglied an

Das System SHALL einem Admin erlauben, ein einzelnes Mitglied über die
Mitgliederliste anzulegen. Der Einstieg SHALL ein schwebender Knopf sein, dessen
zugänglicher Name „Mitglied anlegen" lautet, und der auf Mobil weder von der
unteren Kante noch von Feedback- oder Chat-Flächen verdeckt SHALL sein.

Die Maske SHALL Vorname, Nachname, E-Mail und **Plan** als Pflichtfelder führen.
Der Plan SHALL genau die drei Clubstufen anbieten — DISCOVER, FOCUS, IMPACT —
und SHALL NOT die drei Stufen ausserhalb des Clubs anbieten; das ist dieselbe
Zusage wie für „Stufe setzen".

Ein Haken **„Bestätigungsmail senden"** SHALL bestehen und SHALL vorausgewählt
sein.

Das Anlegen SHALL über eine Edge Function `admin-create-member` laufen, mit
`verify_jwt = true`, einer Admin-Prüfung über `staff_roles` und dem
`service_role`-Schlüssel — das Konto muss in `auth.users` entstehen, und dorthin
reicht keine Policy.

**Das Konto SHALL ohne Passwort entstehen.** Es SHALL dieselbe Form haben wie ein
importiertes, noch nicht bestätigtes Mitglied, damit Lebenszyklus,
Aktivierungs-Gate und Mitgliederliste keinen Sonderfall bekommen. Ein vom Admin
gesetztes Passwort SHALL NOT entstehen, und das Konto SHALL NOT unmittelbar
aktiviert werden — das Mitglied bestätigt selbst (AGE-604).

**Eine bereits vergebene Adresse SHALL kein zweites Konto erzeugen.** Die Antwort
SHALL benennen, dass die Adresse schon zu einem Mitglied gehört, und SHALL zu
diesem führen.

Ein Aufrufer ohne Admin-Rolle SHALL abgewiesen werden.

#### Scenario: Ein Mitglied entsteht mit Plan und Einladung

- **WHEN** ein Admin die Maske mit Vorname, Nachname, Adresse und Plan FOCUS
  ausfüllt und den Haken stehen lässt
- **THEN** entsteht ein Konto ohne Passwort auf der Stufe FOCUS, ein
  Aktivierungslink geht hinaus, und das Mitglied erscheint in Schritt ②
  Eingeladen

#### Scenario: Ohne Haken entsteht das Konto und sonst nichts

- **WHEN** ein Admin die Maske ausfüllt und den Haken entfernt
- **THEN** entsteht das Konto, es geht keine Mail hinaus, und das Mitglied
  erscheint in Schritt ① Angelegt

#### Scenario: Eine bekannte Adresse legt kein zweites Konto an

- **WHEN** ein Admin eine Adresse einträgt, zu der bereits ein Konto besteht
- **THEN** entsteht kein zweites Konto, und die Antwort benennt das bestehende
  Mitglied und führt zu ihm

#### Scenario: Die Maske bietet nur die drei Clubstufen an

- **WHEN** ein Admin die Planauswahl öffnet
- **THEN** stehen dort DISCOVER, FOCUS und IMPACT, und keine der drei Stufen
  ausserhalb des Clubs

#### Scenario: Ein Mitglied kann den Endpunkt nicht aufrufen

- **WHEN** ein Konto ohne Admin-Rolle `admin-create-member` aufruft
- **THEN** wird es abgewiesen, und es entsteht kein Konto

### Requirement: Ein Admin lädt ausgewählte Mitglieder mit einem Griff ein

Das System SHALL in der Mitgliederliste ein Kontrollkästchen je Zeile führen und
eine Handlung „Ausgewählte einladen". Diese Handlung SHALL die **einzige** sein,
die aus einer Mehrfachauswahl folgt (ADR-0007).

Sie SHALL für jedes ausgewählte Mitglied dieselbe Kette auslösen, die die Zeile
einzeln auslöst — `send-activation` → `issue_activation_token` — und SHALL deren
Schutzriegel SHALL NOT umgehen: 60 Sekunden je Profil, höchstens fünf pro Tag,
und das Schutzfenster, in dem ein noch gültiger unbenutzter Link **nicht**
ersetzt wird.

**Die Rückmeldung SHALL je Ausgang wahrheitsgemäss sein und SHALL NOT einen
Versand behaupten, den es nicht gab.** Sie SHALL mindestens unterscheiden:
verschickt; übersprungen, weil ein gültiger Link im Postfach liegt; abgewiesen,
weil eine Grenze griff; und fehlgeschlagen. Ein Sammelbericht „N verschickt"
über einer Menge, in der etwas übersprungen wurde, SHALL NOT entstehen.

Die Auswahl SHALL sich auf die gerade sichtbare Seite beziehen und SHALL NOT
stillschweigend Zeilen umfassen, die der Admin nie gesehen hat.

**Ein „alle auf dieser Seite auswählen" SHALL NOT bestehen.** Nur
Kontrollkästchen je Zeile. Ein Kopfkästchen über einem Filter, der die ganze
Gruppe zeigt, wäre mit einem Klick deckungsgleich mit „an alle" — der Handlung,
die ADR-0007 ausdrücklich verwirft.

**Die Aufrufe SHALL nacheinander über die bestehende Einzel-Function laufen**,
und ein Fehlschlag SHALL die Reihe nicht abbrechen. Was verschickt ist, ist
verschickt: die Fläche SHALL vor dem Auslösen sagen, dass sich das nicht
zurückdrehen lässt, und danach zeigen, wie weit sie kam.

#### Scenario: Mehrere Einladungen mit einem Griff

- **WHEN** ein Admin in Schritt ① drei Zeilen auswählt und „Ausgewählte einladen"
  auslöst
- **THEN** geht für jedes der drei ein Aktivierungslink hinaus, und alle drei
  stehen danach in Schritt ② Eingeladen

#### Scenario: Ein gültiger Link im Postfach wird nicht ersetzt

- **WHEN** unter den ausgewählten Mitgliedern eines ist, für das vor weniger als
  einem Tag ein noch gültiger, unbenutzter Link erzeugt wurde
- **THEN** geht für dieses **nichts** hinaus, und der Bericht nennt es
  ausdrücklich als übersprungen samt Grund — nicht als verschickt

#### Scenario: Der Bericht trennt die Ausgänge

- **WHEN** eine Auswahl teils verschickt, teils übersprungen und teils abgewiesen
  wird
- **THEN** nennt die Rückmeldung die Zahlen getrennt, und eine einzelne Zahl
  „verschickt" über der ganzen Menge erscheint nicht

#### Scenario: Die Auswahl greift nicht über die Seite hinaus

- **WHEN** ein Admin auf Seite 1 Zeilen auswählt und danach auf Seite 2 blättert
- **THEN** umfasst die Handlung nur, was er gesehen und gewählt hat, und keine
  Zeilen einer anderen Seite

#### Scenario: Es gibt kein „alle auswählen"

- **WHEN** ein Admin den Kopf der Liste betrachtet
- **THEN** steht dort kein Kontrollkästchen, das die ganze Seite auf einmal
  wählt — die Auswahl entsteht Zeile für Zeile

#### Scenario: Ein Fehlschlag bricht die Reihe nicht ab

- **WHEN** in einer Auswahl von fünf der dritte Aufruf fehlschlägt
- **THEN** laufen der vierte und fünfte trotzdem, und der Bericht nennt den
  dritten als fehlgeschlagen

#### Scenario: Die Auswahl kann nichts anderes

- **WHEN** ein Admin Zeilen ausgewählt hat
- **THEN** gibt es genau eine Handlung dazu, und kein Feld für Text, Betreff oder
  Textbaustein und keinen Weg, die Menge zu exportieren
