## 1. Rüstzeug, Ablage, Wächter

- [x] 1.1 `sharp` und einen RFC-4180-fähigen CSV-Parser aufnehmen; `supabase/seed/tsconfig.json` um die neuen Dateien erweitern (heute feste `include`-Liste mit drei Einträgen)
      — `sharp@0.35.3` + `csv-parse@7.0.2` als devDependencies; `include` auf `*.ts` umgestellt. Belegt mit Sonde: eine neue Datei mit Typfehler ist unter dem Muster **rot**, unter der alten Dateiliste **unsichtbar**.
- [x] 1.2 Ablageort für Quelle, Zwischenablage und Bericht **außerhalb** des Arbeitsbaums festlegen; Bericht mit Rechten `0600` schreiben
      — `ablageorte()` legt beides neben die Quelle, `schreibeBericht()` schreibt mit `mode` **und** `chmod`: der `mode` allein wirkt nur beim Anlegen, über einer vorhandenen 0644-Datei bliebe der Bericht weltlesbar. Die Zwischenablage ist bewusst **nicht** zeitgestempelt (Test) — sie soll das Abschalten der alten Seite überleben.
- [x] 1.3 Pfadprüfung: eine Quelldatei **innerhalb** des Arbeitsbaums wird abgelehnt, nicht gelesen — RED zuerst, dann GREEN
      — verglichen wird über `relative`, nicht `startsWith`: ein Nachbarverzeichnis `fbc-platform-daten` liegt daneben, nicht darin (Test). Relative Pfade werden vorher aufgelöst, `../fbc-platform/export.csv` fällt also mit.
- [x] 1.4 Wächter: Projektkennung aus dem **Benutzernamen** (`postgres.<ref>`) gegen eine feste Allowlist; RED-Test mit PROD-Kennung erwartet Abbruch. **Nicht** gegen den Host prüfen — der Pooler-Host ist regionsweit gleich
      — `pruefeZiel()` in `wp_import.lib.ts`, wiederverwendet `extractProjectRef` statt einer zweiten Regex. Ein Test hält die Voraussetzung des Befunds fest (`new URL(DEV_URL).host === new URL(PROD_URL).host`), zwei weitere die Kanten: fremdes Projekt wird keinem Ziel zugeordnet, und die Kennung schlägt die Adresse (Tunnel auf 127.0.0.1).
- [x] 1.5 Schreibmodus verlangt zusätzlich die ausdrückliche Nennung des Ziels (Test)
      — `--schreiben` ohne `--ziel=` bricht ab; `prod` bleibt im Wörterbuch, damit der Go-Live-Lauf keine Codeänderung braucht.
- [x] 1.6 Quelldatei ist Pflichtargument; Aufruf ohne Pfad endet mit Benutzungshinweis (Test)
      — dazu: nichts Unbekanntes wird durchgereicht (weder ein Flag noch eine zweite Quelldatei), je mit Prüfung des **Grundes** — ohne die prüfte der Test nichts, weil der Ersatzpfad ebenfalls abbricht.

> Gegenprobe zu Gruppe 1: 17 Mutationen an `wp_import.lib.ts`, jede muss die Suite rot machen. Drei Vakuum-Tests dabei gefunden und geschlossen, ein toter Zweig entfernt.

## 2. Die vier Parser (`wp_felder.ts`, ohne Datenbank)

> **Korrektur zur Ausgangslage.** Der Vorlauf hat gegen `parser.py` (13.08., 15:17) gemessen und geschlossen, Datum und Telefon seien noch zu schreiben. Die spätere `wp_feld_parser.py` (15:51) enthält **alle vier** Parser plus `text_saeubern` und eine `headline`-Ableitung. „**neu**" unten stimmt also nicht — es war eine Übertragung wie die anderen auch. Die Ableitung der Headline aus `infos` ist in diesem Change **nicht** übernommen: die Abbildungsmatrix führt `beruf` → `headline`, und eine falsche Headline steht unter dem Namen im Verzeichnis.

