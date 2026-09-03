# Übergabe — Androidlauf 03.09.

> Diese Datei liegt hier und **nicht** in `session-handoff.md`: die geteilte
> Übergabedatei trägt je einen Vorgang und steht seit dem 03.09. auf AGE-688.
> Was AGE-642 betrifft, gehört in den Change.

Pixel 11 Pro, Android 17 (SDK 37), Debug-Bau aus `1f68804`.
Ausführliche Belege in `tasks.md` Phase E, hier nur, was die nächste Sitzung
braucht.

## Erste Handlung

**PR #330 nachsehen** (`gh pr view 330 --json state`). Ist er gemergt, in Linear
prüfen: AGE-642 fällt nach jedem Merge auf `Done` und gehört zurück auf
`In Progress`, solange die Abnahmeliste offen ist.

**Dann der Push-Absturz** — er ist der einzige Fund, der die App unbenutzbar
macht, und er ist entscheidungsreif.

## Die Werkzeugkette (kostet sonst zwanzig Minuten)

| | |
|---|---|
| `adb` | `~/Library/Android/sdk/platform-tools/adb` — **nicht im PATH**, mit vollem Pfad rufen |
| `JAVA_HOME` | `/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home` |
| `ANDROID_HOME` | `~/Library/Android/sdk` |
| Gerät | `67011FDKX006NA`, USB-Debugging steht |

**Das JBR von Android Studio taugt nicht.** Es ist Java 25, und Gradle 8.14.3
bricht daran ab mit `Unsupported class file major version 69`. Ein System-`java`
gibt es auf dieser Maschine nicht.

Bauen und installieren:

```bash
infisical run --env=prod -- pnpm build
infisical run --env=prod -- pnpm exec cap sync android
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

`cap sync` muss durch `infisical`: `capacitor.config.ts` **wirft**, wenn
`VITE_SUPABASE_URL` fehlt — mit Absicht, damit `updateUrl` nicht stillschweigend
auf `plugin.capgo.app` zurückfällt und `device_id` an einen Dritten geht.

## Zustand des Geräts

**Die Benachrichtigungs-Berechtigung ist entzogen**, und das ist der Zustand, in
dem die App läuft. Wer sie erteilt, macht die App unbrauchbar (siehe unten).
Zurücknehmen geht mit

```bash
adb shell pm revoke com.effbeezee.app android.permission.POST_NOTIFICATIONS
```

Danach fragt die App beim nächsten Öffnen der Nachrichten erneut — dort
**„Nicht erlauben"**, solange der Fehler steht.

## Die zwei Fehler

### 1. Push-Erlaubnis tötet die App

`AppShell.tsx:662` ruft beim Start `pushLebenszeichen()`; bei erteilter Erlaubnis
läuft `PushNotifications.register()`, Firebase ist ohne `google-services.json`
nicht initialisiert, und es wirft — **FATAL auf Capacitors nativem
Plugin-Thread**, nicht im JS-Kontext. Das `try/catch` in `push.ts:82` kann das
prinzipiell nicht fangen.

Zu entscheiden: `google-services.json` bereitstellen löst es für den
Regelbetrieb, aber nicht für Bauten ohne die Datei. Robuster wäre, `register()`
nur zu rufen, wenn Firebase initialisiert ist — dann wird aus „Push geht nicht"
wieder „Push geht nicht" statt „App geht nicht". **Formal M1-Scope, blockiert
aber die Abnahme hier.**

### 2. Bildupload bricht still ab

Nach der Bildauswahl lädt die WebView neu (`webview_dom_content_loaded`), der
React-Zustand ist weg, kein Zuschnitt, kein Upload, kein Fehler. Capgo ist
ausgeschlossen. **Belegt ist der Reload, nicht seine Ursache** — die naheliegende
Vermutung ist, dass Android die Activity zerstört, während der Photo-Picker im
Vordergrund liegt.

Nächster Schritt wäre, das zu belegen statt zu vermuten: `android:configChanges`
und der Activity-Lebenszyklus in `MainActivity`, dazu ein Lauf mit
„Aktivitäten nicht behalten" in den Entwickleroptionen — das erzwingt die
Zerstörung und macht aus dem Zufallsfund einen reproduzierbaren Test.

Messpunkte für die Gegenprobe (beide ohne Anmeldung am Gerät ablesbar):

```sql
select count(*), max(created_at) from storage.objects where bucket_id='avatars';
-- Stand 03.09.: 61 Dateien, neuestes vom 27.08.
```

`profiles.updated_at` taugt **nicht** als Beleg — der Zeitstempel wird auch ohne
Bearbeitung gesetzt (gemessen: zwei Änderungen ohne jede Profilbearbeitung).

## Was noch aussteht

- **Realtime im Chat** — nicht allein messbar, es muss jemand schreiben, während
  die App offen ist. Ein Log-Beleg genügt nicht: Supabase Realtime läuft in der
  WebView und schreibt nicht ins logcat.
- **Web-Sitzung nach dem Storage-Umbau** — geht am Rechner, ohne Gerät.
- **Bildupload auf iOS** ist ebenfalls ungeprüft. Wenn die Ursache die
  Activity-Zerstörung ist, verhält sich iOS anders — das ist eine eigene Messung,
  keine Ableitung.
- **B5 Startbildschirm** (Runbook §6) verlangt Deinstallieren und **kostet die
  Anmeldung**. Zuletzt machen.

## Kleinigkeiten, gemessen aber nicht verfolgt

- `reportWebViewError` ist **kein Fehlerkanal, sondern Telemetrie**: auch
  `webview_dom_content_loaded` und `webview_page_loaded` laufen darüber. Wer im
  Log auf „Error" grept, findet normale Seitenladungen.
- Der Platzhalter „Nachricht schreiben" wird im Chat-Eingabefeld unten
  abgeschnitten.
- Die Systemleisten-Icons sind in Screenshots auf hellem Grund kaum zu erkennen;
  **am Gerät laut Donald lesbar**. Notiz, kein Mangel.
- `scripts/ota-buendel.logic.test.ts` ist auf CI flaky: der Test erzeugt einen
  4096-Bit-Schlüssel und reißt Vitests 5-Sekunden-Vorgabe. Er misst Verhalten,
  nicht Laufzeit — ein eigenes Timeout ist hier die Korrektur, kein Verdecken.
