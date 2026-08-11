## Why

Linear: **AGE-528** (C7 des eff.bee.zee-Go-Live).

Detlevs Satz zum Bereich: „Hier spielt die Musik." Die Aktivität ist die
einzige Fläche, die die Plattform lebendig wirken lässt — alles andere ist
Verzeichnis. Referenz ist das Mockup vom 29.07. — im Repo unter
`docs/mockups/aktivitaet-2026-07-29.png`, im Original `ChatGPT Image 29. Juli
2026, 00_33_17_Aktivitäten.png` aus dem Dropbox-Ordner
`Ausarbeitungen 2026-07-29`.

Drei Lücken schließt dieser Change.

1. **Es gibt keinerlei Medien an Beiträgen.** Keine Spalte, kein Bucket, kein
   Upload. Nur Videolinks werden aus dem Fließtext geparst und eingebettet
   (`extractFirstVideo`, `src/lib/feed.ts:181`). Ein Erlebnisbericht ohne Bild
   ist im Mockup nicht vorgesehen und in der Sache auch nicht.
2. **Jeder Tag wird doppelt angezeigt.** `PostBody` rendert `#Tag` inline im
   Fließtext (`src/components/community/CommunityFeed.tsx:401–412`), und
   darunter kommt dieselbe Menge noch einmal als Chip-Reihe (`:331–348`). Das
   ist kein Zufall, sondern zwingend: `createPost` speichert
   `hashtags: parseHashtags(input.body)` (`src/lib/feed.ts:370`), also genau
   die Segmente, die `PostBody` schon gezeichnet hat. Für Video-URLs gibt es
   diese Dedupe bereits (`skipRaw`, `:323`/`:400`), für Hashtags wurde sie nie
   gebaut.
3. **Tags sind ausschließlich Freitext.** Es gibt keine redaktionelle Liste,
   also keine Möglichkeit, dem Feed eine Ordnung zu geben, die über „was
   jemand getippt hat" hinausgeht — und keine Filterleiste, die etwas anbieten
   könnte.

### Die Frage, an der dieser Change hängt

`posts.visibility` kennt `public` und `members`. Beim Avatar ist die
Bildsichtbarkeit gleichgültig — Profilbilder sind ohnehin sichtbar, und beide
bestehenden Buckets (`avatars`, `covers`) sind deshalb `public`. Bei
Beitragsbildern ist sie es nicht: **das Bild eines `members`-Beitrags darf ohne
Session nicht abrufbar sein.** Ein öffentlicher Bucket mit schwer erratbaren
Pfaden erfüllt das nicht — das ist Verschleierung, keine Zugriffskontrolle.

Die Entscheidung und ihre verworfene Alternative stehen in `design.md`. Kurz:
**ein privater Bucket `post-media`, ausgeliefert über signierte URLs.** Der
zweite Bucket nach Sichtbarkeit spart die Signatur-Maschinerie nicht ein — sie
wird für `members` ohnehin gebraucht, also für den Normalfall — und bezahlt mit
einer nicht-atomaren Bucket-Wanderung bei jeder späteren Sichtbarkeitsänderung.

## What Changes

- **Neue Tabelle `public.post_media`** (`id`, `post_id`, `storage_path`,
  `sort`, `width`, `height`, `created_at`), FK auf `posts` mit
  `on delete cascade`. Bewusst eine Tabelle und **kein** `posts.media jsonb`:
  mehrere Bilder brauchen Reihenfolge und einzelne Löschbarkeit.
- **Neuer privater Bucket `post-media`**, 1 MiB, nur `image/webp`. Er ist der
  erste Bucket dieses Projekts mit **einer SELECT-Policy** — bei `avatars` und
  `covers` fehlt sie bewusst, weil dort der Bucket öffentlich ist. Hier trägt
  genau diese Policy die Zugriffskontrolle.
- **Vier Storage-Policies**: SELECT für `anon` (nur Objekte von
  `public`-Beiträgen) und für `authenticated` (dasselbe Prädikat wie
  `posts_select_by_visibility`), INSERT/UPDATE/DELETE nur im eigenen
  `{uid}/`-Pfad und nur mit `public.is_activated()` — wie in beiden
  bestehenden Buckets.
- **Neue Tabelle `public.tags`** (`key`, `label`, `sort`, `active`) als
  redaktionelle Liste, mit Startbefüllung von **15 Tags — elf Themen aus der
  Filterliste des Mockups plus vier Formate** (Liste und Begründung in
  `design.md`; ausdrücklich *nicht* die Kompass-Kategorien, das sind
  Matching-Kategorien und es sind 14, nicht elf). `key` ist per Constraint
  kleingeschrieben und tippbar — sonst zerfällt derselbe Tag in zwei Werte, je
  nachdem ob er geklickt oder als `#Wort` getippt wurde. **Keine
  Verknüpfungstabelle:**
  `posts.hashtags text[]` bleibt wie es ist und hält beide Sorten. Ein Chip
  gilt als kuratiert, wenn sein Wert in `tags` vorkommt. Damit bleibt die
  bestehende Filterlogik (`.contains("hashtags", [hashtag])`,
  `src/lib/feed.ts:294`) unangetastet, und die Migration ist ein Insert statt
  einer Umstrukturierung.
