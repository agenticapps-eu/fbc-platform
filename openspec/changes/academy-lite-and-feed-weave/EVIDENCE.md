# Belege — academy-lite-and-feed-weave (AGE-533 / C9)

Jede Zahl hier stammt aus einer Ausgabe, die im Verlauf steht. Was nicht
gemessen wurde, steht als „nicht gemessen" da und nicht als Annahme.

## 0.4 — Ist-Zustand vor der ersten Migration

Gemessen 2026-08-13 mit `scripts/probe-c9-bestand.ts` (rein lesend:
`default_transaction_read_only = on`, `statement_timeout = 30s`, kein
schreibender Befehl in der Datei) gegen **DEV `foelowldexkcqzewvrcf`** — das
ist zugleich die Datenbank, gegen die das Live-Frontend läuft.

### A · Sollwert für den `video_url`-Backfill

| Größe | Wert |
|---|---|
| `posts` gesamt | **12** |
| davon mit irgendeinem Link im Body | 2 |
| davon mit einbettbarem Video (SQL-Spiegel) | **2** |
| Beiträge mit mehr als einem Video | 0 |

Die beiden Treffer, einzeln — das ist die Liste, gegen die der TypeScript-Parser
gehalten wird, nicht eine Gesamtzahl:

| Beitrag | Token | SQL-Spiegel |
|---|---|---|
| `…0254f2` (12.06.) | `https://www.youtube.com/watch?v=Ks-_Mh1QhMc` | ja |
| `116d7b7e…` (22.07.) | `https://www.youtube.com/watch?v=AiOz1vDMjr0&list=RDAiOz1vDMjr0&start_radio=1` | ja |

**Abgleich mit `parseVideoUrl` von Hand, beide Fälle:** `new URL(...)`, Host
nach `replace(/^www\./)` = `youtube.com`, `pathname === "/watch"`,
`searchParams.get("v")` = `Ks-_Mh1QhMc` bzw. `AiOz1vDMjr0`, beide gegen
`/^[\w-]+$/` gültig ⇒ beide werden akzeptiert. **Keine Abweichung.** Der zweite
Fall ist der interessante: er trägt zwei weitere Query-Parameter hinter `v=`,
und `searchParams.get` schneidet sie korrekt ab — der SQL-Spiegel tut es über
`([&#][^\s]*)?$` ebenso.

Der maschinelle Abgleich über den echten Parser folgt in Aufgabe 1.4; bei
einem Korpus von zwei Zeilen ist die Handprüfung vollständig, nicht
stichprobenhaft.

### B · Sollwert für den Event-Backfill

| Größe | Wert |
|---|---|
| `events` gesamt | **9** |
| davon ohne `host_id` | **0** |
| davon mit `cover_path` | **0** |
| ältestes / neuestes | 12.06.2026 / 23.07.2026 |
| `visibility` | 8 × `members`, 1 × `public` |

Drei Folgen, die daraus abzulesen sind:

1. **Der Backfill erzeugt 9 Beiträge**, keinen weniger — der Zweig „Event ohne
   Host" ist in DEV unbesetzt. Er bleibt trotzdem im Trigger und im Test: die
   Spalte *ist* nullable, und ein Zweig, den heute nichts trifft, ist morgen der
   Fehler, der das Anlegen blockiert.
2. **8 der 9 Beiträge werden `members`** — ausgeloggt also unsichtbar, und
   unterhalb Rang 4 ebenfalls. Ein Sichttest als anon sieht **einen** Event-
   Beitrag, nicht neun. Ohne diese Zahl sähe das nach einem kaputten Backfill aus.
3. **Kein einziges Event hat ein Titelbild.** Die Event-Karte im Feed wird in
   DEV also durchweg ohne Bild erscheinen. Der Bildweg ist dadurch am Bestand
   nicht prüfbar — für die Sichtprobe (Aufgabe 6.8) muss ein Event mit Titelbild
   angelegt werden, sonst ist der Zweig ungemessen.

### C · Was die Migrationen sonst berühren

**`posts`-Spalten heute:** `id`, `author_id`, `body`, `hashtags`, `visibility`,
`created_at`. `video_url`, `kind` und `ref_id` existieren nicht — die
Migrationen laufen auf unbesetztes Feld.

**Indizes auf `posts`:** `posts_pkey`, `posts_author_id_idx`,
`posts_created_at_id_idx`, `posts_hashtags_gin`,
`posts_visibility_created_at_idx`. Kein Index über `video_url` oder `ref_id`.

