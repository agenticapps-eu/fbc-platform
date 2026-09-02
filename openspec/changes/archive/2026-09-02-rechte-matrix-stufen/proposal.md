# Das Mitgliederverzeichnis ist ab Connect sichtbar

Linear: AGE-598

<!-- Die Überschrift ist bewusst die MITGLIEDER-Sicht und nicht mehr
     „Rechte-Matrix: Verzeichnis ab connect, Kontaktanfragen nach Stufe".
     `parseArchivEintrag` nimmt die erste `# `-Zeile als Titel des
     Neuigkeiten-Eintrags, und der geht genau einmal an alle aktivierten
     Mitglieder. Der Change heisst im Repo weiterhin `rechte-matrix-stufen`. -->

<!-- Zum Abschnitt `## What Changes` darunter: seine `- `-Zeilen werden
     ungefiltert zu den `aenderungen` des Neuigkeiten-Eintrags
     (`scripts/release-entries.logic.ts:39`). Sie sind deshalb in
     Mitglieder-Sprache geschrieben und beschreiben nur, was jemand HEUTE
     merkt. Die technische Fassung steht unter „Im Einzelnen" als
     Fettabsätze — die erntet der Erzeuger nicht.

     Und der Ausschluss-Abschnitt trägt jetzt `##` statt `###`: der Parser
     schneidet bei `/^#{1,2} /`, ein `###` beendet den Abschnitt NICHT. Vor
     dieser Korrektur hätte der Eintrag 12 Punkte getragen, darunter die vier
     Ausschlüsse als das Ausgelieferte (dieselbe Falle wie AGE-628). -->


## Why

Die Plattform hat heute **zwei Rechte-Schwellen, die nicht zu ihrem Zweck
passen**, und beide fallen erst auf, wenn der Stufenweg live geht.

**Erstens** liegt das Mitgliederverzeichnis bei `discover` (Rang 3), der ersten
zahlenden Stufe. Wer sich selbst registriert, landet auf `basic` und sieht die
Fläche gar nicht — er kann die Gemeinschaft, der er beitreten soll, nicht
ansehen. Die Schwelle wurde von AGE-311 nicht erfunden, sondern von
`is_prime_plus()` auf `has_level(3)` **verschoben**; sie war nie gegen die
Eintrittsstufe geprüft, weil es sie praktisch nicht gab.

**Zweitens** steht `platform_settings.open_contact` seit dem 05.08.2026 auf
`true`. Das Flag hebt in `cr_insert_self` **zwei** Klauseln zugleich auf: das
Level-Gate (`exchange`, Rang 4) und den 30-Tage-Welpenschutz. Heute darf damit
jedes aktivierte Mitglied jedem schreiben — auch ein `basic`-Konto, das
niemand geprüft hat. Es gibt keinen Weg, die Stufenregel wieder scharf zu
stellen, ohne gleichzeitig den Welpenschutz zurückzuholen; ein Schalter, zwei
Wirkungen.

Warum jetzt: heute ist der Bestand 72 × `impact`, 1 × `discover`, 1 × `basic` —
der Import hat alle hochgesetzt. Sobald `basic` die normale Eintrittsstufe ist,
werden beide Schwellen zu einem täglichen Problem. Solange der Bestand so
schief ist, kostet die Umstellung fast niemanden etwas.

## What Changes

- **Das Mitgliederverzeichnis ist ab der Stufe Connect sichtbar.** Wer Connect
  hat, sieht die Liste aller Mitglieder, kann sie durchsuchen und nach Branche
  und Region filtern. Bisher begann das Verzeichnis erst bei Discover.
- **Die ausführlichen Profilangaben bleiben ab Discover.** Kompetenzen,
  Interessen, Kompass-Themen und das Such-/Bieteprofil sind weiterhin erst ab
  Discover zu sehen — auf den Karten im Verzeichnis bleiben sie darunter leer.
  Auch die Suche findet darunter nichts, was in diesen Feldern steht.
- **Die Filter für Kompetenz, Thema und Angebote erscheinen erst ab Discover.**
  Darunter standen sie zwar da, konnten aber nichts finden. Jetzt stehen sie
  nicht mehr da, und an ihrer Stelle steht, ab welcher Stufe es sie gibt.