- **Tag-Doppelanzeige behoben**: Hashtag-Segmente in `PostBody` rendern als
  normaler Text, die Chip-Reihe bleibt die eine Darstellung. Dazu ein
  Regressionstest — `CommunityFeed.tsx` hat heute **keine** Testdatei, dieser
  Change legt die erste an.
- **Neuer Client-Helfer `shrinkToWebp`**: Bilder werden vor dem Hochladen
  clientseitig auf Maximalkante 1600 px verkleinert und nach WebP konvertiert
  (Qualität 0,82), höchstens sechs pro Beitrag. `AvatarCropper` bleibt
  unangetastet — dort ist die Rechnung ein erzwungener „cover"-Zuschnitt
  (`cropGeometry`, `AvatarCropper.tsx:27–59`), der von jedem Foto etwas
  abschneiden würde.
- **Composer nach Mockup**: Text, Bilder, Video-Link, Tag-Auswahl aus der
  kuratierten Liste plus Freitext, Sichtbarkeit.
- **Beitragskarte nach Mockup** inklusive Bildlayout: eins groß, zwei
  nebeneinander, drei und mehr als Raster mit „+n".
- **Tag-Filterleiste** über die kuratierten Tags, zusätzlich zum bestehenden
  Hashtag-Filter.
- **Feed wird seitenweise geladen**: 20 statt 50, mit „Mehr laden". Heute liest
  `fetchFeed` 50 Zeilen ohne Paginierung (`src/lib/feed.ts:293`); mit Bildern
  wird diese Zahl zu einer stillen Kappung.

### Videos bleiben verlinkt

Entscheidung aus dem Meeting vom **03.08.** Kein Video-Upload, kein
Video-Bucket. Der bestehende Weg (URL im Body, `parseVideoUrl` lässt nur
YouTube und Vimeo mit valider ID durch, `src/lib/feed.ts:140`) bleibt genau so.
Der Composer bekommt dafür ein eigenes Feld statt einer Zeile im Fließtext —
mehr ändert sich nicht.

### Reaktionen bleiben bei einer Art

AGE-528 begründet das damit, dass „das Mockup mehrere Reaktionsarten zeigt",
man aber bei einer bleiben solle. **Die Prämisse stimmt nicht:** im Mockup hat
jeder der drei Beiträge genau eine Reaktion, ein rotes Herz mit Zähler
(24 / 18 / 15). Zusätzlich zu sehen sind ein *Teilen*-Zähler und eine
*Speichern*-Aktion — andere Funktionen, keine Reaktionsarten. Eine Reaktion
ist damit nicht die Abweichung vom Mockup, sondern seine Umsetzung.
`post_likes` bleibt unverändert.

## Non-goals

- **Event- und Academy-Beiträge im Feed** (`posts.kind` + Trigger) → **C9**.
  Auch keine halbe Vorstufe davon: kein `kind`, keine Spalte „für später".
- **Event-Cover** → **C8**.
- **Mehrere Reaktionsarten** → eigenes Issue, falls Detlev darauf besteht.
- **Aus dem Mockup, aber nicht in diesem Change:** die Reiter „Alle Beiträge /
  Beiträge von mir / Gespeichert", die Sortier-Auswahl, der Teilen-Zähler,
  „Speichern"/Lesezeichen, Link-Vorschaukarten mit OG-Bild, die
  Composer-Knöpfe „Event" und „Umfrage", die Beitragszahl pro Tag in
  „Beliebte Tags" und die Liste „Aktivste Mitglieder". Die rechte Spalte trägt
  in dieser Fassung **nur** die Tag-Filterleiste.
- **Aufräumen von Objekten ohne Zeile** im Bucket — in beiden Spielarten: ein
  aus einem Beitrag entferntes Bild verliert seine `post_media`-Zeile, und ein
  abgebrochener Composer hinterlässt Objekte, die nie eine hatten (der Upload
  läuft vor dem Anlegen des Beitrags, siehe `design.md`). Das Objekt bleibt
  jeweils liegen. Das ist beim Avatar seit AGE-238 so und beim Hintergrundbild
  seit C6 — hier bewusst gleich gehalten und benannt, statt als Löschung
  versprochen. Anders als dort ist das Objekt danach allerdings **nicht mehr
  abrufbar**: ohne `post_media`-Zeile findet die Sichtbarkeitsfunktion keinen
  Beitrag, also gibt es keine Signatur mehr. Es kostet Speicher, es leckt
  nichts.

## Impact

- **Specs:** `community-feed` (nur ADDED Requirements — keines der fünf
  bestehenden wird widersprochen).
- **Migrationen:** drei neue, forward-only.
- **Code:** `src/lib/feed.ts`, `src/components/community/CommunityFeed.tsx`,
  neu `src/lib/post-media.ts`, `src/lib/tags.ts`, `src/lib/image.ts`, plus die
  erste Testdatei zu `CommunityFeed`.
- **Tests:** `supabase/tests/rls_test.sql` (neuer Abschnitt), `grants_test.sql`
  (**zwei neue Tabellen mit Table-Grants brechen den Golden-Snapshot** — er
  wird mitgezogen, sonst ist der `migrations`-Job rot, ohne dass jemand
  `post_media` erwähnt hätte).
- **Nicht betroffen:** `avatars`, `covers`, `post_likes`, `comments`,
  `posts`-Schema, `post_engagement_counts`.
