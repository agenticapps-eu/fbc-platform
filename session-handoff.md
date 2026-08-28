# Session Handoff — 2026-08-28 (Abend, Push verdrahtet · App-Symbol · PR #277)

**Worktree:** `fbc-platform.donald-age-642-capacitor-huelle`, Branch
`donald/age-642-capacitor-huelle`, Baum **sauber**, alles gepusht (`33bb25b`).
**PR #277 ist offen — als Entwurf, und das mit Absicht.**

**Der Code ist fertig, beide Plattformen sind gebaut, die Abnahme steht aus.**
Donald hat das iPhone mitgenommen („wir testen, wenn du alles fertig hast").
Alles, was an AGE-641 Phase B noch offen ist, lässt sich **ausschliesslich am
Gerät** messen.

## Accomplished

### AGE-641 Phase B — die Verdrahtung (`ac8999e`)

`src/lib/push.ts` stand seit dem 28.08. gebaut und **ohne Aufrufer** da. Jetzt:

- **`pushEinrichten()` beim Öffnen der Nachrichten**, nicht im Kaltstart. iOS
  zeigt den Systemdialog einmal; wer ihn vor jedem Zusammenhang sieht, lehnt ab,
  und die Ablehnung ist endgültig.
- **Beide** Wege hinein zählen: die Schublade **und** die Route `/chat`.
- **Der Riegel merkt sich das Konto, nicht ein Ja/Nein.** Zuerst war er ein
  Ja/Nein — das hätte genau den Fall verschluckt, für den `claim_push_token`
  gebaut wurde. **Gefunden hat es der Test, nicht das Lesen.**
- **`pushAbmelden()` in `AuthProvider.signOut`**, vor `auth.signOut()` und nicht
  bei einem der **fünf** Aufrufer.

**Fund nebenbei:** `@capacitor/push-notifications` war auf **Android nie
registriert** — die Abhängigkeit lag seit Phase A im `package.json`, aber ein
`cap sync android` war nie gelaufen.

### AGE-642 B4 — das App-Symbol (`64b49ea`)

Eine Quelle (`public/brand/compass-favicon.svg`), fünfzehn Dateien, `pnpm
app:icons`. Weiss auf Navy `#081527`. Gemessen statt behauptet: die mittlere
Farbe sprang von `#ebf6fe` auf `#212d3d` — **am gebauten Artefakt**, also
`AppIcon60x60@2x.png` innerhalb von `App.app` und den PNG aus der entpackten
APK.

### Code-Review und ihre Auflagen (`954c037`)

opencode über den Diff: **FREIGABE MIT AUFLAGEN**, kein Kernfehler. Drei Punkte,
alle abgearbeitet: der Riegel fiel auch bei `"fehler"` zu (jetzt Rücknahme, bei
`"abgelehnt"` ausdrücklich nicht) · das Regex-Parsing brach still an drei
Stellen (`"15.5.5"` → NaN in alle fünfzehn PNG, erster Treffer gewinnt,
`transform` ignoriert) · der Reihenfolge-Test hätte auch ein `void` ohne `await`
bestanden.

### `deno.lock` (`33bb25b`)

Der **erste CI-Lauf dieses Branches** fand es: `edge-functions` rot, sechs
Capacitor-Pakete fehlten im Lock. Der Deno-Job liest `package.json` mit.
Nachgezogen, 472 Zeilen. Weggeschrieben als Erinnerung.

## Decisions

- **Der Erlaubnisdialog beim Öffnen der Nachrichten**, nicht im Kaltstart und
  nicht „nach der ersten Nachricht" (so stand es in `tasks.md`) — letzteres
  gibt es als Ereignis gar nicht, wenn noch nie eine kam.
- **Navy `#081527` mit weisser Marke**, nicht blau auf weiss: die dokumentierte
  Inversfassung, und iOS verbietet Durchsichtigkeit ohnehin.
- **Die Quelle ist das Favicon, nicht `CompassMark.tsx`.** Die beiden
  unterscheiden sich in genau einer Grösse; das Favicon ist die für kleine
  Grössen gehärtete Fassung, und ein App-Symbol IST der kleine Fall.
- **PR als Entwurf.** Er ist erst mergefähig, wenn am Gerät gemessen ist.
- **AGE-642 in Linear zurück auf *In Progress*** — die Automation hatte beim
  Merge von #272 auf Done geschaltet, die Abnahmeliste ist zur Hälfte offen.
  Begründung als Kommentar am Vorgang.
- **Nicht gemacht:** der Startbildschirm bleibt Capacitors weisse Fläche. Sie
  trägt keine fremde Marke, nur keine eigene — eigener Vorgang.

## Files modified

- `src/components/AppShell.tsx` — der Effect um Zeile 606, plus Import
- `src/components/AppShell.push.test.tsx` — **neu**, acht Zusagen
- `src/providers/AuthProvider.tsx` — `pushAbmelden()` vor `auth.signOut()`
- `src/providers/AuthProvider.push.test.tsx` — **neu**, drei Zusagen
- `src/lib/push.ts` — `letztesToken`, `pushAbmelden()`
- `src/lib/database.types.ts` — Tabelle `push_tokens`, von Hand
- `scripts/app-icons{.logic,.logic.test,}.ts` — **neu**, dreizehn Zusagen
- `assets/app-icon{,-round,-foreground}.svg` — **neu**, erzeugt und lesbar
- `android/.../mipmap-*`, `ios/.../AppIcon.appiconset` — die fünfzehn PNG
- `android/app/capacitor.build.gradle`, `android/capacitor.settings.gradle`
- `deno.lock`, `package.json` (`app:icons`)
- `openspec/changes/{push-fundament,capacitor-huelle}/` — Delta + Aufgaben

## Next session: start here

**Erste Aktion: das iPhone anstecken und in dieser Reihenfolge messen.** Ohne
Schritt 3 belegt der Rest nichts.

1. `xcrun devicectl list devices` — die UDID holen (zuletzt
   `544B9818-1B6A-5B09-827D-BC3C88462D3D`)
2. `xcrun devicectl device install app --device <UDID> ~/Library/Developer/Xcode/DerivedData/App-fjtekmjleeroiabuhudhvziazqpk/Build/Products/Debug-iphoneos/App.app`
   — der Bau von heute Abend liegt dort und ist aktuell
3. **Vorher** `select count(*) from push_tokens` → muss **0** sein. Das ist die
   Positivkontrolle
4. App öffnen, anmelden, **Nachrichten öffnen** — hier kommt der Dialog, nicht
   beim Start. Erlaubnis geben
5. `select count(*) from push_tokens` → muss **1** sein
6. Erst dann eine Nachricht einfügen und den Push abwarten
7. Sichtprobe am Sperrbildschirm: „… hat dir geschrieben", **kein** Text,
   Bildschirmfoto als Beleg

⚠️ **Ein Push, der nicht ankommt, sieht aus wie einer, den niemand ausgelöst
hat.** Wenn Schritt 6 still bleibt, ist die Frage nicht „warum kommt nichts",
sondern **wo die Kette abreisst**: `notifications`-Zeile da? →
`net._http_response` neue Zeile? → `send-push`-Antwort `{"skipped":true}` oder
etwas anderes? Die drei sind getrennt zu prüfen; jede sieht bei Erfolg und bei
Ausfall gleich aus.

**Danach:** PR #277 aus dem Entwurf holen und mergen (CI war vollständig grün:
`verify`, `edge-functions`, `migrations`, `deploy`, `pr-title` alle `success`).
Vorher `git fetch` + Rebase — `main` steht auf `7a5f58a`, dieser Branch zweigt
davor ab.

