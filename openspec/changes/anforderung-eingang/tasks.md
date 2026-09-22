## 1. Klären, bevor gebaut wird

- [ ] 1.1 Donald entscheidet die Capability (`anforderungen` neu oder Delta auf
      `feedback-qm`, design.md offene Frage 1). Bei `feedback-qm` wird das
      Delta verschoben und der Purpose-Konflikt im Proposal offengelegt.
- [ ] 1.2 Donald entscheidet die Größengrenze (Vorschlag 25 MB, design.md
      Entscheidung 4) und die Drossel (global 20/h, offene Frage 4).
- [ ] 1.3 ChatGPTs Frist für eine Action messen (offene Frage 3): die
      `bildtest`-Function lokal um ein `sleep` erweitern, nicht committen, mit
      dem Test-GPT gegen DEV. Messwert und Gesamtfrist in design.md eintragen.
- [ ] 1.4 Host der `download_link`s aus dem DEV-Log von `bildtest` lesen oder
      beim Test aus 1.3 mitprotokollieren (offene Frage 5).
- [ ] 1.5 `openspec validate --all` grün.
- [ ] 1.6 Plan-Review mit zwei Reviewern fremder Anbieter (`openspec-change-review`),
      `REVIEWS.md` mit Trailer, Befunde eingearbeitet oder begründet
      zurückgewiesen.

## 2. Drossel (Migration)

- [ ] 2.1 pgTAP-Test zuerst: die 21. Zählung in einer Stunde ist gedrosselt, alte
      Einträge werden geräumt, `anon`/`authenticated` haben kein EXECUTE auf
      `anforderung_zaehlen` und keinen Zugriff auf `anforderung_eingaenge`. Rot
      belegen.
- [ ] 2.2 Neue Migration `supabase/migrations/<ts>_anforderung_eingang_drossel.sql`:
      Tabelle, RLS an ohne Policy, Funktion `security definer` mit
      `search_path = ''`, Grants ausdrücklich. Begründung im Migrationskopf.
- [ ] 2.3 Testdatei in die Dateiliste in `ci.yml` eintragen, den Golden-Snapshot
      von `grants_test` nachziehen und lokal grün belegen.

## 3. Reine Logik mit Deno-Tests

- [ ] 3.1 `pruefung.ts` + `pruefung.test.ts`: Pflichtfelder, Grenzen, `art`,
      mehr als 10 Dateien, Rumpf kein Objekt. Jeder Fehler ist ein ganzer deutscher
      Satz. Test zuerst.
- [ ] 3.2 `beschreibung.ts` + `beschreibung.test.ts`: Reihenfolge, Abschnitt
      „Bilder" nur mit Dateien, Bild/Video, nicht übertragene Dateien mit Grund,
      „Route: unklar", Datum in Europe/Berlin über den Sommerzeitwechsel.
- [ ] 3.3 `linear.ts` + Tests: `fileUpload` → `PUT` mit allen gelieferten
      Headern plus `Content-Type` und `Cache-Control`, `issueCreate` mit
      Antwortprüfung. Die Form wurde gegen die Linear-Doku geprüft (design.md
      Context).
- [ ] 3.4 `eingang.ts` + `eingang.test.ts` mit aufzeichnendem `fetch`-Ersatz und
      Positivkontrollen: 401 ohne Aufrufe, 429 ohne Download, fest verdrahtete
      IDs trotz fremder Felder, abgelaufener Link → 201 mit Vermerk, zu große
      Datei wird nicht gelesen, String-Eintrag wird vermerkt, Linear-Fehler → 502,
      Probelauf ruft Linear nie auf, Gesamtfrist vermerkt Nachzügler.
- [ ] 3.5 Konstantzeit-Vergleich des Schlüssels mit Test (gleich, ungleich,
      verschiedene Länge, leeres Secret → 500).

## 4. Function verdrahten

- [ ] 4.1 `index.ts` als dünner Rumpf nach dem Muster `redeem-activation`,
      strukturiertes Log ohne Schlüssel und ohne Dateiinhalte.
- [ ] 4.2 Block `[functions.anforderung-eingang]` mit `verify_jwt = false` und
      Begründung in `supabase/config.toml`. Wächter in
      `scripts/functions-config.test.ts` ergänzen, rot/grün belegen.
- [ ] 4.3 `README.md` in der Function: Zweck, Secrets, Probelauf, Deploy.

## 5. Dokumentation und Vertrag

- [ ] 5.1 `docs/secrets.md`: `LINEAR_API_KEY`, `ANFORDERUNG_SCHLUESSEL` und
      `ANFORDERUNG_PROBELAUF` (nur DEV) in die Tabelle und den Befehl
      `infisical run --env=<env> -- supabase secrets set --project-ref <ref> …`,
      mit Hash-Prüfung.
- [ ] 5.2 `.env.example`: Platzhalter für die drei Namen.
- [ ] 5.3 `docs/custom-gpt-anforderungen.md` Teil 4: 502 ergänzen, Grenzen
      (Dateigröße, Typen) in die Beschreibung, und alles andere nachziehen, was von
      diesem Design abweicht.

## 6. Abschluss

- [ ] 6.1 `pnpm typecheck`, `pnpm test`, `deno test` für die Function, pgTAP,
      `openspec validate --all`, alle grün.
- [ ] 6.2 Code-Review, Befunde eingearbeitet.
- [ ] 6.3 `supabase/functions/bildtest/` lokal gelöscht (nie committet). Die
      Übergabe nennt `supabase functions delete bildtest --project-ref
      foelowldexkcqzewvrcf` als Schritt für Donald.
- [ ] 6.4 PR auf `main`, Branch `donald/age-830-anforderung-eingang`, und die
      Schritte von Hand (Secrets, Test-GPT, Übergabe an Detlev) im PR-Text.
