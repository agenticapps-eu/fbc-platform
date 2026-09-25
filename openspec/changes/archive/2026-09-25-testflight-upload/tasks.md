## 1. Plan-Review (Gate 2b)

- [x] 1.1 `openspec validate --all` grün, **bevor** irgendeine Codezeile
      entsteht. 36/36.
- [x] 1.2 Plan-Review über den Delta: zwei Reviewer **fremder** Anbieter
      (gemini/Google, codex/OpenAI, beide Exit 0), Ergebnis in `REVIEWS.md`.
      Begründung, warum hier trotz Donalds Regel vom 26.08. Fremdreviewer
      laufen: Der Change fasst einen **privaten Schlüssel** und eine
      Auslieferung nach außen an — Sicherheitsspalte, nicht UI-Spalte.
      **Beide: REQUEST-CHANGES.** Fünf Befunde übernommen, zwei begründet
      abgelehnt; die Planungsartefakte sind danach überarbeitet worden.

## 2. Der Wächter zuerst (RED)

- [x] 2.1 In `scripts/ios-release.workflow.test.ts` die Zusagen **schreiben,
      bevor** der Workflow sie erfüllt, und rot laufen sehen:
      - Der Upload-Schritt existiert und ruft `altool --upload-app`.
      - Ein Validierungsschritt ruft `altool --validate-app` und steht **vor**
        dem Upload.
      - **Beide** Hälften der Bedingung stehen da:
        `github.event_name == 'push'` **und** der Tag-Präfix. Eine Zusage je
        Hälfte, nicht eine über den ganzen Ausdruck — sonst fiele das Entfernen
        der Auslöser-Hälfte nicht auf, und genau das war der HIGH-Befund.
      - Reihenfolge: „Signatur und Profil nachweisen" → `upload-artifact` →
        Validierung → Upload. Über die Fundstellen im Text vergleichen, nicht
        über einen YAML-Parser (eine neue Node-Abhängigkeit macht den Deno-Job
        rot).
      - Der Upload-**Befehl** authentifiziert über `--p8-file-path
        "$RUNNER_TEMP/asc.p8"`. Die Zusage misst den Befehl, **nicht** den
        ganzen Dateitext: Der Dateikopf erklärt `./private_keys` als den
        verworfenen Weg, und eine Zusage über die ganze Datei wäre damit
        unerfüllbar (MEDIUM-Befund codex).
- [x] 2.2 Prüfen, dass die bestehende Zusage „prueft die Signatur am `.ipa`,
      nicht am Archiv" weiter trägt — sie schneidet auf den Bereich **vor**
      `upload-artifact`; durch das Vorziehen der Ablage bleibt dieser Schnitt
      unverändert klein.
- [x] 2.3 Gegenprobe, dass die neuen Zusagen nicht im Leeren greifen. Je eine
      Mutation am Workflow, die sie rot macht:
      - `github.event_name == 'push'` entfernt (der HIGH-Fall),
      - Tag-Präfix entfernt,
      - Upload vor den Nachweis geschoben,
      - `upload-artifact` hinter den Upload geschoben,
      - `--p8-file-path` durch ein Konventionsverzeichnis ersetzt,
      - `--validate-app` entfernt.

## 3. Die Schritte (GREEN)

- [x] 3.1 `upload-artifact` **vor** die neuen Schritte ziehen. Begründung im
      Kommentar: Scheitert die Übertragung, ist das der Fall, in dem man das
      geprüfte Bündel am dringendsten braucht — hinter dem Upload entfiele die
      Ablage nach der üblichen Überspringregel.
- [x] 3.2 Validierungsschritt: `xcrun altool --validate-app` mit denselben
      Zugangsdaten, unter derselben Bedingung wie der Upload.
- [x] 3.3 Upload-Schritt:
      `xcrun altool --upload-app -f "$RUNNER_TEMP/export/App.ipa" -t ios
      --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
      --p8-file-path "$RUNNER_TEMP/asc.p8"`, mit
      `if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/ios-v')`.
