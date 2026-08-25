# Session Handoff — 2026-08-25 (zwanzigste Sitzung, AGE-582 Abschnitte 2–4)

**Die Abschnitte 2, 3 und 4 sind gebaut, der Code-Review ist gelaufen und seine
fünf Befunde sind abgearbeitet.** Sieben Commits auf
`donald/age-582-aktivitaet-auf-konzeptstand`, PR #205. **5, 6 und 7 sind
unberührt — und dort beginnt das Frontend.**

Drei Messungen haben Behauptungen umgestossen, die vorher als sicher galten —
eine davon meine eigene.

## Accomplished

**Abschnitt 2 — `post_saves`** (`c2bc588`). Private Merkliste, PK
`(profile_id, post_id)`, beidseitig kaskadierend, **drei** Policies statt eines
`for all`. 24 Zusagen in `post_saves_test.sql`.

**Abschnitt 3 — Zähler und Rechte** (`5b32b8a`, `253413b`), in der Reihenfolge,
die der Plan wörtlich verlangt hat: erst der rote Angriffstest, dann der Entzug
auf `post_likes`, dann der Zähler, dann der Entzug auf `posts`. Der Angriffstest
stand rot mit `have: …-000b` — die Reaktionszeile war gewandert.
`posts.like_count` mit Trigger, Prüfbedingung `>= 0` und Index. 23 Zusagen.

**Abschnitt 4 — Sidebar-Aggregate** (`b368e26`). `feed_tag_counts()` und
`feed_top_authors(p_limit)`, beide `security invoker` — das
Sichtbarkeitsprädikat wird **nicht** kopiert. 18 Zusagen.

**Gemessen, nicht behauptet.** Jeder Abschnitt stand vorher rot, und zu jeder
tragenden Zusage gibt es eine Gegenprobe am lebenden Katalog (`alter policy` /
`alter function` / `grant`), jede einzeln zurückgenommen. Zwölf Gegenproben
insgesamt; die schärfste: `like_count` allein in die Spaltenliste
zurückzulegen öffnet die Selbstbeförderung sofort wieder.

**Code-Review (Schritt 4)** über `main...HEAD`, 41 Dateien. Fünf Befunde, alle
nachgemessen und abgearbeitet (`566a96f`, Einzelheiten in `tasks.md` §4b). Der
schwerste: **mein Entzug des INSERT-Rechts auf `posts` hat vier Zusagen in
`rls_test.sql` ausgehöhlt.** Das ACL antwortet seither VOR der Policy, also
blieben sie grün, während das gemeinte Gate ausgebaut war — genau die Falle, die
ich bei 22.15 repariert und an vier weiteren Stellen übersehen hatte.

**Gesamtstand:** 9 pgTAP-Dateien, **671 Zusagen**, PASS. Vitest **133/1485**.
`tsc --noEmit` sauber.

## Decisions

- **Drei Policies auf `post_saves` statt eines `for all`** wie bei
  `likes_write_own`. *Warum:* `for all` schlösse UPDATE ein, und an einer
  Speicherung gibt es nichts zu ändern. Das Grant allein trägt die Aussage
  nicht — bis AGE-312 kam der Ist-Zustand aus Supabases `alter default
  privileges`. Also steht sie zweimal.
- **Prüfbedingung `like_count >= 0` statt `greatest(…, 0)`.** *Warum:*
  `greatest` fängt eine negative Zahl **still** ab und macht jedes künftige Loch
  unsichtbar. Die Prüfbedingung fällt laut aus, dort wo das Loch entsteht.
- **`posts` verliert INSERT und tabellenweites UPDATE.** *Warum:* der Befund war
  real — vor dem Entzug las die Zusage `'OK'`, ein Autor konnte
  `update posts set like_count = 999` auf seinem eigenen Beitrag absetzen.
