## 1. Icon-Satz und Bereichs-Kanon

- [x] 1.1 Den Icon-Satz anlegen: `Name → Pfade`, ein Stil (24er-Viewbox,
      `currentColor`, gleiche Strichstärke und Endenform), ohne Icon-Bibliothek
      — `src/components/ui/icons.tsx`, 28 Glyphen. Die Vorlagen trugen 1.6, 1.75,
      1.8 und 2.0; vereinheitlicht auf **1.6** (sichtbare, gewollte Änderung an
      Chevron, Fanfare und Lupe)
- [x] 1.2 Die elf Menü-Glyphen aus `NavIcon.tsx` in den Satz überführen; `NavIcon`
      bleibt als Bauteil bestehen und bezieht sie von dort (gefüllte Fassung
      inbegriffen) — die Datei schrumpft von 186 auf 43 Zeilen und ist nur noch
      die Zuordnung Route → Glyph. Der Rückfall-Punkt wurde als Glyph `dot`
      mitgenommen; der Test hatte ihn sonst zu Recht als Fremdkörper gemeldet
- [x] 1.3 Die neun Streu-Glyphen auflösen: `ChevronLeftIcon`, `BellIcon`,
      `MenuIcon`, `ChevronDownIcon` (`AppShell.tsx`), `FeedbackIcon`, `SearchIcon`,
      `HeartIcon`, `CalendarIcon`, `CommentIcon`
- [x] 1.4 Den doppelten `CrownIcon` auflösen — er steht byte-gleich in
      `mein-bereich/building-blocks.tsx` und `profile/ProfileHero.tsx`. Beide
      beziehen ihn jetzt aus dem Satz; `building-blocks` behält den Export, weil
      `profil-widgets.tsx` ihn importiert
- [x] 1.5 `matching/CategoryIcon.tsx` in den Satz überführen; das Bauteil bleibt,
      sein eigener `Record` entfällt
- [x] 1.6 **Die Ausnahmen namentlich festlegen** und begründen — sie stehen mit
      Grund in `icons.test.ts` (`AUSNAHMEN`). Gemessen: SVGs lagen in **14**
      Dateien außerhalb `src/vision`, nicht in neun. Donalds Wahl vom 24.08.:
      **sieben** Ausnahmen. Drei sind echte Nicht-Glyphen (`CompassMark` als
      Markenmarke, `profil-widgets` als Datenvektor `200x48`, `Avatar` als
      Platzhalter); vier sind **vertagt** und tragen sehr wohl Glyphen — siehe
      1.15
- [x] 1.7 Den erzwingenden Test bauen — **ein Mechanismus, keine Absicht**: er
      läuft gegen den Quellbaum, führt die Ausnahmen aus 1.6 als benannte Liste und
      fällt, sobald ein neuer Glyph außerhalb des Satzes entsteht.
      `src/components/ui/icons.test.ts`, 9 Zusagen. Er trägt **zwei** Prüfungen,
      nicht eine: die zweite meldet eine Ausnahme, die ihr `<svg>` verloren hat —
      ohne sie deckt ein toter Listeneintrag ab da jeden künftigen Glyph in
      derselben Datei (so ist `redirect-targets.test.ts` einmal blind geworden)
- [x] 1.8 Gegenprobe: einen Glyph versuchsweise wieder in eine Feature-Datei legen
      und belegen, dass der Test rot wird (sonst prüft er nichts). **Zweimal
      gemessen**: (a) ein erfundener `SchmuggelIcon` in `FeedbackButton.tsx` →
      rot, Datei namentlich gemeldet; (b) das `<svg>` aus der Ausnahme
      `Avatar.tsx` entfernt → rot in der zweiten Prüfung. Danach beide Dateien aus
      einer Kopie zurückgespielt (nicht `git checkout`/`stash`), Suite wieder grün
- [x] 1.9 Bereichsfarben als Tokens in `src/index.css` — **einmal** definiert, im
      Inhaltsschicht-Block. **Nicht** je Theme: der navy-Block überschreibt
      absichtlich nur Chrome. Sieben `--color-bereich-*`, EINE Familie
      (Violett→Magenta) statt sieben Töne — siehe die Messung in 1.10 und den
      Kopfkommentar im Token-Block. Ein Test hält den navy-Block frei davon
