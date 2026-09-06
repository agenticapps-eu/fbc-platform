## 1. Fremdreview des Plans (vor der ersten Codezeile)

- [x] 1.1 `openspec validate --all` grün
- [x] 1.2 Fremdreview durch ≥2 Agenten **anderer** Anbieter — `gemini-pro` und `hf:moonshotai/Kimi-K3`, beide REQUEST-CHANGES
- [x] 1.3 `REVIEWS.md` abgelegt; alle 13 Befunde behandelt, 6 HOCH davon angenommen
- [x] 1.4 Plan überarbeitet (design.md 2. Fassung, Spec-Delta neu), `validate` erneut grün

## 2. Datenmodell — `event_vorlagen`

- [x] 2.1 RED: pgTAP-Test, der `public.event_vorlagen` erwartet und rot ist, weil es die Tabelle nicht gibt
- [x] 2.2 Tabelle anlegen: inhaltliche Felder (Titel, Typ, Ort, Beschreibung, Kapazität, Sichtbarkeit, Topics, `cover_path`), Regelspalten aus D3, `ortszeit`, `zeitzone`, `dauer`
- [x] 2.3 `check`-Constraints aus D3: je Form genau die zugehörigen Spalten gesetzt, die übrigen `null`
- [x] 2.4 RED: `zeitzone = 'Europe/Belin'` wird beim Speichern abgewiesen — `check` gegen `pg_timezone_names`
- [x] 2.5 Entscheidungen in den Migrationskopf: warum `INVOKER` **und warum die Policy trotzdem mitwachsen musste**, warum Kopie je Cover, warum getippte Spalten statt `RRULE`, warum `slot_datum`
- [x] 2.6 RLS aktivieren und Policy analog `events_write_host` (`is_activated()` + `host_id = auth.uid()` + Cover-Pfadbindung)
- [x] 2.7 Grants **ausdrücklich** erteilen — neue Tabellen erben nichts
- [x] 2.8 Unique index auf `event_vorlagen (id, host_id)` — Voraussetzung für den komposit-FK aus 3.3
- [x] 2.9 Spalten- und Policy-Kommentare setzen; im Kopf vermerken, dass das Fehlen eines `has_level`-Gates bei Events **gemessen** ist (Stil des Hauses)

## 3. Datenmodell — Anbindung an `events`

- [x] 3.1 RED: Test, der `events.vorlage_id` und `events.slot_datum` erwartet
- [x] 3.2 **RED (Sicherheit): ein Host fügt ein eigenes Event mit FREMDER `vorlage_id` ein → muss abgewiesen werden.** Das ist der HOCH-Befund; der Test muss vor dem Fix rot sein
- [x] 3.3 `vorlage_id` und `slot_datum` ergänzen; komposit-FK `(vorlage_id, host_id) → event_vorlagen (id, host_id)` mit `on delete set null`
- [x] 3.4 Eindeutiger Index auf `(vorlage_id, slot_datum)` — **nicht** auf `starts_at`
- [x] 3.5 Nachweisen, dass der Index den Bestand nicht berührt: bestehende Events tragen `vorlage_id is null`, und `null` kollidiert in Postgres nicht

## 4. Die Wiederholungsregel

- [ ] 4.1 RED: alle drei Formen mit den **verifizierten** Daten aus der Spec — jeden Dienstag ab 01.09.2026 → 01./08./15./22.09.; erster Dienstag ab 09/2026 → 01.09., 06.10., 03.11., 01.12.
- [ ] 4.2 RED: Grenzfall „Monatsstart ist selbst der gesuchte Wochentag" (01.09.2026 ist ein Dienstag)
- [ ] 4.3 RED: Grenzfall „Monat ohne den geforderten Tag wird übersprungen" (`monatlich_tag` = 31), und dass übersprungene Monate **nicht** in `anzahl` zählen
- [ ] 4.4 RED: Herbstumstellung — Termine um den 25.10.2026, Erwartung 19:00 Ortszeit auf beiden Seiten, UTC-Abstand um eine Stunde abweichend
- [ ] 4.5 RED: **Frühjahrslücke** — 02:30 am Umstelltag ergibt einen Termin um 03:30 Ortszeit, kein Ausfall
- [ ] 4.6 RED: **Herbstüberlappung** — 02:30 am Umstelltag ergibt genau einen Termin, erste Lesart
- [ ] 4.7 Regelauswertung implementieren, bis 4.1–4.6 grün sind

## 5. Die Erzeugungs-RPC