- **Das Design war an einer Stelle falsch, korrigiert statt übernommen.** Die
  Plan-Review schrieb, der Verschiebe-Angriff treffe „einen Beitrag, den der
  Angreifer nicht einmal sehen muss". Gemessen: **stimmt nicht** — der
  `exists`-Ausdruck in `likes_write_own` läuft unter der RLS des Aufrufers. Die
  Reichweite ist „jeder sichtbare Beitrag", ab `exchange` der ganze Club. Der
  Entzug bleibt richtig, die Begründung ist berichtigt (`design.md` §4a).
- **Kein neuer Index für die Sidebar (4.9) — und das ist eine Messung.** Der
  Verdacht lag auf dem Tag-Join, weil der Planer `posts_hashtags_gin` nicht
  nimmt. Falsch: die verworfene `unnest`-Fassung bringt 489 ms statt 507.
  Derselbe `count(*)` über 20 000 Beiträge kostet **0,79 ms / 364 Puffer ohne
  RLS** und **464 ms / 71 065 unter RLS** — Faktor 195, bevor irgendetwas
  aggregiert wird. Die Grenze ist `posts_select_by_visibility` mit `has_level(4)`
  je Zeile. **Gehört nicht in diesen Change, gehört aber aufgeschrieben.**
- **Eine gelöschte Policy ist keine gültige Gegenprobe.** Bei eingeschalteter
  RLS ohne Policy gilt Default-Deny — es wird alles abgewiesen, und der Test
  bleibt grün, ganz gleich was er misst. Nur das AUFWEICHEN misst
  (`alter policy … using (true)`, oder gezielt ein Prädikatsteil heraus). Mit
  `using(true)` fallen 10 Zusagen; nimmt man nur `is_activated()` heraus, fällt
  **genau eine** — die reparierte. Das gilt für jede künftige RLS-Gegenprobe in
  diesem Repo.
- **Event-Beiträge zählen für „Aktivste Mitglieder" mit** (Donald, 25.08.).
  *Warum:* ein Event-Beitrag steht als Karte im Feed; eine Liste, die eine
  sichtbare Karte nicht mitzählte, wäre schwerer zu erklären. *Preis:* ein
  Gastgeber steht oben, ohne je geschrieben zu haben. Drehen = eine Zeile
  (`and p.kind = 'member'`).
- **`feed_top_authors` ist nicht an `anon` vergeben**, `feed_tag_counts` schon.
  *Warum:* `profiles_public` hält für `anon` kein Recht. Das steht als GRANT und
  nicht als Vorsatz im Client — ein Aufrufweg, den es nicht gibt, entsteht nicht
  versehentlich.

## Files modified

**Neu — Migrationen** (alle forward-only, **nirgends ausser lokal angewendet**):
`20260824130000_post_saves.sql` · `20260824140000_post_likes_ohne_update.sql` ·
`20260824150000_posts_like_count.sql` ·
`20260824151000_posts_beliebtheit_index.sql` ·
`20260824160000_posts_rechte_enger.sql` ·
`20260824170000_feed_sidebar_aggregate.sql`

**Neu — Tests:** `supabase/tests/post_saves_test.sql` (24) ·
`feed_popularity_test.sql` (23) · `feed_sidebar_test.sql` (18) ·
`src/lib/feed.like.test.ts` (4)

- `supabase/tests/grants_test.sql` — §1 um `post_saves` ergänzt, `post_likes`
  ohne UPDATE, `posts` auf `DELETE,SELECT`; §2 um `posts.UPDATE=body,hashtags,
  visibility` und `posts` in der `table_name in (…)`-Liste
- `supabase/tests/rls_test.sql` — **nur 22.15**: schrieb `kind`/`ref_id`, lief
  bis dahin bis zur Policy durch und riss nach dem Entzug den ganzen Lauf mit
  (386 von 433). Auf `try_as`/`alike` umgestellt, Grund im Kommentar
- `.github/workflows/ci.yml` — die **drei** neuen pgTAP-Dateien eingetragen.
  Ohne diesen Schritt läuft eine Datei nie; genau so sind die beiden
  `member_lifecycle`-Dateien am 23.08. an CI vorbeigelaufen
