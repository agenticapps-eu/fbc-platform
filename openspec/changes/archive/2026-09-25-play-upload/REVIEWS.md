---
reviewers: [codex, gemini]
models: [gpt-6-sol, gemini-cli-default-nicht-ausgewiesen]
verdicts: [REQUEST-CHANGES, APPROVE]
reviewed_artifacts_sha: f7a3e8adb17dcc5cbc65a4c4a829172e3c4f121939bf0b1e7dd191f98a7d078b
---

# Change review — play-upload

Gefahren am 2026-09-25 über `~/.agenticapps/bin/reviewer-cli.sh`, beide Arme
Exit 0, zwei verschiedene Anbieter (OpenAI, Google). `claude` nach Regel 2 der
Skill nicht gefahren. Der Prompt trug den heutigen Android-Workflow, seinen
Wächter **und** die fertige iOS-Seite als Vergleich.

**Kein signierter Trailer** — `run-plan-review.sh` liegt auf dieser Maschine
nicht; der §18-Gate merkt das als `trailer-absent` an und blockt nicht.

## Reviewer: codex (gpt-6-sol, OpenAI) — REQUEST-CHANGES

- **[HIGH]** Kanal — `internal` ist **nicht** geschlossenes Testen und zahlt
  nicht auf die 12/14-Pflicht ein. Eine noch offene Entscheidung in einen
  Wächter zu pinnen, härtet die Vermutung.
- **[HIGH]** Ein SHA-Pin belegt **Unveränderlichkeit, nicht
  Vertrauenswürdigkeit**. Und eine Prüfung „kein `echo`" kann nicht belegen, was
  die fremde Action selbst mit dem Schlüssel tut. Service-Konto auf diese App
  und die nötige Rolle beschränken; benennen, **wer** die Vertrauensgrenze
  ausspricht. Alternative: Workload Identity Federation statt Dauerschlüssel.
- **[MEDIUM]** Der Wächter kann **leer greifen**, wenn jemand einen zweiten,
  ungeschützten Upload-Schritt danebenstellt — jede Zusage wäre erfüllt, die
  Zusage gebrochen. „Genau einer" messen, nicht „mindestens einer", und als
  Mutation hinterlegen.
- **[MEDIUM]** `$GITHUB_ENV` für Roh-JSON ist unterspezifiziert: Zeilenumbrüche
  brauchen die Begrenzer-Form, und ein Infisical-Wert ist **nicht**
  GitHub-maskiert.
- **[MEDIUM]** `releaseFile` und `track` seien am gepinnten Stand veraltet.
- **[LOW]** Das Szenario „Ein Bündel ohne bestandenen Nachweis" nennt nur
  iOS-Prüfungen, obwohl die Zusage jetzt beide Plattformen deckt.

## Reviewer: gemini — APPROVE

- **[LOW]** Fremde Action mit SHA-Pin sei der richtige pragmatische Handel
  gegenüber ungetestetem eigenem API-Code.
- **[LOW]** Den Kanal im Wächter zu pinnen sei der richtige Umgang mit der
  Unsicherheit — es macht die spätere Änderung ausdrücklich.
- **[LOW]** Die Textprüfung „aktiv statt auskommentiert" ohne YAML-Parser ist
  **spröde**. Tragbar, aber die Umsetzung muss so strukturnah wie möglich sein
  (Einrückung relativ zum Elternschlüssel mitlesen).

Als unausgesprochene Annahmen benannt: Form des Secrets in Infisical; dass die
Action Authentifizierungs- von Rechtefehlern unterscheidbar meldet; dass das
Service-Konto die Release-Rolle bekommt.

**Die beiden widersprechen sich im Kanal.** codex: „nicht in den Wächter
pinnen, weil offen." gemini: „pinnen, weil es die Änderung ausdrücklich macht."
Beide haben recht unter ihrer jeweiligen Voraussetzung — und die Voraussetzung
war offen, nicht die Bewertung.

