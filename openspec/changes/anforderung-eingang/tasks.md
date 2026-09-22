## 1. Klären, bevor gebaut wird

- [x] 1.1 Capability: neu `anforderungen` (Donald, 22.09.).
- [x] 1.2 Größengrenze 25 MB, Drossel global 20/h, Teststrategie wie im Design
      (Donald, 22.09.).
- [x] 1.3 ChatGPTs Frist für eine Action: **45 s**, laut OpenAI-Doku
      (actions/production), statt sie zu messen. Daraus folgen 25 s für die
      Dateien und 8 s für `issueCreate` (design.md, Entscheidung 3).
- [x] 1.4 Download-Host: `files.oaiusercontent.com` laut OpenAI-Doku
      (actions/sending-files). Ob er weiterleitet, zeigt 7.2.
- [x] 1.5 Linear-IDs gegen Linear geprüft (design.md, Entscheidung 8).
- [x] 1.6 `openspec validate --all` grün.
- [x] 1.7 Plan-Review: gemini, codex, opencode, alle drei REQUEST-CHANGES.
      `REVIEWS.md` mit Auflösung.

## 2. Drossel (Migration)

- [x] 2.1 pgTAP-Test `supabase/tests/anforderung_drossel_test.sql` zuerst:
      `anforderung_frei` ist bei 19 frei und bei 20 nicht, `anforderung_vermerken`
      räumt alte Einträge, `anon`/`authenticated` ohne EXECUTE und ohne
      Tabellenzugriff, `service_role` mit EXECUTE. Rot belegen.
- [x] 2.2 Neue Migration `supabase/migrations/<ts>_anforderung_eingang_drossel.sql`:
      Tabelle ohne IP und ohne Inhalt, RLS an ohne Policy, zwei Funktionen
      `security definer` mit `search_path = ''`, Grants ausdrücklich. Begründung im
      Migrationskopf.
- [x] 2.3 Die Testdatei in die Liste in `ci.yml` eintragen. Abschnitt 6 von
      `grants_test.sql` bleibt unverändert grün. Lokal grün belegen: erst rot
      (0 von 13, Funktionen fehlen), nach `supabase migration up --local` 13 von
      13; `grants_test` + `rls_test` 457 von 457 unverändert.

## 3. Reine Logik mit Deno-Tests

- [x] 3.1 `pruefung.ts` + `pruefung.test.ts` (19 Tests grün).
- [x] 3.2 `beschreibung.ts` + Tests: Reihenfolge, „Bilder" nur mit Dateien,
      Bild/Video, Vermerke mit Grund, „Route: unklar", `TT.MM.JJJJ, HH:MM` in
      Europe/Berlin über den Sommerzeitwechsel, Markdown in Name, Einreicher und
      Route bleibt Text.
- [x] 3.3 `linear.ts` + Tests: `fileUpload` → `PUT` (Header-Reihenfolge, Linears
      Werte gewinnen), `issueCreate` mit Antwortprüfung und Frist von 8 s.
- [x] 3.4 `dateien.ts` + Tests: Fixture aus der OpenAI-Doku, String-Eintrag,
      Host, 3xx, 403, Größe mit und ohne `Content-Length`, Signatur, Frist je
      Datei, Gesamtfrist, hängender `PUT`.
- [x] 3.5 `eingang.ts` + Tests mit aufzeichnendem `fetch`-Ersatz und
      Positivkontrollen: 401 ohne Aufrufe (auch bei Header über 512 Zeichen),
      kaputtes JSON gibt 400, 429 ohne Download, fest verdrahtete IDs trotz
      fremder Felder, abgelaufener Link gibt 201 mit Vermerk, Zähler nur nach
      bestätigtem Anlegen, 502 bei Fehler und bei Frist, Probelauf gibt 200 ohne
      `nummer` und ruft Linear nie auf, jede Antwort ab 400 ist `{ fehler }`, das
      Log ohne Inhalte, Schlüsselvergleich (gleich, ungleich, andere Länge,
      leeres Secret gibt 500).

## 4. Function verdrahten

- [x] 4.1 `index.ts` als dünner Rumpf nach dem Muster `redeem-activation`.
- [x] 4.2 Block `[functions.anforderung-eingang]` mit `verify_jwt = false` und
      Begründung in `supabase/config.toml`. Wächter in
      `scripts/functions-config.test.ts` ergänzen, rot/grün belegen.
- [x] 4.3 `README.md` in der Function: Zweck, Secrets, Probelauf, Deploy.

## 5. Dokumentation und Vertrag

- [x] 5.1 `docs/secrets.md`: `LINEAR_API_KEY`, `ANFORDERUNG_SCHLUESSEL` und
      `ANFORDERUNG_PROBELAUF` (nur DEV) in die Tabelle und den Befehl, mit
      Hash-Prüfung. Dazu der Vermerk, dass `SUPABASE_URL` und
      `SUPABASE_SERVICE_ROLE_KEY` automatisch bereitgestellt werden.
- [x] 5.2 `.env.example`: Platzhalter für die drei Namen.
- [x] 5.3 `docs/custom-gpt-anforderungen.md` Teil 4: `{ fehler }` für 401, 429,
      500 und 502, dazu Dateigrenzen und Typen in der Beschreibung von
      `openaiFileIdRefs`.

## 6. Abschluss

- [x] 6.1 `pnpm typecheck`, `pnpm test` (2828), `deno test` (261, davon 75 hier)
      und `deno check` für die Functions, pgTAP, `openspec validate --all`, alle
      grün. `eslint` auf den geänderten Dateien sauber. Zusätzlich lokal per
      `supabase functions serve` gegen den echten Stack: 401, 400 (kaputtes
      JSON, Pflichtfelder), 200 im Probelauf (fremder Host und String-Eintrag
      vermerkt), 502 mit ungültigem Linear-Schlüssel gegen das echte Linear
      (Zähler bleibt 0), 429 bei 20 Einträgen (schreibt nichts).
- [x] 6.2 Code-Review (codex, opencode), Befunde eingearbeitet oder begründet
      abgelehnt; Auflösung im PR-Text.
- [x] 6.3 `supabase/functions/bildtest/` lokal gelöscht (nie committet).
- [ ] 6.4 PR auf `main`, mit den Schritten von Hand im PR-Text.

## 7. Von Hand, nach dem Merge (Donald)

- [ ] 7.1 Secrets in DEV und PROD setzen, per SHA-256 prüfen. `ANFORDERUNG_PROBELAUF=1`
      nur auf DEV.
- [ ] 7.2 Test-GPT gegen DEV im Probelauf, mit Screenshot und Zielbild. Im Log
      nachsehen: Host, Weiterleitung, Typ, Größe. Leitet OpenAI weiter, wird die
      Hostliste erweitert (Folge-PR).
- [ ] 7.3 Probelauf auf DEV aus, ein echtes Issue: beide Bilder eingebettet,
      Labels, Triage, Projekt.
- [ ] 7.4 Datenschutzentscheidung aus AGE-830 vor der Übergabe an Detlev.
- [ ] 7.5 `supabase functions delete bildtest --project-ref foelowldexkcqzewvrcf`,
      Test-GPT löschen.
