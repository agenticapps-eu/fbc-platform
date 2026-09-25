---
reviewers: [gemini, codex]
models: [gemini-cli-default-nicht-ausgewiesen, gpt-6-sol]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: d2ae3014d1f7dc369bbfbb83e2a1c011607141045c5db632b69f37b4e6bb20f6
---

# Change review — testflight-upload

Gefahren am 2026-09-25 über `~/.agenticapps/bin/reviewer-cli.sh`, beide Arme
mit Exit 0. Der Prompt trug den **vollständigen heutigen Workflow und den
Wächter** als Kontext, nicht nur die Planungsartefakte — sonst hätten beide
Reviewer über die Reihenfolge der Schritte nur raten können.

**Warum hier überhaupt Fremdreviewer laufen**, obwohl Donalds Regel vom 26.08.
sie auf Schema, Rechte und Sicherheit beschränkt: Der Change fasst einen
privaten Schlüssel an und richtet eine Auslieferung nach außen ein. Das ist die
Sicherheitsspalte, nicht die UI-Spalte.

**Kein signierter Trailer.** `run-plan-review.sh` liegt auf dieser Maschine
nicht (`find` über Repo und `~/.claude` ohne Treffer); die Läufe sind von Hand
über den Wrapper gefahren. Der §18-Gate wird das als `trailer-absent`
anmerken und nicht blocken — so ist es dokumentiert, und so ist es hier
gemeint.

## Reviewer: gemini

VERDICT: REQUEST-CHANGES · liest „The Pragmatic Programmer" nach eigener Angabe.

- **[HIGH]** `.github/workflows/ios-release.yml` / design — Das größte selbst
  benannte Risiko, der blinde Upload, ist nicht gemindert. Der Lauf geht von
  den internen Prüfungen direkt auf den unumkehrbaren `--upload-app`, ohne
  `--validate-app`, das genau dafür da ist: gegen Apples Regeln prüfen, ohne
  eine Build-Nummer zu verbrauchen. → Validierungsschritt unmittelbar vor den
  Upload.
- **[MEDIUM]** tasks §4 — Der Change bündelt Dokumentationsaufräumen mit einer
  sicherheitsrelevanten Änderung an der Auslieferungsstrecke. Für einen Change,
  der einen privaten Schlüssel anfasst, ist Reinheit eine Tugend. → In einen
  eigenen PR.
- **[LOW]** Workflow — Unausgesprochene äußere Abhängigkeit: Die App muss in
  App Store Connect existieren, sonst schlägt der Schritt verwirrend fehl. →
  Kommentar über den Schritt.

Angenommen, aber nicht gesagt: dass die Bundle-ID im Xcode-Projekt der in App
Store Connect angelegten entspricht; dass der ASC-Schlüssel Upload-Rechte hat;
dass `altool` bei Fehlschlag verlässlich ungleich 0 zurückgibt.

## Reviewer: codex (gpt-6-sol, provider openai)

VERDICT: REQUEST-CHANGES · liest „The Pragmatic Programmer" nach eigener Angabe.

- **[HIGH]** design, Entscheidung 2 — Die Bedingung prüft nur `github.ref`.
  GitHub erlaubt `workflow_dispatch` **auf ein Tag**; ein Handstart auf
  `ios-v*` würde also hochladen und damit genau die Zusage brechen, die der
  Change gibt. → Zusätzlich `github.event_name == 'push'`.
- **[HIGH]** design, Entscheidung 3 und Risiken — Der Artefaktschritt steht
  **hinter** dem Upload. Schlägt `altool` fehl, überspringt GitHub ihn nach der
  Standardregel; die Behauptung im Entwurf, Artefakt und Nachweis „liegen dann
  bereits vor", ist für das Artefakt **falsch**. → Artefakt vor den Upload, oder
  bedingt trotz Fehlschlag.
- **[MEDIUM]** tasks §2.1 ggü. §3.2 — Die geplante Zusage verlangt, dass
  `private_keys` im ganzen Workflow **nicht** vorkommt, während §3.2 verlangt,
  dass der Dateikopf `./private_keys` erklärt. Beides zusammen ist unerfüllbar.
  → Die Zusage auf den Befehl im Upload-Schritt einengen, Kommentare ausnehmen.
- **[MEDIUM]** Spec-Delta — „Ein gebautes Bündel SHALL das Repository nur über
  ein Tag verlassen" widerspricht dem CI-Artefakt, das ein Handstart weiterhin
  ablegt. → Den tatsächlichen Vertrag sagen: die **Übertragung an den Store**
  braucht Tag und bestandenen Nachweis; ein Handstart darf ein Artefakt ablegen.