## Nicht gezählt

Keiner. Beide Exit 0.

## Resolution

### Übernommen

**codex [HIGH] Kanal — übernommen, aber anders als vorgeschlagen.** Der Befund
trifft den wunden Punkt: Ich hatte `internal` selbst als Vermutung bezeichnet
und wollte sie trotzdem festnageln. Statt sie zu pinnen **oder** offen zu
lassen, habe ich sie **entschieden bekommen**: Donald, 25.09., „`internal`
zuerst". Damit ist der Streit zwischen den beiden Reviewern gegenstandslos —
gepinnt wird eine Festlegung, keine Annahme. Der Preis steht ausdrücklich im
Entwurf: `internal` zahlt **nicht** auf die 12/14-Pflicht ein.

**codex [HIGH] Vertrauensgrenze — übernommen.** Der Satz „der SHA-Pin ist die
Gegenmaßnahme" war zu bequem und ist umgeschrieben: Ein Pin deckt die
Unveränderlichkeit, nicht die Vertrauenswürdigkeit. Was trägt, ist der begrenzte
Schadensumfang und die Rotierbarkeit. **Wer es ausspricht, steht jetzt
namentlich da** — Donald, 25.09., nach Vorlage der Alternative. Workload
Identity Federation wurde ihm vorgelegt und **wegen des Einrichtungsaufwands
verworfen**, bewusst.

**codex [MEDIUM] „genau einer" — übernommen.** Dieselbe Klasse wie der
Auskommentier-Befund beim iOS-Change: eine Zusage, die ein Angreifer oder ein
eiliger Mensch durch **Hinzufügen** statt Ändern umgeht. Der Wächter misst
jetzt die Anzahl, und die Mutationsprobe legt einen zweiten ungeschützten
Upload-Schritt daneben.

**codex [MEDIUM] `$GITHUB_ENV` — übernommen, und es war ein echter Fehler.**
Roh-JSON mit Zeilenumbrüchen hätte die Zuweisung zerlegt. Gelöst durch das
Muster, das nebenan schon läuft: Datei unter `$RUNNER_TEMP`, und die Action
nimmt `serviceAccountJson` (Pfad) statt Klartext. Das erledigt Zeilenumbrüche
und Maskierung in einem.

**codex [LOW] Szenario nur iOS — übernommen**, der Fehlschlagsfall nennt jetzt
auch Fingerabdruck und AAB-Signatur.

**gemini [LOW] spröde Textprüfung — übernommen** als Auflage an die Umsetzung:
Der Wächter schneidet auf Schrittblöcke über die Einrückung und liest die
**aktive** `if:`-Zeile, nicht den Blocktext.

### Zur Hälfte widerlegt

**codex [MEDIUM] `releaseFile` UND `track` veraltet.** Am README der gepinnten
Fassung `e738b9dd…` nachgesehen, statt es zu glauben:

- `releaseFile` steht **durchgestrichen** mit „Please switch to using
  `releaseFiles`" → übernommen, Plural.
- `track` steht **unverändert in den eigenen Beispielen** der Action
  (`track: production`, `track: internal`). `tracks` ist die Mehrfach-Variante,
  keine Ablösung → Einzahl bleibt.

Ein Reviewer, der auf eine Quelle zeigt, ist nachprüfbar — und hier hat die
Nachprüfung die Hälfte bestätigt und die Hälfte nicht.

### Was beide Reviewer nicht angegriffen haben

