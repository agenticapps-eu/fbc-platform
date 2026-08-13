# Tasks — academy-lite-and-feed-weave (AGE-533 / C9)

Reihenfolge ist verbindlich: 1 trägt 2 und 3, 4 trägt 5. Jede Aufgabe nennt,
woran sie überprüfbar ist — „der Code existiert" ist kein Beleg.

Stand nach dem Plan-Review (`REVIEWS.md`, drei Anbieter, dreimal
REQUEST-CHANGES). Der frühere Abschnitt „Die RPC nimmt die Video-URL entgegen"
ist **ersatzlos entfallen**: die Ableitung liegt jetzt im Trigger, die RPC wird
nicht angefasst.

Vor jedem schreibenden Befehl steht das Zielprojekt in der Ausgabe.
Entwickelt und getestet wird lokal (`supabase start`) und gegen DEV
(`foelowldexkcqzewvrcf`). Kein `supabase db reset` gegen ein Remote-Projekt.

## 0 · Vorlauf

- [x] 0.1 Branch `donald/age-533-academy-lite-and-feed-weave` von aktuellem
      `main`. Nie direkt auf `main`.
- [x] 0.2 `openspec validate --all` grün, **bevor** die erste Codezeile entsteht.
- [x] 0.3 Plan-Review: gemini, codex (gpt-5.6-sol), opencode (Kimi-K3) — drei
      Anbieter, keiner davon claude. Ergebnis und Auflösung in `REVIEWS.md`.
- [x] 0.4 Ist-Zustand gemessen (`scripts/probe-c9-bestand.ts`, rein lesend,
      DEV): 12 Beiträge / 2 mit Video · 9 Events / 0 ohne Host / 0 mit
      Titelbild · 8×`members`, 1×`public` · keine Spalten-ACLs · `posts` trägt
      **keinen** Not-Empty auf `body`. Zahlen und Folgen in `EVIDENCE.md`.
- [x] 0.5 Grün-Basis aufgenommen: lint 0 Errors (4 Warnungen), typecheck sauber,
      **93 Testdateien / 653 Tests grün**. Alles, was danach rot wird, gehört
      diesem Change.

## 1 · Migration A — `posts.video_url`, serverseitig abgeleitet