## Open questions

- **Android ist nicht auf einem Gerät gelaufen.** Die APK baut
  (`BUILD SUCCESSFUL`), mehr ist nicht belegt.
- **Die Anbieter-Secrets in Infisical `prod` sind bewusst leer.** Mit dem ersten
  echten Gerätetoken müssen sie stehen.
- **`CFBundleDevelopmentRegion` steht auf `en`** bei einer deutschen App.
- **`pnpm build` schmutzt jedes Mal `release-entries.generated.ts`** — vor jedem
  Commit `git checkout --` darauf.
- **Die `.env` in diesem Worktree zeigt auf `https://messung.supabase.co`**,
  einen Platzhalter aus einer Messsitzung. `pnpm dev` liefe damit ins Leere;
  gebaut wurde deshalb über `infisical run --env=dev`. Nicht von mir angefasst.
- **Der Startbildschirm** ist Capacitors weisse Fläche — eigener Vorgang.
- Aus der Review nicht umgesetzt: der hart verdrahtete `fill="none"` am Ring in
  `app-icons.logic.ts`. Eigenschaft der Ausgabe, nicht Lesefehler.
- Unverändert offen: **B3** (Signaturmaterial, eigener nativer Workflow), C2
  (Android-Zurück), C3 (Kamera), Phase D (OTA), Phase E. Beide Changes sind
  **nicht** archiviert.
- **AGE-653** (`deno.json` nach `supabase/functions/`) hat heute konkret weh
  getan — siehe den `deno.lock`-Commit.