Im Einzelnen — die technische Fassung. Diese Absätze sind bewusst **keine**
Aufzählung: der Erzeuger der Neuigkeiten erntet nur `- `-Zeilen, und das hier
ist Repo-Sprache.

**Die Verzeichnisliste bekommt eine eigene, niedrigere Schwelle bei `connect`
(Rang 2).** Vorher gab es sie nicht: Liste *und* erweiterte Felder hingen an
derselben Policy `profiles_select_self_or_discover` (`has_level(3)`), und
`search_directory` lief als `SECURITY INVOKER` darüber. Die Aufgabe war deshalb
eine **zweite Schwelle einziehen**, nicht eine Zahl ändern.

**Erweiterte Felder bleiben bei `discover`.** Interessen, Kompetenzen, Kompass
und Themen-Scores werden nicht angefasst. Die bestehende Rang-3-Grenze bleibt
Wort für Wort stehen.

**`nav.ts` gibt `/mitglieder` ab `connect` frei** statt ab `discover`.

**Kontaktanfragen werden gestaffelt** und ersetzen das flache `exchange`-Gate:
`basic` darf **nicht** senden · `connect` darf **nur an genau `connect`**
senden · ab `discover` an alle. Das steht bewusst **nicht** in der
Mitglieder-Aufzählung oben: solange `open_contact` auf `true` steht, hebt der
Schalter die Staffelung auf, und am Tag des Ausrollens ändert sich für niemanden
etwas. Der Hinweis gehört an den Tag, an dem der Schalter fällt.

**Der 30-Tage-Welpenschutz entfällt ersatzlos** (Donald, 02.09.) — samt dem dann
verwaisten Prädikat `is_new_member(uuid)`. Damit wirkt `open_contact` nur noch
auf die Staffelung, weil es nichts anderes mehr gibt. Die Kopplung, an der Teil B
bisher scheiterte, löst sich auf, statt gelöst zu werden. **Gemessen:** alle 74
Profile sind jünger als 30 Tage; die Regel hätte die Kontaktfunktion
plattformweit stillgelegt und war deshalb nie einschaltbar. Auch das steht nicht
in der Aufzählung oben — die Regel war seit dem 05.08. durch `open_contact`
ohnehin aufgehoben, gemerkt hat sie niemand.

**Der Volltext bekommt eine zweite, magere Fassung.** `search_doc` enthält
`competencies` und `interests`, und die Suche war vorher nur an die Aktivierung
gebunden, nicht an die Stufe. Ohne diesen Zusatz könnte ein `connect`-Konto über
das Suchfeld erfragen, was die Ausgabe ihm maskiert.

**`branche` wird ein Basisfeld** und kommt in `profiles_public`. Sonst fiele die
Spalte still aus der Verzeichnisantwort und der Branchenfilter liefe wortlos
leer. Damit ist die Branche für jedes aktivierte Konto lesbar, auch unterhalb
der Verzeichnisschwelle — eine bewusste Erweiterung dessen, was die View
preisgibt.

**BREAKING (latent, nicht sofort):** Die Staffelung wird erst wirksam, wenn
jemand `open_contact` auf `false` setzt. Dieser Change **fasst kein Flag auf
PROD an**. Gemessen ist auch dieser Schritt folgenlos: alle 74 Konten liegen auf
Rang 3 oder darüber, für die die Staffelung jeden Empfänger erlaubt.

## Was NICHT Teil dieses Changes ist

- **Keine Listungs-Untergrenze.** `basic` bleibt im Verzeichnis **gelistet**.
  Die Untergrenze kommt, wenn der Stufenweg live ist; heute beträfe der Filter
  genau ein Profil, und das ist nicht einmal aktiviert.
- **`profiles_public` bekommt keine Schwelle.** Die View liefert die
  Basisfelder heute ausdrücklich „regardless of the member's tier" und trägt
  an 15 Stellen die Namensauflösung in Feed, Chat, Events, Academy, Admin und
  Kontaktanfragen. Eine Stufe darauf verwehrte einem `basic`-Konto nicht das
  Verzeichnis, sondern räumte ihm den Feed leer. Das bleibt so und wird als
  **bewusste Nicht-Zusage** in die Spec geschrieben, damit es niemand später
  für ein Versehen hält.
- **Das Flag auf PROD wird nicht umgelegt.** Schreibzugriff auf die laufende
  Anlage gehört nicht in diesen Change.
