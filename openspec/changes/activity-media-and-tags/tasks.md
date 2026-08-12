# Tasks — C7 (AGE-528)

Fassung 1. Reihenfolge ist Absicht: erst die Sonde, die die tragende Annahme
misst, dann die Datenbank, dann die Datenschicht, dann die Oberfläche. Jede
Aufgabe nennt, **woran man sieht, dass sie erfüllt ist** — bei den
Datenbank-Aufgaben ein pgTAP-Fall, der vorher rot war.

Entwickelt und geprüft wird **lokal** (`supabase start`) und gegen **DEV**
(`foelowldexkcqzewvrcf`). Nicht gegen PROD. Kein `db reset` gegen ein
Remote-Projekt. Vor jedem schreibenden Befehl das Zielprojekt nennen.

Der Testbefehl nimmt **positionale Pfade**, kein `--file`:

```
supabase test db --local supabase/tests/rls_test.sql supabase/tests/grants_test.sql
```

Ohne die Pfadliste meldet er FAIL, obwohl grün — die `probe_*.sql` sind kein
pgTAP.

Drei Fallen, die in diesem Repo schon zugeschlagen haben und hier wieder
greifen:

* **`grants_test.sql` ist ein Golden-Snapshot.** Zwei neue Tabellen mit
  Table-Grants brechen ihn und damit den `migrations`-Job in CI, ohne dass
  `post_media` irgendwo genannt wäre. Golden-String **und**
  Spalten-Grants-Assertion mitziehen (§1.6, §2.4).
* **`database.types.ts` von Hand ergänzen**, nicht neu generieren. Die CLI
  schreibt die Datei stillos um und bricht rund zwanzig Testfixtures — dieselbe
  Entscheidung wie AGE-249/AGE-358/AGE-498.
* **Nie `git add -A`.** Der Arbeitsbaum trägt dauerhaft untrackte Dateien mit
  Rechten 0600, und das Repo ist öffentlich.

---

## 0 · Vorbereitung

- [x] 0.1 `openspec validate --all` grün, bevor die erste Zeile Code entsteht.
- [x] 0.2 Fremd-Review (Schritt 2b) → `REVIEWS.md`, mindestens zwei Anbieter,
      beide **andere** als der Verfasser dieses Deltas. Befunde einarbeiten,
      bevor Block 1 beginnt.
- [x] 0.3 Branch `donald/age-528-c7-aktivitat-bilder-kuratierte-tags-reaktionen-wie-im-mockup`
      von `main`. Nie direkt auf `main`.
- [x] 0.4 Lokalen Stack hochfahren (`supabase start`), `supabase db reset`
      **nur lokal**.
- [x] 0.5 Mockup liegt unter `docs/mockups/aktivitaet-2026-07-29.png`.

## 1 · Die Sonde zuerst — darf `anon` signieren?

Diese Frage trägt den ganzen Change (siehe `design.md`). Sie wird **gemessen,
bevor** etwas darauf gebaut wird, weil sie sonst erst zur Laufzeit auffällt —
so wie `service_role` hält keine Tabellenrechte, das drei Testsuiten und zwei
Reviews überstanden hat und erst die Sichtprobe fand.

- [x] 1.0a **Erledigt beim Plan-Review**: ist `/aktivitaet` ohne Session
      überhaupt erreichbar? Sonst wäre der gesamte anon-Lesepfad toter Code.
      **Ja** — `src/config/nav.ts:75` trägt weder `requiresAuth` noch `minTier`,
      `App.tsx:41` reicht das Element ungeschützt durch.
- [x] 1.0 `scripts/probe-post-media-signatur.ts` gegen den **lokalen** Stack:
      Objekt hochladen, `post_media`-Zeile anlegen, Beitrag auf `public` →
      als anon `createSignedUrls` **und** Abruf der signierten URL erwarten
      **200**. Dann Beitrag auf `members` → erneut als anon signieren, **Ablehnung**
      erwarten. Ausgabe nach `EVIDENCE.md`, Abschnitt „Vorher/Nachher".
      *Erfüllt, wenn:* beide Hälften eindeutig sind — nicht „kein Bild", sondern
      der Statuscode und die Fehlermeldung.
- [x] 1.0b Dieselbe Sonde misst die **Laufzeit eines Stapels mit 120 Pfaden**.
      Die Policy wertet je Objekt eine `SECURITY DEFINER`-Funktion mit Join aus;
      wenn das teuer ist, will man es hier wissen und nicht am Starttag.
- [x] 1.0c Sonde **zusätzlich gegen DEV** laufen lassen, bevor Block 2 dort
      landet. Ein grüner lokaler Lauf sagt nichts über DEV, wenn die
      Supabase-Versionen auseinanderliegen (Befund aus dem Plan-Review).
      Erledigt am 2026-08-12: alle sechs Fälle erfüllt, 120 Signaturen in
      70–135 ms statt 15 ms (das Netz, nicht die Konstruktion). Der Zielaufruf
      verlangt die Projektkennung als Argument; lokal bleibt fest verdrahtet.
      **DEV hatte einen eigenen Befund:** der Abbau war nicht symmetrisch — der
      Wegwerf-Bucket blieb im Live-Projekt stehen, während die Sonde „ALLE
      PRUEFUNGEN ERFUELLT" meldete. `emptyBucket` ist gehostet nicht sofort
      wirksam. Der Abbau prüft jetzt seine Rückgaben, zählt Reste getrennt und
      versucht es dreimal; `EVIDENCE.md`.