- [x] 3.4 Kommentar über dem Schritt, der die **äußere Voraussetzung** nennt:
      Die App muss in App Store Connect existieren (Bundle-ID), sonst schlägt
      der Schritt mit einer Meldung fehl, die nicht darauf zeigt (LOW-Befund
      gemini).
- [x] 3.5 Den **Dateikopf berichtigen.** Er sagt heute wörtlich „Er laedt NICHT
      zu TestFlight hoch" und „er ist hier nur bewusst nicht verdrahtet" — das
      wird mit diesem Change falsch. Der neue Text nennt: die Bedingung (Tag
      **und** Push-Auslöser, mit dem Grund), die Reihenfolge, den gemessenen
      Grund für `--p8-file-path` (`./private_keys` läge im Arbeitsbaum), und
      dass ein grüner Lauf „übertragen" heißt und nicht „von Apple angenommen".
- [x] 3.6 Alle Zusagen aus 2.1 grün.

## 4. Die drei Waisen aus #419

Donalds Entscheidung vom 25.09.: in denselben PR. Der gemini-Reviewer hat
dagegen argumentiert (Atomarität); die Begründung fürs Bündeln steht in
`REVIEWS.md`. Es sind Waisen des eigenen Changes, und kein Wächter findet sie,
weil keiner Fließtext liest.

