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
- [x] 2.2 `fetch-depth: 2` — ohne Vorgänger keine Ableitung. Fehlt er, liefert
      der Job **nichts** aus und sagt das.
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
- [ ] 3.3 In `openspec/changes/password-reset-flow/tasks.md` Aufgabe 6.2
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
- [ ] 4.5 **Der erste echte Lauf ist die Abnahme.** Nach dem Merge prüfen, dass
      der Job lief, was er deployt hat und was er übersprang — und den
      `functions list`-Vergleich je Projekt lesen. Vorher gilt der Job als
      ungeprüft, egal wie grün die Tests sind.