- [x] 2.1 `phpArray` nach TypeScript übertragen — RED/GREEN; Fälle: `a:2:{…}`, `a:0:{}`, Klartext, leer
      — dazu ein Fall, den die Gegenprobe erzwungen hat: bei widersprüchlichem `a:0:{i:0;s:5:"hallo";}` gewinnt die Kopfzahl, nicht der Rumpf.
- [x] 2.2 `ortParsen` übertragen — RED/GREEN; Güteklassen `ok`, `nur_plz`, `nur_ort`, `leer`, plus Länderkürzel `D-70173`
      — zwei Fallen: `\b` greift in JavaScript vor „Ö" nicht (Lookaround statt Wortgrenze), und ohne die Längenschranke für Landesnamen frisst „d" ein Wort aus „Bad Homburg v. d. Höhe". Der Rückfall auf die Regionalgruppe ist **nicht** übernommen.
- [x] 2.3 `datumParsen` — RED/GREEN über alle Schreibweisen inkl. `.17.03.2019` (führender Punkt), `April 2021`, `2019-09`, `9/2020`; liefert Datum **und** Auffüllgrad (`tag`/`monat`/`jahr`)
      — gemessen sind **11 Rohformen / 9 normalisierte** (nicht 10) und **16 ohne Tag** (nicht 17), 6 ohne Monat. Führt die Zeichenkette statt eines `Date`: ein `new Date("2020-07-22")` steht auf UTC-Mitternacht. Unmögliche Tage (`31.02.`) werden abgewiesen statt umgerechnet.
- [x] 2.4 `telefonParsen` — RED/GREEN; führendes Apostroph des Exporters entfernen (17 von 52 Datensätzen)
- [x] 2.5 `htmlEntfernen` — RED/GREEN; Tags weg, `&nbsp;`/`&amp;`/numerische Entitäten aufgelöst
      — Auflösung in **einem** Durchgang, sonst wird aus `&amp;lt;` wieder echtes Markup.
- [x] 2.6 `normalisieren` für Adresse (trimmen, case-folden) und Kennung (trimmen, nichtleer) — RED/GREEN
      — die Kennung wird **nicht** case-gefaltet: sie ist ein Schlüssel, kein Text.
- [x] 2.7 Paritätsprüfung: alle Parser gegen die echte Quelldatei laufen lassen und die Zählwerte gegen die Python-Messung stellen. Abweichung = Fehler im Port
      — `scripts/probe-c10-parser-paritaet.ts`, **16 von 16 Zählwerten gleich** gegen die echten 70 Datensätze. Die „Arrays 49" der Aufgabenstellung sind zwei Zahlen: 49 Felder befüllt, davon 43 mit Inhalt (6× `a:0:{}`). Gegenprobe: ein Port, der den führenden Punkt nicht abschneidet, wird von der Probe mit Fehlercode gemeldet (52 → 51).

## 3. Abbildung (`wp_import.lib.ts`)

- [x] 3.1 Die 26 lebenden Quellfelder als feste Tabelle nach der Matrix im Design; unbekannte Spalte ignorieren, erwartete fehlende bricht ab (Test für beide Richtungen)
      — `QUELLFELDER` + `pruefeKopfzeile()`, 8 Tests. Die 26 Namen stehen im Test **wörtlich** statt aus der Liste abgeleitet, sonst prüfte er sie gegen sich selbst. Gegen die echte Kopfzeile gehalten: alle 26 vorhanden (von 140 Spalten). Dazu ein Fall, den erst das Lesen der echten Datei ergab: sie beginnt mit einem **BOM**, das am Namen der ersten Spalte klebt — heute folgenlos, weil dort `user_login` steht, aber nach einem neu gezogenen Export meldete der Wächter sonst ein vorhandenes Feld als fehlend.
