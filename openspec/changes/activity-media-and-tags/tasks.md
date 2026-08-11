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
- [ ] 1.0c Sonde **zusätzlich gegen DEV** laufen lassen, bevor Block 2 dort
      landet. Ein grüner lokaler Lauf sagt nichts über DEV, wenn die
      Supabase-Versionen auseinanderliegen (Befund aus dem Plan-Review).
- [x] 1.1 **Verzweigung — nicht eingetreten.** Die Sonde ist grün
      (`EVIDENCE.md`): alle sechs Fälle erfüllt, 120 Signaturen in 17 ms. Der
      Rückfallweg (Edge Function mit `service_role`) wird nicht gebraucht,
      `design.md` bleibt unverändert.

## 2 · Migration A — `post_media`, Bucket, Policies

Datei: `supabase/migrations/20260812090000_post_media.sql`
Datei: `supabase/migrations/20260812090100_post_media_storage.sql`

- [ ] 2.1 **RED**: neuer Abschnitt in `supabase/tests/rls_test.sql` mit den
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
- [ ] 2.2 Tabelle `public.post_media` anlegen: Spalten nach Spec, FK
      `on delete cascade`, RLS an, **`unique (post_id, sort)`** und
      **`unique (storage_path)`**. Der zweite Index ist nicht Kosmetik: die
      Sichtbarkeitsfunktion sucht über genau diese Spalte (2.7), und zwei Zeilen
      auf denselben Pfad machten die Antwort mehrdeutig.
- [ ] 2.3 Grants **aussprechen**, nicht erben: seit AGE-312 erbt eine neue
      Tabelle nichts. `authenticated` bekommt SELECT/INSERT/DELETE, `anon`
      SELECT. Ohne SELECT für `anon` kann die Storage-Policy für den
      ausgeloggten Besucher nicht ausgewertet werden.
- [ ] 2.4 RLS-Policies auf `post_media`: lesen wie der Beitrag, schreiben nur
      als Autor des Beitrags und nur mit `public.is_activated()`.
- [ ] 2.5 „Höchstens sechs Bilder pro Beitrag" als **Trigger**, nicht als
      `check` — es ist eine Zählung über andere Zeilen, und die kann eine
      Check-Constraint nicht ausdrücken (Befund aus dem Plan-Review). Der
      verbleibende Wettlauf zwischen gleichzeitigen Inserts ist hier
      unerheblich: der einzige Schreibweg ist die RPC aus 2.13, und die schreibt
      alle Zeilen eines Beitrags in einer Anweisung.
- [ ] 2.6 Bucket `post-media` anlegen: `public = false`, `file_size_limit`
      1 MiB, `allowed_mime_types` `{image/webp}`. **`on conflict (id) do update`**,
      nicht `do nothing` — ein bestehender Bucket mit falschen Einstellungen
      würde sonst konserviert und der Test liefe grün gegen eine falsche
      Konfiguration (Befund aus dem C6-Review).
- [ ] 2.7 `public.post_media_lesbar(text)` als `SECURITY DEFINER`: sucht die
      `post_media`-Zeile über `storage_path = <objektname>` und wertet das
      Prädikat von `posts_select_by_visibility` für **deren** Beitrag aus.
      **Den Pfad NICHT zerlegen** — der Objektname ist frei wählbar, und eine
      daraus geschnittene `postId` würde eine fremde Sichtbarkeit behaupten
      (HIGH-nahe Falle aus dem Plan-Review, Begründung in `design.md`).
      Execute-Recht für `anon` und `authenticated`, sonst entzogen.
- [ ] 2.7a **RED dazu**: ein Objekt unter `{eigene-uid}/{fremde-members-postId}/x.webp`
      hochladen und als anon signieren wollen → **abgelehnt**. Dieser Fall ist
      der Grund für 2.7 und muss eigenständig rot gewesen sein.
- [ ] 2.8 Vier Storage-Policies: SELECT für `anon` **und** `authenticated` über
      2.7, INSERT/UPDATE/DELETE auf `{uid}/`-Präfix mit `is_activated()`.
- [ ] 2.9 **GREEN**: `supabase test db --local supabase/tests/rls_test.sql
      supabase/tests/grants_test.sql` — alle Fälle aus 2.1 grün.
- [ ] 2.10 `grants_test.sql` nachziehen (Golden-String **und**
      Spalten-Grants-Assertion), sonst ist der `migrations`-Job rot.
