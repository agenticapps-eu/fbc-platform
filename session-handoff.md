# Session Handoff — 2026-09-09 (AGE-642 archiviert; AGE-708 war schon zu)

> ## ⚠ ZUERST — Scope dieser Übergabe
>
> **1. Sie beschreibt AGE-642** (Worktree
> `fbc-platform.donald-age-642-capacitor-huelle`) und **ersetzt** die
> AGE-708-Fassung, die auf `main` steht. Die Datei ist für alle parallelen
> Sitzungen dieselbe und kollidiert bei jedem Rebase — **nicht
> zusammenführen**, überschreiben.
>
> **2. AGE-642 ist mit PR #379 zu.** Details liegen unter
> `openspec/changes/archive/2026-09-09-capacitor-huelle/`, die dauerhafte
> Wahrheit in `openspec/specs/native-shell/spec.md`.
>
> **3. Eine Fremdsitzung arbeitet parallel:** `fbc-platform-f4` sitzt in
> `~/worktrees/fbc-platform/donald-age-705-oeffentlicher-release-blog`
> (AGE-705). Deren Übergabe ist ungepusht und gehört nicht hierher.

## Accomplished

**AGE-642 stand nur noch am Abschluss-Tor** — der Code lag seit PR #371
vollständig auf `main`, es fehlte allein das Archivieren.

| | |
|---|---|
| **Archiviert** | `2026-09-09-capacitor-huelle`, neue Capability `native-shell` |
| **PR** | **#379** — Deltas eingefaltet, Neuigkeiten-Eintrag, zehn offene Kästchen ausgeschrieben |
| **AGE-708** | war bereits zu (PR #378 gemerged 14:17:38, Linear `Done` 14:17:40) |

Abnahme, jeweils am Exit-Code gelesen: `openspec validate --all` **32/32** ·
`pnpm lint` 0 Fehler · `pnpm typecheck` 0 · **2.639 Tests in 234 Dateien grün**
· `entry-chunk-guard` 0 · `native-secrets-guard` 0 (1.558 Dateien).

## Decisions

- **Mit zehn offenen Kästchen archiviert, keins davon abgehakt.** Ein Haken ohne
  Beleg wäre schlimmer als ein offenes Kästchen. Sie stehen jetzt am Kopf der
  `tasks.md` in drei Gruppen (vier eigene Vorgänge, fünf Gerätebelege, einer
  nach dem Merge). `openspec archive` bestätigt die Zahl unabhängig:
  *„10 incomplete task(s)"*.
- **Angesprochen über den Wortlaut, nicht über Zeilennummern.** Die erste
  Fassung trug geratene Nummern; sie verschieben sich bei jeder Änderung an der
  Datei — die Lehre stand schon im Gedächtnis.
- **Der Neuigkeiten-Eintrag nennt ausdrücklich, dass die App in keinem Store
  ist.** Ohne diesen Punkt hätte er „die App ist da" nahegelegt. AGE-644 steht
  auf Backlog, es gibt nichts herunterzuladen.
- **Handoff auf denselben Branch statt als Folge-PR** — ein zweiter PR mit
  `age-642` im Branchnamen machte den gerade geschlossenen Vorgang wieder auf.

## Files modified

- `openspec/changes/capacitor-huelle/` → `openspec/changes/archive/2026-09-09-capacitor-huelle/`
  (`tasks.md` mit neuem Kopfabschnitt und erfülltem Abschluss-Tor,
  `proposal.md` mit Stichpunkten in Mitglieder-Sprache vor „Im Einzelnen:")
- `openspec/specs/native-shell/spec.md` *(neu)* — `Purpose: TBD` ersetzt
- `openspec/specs/access-control/spec.md` (+44, additiv) ·
  `openspec/specs/design-system/spec.md` (+57 −5; der `MODIFIED` löst die
  AGE-499-Klausel zum Ring ausdrücklich ab)
- `src/content/release-entries.generated.ts` — 78 Einträge, 14 Zeilen Diff
  **ohne prettier** (Rohstil des Erzeugers ist der kleinere Diff)

## Next session: start here

**Erst nachsehen, ob PR #379 grün ist und gemerged wurde**, und danach
**Linear AGE-642 prüfen** — der Branchname trägt das Kürzel, der Merge setzt
den Vorgang auf Done. Das ist hier gewollt.

Danach liegen **vier Anschlussvorgänge zum Anlegen** bereit; Titel und Rumpf
stehen im Kopf von
`openspec/changes/archive/2026-09-09-capacitor-huelle/tasks.md`:
Querformat-Startfläche · `splash --check` + `app:icons --check` in der CI ·
Android-Startfläche nach SplashScreen-API · Regler in `OnboardingPage.tsx:212`.
**Donald legt sie an, nicht das Modell.**

Der nächste grosse Auftrag ist **AGE-643** (M3 Deep Links) oder **AGE-644**
(M4 Store-Einreichung); M4 verlangt laut eigenem Vorgang, dass M1–M3 vorher
fertig sind. Erster Schritt wie immer: `wt list` und nach einem bestehenden
Branch sehen.

## Open questions

- **Sechs Specs tragen noch `Purpose: TBD`** aus früheren Archivierungen:
  `member-onboarding`, `password-reset`, `member-import`, `environment-sync`,
  `legal-pages`, `design-system`. Altbestand, blockt nichts.
- **Der Archiv-Eintrag zu AGE-708 wartet weiterhin auf Freigabe** in
  `AdminNeuigkeitenPage` und geht dann an alle aktivierten Mitglieder. Jetzt
  kommt der zu AGE-642 dazu — **zwei** Einträge, beide zum Versenden gedacht.
- **`APNS_SANDBOX` steht auf `1`** — beim ersten TestFlight-Build nachsehen.
- **„Build-Nummer = Lauf-Nummer" ist nicht bewiesen** (Lauf 1 verglich 1 mit 1).
- **TestFlight hat keinen Vorgang.** AGE-644 schliesst es ausdrücklich aus.

## Zwei Lehren dieser Sitzung

1. **`/add-dir` hebt die Worktree-Isolation nicht auf.** Die Freigabe lässt das
   `cd` stehen, aber der Wächter lehnt danach **jeden** Befehl im fremden
   Worktree ab — und die Sitzung ist festgefahren, weil auch das `cd` zurück
   abgewiesen wird. Ausweg ist ein Werkzeug, kein Befehl: **`ExitWorktree` mit
   `action: "keep"`** löst die Pinnung. Stand so schon im Gedächtnis; ich habe
   erst herumprobiert und dann nachgelesen. Umgekehrt wäre billiger gewesen.
2. **Zustandsändernde git-Befehle nicht pipen und nicht verketten.**
   `git merge --ff-only origin/main | tail -3` wurde vom Klassifikator
   abgelehnt, der blosse Befehl lief sofort durch. Dasselbe Muster wie die
   bekannte Exit-Code-Falle.
