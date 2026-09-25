## 1. Fremdreview vor der ersten Codezeile

- [x] 1.1 `openspec validate --all` grün
- [x] 1.2 `/openspec-change-review` mit ≥2 Fremdreviewern anderer Hersteller
      (gemini, codex — Claude ausgeschlossen); beide REQUEST-CHANGES
- [x] 1.3 Befunde eingearbeitet oder mit Begründung abgelehnt; `REVIEWS.md`
      geschrieben, Reviewer-Überschriften **blank** (ein Modellname in
      Klammern macht die Stimme für das Gate unzählbar)
- [x] 1.4 Signierten Trailer an `REVIEWS.md` angehängt (`digest` +
      `tasks-digest` mit den Funktionen aus `openspec-change-gate.sh`
      berechnet, genau EIN Trailer, nichts darunter)
- [x] 1.5 Erst danach die erste Codezeile

## 2. Vormessung festhalten

- [x] 2.1 Messskript `scripts/mess-905.ts` (nur lesend, Sitzung auf
      `default_transaction_read_only`, Ziel gegen
      `scripts/prod-project-ref.txt` geprüft) — zählt `release_notes`,
      `posts` je `kind`, `notifications` je `type`, `push_zustellungen`, und
      gibt die 23 Slugs einzeln aus
- [x] 2.2 Das Skript gibt **Differenzen** aus, nicht nur Stände. Die Rechnung
      steht als reine Logik in `scripts/mess-905.logic.ts` mit 11 Zusagen in
      `mess-905.logic.test.ts`, **jede mit Positivkontrolle** — darunter der
      teure Fall, in dem zwei Hinweis-Typen sich in der Summe aufheben und
      Ruhe vortäuschen, und der Fall, in dem die Kartenzahl stimmt, aber die
      Slugs getauscht sind. Beide werden erkannt
- [x] 2.3 Lokal gezählt, 25.09. 11:53 UTC, sofort protokolliert (der Stack ist
      geteilt): `release_notes` **0**, `posts` 22 (14 member / 8 event /
      **0 release**), `notifications` **47** in 5 Typen,
      `push_zustellungen` **0**, **0/23** Geschichten mit Karte.
      Aufnahme in `/tmp/905-lokal-vorher.json`. fbc-platform-61 hat den Stack
      um 10:2x freigegeben und schreibt dort nicht mehr
- [x] 2.4 PROD-Vormessung vom 25.09. festgehalten, mit `scripts/mess-905.ts`
      selbst gemessen (nicht mit einer Wegwerf-Sonde): `release_notes` **0**,
      `posts` 17 (10 member / 7 event / **0 release**), `notifications` 308
      in 7 Typen (**0 × `release_note`**), `push_zustellungen` **0**,
      **0/23** Geschichten mit Karte. Admins 2, aktivierte Profile 26.
      Aufnahme in `/tmp/905-prod-vorher.json`
- [x] 2.5 Positivkontrolle der Vergleichsstrecke: derselbe Lauf gegen die
      unveränderte Fläche mit `--erwarte=0` meldet fünfmal OK und
      „Abnahme erfuellt", Exit 0. Die Strecke ist damit an der echten
      Datenbank belegt und nicht nur im Test

## 3. Die Migration erzeugen

- [x] 3.1 Wegwerf-Schnipsel (nicht eingecheckt) liest
      `release-geschichten.ts` + `release-ausgaben.ts` und erzeugt den
      `values`-Block: Slug, Zeitstempel, Titel, Text — kein Zeichen von Hand
- [x] 3.2 Zeitstempel je Geschichte: `<ausgabe.datum> 09:00:00+02` minus dem
      Index in `ausgabe.geschichten[]` in Minuten; `+02` ausgeschrieben
- [x] 3.3 Der Schnipsel prüft vor der Ausgabe: 23 freigegebene Geschichten,
      jede in genau einer Ausgabe, kein Ausgabe-Slug ohne Geschichte, alle
      Zeitstempel paarweise verschieden und in der Vergangenheit