**Check-Constraints auf `posts`:** nur `posts_visibility_check`
(`public`/`members`). Die toten Werte `prime`/`legacy` sind wie erwartet weg.

**Grants — die Frage war zuerst falsch gestellt.** Der erste Lauf fragte
`information_schema.column_privileges` und bekam achtzig Zeilen zurück. Das
beweist nichts: diese Sicht rechnet die Tabellen-Grants auf jede einzelne Spalte
herunter und ist auch dann voll, wenn kein Spalten-Grant existiert. Die Frage,
die trägt, ist `pg_attribute.attacl is not null`:

```
posts/events: Spalten mit ECHTEM Spalten-ACL → (keine Zeilen)
```

Damit ist belegt, was der Vorschlag behauptet: `video_url`, `kind` und `ref_id`
erben von `posts/authenticated = DELETE,INSERT,SELECT,UPDATE` und
`posts/anon = SELECT`; es ist **kein** Grant nachzuziehen. Die Sonde im Repo
stellt jetzt die richtige Frage.

**`create_post_with_media` existiert in genau einer Signatur:**
`create_post_with_media(uuid,text,text,text[],text[],jsonb)`. Keine Überladung
vorhanden, die vorher aufzuräumen wäre.

## 0.5 — Grün-Basis vor der ersten Codezeile

`pnpm lint` 0 Errors (4 Warnungen) · `pnpm typecheck` sauber ·
**93 Testdateien / 653 Tests grün**. Alles, was danach rot wird, gehört diesem
Change.

*Nebenbei, weil es zuerst falsch aussah:* der erste Lauf meldete `TEST_EXIT=1`.
Ursache war `pnpm test --run` — `--run` ging an pnpm statt an vitest
(`"test": "vitest run"` läuft ohnehin einmalig), die Suite lief gar nicht. Kein
Befund.

## 1.x — Migration A: `posts.video_url`

### RED vor GRÜN, belegt

`supabase test db … rls_test.sql` **vor** der Migration:

```
# Failed test 343: "posts trägt video_url"
# Failed test 344: "posts_video_url_idx besteht und ist partiell"
ERROR: function public.erste_video_url(unknown) does not exist
Failed 17/359 subtests
```

Die 342 Bestandsbehauptungen blieben dabei grün — der neue Abschnitt hat nichts
Bestehendes umgeworfen.

**Nach** der Migration: 359/359. Ein Zwischenschritt zeigte 358/359, und der
Fehler lag in der Behauptung, nicht im Code: `pg_indexes.indexdef` gibt
Schlüsselwörter GROSS zurück, `like` ist case-sensitiv, und mein Muster suchte
`where` klein. Korrigiert und um die Sortierspalten erweitert.

### Parität der zwei Erkenner — gemessen, nicht zugesagt

`scripts/probe-c9-parser-paritaet.ts` hält `public.erste_video_url()` gegen den
**echten** `extractFirstVideo` aus `src/lib/video-url.ts` — nicht gegen eine
Abschrift seiner Erwartungen.

```
39 Fälle: 20 mit Video (beide einig), 19 ohne Video (beide einig), 0 Abweichungen.
ERGEBNIS: deckungsgleich über den ganzen Korpus.
```

Der Korpus ist die Vereinigung aus allen Fixtures in `feed.test.ts`, den Fällen
aus `rls_test.sql` §21, den zwei echten Bestandstreffern aus DEV und den
Angriffen aus dem Plan-Review.

**Negativkontrolle — der Beweis, dass die Sonde Zähne hat.** Ein grüner
Vergleich sagt nichts, wenn er eine echte Abweichung nicht fände. Also den
Fehler, den der Review gefunden hat (`~` statt `~*`), gegen dieselbe Frage
gestellt:

```
case-sensitiv (Entwurfsfehler): NULL
ausgeliefert (~*):              https://WWW.YouTube.com/watch?v=Ks-_Mh1QhMc
```

TypeScript liefert dort die URL. Der Entwurf hätte also `null` gespeichert und
den Beitrag still aus der Academy gehalten — und die Sonde hätte es als
Abweichung gemeldet.

### Der Schnitt in `src/lib/video-url.ts`

`parseVideoUrl`, `extractFirstVideo` und `tokenizePostBody` sind aus `feed.ts`
in ein eigenes Modul gezogen; `feed.ts` exportiert sie unverändert weiter, alle
sieben bisherigen Importeure bleiben unberührt.

