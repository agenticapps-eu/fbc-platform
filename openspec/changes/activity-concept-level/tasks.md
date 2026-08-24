## 1. Icon-Satz und Bereichs-Kanon

- [ ] 1.1 Den Icon-Satz anlegen: `Name → Pfade`, ein Stil (24er-Viewbox,
      `currentColor`, gleiche Strichstärke und Endenform), ohne Icon-Bibliothek
- [ ] 1.2 Die elf Menü-Glyphen aus `NavIcon.tsx` in den Satz überführen; `NavIcon`
      bleibt als Bauteil bestehen und bezieht sie von dort (gefüllte Fassung
      inbegriffen)
- [ ] 1.3 Die neun Streu-SVGs auflösen: `ChevronLeftIcon`, `BellIcon`, `MenuIcon`,
      `ChevronDownIcon` (`AppShell.tsx`), `FeedbackIcon`, `SearchIcon`,
      `HeartIcon`, `CalendarIcon`, `CommentIcon`
- [ ] 1.4 Den doppelten `CrownIcon` auflösen — er steht byte-gleich in
      `mein-bereich/building-blocks.tsx` und `profile/ProfileHero.tsx`; beide
      Aufrufstellen ziehen künftig aus dem Satz
- [ ] 1.5 `matching/CategoryIcon.tsx` in den Satz überführen; das Bauteil bleibt,
      sein eigener `Record` entfällt
- [ ] 1.6 Test: kein `<svg>` außerhalb des Satzes im Quellbaum, kein Glyph zweimal
      (der Test läuft gegen den Baum, nicht gegen eine gepflegte Liste)
- [ ] 1.7 Bereichsfarben als Tokens in `src/index.css` — für jeden Bereich eine
      Vollfarbe und eine gedämpfte Fläche, **in beiden Theme-Blöcken**
- [ ] 1.8 Test: jede Bereichsfarbe hat in beiden Blöcken einen Wert (rot, solange
      ein Token nur im hellen Block steht)
- [ ] 1.9 Den Kanon `Bereich → { icon, farbToken }` als **eine** Modulkonstante
      anlegen; Bedien-Symbole stehen ausdrücklich nicht darin
- [ ] 1.10 Kanon auf die bestehenden Karten anwenden: Dashboard, Events,
      Mitgliederverzeichnis, Aktivität
- [ ] 1.11 Sichtprobe im Browser gegen den lokalen Stack: beide Themes, Kontrast
      der Icons auf Kartengrund, 375 px und breit

## 2. Speichern — `post_saves`

- [ ] 2.1 Migration: Tabelle `post_saves (profile_id, post_id, created_at)`,
      Primärschlüssel über beide, `on delete cascade` auf beiden Fremdschlüsseln,
      RLS an, Kopfkommentar mit Begründung und verworfener Alternative
- [ ] 2.2 Policy: Lesen, Anlegen und Löschen **nur eigener** Zeilen; kein Weg, an
      fremde Speicherungen zu kommen — auch nicht als Zahl
- [ ] 2.3 Grants aussprechen (`select, insert, delete` für `authenticated`, nichts
      für `anon`) — neue Tabellen erben hier nichts
- [ ] 2.4 `grants_test.sql` §1: Golden-String um die `post_saves`-Zeile ergänzen
- [ ] 2.5 pgTAP in `rls_test.sql`: fremde Zeile weder lesbar noch löschbar;
      zweimal speichern erzeugt genau eine Zeile
- [ ] 2.6 `supabase test db` mit ausdrücklicher Dateiliste laufen lassen (ohne
      Liste meldet der Befehl FAIL, obwohl grün)

## 3. Beliebtheitszähler und Rechte auf `posts`

- [ ] 3.1 Vorher messen: Zahl der `posts`- und `post_likes`-Zeilen auf PROD lesen,
      damit der Nachtrag eine gemessene und keine geschätzte Größe hat
- [ ] 3.2 Migration: `like_count` auf `posts`, Trigger auf `post_likes`
      (INSERT/DELETE), Nachtrag für den Bestand — alles in einer Transaktion
- [ ] 3.3 pgTAP: eine Reaktion und ihre Rücknahme führen die Zahl auf den
      Ausgangswert zurück
- [ ] 3.4 pgTAP: die Zahl an der Zeile stimmt für jeden Beitrag mit `like_count`
      aus `post_engagement_counts` überein
- [ ] 3.5 **Belegen, bevor entzogen wird:** pgTAP, dass ein Beitrag über
      `create_post_with_media` auch **ohne** INSERT-Recht auf `posts` entsteht —
      dieser Test ist die Voraussetzung für 3.6, nicht seine Bestätigung
- [ ] 3.6 Migration: `revoke insert, update on public.posts from authenticated`,
      danach `grant update (body, hashtags, visibility)`
- [ ] 3.7 pgTAP: ein direktes UPDATE auf `like_count` des eigenen Beitrags wird
      verweigert; Bearbeiten von Text, Schlagworten und Sichtbarkeit gelingt
      weiterhin
- [ ] 3.8 `grants_test.sql` §1 (posts-Zeile ohne INSERT) **und** §2 (`posts` in die
      `table_name in (...)`-Liste, neue Zeile `posts.UPDATE=body,hashtags,visibility`)
      im selben Commit nachziehen

## 4. Aggregate für die Sidebar

