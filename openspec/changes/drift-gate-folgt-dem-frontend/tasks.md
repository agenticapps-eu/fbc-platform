## 0. Vor dem ersten Handgriff

- [x] 0.1 Ausgangsmessung festhalten: Ref aus `VITE_SUPABASE_URL` je Infisical-
      Umgebung (`dev`, `prod`) und der Inhalt beider `*-project-ref.txt`. Ohne
      diese Zahlen ist „das Gate misst jetzt das Richtige" eine Behauptung.
- [~] 0.2 Plan-Review (Schritt 2b) **bewusst übersprungen** — Entscheidung
      Donald, 2026-08-13. Der unabhängige Blick kommt stattdessen in Schritt 4
      auf dem Diff. Festgehalten statt abgehakt: es hat kein Reviewer auf dieses
      Delta gesehen, und ein Befund, der dort aufgetaucht wäre, kostet jetzt eine
      Überarbeitung statt einer Zeile. Kein `REVIEWS.md` in diesem Change.

## 1. Zielauflösung als reines Modul (TDD, RED zuerst)

- [x] 1.1 `scripts/live-target.test.ts` schreiben und **scheitern sehen**:
      trifft DEV-Ref → `dev`; trifft PROD-Ref → `prod`; trifft keinen → Abbruch
      mit Begründung; `VITE_SUPABASE_URL` fehlt oder leer → Abbruch; unparsbare
      URL → Abbruch. Kein `vi.mock` — die Funktion ist rein.
- [x] 1.2 Regressionsfall aus dem Vorfall: `https://foelowldexkcqzewvrcf.supabase.co`
      bei heutiger Ref-Belegung ergibt `dev`, **nicht** `prod`. Das ist der Fall,
      den die alte Verdrahtung falsch beantwortete.
- [x] 1.3 `scripts/live-target.logic.ts` implementieren, bis 1.1 und 1.2 grün
      sind. Rückgabe trägt die Umgebung UND den erkannten Ref, damit der Aufrufer
      protokollieren kann, ohne ein zweites Mal zu parsen.
- [x] 1.4 Dünnes CLI `scripts/live-target.ts` daneben, nach dem Muster von
      `assert-target.ts`: liest die Ref-Dateien, ruft das Modul, gibt Umgebung und
      Ref aus, `exit 1` bei Abbruch. Nie die URL ausgeben.

## 2. `drift-gate` auf das aufgelöste Ziel umstellen

- [x] 2.1 `needs: [migrate-dev]` am Job `drift-gate` setzen, mit Kommentar, warum
      (misst sonst DEV vor dessen eigener Migration).
- [x] 2.2 Infisical-CLI im Job installieren — gleicher Block wie in `functions`
      und `deploy`, kein `-E`.
- [x] 2.3 Ziel auflösen, beide `SUPABASE_DB_URL_*` als Job-Secrets bereitstellen
      und die passende an das **unveränderte** `migration-drift-gate.ts` als
      `argv[2]` reichen.
- [x] 2.4 Gemessenes Projekt in `$GITHUB_STEP_SUMMARY` **und** ins Joblog
      schreiben — in jeden Lauf, auch den unauffälligen.
- [x] 2.5 Zweite, nicht-blockierende Messung gegen das jeweils andere Projekt;
      Rückstand als Notiz, kein `exit 1`. Ein Fehlschlag dieser Messung darf den
      Job nicht rot machen — aber er muss als „nicht ermittelbar" dastehen und
      nicht als „kein Rückstand".

## 3. Nachweis

- [x] 3.1 `pnpm test` auf die neuen Tests: RED vorher, GREEN nachher, beides
      belegt.
- [x] 3.2 Auflöser lokal gegen **beide** echten Infisical-Umgebungen laufen
      lassen und die Ausgabe festhalten. Erwartung heute: `prod` → `dev`
      (das ist der Befund), `dev` → `dev`.
- [x] 3.3 `pnpm lint` (0 Errors, 4 vorbestehende Warnungen), `pnpm typecheck`
      und `pnpm build` grün; `pnpm test` 683/683. **Nicht** `pnpm format` —
      stattdessen `prettier --write` auf genau die neuen Dateien.
      `pnpm format:check` bleibt repoweit rot (95 Dateien), das ist Bestand und
      nicht Teil dieses Change.
