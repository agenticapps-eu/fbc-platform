# Session Handoff — 2026-09-09 (M2 ist zu; nächster Auftrag ist M3 / AGE-643)

> ## ⚠ ZUERST — Scope dieser Übergabe
>
> **1. Sie schliesst die AGE-642-Sitzung ab** (Worktree
> `fbc-platform.donald-age-642-capacitor-huelle`) und **zeigt auf AGE-643
> weiter.** Die Datei ist für alle parallelen Sitzungen dieselbe und kollidiert
> bei jedem Rebase — **nicht zusammenführen**, überschreiben.
>
> **2. `fbc-platform-f4` arbeitet parallel an AGE-705** (Release-Blog),
> vollständig ungepusht. Nichts davon liegt auf `main`. Abgestimmt am 09.09.
>
> **3. Donald will in einer FRISCHEN Sitzung mit M3 weitermachen.** Der
> Abschnitt „Next session" unten ist für genau diese Sitzung geschrieben.

## Accomplished

**M2 (AGE-642) archiviert, danach alle vier Anschlussvorgänge gebaut und
ausgeliefert.** Sieben PRs, alle gemergt, PROD-Deploy grün.

| Vorgang | PR | Linear |
|---|---|---|
| AGE-642 Capacitor-Hülle archiviert | #379 | Done |
| AGE-711 Regler im Onboarding | #380 | Done |
| AGE-712 Querformat-Startfläche | #381 | Done |
| AGE-713 Android-Startfläche | #382 | Done |
| AGE-714 Assets-Stempel | #383 | Done |
| Übergabe + zwei Korrekturen | #384, #385 | — |

Tests **2.639 → 2.672**, `pnpm lint` 0 Fehler, `pnpm typecheck` 0 durchgehend.
Linear teamweit gegengeprüft: nichts Fremdes zugegangen.

## Drei Befunde, die meine eigenen Vorgangstexte widerlegt haben

Alle in Linear korrigiert. Grüne Tests allein hätten keinen davon gefunden.

1. **AGE-711:** „auch am Schreibtisch unsichtbar" war zu weit gefasst — Chrome
   zeichnet den alten Knopf sehr wohl. Real sind iOS-WebKit, Firefox und die
   8-px-Trefffläche überall.
2. **AGE-712:** der Bandmittelwert ist der **falsche Massstab**. Der richtige
   Ausschnitt ist *heller* (185/172/157) als der kaputte (148/139/134) — der
   kaputte zeigt dunkle Anzüge, der richtige Gesichter vor hellem Fenster.
3. **AGE-713:** `capacitor.settings.gradle` zeigte auf pnpm-Pfade mit
   `@capacitor+core@8.5.0`, im Lockfile stand 8.5.1 — **der Android-Bau war auf
   `main` für jeden kaputt.** Mitgenommen, sonst hätte niemand C nachprüfen
   können.

## Next session: start here — AGE-643 (M3 Deep Links)

### ⚠ Der Vorgangstext ist an zwei Stellen überholt. Nicht darauf aufbauen.

**1 · „Blockiert durch AGE-256" gilt NICHT mehr.** AGE-256 steht auf `Done`,
und die App läuft **seit 01.09. auf `app.effbeezee.com`** (CNAME bei Strato auf
`fbc-platform.pages.dev`, Zertifikat von Cloudflare). M3 ist startklar.

**2 · Die Domain im Vorgang ist falsch.** Dort steht `fbc.de` — die gehört
GoDaddy und nicht dazu. Es gilt `app.effbeezee.com`. Details in
`domainlandschaft-effbeezee` im Gedächtnis; `fbc-platform.pages.dev` bleibt als
Zweitweg stehen, damit verschickte Links gültig bleiben.

### Stand im Repo: grüne Wiese

Gemessen — es gibt **nichts** davon: kein `public/.well-known/`, keine
`apple-app-site-association`, keine `assetlinks.json`, keinen OpenSpec-Change,
keinen Branch. `appId` ist `com.effbeezee.app` (`capacitor.config.ts:64`).

