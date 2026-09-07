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

- [x] 4.1 RED: alle drei Formen mit den **verifizierten** Daten aus der Spec — jeden Dienstag ab 01.09.2026 → 01./08./15./22.09.; erster Dienstag ab 09/2026 → 01.09., 06.10., 03.11., 01.12.
- [x] 4.2 RED: Grenzfall „Monatsstart ist selbst der gesuchte Wochentag" (01.09.2026 ist ein Dienstag)
- [x] 4.3 RED: Grenzfall „Monat ohne den geforderten Tag wird übersprungen" (`monatlich_tag` = 31), und dass übersprungene Monate **nicht** in `anzahl` zählen
- [x] 4.4 RED: Herbstumstellung — Termine um den 25.10.2026, Erwartung 19:00 Ortszeit auf beiden Seiten, UTC-Abstand um eine Stunde abweichend
- [x] 4.5 RED: **Frühjahrslücke** — 02:30 am Umstelltag ergibt einen Termin um 03:30 Ortszeit, kein Ausfall
- [x] 4.6 RED: **Herbstüberlappung** — 02:30 am Umstelltag ergibt genau einen Termin. **Korrigiert 07.09.:** es ist die _zweite_ Lesart (Normalzeit), gemessen — die Plan-Sonde konnte die Lesarten nicht unterscheiden. Siehe design.md D4.
- [x] 4.7 Regelauswertung implementieren, bis 4.1–4.6 grün sind

## 5. Die Erzeugungs-RPC

- [x] 5.1 RED: Aufruf ohne `anzahl` und ohne `bis_datum` wird abgewiesen
- [x] 5.2 RED: `anzahl` = 53 wird abgewiesen, und es entsteht **kein** Termin (kein Teilergebnis von 52)
- [x] 5.3 RED: `bis_datum` jenseits des 52. Vorkommnisses wird ebenso abgewiesen
- [x] 5.4 RED: regellose Vorlage mit `anzahl` statt Datum wird abgewiesen
- [x] 5.5 RED: Erzeugen legt keine einzige Anmeldezeile an
- [x] 5.6 RED: erneutes Erzeugen lässt einen bestehenden Termin mit Anmeldungen unangetastet
- [x] 5.7 RED: ein verschobener Termin kehrt bei erneuter Erzeugung **nicht** zurück (prüft `slot_datum`)
- [x] 5.8 RED: ein fremder Host kann aus meiner Vorlage nichts erzeugen
- [x] 5.9 Funktion als `SECURITY INVOKER`, **`on conflict (vorlage_id, slot_datum) do nothing` mit Ziel**, Obergrenze an der Kandidatenliste vor dem Einfügen
- [x] 5.10 `revoke`/`grant` sauber setzen — Default Privileges wirken auf Funktionen **nicht**

## 6. Serienänderung

- [x] 6.1 RED: Ortszeit 19→20 geändert, erneut erzeugt → zukünftige anmeldungsfreie Termine liegen auf 20:00, **kein** 19:00-Termin derselben Woche daneben
- [x] 6.2 RED: derselbe Vorgang lässt einen zukünftigen Termin **mit** Anmeldungen unverändert
- [x] 6.3 RED: derselbe Vorgang lässt vergangene Termine unverändert
- [x] 6.4 Aktualisierungslogik implementieren

## 7. Cover je Termin

- [x] 7.1 RED: vier erzeugte Termine tragen vier verschiedene Cover-Pfade, alle im `{uid}/`-Präfix, Namen **unvorhersagbar** (UUID)
- [x] 7.2 RED: Vorlage ohne Cover erzeugt Termine ohne Cover und scheitert nicht
- [x] 7.3 RED: Positivkontrolle, dass die Cover-Pfad-Eindeutigkeit weiterhin greift. **Dazu gehört die Zusage aus 5.9, die Gruppe 5 nicht belegen konnte:** ein zielloses `on conflict do nothing` liess dort alle 17 Zusagen grün, weil ohne Cover kein zweiter eindeutiger Index existiert. Hier muss es fallen.
- [x] 7.4 RED: fremdes Mitglied und `anon` erhalten das Cover einer **Vorlage** nicht; der eigene Host erhält es
- [x] 7.5 `event_cover_lesbar()` um den Host-Zweig aus D5a **erweitern** (kein `anon`-, kein `members`-Zweig)
- [x] 7.6 **Gegenprobe: `anon`- und `members`-Verhalten für Event-Cover ist unverändert** — das ist eine eigene Aufgabe, kein Nebensatz
- [~] 7.7 Kopieren im Client vor dem RPC-Aufruf (`storage.copy()` je Termin), RPC nimmt fertige Pfade entgegen — **Datenbankhälfte steht** (`p_cover_pfade text[]`, Längen-, Präfix- und Eindeutigkeitsprüfung, gemessen). Die Client-Hälfte hat heute keinen Aufrufer und gehört zu Gruppe 9; dort auch die UUID-Vergabe, die die RPC nicht zusagen kann.