- [x] 1.10 Kontrast der sieben Farben gegen `--color-canvas` **messen** und die Zahl
      festhalten; „erkennbar" ist nicht abnehmbar. **Gemessen** und im Token-Block
      festgehalten: alle sieben zwischen **5.70:1** und **10.95:1** gegen
      `--color-canvas`, zwischen **5.36:1** und **10.30:1** gegen `--color-soft`.
      Ziel war 4.5:1 gegen beide (strenger als die 3:1 aus WCAG 1.4.11 für
      Nicht-Text, weil die Marke neben ihrer Beschriftung steht). Kleinster
      Abstand zwischen zwei Bereichen: **ΔE 10.5**.
      **Der Befund, der den Entwurf gedreht hat:** Akzent-Blau (Ton 218),
      `success` (161), `warning` (36) und `danger` (0) belegen vier der sechs
      unterscheidbaren Farbregionen. Sieben eigene Töne kollidierten alle — der
      naheliegende Kandidat für „Highlights" lag auf **0°** von `danger`, also
      exakt auf der Fehlerfarbe. Donalds Entscheidung vom 24.08.: eine Familie
- [x] 1.11 Den Kanon `Bereich → { icon, farbToken }` als **eine** Modulkonstante
      anlegen; Bedien-Symbole stehen ausdrücklich nicht darin — `src/config/bereiche.ts`.
      Zwei Glyphen kamen dafür in den Satz: `mail` (die Sprechblase gehört schon
      der Aktivität) und `sparkle` (Stern und Krone bezeichnen eine
      Mitgliedsstufe, keinen Bereich)
- [x] 1.12 Test: kein Bereichs-Token erscheint an einem Link, Knopf, Fokusring oder
      aktiven Zustand — die Abgrenzung zum interaktiven Akzent ist der Grund, aus
      dem die bestehende Anforderung geändert werden durfte.
      `src/config/bereiche.test.ts`, 12 Zusagen. Der Test prüft die **Form** der
      Klasse (`^(text|bg)-bereich-[a-z]+$`) statt eine Liste verbotener Präfixe —
      eine Liste deckt nur ab, woran jemand gedacht hat. Dazu: der Name einer
      Bereichsfarbe darf nur im Token-Block und im Kanon stehen, sonst sucht sich
      eine Fläche die Farbe selbst.
      **Drei Gegenproben gefahren** (der Test war sonst trivial grün, weil noch
      nichts die Tokens nutzte): eine Fläche wählt selbst → rot; der Kanon bekommt
      `hover:` → rot; ein Token im navy-Block → rot. Je aus einer Kopie zurück
