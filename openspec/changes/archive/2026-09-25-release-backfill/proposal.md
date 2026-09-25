# Release-Backfill: alle freigegebenen Geschichten in der Aktivität

Linear: AGE-905

## Why

Mit dem Wegfall von `www.effbeezee.com` verlieren die 23 kuratierten
Release-Geschichten ihre einzige **öffentliche** Fläche. Was hier entsteht, ist
ausdrücklich **keine** Wiederherstellung öffentlicher Verfügbarkeit: der
Nachtrag bringt die Geschichten für **aktivierte Mitglieder** zurück, hinter
Anmeldung und `visibility = 'members'`. Wer sie ohne Konto lesen konnte, kann
das danach nicht mehr. In der Aktivität steht
heute **keine einzige** von ihnen: gemessen am 25.09. lesend gegen PROD trägt
`release_notes` **0 Zeilen** — weder zugestellt noch als Entwurf — und `posts`
trägt 17 Zeilen, 10 `member` und 7 `event`, aber **0** `release`. Der
Mechanismus aus AGE-631/AGE-718 ist gebaut und nie benutzt worden.

Die Geschichten sind redigiert, freigegeben (alle 23 tragen
`freigegeben: true`) und seit AGE-904 als Tutorial in der Anwendung. Was fehlt,
ist die zeitliche Antwort: „was ist neu" beantwortet das Tutorial nicht.

## What Changes

- **Eine Migration mit Datensätzen** legt für jede der 23 freigegebenen
  Geschichten eine `release_notes`-Zeile an und setzt sie in einem zweiten
  Schritt auf `status = 'sent'`. Der bestehende Auslöser
  `trg_release_feed_post` erzeugt daraus die `posts`-Zeile mit
  `kind = 'release'` — es entsteht **kein zweiter Insert-Pfad** in den Feed.
- **`send_release_note()` wird NICHT gerufen.** Sie ist der einzige Schreiber
  von `notifications`-Zeilen des Typs `release_note`; der Backfill umgeht sie
  und schreibt damit 0 Hinweise, 0 Glocke, 0 Ungelesen-Zähler, 0 Push.
- **Das Datum ist das Ausgabe-Datum aus `release-ausgaben.ts`**, nicht das
  Datum des Archiveintrags. Innerhalb einer Ausgabe minutenweise gestaffelt
  entlang `ausgabe.geschichten[]` — das ist laut Typkommentar die Leseordnung,
  und der Feed ordnet über `(veroeffentlicht_ab desc, id desc)`, würde gleiche
  Zeitstempel also nach uuid sortieren.
- **Idempotenz über `release_notes.entry_slugs`.** Der Geschichte-Slug ist
  laut Typkommentar zeichengleich mit dem Slug des Archiveintrags, und
  `entry_slugs` ist die Spalte, die genau diese Zuordnung trägt. Ein zweiter
  Lauf findet die Zeile und legt nichts an.
- **Der Weg für neue Geschichten bleibt unverändert**: Admin-Fläche
  „Neuigkeiten" → Entwurf → `send_release_note()` → Glocke, Push und
  Feed-Karte. Der Backfill ist ein einmaliger Nachtrag, keine zweite Zustellart.

**Kein BREAKING Change.** Keine bestehende Zeile wird geändert, keine Spalte
entfernt, keine Funktion in ihrer Signatur berührt.

### Was der Backfill absichtlich NICHT tut

- **Keine Bilder.** `release_notes` trägt `title` und `body`, und die Feed-Karte
  rendert genau diese zwei. Die 23 Aufnahmen aus `public/tutorial/` erscheinen
  im Tutorial, nicht auf der Karte. Eine Bildspalte auf `release_notes` wäre
  eine neue Fähigkeit und gehört nicht in einen Nachtrag.
- **Keine Rückdatierung von `created_at` auf `release_notes`.** Nur `sent_at`
  wird zurückdatiert; das ist die Spalte, aus der der Auslöser beide
  Zeitspalten des Beitrags speist.

### Derselbe Text an zwei Stellen — beantwortet

Donalds Lesart trifft zu und wird hier übernommen: **die Aktivität beantwortet
„was ist neu", das Tutorial „wie geht das".** Beide Flächen dürfen denselben
Text tragen, weil sie verschiedene Fragen beantworten und zu verschiedenen
Zeitpunkten gelesen werden — die Karte einmal, beim Erscheinen; das Tutorial,
wenn jemand etwas sucht.