Dass dieser Change **gar nicht erprobbar** ist. Beide haben es zur Kenntnis
genommen (gemini nennt es „honest about its considerable constraints"), keiner
hat daraus einen Einwand gemacht. Ich lasse es so stehen — es ist Donalds
bewusste Entscheidung vom 25.09. —, halte aber fest: **Das ist die größte
Schwäche dieses Changes, und kein Review hat sie geheilt.**

---

# Code-Review (Gate 4) — auf dem Diff

Reviewer `codex` (gpt-6-sol, OpenAI), Exit 0, Linse `the-pragmatic-programmer` +
`refactoring`. Dem Reviewer wurde ausdrücklich gesagt, was der Plan-Review schon
erzwungen hatte, mit der Bitte, nach dem zu suchen, was **fehlt**.

VERDICT: REQUEST-CHANGES

- **[HIGH]** Der Play-Schlüssel in Infisical `prod` ist über den bestehenden
  `INFISICAL_TOKEN` erreichbar, und der ist ein Repository-Secret, das auch
  `pull_request`-Läufe sehen. Die geschützten Schritte decken das nicht ab.
  → Eigene, eng gefasste Infisical-Identität nur für den Release-Job.
- **[MEDIUM]** Der Wächter greift weiterhin leer: **`|| true` an die Bedingung
  gehängt** lässt beide Teilzeichenketten stehen und hebelt sie trotzdem aus.
  → Den vollständigen Ausdruck prüfen, nicht Teile davon.

Ausdrücklich **nicht** beanstandet, nachdem der Reviewer den gepinnten
Action-Quelltext gelesen hat: kein Log-, Artefakt- oder Arbeitsbaum-Leck in den
neuen Schritten; `set -euo pipefail` und die verschachtelte `sh -c` sind
korrekt; die Action exportiert **den Pfad**, nicht den Inhalt.

## Resolution

**[MEDIUM] `|| true` — übernommen, und es war ein echtes Loch.** Meine
Halbzusagen (`toContain` je Hälfte) hätten die Mutation überlebt. Die
Gegenprobe auch: Sie hatte nur *entfernt* und *auskommentiert*, nie
**erweitert**. Das ist die dritte Umgehungsform an derselben Zusage an einem
Tag, und sie ist die unangenehmste, weil sie nichts wegnimmt.

Gelöst durch eine Zusage auf **Gleichheit** mit dem vollständigen Ausdruck. Die
beiden Halbzusagen bleiben daneben stehen — die Gleichheit ist der Riegel, die
Hälften sagen im Fehlerfall, *welche* fehlt.

**Dieselbe Lücke steckte im iOS-Wächter**, den ich heute früh geschrieben habe.
Sie ist dort mitgeschlossen worden, obwohl der Change gemerged und archiviert
ist: gleicher Fehler, gleicher Tag, gleicher Autor, vier Zeilen. Ihn wissentlich
offen zu lassen wäre schlechter gewesen als der etwas breitere Diff.

Beide Gegenproben tragen die Mutation jetzt: **Android 12/12 rot, iOS 9/9 rot**,
Positivkontrolle grün, beide Dateien zeichengleich wiederhergestellt.

**[HIGH] `INFISICAL_TOKEN` — NICHT in diesem Change gelöst, mit Begründung.**

Der Befund stimmt, und er ist **nicht neu**: Der Kopf von `android-release.yml`
benennt ihn seit AGE-642 B3 wörtlich — „Der Token ist also aus jedem
Same-Repo-PR schon heute erreichbar. Das Environment schuetzt diesen Workflow,
nicht den Token. Dafuer braeuchte es einen eigenen, projektbeschraenkten
Infisical-Token; eigener Vorgang."

Was dieser Change daran ändert: Er legt **ein Geheimnis mehr** in diesen
Radius — neben Keystore, Keystore-Passwörter, FCM-Konfiguration und
ASC-Schlüssel, die alle schon dort liegen. Das ist ein Zuwachs, kein neuer
Zustand, und der Play-Schlüssel ist von allen der am leichtesten rotierbare.

Ihn hier zu lösen hieße, die Infisical-Identitätsarchitektur in einem Change
umzubauen, der einen Workflow-Schritt hinzufügt. Das ist der falsche Ort. **Als
Folgepunkt an Donald gemeldet**, damit er nicht in einer `REVIEWS.md` verstaubt.
