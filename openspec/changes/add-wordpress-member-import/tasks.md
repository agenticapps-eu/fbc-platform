## 1. Rüstzeug, Ablage, Wächter

- [ ] 1.1 `sharp` und einen RFC-4180-fähigen CSV-Parser aufnehmen; `supabase/seed/tsconfig.json` um die neuen Dateien erweitern (heute feste `include`-Liste mit drei Einträgen)
- [ ] 1.2 Ablageort für Quelle, Zwischenablage und Bericht **außerhalb** des Arbeitsbaums festlegen; Bericht mit Rechten `0600` schreiben
- [ ] 1.3 Pfadprüfung: eine Quelldatei **innerhalb** des Arbeitsbaums wird abgelehnt, nicht gelesen — RED zuerst, dann GREEN
- [ ] 1.4 Wächter: Projektkennung aus dem **Benutzernamen** (`postgres.<ref>`) gegen eine feste Allowlist; RED-Test mit PROD-Kennung erwartet Abbruch. **Nicht** gegen den Host prüfen — der Pooler-Host ist regionsweit gleich
- [ ] 1.5 Schreibmodus verlangt zusätzlich die ausdrückliche Nennung des Ziels (Test)
- [ ] 1.6 Quelldatei ist Pflichtargument; Aufruf ohne Pfad endet mit Benutzungshinweis (Test)

## 2. Die vier Parser (`wp_felder.ts`, ohne Datenbank)

- [ ] 2.1 `phpArray` nach TypeScript übertragen — RED/GREEN; Fälle: `a:2:{…}`, `a:0:{}`, Klartext, leer
- [ ] 2.2 `ortParsen` übertragen — RED/GREEN; Güteklassen `ok`, `nur_plz`, `nur_ort`, `leer`, plus Länderkürzel `D-70173`
- [ ] 2.3 **neu** `datumParsen` — RED/GREEN über alle 10 Schreibweisen inkl. `.17.03.2019` (führender Punkt), `April 2021`, `2019-09`, `9/2020`; liefert Datum **und** Auffüllgrad (`tag`/`monat`/`jahr`)
- [ ] 2.4 **neu** `telefonParsen` — RED/GREEN; führendes Apostroph des Exporters entfernen (17 von 52 Datensätzen)
- [ ] 2.5 `htmlEntfernen` — RED/GREEN; Tags weg, `&nbsp;`/`&amp;`/numerische Entitäten aufgelöst
- [ ] 2.6 `normalisieren` für Adresse (trimmen, case-folden) und Kennung (trimmen, nichtleer) — RED/GREEN
- [ ] 2.7 Paritätsprüfung: alle Parser gegen die echte Quelldatei laufen lassen und die Zählwerte gegen die Python-Messung stellen (Ort 33/15/2, Datum 52, Arrays 49). Abweichung = Fehler im Port

## 3. Abbildung (`wp_import.lib.ts`)

- [ ] 3.1 Die 26 lebenden Quellfelder als feste Tabelle nach der Matrix im Design; unbekannte Spalte ignorieren, erwartete fehlende bricht ab (Test für beide Richtungen)
- [ ] 3.2 `user_pass` ist in keiner Abbildung enthalten — Test belegt, dass der Wert weder im Zielobjekt noch im Bericht noch in der Ausgabe auftaucht
- [ ] 3.3 Abbildung auf `profiles` inkl. `ort` → `postal_code` + `city`, `beruf` → `headline`, `infos_15` an `short_bio` anhängen, `socials` aus fünf Feldern
- [ ] 3.4 Abbildung auf **`profile_contacts`** (`email`, `phone`, `website`) — eigene Tabelle, im ersten Entwurf übersehen
- [ ] 3.5 Abbildung auf `profile_legacy` (`legacy_source_id`, `legacy_tier` roh, `paid_until` aus der externen Liste)
- [ ] 3.6 Leerwertregel: leeres oder reines Leerzeichen-Feld schreibt `null`, nicht `''` (Test)
- [ ] 3.7 Merge-Regel: nur leere Ziele füllen; `paid_until`/`legacy_tier`/`legacy_price`/`member_since` immer; `activated_at` und Anmeldeadresse nie — je ein Test, inkl. „Mitglied hat das Feld geleert"

## 4. Vorabprüfung und Bericht

- [ ] 4.1 Vorabprüfung über die **ganze** Datei: Kopfzeile, Dubletten, ungültige Adressen — schreibt nichts (Test)
- [ ] 4.2 Kollision mit Bestandskonten ohne Kennung: blockiert den Schreiblauf, hebt keine Stufe an (Test)
- [ ] 4.3 Schreiblauf ohne Ausgetretenen-Liste verweigert; ohne Zahlungsstände läuft er und listet auf (je ein Test)
- [ ] 4.4 Trockenlauf kommt ohne beide Listen aus und vermerkt ihr Fehlen (Test)
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