Der Grund ist die Messung oben: `feed.ts` baut beim Laden den Supabase-Client
(`import.meta.env`) und ist außerhalb von Vite nicht importierbar. Ohne den
Schnitt bliebe nur, die Erwartungen im Skript abzuschreiben — das prüfte die
Abschrift, nicht den Parser.

**Beleg, dass der Schnitt nichts verändert hat:** typecheck sauber und
**653/653 Tests grün — dieselbe Zahl wie in der Basis.**

### Typen

`pnpm gen:types` existiert nicht (Befund codex, LOW — nachgemessen). Der Weg ist
`supabase gen types typescript --local`.

Das Generat wurde **nicht** eingecheckt: es unterscheidet sich in 3415 Zeilen von
der eingecheckten Datei, weil diese Prettier-formatiert ist und aus einer anderen
CLI-Version stammt. Ein wholesale-Ersatz wäre fremder Ballast im Diff. Stattdessen
`video_url: string | null` von Hand in `Row`/`Insert`/`Update` ergänzt und **gegen
das Generat gegengeprüft** — Feld, Typ und Position stimmen überein.

### Abschluss Migration A

`pnpm lint` 0 Errors · `typecheck` sauber · **653/653** Tests ·
pgTAP über alle drei Suiten mit ausdrücklicher Dateiliste:
**379 Tests, `Result: PASS`** — `grants_test.sql` inbegriffen, der
Golden-Snapshot bleibt also unberührt (keine neue Tabelle).

## 2.x — Academy-Seite

### Sichtprobe im Browser, gegen echte Daten

Nicht gegen Fixtures: lokaler Stack, zwei echte Konten über die Auth-Admin-API,
vier Beiträge — drei mit Video, **einer bewusst ohne**, plus ein Like des einen
Kontos auf das Video des anderen.

Der Trigger hat dabei sichtbar getan, was er soll:

| Beitrag | `video_url` |
|---|---|
| „Mein Vortrag zum Thema Führung … `watch?v=qp0HIF3SfI4`" | gesetzt |
| „… meine Sicht auf Gründungen … `watch?v=bNpx7gpSqbY`" | gesetzt |
| „Eine ruhige Einstimmung. `vimeo.com/76979871`" | gesetzt |
| „Ein ganz normaler Beitrag ohne Video …" | **null** |

**Reiter „Alle"** (1440×900): drei Karten, alle drei Embeds geladen (zwei
YouTube, ein Vimeo), echte Autorennamen mit Profil-Link. Der Beitrag ohne Video
fehlt — der Filter greift.

**Reiter „Meine Academy"**: zwei Regale.
„Von mir geteilt" zeigt genau das eigene Video, nicht die zwei fremden.
„Gefällt mir" zeigt genau das gelikte fremde Video, mit dem Hinweis
„Zuletzt markierte zuerst".

**375 px**: eine Spalte, Karten passen, beide Reiter erreichbar.

**Konsole: keine Fehler, keine Warnungen.**

Der abgeschnittene linke Rand in den Vollseiten-Aufnahmen ist ein Artefakt der
Aufnahme über die feste Seitenleiste, kein Layoutfehler — im Viewport-Screenshot
bei 1440 px steht alles am Platz.

### Ein Wächter-Test hat die Prämisse gewechselt, nicht die Regel

`EmptyState.wording.test.tsx` führte `AcademyPage.tsx` unter „trägt bewusst
KEINEN Leerzustand" — mit der Begründung, sie rendere immer Inhalt (drei feste
Videos). Das stimmt nicht mehr: die beiden Reiter speisen sich aus `posts` und
sind am 17.08. garantiert leer.

Die Academy ist deshalb in die andere Liste gewandert („bietet im Leerzustand
eine Handlung an"), nicht aus dem Test entfernt worden. Der Wächter prüft jetzt,
dass ihre Leerzustände einen Weg anbieten — das ist strenger als vorher, nicht
lockerer.

### Abschluss Academy

`typecheck` sauber · `lint` 0 Errors (unverändert 4 Warnungen) ·
**94 Testdateien / 659 Tests grün** (653 Basis + 6 neue).

## Noch nicht gemessen

- **PROD.** Die Sonde nimmt `SUPABASE_DB_URL_PROD` entgegen und ist dort noch
  nicht gelaufen. Vor `migrate-prod` (Aufgabe 8.2) nachzuholen — die Zahlen
  oben gelten für DEV.
- Alles ab Aufgabe 1.1: es existiert noch keine Zeile Code.