- [x] 4.1 `docs/store-assets/README.md` — die ⚠-Warnung steht im Konjunktiv
      („solange die Entscheidung zu 3.1.1 nicht gefallen ist"). Sie ist
      gefallen, der Knopf ist seit `935b987` weg. **Die PNG zeigt ihn aber
      weiter.** Umschreiben zu: das Bild ist veraltet und muss vor der
      Einreichung neu entstehen.
- [x] 4.2 `docs/secrets.md` — die Stripe-Testrunde führt über „Wand →
      ‚Upgrade' → `/mitgliedschaft`". Beide Stationen gibt es nicht mehr; das
      Rezept ist unausführbar. Auf den heutigen Stand ziehen, mit Verweis auf
      AGE-908 für die Wiederinbetriebnahme.
- [x] 4.3 `docs/technisches-handbuch.md` — die Routentabelle führt
      `/mitgliedschaft` als reguläre Route. Als umgeleitet kennzeichnen.
- [x] 4.4 Gegenprobe, dass keine **weitere** Prosa einen der sieben entfernten
      Einstiege beschreibt: `docs/`, `src/content/`, `openspec/specs/`.

## 5. Sicherheit (Gate `cso`)

- [x] 5.1 Belegen, dass kein `.p8` und kein Schlüsselinhalt in den Baum, ins
      Log oder ins Artefakt gerät: `scripts/native-secrets-guard.ts` grün, der
      Artefaktpfad nennt weiter genau **eine** Datei, und die neuen Schritte
      geben keinen Secret-Wert aus.
- [x] 5.2 Prüfen, dass `altool` den Schlüssel nicht in eine Fehlermeldung
      schreibt, die im öffentlichen Lauf-Log landet. Die lokal erzeugte
      Fehlermeldung nannte nur den **Pfad**, nicht den Inhalt — das ist der
      Beleg, aber nur für diesen einen Fehlerfall.

## 6. Verifikation (Gate 5)

- [x] 6.1 `pnpm vitest run scripts/ios-release.workflow.test.ts` grün, Zahl der
      Zusagen vorher/nachher notiert.
- [x] 6.2 `pnpm typecheck` und `pnpm lint` grün. **Kein `pnpm format`** — nur
      `format:check`; der Baum ist mit ~396 Dateien vorbestehend unformatiert.
- [x] 6.3 `openspec validate --all` grün.
- [x] 6.4 Volle Suite grün, Zahl notiert.
- [x] 6.5 **Was dieser Change NICHT belegt, ausdrücklich festhalten:** dass ein
      Upload bei Apple ankommt, dass der ASC-Schlüssel Upload-Rechte trägt, und
      dass ein grüner Lauf Apples Annahme bedeutet (er bedeutet Übertragung).
      Das zeigt erst der erste getaggte Lauf, und die App muss dafür in App
      Store Connect existieren. Ein grüner Test belegt die **Form** des
      Workflows.

## 7. Code-Review (Gate 4)

- [x] 7.1 Unabhängiger Reviewer auf dem **Diff**, mit `the-pragmatic-programmer`
      und `refactoring` als Linse.

## 8. Abschluss

- [x] 8.1 Conventional Commit mit `AGE-907`, signiert. `95ae973`.
- [x] 8.2 PR gegen `main` — #423, als `53a5577` gemerged. In den Text: die gemessene `--p8-file-path`-Probe,
      warum Tag **und** Auslöser, warum das Artefakt vorgezogen ist, und dass
      der erste getaggte Lauf zugleich die erste Erprobung ist.
- [x] 8.3 Archivieren nach dem Merge, solange der Worktree steht, dann
      `pnpm release:entries`. Der codex-Reviewer wollte es vor den Merge; die
      Begründung fürs Beibehalten steht in `REVIEWS.md` (CLAUDE.md verlangt
      „vor oder zusammen mit `wt merge`", nicht vor dem PR-Merge, und AGE-904
      wie AGE-907 sind beide so gelaufen).

## 9. Belege dieses Laufs

| Was | Ergebnis |
|---|---|
| `scripts/ios-release.workflow.test.ts` | **20 Zusagen grün** (11 bestanden vorher, 9 neu) |
| Gegenprobe | **8 Mutationen, alle rot**; Positivkontrolle grün; Datei zeichengleich wiederhergestellt (`9de31360…`) |
| Volle Suite | **250 Dateien, 2871 Zusagen** grün (vorher 2862) |
| `pnpm typecheck` | grün |
| `pnpm lint` | **0 Fehler**, 8 vorbestehende `react-refresh`-Warnungen |
| `openspec validate --all` | **36/36** |
| `scripts/native-secrets-guard.ts` | 1678 Dateien, kein natives Geheimnis |
| Plan-Review (2b) | gemini + codex, beide REQUEST-CHANGES, 5 Befunde übernommen |
| Code-Review (4) | codex auf dem Diff, REQUEST-CHANGES, **beide Befunde übernommen** |

**Der teuerste Befund kam aus dem Code-Review, nicht aus dem Plan-Review:** Der
Wächter maß den *Text* der Bedingung, nicht die *aktive* `if:`-Zeile. Wer sie
auskommentiert hätte, wäre grün durchgekommen — bei unbedingtem Upload. Meine
eigene Gegenprobe konnte das nicht finden, weil sie nur entfernt und nie
auskommentiert hat. Beide Lücken sind geschlossen und als Mutation hinterlegt.

**Was hier NICHT belegt ist** (Aufgabe 6.5): dass ein Upload bei Apple ankommt,
dass der ASC-Schlüssel Upload-Rechte trägt, und dass ein grüner Lauf Apples
Annahme bedeutet — er bedeutet Übertragung. Das zeigt erst der erste getaggte
Lauf, und die App muss dafür in App Store Connect existieren.

**Waise nicht angefasst, mit Absicht:** `src/content/release-geschichten.ts:276`
(„und wo du zur Mitgliedschaft kommst") beschreibt einen der sieben entfernten
Einstiege in Prosa. Die AGE-905-Sitzung hat die Zeile bereits geändert; ein
zweiter Zugriff hätte kollidiert. Die Gegenprobe (4.4) hat sonst nur datierte
Planungsdokumente unter `docs/superpowers/` gefunden — die sind an ihrem Datum
richtig und bleiben.
