# Session Handoff — 2026-09-08 (AGE-642: B5 Boot-Fläche, iOS-Hälfte von B3)

> ## ⚠ ZUERST — Scope dieser Übergabe
>
> **1. Sie führt nur AGE-642** (M2, Capacitor-Hülle), Worktree
> `fbc-platform.donald-age-642-capacitor-huelle`. Die Datei ist für alle
> parallelen Sitzungen dieselbe und kollidiert bei jedem Rebase — **nicht
> zusammenführen**, überschreiben.
>
> **2. Sie ersetzt die AGE-705-Fassung.** Wer die sucht:
> `git show 97e3df6:session-handoff.md`. An AGE-705 ist von hier aus **nichts**
> zu tun.
>
> **3. Die Belege im Detail stehen NICHT hier**, sondern in
> `openspec/changes/capacitor-huelle/tasks.md`, Abschnitte B3 und B5.

## Accomplished

Zwei PRs, beide gemergt: **#364** (`f38fdc2`), **#365** (`8f5f6c5`).

### B5 — die Boot-Fläche schliesst die Lücke beim App-Start

Zwischen nativem Startbildschirm und erstem Bild der Anwendung stand eine leere
Fläche. In `tasks.md` stand dazu die Vermutung „weiss auf weiss, also
unsichtbar". **Regionsweise gemessen gilt das nur fürs untere Drittel:** oben
weicht ein Foto (`#b8b7ad`, Streuung 67) einer vollkommen leeren Fläche
(`#f6f8fb`, Streuung 0), 40 ms (dieser Mac) bis 228 ms (6-fache CPU-Bremse).

Jetzt zeigt die Fläche dieselbe Komposition wie das Storyboard — Markup in
`index.html` **innerhalb von `#root`** (React räumt es beim ersten `render()`
selbst weg), freigeschaltet vom Inline-Skript im `<head>` über
`window.Capacitor.isNativePlatform()`. Gemessen: Boot-Fläche `#b8b7ac`/67 gegen
Startbildschirm `#b8b7ad`/67; im Browser **0 Bildanfragen**, nativ 2.

### B3 — die iOS-Hälfte, erst gemessen, dann geschrieben

Die ganze Kette lokal durchgefahren, danach `ios-release.yml` als Abschrift.
**Erster CI-Lauf grün, alle 13 Schritte, 2 min 55 s** (nicht die 12–15 min, die
ich veranschlagt hatte — es gibt kein CocoaPods, SPM löst aus dem Cache).

Am **heruntergeladenen** Artefakt nachgeprüft, nicht nur im Log:
`Apple Distribution: Donald Vlahovic (WQZJ8649TN)` · Store-Profil ohne
Geräteliste · `aps-environment: production` · 1.0 (1) · Boot-Fläche liegt drin ·
`codesign --verify --deep --strict` bestanden · genau **eine** Datei im
Artefakt, kein Signaturmaterial.

**Der Befund, der die Arbeit halbiert:** es gibt kein Zertifikat als Secret.
`-allowProvisioningUpdates` lässt Apple **serverseitig** signieren — das `.ipa`
trägt `Apple Distribution`, während der Schlüsselbund weiterhin nur
`Apple Development` führt und `/v1/certificates` ebenfalls. Kein `.p12`, kein
Keychain-Import.

Dazu: App-Datensatz in App Store Connect angelegt (von Donald), drei `ASC_*`
in Infisical `prod`, Environment `ios-release` als Spiegel von `android-release`.

## Decisions

- **Boot-Fläche füllen statt stehen lassen** (Donald, 07.09.). Die
  Zwischenlösung „nur den Grundton auf `#ffffff`" ist verworfen — die eigene
  Messung sagt, sie repariert genau die Stelle, die man ohnehin nicht sieht.
- **Der Schriftzug bleibt ein Bild, kein Text.** Alle vier `@font-face` stehen
  auf `font-display: swap`, nichts wird vorgeladen; als Text spränge er mitten
  im geglätteten Moment um.
- **WebP statt JPEG** für die Web-Fassung des Bandes: bei gleichen 900 px
  154.860 → 41.600 B. Preis: `cwebp` als viertes Werkzeug von `pnpm splash`.
- **iOS zuerst lokal messen, dann den Workflow schreiben.** Die Android-Hälfte
  kostete einen roten Lauf, dessen Meldung falsch war, und das Suchen fand im
  CI statt.
- **Validiert, nicht hochgeladen** (`--validate-app` → VERIFY SUCCEEDED).
  Dadurch bleibt Build-Nummer 1 frei und der Workflow fängt bei `run_number` 1
  an, ohne Sonderregel.
