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

## Noch nicht gemessen

- **PROD.** Die Sonde nimmt `SUPABASE_DB_URL_PROD` entgegen und ist dort noch
  nicht gelaufen. Vor `migrate-prod` (Aufgabe 8.2) nachzuholen — die Zahlen
  oben gelten für DEV.
- Alles ab Aufgabe 1.1: es existiert noch keine Zeile Code.