- [x] 3.4 `actionlint` auf `deploy.yml` — Exit 0.
- [x] 3.5 `openspec validate --all --strict` grün.

## 3b. Was der Diff-Review gefunden hat (Schritt 4, alles behoben)

Der Review war die einzige unabhängige Kontrolle in diesem Change, weil 2b
entfiel. Er hat sich gelohnt — Befund 1 hätte die Havarie wiederholt.

- [x] 3b.1 **KRITISCH: der „nicht blockierende" Bericht wäre blockierend
      gewesen.** GitHub startet jeden `run:`-Block als `bash -e {0}`; `set -uo
      pipefail` löscht `errexit` nicht. Der Schritt wäre an der ersten
      fehlgeschlagenen Messung gestorben, der Auswertungsblock wäre toter Code
      und der Deploy wieder wegen einer Datenbank blockiert, die niemand liest.
      Behoben mit ausdrücklichem `set +e` (nicht `|| true` — das setzte `$?` auf
      0 und meldete jeden Rückstand als „abweichungsfrei").
      **Warum meine eigene Probe es nicht sah:** sie lief als `bash datei`, also
      ohne `-e`. Die Sonde stellte genau die Bedingung nicht nach, auf die es
      ankam. Jetzt wird der Schrittrumpf aus dem YAML extrahiert und unter
      `bash -e` gefahren.
- [x] 3b.2 Das Gate prüfte nur ein **Etikett**: es löste auf, welches Projekt
      der Build anspricht, nahm aber ungeprüft an, dass
      `SUPABASE_DB_URL_<UMGEBUNG>` dorthin führt. Ein vertauschtes Secret —
      beim Umzug die wahrscheinlichste Verwechslung — wäre grün durchgelaufen.
      Behoben: `assert-target.ts "$UMGEBUNG"` vor der Messung, dieselbe geprüfte
      Funktion wie in `migrate-dev` und `migrate-prod`.
- [x] 3b.3 `else` am Ziel-Schalter bedeutete stillschweigend PROD. Für ein Gate,
      dessen einziger Fehlermodus „falsche Datenbank gemessen" ist, ist das die
      falsche Vorgabe. Jetzt `case` mit rotem Standardzweig.
- [x] 3b.4 Der Bericht gab die `::error::`-Zeilen des Gates unverändert aus und
      erzeugte damit rote Annotationen an einem grünen Lauf — samt der
      Aufforderung, `migrate-prod` freizugeben. Jetzt zu `::notice::` entschärft.
- [x] 3b.5 STDOUT des Auflösers wurde nicht geprüft: eine Fremdzeile hätte
      `ref` verfälscht, eine einzeilige Ausgabe hätte `ref = "dev"` ergeben.
      Jetzt werden Zeilenzahl und Ref-Form geprüft.
- [x] 3b.6 Der Vertrag zum Workflow (zwei Zeilen STDOUT, Erklärung auf STDERR)
      war ungetestet — ein verrutschtes `console.log` wäre grün geblieben.
      `scripts/live-target.cli.test.ts` prüft ihn jetzt; **mutationsgeprüft**:
      `console.error` → `console.log` lässt zwei Tests fallen.
- [x] 3b.7 Kommentar korrigiert, der behauptete, `needs` koste keine Laufzeit.
      Es kostet rund zwei Minuten je Push (`migrate-dev + drift-gate` statt
      `max(…)`, plus Infisical-Installation).
- [x] 3b.8 Vermerkt, dass eine Supabase Custom Domain künftig jeden Deploy
      blockieren würde — richtige Richtung, aber wer sie einführt, muss an
      `live-target.logic.ts` vorbei.
- [x] 3b.9 Alle vier Zweige des Berichts unter `bash -e` gefahren:
      abweichungsfrei, kein Secret, Rückstand (mit untergeschobener leerer
      Fernhistorie, Ausgabe wortgleich zum Vorfall) und nicht ermittelbar —
      jedes Mal Schritt-Exit 0 und null rote Annotationen.

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
