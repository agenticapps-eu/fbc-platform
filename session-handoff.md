# Session Handoff — 2026-08-28 (Abend, AGE-642 auf einem echten iPhone)

**Worktree:** `fbc-platform.donald-age-642-capacitor-huelle`, Branch
`donald/age-642-capacitor-huelle`, Baum **sauber**, alles gepusht (`82797d4`).
`main` steht auf `2d0b8d8` (die Nachbarsitzung hat AGE-655 gemergt); dieser
Branch ist **5 Commits davor abgezweigt** und braucht vor dem nächsten PR ein
`git fetch` + Rebase.

**Die App läuft auf einem echten iPhone 17 Pro gegen DEV.** Das ist der Kern
dieser Sitzung: nicht mehr Simulator, nicht mehr Behauptung.

## Accomplished

### Auf `main` gelandet (PR #272, `da5da85`, elf von elf Checks grün)

Phase A + B1 + B2 von `capacitor-huelle`. iOS und Android bauen beide durch,
belegt an den **gebauten** Artefakten: `plutil -extract` auf der Info.plist
*innerhalb* von `App.app`, `aapt2 dump` auf der APK. Dazu der Wächter gegen
native Geheimnisse (Baum statt Diff, Mutations-Gegenprobe tötet 5 von 6,
Historienlauf über 1896 Pfade sauber).

### Danach, noch NICHT auf `main` (fünf Commits auf dem Branch)

| Commit | |
| --- | --- |
| `db45981` | React Query nur nativ gezähmt (`staleTime` 30 s, kein Refetch bei Fokus) |
| `a1305a2` | `aps-environment` im signierten Bündel — die Hülle fordert Push an |
| `a9cf019` | Sichere Ränder (C1) + iOS-Eingabe-Zoom behoben |
| `df136dc` | Wischgeste von rechts, Schubladen unter der Kopfzeile, Pfeil nach aussen |
| `82797d4` | **WIP** Push-Token-Registrierung — Modul steht, Verdrahtung fehlt |

### Am Gerät belegt

- **Die Sitzung überlebt einen kompletten Neustart der App.** Die Abnahme aus
  Phase A, die sich nur dort führen lässt. Im Protokoll: `Preferences get` →
  `null`, dann beim Anmelden **`Preferences set` genau einmal**, danach liest
  die App die Sitzung nativ zurück (`sub` und `iss` stimmen).
- Anmelden, Verzeichnis, vier Gespräche mit Ungelesen-Zählern.
- Signierter Gerätebau mit Team `WQZJ8649TN`, Wildcard zuerst, nach dem
  Entitlement das Profil `com.effbeezee.app`.

## Decisions

- **App-ID `com.effbeezee.app`** war keine offene Wahl: sie liegt als
  `APNS_BUNDLE_ID` in den Secrets und ist das `apns-topic`.
- **Team-ID gehört NICHT ins Repo** (öffentlich, identifiziert das Konto
  dauerhaft). Sie kommt beim Bau von aussen: `DEVELOPMENT_TEAM=WQZJ8649TN`.
- **React Query nur nativ zähmen, Web unverändert** (Donald). Umgesetzt über
  `Capacitor.isNativePlatform()`, dieselbe Weiche wie beim Sitzungsspeicher.
  `refetchOnReconnect` bleibt bewusst `true`.
- **Wischgeste nur an der RECHTEN Kante** (Donald). Links liegt die
  System-Zurück-Geste von iOS.
- **Der Pfeil in der Kopfzeile bleibt** — Donald hatte ihn erst entfernen
  wollen, dann nach dem Befund umentschieden: ohne ihn fielen neun Zusagen aus
  AGE-627 (gemessen: 9 rot) und VoiceOver käme nicht mehr an die Schublade.
  Verschoben ist er trotzdem, ganz nach aussen.
- **C1 vorgezogen** vor B3, weil der Anmelden-Knopf unter der Statusleiste lag
  und die ganze Abnahme blockierte.
- **AGE-658** (React-Query-Vorgaben) hat die Nachbarsitzung angelegt; ich habe
  ihn übernommen statt einen zweiten aufzumachen. **AGE-657** (Index auf
  `messages`) gehört ihr.

## Files modified