- [ ] 2.11 Migrationskopf schreiben: signiert, datiert, mit Begründung und
      **verworfener Alternative** (zwei Buckets nach Sichtbarkeit) — so wie es
      in diesem Repo üblich ist. Die 1-h-Gültigkeit der Signaturen gehört
      dorthin, samt ihrer Folge für die Nachlaufzeit eines
      Sichtbarkeitswechsels.
- [ ] 2.13 RPC `public.create_post_with_media(...)` als `SECURITY DEFINER`:
      legt Beitrag **und** `post_media`-Zeilen in **einer Transaktion** an,
      erzwingt Autorschaft, die Sechser-Grenze und die Tag-Vereinigung. Grund
      und Ablauf in `design.md` („Veröffentlichen ist ein Schritt, nicht drei").
      Sie ersetzt keine Policy — `posts_write_own` bleibt.
- [ ] 2.13a **RED dazu**: schlägt das Anlegen einer `post_media`-Zeile fehl,
      existiert **kein** Beitrag. Kein halb veröffentlichter Zustand.

## 3 · Migration B — `tags` mit Startbefüllung

Datei: `supabase/migrations/20260812090200_tags.sql`

- [ ] 3.1 **RED**: pgTAP — `tags` ist für `anon` und `authenticated` lesbar,
      für beide **nicht** schreibbar (redaktionelle Liste, kein Mitgliedsinhalt).
      Dazu die Schlüsselform: ein `key` mit Großbuchstabe wird abgelehnt, einer
      mit Leerzeichen oder Bindestrich ebenso; `persönlichkeitsentwicklung`
      (mit Umlaut) wird angenommen.
- [ ] 3.2 Tabelle `public.tags` (`key` PK, `label`, `sort`, `active`), RLS an,
      SELECT-Policy für beide Rollen, kein Schreibrecht.
- [ ] 3.3 Grants aussprechen (SELECT für `anon`, `authenticated`).
- [ ] 3.4 Startbefüllung: **15 Tags aus dem Mockup**, elf Themen und vier
      Formate (Liste und Begründung in `design.md`). **Nicht** die
      Kompass-Kategorien — die sind Matching-Kategorien und es sind 14, nicht
      elf (siehe `design.md`). Von Donald am 2026-08-11 freigegeben; eine
      spätere Korrektur mit Detlev ist ein Insert, keine Migration.
- [ ] 3.4a `check (key = lower(key))` **und** `check (key ~ '^[\p{L}\p{N}_]+$')`.
      Ohne beide zerfällt derselbe Tag in zwei Werte, je nachdem ob er getippt
      oder geklickt wurde — Begründung in `design.md`, Testfall in 3.1.
- [ ] 3.5 **GREEN** + `grants_test.sql` nachziehen.
- [ ] 3.6 `posts.hashtags` bleibt **unangetastet**. Keine Verknüpfungstabelle,
      keine Datenwanderung. Wer hier eine anlegt, hat die Entscheidung aus
      `design.md` übergangen.

## 4 · Die Tag-Doppelanzeige beheben

- [ ] 4.1 **RED**: `src/components/community/CommunityFeed.test.tsx` — die
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
- [ ] 4.2 In `PostBody` (`CommunityFeed.tsx:401–412`) den Hashtag-Zweig auf
      normalen Text umstellen. Erwähnungen (`:413`) und URLs (`:429`) bleiben
      Verweise. Die Chip-Reihe (`:331–348`) bleibt unverändert.
- [ ] 4.3 **GREEN** + zweiter Fall: Erwähnung und URL im selben Beitrag sind
      weiterhin Verweise.
- [ ] 4.4 `tokenizePostBody` und `parseHashtags` bleiben unverändert — die
      Segmente werden weiter gebraucht, nur anders gezeichnet.

## 5 · Datenschicht für Medien und Tags

- [ ] 5.1 `src/lib/image.ts`: reine Funktion `zielMasse(w, h, maxEdge)` +
      `shrinkToWebp(file, opts)`. **Getestet wird die reine Funktion** (4032×3024
      → 1600×1200; kleines Bild unverändert) — jsdom hat keinen 2D-Kontext, ein
      Canvas-Test könnte nur behaupten, dass nichts wirft.
- [ ] 5.1a Fehlerfall benennen: scheitert `shrinkToWebp` (unlesbares Format,
      Speichergrenze), wird **sofort** eine konkrete Meldung gezeigt und **gar
      nicht** hochgeladen. Sonst läuft der Nutzer in einen späten,
      nichtssagenden Serverfehler am 1-MiB-Limit (Befund aus dem Plan-Review).
- [ ] 5.2 `src/lib/post-media.ts`: hochladen nach `{uid}/{postId}/{i}-{ts}.webp`
      (Beitrags-`id` **im Client** erzeugt, siehe 2.12), einzeln löschen, und
      **gebündeltes** `createSignedUrls` je Feed-Seite.
- [ ] 5.2a `createSignedUrls` kann **einzelne** Pfade ablehnen — in der Sonde
      gemessen (Fall F: 4 von 5, der Stapel wird nicht verworfen). Je Bild
      behandeln: ein abgelehntes Bild lässt seine Kachel weg, es darf nie den
      ganzen Beitrag verschlucken.
- [ ] 5.2b **Eine Ablehnung ist kein Fehler und gehört NICHT an Sentry.** Die
      Sonde hat gezeigt, dass der Storage „Object not found" meldet, wo er
      „nicht erlaubt" meint — er unterscheidet die beiden Fälle nach außen
      bewusst nicht (keine Aufzählbarkeit). Für ein Bild, das den Betrachter
      nichts angeht, ist das der Normalfall; wer es meldet, meldet Rauschen.
- [ ] 5.3 Signierte URLs pro Pfad in react-query cachen, `staleTime` 50 min bei
      1 h Gültigkeit. Ohne das lädt der Browser bei jedem Render jedes Bild neu.
      **Plus**: ein Bildfehler (403 nach Ablauf in einem lange offenen Tab)
      löst ein Nachsignieren aus, statt eine kaputte Kachel stehen zu lassen.
- [ ] 5.4 `src/lib/tags.ts`: aktive kuratierte Tags lesen, `istKuratiert(key)`.
- [ ] 5.5 `fetchFeed` auf Seiten zu 20 umstellen, `post_media` mitlesen. Der
      Cursor läuft über **`(created_at, id)`**, nicht über `created_at` allein —
      bei gleichen Zeitstempeln überspränge er sonst Beiträge, und genau das
      wird beim Import der ~70 Konten wahrscheinlich (Befund aus dem
      Plan-Review). Der bestehende Hashtag-Filter
      (`.contains("hashtags", […])`) bleibt unverändert.
- [ ] 5.6 `database.types.ts` **von Hand** um `post_media` und `tags` ergänzen.
- [ ] 5.7 Tests: Cursor-Logik (**inklusive gleicher Zeitstempel**),
      Tag-Vereinigung und `istKuratiert` als reine Funktionen. Keine Mocks auf
      eigene Module.

## 6 · Composer nach Mockup

- [ ] 6.1 Ruhige Zeile, die sich beim Klick öffnet (Mockup: Avatar +
      „Was möchtest du mit der Community teilen?").
- [ ] 6.2 Bildauswahl mit Vorschau, Reihenfolge, einzeln entfernen, **hart auf
      sechs begrenzt** — mit sichtbarer Rückmeldung, nicht stillem Verschlucken.
- [ ] 6.3 Video-Link bleibt ein eigenes Feld; `parseVideoUrl` entscheidet
      weiterhin. **Kein Upload.** Gespeichert wird er wie heute: an den Body
      angehängt (`CommunityFeed.tsx:104–108`) und beim Rendern über `skipRaw`
      unterdrückt, damit er nicht als Link **und** als Einbettung erscheint.
      **Kein neues Feld am Schema** — das Plan-Review hat zu Recht bemängelt,
      dass dieser Weg nirgends ausgesprochen war.
- [ ] 6.4 Tag-Auswahl aus den aktiven kuratierten Tags plus Freitext.
- [ ] 6.4a Beim Veröffentlichen werden getippte und geklickte Tags
      **vereinigt und dedupliziert** (`design.md`, „Tags werden vereinigt").
      Der Fall, der sonst durchrutscht: jemand tippt `#Netzwerken` **und**
      klickt denselben Tag — ohne Vereinigung steht er zweimal in `hashtags`
      und erscheint als doppelter Chip, also genau der Bug, den Block 4 behebt.
- [ ] 6.5 Sichtbarkeit wie bisher, `members` als Vorgabe.
- [ ] 6.6 Test: veröffentlichen mit zwei Bildern und zwei Tags legt zwei
      `post_media`-Zeilen in Reihenfolge an. **Vorbelegter Context prüft die
      falsche Zeitachse** — kommt ein Wert erst nach dem Mount, nimmt
      `useState(wert)` ihn nie an. Wo das droht, zusätzlich Sichtprobe.

## 7 · Beitragskarte und Bildlayout

- [ ] 7.1 Karte nach Mockup: Autor mit Avatar und Stufen-Badge, Zeit,
      Sichtbarkeits-Hinweis, Text, Medien, Chips, darunter Reaktion und
      Kommentare. **Eine** Reaktionsart (Herz) — wie im Mockup.
- [ ] 7.2 Bildlayout: eins groß, zwei nebeneinander, drei und mehr als Raster
      mit vier Kacheln; die vierte trägt „+n". Maße aus `width`/`height`, damit
      nichts springt.
- [ ] 7.3 Kuratierte Chips gefüllt, freie als Outline; beide klickbar.
- [ ] 7.4 Test für die Layout-Wahl als reine Funktion (1/2/3/5 Bilder).

## 8 · Tag-Filterleiste

- [ ] 8.1 Sichtbare Leiste mit den aktiven kuratierten Tags, rechte Spalte nach
      Mockup — **nur der Filter**, nicht „Beliebte Tags" mit Zählern und nicht
      „Aktivste Mitglieder" (siehe Non-goals).
- [ ] 8.2 Der bestehende Chip-Klick-Filter arbeitet unverändert weiter.
- [ ] 8.3 Leerer Zustand aus C2 greift weiterhin und unterscheidet „nichts da"
      von „nichts zu diesem Filter".
- [ ] 8.4 Auf dem Telefon: die Leiste liegt über dem Feed, nicht daneben.

## 9 · Abnahme

- [ ] 9.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` grün.
- [ ] 9.2 pgTAP vollständig grün, mit **Dateiliste** aufgerufen.
- [ ] 9.3 **Der Beweis** (Tabelle in `design.md`), im Inkognito-Fenster gegen
      DEV, mit Screenshot bzw. Statuscode je Zeile:
      `members` → rohe URL kein Bild, Signatur als anon abgelehnt;
      `public` → Bild im ausgeloggten Feed sichtbar.
- [ ] 9.4 Bild hochladen, mehrere Bilder, Reihenfolge, einzeln löschen — von
      Hand durchgespielt.
- [ ] 9.5 Jeder Tag genau einmal; kuratierte und freie unterscheidbar, beide
      klickbar; Filter funktioniert.
- [ ] 9.6 Feed in beiden Themes und auf dem Telefon gegen das Mockup gehalten.
      **Erst eine laufende lokale Version zeigen, dann committen** — grüne
      Tests haben in AGE-492 ein visuell falsches Ergebnis durchgewunken.
- [ ] 9.7 QA-Gate (`qa`) auf der Oberfläche.

## 10 · Abschluss

- [ ] 10.1 Fremd-Review **auf dem Diff** (Schritt 4), nicht auf dem Plan.
- [ ] 10.2 `cso`-Gate: die Storage-Policies noch einmal gegen die Frage lesen,
      ob irgendein Pfad ohne Session zu einem `members`-Bild führt.
- [ ] 10.3 PR gegen `main`, Conventional Commit mit `(AGE-528)`.
      **Merge-Erfolg mit `gh pr view --json state` prüfen** — `gh pr merge` kann
      still fehlschlagen.
- [ ] 10.4 Reihenfolge des Ausrollens, erzwungen und schon einmal falsch notiert:
      Merge → `migrate-dev` grün für **dieselbe SHA auf `main`** → `migrate-prod`
      dispatchen (`plan` **lesen**, dann `apply`) → **`deploy.yml` erneut
      laufen lassen**. Ohne diesen Re-Run ist nichts ausgeliefert, obwohl alles
      grün aussieht. `drift-gate` blockt den Deploy bis `migrate-prod` lief.
- [ ] 10.5 PROD **nachmessen**, nicht glauben: Bucket privat mit 1 MiB/WebP,
      vier Storage-Policies, `post_media` und `tags` mit ihren Grants.
- [ ] 10.6 `openspec archive` — **Szenario-Titel unverändert lassen**, ein
      umgetaufter Titel in einem MODIFIED-Block löscht das alte Szenario;
      `validate` bleibt dabei grün, nur `archive` bricht ab.
- [ ] 10.7 Linear AGE-528 auf Done — erst `get_issue` lesen, die
      GitHub-Automation schaltet den Status womöglich schon selbst.