- `openspec/changes/activity-concept-level/tasks.md` — 2, 3, 4 abgehakt
- `openspec/changes/activity-concept-level/design.md` — §4a berichtigt
- **Aus dem Review:** `supabase/tests/rls_test.sql` (vier weitere Zusagen: 645
  und 22.13 geben das INSERT-Recht in der Transaktion kurz zurück, 22.11/22.12
  laufen als Eigentümer über `throws_ok` auf `23505`/`23514`) ·
  `src/components/ui/icons.tsx` (`MASSIV_MIT_KONTUR`, das Herz behält seine
  Kontur) · `src/components/ui/icons.render.test.tsx` **neu** ·
  `src/config/bereiche.test.ts` (Anker wird zugesichert — die Zusage war
  selbstblind)

Untracked und **absichtlich nicht committet**: `scripts/chat-testkonten.ts`.

## Next session: start here

**Erste Handlung: Abschnitt 5, die Datenschicht des Feeds.** Der Review ist
gelaufen und abgearbeitet, CI ist grün auf `1967d527` (der HEAD-SHA, nicht auf
einer älteren) — es liegt nichts mehr davor.

**Abschnitt 5 ist Frontend, und dafür gilt Donalds Regel:** erst eine laufende
lokale Version zeigen, dann committen. Das braucht `pnpm dev`, und das braucht
eine Infisical-Sitzung in einem **echten Terminal** — aus Claude Code heraus
geht der Login nicht (kein TTY). Donald muss ihn vorher gemacht haben.

Vor dem ersten Frontend-Zugriff auf `like_count` oder die neuen RPCs:
`src/lib/database.types.ts` ist **nicht** nachgezogen. Die Spalte und die beiden
Funktionen fehlen dort. `tsc` ist heute sauber, weil noch niemand sie anfasst —
mit der ersten Zeile in Abschnitt 5 ist das vorbei.

## Open questions

- **Der Aktivierungsversand.** 69 von 72 PROD-Konten nicht aktiviert,
  `app.fairbusinessclub.de` weiterhin ohne DNS-Eintrag. Donald am 25.08. dazu:
  „das ist okay" — also **kein Auftrag an mich**, aber der Punkt ist damit nicht
  erledigt, sondern seine Sache.
- **Die RLS-Kosten von `posts_select_by_visibility`** (Faktor 195, siehe oben).
  Neuer Befund dieser Sitzung, bewusst nicht angefasst.
- **Kein `offset` in den zwei Sidebar-Aggregaten.** Der Review hat es gegen die
  stehende Paging-Regel gehalten. Meine Abwägung steht im Kopf der Migration:
  Spitzenwerte sind keine Listen, „die fünf aktivsten Mitglieder, Seite 2" ist
  keine Frage. **Donald kann das überstimmen** — dann `p_offset` an beide.
- `post_engagement_counts` prüft noch `visibility = 'prime'` und `'legacy'` —
  Werte, die es seit dem 6-Stufen-Modell nicht mehr gibt. Tote Zweige,
  aufgefallen beim Lesen, nicht angefasst (ausserhalb des Auftrags).
- Vier gepushte Commit-Messages aus der Vorsitzung tragen den **falschen Tag**;
  Quelltext korrigiert, Historie nicht (liegt auf dem Remote).
- Unverändert offen: drei abweichende Anmeldeadressen · ein echter Mitgliedsname
  in der Git-Historie · Rotation des PROD-DB-Passworts · vier Review-Befunde aus
  11.5 · 7.5 halb · kein Nachsetz-Weg für eine gelöschte Zeile ohne Ban ·
  `grund` ohne Aufrufer · `admin_audit.actor` ohne `on delete cascade` ·
  Downgrade (AGE-516) · `admin_list_feedback()` ohne Paging · **DEV ist nicht
  mitgepflegt**.