- [x] 3.4 Geprüft: **kein** Geschichtentext trägt eine URL oder einen
      Routenpfad (0 Treffer über alle 23 — `release-blog` verbietet Markup,
      ein klickbarer Link war nie möglich). `redirect-targets.test.ts` kann
      also gar nicht rot werden. **Aber:** eine Geschichte beschreibt in
      Prosa einen Weg, den AGE-907 entfernt hat — siehe 3.4a
- [x] 3.4a Halbsatz „und wo du zur Mitgliedschaft kommst" in
      `2026-08-25-event-anmeldeknopf-teilnahmeschwelle` gestrichen (Donald,
      25.09.). Der Link „Mitgliedschaft ansehen" ist mit `935b987` entfallen;
      `EventDetailPage` zeigt heute nur den Satz mit der Stufe.
      `release-geschichten.test.ts` und `release-flaechen.test.ts` grün
      (33 Zusagen)
- [ ] 3.4b Sichtprobe `/hilfe/tutorials`: der korrigierte Satz steht dort.
      **An Donald übergeben** (25.09.) — das chrome-devtools-Profil ist
      einplätzig und war von einer anderen Sitzung belegt; abschiessen wäre
      fremder Zustand gewesen. Rezept steht in der Übergabe
- [x] 3.4c Belegt, dass die Migration den **korrigierten** Text trägt:
      `grep -c "wo du zur Mitgliedschaft kommst"` auf der Migrationsdatei
      liefert **0**, und der Satz steht dort als „Daneben steht, warum: welche
      Stufe nötig ist." Der Erzeuger lief nach der Streichung
- [x] 3.5 Migration `supabase/migrations/<stempel>_release_backfill.sql`
      schreiben; Kopf trägt Befund, die Entscheidungen aus `design.md`
      (1, 2, 3, 4, 4a, 5, 5a, 5b), die Verworfenen und das Rückweg-Rezept
      (`delete` über die 23 Slugs, `on delete cascade` nimmt die Karten mit)
- [x] 3.6 Im Kopf ausdrücklich: die sechs Daten sind **redaktionelle
      Ausgabedaten**, keine Zustellzeitpunkte, und sie erscheinen an zwei
      Flächen als Datum (Feed und `/neues`)
- [x] 3.7 Schritt 1: Autor auflösen (`staff_roles` `role='admin'`,
      `order by profile_id limit 1`). **Beim Bauen korrigiert:** ein
      bedingungsloses `raise exception` hätte `main` rot gemacht — der CI-Job
      `migrations` fährt `supabase db reset` gegen eine frische Datenbank, es
      gibt kein `supabase/seed.sql`, und Seeds liefen ohnehin nach den
      Migrationen. Jetzt zwei Lagen: **0 Profile** → `notice` und
      überspringen (der CI-Fall); **Profile ohne Admin** → `raise exception`
      (der gefährliche Fall)
- [x] 3.7a Beide Grenzfälle **gefahren**, nicht behauptet, je in einer
      Transaktion mit `rollback`: `staff_roles` geleert bei 27 Profilen →
      Abbruch mit der Meldung; zusätzlich `profiles` geleert → Notice,
      `INSERT 0 0`, kein Fehler
- [x] 3.8 Schritt 2: **laut abbrechen**, wenn einer der 23 Slugs einem
      `draft` gehört, den diese Migration nicht angelegt hat — eine
      zugestellte Note zum selben Slug ist dagegen der Wiederholungsfall und
      wird schweigend übersprungen (Entscheidung 5a)
- [x] 3.9 Schritt 3: die fehlenden Notes als `draft` einfügen, mit
      `entry_slugs`, `created_by`, `sent_at` (zurückdatiert),
      `recipient_count = 0`; `returning id` festhalten
- [x] 3.10 Schritt 4: `update … set status = 'sent'` **nur auf den IDs aus
      3.9**, nicht auf einer Slug-Menge
