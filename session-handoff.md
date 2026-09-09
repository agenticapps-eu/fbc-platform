# Session Handoff — 2026-09-09 (AGE-642 archiviert, vier Anschlussvorgänge gebaut)

> ## ⚠ ZUERST — Scope dieser Übergabe
>
> **1. Sie beschreibt AGE-642 und dessen vier Anschlussvorgänge** (Worktree
> `fbc-platform.donald-age-642-capacitor-huelle`) und **ersetzt** die Fassung
> vom selben Tag. Die Datei ist für alle parallelen Sitzungen dieselbe und
> kollidiert bei jedem Rebase — **nicht zusammenführen**, überschreiben.
>
> **2. `fbc-platform-f4` arbeitet parallel an AGE-705** (Release-Blog),
> vollständig ungepusht — nichts davon liegt auf `main`. Abgestimmt am 09.09.

## Accomplished

**AGE-642 archiviert, danach alle vier Anschlussvorgänge angelegt und gebaut.**

| | Vorgang | PR | Stand |
|---|---|---|---|
| — | AGE-642 Capacitor-Hülle | #379 | **gemerged** `555894e`, Linear `Done` |
| A | AGE-711 Regler im Onboarding | #380 | **gemerged** `97b3119` |
| D | AGE-712 Querformat-Startfläche | #381 | **gemerged** `7a2624c` |
| C | AGE-713 Android-Startfläche | #382 | **gemerged** `279ff59` |
| B | AGE-714 Assets-Stempel | #383 | **gemerged** `9e5a81b` |

Tests von 2.639 auf **2.672** gewachsen. `pnpm lint` 0 Fehler, `pnpm typecheck`
0 durchgehend.

## Decisions

- **AGE-642 mit zehn offenen Kästchen archiviert, keins abgehakt.** Sie stehen
  am Kopf der archivierten `tasks.md` in drei Gruppen. `openspec archive`
  bestätigt die Zahl unabhängig: *„10 incomplete task(s)"*.
- **Querformat (D): eigenes, flacheres Fenster** statt Mittelstreifen des
  Hochkantbandes, ausgeliefert über eine **Grössenklasse** (`height-class:
  compact`) im selben Image Set. Das Storyboard bleibt unangetastet.
- **Android (C): weisser Grund, Stern zentriert** (Donald, 09.09.). Weiss ist
  dieselbe Farbe wie `GRUND`, auf der die Boot-Fläche sitzt — kein sichtbarer
  Übergang.
- **Stempel statt Neuerzeugung (B), Abweichung vom Vorgangstext.** „Neu erzeugen
  und diffen" scheitert an `sips` (nur macOS) und grundsätzlicher daran, dass
  das Ergebnis an den Werkzeugversionen hängt. Ein Wächter, der bei neuer
  librsvg rot wird, wird abgeschaltet.

## Drei Befunde, die meine eigenen Vorgangstexte widerlegt haben

Alle drei sind in Linear korrigiert. Sie stünden sonst dauerhaft falsch dort.

1. **AGE-711:** „auch am Schreibtisch unsichtbar" war zu weit gefasst — in
   Chrome zeichnet die alte Fassung sehr wohl einen Knopf. Der Fehler ist enger
   (iOS-WebKit, Firefox, 8-px-Trefffläche überall) und trotzdem real.
2. **AGE-712:** der Bandmittelwert ist der **falsche Massstab**. Der richtige
   Ausschnitt misst 185/172/157 und ist damit *heller* als der kaputte
   (148/139/134) — der kaputte zeigt dunkle Anzüge, der richtige Gesichter vor
   hellem Fenster. „Beide Gesichter im Bild" ist kein Skalar.
3. **AGE-713 (Nebenbefund, mitgenommen):** `capacitor.settings.gradle` zeigte
   auf pnpm-Pfade mit `@capacitor+core@8.5.0`; im Lockfile steht 8.5.1. **Der
   Android-Bau war auf `main` für jeden kaputt** (`No variants exist`). Ohne den
   Fix kann niemand C nachprüfen.

## Files modified

- **Archiv:** `openspec/changes/archive/2026-09-09-capacitor-huelle/`,
  `openspec/specs/native-shell/spec.md` *(neu, `Purpose` von Hand gesetzt)*
- **Regler:** `.fbc-regler-chrome` in `src/index.css`, angewandt in
  `OnboardingPage.tsx`, gehalten von `src/zoom-regler.test.ts`
- **Startfläche:** `scripts/splash.logic.ts` trägt jetzt `AUSSCHNITT_QUER`,
  `BAND_QUER`, `ANDROID_SYMBOL`, `MARKE_AUF_WEISS`, `androidSymbolXml`
- **Android:** `values/styles.xml` umgestellt, `values/splash.xml` und
  `drawable/splash_icon.xml` neu, 11 tote `splash.png` entfernt (124 KB)