### Zwei Fallen, die vor dem ersten Code geklärt gehören

**A · `assetlinks.json` braucht den APP-Signaturschlüssel, nicht den Upload-
Schlüssel.** Im Repo steht `ERWARTETER_FINGERABDRUCK`
(`android-release.yml:78`, `7ae18622…2fda`) — das ist der **Upload**-Schlüssel.
Bei Play App Signing hält Google den eigentlichen App-Signaturschlüssel, und
**nur dessen** SHA-256 gehört in `assetlinks.json`. Den falschen einzutragen
ergibt App Links, die still nicht verifizieren.

**Folge, die die Reihenfolge M3→M4 durcheinanderbringt:** dieser Fingerabdruck
existiert erst, wenn die App in der Play Console angelegt und ein Bündel
hochgeladen ist — also **innerhalb von AGE-644**. Auf Android hängt M3 damit an
einem Stück M4. Das ist zu entscheiden, nicht zu übersehen: entweder AGE-644 so
weit vorziehen, dass der Schlüssel existiert, oder M3 zunächst nur auf iOS
abschliessen.

**B · Die Apple-Team-ID steht nicht im Repo.** `DEVELOPMENT_TEAM` fehlt in
`project.pbxproj` (deshalb braucht `xcodebuild` sie von Hand). Die
`apple-app-site-association` verlangt aber `TEAMID.com.effbeezee.app`. Die ID
kommt von Donald aus dem Developer-Konto.

### Der Fall, der den Zuschnitt bestimmt

**Der Aktivierungslink erreicht Menschen, die die App noch nicht haben** — er
ist der erste Kontakt überhaupt. Er muss beides können: App öffnen, wenn
installiert; sonst die Website, und die darf den Aktivierungsvorgang **nicht**
mit einem „Lade die App"-Banner verstellen. Universal Links leisten das, ein
eigenes Schema (`effbeezee://`) nicht. Deshalb Universal Links.

Vier Ziele laut Vorgang: `/aktivierung?token=…` (das wichtigste),
`/chat/:threadId`, `/events/:id`, `/p/:id`.

Dazu die Sitzungsübergabe: wer im Browser angemeldet ist, ist es in der App
nicht (getrennte Speicher). Beim Token unkritisch; bei `/chat/:threadId` landet
man auf dem Login und sollte danach ans **ursprüngliche Ziel** weitergeleitet
werden, nicht auf die Startseite.

### Erster Handgriff

`wt list` ansehen und nach einem bestehenden Branch suchen (es gibt keinen),
dann `/wt-switch-create donald/age-643-deep-links`. Danach der OpenSpec-Weg:
proposal → validate → **plan-review mit zwei fremden Anbietern, vor der ersten
Codezeile**.

## Open questions

- **Vier Gerätebelege stehen aus**, je als offenes Kästchen in ihrem Vorgang:
  AGE-711 (Regler nie am Gerät gesehen), AGE-712 und AGE-713 (quer und
  hochkant, iOS und Android). **iOS ist Handarbeit** — `devicectl` kann weder
  Screenshot noch Tap; Android geht per `adb` vollständig.
- **Zwei Neuigkeiten-Einträge warten auf Freigabe** in `AdminNeuigkeitenPage`
  (AGE-708 Kontolöschung, AGE-642 Hülle). Beide sind zum Versenden geschrieben.
- **Sechs Specs tragen noch `Purpose: TBD`** aus früheren Archivierungen.
  Altbestand, blockt nichts.
- **AGE-644 hängt zusätzlich an einer Entscheidung, die Donald und Detlev
  gehört:** Entwicklerkonto auf Einzelperson oder Firma. Im Store steht der
  Kontoinhaber als Anbieter.
- **Der Worktree dieser Sitzung steht noch.** `wt remove
  donald/age-642-capacitor-huelle` ist ein Handgriff für später — nicht aus
  einer Sitzung heraus, die darin sitzt.