- [x] 1.1 **RED:** pgTAP-Fälle in `rls_test.sql` (neuer Abschnitt „§21 Academy
      aus geteilten Videos"), die ohne die Migration scheitern:
      - Spalte `video_url` existiert, partieller Index existiert.
      - `erste_video_url` liefert für jeden akzeptierten Fall die URL.
      - **Der Trigger überschreibt einen von Hand gesetzten Wert** — der Kern
        von codex' HIGH: `insert … (body, video_url) values ('kein link', 'https://youtu.be/x')`
        landet mit `video_url is null`.
      - **Präfix-Angriff:** `https://youtube.com.evil.example/watch?v=x` ergibt
        `null`.
      - **Groß-/Kleinschreibung:** `https://WWW.YouTube.com/watch?v=Ks-_Mh1QhMc`
        wird akzeptiert (`~*`, nicht `~` — der Fehler des Entwurfs).
- [x] 1.2 Migration `2026....._posts_video_url.sql`:
      - `alter table public.posts add column video_url text;`
      - `create function public.erste_video_url(text) returns text
        language sql immutable`, die `parseVideoUrl` Fall für Fall nachbildet:
        `http`/`https`, optionales `www.`, `m.youtube.com`, `youtube.com/watch?…v=ID`,
        `youtube.com/embed/ID`, `youtu.be/ID`, `vimeo.com/<zahl>`,
        `player.vimeo.com/video/<zahl>`; Query und Fragment erlaubt; Host-Grenze
        verankert. **`youtube-nocookie` NICHT** — `parseVideoUrl` kennt es nicht.
      - Trigger-Funktion + `create trigger trg_posts_video_url before insert or
        update on public.posts for each row execute function …`. Bewusst auf
        JEDEM Update, nicht `update of body`: sonst käme
        `update posts set video_url = …` daran vorbei.
      - `create index posts_video_url_idx on public.posts (created_at desc, id desc)
        where video_url is not null;`
      - **Kein** Check-Constraint auf der Spalte: der Trigger ist die Garantie.
      - Kopf mit Begründung, Datum, Signatur und der verworfenen Alternative
        (Ableitung im Client) samt dem Grund für die Kehrtwende.
- [x] 1.3 **Grants und Revokes der neuen Funktionen** (Befund codex, MEDIUM):
      `revoke execute on function public.erste_video_url(text) from public, anon,
      authenticated;` dasselbe für die Trigger-Funktion. Eine neue Funktion
      erhält sonst `PUBLIC EXECUTE`. Dazu `has_function_privilege`-Fälle in
      pgTAP — `grants_test.sql` prüft Funktionsrechte nicht.
- [x] 1.4 Spalten-Grants: nicht nötig, **gemessen** (0.4 —
      `pg_attribute.attacl` ist auf `posts`/`events` durchweg null, neue Spalten
      erben von den Tabellen-Grants). `grants_test.sql` trotzdem laufen lassen
      und die Ausgabe lesen (AGE-455).
- [x] 1.5 **Backfill im selben Skript**, über **dieselbe** Funktion:
      `update public.posts set video_url = public.erste_video_url(body)
       where video_url is distinct from public.erste_video_url(body);`
      Vorher/nachher-Zählung in die Ausgabe. **Sollwert DEV: 2** (0.4).
- [x] 1.6 **Parität SQL ↔ TypeScript**, und zwar scharf: **alle** Fixtures aus
      `feed.test.ts` (19 Fälle) durch `erste_video_url` laufen lassen; was
      `parseVideoUrl` akzeptiert, muss die Funktion akzeptieren und umgekehrt.
      **Schwelle null**, Fall für Fall — nicht über eine Trefferzahl (Befunde
      gemini MEDIUM und codex MEDIUM: gleiche Summen können aus verschiedenen
      Treffern bestehen). Zusätzlich die zwei echten Bestandstreffer aus 0.4.
- [x] 1.7 Typen nachziehen. **`pnpm gen:types` existiert nicht** (Befund codex,
      LOW — nachgemessen: weder in `package.json` noch in den Workflows). Der
      Weg ist `supabase gen types typescript` gegen den lokalen Stack; das
      benutzte Kommando wird in `EVIDENCE.md` notiert, damit der nächste es
      nicht wieder sucht.

## 2 · Academy-Seite

- [x] 2.1 **RED:** Tests für die Datenschicht: „Alle" filtert auf
      `video_url not null`, „Meine" zusätzlich auf `author_id`. Kein `vi.mock`
      auf eigene Komponenten.
- [x] 2.2 Datenschicht bauen. Sie SETZT KEIN Sichtbarkeitsprädikat — das
      entscheidet die RLS, wie im Feed.
- [x] 2.3 **Paginierung, nicht stille Kappung** (Befund codex, MEDIUM): „Alle"
      übernimmt die Keyset-Paginierung des Feeds (`FEED_SEITE`, Cursor über
      `(created_at, id)`) statt eine zweite Mechanik zu erfinden. PostgREST
      begrenzt Resultsets ohnehin — ohne Cursor schnitte die Academy still ab.
      Für das Like-Regal gilt dasselbe.
- [x] 2.4 **RED + Bau: das zweite Regal aus den eigenen Likes** (Entscheidung
      Donald, 13.08.). Eigene `post_likes` lesen, `post_id` gegen `posts` mit
      `video_url` auflösen. Keine neue Tabelle. **Sortiert nach dem Zeitpunkt
      des Likes** (`post_likes.created_at`), nicht nach dem des Beitrags.
      Der Test, der zählt: ein geliktes Video, das die RLS **nicht mehr
      liefert**, entfällt lautlos — keine Lücke, kein Fehler, kein Platzhalter.
- [x] 2.5 `AcademyPage`: kuratierter Block bleibt oben als Konstante; darunter
      zwei Reiter „Alle" / „Meine Academy". „Meine Academy" trägt zwei Regale.
      Leere Zustände unterscheiden „gar keine" von „keine eigenen" — je Regal
      einer.
- [x] 2.6 Beschriftung des zweiten Regals: die eigene **„gefällt mir"-Liste**.
      Die Wörter „gemerkt", „gespeichert", „Merkzettel" kommen NICHT vor: der
      Like-Zähler ist über `post_engagement_counts` für jeden sichtbar, ein Like
      hier also nicht privat.
- [x] 2.7 Test: der Reiter-Zustand kommt **nach** dem Mount aus der Query —
      `useState(wert)` nähme ihn nie an. Vorbelegten Kontext vermeiden, sonst
      prüft der Test die falsche Zeitachse.
- [x] 2.8 Die Karte bettet **`post.video_url`** ein, nicht den erneut geparsten
      Body. Das ist die Client-Hälfte der Kehrtwende aus `design.md` §2 — ohne
      sie gäbe es weiterhin zwei Quellen fürs Rendern.
- [x] 2.9 Sichtprobe im Browser, beide Themes, 375 px und Desktop.

## 3 · „Meine Kurse" entfällt

- [x] 3.1 `src/pages/MeineKursePage.tsx` und `MeineKursePage.test.tsx` löschen.
- [x] 3.2 `nav.ts`: navItem entfernen, Import entfernen, den C9-Kommentar
      (Zeilen 108–109) auflösen. Der Satz in Zeile 53, der `/meine-kurse` unter
      den `sub`-Routen aufzählt, muss mit.
- [x] 3.3 `App.tsx`: `<Route path="/meine-kurse" element={<Navigate to="/academy"
      replace />} />` — Muster wie `/meine-chancen` (AGE-450).
- [x] 3.4 Die vier Mitesser aufräumen: `nav.test.ts:75`,
      `EmptyState.wording.test.tsx:61`, `formatHero.ts:48`, `NavIcon.tsx:61`
      und `:139`.

## 4 · Migration B — `posts.kind`, `posts.ref_id`, zwei Trigger

- [x] 4.1 **RED:** pgTAP-Fälle, die ohne die Migration scheitern:
      - Anlegen eines Events erzeugt genau eine `posts`-Zeile mit
        `kind='event'`, `ref_id`, leerem `body`, Host als Autor.
      - `visibility` wird übernommen; ein `update` auf `events.visibility` zieht
        sie nach.
      - **Lebenszyklus `host_id`** (Befunde codex MEDIUM + opencode HIGH), vier
        Fälle: `null→Host` legt den fehlenden Beitrag an · `Host→Host` zieht
        `author_id` nach · `Host→null` entfernt den Beitrag · Event ohne Host
        legt an und erzeugt keinen Beitrag.
      - Löschen des Events entfernt den Beitrag (Kaskade).
      - **Host-Profil gelöscht ⇒ Beitrag weg, Event bleibt** (Befund opencode,
        LOW): die benannte Asymmetrie wird gepint, nicht nur beschrieben.
      - **Umgehungsfälle** (Befund codex, HIGH — der schwerste):
        ein Mitglied kann keinen `kind='event'`-Beitrag anlegen ·
        der Host kann seinen Event-Beitrag nicht löschen ·
        der Host kann ihn nicht auf `kind='member'` umschreiben ·
        der Host kann seine `visibility` nicht wieder ändern.
      - **Aktivierungs-Gate:** eingeloggt, nicht aktiviert ⇒ die Feed-Abfrage
        liefert den Event-Beitrag NICHT (C3, AGE-495).
      - Ausgeloggt: der Beitrag eines `members`-Events kommt nicht zurück.
      - Rang unter 4: der Beitrag eines fremden `members`-Events kommt nicht
        zurück, das Event selbst schon (die benannte Asymmetrie).
      - Der zweite Trigger-Lauf erzeugt keinen zweiten Beitrag.
- [x] 4.2 Migration `2026....._posts_kind_event_trigger.sql`:
      `kind text not null default 'member' check (kind in ('member','event'))`;
      `ref_id uuid`, Fremdschlüssel **ausdrücklich benannt**
      `constraint posts_ref_id_fkey references public.events (id) on delete cascade`
      — der Client kodiert diesen Namen im PostgREST-Embed, ein generierter Name
      wäre eine stille Kopplung (offene Annahme bei codex);
      Check, dass `kind`/`ref_id` zusammenpassen; **ein** partieller
      Unique-Index `on public.posts (ref_id) where kind = 'event'`.
      **Kein zweiter Index auf `ref_id`** (Befund opencode, MEDIUM): der
      partielle Unique-Index trägt den Join vollständig.
- [x] 4.3 `posts_write_own` ersetzen: `using` bekommt `kind = 'member'`,
      `with check` zusätzlich `ref_id is null`. `is_activated()` bleibt das
      äußere `and` — wie in C3 und C8. Kommentar auf der Policy mit dem Grund.
- [x] 4.4 Trigger-Funktionen `security definer set search_path = ''` — sie
      schreiben in `posts`, und bei einem admin-angelegten Event ist der
      Schreibende nicht der Host; als Invoker scheiterten sie an
      `posts_write_own`. Beide vollständig revoken (s. 1.3).
- [x] 4.5 `trg_event_feed_post` (`after insert`) und `trg_event_feed_sync`
      (`after update of visibility, host_id`).
- [x] 4.6 Backfill für bestehende Events, `created_at` vom Event übernommen,
      Events ohne Host übersprungen. **Sollwert DEV: 9 Beiträge**, davon 8
      `members` (0.4).
- [x] 4.7 `grants_test.sql` erneut laufen lassen; Typen nachziehen.
- [x] 4.8 **`rls_test.sql:15` trägt `select plan(342)`** (Befund codex, MEDIUM,
      nachgemessen). Die Zahl auf die neuen Behauptungen anheben — sonst
      scheitert die Suite am Plan-Mismatch bei völlig korrektem Verhalten.
- [x] 4.9 pgTAP mit **expliziter Dateiliste** fahren — ohne sie meldet
      `supabase test db` FAIL wegen der elf `probe_*.sql`, die kein pgTAP sind.
- [x] 4.10 **Blast-Radius auf die Bestandstests** (Befund opencode, MEDIUM —
      den hat nur er gesehen). Ab hier erzeugt **jedes** `insert into events`
      in jedem pgTAP-Fall, jeder JS-Fixtur und jedem Seed eine zusätzliche
      `posts`-Zeile. Diese Aufgabe ist **nicht** „die Suite ist grün", sondern:
      jede bestehende Behauptung, die Beiträge zählt oder „genau n Zeilen"
      verlangt, wird einzeln angesehen und ihre neue Basis bestätigt. Der
      gefährliche Ausgang ist der Test, der zufällig grün bleibt.

## 5 · Feed — der zweite Kartentyp

- [x] 5.1 **RED:** Test, der den Join belegt statt der Kopie: Feed-Zeile mit
      `kind='event'` liefert Titel/Datum/Ort aus `events`; ändert sich der
      Titel, ändert sich die Darstellung — **ohne** Schreibzugriff auf `posts`.
- [x] 5.2 `fetchFeed`: `kind`, `ref_id` mitselektieren und das Event über den
      Fremdschlüssel einbetten (`events!posts_ref_id_fkey(...)`). Die RLS von
      `events` wertet die Einbettung selbst aus — zweite Verteidigungslinie,
      kein Ersatz für die gespiegelte Sichtbarkeit.
- [x] 5.3 `FeedPost` um `kind` und ein optionales `event` erweitern.
- [x] 5.4 `EventCard` in `CommunityFeed.tsx`, **innerhalb** der bestehenden
      `Stagger`-Liste — dieselbe `<Card>`-Hülle wie `PostCard`. Titelbild über
      `signEventCovers`; ohne Signatur erscheint sie ohne Bild, nicht gar nicht.
- [x] 5.5 **RED + Bau: Likes und Kommentare an der Event-Karte** (Befund codex,
      MEDIUM — die Spec sagt es zu, keine Aufgabe verdrahtete es). Vier Fälle:
      liken, entliken, Kommentarfaden öffnen, Kommentar anlegen. Der
      Interaktions-Footer wird mit `PostCard` geteilt, nicht kopiert.
- [x] 5.6 (entfallen — die Event-Karte hat kein Overlay.) Ein Overlay gehörte per Portal an `document.body` —
      `.fbc-card:hover` setzt einen `transform` und fängt jedes `position:
      fixed` (AGE-492). Ohne Overlay entfällt der Punkt.
- [x] 5.7 Ist das Event nicht lesbar (`event === null`), entfällt die Karte.
- [x] 5.8 **Alle `posts`-Leser, nicht nur der Feed** (Befund codex, HIGH —
      nachgemessen: `grep 'from("posts")' src/` liefert drei Dateien):
      - `HomePage.PostPreview` und `MemberDashboard` (über `fetchFeed`):
        Event-Beiträge benennen statt eine leere Vorschau zu zeichnen.
      - **`src/lib/dashboard.ts`** (`limit(4)`, rohe Bodies) → `kind='member'`.
      - **`src/lib/public-profile.ts`** (`limit(5)`, rohe Bodies) →
        `kind='member'`.
      Ohne die letzten beiden sähe ein Host leere Karten, die seine echten
      Beiträge aus einem Limit von vier bzw. fünf verdrängen. Je ein Test.
- [x] 5.9 Sichtprobe im Browser: Event anlegen → erscheint im Feed → umbenennen
      → Feed zeigt den neuen Titel → löschen → Karte weg. Das ist die Abnahme
      von Zusage 1, und sie ist nur im Browser echt.
- [x] 5.10 **Für die Sichtprobe ein Event MIT Titelbild anlegen.** Gemessen
      (0.4): in DEV hat kein einziges der 9 Events ein `cover_path` — der
      Bildweg der Event-Karte ist am Bestand nicht prüfbar und bliebe sonst
      ungemessen.

## 6 · Abnahme

- [x] 6.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` grün.
      Basis: 93 Dateien / 653 Tests (0.5).
- [x] 6.2 pgTAP grün, mit Dateiliste, gegen den lokalen Stack.
- [x] 6.3 Die dreizehn Abnahmepunkte aus AGE-533 einzeln abhaken, jeder mit
      Beleg in `EVIDENCE.md`.
- [x] 6.4 Beide Themes, Telefon und Desktop.
- [x] 6.5 Diff-Review durch einen unabhängigen Leser (Schritt 4), **auf dem
      Diff**, nicht auf dem Plan.
- [x] 6.6 Kein `git add -A`. Der Arbeitsbaum trägt dauerhaft untracked Dateien
      mit 0600, und das Repo ist öffentlich.
- [x] 6.7 PR gegen `main`, Conventional Commit mit `(AGE-533)`.

## 7 · Nach dem Merge (nicht Teil des PR)

- [x] 7.1 `migrate-dev` läuft automatisch; danach blockt `drift-gate` **jeden**
      Deploy, bis `migrate-prod` gelaufen ist. Eingeplant, nicht entdeckt.
- [x] 7.2 **Die 0.4-Messung gegen PROD wiederholen**, vor `migrate-prod`:
      `infisical run --env=prod -- pnpm exec tsx scripts/probe-c9-bestand.ts`.
      DEV-Deckungsgleichheit sagt über den PROD-Korpus nichts — dort können
      Tokenformen und Events ohne Host stehen, die es in DEV nicht gibt.
- [x] 7.3 `migrate-prod` erst nach gelesenem Dry-Run dispatchen (`apply` startet
      direkt hinter `plan`, ohne Reviewer-Regel).
- [x] 7.4 Deploy per `gh run rerun --failed`; Live-Beleg an einer **Zeichenkette
      aus dem Diff**, nicht an der Bundle-Größe.
- [x] 7.5 `openspec archive` — Szenario-Titel in MODIFIED-Blöcken unverändert
      lassen, sonst bricht das Archivieren.
- [x] 7.6 `add-academy-content` (AGE-262) anmerken: sein `## REMOVED`-Block
      zeigt danach auf eine Anforderung, die es so nicht mehr gibt.