- `capacitor.config.ts`, `ios/`, `android/` — die Hülle (auf `main`)
- `scripts/native-secrets-guard{,.logic,.logic.test,.cli.test}.ts` — B2 (auf `main`)
- `src/lib/query-defaults.ts` + Test — nativ gezähmte Vorgaben
- `src/lib/wischgeste.ts` + Test — die Wisch-Entscheidung, sieben Zusagen
- `src/lib/push.ts` — **neu, ohne Aufrufer**
- `src/lib/database.types.ts` — `claim_push_token`, Spalten abgelesen
- `ios/App/App/AppDelegate.swift` — Token-Weitergabe an die Brücke
- `ios/App/App/App.entitlements` — `aps-environment`
- `src/components/AppShell.tsx`, `src/index.css`, `index.html` — sichere
  Ränder, Eingabe-Zoom, Schubladen, Geste

## Next session: start here

**Erste Aktion: `git fetch` + Rebase auf `origin/main`** (5 Commits Rückstand),
dann `pnpm install`. Ohne das misst man gegen einen alten Stand.

**Dann AGE-641 Phase B zu Ende bringen — konkret fehlt nur die Verdrahtung.**
`src/lib/push.ts` ist gebaut und hat **keinen Aufrufer**. Der Aufruf gehört
laut Plan NICHT in den Kaltstart (wer beim ersten Start gefragt wird, sagt
nein, und iOS fragt kein zweites Mal), sondern dorthin, wo die Frage erklärbar
ist — beim Öffnen der Nachrichten. Danach:

1. bauen: `infisical run --env=dev --silent -- pnpm build`, `npx cap sync ios`
2. `xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphoneos \
   -destination 'generic/platform=iOS' -allowProvisioningUpdates \
   DEVELOPMENT_TEAM=WQZJ8649TN build`
3. `xcrun devicectl device install app --device 544B9818-1B6A-5B09-827D-BC3C88462D3D <App.app>`
4. Erlaubnis am Gerät einmal geben, dann prüfen: `select count(*) from
   push_tokens` muss **1** sein. Vorher war er 0 — das ist die Positivkontrolle.
5. Erst dann eine Nachricht einfügen und den Push abwarten.

**Donald wartet auf eine Aufnahme**, in der er eine Nachricht schickt, die App
schliesst, und ein echter Push ankommt. Ohne Schritt 4 ist das nicht möglich.

⚠️ **Die Kette ist sonst vollständig und nachgemessen:**
`messages INSERT → trg_hinweis_neue_nachricht → notifications INSERT →
notifications_push_webhook → send-push`. Aus 14 eingefügten Nachrichten sind 16
Hinweise entstanden. Nur `push_tokens` ist leer, deshalb `{"skipped":true}`.

## Open questions

- **Das App-Icon ist Capacitors Standard**, nicht die Marke. Eigener Schritt.
- „**Sieht ein bisschen hart aus**" — Donald zur Schublade. Kanten sind jetzt
  gerundet; ob er den fehlenden Übergang meinte, ist ungeklärt.
- **Der DEV-Zugang steht im Sitzungsprotokoll.** `donald@factiv.eu`, Passwort
  von mir gesetzt (`claim`-Weg über GoTrue-Admin, mit echter Anmeldung
  gegengeprüft). Nur DEV, PROD unberührt — sollte er ändern wollen, geht das in
  den Einstellungen.
- **Auf DEV liegen jetzt 6 Verbindungen, 4 Gespräche, 14 Nachrichten** für
  Donalds Konto, per Wegwerf-Skript angelegt und **durch die RLS mit seinem
  eigenen Konto gegengeprüft**. Sie sind erfunden, die Gegenüber sind echte
  gespiegelte Mitglieder.
- Unverändert offen: **B3** (Signaturmaterial, eigener nativer Workflow),
  Phase C2/C3, Phase D (OTA), Phase E. Der Change ist **nicht** archiviert.
- **`CFBundleDevelopmentRegion` steht auf `en`** bei einer deutschen App.
- **`pnpm build` schmutzt jedes Mal `release-entries.generated.ts`** — vor jedem
  Commit `git checkout --` darauf.
- Der Kommentar in `session-storage.ts` nennt noch `supabase-js` 2.112.1 und
  Zeile 626; installiert ist 2.112.4, die Formel ist unverändert, nur der
  Zeilenverweis veraltet.