## 8. Rundruf und Feed

- [x] 8.1 RED: eine Erzeugung von 52 Terminen löst **höchstens einen** Rundruf aus
- [x] 8.2 RED: dieselbe Erzeugung erzeugt 52 Feed-Beiträge
- [x] 8.3 RED: ein einzeln angelegtes Event löst wie bisher genau einen Rundruf aus (Positivkontrolle gegen eine zu breite Unterdrückung)
- [x] 8.4 Unterdrückung für `vorlage_id`-Termine plus einen Serien-Hinweis implementieren

## 9. Oberfläche

- [x] 9.1 Vorlagenliste und -formular als **vierter Reiter unter `/events`** — keine
      eigene Seite und kein Menüpunkt (Donald, 07.09.). Der Ort folgt zwei
      dokumentierten Vorgängern in `src/config/nav.ts`: AGE-442 legte „Meine
      Events" als dritten Reiter hierher, ausdrücklich mit „keine weitere
      Unterseite", und AGE-494 entfernte mehrere Menüpunkte, weil ein eigener
      Eintrag daneben „ein dritter Weg zum selben Ort" sei.
      `VorlageForm` ist bewusst ein **Zwilling** von `EventForm` und kein Umbau
      davon: ein Event hat einen Zeitpunkt, eine Vorlage eine Uhrzeit plus Regel
      und gar kein Datum. Wiederverwendet sind die Feld-Bausteine und der
      `EventCoverPicker` samt Cropper — es gibt keinen zweiten Zuschnitt.
- [x] 9.1a **Fund beim Bauen, mitbehoben:** bei null Events ersetzte der
      Leerzustand die ganze Reiterleiste (`EventsList.tsx`). Der neue Reiter
      wäre damit genau in dem Zustand unerreichbar gewesen, in dem man ihn
      braucht — erste Vorlage angelegt, noch kein Termin erzeugt. Angemeldet ist
      der Leerzustand jetzt der **Inhalt des ersten Reiters** statt dessen
      Ersatz; ausgeloggt bleibt alles wie bisher, dort gäbe es nur einen Reiter
      mit demselben Inhalt. Die Meldung selbst steht wortgleich weiter (AGE-494).
- [x] 9.2 Erzeugen-Dialog (`SerieErzeugen.tsx`) mit Startdatum, **Anzahl ODER
      Enddatum** und einer Vorschau vor dem Schreiben. Die Vorschau ruft
      `event_serie_slots()` — dieselbe Funktion, die danach schreibt; eine im
      Client nachgebaute Datumsrechnung wäre eine zweite Wahrheit, die
      spätestens an der nächsten Zeitumstellung auseinanderläuft. Das Enddatum
      wird als „bis zu 52 Termine, davon die bis zum Stichtag" aufgelöst, weil
      die Funktion kein „bis" kennt.
      **Erzeugen bleibt gesperrt, bis die Vorschau gesehen wurde**, und jede
      Änderung an den Eingaben verwirft sie wieder. Beides ist als Zusage
      geprüft und mit zwei Mutationen gegengeprobt (Wächter am Knopf entfernt →
      3 von 4 Zusagen fallen; Verwerfen entfernt → 1 fällt).
- [x] 9.2a **Client-Hälfte von 7.7 mitgeliefert.** `slotsMitCover()` sortiert
      die Termine ausdrücklich nach `slot_datum` und paart sie mit UUID-Pfaden;
      `serieErzeugen()` kopiert erst im Storage, dann schreibt die RPC. Ohne
      Titelbild geht `null` statt `[]` — ein leeres Array träfe auf die
      Anzahlprüfung und ergäbe 22023 für eine Vorlage, die schlicht kein Bild
      hat. Der Fehler, den die Sortierung verhindert, wäre leise: die Serie
      entstünde vollständig, jeder Termin trüge ein Bild, und es wäre das des
      falschen Datums.