- [x] 1.1 **Verzweigung — nicht eingetreten.** Die Sonde ist grün
      (`EVIDENCE.md`): alle sechs Fälle erfüllt, 120 Signaturen in 17 ms. Der
      Rückfallweg (Edge Function mit `service_role`) wird nicht gebraucht,
      `design.md` bleibt unverändert.

## 2 · Migration A — `post_media`, Bucket, Policies

Datei: `supabase/migrations/20260812090000_post_media.sql`
Datei: `supabase/migrations/20260812090100_post_media_storage.sql`

- [x] 2.1 **RED**: neuer Abschnitt in `supabase/tests/rls_test.sql` mit den
      Fällen aus dem Spec-Delta, alle rot:
      - anon signiert Objekt eines `public`-Beitrags → erlaubt
      - anon signiert Objekt eines `members`-Beitrags → verweigert
      - Mitglied unter Rang 4 auf fremden `members`-Beitrag → verweigert
      - Autor auf eigenen `members`-Beitrag → erlaubt
      - unbestätigtes Konto lädt hoch → verweigert
      - Schreiben in fremdes Pfadpräfix → verweigert
      - Objekt ohne `post_media`-Zeile → für niemanden signierbar
      **Falle:** ohne SELECT-Policy trifft ein `where` auf `storage.objects`
      0 Zeilen, auch bei `using(true)` — ein Test, der „0 Zeilen" mit „verboten"
      verwechselt, ist grün und prüft nichts. Der verweigerte Fall wird über den
      **Fehler** belegt, nicht über die Zeilenzahl.
- [x] 2.2 Tabelle `public.post_media` anlegen: Spalten nach Spec, FK
      `on delete cascade`, RLS an, **`unique (post_id, sort)`** und
      **`unique (storage_path)`**. Der zweite Index ist nicht Kosmetik: die
      Sichtbarkeitsfunktion sucht über genau diese Spalte (2.7), und zwei Zeilen
      auf denselben Pfad machten die Antwort mehrdeutig.
- [x] 2.3 Grants **aussprechen**, nicht erben: seit AGE-312 erbt eine neue
      Tabelle nichts. `authenticated` bekommt SELECT/INSERT/DELETE, `anon`
      SELECT. Ohne SELECT für `anon` kann die Storage-Policy für den
      ausgeloggten Besucher nicht ausgewertet werden.
- [x] 2.4 RLS-Policies auf `post_media`: lesen wie der Beitrag, schreiben nur
      als Autor des Beitrags und nur mit `public.is_activated()`.
- [x] 2.5 „Höchstens sechs Bilder pro Beitrag" als **Trigger**, nicht als
      `check` — es ist eine Zählung über andere Zeilen, und die kann eine
      Check-Constraint nicht ausdrücken (Befund aus dem Plan-Review). Der
      verbleibende Wettlauf zwischen gleichzeitigen Inserts ist hier
      unerheblich: der einzige Schreibweg ist die RPC aus 2.13, und die schreibt
      alle Zeilen eines Beitrags in einer Anweisung.
- [x] 2.6 Bucket `post-media` anlegen: `public = false`, `file_size_limit`
      1 MiB, `allowed_mime_types` `{image/webp}`. **`on conflict (id) do update`**,
      nicht `do nothing` — ein bestehender Bucket mit falschen Einstellungen
      würde sonst konserviert und der Test liefe grün gegen eine falsche
      Konfiguration (Befund aus dem C6-Review).
- [x] 2.7 `public.post_media_lesbar(text)` als `SECURITY DEFINER`: sucht die
      `post_media`-Zeile über `storage_path = <objektname>` und wertet das
      Prädikat von `posts_select_by_visibility` für **deren** Beitrag aus.
      **Den Pfad NICHT zerlegen** — der Objektname ist frei wählbar, und eine
      daraus geschnittene `postId` würde eine fremde Sichtbarkeit behaupten
      (HIGH-nahe Falle aus dem Plan-Review, Begründung in `design.md`).
      Execute-Recht für `anon` und `authenticated`, sonst entzogen.