- **Wächter:** `scripts/stempel*.ts`, `assets/erzeugt.stempel.json`,
  ein Schritt in `.github/workflows/ci.yml`, zwei Skripte in `package.json`

## Next session: start here

### Die Deploy-Störung ist erledigt — nichts nachzuziehen

Zwischen 17:31 und 17:55 scheiterte **jeder** Job, der die Infisical-CLI
installiert (`deploy` und `drift-gate`, auf PRs wie auf `main`): Googles
Chrome-Paketquelle lieferte beim `apt-get update` einen kaputten Index
(`Hash Sum mismatch`). Zwei Commits lagen dadurch auf `main`, ohne ausgeliefert
zu sein — `279ff59` (AGE-713) und `9e5a81b` (AGE-714).

**Aufgelöst am selben Abend.** Statt anzunehmen, die Störung halte an, wurde sie
mit dem harmlosesten verfügbaren Lauf sondiert — einem **Vorschau**-Deploy, nicht
PROD. Der war grün, also war Googles Index repariert. Der Merge dieser Übergabe
(`95a9c39`) hat den `main`-Deploy dann von selbst angestossen, und weil er alles
Vorherige enthält, kamen beide liegengebliebenen Commits damit mit.

| Lauf | Ausgang |
|---|---|
| Vorschau-Deploy PR #384 (Sonde) | grün |
| PROD-Deploy `95a9c39` | **grün** — alles ausgeliefert |

**Die Lehre, nicht der Vorgang:** nach zwei identischen Fehlschlägen hatte ich
die Störung als „anhaltend" bezeichnet. Beobachtet war das nur bis 17:55 —
danach hat schlicht nichts mehr die Paketquelle angefasst. Eine Störung, die
niemand mehr misst, ist nicht *bestätigt anhaltend*, sondern **unbekannt**. Wer
das verwechselt, wartet auf etwas, das längst vorbei ist. Die billige Sonde
gegen eine ungefährliche Fläche beantwortet es in drei Minuten.

### Es gibt hier nichts mehr zu tun — der nächste Auftrag ist AGE-643

Linear ist geprüft und sauber: AGE-642, 711, 712, 713, 714 stehen auf `Done`,
jeder `completedAt` passt auf seinen Merge. **Teamweit gegengeprüft** — der
einzige Treffer ausserhalb des Projekts (AGE-701, cPARX, 17:19) stammt aus PR
#185 im Repo `cparx`, nicht von hier.

Der nächste Meilenstein ist **AGE-643** (M3 Deep Links). Erster Schritt wie
immer: `wt list` ansehen und nach einem bestehenden Branch suchen, bevor etwas
Neues entsteht. Die vier Gerätebelege unten sind davon unabhängig und brauchen
Donald am Gerät, nicht eine neue Sitzung am Rechner.

## Open questions

- **Vier Gerätebelege stehen aus**, alle in ihren Vorgängen als offenes
  Kästchen: AGE-711 (Regler nie am Gerät gesehen), AGE-712 und AGE-713 (quer
  und hochkant, iOS und Android). **iOS ist dafür Handarbeit** — `devicectl`
  kann weder Screenshot noch Tap.
- **Drei Neuigkeiten-Einträge warten auf Freigabe** in `AdminNeuigkeitenPage`:
  AGE-708 (Kontolöschung), AGE-642 (Hülle) und beim nächsten Archivieren die
  weiteren. Alle sind zum Versenden geschrieben.
- **Sechs Specs tragen noch `Purpose: TBD`** aus früheren Archivierungen:
  `member-onboarding`, `password-reset`, `member-import`, `environment-sync`,
  `legal-pages`, `design-system`. Altbestand, blockt nichts.
- **`APNS_SANDBOX` steht auf `1`** — beim ersten TestFlight-Build nachsehen.
- **Der nächste Meilenstein ist AGE-643** (M3 Deep Links). AGE-644 verlangt
  M1–M3 vorher und hängt zusätzlich an einer Entscheidung, die Donald und
  Detlev gehört: Entwicklerkonto auf Einzelperson oder Firma.

## Zwei Lehren dieser Sitzung

Beide stehen im Gedächtnis, mit den Messwerten.

1. **`/add-dir` hebt die Worktree-Isolation nicht auf.** Danach hält das `cd`,
   aber jeder Befehl im fremden Worktree wird abgewiesen — auch das `cd`
   zurück, die Sitzung ist festgefahren. Ausweg ist ein Werkzeug, kein Befehl:
   **`ExitWorktree` mit `action: "keep"`**. Stand schon dort; ich habe erst
   herumprobiert und dann nachgelesen. Umgekehrt wäre billiger gewesen.
2. **„Neu erzeugen und vergleichen" ist nicht immer der bessere Wächter** — er
   ist Geisel der Werkzeugversionen. Ein Stempel über Eingaben *und* Ergebnisse
   ist unabhängig davon, und was er nicht kann, gehört neben ihn geschrieben.