- [x] 9.3 Serienzugehörigkeit am Event sichtbar: `vorlage_id` wandert durch
      `EVENT_COLUMNS` → `EventRow` → `EventListItem.vorlageId`, und die
      Detailkarte trägt „Teil einer Serie". Bei einem einzeln angelegten Event
      bleibt die Zeile **weg**, statt „Einzeltermin" zu sagen — `vorlage_id` ist
      bei jedem Bestandsevent null, die Zeile stünde damit unter allen.
      Ohne Rechteprüfung angezeigt, und das ist Absicht: dass `vorlage_id` für
      fremde Mitglieder lesbar ist, steht als hingenommenes Risiko in
      `design.md`. Die Anzeige nutzt es aus und schafft keine neue Fläche.
      Folgekosten, mitgetragen: fünf bestehende Fixtures brauchten das neue
      Feld.
- [x] 9.4 `src/lib/database.types.ts` **von Hand** nachgezogen — `events` um
      `vorlage_id`/`slot_datum` und den ZUSAMMENGESETZTEN Fremdschlüssel
      `(vorlage_id, host_id)`, dazu `event_vorlagen` und die zwei Funktionen.
      `supabase gen types` ist NICHT darübergelaufen (AGE-498).

## 10. Wächter und Abnahme

- [x] 10.1 `grants_test.sql` nachziehen — bricht bei jeder neuen Tabelle; bei **Funktionen** heißt Rot dagegen „der `revoke` fehlt", die Liste dort nicht blind nachziehen

      Die Tabellenzeile `event_vorlagen/authenticated=DELETE,INSERT,SELECT,UPDATE`
      stand schon aus Gruppe 1. Der Test war also **grün, bevor er etwas über
      diese Gruppe sagte** — und genau das war die Lücke: Abschnitt 6 zählt nur
      auf, was `anon` ausführen darf, und alle vier neuen Funktionen entziehen
      `anon` korrekt. Ein stehengebliebener `authenticated`-Grant wäre unsichtbar
      geblieben.

      Deshalb Abschnitt **8b** ergänzt (`plan(15)` → `plan(16)`): beide
      Client-Rollen, für die vier neuen Funktionen **und** für `hinweis_rundruf`.
      Letztere fasst AGE-630 nicht an — aber der Kopf von
      `20260907113000_event_serie_rundruf.sql` begründet den Anweisungs-Trigger
      ausdrücklich damit, dass der Rundruf „in Triggerland, nicht aufrufbar"
      bleibt. Bis jetzt war das ein Kommentar; jetzt ist es gemessen.

      Gemessen: `supabase test db supabase/tests/grants_test.sql` 16/16, Exit 0.
      **Positivkontrolle:** Erwartung auf `hinweis_rundruf: … auth=true`
      mutiert → Test 12 fällt (Exit 1), danach zurückgesetzt → wieder grün. Die
      Zusage liest den Katalog, nicht sich selbst.

- [x] 10.2 `pnpm typecheck`, `pnpm lint` und `pnpm test` grün, Exit-Code geprüft statt der Ausgabe

      `pnpm typecheck` Exit 0 · `pnpm lint` Exit 0 · `pnpm test` Exit 0,
      **231 Dateien / 2596 Zusagen**. Dazu die DB-Seite gegen den lokalen Stack:
      die sechs AGE-630-pgTAP-Dateien 75/75 (Exit 0) und `rls_test.sql` 440/440
      (Exit 0) — in Blöcken gefahren, siehe Handoff-Warnung zur Pfadlänge.