- [x] 2.7a **RED dazu**: ein Objekt unter `{eigene-uid}/{fremde-**public**-postId}/x.webp`
      hochladen und als anon signieren wollen → **abgelehnt**. Dieser Fall ist
      der Grund für 2.7 und muss eigenständig rot gewesen sein.
      **Korrigiert am 2026-08-12 — hier stand `fremde-members-postId`, und das
      misst nichts.** Eine members-Kennung ist auch einer pfad-zerlegenden
      Fassung verboten; der Test bliebe an der kaputten Funktion grün. Genau das
      ist passiert und wurde erst von einer Mutation gefunden (`EVIDENCE.md`,
      „Die Gegenprobe"). `design.md` beschrieb die scharfe Variante von Anfang
      an richtig: eine **öffentliche** Kennung, bei der ein Pfad-Parser „public"
      läse und ein Objekt signierte, das zu keinem Beitrag gehört.
- [x] 2.8 Vier Storage-Policies: SELECT für `anon` **und** `authenticated` über
      2.7, INSERT/UPDATE/DELETE auf `{uid}/`-Präfix mit `is_activated()`.
- [x] 2.9 **GREEN**: `supabase test db --local supabase/tests/rls_test.sql
      supabase/tests/grants_test.sql` — alle Fälle aus 2.1 grün.
- [x] 2.10 `grants_test.sql` nachziehen (Golden-String **und**
      Spalten-Grants-Assertion), sonst ist der `migrations`-Job rot.
- [x] 2.11 Migrationskopf schreiben: signiert, datiert, mit Begründung und
      **verworfener Alternative** (zwei Buckets nach Sichtbarkeit) — so wie es
      in diesem Repo üblich ist. Die 1-h-Gültigkeit der Signaturen gehört
      dorthin, samt ihrer Folge für die Nachlaufzeit eines
      Sichtbarkeitswechsels.
- [x] 2.13 RPC `public.create_post_with_media(...)` als `SECURITY DEFINER`:
      legt Beitrag **und** `post_media`-Zeilen in **einer Transaktion** an,
      erzwingt Autorschaft, die Sechser-Grenze und die Tag-Vereinigung. Grund
      und Ablauf in `design.md` („Veröffentlichen ist ein Schritt, nicht drei").
      Sie ersetzt keine Policy — `posts_write_own` bleibt.
- [x] 2.13a **RED dazu**: schlägt das Anlegen einer `post_media`-Zeile fehl,
      existiert **kein** Beitrag. Kein halb veröffentlichter Zustand.

## 3 · Migration B — `tags` mit Startbefüllung

Datei: `supabase/migrations/20260812090200_tags.sql`

- [x] 3.1 **RED**: pgTAP — `tags` ist für `anon` und `authenticated` lesbar,
      für beide **nicht** schreibbar (redaktionelle Liste, kein Mitgliedsinhalt).
      Dazu die Schlüsselform: ein `key` mit Großbuchstabe wird abgelehnt, einer
      mit Leerzeichen oder Bindestrich ebenso; `persönlichkeitsentwicklung`
      (mit Umlaut) wird angenommen.
- [x] 3.2 Tabelle `public.tags` (`key` PK, `label`, `sort`, `active`), RLS an,
      SELECT-Policy für beide Rollen, kein Schreibrecht.
- [x] 3.3 Grants aussprechen (SELECT für `anon`, `authenticated`).
- [x] 3.4 Startbefüllung: **15 Tags aus dem Mockup**, elf Themen und vier
      Formate (Liste und Begründung in `design.md`). **Nicht** die
      Kompass-Kategorien — die sind Matching-Kategorien und es sind 14, nicht
      elf (siehe `design.md`). Von Donald am 2026-08-11 freigegeben; eine
      spätere Korrektur mit Detlev ist ein Insert, keine Migration.
- [x] 3.4a `check (key = lower(key))` **und** `check (key ~ '^[[:alnum:]_]+$')`.
      Ohne beide zerfällt derselbe Tag in zwei Werte, je nachdem ob er getippt
      oder geklickt wurde — Begründung in `design.md`, Testfall in 3.1.
      **Zeichenklasse korrigiert am 2026-08-12:** hier und in `design.md` stand
      `^[\p{L}\p{N}_]+$`, von `TOKEN_RE` aus dem Frontend abgeschrieben.
      Postgres kennt keine Unicode-Property-Escapes und bricht mit „invalid
      escape \ sequence" ab — die Migration wäre nicht durchgelaufen. Gemessen
      in `EVIDENCE.md`; `[[:alnum:]]` leistet dasselbe und trägt den Umlaut.
- [x] 3.5 **GREEN** + `grants_test.sql` nachziehen.
- [x] 3.6 `posts.hashtags` bleibt **unangetastet**. Keine Verknüpfungstabelle,
      keine Datenwanderung. Wer hier eine anlegt, hat die Entscheidung aus
      `design.md` übergangen.

## 4 · Die Tag-Doppelanzeige beheben

- [x] 4.1 **RED**: `src/components/community/CommunityFeed.test.tsx` — die
      erste Testdatei zu dieser Komponente. Ein Beitrag mit `#Netzwerken` im
      Body und `netzwerken` in `hashtags` wird gerendert. Die Zusicherung ist
      **genau**: `netzwerken` erscheint zweimal im Dokument (einmal als Chip,
      einmal als Fließtext) und **genau eine** dieser Stellen ist ein Button
      oder Link. „Genau eine anklickbare Stelle" allein wäre unpräzise — nach
      dem Fix liefert `getAllByText` zwei Treffer, und ein Test, der das nicht
      unterscheidet, sichert die falsche Sache zu (Befund aus dem Plan-Review).
      Der Test ist vor der Änderung rot.
      **Kein `vi.mock` auf die eigene Komponente** und keine Assertion auf
      Bezeichner statt sichtbaren Text — beides ist grün und prüft nichts.
- [x] 4.2 In `PostBody` (`CommunityFeed.tsx:401–412`) den Hashtag-Zweig auf
      normalen Text umstellen. Erwähnungen (`:413`) und URLs (`:429`) bleiben
      Verweise. Die Chip-Reihe (`:331–348`) bleibt unverändert.
- [x] 4.3 **GREEN** + zweiter Fall: Erwähnung und URL im selben Beitrag sind
      weiterhin Verweise.
- [x] 4.4 `tokenizePostBody` und `parseHashtags` bleiben unverändert — die
      Segmente werden weiter gebraucht, nur anders gezeichnet.

## 5 · Datenschicht für Medien und Tags

- [x] 5.1 `src/lib/image.ts`: reine Funktion `zielMasse(w, h, maxEdge)` +
      `shrinkToWebp(file, opts)`. **Getestet wird die reine Funktion** (4032×3024
      → 1600×1200; kleines Bild unverändert) — jsdom hat keinen 2D-Kontext, ein
      Canvas-Test könnte nur behaupten, dass nichts wirft.
- [x] 5.1a Fehlerfall benennen: scheitert `shrinkToWebp` (unlesbares Format,
      Speichergrenze), wird **sofort** eine konkrete Meldung gezeigt und **gar
      nicht** hochgeladen. Sonst läuft der Nutzer in einen späten,
      nichtssagenden Serverfehler am 1-MiB-Limit (Befund aus dem Plan-Review).
      `BILD_UNLESBAR` ist eine Meldung für alle drei Fehlerwege — sie
      unterscheiden sich für den Nutzer nicht. Der Zweig ist in jsdom echt
      erreichbar und deshalb zugesichert, nicht nur behauptet.
- [x] 5.2 `src/lib/post-media.ts`: hochladen nach `{uid}/{postId}/{i}-{ts}.webp`
      (Beitrags-`id` **im Client** erzeugt, siehe `design.md`) und
      **gebündeltes** `createSignedUrls` je Feed-Seite.
      **„Einzeln löschen" ist NICHT gebaut, mit Begründung.** Hochgeladen wird
      beim Veröffentlichen, nicht beim Auswählen — ein Bild vor dem
      Veröffentlichen zu entfernen heißt damit, es aus einem Array zu nehmen,
      ohne den Storage anzufassen (6.2). Ein Bild aus einem *veröffentlichten*
      Beitrag zu löschen verlangt keine Oberfläche in diesem Change; die
      Einzel-Löschbarkeit ist eine Eigenschaft des **Datenmodells** (Tabelle
      statt `jsonb`, DELETE-Policy) und in Block 2 gemessen. Eine Funktion ohne
      Aufrufer wäre hier die teurere Wahl.
- [x] 5.2a `createSignedUrls` kann **einzelne** Pfade ablehnen — in der Sonde
      gemessen (Fall F: 4 von 5, der Stapel wird nicht verworfen). Je Bild
      behandeln: ein abgelehntes Bild lässt seine Kachel weg, es darf nie den
      ganzen Beitrag verschlucken.
- [x] 5.2b **Eine Ablehnung ist kein Fehler und gehört NICHT an Sentry.** Die
      Sonde hat gezeigt, dass der Storage „Object not found" meldet, wo er
      „nicht erlaubt" meint — er unterscheidet die beiden Fälle nach außen
      bewusst nicht (keine Aufzählbarkeit). Für ein Bild, das den Betrachter
      nichts angeht, ist das der Normalfall; wer es meldet, meldet Rauschen.
      Der Gegenfall ist mitgezogen: scheitert der **ganze** Aufruf, ist etwas
      kaputt — das geht sehr wohl an Sentry, und der Feed zeigt die Beiträge
      ohne Bilder statt gar nicht.
- [x] 5.3 Signierte URLs pro Pfad in react-query cachen, `staleTime` 50 min bei
      1 h Gültigkeit. Ohne das lädt der Browser bei jedem Render jedes Bild neu.
      **Plus**: ein Bildfehler (403 nach Ablauf in einem lange offenen Tab)
      löst ein Nachsignieren aus, statt eine kaputte Kachel stehen zu lassen.
      In Block 5 entstanden `signaturQueryKey` und `SIGNATUR_STALE_MS`; Hook
      und Nachsignieren kamen mit **7.2**, wo es das `<img>` gibt — nicht hier
      auf Vorrat.
- [x] 5.4 `src/lib/tags.ts`: aktive kuratierte Tags lesen, `istKuratiert(key)`.
- [x] 5.5 `fetchFeed` auf Seiten zu 20 umstellen, `post_media` mitlesen. Der
      Cursor läuft über **`(created_at, id)`**, nicht über `created_at` allein —
      bei gleichen Zeitstempeln überspränge er sonst Beiträge, und genau das
      wird beim Import der ~70 Konten wahrscheinlich (Befund aus dem
      Plan-Review). Der bestehende Hashtag-Filter
      (`.contains("hashtags", […])`) bleibt unverändert.
      **Der Aufrufer musste mit:** `CommunityFeed` läuft auf `useInfiniteQuery`
      mit einer „Ältere Beiträge"-Schaltfläche. Ohne das wäre aus der Kappung
      bei 50 eine bei 20 geworden — schlimmer als vorher.
- [x] 5.6 `database.types.ts` **von Hand** um `post_media` und `tags` ergänzen.
- [x] 5.7 Tests: Cursor-Logik (**inklusive gleicher Zeitstempel**),
      Tag-Vereinigung und `istKuratiert` als reine Funktionen. Keine Mocks auf
      eigene Module.
      **Die Tag-Vereinigung wird hier NICHT nachgebaut.** Sie steht in
      `create_post_with_media()` und ist dort in pgTAP gemessen; eine zweite
      Fassung im Client wäre dieselbe Regel an zwei Stellen — genau das, was
      `profiles_public` in diesem Repo teuer macht. Der Client übergibt beide
      Listen, die RPC vereinigt.
- [x] 5.8 **Sichtprobe statt Behauptung:** `scripts/probe-feed-cursor.ts` misst
      gegen den lokalen Stack, dass PostgREST den `or(…,and(…))`-Ausdruck
      annimmt und kein Beitrag verlorengeht — samt Gegenprobe, dass die naive
      Fassung (nur `created_at`) genau einen verliert. Der Unit-Test kann nur
      die Zeichenkette zusichern; ein falsch geklammerter Ausdruck wäre ein 400
      zur Laufzeit. `EVIDENCE.md`, „Block 5".

## 6 · Composer nach Mockup

- [x] 6.1 Ruhige Zeile, die sich beim Klick öffnet (Mockup: Avatar +
      „Was möchtest du mit der Community teilen?").
      Der Avatar zeigt das generische Personen-Symbol: die Komponente kennt den
      eigenen Namen nur über `activationName` aus dem Auth-Context und lädt für
      ein Schmuckbild kein Profil nach.
- [x] 6.2 Bildauswahl mit Vorschau, Reihenfolge, einzeln entfernen, **hart auf
      sechs begrenzt** — mit sichtbarer Rückmeldung, nicht stillem Verschlucken.
      Verkleinert wird beim **Auswählen**, nicht beim Veröffentlichen: nur so
      ist die Meldung aus 5.1a sofort da. Hochgeladen wird beim Veröffentlichen
      — deshalb ist „einzeln entfernen" hier nur ein `filter` auf einem Array
      und fasst den Storage nicht an (siehe 5.2).
- [x] 6.3 Video-Link bleibt ein eigenes Feld; `parseVideoUrl` entscheidet
      weiterhin. **Kein Upload.** Gespeichert wird er wie heute: an den Body
      angehängt (`CommunityFeed.tsx:104–108`) und beim Rendern über `skipRaw`
      unterdrückt, damit er nicht als Link **und** als Einbettung erscheint.
      **Kein neues Feld am Schema** — das Plan-Review hat zu Recht bemängelt,
      dass dieser Weg nirgends ausgesprochen war.
      Das Feld steht im geöffneten Composer sichtbar; der „Video"-Knopf des
      Mockups (der es erst einblendet) ist ein Zustand mehr ohne Gewinn.
- [x] 6.4 Tag-Auswahl aus den aktiven kuratierten Tags plus Freitext.
      **Der Freitext ist der Beitragstext.** Ein freier Tag entsteht wie bisher
      als `#Wort` im Text und geht über `parseHashtags` in `p_hashtags`; die
      Chips gehen als `p_tags`. Ein zweites Eingabefeld für freie Tags wäre ein
      dritter Weg zu demselben Wert — und der Fall „getippt UND geklickt", den
      6.4a trägt, entsteht genau zwischen diesen beiden.
- [x] 6.4a Beim Veröffentlichen werden getippte und geklickte Tags
      **vereinigt und dedupliziert** (`design.md`, „Tags werden vereinigt").
      Der Fall, der sonst durchrutscht: jemand tippt `#Netzwerken` **und**
      klickt denselben Tag — ohne Vereinigung steht er zweimal in `hashtags`
      und erscheint als doppelter Chip, also genau der Bug, den Block 4 behebt.
      Der Client übergibt beide Listen getrennt; vereinigt wird in der RPC.
- [x] 6.5 Sichtbarkeit wie bisher, `members` als Vorgabe.
- [x] 6.6 Test: veröffentlichen mit zwei Bildern und zwei Tags legt zwei
      `post_media`-Zeilen in Reihenfolge an. **Vorbelegter Context prüft die
      falsche Zeitachse** — kommt ein Wert erst nach dem Mount, nimmt
      `useState(wert)` ihn nie an. Wo das droht, zusätzlich Sichtprobe.
      Gefälscht ist im Test der **Browser** (jsdom hat weder `createImageBitmap`
      noch einen 2D-Kontext), nicht der eigene Code: `shrinkToWebp`,
      `zielMasse`, `parseHashtags` und `uploadPostMedia` laufen echt. Deshalb
      trägt die Zusicherung auf 1600×1200 — die Zahl ist gerechnet, nicht
      eingesetzt. Gegenprobe: `sort` fest auf 0 mutiert lässt zwei Tests fallen.

## 7 · Beitragskarte und Bildlayout

- [x] 7.1 Karte nach Mockup: Autor mit Avatar und Stufen-Badge, Zeit,
      Sichtbarkeits-Hinweis, Text, Medien, Chips, darunter Reaktion und
      Kommentare. **Eine** Reaktionsart (Herz) — wie im Mockup.
      Alles außer dem Sichtbarkeits-Hinweis und den Medien stand schon; neu sind
      genau diese beiden. Der Hinweis steht neben der Zeit und benennt beide
      Fälle („Nur für Mitglieder" / „Öffentlich").
- [x] 7.2 Bildlayout: eins groß, zwei nebeneinander, drei und mehr als Raster
      mit vier Kacheln; die vierte trägt „+n". Maße aus `width`/`height`, damit
      nichts springt.
      **Damit ist auch die zweite Hälfte von 5.3 erledigt:** die Signaturen
      werden mit `useQueries` **je Seite** geholt — ein Schlüssel über alle
      geladenen Seiten würde beim Nachladen auch die alten Bilder neu signieren
      und der Browser lüde sie erneut. Ein Bildfehler löst ein Nachsignieren
      aus, aber je Pfad genau einmal: ein wirklich kaputtes Bild soll sich nicht
      im Kreis drehen.
- [x] 7.3 Kuratierte Chips gefüllt, freie als Outline; beide klickbar.
      Zugesichert über `data-kuratiert`, nicht über Klassennamen — welche Klasse
      füllt und welche umrandet, ist Umsetzung und gehört in die Sichtprobe.
- [x] 7.4 Test für die Layout-Wahl als reine Funktion (1/2/3/5 Bilder).
      Gegenprobe: ohne den `if (!url) return null`-Zweig fällt der Fall des
      abgelehnten Bildes — der Test misst also wirklich ihn.

## 8 · Tag-Filterleiste

- [x] 8.1 Sichtbare Leiste mit den aktiven kuratierten Tags, rechte Spalte nach
      Mockup — **nur der Filter**, nicht „Beliebte Tags" mit Zählern und nicht
      „Aktivste Mitglieder" (siehe Non-goals).
      **Eine Auswahl zur Zeit**, nicht die Kästchen des Mockups: der Feed
      filtert über `.contains("hashtags", [tag])`, mehrere Tags wären eine
      andere Abfrage — nicht eine andere Leiste. Ein zweiter Klick hebt auf.
- [x] 8.2 Der bestehende Chip-Klick-Filter arbeitet unverändert weiter.
      Zugesichert am aufgezeichneten `.contains`-Aufruf, nicht am Ergebnis:
      der Filter läuft in der Datenbank, nicht im Client.
- [x] 8.3 Leerer Zustand aus C2 greift weiterhin und unterscheidet „nichts da"
      von „nichts zu diesem Filter".
- [x] 8.4 Auf dem Telefon: die Leiste liegt über dem Feed, nicht daneben.
      Die Leiste steht **im Markup vor** dem Feed und wird erst ab `lg` per
      `col-start-2 / row-start-1` in die rechte Spalte gehoben. Das ist eine
      reine Layout-Aussage — in jsdom nicht messbar und deshalb bewusst OHNE
      Test; sie gehört in die Sichtprobe (9.6).

## 9 · Abnahme

- [x] 9.0 **Die RPC einmal von einem echten Client rufen** — offene Frage aus
      der Übergabe nach Block 3. `scripts/probe-rpc-create-post.ts`: echtes
      Konto, echter Login, echter Aufruf über PostgREST. Sechs Prüfungen erfüllt,
      darunter die beiden, die den Ablauf tragen: sieben Bilder nehmen den
      **ganzen** Beitrag zurück, und ohne Session fehlt schon das
      Ausführungsrecht. `EVIDENCE.md`.
- [x] 9.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` grün.
      576/576, 0 Fehler, 4 vorbestehende Warnungen in fremden Dateien.
- [x] 9.2 pgTAP vollständig grün, mit **Dateiliste** aufgerufen. 312/312.
- [ ] 9.3 **Der Beweis** (Tabelle in `design.md`), im Inkognito-Fenster gegen
      DEV, mit Screenshot bzw. Statuscode je Zeile:
      `members` → rohe URL kein Bild, Signatur als anon abgelehnt;
      `public` → Bild im ausgeloggten Feed sichtbar.
      **Blockiert, nicht vergessen:** DEV kennt die drei Migrationen nicht
      (nachgesehen 2026-08-12 — nur `avatars`/`covers`, höchste Version
      `20260811090300`); die Sonde aus 1.0c arbeitete mit einem Wegwerf-Bucket
      und hat ihn abgebaut. Der Beweis verlangt also erst einen Schema-Schreib-
      zugriff auf die Instanz, die die Live-Seite bedient. Entscheidung Donald
      2026-08-12: erst 9.4–9.6 lokal, 9.3 danach. `EVIDENCE.md`.
      **Stand nach dem Merge: die scharfe Hälfte ist gemessen.** `migrate-dev`
      ist für die Merge-SHA `df37349` grün, DEV kennt die vier Migrationen.
      `scripts/probe-9-3-sichtbarkeit.ts --dev=foelowldexkcqzewvrcf` führt die
      Tabelle aus `design.md` ausgeloggt: **sechs von sechs erfüllt**, Abbau
      nachgezählt auf null. Vorher am lokalen Stack **mutiert** — beide
      Beiträge auf `public` gestellt — und genau die zwei `members`-Zeilen
      fielen; die Sonde kann also rot.
      **Offen bleibt nur die gerenderte Zeile** („public-Bild im ausgeloggten
      Feed sichtbar"): dafür muss erst der `deploy`-Re-Run aus 10.4 laufen, denn
      bis dahin steht auf pages.dev das alte Frontend — `drift-gate` blockt den
      Deploy, bis `migrate-prod` lief. Entscheidung Donald 2026-08-12: die
      API-Hälfte vor PROD, die gerenderte danach am echten System.
- [x] 9.4 Bild hochladen, mehrere Bilder, Reihenfolge, einzeln löschen — von
      Hand durchgespielt. Sechs Ziffernbilder 1–6, damit die Reihenfolge im Bild
      ablesbar ist: Nachwählen **erweitert** die Auswahl, „Bild 2 entfernen"
      nimmt genau 2, das siebte wird benannt abgelehnt, und nach dem Posten
      trägt `post_media` `sort` 0–5 mit den passenden Maßen. `EVIDENCE.md`.
- [x] 9.5 Jeder Tag genau einmal; kuratierte und freie unterscheidbar, beide
      klickbar; Filter funktioniert. Gemessen am schärfsten Fall: `#Netzwerken`
      im Text **und** als kuratierter Chip gewählt ergibt **einen** Chip; ein mit
      `ö` getipptes `#Persönlichkeitsentwicklung` wird als kuratiert erkannt
      (die Falle aus `design.md` fällt nicht). `EVIDENCE.md`.
- [x] 9.6 Feed in beiden Themes und auf dem Telefon gegen das Mockup gehalten.
      **Erst eine laufende lokale Version zeigen, dann committen** — grüne
      Tests haben in AGE-492 ein visuell falsches Ergebnis durchgewunken.
      Genau das ist hier eingetreten: die **Lightbox war in der Beitragskarte
      gefangen** (847×615 statt 1280×900), weil `.fbc-card:hover` einen
      `transform` setzt und ein transformierter Vorfahr den Bezugsrahmen für
      `position: fixed` bildet. jsdom rechnet kein Layout, deshalb war das in
      drei Suiten grün. Behoben mit einem Portal an `document.body`, Zusicherung
      strukturell und vorher rot, Gegenprobe mit erzwungenem Transform.
      Zwei Beobachtungen ohne Diff (3+1-Raster bei vier Kacheln, Chip-Schreib-
      weise) stehen in `EVIDENCE.md` und sind Donalds Entscheidung.
- [x] 9.7 QA-Gate (`qa`) auf der Oberfläche. Standard-Stufe, 98/100, **kein
      kritischer, hoher oder mittlerer Befund — und deshalb kein Diff**.
      Gemessen im Browser gegen den lokalen Stack, nicht in jsdom: Lightbox
      erreicht Bild 5 und 6 und läuft um, Tastatur trägt, Tag-Filter schaltet
      4 → 3 Beiträge und wieder zurück, der leere Filterzustand unterscheidet
      die beiden Fälle, und auf 375 px steht die Leiste vor dem Feed (Task 8.4,
      die einzige Aussage, die in jsdom nicht messbar war).
      **Der ganze Schreibweg von Hand:** zwei PNG → client-seitig nach WebP
      gewandelt → hochgeladen → `create_post_with_media` 200 → im Feed sofort
      sichtbar, `hashtags` je genau einmal, obwohl `Netzwerken` getippt **und**
      geklickt war. Damit ist der Composer-Weg nicht nur von der Sonde, sondern
      auch von einem echten Browser gelaufen.
      Zwei niedrige Befunde bleiben liegen, beide mit Begründung: die Seite
      scrollt hinter der offenen Lightbox (dieses Repo kennt **nirgends** eine
      Scroll-Sperre — eine nur hier wäre die Ausnahme), und auf dem Telefon
      verdeckt der feste Feedback-Knopf die Kachel „Frage" (fremdes Widget,
      nach 150 px Scrollen frei). Bericht:
      `.gstack/qa-reports/qa-report-aktivitaet-2026-08-12.md`.

## 10 · Abschluss

- [~] 10.1 Fremd-Review **auf dem Diff** (Schritt 4), nicht auf dem Plan.
      `DIFF-REVIEWS.md`. **Nur EIN Anbieter war fremd** (`codex`); der zweite
      Lauf war als CodeRabbit angesetzt, aber dessen CLI ist auf dieser Maschine
      nicht installiert, und der Agent hat das Review dann selbst gemacht — also
      als Claude, derselbe Anbieter, der den Diff geschrieben hat. Steht so im
      Kopf der Datei. Zwei HIGH-Befunde, beide behoben und mit vorher rotem
      Test belegt; zwei falsche Sätze in Entscheidungs-Köpfen korrigiert und die
      fehlenden Indizes gemessen nachgelegt.
      **Offen:** ein zweiter echter Fremd-Anbieter, falls die Deckung gebraucht
      wird — und die Produktentscheidung zu Bildern 4–6 (siehe unten).
- [x] 10.1a **Produktentscheidung, Donald: Lightbox nachziehen.** Schema,
      Trigger und Composer erlauben sechs Bilder; das Raster zeigt vier, und die
      vierte liegt unter dem „+n" — ohne diesen Weg veröffentlicht jemand
      Bilder, die kein Leser erreicht. Am 2026-08-12 so entschieden; die
      Alternative (Auswahl auf vier begrenzen) hätte die Sechser-Grenze in
      Schema und Trigger auseinanderfallen lassen.
      Bewusst schmal: vor, zurück, zu — kein Zoom, kein Wischen, keine
      Miniaturenleiste. Tastatur trägt mit (Escape, Pfeile), der Fokus wandert
      nur beim Öffnen. Die Zusicherung ist das **fünfte** Bild, weil das im
      Raster nie gezeichnet wird; Gegenprobe: ein fester Startindex lässt sie
      fallen.
      **Dabei mitgefunden, vom Review nicht genannt:** `bildLayout` zählte über
      alle Bildzeilen, während abgelehnte Pfade beim Zeichnen entfielen. Bei
      einem abgelehnten vierten Bild verschwand das „+n" ersatzlos, und der Rest
      war weder sichtbar noch angekündigt. Gezählt wird jetzt, was gezeigt
      werden kann.
- [x] 10.2 `cso`-Gate: die Storage-Policies noch einmal gegen die Frage lesen,
      ob irgendein Pfad ohne Session zu einem `members`-Bild führt.
      Sieben Wege geprüft, keiner führt hin; Tabelle in `EVIDENCE.md`. Der
      siebte war neu und stammt aus diesem Block: der **Alt-Text** der Bilder
      trägt den Autornamen — er nimmt `displayAuthor(...)`, also ausgeloggt
      „Ein Mitglied". Der einzige benannte Rest bleibt die 1-h-Nachlaufzeit
      einer schon ausgestellten Signatur.
- [x] 10.3 PR gegen `main`, Conventional Commit mit `(AGE-528)`.
      **Merge-Erfolg mit `gh pr view --json state` prüfen** — `gh pr merge` kann
      still fehlschlagen.
      **PR #159**, 17 Commits, 37 Dateien. Checks auf der HEAD-SHA gelesen
      (nicht `gh run list`, das zeigt grün für eine alte SHA): `verify`,
      `migrations`, `deploy`, `edge-functions`, `pr-title` bestanden;
      `drift-gate`, `migrate-dev` und `functions` übersprungen — auf einem PR
      erwartet, sie hängen an `main`. Linear schaltete den Status selbst auf
      In Progress und hängte den PR an, es war kein Schreibzugriff nötig.
      Die zwei niedrigen QA-Befunde liegen als **AGE-529** im Backlog.
- [ ] 10.4 Reihenfolge des Ausrollens, erzwungen und schon einmal falsch notiert:
      Merge → `migrate-dev` grün für **dieselbe SHA auf `main`** → `migrate-prod`
      dispatchen (`plan` **lesen**, dann `apply`) → **`deploy.yml` erneut
      laufen lassen**. Ohne diesen Re-Run ist nichts ausgeliefert, obwohl alles
      grün aussieht. `drift-gate` blockt den Deploy bis `migrate-prod` lief.
      **Stand 2026-08-12:** Merge `df37349` · `migrate-dev` grün für genau diese
      SHA · `migrate-prod` (Lauf 31605508737) dispatcht, `plan` **gelesen** statt
      durchgeklickt: Zielhost `viwntbodrtqxgmqyxluh` auf
      `aws-0-eu-central-1.pooler.supabase.com`, Drift nannte die vier fehlenden
      Versionen, der Dry-Run kündigte genau diese vier an — dann `apply`, alle
      vier angewendet, und die Nachkontrolle im selben Job sagt
      „**OK — 60 Migrationen, Historie abweichungsfrei**".
      **Offen: der `deploy.yml`-Re-Run.** `deploy.yml` hat *kein*
      `workflow_dispatch` (nur `push: [main]` und `pull_request`) — der Re-Run
      geht deshalb über `gh run rerun 31603101953 --failed`, nicht über
      `gh workflow run`. `deploy` und `functions` hängen beide an
      `[migrate-dev, drift-gate]`, und drift-gate war der Job, der fiel.
- [x] 10.5 PROD **nachmessen**, nicht glauben: Bucket privat mit 1 MiB/WebP,
      vier Storage-Policies, `post_media` und `tags` mit ihren Grants.
      `scripts/mess-10-5-prod.ts --prod=viwntbodrtqxgmqyxluh`, **nur lesend**
      (die Sitzung steht auf `default_transaction_read_only`, damit ein
      versehentliches Schreiben von der Datenbank abgelehnt würde und nicht von
      einem Kommentar). **Zwölf von zwölf.** Einzelheiten in `EVIDENCE.md`;
      hervorzuheben ist die Grants-Zeile, weil genau sie hier zweimal teuer war:
      `post_media` trägt `anon=SELECT`, `authenticated=SELECT,INSERT,DELETE`,
      `tags` trägt `anon=SELECT`, `authenticated=SELECT`. Nichts davon ist
      geerbt — es steht so in den Migrationen (AGE-312).
- [ ] 10.6 `openspec archive` — **Szenario-Titel unverändert lassen**, ein
      umgetaufter Titel in einem MODIFIED-Block löscht das alte Szenario;
      `validate` bleibt dabei grün, nur `archive` bricht ab.
- [ ] 10.7 Linear AGE-528 auf Done — erst `get_issue` lesen, die
      GitHub-Automation schaltet den Status womöglich schon selbst.