Daraus folgt eine Entscheidung, die sonst wie ein Versehen aussähe: die
Migration schreibt die Texte als SQL-Literale, also ein **zweites Mal** neben
`release-geschichten.ts`. Das ist richtig so. `release-blog` hält bereits fest:
„Eine spätere Textänderung ändert nichts Zugestelltes." Eine erschienene Karte
ist ein historischer Stand; wer morgen einen Tutorialtext redigiert, soll damit
nicht rückwirkend umschreiben, was die Mitglieder vor Wochen gelesen haben.

## Capabilities

### New Capabilities

Keine. Der Backfill trägt Daten in bestehende Fähigkeiten nach.

### Modified Capabilities

- `community-feed`: Die Anforderung „Release-Beiträge sind systemverwaltet"
  sagt heute, allein `send_release_note()` könne den Zustandswechsel schreiben.
  Das wird falsch: eine versionierte Migration schreibt ihn ebenfalls. Die
  Anforderung SHALL stattdessen sagen, dass **kein Client** ihn schreiben kann
  (die UPDATE-Policy erzwingt `status = 'draft'`) und dass ein
  Nachtrag-Zustandswechsel denselben Auslöser und damit denselben
  Eindeutigkeits-Riegel benutzt.
- `notifications`: **Zwei** neue Anforderungen. Die erste spricht aus, was der
  Backfill zusagt — ein nachgetragener Release-Beitrag erzeugt weder eine
  `notifications`-Zeile noch eine `push_zustellungen`-Zeile. Bewusst als neue
  Anforderung und nicht als Änderung der bestehenden „Eine Release-Note
  erreicht jedes aktivierte Mitglied": deren Szenarien gelten dem **Zustellen**
  und bleiben unberührt gültig. Die zweite hält fest, dass `/neues` seitenweise
  lädt und ein Tiefenlink auch eine Note ausserhalb der ersten Seite öffnet —
  die Fläche ist in dieser Fähigkeit spezifiziert.

## Impact

### Schema und Daten

- **Neu**: eine Migration unter `supabase/migrations/`. Sie legt 23 Zeilen in
  `release_notes` an und erzeugt über den bestehenden Auslöser 23 Zeilen in
  `posts`. Keine DDL außer dem, was der Nachtrag selbst braucht.
- **Unberührt**: `notifications` (308 Zeilen auf PROD, davon 0 vom Typ
  `release_note`), `push_zustellungen` (0 Zeilen auf PROD). Beide Zahlen sind
  die Abnahme.

### Gemessene Wirkung auf die Aktivität

Die Aktivität trägt auf PROD heute 17 Beiträge. Nach dem Backfill sind es 40,
davon 23 Release-Karten — **58 %**. Das ist eine bewusste Folge, keine
Überraschung: die sechs Ausgabe-Daten liegen zwischen dem 01.08. und dem 05.09.
und damit überwiegend **vor** den ältesten Bestandsbeiträgen (frühester
`member`-Beitrag: 17.08.). Die Karten sammeln sich also am unteren Ende des
Feeds und verdrängen im oberen Bereich nichts.

### Zwei Flächen bekommen die Nachträge mit — beides gewollt

- **`/neues`** listet zugestellte Release-Notes — heute aber nur die
  **jüngsten 20**: `NeuesPage` ruft `fetchZugestellte()` ohne Argumente
  (`limit = RELEASE_NOTES_SEITE = 20`) und hat kein Nachladen. Mit 23 Notes
  wären drei dort unerreichbar, **und** ihre Feed-Karte trüge einen Knopf
  „Alle Neuerungen", der nichts öffnet: die Seite löst `?note=<id>`
  ausschliesslich aus der geladenen Liste auf
  (`(notes.data ?? []).find(…)`). Drei tote Knöpfe, erzeugt von diesem
  Nachtrag. Befund des Fremdreviews (codex, HOCH), am Code nachgeprüft.

  **Deshalb gehört `/neues` in diesen Change** (Donald, 25.09.): die Fläche
  bekommt ein Nachladen, und ein Tiefenlink holt eine noch nicht geladene Note
  einzeln nach. `fetchZugestellte` kann `limit`/`offset` bereits — es ruft sie
  nur niemand.