- **[MEDIUM]** tasks §8.3 — Archivieren *nach* dem Merge widerspricht der
  Lebenszyklus-Anweisung. → Vor oder mit dem Merge.

Angenommen, aber nicht gesagt: dass `ios-v*`-Tags nur auf beabsichtigte
Release-Commits gesetzt werden; dass der ASC-Schlüssel Upload-Rechte für die
spätere App hat; dass eine erfolgreiche Übertragung **noch nicht** Apples
Annahme ist — die Verarbeitung kann danach fehlschlagen.

## Nicht gezählt

Keiner. Beide Arme mit Exit 0, zwei verschiedene Anbieter (Google, OpenAI).
`claude` wurde nach Regel 2 der Skill nicht gefahren — ein Host prüft seinen
eigenen Change nicht. `opencode` war nicht nötig, weil zwei fremde Anbieter
bereits zählen.

Ehrlich vermerkt: Gemini weist sein Modell im Lauf nicht aus. Damit ist die
Anbieter-Verschiedenheit belegt (Google ggü. OpenAI), die Modell-Verschiedenheit
nur für codex namentlich.

## Resolution

### Übernommen — vier Befunde, die den Entwurf tatsächlich falsch machten

**codex [HIGH] `workflow_dispatch` auf ein Tag — übernommen, das war ein echter
Fehler.** Ich hatte „Handstart lädt nie hoch" zugesagt und die Bedingung allein
auf `github.ref` gelegt. GitHubs „Use workflow from"-Auswahl führt auch Tags;
die Zusage wäre also durch eine ganz normale Bedienung zu brechen gewesen — und
zwar unbemerkt, weil der Lauf grün bliebe. Bedingung wird
`github.event_name == 'push' && startsWith(github.ref, 'refs/tags/ios-v')`.
Eine Zusage im Wächter misst ausdrücklich, dass **beide** Hälften dastehen.

**codex [HIGH] Artefakt hinter dem Upload — übernommen.** Der Befund entlarvt
einen Satz in meinen eigenen Risiken als falsch: „ein Fehlschlag trifft nur den
Upload — Artefakt und Nachweis sind dann bereits gelaufen und liegen vor". Der
Nachweis ja, das Artefakt nicht: GitHub überspringt Folgeschritte nach einem
Fehlschlag. Ausgerechnet im Fehlerfall hätte man das `.ipa` nicht in der Hand.
Gelöst durch **Umstellen statt Bedingung**: Reihenfolge wird Nachweis →
Artefakt → Upload. Das braucht kein `if: always()`, behält die heutige
Bedeutung (Artefakt nur nach bestandenem Nachweis) und ist der kleinere Diff.

**codex [MEDIUM] Widerspruch zwischen Zusage 2.1 und Aufgabe 3.2 — übernommen.**
Meine eigenen Aufgaben schlossen einander aus. Die Zusage misst jetzt den
**Befehl im Upload-Schritt**, nicht den ganzen Dateitext; der Dateikopf darf
`./private_keys` weiter erklären, denn diese Erklärung ist der Grund für die
Bauweise.

**codex [MEDIUM] Spec-Delta zu weit formuliert — übernommen.** „Verlässt das
Repository" war schlicht das falsche Wort: Das CI-Artefakt verlässt es auch bei
einem Handstart. Der Delta sagt jetzt **Übertragung an den Store**, und ein
Szenario hält ausdrücklich fest, dass der Handstart ein Artefakt ablegen darf.