- [x] 3.11 Schritt 5: `angekuendigt_am` auf genau den erzeugten `posts`-Zeilen
      setzen (Entscheidung 5b) — das zweite, unabhängige Bein gegen den
      Nachlauf
- [x] 3.12 `send_release_note()` wird **nicht** gerufen — im Kopf ausgesprochen
- [x] 3.13 Kein `create index concurrently` in der Datei (sonst bräche die
      Ein-Transaktions-Zusage aus Entscheidung 2)

## 3d. Lokal gefahren — die Belege

- [x] 3d.1 Erster Lauf: `INSERT 0 23`, `UPDATE 23`, `UPDATE 23`, alle sechs
      Selbstprüfungen still. Messung: `notifications` 47 → 47 (Δ 0),
      `push_zustellungen` 0 → 0 (Δ 0), `posts kind=release` 0 → 23, 23
      Geschichten mit neuer Karte, 0 verlorene. **Abnahme erfüllt**
- [x] 3d.2 Zweiter Lauf: `INSERT 0 0`, `UPDATE 0`, `UPDATE 0`; Messung mit
      `--erwarte=0` fünfmal OK
- [x] 3d.3 Daten und Ordnung nachgelesen: sechs Ausgaben vom 05.09. zurück
      zum 01.08., innerhalb jeder Ausgabe die Leseordnung aus
      `geschichten[]`, `created_at = veroeffentlicht_ab` bei allen 23,
      `angekuendigt_am` bei allen 23 gesetzt
- [x] 3d.4 Positivkontrolle Fremdentwurf: eine Note gelöscht, an ihrer Stelle
      ein fremder `draft` — die Migration bricht mit dem Slug im Klartext ab,
      der Entwurf bleibt Entwurf. In einer Transaktion, sauber zurückgerollt

## 4. `/neues` lädt nach

- [x] 4.1 `NeuesPage` lädt seitenweise nach (`fetchZugestellte` trägt
      `limit`/`offset` bereits); Knopf nur, solange es etwas nachzuladen gibt
- [x] 4.2 `?note=<id>` löst eine Note auf, die **nicht** auf der geladenen
      Seite steht — einzeln nachholen statt in der Liste suchen
- [x] 4.3 Eine unbekannte oder gelöschte Kennung öffnet weiterhin **nichts**
      (bestehende Zusage, hier als Positivkontrolle)
- [x] 4.4 Tests: 21. Note erreichbar, Tiefenlink darauf öffnet, kein Knopf am
      Ende der Liste, unbekannte Kennung öffnet nichts
- [x] 4.5 **Die Vorrichtung muss MEHR als eine Seite tragen — mindestens 21
      Notes.** Mit genau 20 (oder weniger) liefe der Test auch dann grün,
      wenn das Nachladen gar nicht existiert: die Liste käme nie über die
      erste Seite hinaus und bestätigte sich selbst. Genau diese Bauart hat
      den Mangel bis heute verdeckt — bei 0 Notes im Bestand war er
      unsichtbar. (Hinweis von fbc-platform-61, übernommen.) Die Zahl 21
      gehört als Begründung an den Test, nicht als nackte Konstante

## 5. Zusagen in pgTAP

- [x] 5.1 `supabase/tests/release_backfill_test.sql` anlegen
- [x] 5.2 Je Geschichte genau eine `release_notes`- und genau eine
      `posts`-Zeile mit `kind='release'`, `visibility='members'`, `body=''`
- [x] 5.3 `created_at` **und** `veroeffentlicht_ab` tragen den zurückdatierten
      Zeitpunkt, keiner den Zeitpunkt des Laufs
- [x] 5.4 Die Zeitstempel einer Ausgabe sind paarweise verschieden und fallen
      in der Ordnung von `geschichten[]`
- [x] 5.5 **0** neue Zeilen in `notifications`, **0** in `push_zustellungen`
- [x] 5.6 Der teure Wächter: `beitrag_ankuendigen()` nach dem Nachtrag laufen
      lassen — er wählt keine Release-Zeile und erzeugt 0 Hinweise