- [x] 10.3 Sichtprobe gegen den lokalen Stack: Vorlage anlegen, Termine erzeugen, an einem anmelden

      Durchgefahren am 07.09. gegen `http://localhost:5211` (`pnpm exec vite`,
      **nicht** `pnpm dev` — das schöbe Infisical und damit DEV davor).
      **Belegt, dass die App wirklich lokal hängt**, statt es anzunehmen:
      `performance.getEntriesByType('resource')` zeigt als einzige
      Backend-Herkunft `http://127.0.0.1:54321`, kein `*.supabase.co`.

      **Was die Sichtprobe gezeigt hat, das kein Test zeigt:**

      * Der vierte Reiter steht neben den drei anderen, und der **Leerzustand
        ist der Inhalt des ersten Reiters** — die Reiterleiste bleibt bei null
        Events sichtbar. Das ist der Fund aus Gruppe 9, hier im Bild.
      * `regelVollstaendig` greift sichtbar: „Wiederholung = Wöchentlich" blendet
        das Feld „Wochentag" ein, und „Vorlage anlegen" bleibt **gesperrt**, bis
        ein Wochentag gewählt ist.
      * **Die Vorschau-Sperre hält in beide Richtungen.** „Termine erzeugen" ist
        vor der Vorschau gesperrt; nach der Vorschau offen; und eine Änderung an
        der Anzahl (8 → 5) **verwirft die Vorschau und sperrt wieder**.
      * **Die Zeitumstellung, am gebauten Weg statt an der Funktion.** 8
        wöchentliche Termine ab 07.09.2026 enden am **27.10.2026**, also nach der
        Umstellung am 25.10. Gemessen in `events`:

        | slot_datum | starts_at (UTC) | Ortszeit |
        |---|---|---|
        | 2026-09-08 … 2026-10-20 | 16:30+00 | 18:30 |
        | **2026-10-27** | **17:30+00** | **18:30** |

        Der UTC-Abstand springt um eine Stunde, die Ortszeit steht still.
      * **Der Rundruf zählt richtig:** 8 Termine → **1** Zeile in `notifications`
        (`event_created`, `payload.serie_anzahl = 8`), nicht 8. Der
        Feed-Spiegel bleibt dagegen **8 Beiträge** — genau die Entscheidung aus
        `20260907113000`.
      * Die **Serienzeile** auf der Detailseite steht da („Serie: Teil einer
        Serie"), und die Anmeldung eines zweiten Kontos an einem erzeugten
        Termin landet in `event_registrations` (`status = registered`).
      * Konsole über beide Sitzungen hinweg: **0 Fehler, 0 Warnungen**.

      **Der Stack ist geteilt — die Sichtprobe ist restlos zurückgebaut.** Gesät
      waren 2 Konten, 1 Vorlage, 8 Termine, 8 Feed-Beiträge, 1 Hinweis, 1
      Anmeldung; nachgezählt danach: `vorlagen=0 serientermine=0
      probe_profile=0`. `.env.local` ist gelöscht und der vite-Prozess beendet
      — beides sonst eine Zeitbombe für die nächste Sitzung.
- [x] 10.4 Fremdreview des **Diffs** (zweite Stufe) — mit besonderem Augenmerk auf `event_cover_lesbar()`

      Zwei Arme über `reviewer-cli.sh <vendor> <prompt-datei>`, beide **APPROVE**:
      `gemini` (`Gemini Pro`, 3 Befunde) und `opencode` (`hf:moonshotai/Kimi-K3`,
      5 Befunde). Vollständig in `REVIEWS.md`, Abschnitt „Diff-Review — zweite
      Stufe".

      **Zur Kernfrage der Aufgabe kein Befund**, und zwar von beiden Armen mit
      Beleg: der neue Zweig von `event_cover_lesbar()` verlangt innerhalb
      desselben `exists` Pfadgleichheit, Präfixbindung, `is_activated()` UND
      `v.host_id = auth.uid()`; für `anon` ist `v.host_id = null` → NULL → zu.
      opencode hat zusätzlich `storage.foldername` gegen vier entartete Eingaben
      gemessen (`'ohne-slash'`, `''`, `'/fuehrend/x'`, `'a/b/c'`) — alle fallen
      **zu** — und den alten Zweig zeichengleich gegen `20260812100200` geprüft.

      **Drei Befunde behoben, drei bewusst offengelassen.** Der teuerste:

      * **`event_serie_slots()` hatte keine Obergrenze für `p_anzahl`** (MITTEL).
        Die 52 sitzt in `event_serie_erzeugen()`, aber `authenticated` ruft die
        Slot-Funktion direkt auf. Gemessen und nachgemessen: `p_anzahl = 100000`
        liefert **100000 Zeilen**. Kein Datenleck — sie liest keine Zeile —,
        sondern Verfügbarkeit: `return query` materialisiert, und die Datenbank
        teilen sich alle Mitglieder. Behoben in
        `20260907120000_event_serie_slots_obergrenze.sql`, Grenze **53 statt
        52**, weil der Enddatum-Pfad absichtlich mit 53 sondiert. RED gemessen
        (Test 15 rot vor der Migration), dann grün.
      * **Die Cover-Zuordnung war DB-seitig nicht festgezurrt** (NIEDRIG).
        Gegenprobe: mit `order by s.slot_datum desc` im RPC fällt **genau die
        neue** Zusage, die vier bestehenden bleiben grün.
      * **Fehlerzustand der Vorlagen-Abfrage** (NIEDRIG). `vorlagen.data ?? []`
        machte aus einem Fehlschlag „Du hast noch keine Vorlage". Gegenprobe:
        mit entferntem Zweig fällt die neue Zusage.

      Neue Abnahme nach den Änderungen: `pnpm test` **2597/2597**, `typecheck` 0,
      `lint` 0, DB-Seite 7 Dateien / 94 Zusagen plus `rls_test` 440 — alle Exit 0.

- [x] 10.5 `openspec validate --all` erneut grün
- [ ] 10.6 Change archivieren, danach `pnpm release:entries`