- **Admin „Neuigkeiten"** liest `entry_slugs`, um zu erkennen, was noch nicht
  angekündigt wurde. Die 23 Archiveinträge wandern damit von „offen" nach
  „zugestellt". Das ist die Wahrheit: sie sind angekündigt.
  Drei der 23 Slugs stehen zugleich in `release_entry_skips` (44 Zeilen auf
  PROD) — `2026-08-25-activity-concept-level`,
  `2026-08-25-profil-biete-suche-und-radar`,
  `2026-08-25-stille-fehlschlaege-und-anfragen-weg`. `teileAuf()` prüft
  „zugestellt" **vor** „nicht relevant", diese drei erscheinen also als
  zugestellt und nicht doppelt. Kein Widerspruch in der Fläche, kein Eingriff
  nötig.

### Code

- `src/content/release-ausgaben.ts` bleibt **unverändert** — es ist die Quelle
  der sechs Ausgabe-Daten.
- `src/content/release-geschichten.ts`: **eine Zeile**, und sie ist eine
  Korrektur, keine Redaktion. `2026-08-25-event-anmeldeknopf-teilnahmeschwelle`
  sagte „Daneben steht, warum: welche Stufe nötig ist **und wo du zur
  Mitgliedschaft kommst**". Den Link „Mitgliedschaft ansehen" hat AGE-907 mit
  `935b987` entfernt; `EventDetailPage` zeigt heute nur noch den Satz mit der
  Stufe. Der Halbsatz ist gestrichen (Donald, 25.09.).

  Zwei Gründe, warum das hierher gehört und nicht in einen Folgepunkt: der
  Satz steht **seit AGE-904 live im Tutorial** und ist dort schon heute
  falsch — die Korrektur ist ohnehin fällig. Und der Nachtrag ist die
  **letzte Gelegenheit**: danach steht der Text in `release_notes`, wo ihn
  kein Wächter mehr erreicht, weil `redirect-targets.test.ts` seine
  Routenliste aus `App.tsx` ableitet und keine Datenbankinhalte sieht.
  `release-geschichten.ts` sagt dazu in seinem eigenen Kopf: „Wo Archiv und
  Anwendung auseinanderlaufen, gilt die Anwendung."

  Geprüft wurde die ganze Menge, nicht nur dieser Fall: **kein** Text der 23
  trägt eine URL oder einen Routenpfad (0 Treffer), und von den sieben
  Kaufweg-Einstiegen, die AGE-907 entfernt hat, beschreibt genau dieser eine
  Satz einen davon.
- Die Feed-Karte bleibt unverändert. Sie rendert `kind = 'release'` seit
  AGE-718.
- **`src/pages/NeuesPage.tsx` und `src/lib/release-notes.ts`**: Nachladen und
  Tiefenlink-Auflösung. Der einzige Frontend-Anteil, und er entstammt einem
  Reviewbefund, nicht dem ursprünglichen Auftrag.

### Risiken

- **`posts.author_id` ist `not null`**, und der Auslöser legt **gar keinen
  Beitrag** an, wenn `created_by` leer ist (`if v_author is null then return
  null`). Eine Migration, die `created_by` nicht portabel auflöst, erzeugte 23
  Notes ohne eine einzige Karte — **still**. Die Auflösung muss laut scheitern,
  wenn sie niemanden findet. PROD trägt 2 aktive Admins; DEV und lokal sind
  eigene Bestände.
- **Ein einziger Wächter trennt 0 von 598 Hinweisen.**
  `hinweis_neuer_beitrag()` verlässt sich für `kind <> 'member'` sofort — aber
  es stempelt dabei `angekuendigt_am` **nicht**, das bleibt bei
  Release-Zeilen NULL. Dass daraus kein Nachlauf entsteht, hält allein der
  Filter `p.kind = 'member'` in `beitrag_ankuendigen()`. Fiele der weg, holte
  der Lauf 23 Karten × 26 aktivierte Profile = 598 Hinweise nach. Beide
  Rümpfe sind am 25.09. aus dem PROD-Katalog gelesen, nicht aus Kommentaren
  geschlossen; der Filter gehört in pgTAP festgenagelt.
