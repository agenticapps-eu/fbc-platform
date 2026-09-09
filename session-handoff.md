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

### ⚠ Zwei Commits liegen auf `main` und sind NICHT ausgeliefert

**Der Deploy ist seit 17:31 kaputt, aus fremdem Grund.** Der Schritt „Install
Infisical CLI" ruft `apt-get update`, und Googles Chrome-Paketquelle liefert
einen kaputten Index:

```
E: Failed to fetch https://dl.google.com/linux/chrome-stable/.../Packages.gz
   Hash Sum mismatch
```

Das trifft jeden Job, der Infisical installiert — `deploy` **und**
`drift-gate`, auf PRs wie auf `main`.

| Zeit | Commit | Deploy |
|---|---|---|
| 17:17 | `7a2624c` AGE-712 | grün |
| **17:31** | **`279ff59` AGE-713** | **rot** |
| **17:51** | **`9e5a81b` AGE-714** | **rot** |

Zweimal neu gestartet, beide Male identisch gescheitert. **Kein Aussetzer,
sondern anhaltend.** Geht von selbst weg, wenn Google den Index repariert.

**Der erste Handgriff der nächsten Sitzung:**

```
gh run rerun 34385506856 --failed      # der Lauf für 9e5a81b
```

**Ein Lauf genügt für beides.** Der Deploy baut aus dem ausgecheckten Commit,
und `9e5a81b` enthält AGE-713 bereits — `279ff59` muss NICHT eigens nachgezogen
werden. Vorher kurz prüfen, ob der Fehler noch derselbe ist; ist er weg, geht
der Lauf durch.

**Nicht erzwingen.** Weder einen PROD-Deploy an der Prüfung vorbei noch einen
Umbau der Infisical-Installation, um die Paketquelle zu umgehen — das erste ist
ein PROD-Schreibzugriff ausserhalb der Merge-Freigabe, das zweite eine Änderung
an der Geheimnis-Kette.

### Danach

Linear ist geprüft und sauber: AGE-642, 711, 712, 713, 714 stehen auf `Done`,
jeder `completedAt` passt auf seinen Merge. **Teamweit gegengeprüft** — der
einzige Treffer ausserhalb des Projekts (AGE-701, cPARX, 17:19) stammt aus PR
#185 im Repo `cparx`, nicht von hier.

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