**gemini [HIGH] `--validate-app` vor dem Upload — übernommen.** Es mindert
genau das Risiko, das ich selbst als größtes benannt habe, und es ist der Weg,
den dieses Repo am 07.09. schon gegangen ist („Validiert, nicht hochgeladen.
Dadurch ist Build-Nummer 1 noch frei"). Der Preis sind ein paar
macOS-Runner-Minuten, und die fallen nur auf Tag-Läufen an.

**gemini [LOW] Hinweis auf die App-Store-Connect-Voraussetzung — übernommen.**
Der Dateikopf dieses Workflows erklärt ohnehin jede Falle; eine mehr, die einen
verwirrenden Fehlschlag in einen erklärten verwandelt, passt zum Stil.

### Nicht übernommen — mit Begründung

**gemini [MEDIUM] Doku-Aufräumen in einen eigenen PR.** Der Einwand ist
methodisch richtig, und ich habe ihn vor dem Review selbst gestellt. **Donald
hat am 25.09. ausdrücklich das Bündeln entschieden**, nachdem ihm beide
Varianten vorlagen. Das ist eine Nutzerentscheidung, keine Nachlässigkeit. Das
Gewicht des Einwands wird dadurch gemindert, dass die drei Stellen reiner Text
sind: sie können den Workflow nicht beeinflussen, und ein Rückbau des
Upload-Schritts bliebe auch im gebündelten Commit ein sauberer Teil-Revert.

**codex [MEDIUM] Archivieren vor dem Merge.** Nicht übernommen, bewusst.
CLAUDE.md verlangt „vor **oder zusammen mit** `wt merge` — nie, nachdem der
Worktree weg ist". Ein eigener Archiv-PR nach dem Merge, aber bei noch
stehendem Worktree, erfüllt das. Es ist zudem die gelebte Praxis dieses Repos:
AGE-904 (#418 → #420) und AGE-907 (#419 → #421) sind beide so gelaufen. Die
Praxis einseitig zu ändern gehört nicht in diesen Change.

### Was kein Reviewer gefunden hat

Beide haben die **Reihenfolge** angegriffen, keiner den Befund, auf dem der
Entwurf steht: dass `--p8-file-path` von `--upload-app` honoriert wird. Der ist
lokal gemessen (altool 27.0.5, erfundene Werte, ohne Netz) und im Entwurf mit
der Fehlermeldung belegt. Ich lasse ihn stehen — nicht weil niemand widersprach,
sondern weil er eine Messung ist und kein Argument.

---

# Code-Review (Gate 4) — auf dem Diff

Getrennt vom Plan-Review oben: Dieser Lauf hat den **Diff** gelesen, nicht die
Planung. Reviewer `codex` (gpt-6-sol, OpenAI), Exit 0, Linse
`the-pragmatic-programmer` + `refactoring` (nach eigener Angabe angewandt).

VERDICT: REQUEST-CHANGES

- **[HIGH]** `scripts/ios-release.workflow.test.ts` — Der Wächter prüft, ob der
  Text der Bedingung im Schrittblock **vorkommt**, nicht ob sie eine **aktive**
  `if:`-Zeile ist. Wer beide `if:`-Zeilen **auskommentiert**, lässt den Text
  stehen: Test grün, Upload unbedingt — und ein Handstart auf ein Tag liefert
  aus. → Die aktive `if:`-Zeile messen.
- **[LOW]** Dieselbe Schwäche beim Schlüsselpfad: ein auskommentiertes
  `--p8-file-path` erfüllte die Zusage. → Den aktiven Befehl messen.

Nicht beanstandet: Shell-Quoting, Verhalten unter `set -euo pipefail`, und die
Bedingung `push` + Tag selbst.

## Resolution

**Beide übernommen — der HIGH-Befund war ein echter Loch im Wächter**, und zwar
eines, das meine eigene Gegenprobe nicht finden konnte: Sie hat nur
**entfernt**, nie **auskommentiert**. Eine Mutation, die den Text stehen lässt,
war schlicht nicht in der Menge.

Zwei Helfer eingezogen: `ifBedingung()` liest die aktive `if:`-Zeile (eine
auskommentierte beginnt nach `trim()` mit `#` und zählt nicht),
`ohneKommentare()` schneidet Kommentarzeilen aus dem Block. Die Zusagen messen
jetzt beides am aktiven Text. Der Schritt **darf** `private_keys` im Kommentar
erklären — er darf es nur nicht benutzen.

Die Gegenprobe ist um genau diese zwei Mutationen erweitert worden. Stand
danach, alle acht rot, Positivkontrolle grün, Datei zeichengleich
wiederhergestellt:

| Mutation | Wächter |
|---|---|
| Auslöser-Hälfte entfernt | rot |
| Tag-Hälfte entfernt | rot |
| Konventionsverzeichnis statt Pfad | rot |
| Validierungsschritt entfernt | rot |
| Upload vor den Nachweis geschoben | rot |
| Artefakt hinter den Upload geschoben | rot |
| **Bedingung auskommentiert statt entfernt** | **rot** |
| **Schlüsselpfad auskommentiert** | **rot** |

Die zwei unausgesprochenen Annahmen, die der Reviewer benennt, stehen als
offene Fragen in `design.md`: Upload-Rechte des ASC-Schlüssels, und dass
`altool` keinen Schlüsselinhalt ins öffentliche Lauf-Log schreibt. Für den
einen gemessenen Fehlerfall ist das belegt (die Meldung nannte nur den Pfad);
für jeden anderen nicht.
