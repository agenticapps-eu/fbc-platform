# Rechte-Matrix: Verzeichnis ab connect, Kontaktanfragen nach Stufe

Linear: AGE-598

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

- **Die Verzeichnisliste bekommt eine eigene, niedrigere Schwelle bei `connect`
  (Rang 2).** Heute gibt es sie nicht: Liste *und* erweiterte Felder hängen an
  derselben Policy `profiles_select_self_or_discover` (`has_level(3)`), und
  `search_directory` läuft als `SECURITY INVOKER` darüber. Die Aufgabe ist
  deshalb eine **zweite Schwelle einziehen**, nicht eine Zahl ändern.
- **Erweiterte Felder bleiben bei `discover`.** Interessen, Kompetenzen,
  Kompass und Themen-Scores werden nicht angefasst. Die bestehende Rang-3-Grenze
  bleibt Wort für Wort stehen.
- **`nav.ts` gibt `/mitglieder` ab `connect` frei** statt ab `discover`.
- **Kontaktanfragen werden gestaffelt** und ersetzen das flache
  `exchange`-Gate: `basic` darf **nicht** senden · `connect` darf **nur an
  genau `connect`** senden · ab `discover` an alle.
- **`open_contact` wird vom Welpenschutz entkoppelt** — durch einen **zweiten**
  Schalter `platform_settings.welpenschutz_aktiv` (Vorgabe `false`). Danach
  wirkt `open_contact` nur noch auf die Staffelung und der neue Schalter nur
  noch auf den Welpenschutz. Zwei Regeln, zwei Stellschrauben.
- **Der Volltext bekommt eine zweite, magere Fassung.** `search_doc` enthält
  `competencies` und `interests`, und die Suche ist heute nur an die
  Aktivierung gebunden, nicht an die Stufe. Ohne diesen Zusatz könnte ein
  `connect`-Konto über das Suchfeld erfragen, was die Ausgabe ihm maskiert.
- **`branche` wird ein Basisfeld** und kommt in `profiles_public`. Sonst fiele
  die Spalte still aus der Verzeichnisantwort und der Branchenfilter liefe
  wortlos leer.
- **BREAKING (latent, nicht sofort):** Weder die Staffelung noch der
  Welpenschutz werden durch das Ausrollen wirksam. Beide warten auf ihren
  Schalter. Dieser Change **fasst kein Flag auf PROD an**.

### Was NICHT Teil dieses Changes ist

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
- **Der Welpenschutz wird inhaltlich nicht verändert** — 30 Tage,
  Fluchtweg über ein Match. Nur seine Abhängigkeit vom Flag fällt weg.

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

- Ein Ausrollen ändert für Mitglieder **nichts** an den Kontaktanfragen.
  Beide Regeln hängen an je einem Schalter: die Staffelung an `open_contact`
  (steht auf `true`, hebt sie also auf), der Welpenschutz an
  `welpenschutz_aktiv` (Vorgabe `false`). **Diese Aussage gilt erst seit der
  Überarbeitung nach dem Plan-Review** — der erste Entwurf hätte den
  Welpenschutz beim Ausrollen sofort scharf gestellt, und dieser Absatz
  behauptete trotzdem, es ändere sich nichts. Beide Reviewer haben das
  angezeigt.
- Die **Verzeichnisschwelle** wirkt dagegen sofort und hängt an keinem
  Schalter. Sie ist der einzige Teil dieses Changes, den Mitglieder am Tag des
  Ausrollens bemerken — und sie gibt Rechte, sie nimmt keine.
- **Vor** dem Umlegen von `welpenschutz_aktiv` ist das Alter des Bestands zu
  messen: `is_new_member` liest `profiles.created_at`, und der Import hat alle
  72 Profile in einem Lauf angelegt.