- [x] 1.13 Kanon auf die bestehenden Karten anwenden: Dashboard, Events,
      Mitgliederverzeichnis, Aktivität. **Dashboard**: `DashTile` („Mein
      Kompass", „Nächstes Event") und `SectionHeader` („Neu in der Aktivität",
      „Neue Mitglieder für dich"). „Mitgliedschaft" bekommt bewusst **keine**:
      eine Mitgliedsstufe ist kein Bereich. **Ein-Bereichs-Seiten**: nur die
      Seitenüberschrift — siehe 1.17. Beides im Browser gesehen
- [x] 1.14 Sichtprobe im Browser gegen den lokalen Stack. **Gemacht** (helles
      Theme, breit): alle elf Menü-Glyphen, die gefüllte Fassung im aktiven
      Eintrag, Glocke, beide Chevrons, Lupe, Fanfare, die vier Bereichsmarken auf
      dem Dashboard und zwei Seitenköpfe — Konsole ohne Fehler.
      **Nicht geprüft, und das ist abgenommen** (Donald, 24.08.: „alles gut
      egal"): dunkles Theme, 375 px (die Fenstermindestbreite von macOS
      verhindert die Messung über dieses Werkzeug) sowie alles, was Daten
      braucht — Herz, Kommentarzahl, Krone, die zwei zusammengeführten
      Kategorien. DEV trägt weder Beiträge noch Angebote
- [x] 1.15 **Vertagt am 24.08. (Donalds Wahl), namentlich festgehalten** — vier
      Ausnahmen tragen wiederverwendbare Glyphen und lösen sich später auf:
      `EventDetailPage.DETAIL_ICONS` (ein zweiter Satz aus vier Glyphen; `kalender`
      steht damit weiter **dreimal** im Baum), das Drei-Punkte-Symbol in
      `AdminMitgliederPage.tsx`, der Leerzustands-Glyph in `MeineChancenPage.tsx`
      und `CheckIcon` in `building-blocks.tsx`. Grund für die Vertagung: den Diff
      vor dem Go-Live klein halten. Zur Kenntnis genommen (Donald, 24.08.)
- [x] 1.17 **Entschieden (Donald, 24.08.): nur die Seitenüberschrift.** Auf einer
      Ein-Bereichs-Seite trägt jede Karte denselben Bereich; eine Marke auf allen
      wiederholte dieselbe Auskunft pro Zeile, statt zu unterscheiden. Umgesetzt
      in `FormatHero` für die **fünf** Kopf-Routen, die im Kanon stehen —
      `/kompass`, `/events`, `/mitglieder`, `/aktivitaet`, `/kontakte`. Nicht für
      `/academy`, `/mitgliedschaft` und `/meine-chancen`: die sind keine
      Gegenstandsbereiche. Alle fünf statt nur der drei aus 1.13, weil eine
      Teilmenge willkürlich wäre
- [x] 1.16 **Vier Motive wurden zusammengeführt**, weil sie sonst am ersten Tag
      doppelt *im Satz* stünden: `calendar` (Menü + Beitrag), `comment` (Menü
      „Aktivität" + Kommentarzahl), `academy` (Menü + Kategorie `mentor`),
      `members` (Menü + Kategorie `users`). Jeweils die Menü-Zeichnung behalten,
      weil nur sie eine gefüllte Fassung hat.
      Gegengelesen, soweit sichtbar: alle vier stehen in der Menüleiste und im
      Seitenkopf und sitzen dort richtig. Ihre **zweiten** Auftritte — Kalender
      und Kommentarzahl am Beitrag, die zwei Kategorien — brauchen Daten und
      fallen unter dieselbe Abnahme wie 1.14 (Donald, 24.08.)

## 2. Speichern — `post_saves`

- [x] 2.1 Migration: Tabelle `post_saves (profile_id, post_id, created_at)`,
      Primärschlüssel über beide, `on delete cascade` auf beiden Fremdschlüsseln,
      RLS an, Kopfkommentar mit Begründung und verworfener Alternative —
      `20260824130000_post_saves.sql`. Dazugekommen gegenüber dem Plan: ein Index
      auf `post_id`. Nicht fürs Lesen (dafür führt der Schlüssel), sondern fürs
      kaskadierende Löschen eines Beitrags — der Schlüssel beginnt mit der
      falschen Spalte
- [x] 2.2 Policies für SELECT, INSERT und DELETE: nur eigene Zeilen **und**
      `is_activated()` — wie `posts_write_own`, `likes_write_own` und
      `post_media_insert_own` es alle tragen. **Drei Policies statt eines
      `for all`** wie bei `likes_write_own`: `for all` schlösse UPDATE ein, und
      an einer Speicherung gibt es nichts zu ändern. Das Grant allein trüge die
      Aussage nicht — bis AGE-312 kam der Ist-Zustand aus Supabases
      `alter default privileges`, also steht sie zweimal
- [x] 2.3 Grants aussprechen (`select, insert, delete` für `authenticated`, nichts
      für `anon`) — neue Tabellen erben hier nichts. Gemessen: `service_role`
      hält auf `post_saves` genau `REFERENCES,TRIGGER,TRUNCATE`, byte-gleich mit
      `posts`, `post_likes` und `post_media` — kein Sonderfall entstanden
- [x] 2.4 `grants_test.sql` §1: Golden-String um die `post_saves`-Zeile ergänzt
      (Position 28, zwischen `post_media/authenticated` und `posts/anon`), samt
      Absatz, der sagt, was NICHT darauf steht: kein UPDATE, kein `anon`
- [x] 2.5 pgTAP: fremde Zeile weder lesbar noch löschbar; zweimal speichern ergibt
      genau eine Zeile — `supabase/tests/post_saves_test.sql`, 24 Zusagen. Die
      Lesezusage lautet auf die **Zahl** der sichtbaren Zeilen bei einer fremden
      Zeile im Bestand, und der fremde Leser ist der **Autor** des Beitrags: wenn
      irgendwer sie sehen dürfte, dann er. Die Löschzusage lautet auf den
      überlebenden Bestand, nicht auf einen Fehlercode — ein von der RLS
      abgewiesenes DELETE ergibt null Zeilen und meldet `OK`
- [x] 2.6 pgTAP: ein unbestätigtes **und** ein deaktiviertes Konto kommen an
      `post_saves` nicht heran — weder lesend noch schreibend. Für beide liegt
      eine **eigene** Zeile im Bestand, die ein Superuser angelegt hat; ohne sie
      prüfte „liest nichts" nur eine leere Tabelle
- [x] 2.7 `supabase test db` mit ausdrücklicher Dateiliste laufen lassen (ohne
      Liste meldet der Befehl FAIL, obwohl grün) — **7 Dateien, 630 Zusagen,
      PASS**
- [x] 2.8 **Nicht im Plan, aber ohne sie läuft der Test nie:** die neue Datei in
      die `supabase test db`-Zeile von `ci.yml` eintragen. Genau dieser Schritt
      fehlte am 23.08. für die beiden `member_lifecycle`-Dateien — sie standen
      als vollwertiges pgTAP im Repo und liefen kein einziges Mal in CI
- [x] 2.9 Gegenproben am lebenden Katalog (`cp`/`alter policy`, kein
      `git checkout`), jede einzeln zurückgenommen:
      **(a)** `is_activated()` aus allen drei Policies entfernt → genau die
      sechs Zusagen aus 2.6 fallen, unbestätigt **und** deaktiviert;
      **(b)** SELECT-Policy auf `true` → die vier Lesezusagen fallen, darunter
      „auch der Autor sieht nur seine eigene Zeile";
      **(c)** eine UPDATE-Policy dazugelegt → die Policy-Liste fällt.
      Vorher stand der ganze Lauf rot (22/22, Tabelle fehlte)

## 3. Beliebtheitszähler und Rechte auf den Quelltabellen

- [x] 3.1 Vorher messen: Zahl der `posts`- und `post_likes`-Zeilen auf PROD lesen,
      damit der Nachtrag eine gemessene und keine geschätzte Größe hat.
      **PROD: 4 Beiträge, 0 Reaktionen** — der Nachtrag setzt dort vier Zeilen
      auf 0 und braucht keine Stapelung. **DEV: 29 Beiträge, 88 Reaktionen**,
      18 Beiträge mit mindestens einer, höchste Zahl an einem Beitrag 8. Beide
      nur lesend (`default_transaction_read_only`), Kennung gegen
      `*-project-ref.txt` geprüft
- [x] 3.2 **Zuerst die Quelle dichtmachen:** pgTAP, das den Angriffsablauf
      nachstellt — `supabase/tests/feed_popularity_test.sql` §1, 5 Zusagen. Der
      Test war **rot** (4 von 5), solange das UPDATE-Recht bestand; der Diff las
      sich als `have: …-000b` — die Reaktionszeile war gewandert.
      **Am Design korrigiert:** der Angriff trifft NICHT „einen Beitrag, den der
      Angreifer nicht einmal sehen muss". Der `exists`-Ausdruck in
      `likes_write_own` läuft unter der RLS des Aufrufers; auf einen
      unsichtbaren Beitrag scheitert das Verschieben schon heute. Reichweite ist
      also „jeder sichtbare Beitrag" — ab `exchange` der ganze Club. Das Fixture
      nimmt darum den ungünstigsten Angreifer, der noch funktioniert: `basic`
      auf einem fremden öffentlichen Beitrag
- [x] 3.3 Migration: `revoke update on public.post_likes from authenticated`
      (`20260824140000_post_likes_ohne_update.sql`); `grants_test.sql` §1
      nachgezogen. Der Client schreibt die Tabelle nur per `upsert` und `delete`
      — **belegt, nicht angenommen**, und zwar auf zwei Ebenen:
      *(a) Quelltext:* `from("post_likes")` steht dreimal in `src/lib/feed.ts`
      (499 lesend, 620 `.delete()`, 629 `.upsert()`), `academy.ts` liest, die
      beiden Seed-Dateien schreiben ausserhalb von `authenticated`; ein
      `.update()` gibt es nirgends.
      *(b) Laufzeit:* dieselben Wege durch echtes PostgREST gegen den lokalen
      Stack — echter Upsert **201**, Doppelklick **201**, `delete` **204**,
      Verschiebe-Angriff per PATCH **403/42501**
- [x] 3.3a **Folge des Entzugs, nicht geplant:** `ignoreDuplicates: true` im
      `upsert` ist ab jetzt tragend. Ohne das Flag sendet PostgREST
      `resolution=merge-duplicates`, also `on conflict do update` — gemessen
      **403/42501**, der Like-Knopf wäre kaputt, und zwar erst zur Laufzeit und
      nur beim zweiten Klick. Festgehalten in `src/lib/feed.like.test.ts`
      (4 Zusagen), gegengeprobt mit `false` und mit entferntem Flag — beide rot,
      `feed.ts` danach unverändert
- [x] 3.4 Migration: `like_count` auf `posts`, Trigger auf `post_likes`
      (INSERT/DELETE), Nachtrag für den Bestand — alles in einer Transaktion
      (`20260824150000_posts_like_count.sql`). **Statt `greatest(…, 0)` eine
      Prüfbedingung `like_count >= 0`:** `greatest` fänge eine negative Zahl
      STILL ab und machte jedes künftige Loch unsichtbar; die Prüfbedingung
      fällt laut aus, an der Stelle, an der das Loch entsteht
- [x] 3.5 Triggerfunktion gehärtet: `security definer` (als INVOKER liefe das
      UPDATE unter `posts_write_own` — der Zähler wäre genau dort falsch, wo er
      zählt), `set search_path = ''`, `execute` für `public`, `anon` und
      `authenticated` entzogen. Postgres prüft EXECUTE beim ANLEGEN des
      Triggers, nicht bei jedem Feuern; der Entzug kostet also nichts.
      pgTAP-Zusagen für beides
- [x] 3.6 Index `(like_count desc, created_at desc, id desc)`
      (`20260824151000_posts_beliebtheit_index.sql`); `EXPLAIN` vorher und
      nachher, lokal an 20 000 Beiträgen, beide Ausgaben im Kopf der Migration:
      **vorher** Seq Scan über 20 000 Zeilen + top-N heapsort, `Buffers: shared
      hit=286`; **nachher** Index Only Scan, 20 Zeilen, `hit=13 read=2`. Der
      Sortierschritt entfällt ganz. Die pgTAP-Zusage lautet auf die
      SPALTENFOLGE und die Richtung, nicht auf den Namen
- [x] 3.7 pgTAP: eine Reaktion und ihre Rücknahme führen die Zahl auf den
      Ausgangswert zurück (1 → 2 → 1)
- [x] 3.8 pgTAP: die Zahl an der Zeile stimmt für jeden Beitrag mit `like_count`
      aus `post_engagement_counts` überein — die Gegenrechnung, die live über
      `post_likes` zählt
- [x] 3.9 **Alle** Schreibwege auf `posts` gesucht, nicht nur in `src/`:
      `from("posts")` steht **fünfmal**, dreimal lesend
      (`public-profile.ts:111`, `dashboard.ts:260`, `feed.ts:421`), einmal
      `.update()` (`feed.ts:693`, schreibt genau `body`, `hashtags`,
      `visibility`), einmal `.delete()` (`feed.ts:716`). In
      `supabase/functions/` kommt `posts` **gar nicht** vor, in `supabase/seed/`
      nur als rohes SQL ausserhalb von `authenticated`. **Kein einziges INSERT**
- [x] 3.10 **Belegt, bevor entzogen wurde:** pgTAP, dass ein Beitrag über
      `create_post_with_media` auch **ohne** INSERT-Recht entsteht. Der Test
      entzieht das Recht **innerhalb seiner eigenen Transaktion** — dadurch
      misst die Zusage auch dann noch etwas, wenn das Recht längst fort ist.
      Voraussetzung des Entzugs, nicht seine Bestätigung
- [x] 3.11 Migration: `revoke insert, update on public.posts from authenticated`,
      danach `grant update (body, hashtags, visibility)`
      (`20260824160000_posts_rechte_enger.sql`)
- [x] 3.12 pgTAP: ein direktes UPDATE auf `like_count` des eigenen Beitrags wird
      verweigert; Bearbeiten von Text, Schlagworten und Sichtbarkeit gelingt
      weiter. **Der Befund war real, nicht theoretisch:** vor dem Entzug las die
      Zusage `'OK'` — der Autor konnte `update posts set like_count = 999` auf
      seinem eigenen Beitrag absetzen und stand danach oben in „Beliebteste"
- [x] 3.13 `grants_test.sql` §1 (`posts` als `DELETE,SELECT`, `post_likes` ohne
      UPDATE) **und** §2 (`posts` in die `table_name in (...)`-Liste, neue Zeile
      `posts.UPDATE=body,hashtags,visibility`) im selben Commit nachgezogen
- [x] 3.14 **Nicht geplant, vom Entzug verursacht:** `rls_test.sql` 22.15
      schreibt `kind`/`ref_id` und lief bis dahin bis zur Policy durch (null
      Zeilen). Jetzt weist das Grant vorher mit `42501` ab, und `count_as` fängt
      keinen Fehler — der ganze Lauf riss mit (386 von 433 gelaufen). Auf
      `try_as`/`alike` umgestellt, mit dem Grund im Kommentar. Die Aussage über
      die POLICY geht nicht verloren: 22.14 und 22.16 messen sie unverändert
- [x] 3.15 Gegenproben am lebenden Katalog, jede einzeln zurückgenommen:
      **Zähler** — Trigger entfernt → 4 Zusagen fallen; `definer` → `invoker`
      → dieselben 4 plus die Härtung (der Zähler wird still falsch, nicht
      laut); EXECUTE an `authenticated` → die Härtungszusage fällt.
      **Rechte** — tabellenweites UPDATE zurück → 3 fallen; INSERT zurück →
      2 fallen; **nur `like_count`** in die Spaltenliste → 2 fallen, die
      Selbstbeförderung ist sofort wieder offen
- [x] 3.16 Gesamtlauf nach Abschnitt 3: **8 pgTAP-Dateien, 653 Zusagen, PASS**;
      Vitest 132 Dateien / 1482 Zusagen; `tsc --noEmit` sauber

## 4. Aggregate für die Sidebar

- [x] 4.1 `feed_tag_counts()`: **`security invoker`**, `stable`,
      `set search_path = ''`, Obergrenze 50. Das Sichtbarkeitsprädikat ist
      **nicht kopiert** — `posts_select_by_visibility` greift selbst.
      `20260824170000_feed_sidebar_aggregate.sql`
- [x] 4.2 Gezählt wird über `public.tags` mit `active = true`, nicht über
      `unnest(posts.hashtags)`. **Inner Join, kein `left join` mit `having`:**
      ein Tag ohne sichtbaren Beitrag fällt dadurch von selbst heraus, statt
      über eine Zeile, die man vergessen kann
- [x] 4.3 `feed_top_authors(p_limit)`: dasselbe Vorgehen, Namen aus
      `profiles_public`, Vorgabe **fünf**, gezählt nach **Beiträgen**.
      **Nicht an `anon` vergeben** — dort hält `profiles_public` kein Recht, der
      Aufruf liefe in einen Fehler. Das steht als GRANT und nicht nur als
      Vorsatz im Client
- [x] 4.4 Tie-Break: Tags nach `count desc, sort, key`, Autoren nach
      `count desc, name, id` — beide Schlussmerkmale sind eindeutig, die Ordnung
      ist also total. `p_limit` wird auf **1..20 geklemmt**, `null` wird zu 5;
      ein ungültiger Wert wird zurechtgebogen statt abgewiesen, weil ein `raise`
      aus einer Sidebar-Kachel einen Seitenfehler machte. Alle vier Fälle
      zugesagt — für die obere Klemme stehen **25 Autoren** im Fixture, sonst
      bewiese `p_limit => 999` nichts
- [x] 4.5 pgTAP: ein Tag an fünf Beiträgen, davon zwei sichtbar, zählt zwei —
      **und derselbe Tag zählt für den `exchange`-Betrachter fünf**. Eine Zusage
      aus nur einer Perspektive wäre mit einer Funktion vereinbar, die immer
      alles oder immer nur das Öffentliche zählt
- [x] 4.6 pgTAP: ein Tag ohne sichtbaren Beitrag erscheint **gar nicht** — auch
      nicht mit der Zahl null; plus die Gegenprobe, dass derselbe Tag für den
      höherstufigen Betrachter sehr wohl da ist
- [x] 4.7 pgTAP: ein stillgelegtes Schlagwort erscheint nicht, **obwohl sein
      Beitrag öffentlich ist**; ein freies erscheint nicht, **obwohl es öfter
      vorkommt als ein kuratiertes**. Beide Fixtures sind so gebaut, dass ein
      Durchfallen nur eine Ursache haben kann
- [x] 4.8 pgTAP: ein deaktiviertes Mitglied fällt aus „Aktivste Mitglieder", und
      seine Beiträge zählen für niemanden mit — mit Vorbedingung („er steht
      drin") vor der Deaktivierung
- [x] 4.9 `EXPLAIN` für beide gemessen (lokal, 20 000 Beiträge, als bestätigtes
      Mitglied; gemessen wurde der **Rumpf**, weil `set search_path` das
      Einbetten verhindert): `feed_tag_counts` **507 ms / 71 067 Puffer**,
      `feed_top_authors` **472 ms / 78 001**.
      **Entscheidung: kein neuer Index — und das ist eine Messung, keine
      Bequemlichkeit.** Der Verdacht lag auf dem Tag-Join, weil der Planer den
      vorhandenen `posts_hashtags_gin` nicht nimmt. Er ist falsch: die vom
      Design verworfene `unnest`-Fassung bringt **489 ms** statt 507, also
      nichts. Derselbe `count(*)` über dieselben Beiträge kostet **0,79 ms /
      364 Puffer ohne RLS** und **464 ms / 71 065 unter RLS** — Faktor 195,
      bevor irgendetwas aggregiert wird. Die Grenze ist
      `posts_select_by_visibility` mit seinem `has_level(4)` je Zeile, und die
      anzufassen hiesse, die Regel zu ändern, an der der ganze Feed hängt.
      **Nachtrag für Donald, nicht für diesen Change.** Heute ohne Wirkung:
      PROD 4 Beiträge, DEV 29
- [x] 4.10 Grants ausgesprochen (`feed_tag_counts` an `anon` + `authenticated`,
      `feed_top_authors` nur `authenticated`, beide `revoke … from public`).
      Der Golden-Snapshot ist **nicht** betroffen: `grants_test.sql` führt
      Tabellen- und Spalten-Grants, keine Funktions-Grants. Die Funktionszeile
      steht deshalb als eigene Zusage in `feed_sidebar_test.sql` §5
- [x] 4.11 Gegenproben am lebenden Katalog, jede einzeln zurückgenommen:
      **(a)** beide auf `security definer` → 5 Zusagen fallen, darunter die
      `basic`-Zahl und die des ausgeloggten Besuchers — genau die Stellen, an
      denen `invoker` die Arbeit macht;
      **(b)** EXECUTE an `anon` auf `feed_top_authors` → die Grant-Zusage fällt;
      **(c)** die vom Design verworfene `unnest`-Fassung eingesetzt → das
      stillgelegte **und** das freie Schlagwort erscheinen
- [x] 4.12 Gesamtlauf nach Abschnitt 4: **9 pgTAP-Dateien, 671 Zusagen, PASS**

## 5. Datenschicht des Feeds

- [ ] 5.1 `FetchFeedArgs` um `reiter`, `ordnung`, `tags: string[]` und `typ`
      erweitern; `hashtag` (Einzahl) auf den neuen Weg führen, ohne den bestehenden
      Ein-Tag-Filter zu brechen
- [ ] 5.2 **Der stille Fall:** „Beiträge von mir" ohne Kennung darf nicht zu „alle
      Beiträge" entarten — ein `if (autorId)` tut genau das. Test dafür
- [ ] 5.3 `.contains()` → `.overlaps()` für die Tags; Test, dass ein Beitrag mit
      nur **einem** von zwei gewählten Tags erscheint (rot gegen die alte Fassung)
- [ ] 5.4 Den Cursor auf die drei Ordnungen erweitern — je ein eigener Keyset-Pfad,
      bei „Beliebteste" über `(like_count, created_at, id)`
- [ ] 5.5 Test: mehr als 20 Beiträge mit **gleicher** Reaktionszahl; jeder erscheint
      auf genau einer Seite, keiner fällt zwischen zwei Seiten
- [ ] 5.6 Test: „Älteste zuerst" blättert vollständig, ohne einen Beitrag doppelt
      zu zeigen
- [ ] 5.7 **Den React-Query-Schlüssel vollständig machen:** Reiter, Ordnung,
      normalisierte Tagmenge und Typ gehören hinein. Test, dass ein Wechsel keine
      Seiten der alten Auswahl weiterverwendet
- [ ] 5.8 Reiter „Gespeichert": Join über `post_saves` auf `posts`, damit die RLS
      das Gate bleibt — kein `in (ids)` mit Nachkorrektur im Client
- [ ] 5.9 Test: ein gespeicherter, danach unsichtbar gewordener Beitrag verschwindet
      aus der Liste, ohne Fehler, und seine `post_saves`-Zeile bleibt bestehen
- [ ] 5.10 `savedByMe` als Datenfeld: **ein** gebündelter Aufruf über die IDs der
      Seite, nicht zwanzig. Test, der die Zahl der Abfragen prüft
- [ ] 5.11 Speichern und Lösen schreiben Kartenzustand **und** den Reiter
      „Gespeichert" gemeinsam fort (Invalidierung beider Schlüssel)
- [ ] 5.12 Typ-Filter in der Abfrage: Video über `video_url`, Event über `kind`,
      Bild über `post_media`, Text als Beitrag ohne all das
- [ ] 5.13 **Integrationstest gegen den lokalen Stack** für den Typ-Filter: mehr als
      20 gemischte Beiträge, Reiter/Tag/Typ kombiniert. Ein Mock des Query-Builders
      belegt die PostgREST-Form nicht
- [ ] 5.14 `src/lib/database.types.ts` nachziehen: `post_saves`, `posts.like_count`,
      die Beziehungen und beide RPC-Signaturen. Gegen das lokale Schema abgleichen,
      **nicht** ungeprüft neu erzeugen

## 6. Fläche

- [ ] 6.1 Composer in die Feed-Spalte verschieben (`CommunityFeed.tsx:156` rendert
      ihn heute vor dem Raster); Sidebar beginnt oben bündig
- [ ] 6.2 Den Non-goal-Kommentar in `CommunityFeed.tsx:213` mitändern — er begründet
      heute das Gegenteil dessen, was die Datei dann tut
- [ ] 6.3 Medientyp-Zeile im Composer mit Icons aus dem Kanon (Bild, Video);
      **kein** Event- und **kein** Umfrage-Knopf
- [ ] 6.4 Drei Reiter; ein Reiterwechsel setzt das Blättern zurück. Der Reiter lebt
      im Zustand der Seite, **nicht** in der URL
- [ ] 6.5 Umschalter für die Ordnung; ein Ordnungswechsel setzt das Blättern zurück
- [ ] 6.6 Sidebar: Tags als Auswahlkästchen mit Zählern, aktivste Mitglieder,
      Beitragstyp
- [ ] 6.7 Die Spalte darf **nicht** verschwinden, wenn keine kuratierten Tags
      bestehen (heute gibt `TagFilter` in dem Fall `null` zurück)
- [ ] 6.8 **Der anonyme Fall:** ohne Sitzung nur „Alle Beiträge", kein
      Speichern-Knopf, keine aktivsten Mitglieder — und die Zähler entweder
      nachweislich öffentlich-nur oder gar nicht. Kein Aufruf, der in 401 läuft
- [ ] 6.9 **Mobil:** die gefüllte Spalte darf nicht ungeklappt zwischen Composer und
      ersten Beitrag treten und nicht ersatzlos unter zwanzig Karten wandern —
      zusammengeklappt über dem Feed oder als eigene Fläche
- [ ] 6.10 Speichern-Knopf an der Beitragskarte, mit Zustand und Rücknahme
- [ ] 6.11 Der Wert kommt in mehreren Fällen erst **nach** dem Mount — kein
      `useState(wert)` als Erstbelegung, sonst prüft der Test die falsche Zeitachse

## 7. Abnahme

- [ ] 7.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` grün — **nie**
      `pnpm format` (schreibt rund 60 fremde Dateien um)
- [ ] 7.2 `supabase test db` mit ausdrücklicher Dateiliste grün, `grants_test.sql`
      eingeschlossen
- [ ] 7.3 Sichtprobe im Browser gegen den lokalen Stack: beide Themes, 375 px und
      breit — Composer-Spalte, Sidebar-Höhe, Kästchen, Überlauf. jsdom sieht davon
      nichts
- [ ] 7.4 Sichtprobe **ausgeloggt**: die Seite trägt einen Reiter, keinen
      Speichern-Knopf, keine Namen — und die Konsole zeigt keinen 401
- [ ] 7.5 Sichtprobe: Speichern füllt und leert den Reiter ohne Neuladen
- [ ] 7.6 Sichtprobe: zwei Haken bei den Tags zeigen die Vereinigung, nicht die
      Schnittmenge
- [ ] 7.7 Belegen, dass die Zähler nichts verraten — per pgTAP, nicht per
      Sichtprobe
- [ ] 7.8 Zweite Meinung auf den Diff (Schritt 4 der Schleife), Vendor ungleich dem
      des Deltas
