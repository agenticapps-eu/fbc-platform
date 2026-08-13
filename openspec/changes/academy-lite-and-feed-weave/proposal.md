# Academy aus geteilten Videos, und Events weben sich in den Feed

Linear: **AGE-533** (C9). Setzt auf C7 (AGE-528, gemergt) und C8 (AGE-531, live)
auf. Stand nach dem Plan-Review — drei Anbieter, dreimal REQUEST-CHANGES;
Befunde und Auflösung in `REVIEWS.md`.

## Why

Die Academy sind heute 54 Zeilen mit drei fest verdrahteten YouTube-Links,
`MeineKursePage` ein 33-Zeilen-Stub ohne Datenbasis. Die vollständige Academy —
Kurse, Lektionen, Fortschritt, Einschreibung — ist ausdrücklich **nicht** Teil
des Go-Live (AGE-262 im Backlog).

Der tragende Gedanke: **Academy braucht kein eigenes Datenmodell.** Beiträge
können bereits Videos (`parseVideoUrl`, `extractFirstVideo`, `VideoEmbed`, alle
seit AGE-252). Academy-lite ist damit eine gefilterte Sicht auf `posts` —
Beiträge, die ein Video tragen. Der Nebeneffekt ist der eigentliche Gewinn: ein
geteiltes Video **ist** ein Beitrag, erscheint also ohne Synchronisierung in der
Aktivität. Kein Duplikat, kein Abgleich.

Detlevs zweiter Satz — „Neue Events oder Videos bei Academy werden auch in
Aktivitäten angezeigt" — löst sich für Videos damit von selbst. Events brauchen
einen Weg in den Feed, und das ist die zweite Hälfte dieses Changes.

## Bestandsaufnahme — was am Ausgangstext von AGE-533 nicht stimmt

Aus dem Lesen des Codes nach C7/C8 und aus dem Plan-Review. Diese Punkte ändern
die Umsetzung, nicht das Ziel.

**1. Die community-feed-Spec verbietet heute wörtlich, was C9 verlangt.** In
„Der Composer trägt Text, Bilder, Video-Link, Tags und Sichtbarkeit": *„Der Link
SHALL im Beitragstext gespeichert und beim Rendern dort unterdrückt werden […];
es SHALL dafür kein neues Feld am Beitrag geben."* Das war für die
**Darstellung** richtig. Fürs **Filtern und Sortieren** trägt es nicht: ein
Regex über `body` ist weder indexierbar noch verlässlich. Die Anforderung wird
geändert, nicht umgangen.

**2. Die Ableitung von `video_url` gehört auf den Server, nicht in den Client.**
Der erste Entwurf ließ den Client `extractFirstVideo` rechnen und den Wert an
`create_post_with_media` übergeben — mit der Begründung, es gebe dann nur einen
Parser und keine Drift. **Diese Zusage ist nicht durchsetzbar** (Befund codex,
HIGH): `posts_write_own` gibt `authenticated` INSERT und UPDATE direkt auf
`posts`; die RPC ist nicht der einzige Schreibweg, nur der bequeme. Ein Client
kann `video_url` setzen, das im Body nicht vorkommt.

Stattdessen: eine SQL-Funktion `erste_video_url(text)` und ein
`before insert or update`-Trigger, der `video_url` **immer** aus dem Body neu
berechnet. Backfill und Laufzeit rufen dieselbe Funktion. **Die RPC wird gar
nicht angefasst** — damit entfallen `drop function`, Signaturfrage, Grants-
Wiederherstellung, Schema-Cache und Deploy-Fenster, also fünf Befunde aus drei
Reviews. Der Change wird dadurch kleiner. Begründung in `design.md` §2.

**3. Event-Beiträge müssen systemverwaltet sein, nicht nur automatisch erzeugt.**
`posts_write_own` ist `for all` auf `author_id = auth.uid()`, und der Host
**ist** der Autor seines Event-Beitrags: er konnte ihn löschen, auf
`kind='member'` umschreiben oder die vom Trigger gesetzte Sichtbarkeit danach
wieder ändern (Befund codex, HIGH). Die Policy verlangt künftig
`kind = 'member'`.

**4. `events.host_id` ist NULLABLE, `posts.author_id` ist NOT NULL.** Ein
Trigger, der stumpf anlegt, ließe jedes Event ohne Host mit einem rohen
DB-Fehler scheitern — genau der Zustand, der in der Vorsession neun Stunden live
stand. Und der Lebenszyklus geht weiter als gedacht: ein später zugewiesener
Host bekam nie einen Beitrag, ein Hostwechsel ließ den alten Autor stehen (zwei
Reviewer unabhängig). Der Update-Trigger deckt jetzt alle vier Übergänge.

**5. Es gibt drei direkte `posts`-Leser, nicht einen.** Gemessen:
`grep 'from("posts")' src/` liefert `feed.ts`, **`dashboard.ts`** und
**`public-profile.ts`**. Die letzten beiden filtern auf `author_id`, zeigen rohe
Bodies und begrenzen auf 4 bzw. 5 Zeilen — ein Host sähe dort leere Karten, die
seine echten Beiträge verdrängen (Befund codex, HIGH). Dazu die drei
Oberflächen, die über `fetchFeed` lesen: `CommunityFeed`, `HomePage`,
`MemberDashboard`.