- [x] 3.2 `user_pass` ist in keiner Abbildung enthalten — Test belegt, dass der Wert weder im Zielobjekt noch im Bericht noch in der Ausgabe auftaucht
      — zwei Ebenen: ein Test hält fest, dass ein eingeschleuster Hash nicht im serialisierten Zielsatz auftaucht (`JSON.stringify(satz)`), und die Probe prüft dasselbe gegen die **echten 70 Hashes** — 0 von 70 durchgesickert. Bericht und Ausgabe folgen in Gruppe 4, sobald es sie gibt.

> **Korrektur 14.08. am Zielschema gelesen (Design, „Nachtrag: sieben Ziele stimmten nicht").** Die Anschrift liegt auf `profile_contacts`, nicht `profiles`; `profile_contacts.website` ist seit dem 11.06. gedroppt; `profiles.offers`/`.needs` gibt es nicht; `profiles.interests` ist nicht die Spalte, die das Profil zeigt. Der Import schreibt **sechs** Tabellen, nicht drei.

- [x] 3.3 Abbildung auf `profiles`: `beruf` → `headline`, `infos_15` an `short_bio` anhängen, `Homepage` → `website`, `ort_27_28` → `region`, `infos_16` → `member_since`, `socials` aus fünf Feldern; `praesi_kurz`/`praesei_lang` **pro Wert**: parsebare URL → `videos`, sonst an `short_bio` (gemessen: 2 Menschen Video, 3 Menschen Text — es sind Präsentationstexte, keine Videos)
      — `bildeAb()` in `wp_import.lib.ts`. Der Video-Erkenner ist **nicht** nachgebaut, sondern `parseVideoUrl` aus `src/lib/video-url` (das Modul ist genau dafür seiteneffektfrei geschnitten): ein zweiter Erkenner hiesse, dass der Import ablegt, was die Anzeige danach verwirft. `htmlEntfernen` läuft über **jedes** Textfeld, nicht nur über die vier mit gemessenem Markup — die Messung gilt für den Export vom 13.08., die Quelle wird neu gezogen.
- [x] 3.4 Abbildung auf **`profile_contacts`** — `email`, `phone` **und die Anschrift**: `Strasse` → `street`, `ort` → `postal_code` + `city` (`ortParsen`, ein Feld → zwei), `ort_27` → `state`, `country` Vorgabe `DE`. **Nicht** auf `profiles`: dort wäre die Anschrift für jedes eingeloggte Konto lesbar
      — `country` bekommt die Vorgabe `DE` nur, wo überhaupt eine Ortsangabe stand (`ortParsen` liefert bei leerer Eingabe kein Land). Sie auf eine leere Anschrift zu setzen wäre eine Behauptung über einen Menschen, zu dem nichts vorliegt.
- [ ] 3.5 Abbildung auf `profile_legacy` (`legacy_source_id`, `legacy_tier` roh, `paid_until` aus der externen Liste)
      — **zur Hälfte zu**: `legacy_source_id` (70/70) und `legacy_tier` (4/70, roh, nur der Rand beschnitten) sind abgebildet und belegt. `paid_until` bleibt offen, es hängt an Detlevs Zahlungsständen — die Liste ist zugesagt, blockiert aber nichts anderes.
- [x] 3.5a Abbildung auf `offers`/`needs`/`profile_interests` — die drei Ziele, die der erste Entwurf auf nicht existierende `profiles`-Spalten legte: `biete`/`suche` je **eine Zeile** mit `description` = Volltext und abgeleitetem `title` (`not null`), `infos_28` als **ein** `profile_interests`-Chip mit `theme = null`
      — `titelAus()`: erste nicht-leere Zeile, an der Wortgrenze auf 80 Zeichen gekürzt, sonst hart. Bei den 26 einzeiligen Werten ist der Titel der Text selbst, bei den langen ein Anriss; der Volltext steht vollständig in `description`. Probe: 0 von 93 offers/needs-Zeilen ohne Titel.
- [x] 3.5b **Oberfläche**: `socials` um `facebook`, `youtube`, `twitter` erweitern — Zod-Schema, Vorbelegung, `fetchProfileEditorData` und drei Felder in `ProfileFieldsets`. Ohne das räumt das erste Speichern eines Mitglieds die importierten Werte wieder weg (`saveProfile` schreibt alle Felder bedingungslos); betroffen sind 23 Menschen, 5 davon ohne jedes andere Netzwerk. **UI-Änderung: lokal zeigen, bevor sie steht**
      — RED/GREEN am echten Löschpfad: `z.object` entfernt unbekannte Schlüssel **still** (strip, nicht strict), ein `profileFormSchema.parse` mit `facebook` gab vorher `undefined`. Derselbe Pfad steckte im **Admin-Weg** (`admin-profile.ts:98`) — er lädt drei Schlüssel und schreibt alle zurück, ein Speichern durch die Verwaltung hätte die Werte ebenso geräumt. Sichtprobe im laufenden Editor: sechs Felder, zwei Reihen à 205 px, schmal einspaltig ohne Überlauf.
- [x] 3.6 Leerwertregel: leeres oder reines Leerzeichen-Feld schreibt `null`, nicht `''` (Test)
      — an **einer** Stelle (`wert()`), durch die jedes Textfeld läuft, statt an 26 Aufrufstellen wiederholt.
- [x] 3.7 Merge-Regel: nur leere Ziele füllen; `paid_until`/`legacy_tier`/`legacy_price`/`member_since` immer; `activated_at` und Anmeldeadresse nie — je ein Test, inkl. „Mitglied hat das Feld geleert"
      — `fuegeZusammen(ziel, bestand)` + `Bestand`, 18 Tests. **Die Regel widersprach sich**: ein gelöschtes Feld IST leer, „leer, also füllen" machte die Löschung bei jedem Lauf rückgängig. Unterschieden wird deshalb am **Profil** statt am Feld — wo dieser Import schon geschrieben hat (`legacy_source_id`), ist eine Lücke eine Entscheidung des Mitglieds; nur ein noch nicht importiertes Profil wird ergänzt. Zwei Verschärfungen: Verwaltungsfelder werden nur geschrieben, wo die **Quelle** einen Wert führt (sonst räumte `null` weg, was von Hand nachgetragen wurde — 66/70 ohne `Mitgliedschaft`), und `socials` wird **pro Schlüssel** zusammengeführt (sonst verlöre ein Mitglied mit eigenem Xing-Eintrag entweder das Xing oder die fünf importierten). `paid_until`/`legacy_price` kommen im Ergebnis nicht vor: die Quelle führt sie nicht, und `null` hiesse dort „unbekannt". Was die Quelle hat und nicht geschrieben wird, steht in `uebersprungen` — sonst verschwiegen die Läufe genau das, was nachzutragen wäre (4.4).

## 4. Vorabprüfung und Bericht

- [ ] 4.1 Vorabprüfung über die **ganze** Datei: Kopfzeile, Dubletten, ungültige Adressen — schreibt nichts (Test)
- [ ] 4.2 Kollision mit Bestandskonten ohne Kennung: blockiert den Schreiblauf, hebt keine Stufe an (Test)
- [ ] 4.3 Beide Betriebsarten laufen ohne Ausgetretenen-Liste und ohne Zahlungsstände durch und vermerken das Fehlen (Test) — **kein** Riegel, Entscheidung Donald 14.08.
- [ ] 4.4 Bericht führt die nachtragbaren Fälle einzeln auf, sodass sie sich nach der Lieferung gezielt abarbeiten lassen (Test)
- [ ] 4.5 Berichtsaufbau: Klassensumme = Zahl der Datensätze für Läufe, die den verarbeitenden Abschnitt erreichen; Vorab-Abbruch erzeugt den eigenen Berichtstyp (je ein Test)
- [ ] 4.6 Bericht führt die aufgefüllten Beitrittsdaten mit **Rohangabe** — sie ist sonst nirgends erhalten
- [ ] 4.7 Ausgabe-Disziplin: `stdout` führt nur Zeilennummer und Kennung; Test prüft, dass kein Name und keine Adresse der Quelle darin vorkommt

## 5. Trockenlauf (`wp_import.ts`)

- [ ] 5.1 CSV lesen (UTF-8 mit BOM, Kommas und Zeilenumbrüche in Freitextfeldern), Datensätze durch Vorabprüfung, Abbildung und Klassifikation führen
- [ ] 5.2 Gemeinsamer Pfad für beide Betriebsarten; abzweigen dürfen **nur** die wirkenden Adapter (Datenbank, Ablage, Netz) — Test belegt gleiche Klassifikation
- [ ] 5.3 Trockenlauf gegen den lokalen Stack; Zeilenzahlen in `profiles`, `profile_contacts`, `profile_legacy`, `auth.users` **und** die Objektzahl in der Ablage davor/danach gleich (gemessen, nicht behauptet)

## 6. Bildstrecke (eigener, wiederholbarer Abschnitt)

- [ ] 6.1 Abschnitt „Bilder holen": URL aus `source_user_id` + Dateiname, Endung aus dem Datensatz (Test über `jpg`, `png`, `jpeg`), Ablage in die Zwischenablage außerhalb des Arbeitsbaums
- [ ] 6.2 Original ohne Größensuffix ziehen; Test belegt, dass kein `-190x190` angefragt wird
- [ ] 6.3 Verkleinern, nach WebP, in den Bucket; vorhandenes Objekt wird **übersprungen und berichtet**, nicht ersetzt (Test: zweiter Lauf bricht nicht ab)
- [ ] 6.4 Fehlendes/unerreichbares Bild: Mitglied wird dennoch angelegt, Zeile im Bericht (Test mit 404)
- [ ] 6.5 Den Abschnitt einmal echt gegen die alte Seite laufen lassen und die Zwischenablage füllen — bevor die Seite abgeschaltet wird

## 7. Schreibender Lauf

- [ ] 7.1 Anmeldekonto über die Admin-Schnittstelle, **ohne Passwort**; danach eine Transaktion über `profiles`, `profile_contacts` und `profile_legacy`
- [ ] 7.2 Wiedererkennung über Kennung **und** normalisierte Adresse; Test: Konto ohne Kennung wird ergänzt statt doppelt angelegt
- [ ] 7.3 Importierte Konten: `tier = 'impact'`, `activated_at = null` (Test)
- [ ] 7.4 Kein Versand, kein Token — Test belegt, dass ein Lauf über 70 Datensätze keinen Aktivierungsversand auslöst
- [ ] 7.5 Ein fehlerhafter Datensatz beendet den Lauf nicht (Test mit absichtlich kaputtem Satz)
- [ ] 7.6 Dublette im **letzten** Datensatz: null Schreibvorgänge (Test)
- [ ] 7.7 Lokal schreibend laufen lassen, **zweimal**; Zeilenzahl unverändert, Bericht sagt „aktualisiert", und ein zwischen den Läufen von Hand geänderter Wert überlebt den zweiten Lauf
- [ ] 7.8 Stichprobe: fünf Profile in der lokalen Oberfläche gegen die Quelldatei vergleichen (Sichtprobe, nicht nur Test)

## 8. Abschluss

- [ ] 8.1 `pnpm test`, `pnpm typecheck`, `pnpm typecheck:seed`, `pnpm lint`, `pnpm format:check` grün
- [ ] 8.2 Trockenlauf gegen DEV als Gegenprobe, ohne Schreibwirkung; Bericht als Datenanforderung an Detlev aufbereiten
- [ ] 8.3 `git status --porcelain --ignored` belegt: kein Personendatum im Arbeitsbaum, weder verfolgt noch ignoriert
- [ ] 8.4 Diff-Review durch zwei Prüfer anderer Hersteller; Befunde beheben oder begründet ablehnen
