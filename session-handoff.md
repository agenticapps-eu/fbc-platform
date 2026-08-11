# Session Handoff — 2026-08-11 (C7 / AGE-528, Sitzung 2)

## Accomplished

**C7 ist geplant, fremd-begutachtet und die tragende Annahme ist gemessen.
Noch keine Zeile Produktivcode.** Zwei Commits auf
`donald/age-528-c7-aktivitat-bilder-kuratierte-tags-reaktionen-wie-im-mockup`
(`fe41bb7`, `57e5abb`), Arbeitsbaum sauber, nicht gepusht.

- **`openspec/changes/activity-media-and-tags/`** mit proposal, design, tasks,
  REVIEWS, EVIDENCE und dem Delta auf `community-feed`: **11 ADDED
  Requirements, 29 Szenarien**, `openspec validate --all` grün (28/28). Kein
  MODIFIED-Block — keines der fünf bestehenden Requirements wird widersprochen.
- **Fremd-Review (Schritt 2b) vor der ersten Zeile Code**: `gemini` und
  `opencode` (→ `hf:moonshotai/Kimi-K3`), beide REQUEST-CHANGES. `codex` lief
  bei 600 s in die Zeitüberschreitung (exit 4) und zählt nicht. Alle Befunde
  eingearbeitet oder mit Begründung abgelehnt — Tabelle in `REVIEWS.md`.
- **Sonde `scripts/probe-post-media-signatur.ts` grün, alle sechs Fälle.**
  Damit ist der gewählte Storage-Weg belegt und Task 1.1 (Rückfallweg über
  eine Edge Function) tritt nicht ein.
- **Mockup im Repo**: `docs/mockups/aktivitaet-2026-07-29.png` (lag nur in
  Dropbox).
- Erledigt: Blöcke 0 und 1 der `tasks.md`, außer 1.0c.

## Decisions

- **Ein privater Bucket `post-media` mit signierten URLs**, nicht zwei Buckets
  nach Sichtbarkeit. Grund: ein privater Bucket lässt sich nur über signierte
  URLs in ein `<img>` bringen, und für `members` braucht man ihn ohnehin — der
  zweite Bucket spart die Maschinerie also nicht ein, sondern bezahlt mit einer
  nicht-atomaren Bucket-Wanderung bei jeder Sichtbarkeitsänderung (vier
  Schritte über zwei Systeme; ein Abbruch nach Schritt 1 legt `members`-Bilder
  in den öffentlichen Bucket).
- **Der Abnahme-Beweis ändert sich in der zweiten Hälfte** und Donald hat dem
  zugestimmt: bei einem privaten Bucket liefert die rohe `…/object/public/…`-URL
  für **beide** Beitragsarten nichts. Der `public`-Teil wird deshalb über den
  gerenderten ausgeloggten Feed geführt, der `members`-Teil zusätzlich über
  einen abgelehnten Signatur-Versuch. Tabelle in `design.md`.
- **Die Sichtbarkeitsfunktion schlägt über `storage_path` nach und zerlegt den
  Pfad nie** (Review-Befund gemini). Die INSERT-Policy prüft nur den **ersten**
  Pfadabschnitt — alles dahinter ist frei wählbar, eine daraus geschnittene
  Beitragskennung wäre fälschbar.
- **Veröffentlichen ist ein Schritt, nicht drei** (Review-Befund opencode):
  Beitrags-`id` im Client, Upload zuerst, dann **eine** RPC
  `create_post_with_media` in einer Transaktion. Sonst steht bei einem Abbruch
  ein bildloser Beitrag im Feed — der Cache wird sofort invalidiert.
- **`tags.key` = `lower(label)`, Label einwortig**, per Constraint erzwungen.
  Ohne das zerfällt derselbe Tag in zwei Werte, je nachdem ob er getippt oder
  geklickt wurde: `parseHashtags` normalisiert nur mit `toLowerCase()`,
  Umlaute bleiben stehen. Daran hängt auch die Tag-Vereinigung.
