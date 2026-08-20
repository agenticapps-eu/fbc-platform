# Session Handoff — 2026-08-20

**Migrations-Hygiene abgeschlossen.** Eine Störzeile in der PROD-Historie hielt
das Drift-Gate rot — gefunden, belegt, behoben. PR #190 gemergt, beide
ausgelieferten Flächen sind aktuell.

## Next session: start here

Nichts ist halb fertig, es gibt keinen offenen Zweig und keinen laufenden
Eingriff. `main` steht auf `31297c6`, Arbeitsbaum sauber, Dateien/DEV/PROD
deckungsgleich bei **70 Migrationen**.

**Erste Aktion ist eine Entscheidung, kein Befehl:** sollen für die Vorführung
**alle 71 Mitglieder sichtbar sein?** Zurzeit sind **36 aktiviert** — nur die
mit Beitrag, Kommentar oder Termin, weshalb „Bernard Peranic" im Verzeichnis
nicht auftaucht. Das ist kein Suchfehler. Wer das ändern will, fasst
`supabase/seed/import_world_seed.ts` an (die Stufenlogik steht im Memory
`import-impact-selbstregistrierung-basic`); wer es so lässt, sollte es Detlev
vorher sagen.

**Vor dem ersten Merge wissen:** `drift-gate` läuft **nur auf `main`** und ist
auf jedem PR-Branch `skipped`, nicht grün. Vier grüne Pflichtchecks sagen also
nichts über die PROD-Historie. Die Sonde dauert zwei Minuten und ist rein
lesend:

```
infisical run --env=prod --silent -- sh -c \
  'pnpm tsx scripts/migration-drift-gate.ts "$SUPABASE_DB_URL_PROD"'
```

## Accomplished

**Die Störzeile.** `20260817171033 admin_member_list_fixes` lag auf PROD ohne
Datei im Repo und machte `drift-gate` rot (`remote-nur`). Ihr Inhalt war ein
einziges Statement: ein `delete` auf `supabase_migrations.schema_migrations`.
Eine frühere Sitzung wollte ihre `apply_migration`-Reste aufräumen und ließ den
Aufräumbefehl **als Migration** laufen — er löschte die alten Phantomzeilen und
trug sich dabei selbst als neue ein.

**Das Schema war die ganze Zeit korrekt**, was eigens zu belegen war, weil
`20260817140000` **0 Statements** trägt (nachgetragen per `migration repair`,
nie ausgeführt). Gegenprobe an PROD: `admin_activate_member` trägt die
Zeilensperre, `admin_list_members` die Paging-Signatur mit `coalesce`. Zusätzlich
`db-drift-scan` gegen PROD: 54 Funktionen, 13 Trigger, 34 Tabellen, 54 Policies,
keine verwaisten Objekte — der doppelt angewendete Lauf hat nichts hinterlassen.

Behoben mit `supabase migration repair --status reverted 20260817171033`.
Danach beide Gates grün (PROD und DEV), Historie 70/70/70.

**PR #190 gemergt** (`31297c6`, Branch gelöscht) — in dieser Reihenfolge: erst
reparieren, dann mergen. Auf `main` liefen daraufhin `drift-gate`, `functions`,
`deploy`, `migrations`, `verify`, `edge-functions`, `migrate-dev` grün.

**Vorführ-Fläche von Hand deployt** (CI liefert sie nie aus). Beide Flächen
geprüft, am Bündelinhalt statt an der Größe:

| Fläche | Bündel | Datenbank | Pluralfix |
|---|---|---|---|
| `fbc-probe-a4664fb5.pages.dev` | `index-Brvg9eUV.js` | `viwntbodrtqxgmqyxluh` ✓, Demo-DB nicht enthalten ✓ | drin |
| `fbc-platform.pages.dev` | `index-DqM2dMDQ.js` | `foelowldexkcqzewvrcf` ✓ | drin |

**Zwei Korrekturen am vorigen Handoff.** Es sind **zwei Datenbanken, nicht
drei** — die „Import-DB" *ist* PROD (`SUPABASE_DB_URL_PROD` löst auf
`postgres.viwntbodrtqxgmqyxluh` auf). Und verdächtigt war die falsche Migration:
die Präfixsuche `20260817180000` liegt regulär auf beiden.

## Decisions

- **Historienzeile entfernen statt Leerdatei nachlegen.** Eine Datei
  `20260817171033_*.sql`, die nichts tut, hätte einen Unfall dauerhaft ins Repo
  geschrieben und müsste für immer erklären, warum sie leer ist.
- **`migration repair --status reverted`, nicht `delete`.** Genau der Fehler,
  der die Zeile erzeugt hat: Historie aufräumen darf nie als Migration laufen.
- **Erst reparieren, dann mergen.** Umgekehrt hätte der Merge einen
  übersprungenen Deploy für zwei Fixes produziert, die ausgeliefert werden
  sollten.
- **Am Bündelinhalt prüfen, nicht an der Größe** — und ein altes Bündel heißt
  nicht „Deploy gescheitert" (siehe unten).

## Files modified

Im Repo nur über PR #190 (`31297c6`), die Änderungen selbst stammen aus der
Vorsitzung:

- `src/components/events/EventCard.tsx` — Pluralfix „1 Platz frei"
- `src/components/events/EventCard.test.tsx` — Assertion dazu
- `supabase/tests/rls_test.sql` — `feedback`-Assertions zählen nur eigene Fixtures
- `session-handoff.md` — vorige Fassung

**Außerhalb des Repos:**

- **PROD-DB `viwntbodrtqxgmqyxluh`** — eine Historienzeile entfernt. Kein Schema.
- **Cloudflare Pages `fbc-probe-a4664fb5`** — neues Produktions-Deploy `e9a1beac`
- Memory: `dev-equals-prod-supabase`, `drift-gate-blockt-frontend-deploy`,
  `live-deploy-check-fallen`, `MEMORY.md` — je um die neuen Fallen ergänzt

## Open questions

- **Alle 71 sichtbar für die Vorführung?** Siehe oben — die einzige echte
  Entscheidung.
- **GitHub-Störung lief am 17.08. noch** (503): der automatische Pages-Job
  (`dynamic/pages/pages-build-deployment`, liefert `docs/` aus) fiel darüber und
  ließ sich nicht neu starten. **Beim nächsten Push auf `main` prüfen, ob er von
  selbst grün wurde.** Er kommt nicht vom Code — und `docs/secrets.md` enthält
  entgegen erster Vermutung keine echten Werte, nur Präfix-Beispiele.
- **Dritte ausgelieferte Fläche**, die im Handoff bisher fehlte:
  `https://agenticapps-eu.github.io/fbc-platform/` ist aktiv und öffentlich
  (Quelle `main//docs`). Nur Dokumentation, aber sie gehört auf die
  Rücknahmeliste, falls sie zum Go-Live nicht bleiben soll.
- **Rücknahmeliste vor Go-Live:** Pages-Projekt `fbc-probe-a4664fb5` löschen ·
  Probe-Adresse aus `uri_allow_list` · `APP_URL` · `mailer_autoconfirm` ·
  `IMPORT_SEED_MODE=reset` · ggf. GitHub Pages.
- Unverändert: Bericht an Detlev · Secrets vom 16.08. rotieren · AGE-497 ·
  AGE-541 · AGE-258 · AGE-522 · AGE-512 · AGE-561 · eigenes Issue für
  `send-activation` (2xx trotz Resend-401).