**6. Kollision:** der aktive Change `add-academy-content` (AGE-262, Backlog)
plant `## REMOVED` auf genau die academy-library-Anforderungen, die C9 ändert.
Kein Blocker, aber es soll niemand beim Archivieren entdecken.

Und die Antwort auf die dritte Frage der Bestandsaufnahme: **`post_likes` ist
weiterhin owner-only lesbar.** Ein „gefällt mir"-Regal in „Meine Academy" ist
damit möglich; **Donald hat es am 13.08. bestellt**, es ist Teil dieses Changes.

## What Changes

1. **Migration A — `posts.video_url`, serverseitig abgeleitet.** Spalte,
   `erste_video_url(text)`, `before insert or update`-Trigger, partieller Index
   `(created_at desc, id desc) where video_url is not null`, Backfill über
   dieselbe Funktion.
2. **Academy-Seite: Reiter „Alle" und „Meine Academy"**, gespeist aus `posts`
   mit `video_url`, mit der Keyset-Paginierung des Feeds statt einer stillen
   Kappung. „Meine Academy" trägt zwei Regale: selbst geteilt und die eigene
   „gefällt mir"-Liste. Die drei kuratierten Videos bleiben als redaktioneller
   Block oben — als Konstante, ausdrücklich **nicht** in die Datenbank.
3. **`MeineKursePage` wird gelöscht**, `/meine-kurse` leitet auf `/academy` um,
   der C9-Kommentar in `nav.ts` fällt weg.
4. **Migration B — `posts.kind` + `posts.ref_id`**, zwei Trigger auf `events`,
   und `posts_write_own` wird enger gefasst.
5. **Feed: zweiter Kartentyp** für Event-Beiträge, der zur Laufzeit auf `events`
   joint — samt Likes und Kommentaren.

## Die vier Zusagen dieses Changes

**Kein kopierter Event-Inhalt.** Der Event-Beitrag trägt `kind`, `ref_id`, einen
leeren `body` — sonst nichts vom Event. Titel, Datum, Ort und Titelbild kommen
über einen benannten Fremdschlüssel zur Laufzeit aus `events`. Ein umbenanntes
Event ändert die Feed-Darstellung sofort, und `on delete cascade` räumt auf.
Prüfbar gemacht: ein Test benennt ein Event um und liest den Feed.

**Sichtbarkeit folgt — über zwei Trigger, nicht über einen Policy-Join.** Ein
Join müsste an **vier** Stellen stehen (`posts_select_public_anon`,
`posts_select_by_visibility`, `post_engagement_counts` und `post_media_lesbar`
— der Entwurf zählte drei und übersah die vierte, was selbst das beste Argument
gegen diesen Weg ist). Das Trigger-Paar steht an einer. Mit einer benannten
Folge: `events` sind für **jedes** bestätigte Konto sichtbar, `members`-Posts
erst ab Rang 4 — der gespiegelte Beitrag ist also **strenger** als sein Event.
Zum Go-Live sind alle `impact`, also folgenlos; unbenannt wäre es ein Rätsel.

**Das Aktivierungs-Gate greift.** Event-Beiträge sind gewöhnliche `posts`-Zeilen
und laufen durch `posts_select_by_visibility`, das seit C3 `is_activated()`
trägt. Ein pgTAP-Fall „eingeloggt, nicht aktiviert" belegt es.

**Kein Kurs-Schema.** Keine Tabelle `courses`, `lessons`, `enrollments`,
`lesson_progress`. Entsteht in diesem Change eine davon, ist er falsch
abgebogen.

## Impact

- Capabilities: `community-feed`, `academy-library`, `events`.
- Migrationen: **zwei**. (Die dritte, für die RPC, ist mit der Kehrtwende in
  Punkt 2 entfallen.) Keine neue Tabelle, kein neuer Bucket, keine neue Rolle.
- Grants: keine neue Tabelle ⇒ keine neue Zeile im Golden-Snapshot von
  `grants_test.sql`. Neue Spalten erben von den Tabellen-Grants — **gemessen**
  (`pg_attribute.attacl` ist durchweg null), nicht angenommen. Die drei neuen
  Funktionen bekommen ausdrückliche `revoke`s, sonst tragen sie
  `PUBLIC EXECUTE`.
- Policy: `posts_write_own` wird enger — Nutzer schreiben nur noch
  `kind = 'member'`.
- Frontend: `AcademyPage`, `CommunityFeed`, `HomePage`, `MemberDashboard`,
  `lib/dashboard.ts`, `lib/public-profile.ts`, `nav.ts`, `App.tsx`,
  `formatHero.ts`, `NavIcon.tsx`; `MeineKursePage.tsx` + Test entfallen.
- Tests: `rls_test.sql` trägt ein festes `plan(342)`, das mitwandern muss. Und
  ab Migration B erzeugt **jedes** `insert into events` in jedem Bestandstest
  eine zusätzliche `posts`-Zeile — jede Zählung auf `posts` ist einzeln
  anzusehen (Aufgabe 4.10).

## Out of scope

Kurse, Lektionen, Fortschritt, Einschreibung (AGE-262) · eigenes Video-Hosting ·
Highlights · Kommentare an Event-Beiträgen gesondert behandeln · ein **echter**
Merkzettel mit eigener Tabelle (das zweite Regal ist die eigene
„gefällt mir"-Liste, auf Videos gefiltert — mehr nicht).