- **Startbefüllung aus dem Mockup**, nicht aus den Kompass-Kategorien. AGE-528
  vermutete „die elf Kompass-Kategorien" — es sind **14**, und es sind
  *Matching*-Kategorien („biete Kapital"), die als Beitragsthemen nicht tragen.
  Das Filterfeld im Mockup **ist** die kuratierte Liste: 11 Themen + 4 Formate.
- **Eine Reaktionsart bleibt** — und die Prämisse in AGE-528 stimmt nicht: das
  Mockup zeigt **keine** mehreren Reaktionsarten, jeder Beitrag hat genau ein
  Herz. Was zusätzlich zu sehen ist, sind Teilen-Zähler und „Speichern".
- **Feed auf 20 mit Paginierung**, Cursor über `(created_at, id)` — bei
  gleichen Zeitstempeln übersprünge `created_at` allein Beiträge, und der
  Import der ~70 Konten macht genau das wahrscheinlich.
- **Nicht übernommen** (in `REVIEWS.md` begründet): Zwischenbereich mit
  Aufräum-Cron für Uploads · `database.types.ts` generieren statt von Hand.

## Files modified

Alles neu, nichts Bestehendes angefasst:

- `openspec/changes/activity-media-and-tags/{proposal,design,tasks,REVIEWS,EVIDENCE}.md`
  und `specs/community-feed/spec.md` — der Change
- `scripts/probe-post-media-signatur.ts` — die Sonde (lokal fest verdrahtet)
- `docs/mockups/aktivitaet-2026-07-29.png` — Referenz aus Dropbox

## Next session: start here

**Block 2 der `tasks.md`: die pgTAP-Fälle rot schreiben, dann die zwei
Migrationen.** Erste Handlung: `supabase/tests/rls_test.sql` um den neuen
Abschnitt mit den Fällen aus 2.1 und 2.7a erweitern und `supabase test db
--local supabase/tests/rls_test.sql supabase/tests/grants_test.sql` laufen
lassen — die Fälle müssen **rot** sein, bevor
`20260812090000_post_media.sql` und `…090100_post_media_storage.sql` entstehen.

Der lokale Stack lief am Sitzungsende. **`infisical login` ist inzwischen
erledigt** (Donald, in einem echten Terminal), also ist auch **Task 1.0c**
machbar: die Sonde zusätzlich gegen DEV. Sie ist heute bewusst auf `127.0.0.1`
fest verdrahtet — für den DEV-Lauf braucht sie einen ausdrücklichen,
benannten Zielparameter, und der Lauf legt dort einen Wegwerf-Bucket an.
**Vor diesem Schreibzugriff das Zielprojekt nennen** (`foelowldexkcqzewvrcf`).
1.0c gehört vor den Moment, in dem Block 2 auf DEV landet, nicht vor Block 2
selbst.

Vier Fallen, die in Block 2 sicher zuschlagen:

1. **`storage.protect_delete()`** verbietet direktes SQL-Löschen in
   `storage.objects`/`buckets`. Testaufbauten räumen über die Storage-API ab.
2. **Ohne SELECT-Policy trifft ein `where` auf `storage.objects` 0 Zeilen**,
   auch bei `using(true)`. Ein verweigerter Fall wird über den **Fehler**
   belegt, nie über die Zeilenzahl.
3. **`grants_test.sql` ist ein Golden-Snapshot** — zwei neue Tabellen mit
   Grants brechen den `migrations`-Job, ohne dass `post_media` vorkommt.
4. **`database.types.ts` von Hand ergänzen**, nicht generieren.

## Open questions

- **Task 1.0c** offen (DEV-Lauf der Sonde), siehe oben. Nicht blockierend.
- **Startbefüllung der Tags** ist von Donald freigegeben, aber **noch nicht mit
  Detlev abgestimmt**. Eine Korrektur ist ein `insert`/`update` auf `tags`,
  keine Schema-Migration — also unkritisch, sollte aber vor dem Go-Live einmal
  über seinen Tisch.
- **Rechte Spalte:** in dieser Fassung trägt sie **nur** die Tag-Filterleiste.
  „Beliebte Tags" mit Zählern und „Aktivste Mitglieder" stehen im Mockup, sind
  aber Non-goal. Falls Detlev sie zum Go-Live erwartet, ist das ein eigener
  kleiner Change, kein Nachziehen in C7.
- **Aus dem Mockup weiter draußen:** Reiter (Alle/von mir/Gespeichert),
  Sortier-Auswahl, Teilen-Zähler, „Speichern", Link-Vorschaukarten,
  Composer-Knöpfe „Event"/„Umfrage".
- **Aus der letzten Sitzung noch offen:** dunkles Theme — `navy` färbt die
  Schale, nicht die Karten; gewollt oder Altlast? Plus `file_size_limit` für
  den bestehenden `avatars`-Bucket (hat serverseitig **keins**).