- [ ] 4.1 `feed_tag_counts()`: `security definer`, `stable`, `set search_path`,
      Obergrenze, **kein** `execute` für `anon`; Sichtbarkeitsprädikat wörtlich aus
      `posts_select_by_visibility`
- [ ] 4.2 `feed_top_authors(p_limit)`: dasselbe Prädikat, Namen ausschließlich aus
      `profiles_public`
- [ ] 4.3 pgTAP: beide Prädikat-Kopien werden festgehalten (Muster:
      `former_member_entries`, 20260823160000)
- [ ] 4.4 pgTAP: ein Tag an fünf Beiträgen, davon zwei sichtbar, zählt zwei
- [ ] 4.5 pgTAP: ein Tag ohne sichtbaren Beitrag erscheint **gar nicht** — auch
      nicht mit der Zahl null
- [ ] 4.6 pgTAP: ein deaktiviertes Mitglied fällt aus „Aktivste Mitglieder", und
      seine Beiträge zählen für niemanden mit
- [ ] 4.7 Grants für beide Funktionen aussprechen und im Golden-Snapshot prüfen,
      ob eine Funktionszeile betroffen ist

## 5. Datenschicht des Feeds

- [ ] 5.1 `FetchFeedArgs` um `reiter`, `ordnung`, `tags: string[]` und `typ`
      erweitern; `hashtag` (Einzahl) auf den neuen Weg führen, ohne den
      bestehenden Ein-Tag-Filter zu brechen
- [ ] 5.2 `.contains()` → `.overlaps()` für die Tags; Test, dass ein Beitrag mit
      nur **einem** von zwei gewählten Tags erscheint (rot gegen die alte Fassung)
- [ ] 5.3 Den Cursor auf die drei Ordnungen erweitern — je ein eigener Keyset-Pfad,
      bei „Beliebteste" über `(like_count, created_at, id)`
- [ ] 5.4 Test: mehr als 20 Beiträge mit **gleicher** Reaktionszahl; jeder erscheint
      auf genau einer Seite, keiner fällt zwischen zwei Seiten
- [ ] 5.5 Test: „Älteste zuerst" blättert vollständig, ohne einen Beitrag doppelt
      zu zeigen
- [ ] 5.6 Reiter „Gespeichert": Join über `post_saves` auf `posts`, damit die RLS
      das Gate bleibt — kein `in (ids)` mit Nachkorrektur im Client
- [ ] 5.7 Test: ein gespeicherter, danach unsichtbar gewordener Beitrag verschwindet
      aus der Liste, ohne Fehler, und seine `post_saves`-Zeile bleibt bestehen
- [ ] 5.8 Typ-Filter in der Abfrage: Video über `video_url`, Event über `kind`,
      Bild über `post_media`, Text als Beitrag ohne all das
- [ ] 5.9 Speichern und Lösen als Schreibfunktionen; zweimaliges Speichern läuft
      ohne sichtbaren Fehler durch

## 6. Fläche

- [ ] 6.1 Composer in die Feed-Spalte verschieben (`CommunityFeed.tsx:156` rendert
      ihn heute vor dem Raster); Sidebar beginnt oben bündig
- [ ] 6.2 Den Non-goal-Kommentar in `CommunityFeed.tsx:213` mitändern — er begründet
      heute das Gegenteil dessen, was die Datei dann tut
- [ ] 6.3 Medientyp-Zeile im Composer mit Icons aus dem Kanon (Bild, Video);
      **kein** Event- und **kein** Umfrage-Knopf
- [ ] 6.4 Drei Reiter; ein Reiterwechsel setzt das Blättern zurück
- [ ] 6.5 Umschalter für die Ordnung; ein Ordnungswechsel setzt das Blättern zurück
- [ ] 6.6 Sidebar: Tags als Auswahlkästchen mit Zählern, aktivste Mitglieder,
      Beitragstyp
- [ ] 6.7 Die Spalte darf **nicht** verschwinden, wenn keine kuratierten Tags
      bestehen (heute gibt `TagFilter` in dem Fall `null` zurück)
- [ ] 6.8 Speichern-Knopf an der Beitragskarte, mit Zustand und Rücknahme
- [ ] 6.9 Der Wert kommt in mehreren Fällen erst **nach** dem Mount — kein
      `useState(wert)` als Erstbelegung, sonst prüft der Test die falsche Zeitachse

## 7. Abnahme

- [ ] 7.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` grün — **nie**
      `pnpm format` (schreibt rund 60 fremde Dateien um)
- [ ] 7.2 `supabase test db` mit ausdrücklicher Dateiliste grün, `grants_test.sql`
      eingeschlossen
- [ ] 7.3 Sichtprobe im Browser gegen den lokalen Stack: beide Themes, 375 px und
      breit — Composer-Spalte, Sidebar-Höhe, Kästchen, Überlauf. jsdom sieht davon
      nichts
- [ ] 7.4 Sichtprobe: Speichern füllt und leert den Reiter ohne Neuladen
- [ ] 7.5 Sichtprobe: zwei Haken bei den Tags zeigen die Vereinigung, nicht die
      Schnittmenge
- [ ] 7.6 Belegen, dass die Zähler nichts verraten — per pgTAP, nicht per
      Sichtprobe
- [ ] 7.7 Zweite Meinung auf den Diff (Schritt 4 der Schleife), Vendor ungleich dem
      des Deltas
