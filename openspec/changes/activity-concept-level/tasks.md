## 1. Icon-Satz und Bereichs-Kanon

- [ ] 1.1 Den Icon-Satz anlegen: `Name → Pfade`, ein Stil (24er-Viewbox,
      `currentColor`, gleiche Strichstärke und Endenform), ohne Icon-Bibliothek
- [ ] 1.2 Die elf Menü-Glyphen aus `NavIcon.tsx` in den Satz überführen; `NavIcon`
      bleibt als Bauteil bestehen und bezieht sie von dort (gefüllte Fassung
      inbegriffen)
- [ ] 1.3 Die neun Streu-Glyphen auflösen: `ChevronLeftIcon`, `BellIcon`,
      `MenuIcon`, `ChevronDownIcon` (`AppShell.tsx`), `FeedbackIcon`, `SearchIcon`,
      `HeartIcon`, `CalendarIcon`, `CommentIcon`
- [ ] 1.4 Den doppelten `CrownIcon` auflösen — er steht byte-gleich in
      `mein-bereich/building-blocks.tsx` und `profile/ProfileHero.tsx`
- [ ] 1.5 `matching/CategoryIcon.tsx` in den Satz überführen; das Bauteil bleibt,
      sein eigener `Record` entfällt
- [ ] 1.6 **Die Ausnahmen namentlich festlegen** und begründen: Markenmarke
      (eigene Anforderung), `CompassMark.tsx`, `Avatar.tsx`, sowie die
      Diagramm-Vektoren in `profil-widgets.tsx`, `AdminMitgliederPage.tsx`,
      `EventDetailPage.tsx`, `MeineChancenPage.tsx`. Gemessen: SVGs liegen in **14**
      Dateien außerhalb `src/vision`, nicht in neun
- [ ] 1.7 Den erzwingenden Test bauen — **ein Mechanismus, keine Absicht**: er
      läuft gegen den Quellbaum, führt die Ausnahmen aus 1.6 als benannte Liste und
      fällt, sobald ein neuer Glyph außerhalb des Satzes entsteht
- [ ] 1.8 Gegenprobe: einen Glyph versuchsweise wieder in eine Feature-Datei legen
      und belegen, dass der Test rot wird (sonst prüft er nichts)
- [ ] 1.9 Bereichsfarben als Tokens in `src/index.css` — **einmal** definiert, im
      Inhaltsschicht-Block. **Nicht** je Theme: der navy-Block überschreibt
      absichtlich nur Chrome
- [ ] 1.10 Kontrast der sieben Farben gegen `--color-canvas` **messen** und die
      Zahl festhalten; „erkennbar" ist nicht abnehmbar
- [ ] 1.11 Den Kanon `Bereich → { icon, farbToken }` als **eine** Modulkonstante
      anlegen; Bedien-Symbole stehen ausdrücklich nicht darin
- [ ] 1.12 Test: kein Bereichs-Token erscheint an einem Link, Knopf, Fokusring oder
      aktiven Zustand — die Abgrenzung zum interaktiven Akzent ist der Grund, aus
      dem die bestehende Anforderung geändert werden durfte
- [ ] 1.13 Kanon auf die bestehenden Karten anwenden: Dashboard, Events,
      Mitgliederverzeichnis, Aktivität
- [ ] 1.14 Sichtprobe im Browser gegen den lokalen Stack: beide Themes, Kontrast
      auf Kartengrund, 375 px und breit

## 2. Speichern — `post_saves`

- [ ] 2.1 Migration: Tabelle `post_saves (profile_id, post_id, created_at)`,
      Primärschlüssel über beide, `on delete cascade` auf beiden Fremdschlüsseln,
      RLS an, Kopfkommentar mit Begründung und verworfener Alternative
- [ ] 2.2 Policies für SELECT, INSERT und DELETE: nur eigene Zeilen **und**
      `is_activated()` — wie `posts_write_own`, `likes_write_own` und
      `post_media_insert_own` es alle tragen
- [ ] 2.3 Grants aussprechen (`select, insert, delete` für `authenticated`, nichts
      für `anon`) — neue Tabellen erben hier nichts
- [ ] 2.4 `grants_test.sql` §1: Golden-String um die `post_saves`-Zeile ergänzen
- [ ] 2.5 pgTAP: fremde Zeile weder lesbar noch löschbar; zweimal speichern ergibt
      genau eine Zeile
- [ ] 2.6 pgTAP: ein unbestätigtes **und** ein deaktiviertes Konto kommen an
      `post_saves` nicht heran — weder lesend noch schreibend
