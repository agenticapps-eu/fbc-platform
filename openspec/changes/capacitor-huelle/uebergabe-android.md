# Übergabe — Androidlauf, Stand 04.09.

> Diese Datei liegt hier und **nicht** in `session-handoff.md`: die geteilte
> Übergabedatei trägt je einen Vorgang und steht seit dem 03.09. auf AGE-688.
> Was AGE-642 betrifft, gehört in den Change.

Pixel 11 Pro, Android 17 (SDK 37). Ausführliche Belege in `tasks.md` Phase E,
hier nur, was die nächste Sitzung braucht.

## Erste Handlung

**Der Bildupload.** Push ist durch (siehe unten), er ist es nicht — und er ist
der letzte ⛔ auf der Abnahmeliste.

Push kann ab jetzt jederzeit nachgestellt werden mit

```sh
.gstack/run-android-push-probe.sh
```

Erwartet: `HTTP 200` und `bewerteFcm {"ergebnis":"zugestellt"}`. Wer stattdessen
`SENDER_ID_MISMATCH` sieht, hat eine Konfiguration aus einem fremden
Firebase-Projekt im Bau. Aus Claude Code heraus lässt sich das Werkzeug **nicht**
starten — der Klassifikator blockt jeden sendenden Lauf unter `--env=prod`
ebenso wie den `INSERT` in `notifications` auf PROD.

## Die Werkzeugkette (kostet sonst zwanzig Minuten)

| | |
|---|---|
| `adb` | `~/Library/Android/sdk/platform-tools/adb` — **nicht im PATH**, mit vollem Pfad rufen |
| `JAVA_HOME` | `/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home` |
| `ANDROID_HOME` | `~/Library/Android/sdk` |
| `aapt2` | `~/Library/Android/sdk/build-tools/36.0.0/aapt2` — 35.0.0 liegt daneben |
| Gerät | `67011FDKX006NA`, USB-Debugging steht |

**Das JBR von Android Studio taugt nicht.** Es ist Java 25, und Gradle 8.14.3
bricht daran ab mit `Unsupported class file major version 69`. Ein System-`java`
gibt es auf dieser Maschine nicht.

Bauen und installieren:

