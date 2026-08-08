Linear: **AGE-506**. TDD — RED vor GREEN, roter Lauf zitiert statt behauptet.

## 1. Die Ableitung, prüfbar

- [x] 1.1 **RED:** `scripts/changed-functions.logic.test.ts` — aus geänderten
      Pfaden werden die betroffenen Function-Namen abgeleitet: ein Treffer je
      Function, Dubletten zusammengefasst, Pfade außerhalb
      `supabase/functions/` ignoriert, leere Eingabe → leere Ausgabe.
- [x] 1.2 **RED:** Der Fall, an dem die Abkürzung scheitern würde: eine
      Änderung an `supabase/config.toml` liefert **keine** Function, sondern
      setzt das Warnflag. Sonst sieht der Job vollständig aus, ohne es zu sein.
- [x] 1.3 **GREEN:** `scripts/changed-functions.logic.ts` — reine Funktion,
      keine I/O.
- [x] 1.4 Dünner CLI-Aufruf `scripts/changed-functions.ts`, der die Pfade von
      stdin liest und die Namen zeilenweise ausgibt. Keine Logik darin.
- [x] 1.5 In `vitest.config` prüfen, dass `scripts/**/*.test.ts` erfasst ist —
      sonst läuft der Test nie (dieselbe Falle wie bei der pgTAP-Dateiliste).

## 2. Der Job

- [x] 2.1 Job `functions` in `.github/workflows/deploy.yml`, `if` auf `main`,
      `needs: [migrate-dev, drift-gate]` und dieselbe `!cancelled()`-Bedingung
      wie `deploy`. Kopf-Kommentar trägt die Begründung der Reihenfolge.
- [x] 2.2 ~~`fetch-depth: 2` — ohne Vorgänger keine Ableitung.~~ **Ersetzt durch
      5.7:** `fetch-depth: 0`. `2` reichte nur, solange gegen `HEAD^` verglichen
      wurde. Fehlt jede Basis, liefert der Job weiterhin **nichts** aus und sagt
      das.
- [x] 2.3 Keine geänderte Function → Job endet mit einer ausdrücklichen Zeile,
      nicht stumm.
- [x] 2.4 Je Function und je Ref aus `scripts/{dev,prod}-project-ref.txt`:
      `supabase functions deploy <name> --project-ref <ref>`.
- [x] 2.5 **Übersprungene Functions namentlich ins Protokoll** — die
      Beschränkung muss sichtbar sein, sonst liest sie sich als
      Vollständigkeit.
- [x] 2.6 Danach `supabase functions list --project-ref <ref>` je Projekt ins
      Protokoll. Ein fehlerfreier Befehl ist kein Beleg für den Zielzustand.
- [x] 2.7 Warnung ausgeben, wenn `supabase/config.toml` im Merge lag: ein
      geändertes `verify_jwt` wird von der Ableitung nicht erfasst.

## 3. Die Merkregel ersetzen

- [x] 3.1 Aufgabe 11.2 (f) in `member-activation-flow/tasks.md` auf den neuen
      Zustand bringen — die Regel wird **ersetzt**, nicht ergänzt, sonst stehen
      zwei Wahrheiten nebeneinander.
- [x] 3.2 `docs/secrets.md` um `SUPABASE_ACCESS_TOKEN` ergänzen: wozu, dass er
      in Infisical (`dev`) liegt und warum dort, und dass kein neues
      GitHub-Secret dazukommt.
- [x] 3.3 In `openspec/changes/password-reset-flow/tasks.md` Aufgabe 6.2
      nachziehen, sobald der Job steht.

## 4. Gates und Abnahme

- [x] 4.1 `pnpm test`, `pnpm typecheck`, `openspec validate --all`.
- [x] 4.2 YAML-Syntax belegen, nicht annehmen (`actionlint` oder ein
      gleichwertiger Parser-Lauf).
- [ ] 4.3 Unabhängiger Code-Review auf den Diff. Löst Donald aus.
- [x] 4.4 ~~Blocker: `SUPABASE_ACCESS_TOKEN` als Repo-Secret hinterlegen.~~
      **Entfällt.** Der PAT liegt seit AGE-496 in Infisical (`dev`); der Job
      zieht ihn über `infisical run`. Nachgesehen statt angenommen — er ist in
      `dev` vorhanden und in `prod` nicht, und genau deshalb liest der Job
      `dev` (Begründung im Workflow und in `design.md`).