- **Die Team-ID bekommt keinen `ASC_`-Namen.** `ios-release.yml` liest
  `APNS_TEAM_ID` — dasselbe Apple-Team, eine zweite Kopie wäre die erste, die
  auseinanderläuft.
- **Der Workflow hört beim signierten Artefakt auf.** TestFlight ist M4
  (AGE-644), wie auf der Android-Seite.
- **Freigabe des Erstlaufs per API**, mit Kommentar im Protokoll, der sagt wie
  sie zustande kam — Verfahren von Donald am 04.09. festgelegt.

## Files modified

- `index.html` — Boot-Flächen-Markup in `#root`, zweites Inline-Skript im `<head>`
- `src/index.css` — Regeln der Boot-Fläche, Vorgabe `display: none`
- `src/boot-flaeche.test.ts` — **neu**, acht Zusagen
- `scripts/splash.ts` · `scripts/splash.logic.ts` — Web-Fassungen aus derselben Quelle
- `public/brand/splash-band.webp` (41,6 kB) · `splash-schriftzug.png` (42,2 kB) — **neu**
- `.github/workflows/ios-release.yml` — **neu**, 13 Schritte
- `scripts/ios-release.workflow.test.ts` — **neu**, elf Zusagen
- `docs/secrets.md` — drei `ASC_*`-Zeilen plus Abschnitt zum cloud-verwalteten Zertifikat
- `openspec/changes/capacitor-huelle/tasks.md` — B3 iOS und B5 nachgezogen

## Next session: start here

**Beides sind eigene Sitzungen, so von Donald gewollt.** Die Gerätebelege
zuerst: `openspec/changes/capacitor-huelle/geraetesitzung-d5.md` ist das
Runbook, offen sind A1, C1, C2, C3 und B5 — und **B5 zuletzt**, weil es
Deinstallieren verlangt und das die Anmeldung kostet. Der wichtigste Punkt
dabei ist neu und steht in keinem Runbook: **ob `window.Capacitor` im `<head>`
am echten Gerät schon steht.** Steht es nicht, bleibt das Attribut `data-boot`
weg, die Boot-Fläche erscheint nicht, und alles sieht aus wie vorher — kein
Fehler, kein Log. Prüfen lässt es sich am Gerät über die Konsole
(`document.documentElement.dataset.boot`). Danach TestFlight unter **AGE-644**.

> ⚠ **„Build-Nummer = Lauf-Nummer" ist weiterhin NICHT bewiesen.** Lauf 1
> verglich 1 mit 1, und 1 ist auch die Projektvorgabe. Die Zusage wird erst bei
> Lauf 2 echt. Grün heisst hier noch nichts.

> ⚠ **Admin-Bypass ist bei einem neuen GitHub-Environment `true`.** Beim
> Anlegen von `ios-release` stand er so da, während Android auf `false` steht —
> die Freigaberegel wäre Dekoration gewesen. Nachgezogen. Wer ein Environment
> anlegt, muss es zurücklesen.

> ⚠ **Der Linear-Status kippt bei JEDEM Merge auf Done.** Der Branchname trägt
> `age-642` und löst allein aus; vorbeugen geht nicht. Am 07.09. zweimal
> zurückgesetzt. Nach jedem Merge nachsehen.

> ⚠ **Squash-Falle, weiterhin scharf.** Nach jedem Merge `git log
> origin/main..HEAD` prüfen — ist es leer, `git reset --hard origin/main`. Der
> nächste Push braucht `--force-with-lease`.

> ⚠ **Zwei Dateien nie mitcommitten.** `prettier --write` auf `tasks.md`
> schreibt ~1000 fremde Zeilen um (und Prettier ist in KEINEM CI-Gate);
> `src/content/release-entries.generated.ts` wird von jedem `pnpm build`
> unformatiert neu geschrieben — zurücknehmen.

## Open questions

- **Der ASC-Schlüssel `ND87HL4S75` ist Team Scoped** und am 25.07. für Donalds
  andere App angelegt. Er funktioniert, aber ein CI-Runner mit Zugriff auf jede
  App des Teams ist mehr Reichweite als nötig. Rotieren geht jederzeit.
- **Der Name im Store ist „eff.bee.zee."**, mit Punkt am Ende. Umbenennen geht,
  solange nicht eingereicht ist.
- **`APNS_SANDBOX` steht auf `1`**, ein Store-Build spricht Produktions-APNs an.
  `send-push` erkennt den Host an der Antwort, sollte sich also selbst fangen —
  beim ersten TestFlight-Build nachsehen.
- **Der Debug-Bau schreibt die Supabase-Sitzung ins logcat.** Vor der
  Einreichung am Release-Bau gegenprüfen. Eigener Vorgang.
- **`use-gespraech.test.tsx` ist CI-flaky** (`hatAeltere`) — rerun genügt.