- [x] 5.7 `angekuendigt_am` ist auf allen nachgetragenen Zeilen gesetzt (das
      zweite Bein, unabhängig vom Art-Filter geprüft)
- [x] 5.8 Zweiter Lauf erzeugt 0 neue Zeilen in beiden Tabellen
- [x] 5.9 Ein fremder `draft` zu einem der Slugs lässt den Nachtrag abbrechen
      und bleibt ein Entwurf
- [x] 5.10 Ein Mitglied kann weiterhin keine `kind='release'`-Zeile schreiben
- [x] 5.11 Eine echte Zustellung über `send_release_note()` erzeugt danach
      weiterhin Karte **und** Hinweise
- [x] 5.12 Suite in die Dateiliste in `ci.yml` eintragen und
      `scripts/pgtap-dateiliste.test.ts` grün sehen

## 6. Mutationen als Positivkontrolle

- [x] 6.1 `release_feed_post_sync()` auf `now(), now()` verbogen → **3 Zusagen
      rot** (5, 6, 7 — beide Zeitspalten und die Staffelung). Zurückgenommen,
      `pg_get_functiondef` vorher/nachher per `diff` identisch
- [x] 6.2 Art-Filter in `beitrag_ankuendigen()` auf `p.kind is not null`
      verbogen → **2 Zusagen rot**, darunter die gemeinte (13:
      „holt KEINE Release-Karte nach"). Zurückgenommen, `diff` identisch.
      Dies ist der teure Wächter: dahinter stünden 598 Hinweise
- [x] 6.3/6.4 **Die zwei Riegel gegen den fremden Entwurf, einzeln und
      zusammen gemessen** — und das Ergebnis korrigiert die Erwartung:

      | Mutation | Ergebnis am fremden Entwurf | Ausgang |
      | --- | --- | --- |
      | nur Wächter (Schritt 2) entfernt | `UPDATE 0` — **unberührt** | Schritt 6 bricht ab: „keine zugestellte Note fuer …" |
      | nur `update` auf Slug-Menge gestellt | nie erreicht | Schritt 2 bricht ab und nennt den Slug |
      | **beide** entfernt | `UPDATE 1` — **zugestellt** | Schritt 6 bricht ab, aber nur zufällig |

      Jeder Riegel allein verhindert den Schaden; erst beide entfernt richten
      ihn an. Sie sind also nicht Gürtel und Hosenträger, sondern **zwei
      unabhängig tragende Riegel**.

      Der dritte Fall ist der lehrreiche: Schritt 6 fing ihn nur, weil ein von
      Hand angelegter Entwurf `sent_at IS NULL` trägt und die Karte deshalb
      `now()` bekam — die Datumsprüfung schlug an. Ein fremder Entwurf **mit**
      gesetztem `sent_at` wäre auch daran vorbeigekommen. Schritt 6 ist keine
      Ersatz-Sicherung für die beiden Riegel
- [x] 6.5 Das Nachladen in `NeuesPage` entfernen → 4.4 rot
- [x] 6.6 Jede Mutation zurückgenommen; die Rücknahme belegt (`diff` der
      Funktionsdefinitionen bzw. `git diff` der Migrationsdatei)

## 7. Lokal fahren und messen

- [x] 7.1 Migration lokal fahren; Zahlen vor/nach aus 2.3 gegenüberstellen
- [x] 7.2 Zweiten Lauf fahren, 0 neue Zeilen belegen
> **7.3 bis 7.6 sind an Donald übergeben** (25.09.). Das
> chrome-devtools-Profil trägt nur EINE Sitzung und war belegt; es
> abzuschiessen hätte fremden Browserzustand gekostet. Donald hat die
> Übergabe gewählt. Alles Maschinelle ist belegt — was fehlt, ist der
> Augenschein. Rezept und Aufräumhinweise stehen in `session-handoff.md`.

- [ ] 7.3 Sichtprobe der Aktivität, eigenes Konto: sechs Ausgaben in
      Datumsordnung, innerhalb einer Ausgabe in Leseordnung; Glocke und
      Ungelesen-Zähler unverändert
- [ ] 7.4 Sichtprobe `/neues`: alle 23 erreichbar, „Ältere laden" holt die
      letzten drei, Tiefenlink von der ältesten Karte öffnet ihre Mitteilung
- [ ] 7.5 Festhalten, wie weit man von oben scrollt, bis die erste
      Release-Karte kommt (der 58-%-Punkt aus `design.md`)
- [ ] 7.6 Ausgeloggt prüfen: keine Release-Karte im Schaufenster
- [x] 7.7 Fremde Konten nicht angefasst. `age907-sichtprobe@example.invalid`
      (fbc-platform-61) blieb unberührt und wurde **nicht** weggeräumt, obwohl
      61 das freigestellt hat — fremdes wegzuräumen ist nicht meine
      Entscheidung. Eigenes Konto: `age905-sichtprobe@example.invalid`,
      Stufe `connect`, aktiviert
- [x] 7.8 Eine **Adminzeile geliehen** für den lokalen Lauf: `staff_roles`
      war lokal leer, die Migration braucht einen Autor. Zeile auf das
      älteste Profil gesetzt. **Muss zurückgenommen werden** — steht in der
      Übergabe

## 8. Grün machen, archivieren, abliefern

- [ ] 8.1 `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`
      (**nicht** `pnpm format`)
- [ ] 8.2 Nach jedem `pnpm build` sofort
      `git checkout -- src/content/release-entries.generated.ts`
- [ ] 8.3 `openspec archive release-backfill` — **vor** dem Merge, damit die
      erzeugten Artefakte im geprüften PR stehen (Befund codex, HOCH; und
      die Hausregel „nie nach `wt merge`"). Bricht der Archivierer an einem
      `MODIFIED`, das ein Szenario fallen lässt, dann **REMOVED + ADDED**
      nehmen, nicht das Szenario mitschleppen
- [ ] 8.4 `pnpm release:entries` nach dem Archivieren
- [ ] 8.5 `openspec validate --all` erneut grün
- [ ] 8.6 Signierte Conventional Commits mit `(AGE-905)`
- [ ] 8.7 PR gegen `main`, CI grün, Merge-Erfolg **verifizieren**
      (`gh pr merge` kann still fehlschlagen)

## 9. PROD und Abnahme

- [ ] 9.1 PROD-Migration **nach** dem Merge von `main` aus fahren — vom
      Feature-Branch ist sie unmöglich
- [ ] 9.2 Messung **unmittelbar vor** dem Deploy (nicht die vom 25.09.)
- [ ] 9.3 Messung unmittelbar danach; geprüft wird die **Differenz**:
      `Δ notifications = 0`, `Δ push_zustellungen = 0`, genau 23 neue `posts`
      mit `kind='release'`, an ihren Slugs identifiziert
- [ ] 9.4 Zweiten Lauf gegen PROD belegen: 0 neue Zeilen
- [ ] 9.5 Sichtprobe auf PROD: Aktivität zeigt alle 23 in Datumsreihenfolge,
      `/neues` macht alle 23 erreichbar
- [ ] 9.6 Eine echte Zustellung bleibt möglich — an der Admin-Fläche
      nachweisen, ohne sie abzuschicken (Entwurf speichern, Knopf aktiv)

## 10. Abschluss

- [ ] 10.1 Linear AGE-905 auf Done, Abnahmehaken setzen
- [ ] 10.2 `session-handoff.md` schreiben (Scope: AGE-905, fremde Punkte
      bleiben draußen)
- [ ] 10.3 Neue Memories: der `angekuendigt_am`-Befund (ein Wächter stempelt
      nicht, der zweite trägt die Zusage allein); `/neues` lud eine Seite und
      löste Tiefenlinks nur daraus auf
- [ ] 10.4 Folgepunkte an Donald: `release_feed_post_sync()` stempelt
      `angekuendigt_am` für künftige echte Zustellungen weiterhin nicht, und
      die Release-Karte kürzt ihren Text nicht