- [x] 4.5 **Der erste echte Lauf ist die Abnahme.** Gelaufen am 2026-08-08
      (`31247900892`): `Abgeleitet: resend-activation`, DEV meldete „No change
      found" (bytegleich mit dem manuellen Deploy von 07:48Z), PROD v1 → v2, die
      anderen fünf namentlich als übergangen protokolliert. **Die Abnahme fiel
      nicht sauber aus** — sie legte die Lücke offen, die Gruppe 5 schließt. Die
      Abnahme des korrigierten Jobs steht als 5.11 aus.

## 5. Die Vergleichsbasis — was ausfiel, wird nachgeholt

Der erste echte Lauf (4.5, `31247900892`) legte die Lücke offen, und sie hatte
sich **vorher schon ausgewirkt**: Lauf `31211729060` (Merge `36b662a`) sprang
`functions` über, weil `drift-gate` rot war. Der Merge änderte
`supabase/functions/send-activation/index.ts`. Der Folgelauf verglich
`HEAD^..HEAD` und sah davon nichts. Auf das Ziel kam die Änderung nur, weil der
**nächste** Merge zufällig dieselbe Function anfasste — Glück, kein Mechanismus.
Dieselbe Fehlerklasse wie AGE-495/E2, nur in CI statt in einer Function.

- [x] 5.1 **RED:** `scripts/deploy-base.logic.test.ts` — aus einer Liste von
      Läufen (neuester zuerst) mit dem Ergebnis ihres `functions`-Jobs wird die
      Basis gewählt: erster `success` gewinnt; `skipped` und `failure` werden
      übergangen, **nicht** als Basis genommen; leere Liste → keine Basis.
- [x] 5.2 **RED:** Der Fall, der den Auftrag ausgelöst hat, als Regressionstest —
      ein übersprungener Lauf **zwischen** zwei erfolgreichen ergibt den
      **älteren** SHA, damit der übersprungene Merge wieder im Diff liegt.
- [x] 5.3 **GREEN:** `scripts/deploy-base.logic.ts` — reine Funktion, keine I/O,
      gibt Basis **und Grund** zurück. Der Grund ist kein Beiwerk: er ist das,
      was ins Protokoll muss.
- [x] 5.4 Dünner CLI-Aufruf `scripts/deploy-base.ts`, der die Läufe als JSON von
      stdin liest. Keine Logik darin — gleiches Muster wie 1.4.
- [x] 5.5 Im Job die Läufe holen (`gh api …/runs` je Lauf `…/jobs`, gefiltert
      auf `branch=main`, `event=push`) und durch den CLI schicken. **Job-Ebene,
      nicht Lauf-Ebene:** ein übersprungener Job macht einen Lauf nicht rot, die
      Lauf-Ebene wäre also nur über eine Schlusskette korrekt, die ein künftiges
      `if:` still kippt.
- [x] 5.6 `permissions: actions: read` **am Job**, nicht am Workflow — der
      Workflow steht auf `contents: read`, unaufgeführte Rechte sind damit
      `none`. Nur dieser eine Job liest Laufhistorie.
- [x] 5.7 `fetch-depth: 0` statt `2` — die Basis liegt außerhalb von `HEAD^`,
      sobald ein Lauf ausfiel. Aufgabe 2.2 wird dadurch **ersetzt**, nicht
      ergänzt; der Kopf-Kommentar zieht nach.
- [x] 5.8 Basis ist kein Vorfahr von HEAD (Force-Push) oder nicht ermittelbar →
      Rückfall auf `HEAD^` mit `::warning::`. Entscheidung Donald (08.08.):
      warnen statt fehlschlagen — nie schlechter als der heutige Stand.
- [x] 5.9 **Vergleichsbasis und Grund in JEDEN Lauf ins `$GITHUB_STEP_SUMMARY`**,
      auch wenn nichts auszuliefern war. Eine Basis, die nur im Ausnahmefall
      genannt wird, ist im Normalfall unbelegt — dieselbe Begründung wie bei 2.5.
- [x] 5.10 `pnpm test`, `pnpm typecheck`, `actionlint`, `openspec validate --all`.
- [ ] 5.11 **Abnahme am echten Lauf:** nach dem Merge im Protokoll lesen, welche
      Basis gewählt wurde und warum. Erwartung beim ersten Lauf: `57032b5` aus
      Lauf `31247900892` — also **gleich** `HEAD^`, weil aktuell keine Lücke
      offen ist. Der Beleg ist die genannte Herkunft, nicht der Wert.