```bash
infisical run --env=dev  -- pnpm android:firebase   # NEU, siehe unten
infisical run --env=prod -- pnpm build
infisical run --env=prod -- pnpm exec cap sync android
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

**Die erste Zeile ist seit dem 04.09. Pflicht**, und sie erzwingt sich selbst:
fehlt `android/app/google-services.json`, bricht `./gradlew` mit einer
`GradleException` ab, die den Befehl nennt. Vorher baute Capacitors `try`/`catch`
schweigend eine Schale, die auf dem Gerät stirbt.

`cap sync` muss durch `infisical`: `capacitor.config.ts` **wirft**, wenn
`VITE_SUPABASE_URL` fehlt — mit Absicht, damit `updateUrl` nicht stillschweigend
auf `plugin.capgo.app` zurückfällt und `device_id` an einen Dritten geht.

## Zustand des Geräts

**Die Benachrichtigungs-Berechtigung ist seit dem 04.09. ERTEILT** — das ist die
Umkehrung des Stands vom 03.09., und sie ist der Beleg: mit erteilter Erlaubnis
startet die App jetzt. Sie stand auf `USER_FIXED`, die App durfte also selbst
nicht mehr fragen; erteilt wurde per

```bash
adb shell pm grant com.effbeezee.app android.permission.POST_NOTIFICATIONS
```

Zurücknehmen ginge mit `pm revoke` — es gibt aber keinen Grund mehr dafür.

## Der behobene Fehler, und was er gelehrt hat

**Push läuft, Ende zu Ende belegt am 04.09. um 09:30:** `HTTP 200`,
`bewerteFcm {"ergebnis":"zugestellt"}`, `FirebaseMessaging` in logcat eine
Sekunde später, und in der Mitteilungsleiste steht „Neue Nachricht — Androidprobe
hat Ihnen geschrieben." mit dem Markensymbol. `200` allein hätte nur „von FCM
angenommen" geheissen.

`PushNotifications.register()` tötete den Prozess bei jedem Start, sobald die
Erlaubnis erteilt war. Am 03.09. stand als Ursache „`google-services.json`
fehlt". Das war die Folge, nicht der Grund:

```
GET firebase.googleapis.com/v1beta1/projects/effbeezee-f9b48/androidApps → 200 {}
```

**Im Firebase-Projekt war gar keine Android-App registriert.** Die Datei fehlte,
weil ihr Gegenstück fehlte. Dass FCM am 28.08. als „authentifiziert" belegt war,
widerspricht dem nicht — die v1-Sende-API antwortet auf Projektebene und sagt
über registrierte Apps nichts. **Ein Beleg der Senderseite deckt die
Empfängerseite nicht.**

Registriert per `androidApps.create` mit dem Dienstkonto aus
`FCM_SERVICE_ACCOUNT`; `testIamPermissions` wies `firebase.clients.create`
vorher aus. App-ID `1:837618406403:android:764720a952fb886c5aea36`. Ein
SHA-1-Fingerabdruck ist **nicht** nötig — den verlangt Google Sign-In, nicht FCM.

**`GOOGLE_SERVICES_JSON` steht nur in Infisical `dev`.** `secrets set --env=prod`
ist aus Claude Code heraus geblockt. Es ist ein einziges Firebase-Projekt für
beide Umgebungen, also derselbe Wert — Donald muss ihn nachtragen.

## Was noch aussteht

- **⛔ Der Bildupload bricht still ab.** Nach der Bildauswahl lädt die WebView
  neu (`webview_dom_content_loaded`), der React-Zustand ist weg, kein Zuschnitt,
  kein Upload, kein Fehler. Capgo ist ausgeschlossen. **Belegt ist der Reload,
  nicht seine Ursache.** Nächster Schritt: `android:configChanges` und der
  Activity-Lebenszyklus in `MainActivity`, dazu ein Lauf mit „Aktivitäten nicht
  behalten" in den Entwickleroptionen — das erzwingt die Zerstörung und macht
  aus dem Zufallsfund einen reproduzierbaren Test. Die Tragweite reicht über den
  Avatar hinaus: derselbe Mechanismus trifft Kamera, Dateiauswahl und jeden
  externen Login.

  Messpunkte für die Gegenprobe, beide ohne Anmeldung am Gerät ablesbar:

  ```sql
  select count(*), max(created_at) from storage.objects where bucket_id='avatars';
  -- Stand 03.09.: 61 Dateien, neuestes vom 27.08.
  ```

  `profiles.updated_at` taugt **nicht** als Beleg — der Zeitstempel wird auch
  ohne Bearbeitung gesetzt (gemessen: zwei Änderungen ohne jede Profilbearbeitung).
- **Realtime im Chat** — nicht allein messbar, es muss jemand schreiben, während
  die App offen ist. Ein Log-Beleg genügt nicht: Supabase Realtime läuft in der
  WebView und schreibt nicht ins logcat. Fällt mit der Push-Zustellung oben
  zusammen, wenn Detlev schreibt.
- **Web-Sitzung nach dem Storage-Umbau** — geht am Rechner, ohne Gerät.
- **Bildupload auf iOS** ist ebenfalls ungeprüft. Wenn die Ursache die
  Activity-Zerstörung ist, verhält sich iOS anders — eigene Messung, keine
  Ableitung.
- **B5 Startbildschirm** (Runbook §6) verlangt Deinstallieren und **kostet die
  Anmeldung**. Zuletzt machen. Für Android ist die Fläche ohnehin ein eigener
  Vorgang: seit Android 12 zeichnet die SplashScreen-API, Capacitors
  `@drawable/splash` wird nicht mehr gezeigt.
- **B3 Keystore und Signier-Workflow** — nichts davon existiert; in
  `.github/workflows/` steht kein einziger Gradle-Lauf. Ohne das kein
  Release-Bau und keine Store-Einreichung (M4).

## Kleinigkeiten, gemessen aber nicht verfolgt

- `reportWebViewError` ist **kein Fehlerkanal, sondern Telemetrie**: auch
  `webview_dom_content_loaded` und `webview_page_loaded` laufen darüber. Wer im
  Log auf „Error" grept, findet normale Seitenladungen.
- Der Platzhalter „Nachricht schreiben" wird im Chat-Eingabefeld unten
  abgeschnitten.
- Die Systemleisten-Icons sind in Screenshots auf hellem Grund kaum zu erkennen;
  **am Gerät laut Donald lesbar**. Notiz, kein Mangel.
- **Die App deklariert keinen Mitteilungskanal.** Gemessen:
  `channel=fcm_fallback_notification_channel`, `sound=null vibrate=null
  defaults=0`; logcat sagt `Missing Default Notification Channel metadata in
  AndroidManifest`. Folge: `default_sound: true` in `fcmKoerper` ist auf
  Android 8+ wirkungslos (Ton ist dort Sache des Kanals), und in den
  Systemeinstellungen heisst der Kanal „Sonstiges". Kein Ausfall, eigener
  Vorgang — iOS ist nicht betroffen.
- Beim Start feuert `registration` **zweimal** und `claim_push_token` läuft
  zweimal — in `push_tokens` steht trotzdem genau eine Zeile, es ist ein Upsert.
  Kein Mangel, aber es erklärt die doppelte Logzeile.
- `scripts/ota-buendel.logic.test.ts` ist auf CI flaky: der Test erzeugt einen
  4096-Bit-Schlüssel und reißt Vitests 5-Sekunden-Vorgabe. Er misst Verhalten,
  nicht Laufzeit — ein eigenes Timeout ist hier die Korrektur, kein Verdecken.
