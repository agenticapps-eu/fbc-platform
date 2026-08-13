# Session Handoff — 2026-08-13 (AGE-533 / C9 gemergt, Deploy hängt)

C9 ist gebaut, dreifach gegengelesen, gemergt — und der Deploy steht hinter
`drift-gate`. **Das ist keine Randnotiz: dadurch stehen gerade neun leere
Karten im Live-Feed.**

## Zuerst: was jetzt zu tun ist

`migrate-prod` dispatchen, dann den Deploy nachziehen. Der Dry-Run dafür ist
gelaufen und liegt vor: **PROD hat 0 `posts` und 0 `events`**, beide Backfills
treffen dort null Zeilen. `migrate-prod` ist eine reine Schemaänderung ohne
Datenrisiko.

Danach `gh run rerun --failed` auf den `main`-Lauf zu `2c165a6` (deploy.yml hat
kein `workflow_dispatch`; der Befehl gibt bei Erfolg nichts aus). Live-Beleg an
einer **Zeichenkette aus dem Diff**, nicht an der Bundle-Größe — z. B.
„Aus der Redaktion", „Meine Academy" oder „Neues Event".

## Accomplished

**PR #170 gemergt** (`2c165a6`, squash). Acht Checks auf der HEAD-SHA grün.

- **Migration A** `posts.video_url`, von der DATENBANK aus dem Body abgeleitet
  (Funktion + Trigger auf jedem Schreibzugriff), partieller Index, Backfill.
- **Academy** als gefilterte Sicht auf `posts`: Reiter „Alle" und „Meine
  Academy", letzterer mit zwei Regalen (selbst geteilt / eigene
  „gefällt mir"-Liste), seitenweise über den Keyset-Cursor des Feeds.
- **„Meine Kurse" entfällt**, `/meine-kurse` leitet auf `/academy` um.
- **Migration B** `posts.kind` + `ref_id`, ein Trigger-Paar auf `events`,
  `posts_write_own` und `post_media_insert_own` auf `kind = 'member'` verengt.
- **Zweiter Kartentyp im Feed**, der zur Laufzeit auf `events` joint.

**Belege:** 95 Dateien / 665 Tests · pgTAP 408 PASS (`plan(342) → plan(388)`) ·
Parität SQL↔TS 46/46 · lint 0 Errors · build grün · Sichtprobe in beiden Themes
und bei 375 px. Alles in `openspec/changes/academy-lite-and-feed-weave/`
(`EVIDENCE.md`, `REVIEWS.md`, `DIFF-REVIEWS.md`).

## Decisions

**`video_url` wird auf dem SERVER abgeleitet, nicht im Client.** *Warum:* der
erste Entwurf ließ den Client rechnen und versprach, Spalte und Embed könnten
nicht auseinanderlaufen. Nicht durchsetzbar — `posts_write_own` erlaubt
INSERT/UPDATE direkt auf `posts`. Nebeneffekt: die RPC `create_post_with_media`
wird gar nicht angefasst, fünf Review-Befunde entfielen, der Change wurde
kleiner.

**Sichtbarkeit gespiegelt, nicht gejoint.** *Warum:* ein Join müsste an **vier**
Stellen stehen (`posts_select_public_anon`, `posts_select_by_visibility`,
`post_engagement_counts`, `post_media_lesbar`). Der Entwurf zählte drei und
übersah die vierte — selbst das beste Argument gegen diesen Weg.

**Event-Beiträge sind systemverwaltet.** *Warum:* der Host **ist** ihr Autor und
konnte sie löschen, umschreiben oder die Sichtbarkeit zurückdrehen. Beide
Policies (`posts`, `post_media`) verlangen jetzt `kind = 'member'`.

**Das zweite Academy-Regal heißt „Gefällt mir", nicht „Gemerkt".** *Warum:*
`post_engagement_counts` gibt den Like-Zähler an jeden aus — ein Like ist hier
nicht privat, und „gemerkt" verspräche Privatheit, die es nicht gibt.

**Die Asymmetrie bleibt ohne UI-Hinweis** (gemini verlangte eine Entscheidung):
`members`-Posts brauchen Rang 4, `members`-Events nicht. Zum Go-Live sind alle
`impact`, also folgenlos; per pgTAP gepint.

## Files modified

Alles in `2c165a6`. Die Stellen, an denen später jemand suchen wird:

- `supabase/migrations/20260813090000_posts_video_url.sql` — `erste_video_url`
  zerlegt Host und Pfad **getrennt**; Postgres kennt kein `(?i:…)`.
- `supabase/migrations/20260813100000_posts_kind_event_trigger.sql` — EINE
  Trigger-Funktion für alle vier `host_id`-Übergänge.
- `supabase/tests/rls_test.sql` — §21 und §22, `plan(388)`.
- `src/lib/video-url.ts` — neu: die reinen Parser, aus `feed.ts` gezogen, damit
  ein Node-Skript sie aufrufen kann. `feed.ts` re-exportiert.
- `scripts/probe-c9-bestand.ts`, `scripts/probe-c9-parser-paritaet.ts`.

## Next session: start here

**`migrate-prod` freigeben** (Dry-Run oben, kein Datenrisiko), dann
`gh run rerun --failed` auf den `main`-Lauf zu `2c165a6`, dann den Live-Beleg an
einer Zeichenkette aus dem Diff führen. Erst danach ist das Fenster mit den
neun leeren Karten zu.

Danach `openspec archive academy-lite-and-feed-weave` — **Szenario-Titel in
MODIFIED-Blöcken unverändert lassen**, sonst bricht das Archivieren. Und
`add-academy-content` (AGE-262) anmerken: sein `## REMOVED`-Block zeigt jetzt
auf eine Anforderung, die es so nicht mehr gibt.

## Open questions

- **Die Pipeline-Lücke ist jetzt zum zweiten Mal aufgetreten** und war beide
  Male vorhersehbar: jede Migration mit Frontend-Abhängigkeit reißt zwischen
  `migrate-dev` und der manuellen `migrate-prod`-Freigabe ein Fenster auf, in
  dem live etwas falsch aussieht. Das ist eine Eigenschaft der Pipeline, keine
  Panne — aber sie ist weiterhin von niemandem entschieden.
- **Das Theme greift auf dem lokalen Stack nicht über `member_settings`
  allein** — der Schalter stand auf „navy", `data-variant` auch, die
  Inhaltsfläche blieb hell. Aufgelöst: `navy` überschreibt nur neun
  Chrome-Token. Kein Fehler, aber die Beschriftung „Dunkles Design" verspricht
  mehr, als das Theme tut. Nicht Teil von C9.
- **`codex` als Reviewer fiel zweimal aus** (Plan-Review 26 min, Diff-Review
  abgebrochen mit 0 Bytes). `opencode` (Kimi-K3) hat beide Male getragen.
- Unverändert offen aus der Vorsession: `host_partner_id`, der tote Host-Zweig
  in `event_attendees`, verwaiste Bucket-Objekte, keine Screenshot-Tests.