- [ ] 2.7 `supabase test db` mit ausdrücklicher Dateiliste laufen lassen (ohne
      Liste meldet der Befehl FAIL, obwohl grün)

## 3. Beliebtheitszähler und Rechte auf den Quelltabellen

- [ ] 3.1 Vorher messen: Zahl der `posts`- und `post_likes`-Zeilen auf PROD lesen,
      damit der Nachtrag eine gemessene und keine geschätzte Größe hat
- [ ] 3.2 **Zuerst die Quelle dichtmachen:** pgTAP, das den Angriffsablauf
      nachstellt — reagieren auf A, Zeile per UPDATE auf B verschieben, Reaktion
      zurücknehmen. Der Test ist **rot**, solange das UPDATE-Recht besteht
- [ ] 3.3 Migration: `revoke update on public.post_likes from authenticated`;
      `grants_test.sql` §1 nachziehen. Der Client schreibt die Tabelle nur per
      `upsert` und `delete` — belegen, nicht annehmen
- [ ] 3.4 Migration: `like_count` auf `posts`, Trigger auf `post_likes`
      (INSERT/DELETE), Nachtrag für den Bestand — alles in einer Transaktion
- [ ] 3.5 Triggerfunktion härten: `set search_path`, `execute` für `public`, `anon`
      und `authenticated` entziehen; pgTAP-Zusagen dafür
- [ ] 3.6 Index für die neue Ordnung `(like_count desc, created_at desc, id desc)`;
      `EXPLAIN` vorher und nachher, beide Ausgaben festhalten
- [ ] 3.7 pgTAP: eine Reaktion und ihre Rücknahme führen die Zahl auf den
      Ausgangswert zurück
- [ ] 3.8 pgTAP: die Zahl an der Zeile stimmt für jeden Beitrag mit `like_count`
      aus `post_engagement_counts` überein
- [ ] 3.9 **Alle** Schreibwege auf `posts` suchen, nicht nur in `src/` — Edge
      Functions eingeschlossen; das Ergebnis im Task festhalten
- [ ] 3.10 **Belegen, bevor entzogen wird:** pgTAP, dass ein Beitrag über
      `create_post_with_media` auch **ohne** INSERT-Recht auf `posts` entsteht —
      Voraussetzung für 3.11, nicht seine Bestätigung
- [ ] 3.11 Migration: `revoke insert, update on public.posts from authenticated`,
      danach `grant update (body, hashtags, visibility)`
- [ ] 3.12 pgTAP: ein direktes UPDATE auf `like_count` des eigenen Beitrags wird
      verweigert; Bearbeiten von Text, Schlagworten und Sichtbarkeit gelingt weiter
- [ ] 3.13 `grants_test.sql` §1 (`posts` ohne INSERT, `post_likes` ohne UPDATE)
      **und** §2 (`posts` in die `table_name in (...)`-Liste, neue Zeile
      `posts.UPDATE=body,hashtags,visibility`) im selben Commit nachziehen

## 4. Aggregate für die Sidebar

- [ ] 4.1 `feed_tag_counts()`: **`security invoker`**, `stable`, `set search_path`,
      Obergrenze. Das Sichtbarkeitsprädikat wird **nicht kopiert** — unter der RLS
      des Aufrufers greift `posts_select_by_visibility` selbst
- [ ] 4.2 Gezählt wird über `public.tags` mit `active = true`, nicht über
      `unnest(posts.hashtags)`
- [ ] 4.3 `feed_top_authors(p_limit)`: dasselbe Vorgehen, Namen aus
      `profiles_public`, **fünf** Einträge, gezählt nach **Beiträgen**
- [ ] 4.4 Deterministischer Tie-Break für beide Funktionen; Verhalten bei
      ungültigem `p_limit` festlegen und zusagen
- [ ] 4.5 pgTAP: ein Tag an fünf Beiträgen, davon zwei sichtbar, zählt zwei
- [ ] 4.6 pgTAP: ein Tag ohne sichtbaren Beitrag erscheint **gar nicht** — auch
      nicht mit der Zahl null
- [ ] 4.7 pgTAP: ein freies oder stillgelegtes Schlagwort erscheint nicht
- [ ] 4.8 pgTAP: ein deaktiviertes Mitglied fällt aus „Aktivste Mitglieder", und
      seine Beiträge zählen für niemanden mit
- [ ] 4.9 `EXPLAIN` für beide Funktionen messen; entscheiden und festhalten, ob
      `hashtags` einen GIN-Index braucht — er käme auch `.overlaps()` zugute
- [ ] 4.10 Grants für beide Funktionen aussprechen und prüfen, ob eine
      Funktionszeile im Golden-Snapshot betroffen ist

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