- [ ] 5.1 RED: Aufruf ohne `anzahl` und ohne `bis_datum` wird abgewiesen
- [ ] 5.2 RED: `anzahl` = 53 wird abgewiesen, und es entsteht **kein** Termin (kein Teilergebnis von 52)
- [ ] 5.3 RED: `bis_datum` jenseits des 52. Vorkommnisses wird ebenso abgewiesen
- [ ] 5.4 RED: regellose Vorlage mit `anzahl` statt Datum wird abgewiesen
- [ ] 5.5 RED: Erzeugen legt keine einzige Anmeldezeile an
- [ ] 5.6 RED: erneutes Erzeugen lässt einen bestehenden Termin mit Anmeldungen unangetastet
- [ ] 5.7 RED: ein verschobener Termin kehrt bei erneuter Erzeugung **nicht** zurück (prüft `slot_datum`)
- [ ] 5.8 RED: ein fremder Host kann aus meiner Vorlage nichts erzeugen
- [ ] 5.9 Funktion als `SECURITY INVOKER`, **`on conflict (vorlage_id, slot_datum) do nothing` mit Ziel**, Obergrenze an der Kandidatenliste vor dem Einfügen
- [ ] 5.10 `revoke`/`grant` sauber setzen — Default Privileges wirken auf Funktionen **nicht**

## 6. Serienänderung

- [ ] 6.1 RED: Ortszeit 19→20 geändert, erneut erzeugt → zukünftige anmeldungsfreie Termine liegen auf 20:00, **kein** 19:00-Termin derselben Woche daneben
- [ ] 6.2 RED: derselbe Vorgang lässt einen zukünftigen Termin **mit** Anmeldungen unverändert
- [ ] 6.3 RED: derselbe Vorgang lässt vergangene Termine unverändert
- [ ] 6.4 Aktualisierungslogik implementieren

## 7. Cover je Termin

- [ ] 7.1 RED: vier erzeugte Termine tragen vier verschiedene Cover-Pfade, alle im `{uid}/`-Präfix, Namen **unvorhersagbar** (UUID)
- [ ] 7.2 RED: Vorlage ohne Cover erzeugt Termine ohne Cover und scheitert nicht
- [ ] 7.3 RED: Positivkontrolle, dass die Cover-Pfad-Eindeutigkeit weiterhin greift
- [ ] 7.4 RED: fremdes Mitglied und `anon` erhalten das Cover einer **Vorlage** nicht; der eigene Host erhält es
- [ ] 7.5 `event_cover_lesbar()` um den Host-Zweig aus D5a **erweitern** (kein `anon`-, kein `members`-Zweig)
- [ ] 7.6 **Gegenprobe: `anon`- und `members`-Verhalten für Event-Cover ist unverändert** — das ist eine eigene Aufgabe, kein Nebensatz
- [ ] 7.7 Kopieren im Client vor dem RPC-Aufruf (`storage.copy()` je Termin), RPC nimmt fertige Pfade entgegen

## 8. Rundruf und Feed

- [ ] 8.1 RED: eine Erzeugung von 52 Terminen löst **höchstens einen** Rundruf aus
- [ ] 8.2 RED: dieselbe Erzeugung erzeugt 52 Feed-Beiträge
- [ ] 8.3 RED: ein einzeln angelegtes Event löst wie bisher genau einen Rundruf aus (Positivkontrolle gegen eine zu breite Unterdrückung)
- [ ] 8.4 Unterdrückung für `vorlage_id`-Termine plus einen Serien-Hinweis implementieren

## 9. Oberfläche

- [ ] 9.1 Vorlagenliste und -formular; `EventForm` und den bestehenden Cropper wiederverwenden, nicht ersetzen
- [ ] 9.2 Erzeugen-Dialog mit Regelauswahl, Anzahl bzw. Enddatum und einer Vorschau der Termine vor dem Schreiben
- [ ] 9.3 Serienzugehörigkeit am Event sichtbar machen
- [ ] 9.4 `src/lib/database.types.ts` **von Hand** nachziehen — `supabase gen types` darf nicht darüberlaufen

## 10. Wächter und Abnahme

- [ ] 10.1 `grants_test.sql` nachziehen — bricht bei jeder neuen Tabelle; bei **Funktionen** heißt Rot dagegen „der `revoke` fehlt", die Liste dort nicht blind nachziehen
- [ ] 10.2 `pnpm typecheck`, `pnpm lint` und `pnpm test` grün, Exit-Code geprüft statt der Ausgabe
- [ ] 10.3 Sichtprobe gegen den lokalen Stack: Vorlage anlegen, Termine erzeugen, an einem anmelden
- [ ] 10.4 Fremdreview des **Diffs** (zweite Stufe) — mit besonderem Augenmerk auf `event_cover_lesbar()`
- [ ] 10.5 `openspec validate --all` erneut grün
- [ ] 10.6 Change archivieren, danach `pnpm release:entries`
