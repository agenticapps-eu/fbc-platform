# Tasks — Beitragstyp mehrfach wählbar (AGE-590)

RED vor GREEN: jede Zusage über **neues** Verhalten wird rot laufend gesehen,
nicht angenommen.

**Was NICHT rot sein kann, und warum das kein Versäumnis ist** (codex): der
heutige Code kennt keine `typen`-Eigenschaft, ein Test dagegen scheitert also am
Übersetzer statt an der Aussage. Und zwei der neuen Zusagen — „ein Beitrag steht
nur einmal darin" und „leere Menge heißt alle" — sind schon heute wahr. Sie sind
Regressionsschutz, kein RED. Zuerst wird deshalb die Schnittstelle auf
`typen: FeedTyp[]` umgestellt (Aufgabe 0), damit die Zusagen überhaupt laufen
können; erst danach ist ein rotes Ergebnis eine Aussage über Verhalten.

Jede Mengenzusage prüft die **exakte ID-Menge**, nie nur „enthält". Ein Test, der
bloß auf Enthaltensein prüft, bleibt grün, wenn der Filter komplett ignoriert
wird.

## 0. Die Schnittstelle, damit die Zusagen laufen können

- [x] 0.1 `FetchFeedArgs.typ?: FeedTyp | null` → `typen?: FeedTyp[]` und
      `FeedAuswahl.typ` → `typen: FeedTyp[]`, Aufrufer mitziehen. Noch **ohne**
      neue Filterlogik: die vier `if`-Zweige greifen vorerst auf `typen[0]` zu.
      Danach übersetzt alles, und ab hier ist Rot eine Aussage.

## 1. Zusagen an die Abfrage (RED)

- [x] 1.1 In `feed.auswahl.integration.test.ts` Sondendaten je Typ anlegen: ein
      Beitrag mit Video, einer mit `post_media`-Zeile, einer mit **beidem**,
      einer ohne alles. `video_url` wird vom Trigger `posts_video_url_setzen`
      aus dem Body abgeleitet — die URL muss also **im Body** stehen, ein
      direktes `insert` der Spalte wird überschrieben.
- [x] 1.2 Zusage „zwei Typen zeigen die Vereinigung": `[video, bild]` liefert
      Video- und Bild-Beiträge. Läuft ROT gegen die heutige Fassung, weil die
      angehängten Filter mit UND verknüpft werden.
- [x] 1.3 Zusage „ein Beitrag steht genau einmal darin": der Beitrag mit Video
      *und* Bild erscheint bei `[video, bild]` **einmal**.
- [x] 1.4 Zusage „`text` bleibt die Abwesenheit der anderen": `[text, event]`
      liefert keine bebilderten Beiträge.
- [x] 1.5 Zusage „leere Menge heißt alle": `[]` liefert dieselbe Menge wie ohne
      Typfilter.
- [x] 1.6 Zusage „der Filter überlebt das Blättern": bei zwei Typen trägt auch
      die zweite Seite nur diese Typen — der bestehende Keyset-Cursor-Aufbau
      dieser Datei wird dafür wiederverwendet, nicht nachgebaut.
- [x] 1.7 Zusage „ohne Sitzung gilt der Filter auch": ausgeloggt zwei Typen
      wählen, exakte ID-Menge unter den öffentlich sichtbaren Beiträgen prüfen.
      Die Datei meldet sich für diesen Zweck schon an anderer Stelle ab.
- [x] 1.8 **Den Mock in `feed.auswahl.test.ts` auf ein `or`-Array umstellen.**
      Er speichert heute `or?: string` und überschriebe damit den ersten von zwei
      Aufrufen (codex). Ohne diesen Schritt prüft 1.9 still den falschen Aufruf.
- [x] 1.9 Form zusagen: auf **Seite 1** genau eine `or`-Gruppe mit je einem
      Teilausdruck pro gewähltem Typ; auf **Seite 2** genau zwei Gruppen —
      Typvereinigung *und* Cursorgrenze; bei leerer Menge **keine** Typgruppe.
      Nicht „genau ein `or()`": der Cursor benutzt `or()` bereits
      (`src/lib/feed.ts:659`).
- [x] 1.10 Die Zusagen aus 1.2, 1.4 und 1.6 rot laufen sehen und die Ausgabe
      lesen. 1.3 und 1.5 sind Regressionsschutz und dürfen grün starten — das
      ausdrücklich festhalten, statt es zu übersehen.

## 2. Die Abfrage (GREEN)

- [x] 2.1 `FetchFeedArgs.typ?: FeedTyp | null` → `typen?: FeedTyp[]`.
- [x] 2.2 Die Teilausdrücke je Typ als **eine** Tabelle im Modul, je Typ genau
      einmal — `video`, `event`, `bild` als Skalarausdruck, `text` als
      `and(video_url.is.null,kind.neq.event,post_media.is.null)`. Kommentar an
      Ort und Stelle: `text` ist die Verneinung der drei anderen und ist
      mitzuändern, wenn ein fünfter Typ dazukommt.
- [x] 2.3 Die vier `if`-Zweige in `fetchFeed` durch **einen** `query.or(...)`
      ersetzen, der nur bei nicht-leerer Menge gesetzt wird.
- [x] 2.4 Kommentar an `query.or(...)`: der Cursor setzt weiter unten ein
      **zweites** `or=`, und PostgREST verknüpft wiederholte `or=`-Parameter mit
      UND — gemessen auf DEV, festgeschrieben in Zusage 1.9. Wer die beiden
      Gruppen zu einer zusammenzieht, macht aus dem UND ein ODER.
