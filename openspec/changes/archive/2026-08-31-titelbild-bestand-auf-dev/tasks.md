# Tasks — `titelbild-bestand-auf-dev`

Kein Code. Die Arbeit war die Messung gegen DEV; das Ergebnis ist ein Absatz,
der niemanden mehr in einen Datenverlust führt.

## 1. Gegen DEV gemessen (nur lesend)

- [x] Ziel belegt, bevor irgendetwas lief: der fest verdrahtete `PROJECT_REF`
      in `demo_event_covers.ts` **und** `VITE_SUPABASE_URL` aus
      `infisical run --env=dev` zeigen beide auf `foelowldexkcqzewvrcf`
- [x] 8 Objekte in `event-covers`; Verhältnisse 1,333:1 bis 1,501:1;
      **0 von 8** auf 3,00:1 ± 0,01
- [x] Pfadform `<host_id>/vorschau-<bild>.webp` — gehört zu
      `import_world_seed.ts:687`, nicht zu `demo_event_covers.ts:133`
      (`<host_id>/demo-<datei>`)
- [x] **0 von 8** Event-IDs aus `demo_event_covers.ts` existieren auf DEV
- [x] `import_world_seed.ts` zielt auf PROD: `ZIEL_PROJEKT` = `viwntbodrtqxgmqyxluh`,
      erzwungen von `zielPruefen()`
- [x] Herkunft damit: Spiegel DEV ← PROD (AGE-576), der 1:1 kopiert
- [x] **Nichts gelöscht, nichts geschrieben.** Die Messsonde ist nach dem Lauf
      entfernt, der Arbeitsbaum war danach sauber
- [x] TLS ohne `DEMO_SEED_TLS_INSECURE` — strikte Prüfung trug

## 2. Das Delta schreiben

- [x] `MODIFIED`-Block aus dem Original erzeugt
- [x] Alle **neun** Szenarientitel maschinell auf Zeichengleichheit geprüft
- [x] Alle Zeilen, die nur in der alten Fassung stehen, durchgegangen — alle
      sechs gehören zum ersetzten Absatz
- [x] Die beibehaltene Klausel (`x-upsert: false` / SELECT-Policy) im neuen
      Absatz nachgewiesen, nicht bloss angenommen
- [x] `traegt` → `trägt`

## 3. Abnahme

- [x] `openspec validate --all` grün — 32 von 32
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` grün — 204 Dateien, 2259 Tests
- [x] `git diff --stat` zeigt ausschliesslich `openspec/`-Dateien

## 4. Archivieren und ausliefern

- [ ] `openspec archive titelbild-bestand-auf-dev`
- [ ] `pnpm release:entries` + einzeln prettier
- [ ] PR, CI grün, mergen