- **Kein Ersatz für den Welpenschutz.** Kein zweiter Schalter, keine
  abgeschwächte Fassung, keine kürzere Frist. Was seine Aufgabe übernimmt, ist
  die Staffelung selbst: ein `basic`-Konto darf gar nicht senden. Sie fragt,
  **wer sendet**, statt wer empfängt — und schliesst die Angriffsfläche damit
  an der Wurzel.

## Capabilities

### New Capabilities

Keine. Beide betroffenen Fähigkeiten existieren bereits als Spec.

### Modified Capabilities

- `directory-search`: Die Liste und die Suche bekommen eine eigene Schwelle bei
  `connect`; die Zusage „Richer profile fields are gated by membership rank"
  (Rang 3) bleibt unverändert und wird durch die neue, niedrigere Schwelle
  ausdrücklich **nicht** berührt. Dazu die neue Nicht-Zusage zu
  `profiles_public`.
- `contact-requests`: Die Anforderung „Cold-request gates open under the admin
  toggle" wird ersetzt. An ihre Stelle treten zwei getrennte Anforderungen —
  eine gestaffelte Senderegel, die `open_contact` weiterhin aufheben kann, und
  ein Welpenschutz, der es nicht mehr kann.

## Impact

**Datenbank (Migration, RLS):**

- `search_directory` — braucht einen Pfad, der ab Rang 2 die Basisfelder aller
  öffentlichen, aktivierten Profile liefert, ohne die Rang-3-Grenze für die
  vollen Zeilen aufzuweichen.
- `cr_insert_self` (`20260806080100_activation_gate.sql:313`) — die Klausel in
  Zeile 320 wird durch die Staffelung ersetzt, die Klausel in Zeile 332
  verliert ihr `is_contact_open() or`.
- Neues Prädikat für die Staffelung; `is_contact_open()` und `is_new_member()`
  bleiben, `has_level()` bleibt.

**Frontend:**

- `src/config/nav.ts:95` — `minTier` von `discover` auf `connect`.
- `src/lib/contact-requests.ts` — die Oberfläche muss benennen, warum ein Knopf
  nicht sendet; heute kennt sie nur „darf" und „darf nicht".
- Die Aufstiegs-Hinweise in `directory-search` nennen `discover`; sie zeigen
  nach der Änderung auf die falsche Stufe.

**Tests:**

- pgTAP für beide Policies, gegen alle sechs Stufen — nicht nur gegen die
  Grenze. Ein Test, der nur `basic` und `discover` prüft, sieht die
  `connect`→`connect`-Regel nicht.
- Die bestehenden `rls_test.sql`-Zusagen zur Rang-3-Grenze müssen **grün
  bleiben**; sie sind die Gegenprobe, dass die neue Schwelle die alte nicht
  mitgenommen hat.

**Betrieb:**

- Ein Ausrollen **verschärft für Mitglieder nichts** an den Kontaktanfragen.
  Die Staffelung hängt an `open_contact`, und das steht auf `true` und hebt sie
  auf. Der Welpenschutz **entfällt** — er greift heute ohnehin nicht, weil
  dasselbe Flag ihn aufhebt. Unterm Strich lockert dieser Change hier, er
  verschärft nicht.
  *Diese Aussage stimmt erst seit der Überarbeitung nach dem Plan-Review:* der
  erste Entwurf hätte den Welpenschutz beim Ausrollen sofort scharf gestellt und
  hier trotzdem „ändert nichts" behauptet. Beide Reviewer haben den Widerspruch
  angezeigt.
- Die **Verzeichnisschwelle** wirkt sofort und hängt an keinem Schalter. Sie ist
  der einzige Teil dieses Changes, den Mitglieder am Tag des Ausrollens bemerken
  könnten — und sie gibt Rechte, sie nimmt keine. Gemessen betrifft sie heute
  **niemanden**: es gibt kein Konto auf `connect`.
- **`open_contact` auf `false` zu setzen ist heute folgenlos** und kann
  jederzeit nach dem Ausrollen geschehen: alle 74 Konten liegen auf Rang 3 oder
  darüber, für die die Staffelung jeden Empfänger erlaubt. Der richtige
  Zeitpunkt ist **vor** dem Öffnen der Selbstregistrierung — dann greift die
  Regel zum ersten Mal wirklich.
