## 0. Vor dem ersten Handgriff

- [ ] 0.1 Ausgangsmessung festhalten: Ref aus `VITE_SUPABASE_URL` je Infisical-
      Umgebung (`dev`, `prod`) und der Inhalt beider `*-project-ref.txt`. Ohne
      diese Zahlen ist „das Gate misst jetzt das Richtige" eine Behauptung.
- [~] 0.2 Plan-Review (Schritt 2b) **bewusst übersprungen** — Entscheidung
      Donald, 2026-08-13. Der unabhängige Blick kommt stattdessen in Schritt 4
      auf dem Diff. Festgehalten statt abgehakt: es hat kein Reviewer auf dieses
      Delta gesehen, und ein Befund, der dort aufgetaucht wäre, kostet jetzt eine
      Überarbeitung statt einer Zeile. Kein `REVIEWS.md` in diesem Change.

## 1. Zielauflösung als reines Modul (TDD, RED zuerst)

- [ ] 1.1 `scripts/live-target.test.ts` schreiben und **scheitern sehen**:
      trifft DEV-Ref → `dev`; trifft PROD-Ref → `prod`; trifft keinen → Abbruch
      mit Begründung; `VITE_SUPABASE_URL` fehlt oder leer → Abbruch; unparsbare
      URL → Abbruch. Kein `vi.mock` — die Funktion ist rein.
- [ ] 1.2 Regressionsfall aus dem Vorfall: `https://foelowldexkcqzewvrcf.supabase.co`
      bei heutiger Ref-Belegung ergibt `dev`, **nicht** `prod`. Das ist der Fall,
      den die alte Verdrahtung falsch beantwortete.
- [ ] 1.3 `scripts/live-target.logic.ts` implementieren, bis 1.1 und 1.2 grün
      sind. Rückgabe trägt die Umgebung UND den erkannten Ref, damit der Aufrufer
      protokollieren kann, ohne ein zweites Mal zu parsen.
- [ ] 1.4 Dünnes CLI `scripts/live-target.ts` daneben, nach dem Muster von
      `assert-target.ts`: liest die Ref-Dateien, ruft das Modul, gibt Umgebung und
      Ref aus, `exit 1` bei Abbruch. Nie die URL ausgeben.

## 2. `drift-gate` auf das aufgelöste Ziel umstellen

- [ ] 2.1 `needs: [migrate-dev]` am Job `drift-gate` setzen, mit Kommentar, warum
      (misst sonst DEV vor dessen eigener Migration).
- [ ] 2.2 Infisical-CLI im Job installieren — gleicher Block wie in `functions`
      und `deploy`, kein `-E`.
- [ ] 2.3 Ziel auflösen, beide `SUPABASE_DB_URL_*` als Job-Secrets bereitstellen
      und die passende an das **unveränderte** `migration-drift-gate.ts` als
      `argv[2]` reichen.
- [ ] 2.4 Gemessenes Projekt in `$GITHUB_STEP_SUMMARY` **und** ins Joblog
      schreiben — in jeden Lauf, auch den unauffälligen.
- [ ] 2.5 Zweite, nicht-blockierende Messung gegen das jeweils andere Projekt;
      Rückstand als Notiz, kein `exit 1`. Ein Fehlschlag dieser Messung darf den
      Job nicht rot machen — aber er muss als „nicht ermittelbar" dastehen und
      nicht als „kein Rückstand".

## 3. Nachweis

- [ ] 3.1 `pnpm test` auf die neuen Tests: RED vorher, GREEN nachher, beides
      belegt.
- [ ] 3.2 Auflöser lokal gegen **beide** echten Infisical-Umgebungen laufen
      lassen und die Ausgabe festhalten. Erwartung heute: `prod` → `dev`
      (das ist der Befund), `dev` → `dev`.
- [ ] 3.3 `pnpm lint && pnpm typecheck && pnpm build` grün. **Nicht** `pnpm
      format` — das schreibt rund 60 fremde Dateien um.
- [ ] 3.4 `actionlint` oder ersatzweise ein YAML-Parse auf `deploy.yml`, damit ein
      Syntaxfehler nicht erst auf `main` auffällt.
- [ ] 3.5 `openspec validate --all --strict` grün.

## 4. Nach dem Merge (nicht Teil des PR)

- [ ] 4.1 Ersten `main`-Lauf lesen: nennt `drift-gate` das gemessene Projekt, und
      ist es DEV? Das ist der eigentliche Beleg — die Unit-Tests sind es nicht.
- [ ] 4.2 Belegen, dass der Deploy im **selben** Lauf durchläuft, ohne dass
      jemand `migrate-prod` freigibt. Genau das war vorher unmöglich.
- [ ] 4.3 Prüfen, dass der Rückstand des anderen Projekts im Protokoll steht.
- [ ] 4.4 `openspec archive drift-gate-folgt-dem-frontend` — Szenario-Titel in
      MODIFIED-Blöcken unverändert lassen, sonst bricht das Archivieren.
- [ ] 4.5 Beim Umzug auf das PROD-Projekt gegenprüfen, dass dieselbe Regel dann
      PROD ergibt — ohne Textänderung. Vermerk am Umzugs-Vorhaben, nicht hier.