- [x] 2.5 Abschnitt 1 grün laufen sehen.

## 3. Der Cache-Schlüssel

- [x] 3.1 Zusage (RED): dieselben zwei Typen in umgekehrter Reihenfolge ergeben
      denselben `feedSeitenKey`; zwei **verschiedene** Mengen ergeben
      verschiedene Schlüssel.
- [x] 3.2 `FeedAuswahl.typ` → `typen: FeedTyp[]`; `normalisierteTypen` neben
      `normalisierteTags`, auf den **Bezeichnern** sortierend, nie auf den
      Beschriftungen.
- [x] 3.3 Zusage (RED): eine Menge mit **Dubletten** ergibt denselben Schlüssel
      wie ohne — die Deduplizierung war zugesagt, aber ungeprüft (codex).
- [x] 3.4 Zusage (RED): **alle vier** Typen ergeben denselben Schlüssel wie die
      leere Menge, und `normalisierteTypen` bildet die volle Menge auf `[]` ab.
      Die Abbildung sitzt in der Kanonisierung, **nicht** im Zustand der
      Oberfläche — vier Haken bleiben sichtbar vier Haken.
- [x] 3.5 `feedSeitenKey` trägt die kanonisierte Menge. Grün laufen sehen.

## 4. Die Oberfläche

- [x] 4.1 Zusage (RED): vier Kästchen mit `type="checkbox"`, **kein** Eintrag
      „Alle Typen", und ein Klick auf ein zweites Kästchen lässt das erste
      angehakt. Die Zusage prüft den **Zustand der Kästchen**, nicht nur die
      Beschriftung.
- [x] 4.2 `TYPEN` verliert den `""`-Eintrag und wird `{ value: FeedTyp; label }[]`.
- [x] 4.3 `useState<FeedTyp | null>(null)` → `useState<FeedTyp[]>([])`, das
      `<Select>` in der Seitenleiste durch die Kästchen ersetzen — dieselbe Form
      wie die Tag-Kästchen daneben, damit nebeneinander nicht zwei Bedienlogiken
      stehen.
- [x] 4.4 Chip-Leiste: ein Chip je gewähltem Typ, jeder einzeln abwählbar;
      `gefiltert` auf `typen.length > 0` umstellen.
- [x] 4.5 Zusage (RED): ein zweiter Klick auf ein Kästchen nimmt **genau einen**
      Typ zurück und lässt den anderen angehakt; das Banner nennt **jeden**
      gewählten Typ (codex, angepasst — die Chips sind Anzeige, nicht
      Bedienelement, siehe Design Entscheidung 4).
- [x] 4.6 Die bestehenden Zusagen zu **beiden** „Filter entfernen"-Wegen auf
      `typen` umstellen — sie stehen heute auf dem Einzelwert `typ` und würden
      sonst still am alten Begriff hängenbleiben.
- [x] 4.7 Die Kästchen umbrechen lassen (`flex-wrap`) statt auf eine Breite zu
      setzen (gemini): längere Beschriftungen und ein künftiger fünfter Typ
      dürfen die Spalte nicht sprengen.
- [x] 4.8 Prüfen, dass kein `typ`-Bezeichner verwaist zurückbleibt (`grep`), und
      dass die Academy (`nurVideos`) unberührt ist.

## 5. Sichtprobe und Abschluss

- [x] 5.1 **Im Browser** ansehen, nicht nur in jsdom: zwei Typen anhaken und
      zusehen, dass die Liste die Vereinigung zeigt und beide Chips stehen.
      Grüne Tests haben in diesem Repo schon ein visuell falsches Ergebnis
      durchgewunken.
- [x] 5.2 Bei 375 px prüfen, dass die vier Kästchen nicht überlaufen — am
      **Inhaltsbedarf** messen, nicht an `scrollWidth`.
- [x] 5.2b **Abfrageplan für den schlimmsten Fall aufgenommen** (gemini): drei
      Typen plus Cursorgruppe, auf DEV. Ergebnis: die Typvereinigung landet im
      `Filter`, nicht als eigener Scan; die `post_media`-Existenzprüfung löst
      als **Index Only Scan** auf `post_media_post_id_sort_key` auf (SubPlan,
      kein Seq-Scan); die Cursorgruppe treibt weiter einen `BitmapOr` über
      `posts_created_at_id_idx`. **Der Typfilter verdrängt die Indexnutzung des
      Cursors also nicht.** EINSCHRÄNKUNG, die dazugehört: DEV trägt 29 Beiträge
      und 6 Medienzeilen — die Laufzeiten (0,15 ms) sagen bei dieser Menge
      nichts über das Verhalten im Bestand aus. Belegt ist die FORM des Plans,
      nicht sein Preis unter Last.
- [x] 5.3 `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm format:check`,
      `pnpm build` — Ausgaben lesen, nicht behaupten.
- [x] 5.4 Gegenprobe: eine Verbiegung je neuer Zusage (etwa `or` durch
      aneinandergehängte Filter ersetzen) muss die zugehörige Zusage rot machen.
      Wo eine Verbiegung grün bleibt, fehlt ein Test. Vorher committen — das
      Messwerkzeug verwirft ungesicherte Änderungen.
- [ ] 5.5 **Diff**-Review durch zwei fremde Vendoren — Schritt 4 der Schleife,
      auf dem Diff, nicht auf dem Plan. Der Plan-Review ist bereits gelaufen und
      steht in `REVIEWS.md`; die Diff-Befunde kommen als eigener Abschnitt dazu
      und ersetzen ihn nicht (codex).
- [ ] 5.6 `openspec validate --all` grün, dann archivieren und PR.
