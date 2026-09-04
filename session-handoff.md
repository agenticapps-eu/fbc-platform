# Session Handoff — 2026-09-04 (AGE-642: Mitteilungskanal und Bildupload, beide am Gerät belegt)

> ## ⚠ ZUERST — Scope dieser Übergabe
>
> **Sie führt nur AGE-642 (M2, Capacitor-Hülle).** Die Datei ist für alle
> parallelen Sitzungen dieselbe und kollidiert bei jedem Rebase — **nicht
> zusammenführen.**
>
> **Vorher stand hier AGE-542 und AGE-618.** Beide sind abgeschlossen,
> ausgeliefert und archiviert; jene Sitzung hatte nichts Offenes mehr, was ihr
> gehörte. Ihre allgemeinen offenen Fragen (rotes `pnpm lint` im Haupt-Checkout
> aus `.gstack/`, drei Remote-Zweige nach dem Merge, die Verortung der
> anon-Anforderung) sind **nicht** übernommen und stehen im Verlauf:
> `git show 1a95ca0:session-handoff.md`.
>
> **Die Gerätebelege im Detail stehen NICHT hier**, sondern in
> `openspec/changes/capacitor-huelle/uebergabe-android.md` und in `tasks.md`,
> Phase E. Diese Datei bleibt der Überblick.

## Accomplished

Zwei Aufgaben, beide Ende zu Ende am Pixel 11 Pro belegt. Fünf PRs, alle
gemerged, CI grün.

| PR | Was |
|---|---|
| **#333** | Mitteilungskanal auf Android — die App überließ ihn FCM |
| **#337** | Die OTA-Übernahme darf nicht in den Bildwähler platzen |
| #338 · #339 · #340 | Übergabe und Messprotokolle |

**1 · Der Mitteilungskanal.** Die App deklarierte keinen; FCM legte sich seinen
eigenen an („Sonstiges"). Jetzt `<meta-data …default_notification_channel_id>`
im Manifest plus `pushKanalAnlegen()` beim Montieren der Hülle. Belegt:

```
vorher:  fcm_fallback_notification_channel | Miscellaneous | imp=3 | vib=false
nachher: mitteilungen | Nachrichten und Kontaktanfragen | imp=4 | vib=true
zugestellt 17:11: tag=…112503055  channel=mitteilungen  importance=4
```

Die Zustellung vom Vormittag liegt als Gegenprobe daneben und trägt weiter den
Fallback — zwei Zustellungen, dasselbe Gerät, verschiedene Kanäle.

**2 · Der Bildupload.** Ursache gefunden und **die bisherige Vermutung
widerlegt**: nicht der Activity-Lebenszyklus, sondern ein wartendes
capgo-Bündel, das bei der Rückkehr aus dem *gestoppten* Zustand übernommen wird,
die WebView neu lädt und das offene `await Camera.takePhoto()` tötet. Fix:
`setMultiDelay({delayConditions:[{kind:"kill"}]})` / `cancelDelay()` um den
nativen Rundlauf. Gegenprobe unter hergestellter Fehlerbedingung:

| Lauf | Kamera | Bündel wartete | Aufschub | Ausgang |
|---|---|---|---|---|
| 17:19 | ja | ja | nein | Zustand weg |
| 17:22 | ja | nein | nein | Zuschnitt |
| **18:37** | ja | ja | **ja** | **Zuschnitt** |
| 18:39 | — | ja | gefallen | Übernahme läuft normal |

Zeile 3 unterscheidet sich von Zeile 1 in **einer** Variablen.

## Decisions

- **Ein Kanal, nicht zwei.** Eine Trennung nach Nachricht/Kontaktanfrage wäre
  naheliegend — aber einen abgeschalteten Kanal kann die App nie wieder
  einschalten. Entwurf, kein Anbau.
- **`vibration: true` ausdrücklich**, weil Capacitors Manager das Feld mit
  Vorgabe **false** liest (anders als Android). Kein `sound`, weil der Kanal
  ohne den Schlüssel den Systemton behält; ein Wert verlangte `res/raw`.
- **`PUSH_KANAL_ID` darf sich nie ändern** — eine neue Kennung ist für Android
  ein neuer Kanal und setzt eine Abschaltung des Mitglieds zurück.
- **Chirurgischer Aufschub statt `directUpdate: true`** (Donald, 04.09.):
  letzteres erschlüge die ganze Klasse, verlängert aber jeden Start und verdreht
  D4/D5 mit. Eigener Vorgang, wenn überhaupt.
- **`default_sound: true` im Versand bleibt stehen** — unter Android 8 gibt es
  keine Kanäle, und `minSdkVersion = 24` reicht bis Android 7.0.
- **Der Upload wurde bewusst NICHT abgeschlossen** (`Abbrechen` statt
  `Übernehmen`): es hätte ein Foto einer dunklen Fläche als Donalds Profilbild
  auf PROD gesetzt.

## Files modified

| Pfad | Was |
|---|---|
| `android/app/src/main/AndroidManifest.xml` | `<meta-data>` für den Vorgabekanal |
| `src/lib/push.ts` | `PUSH_KANAL_ID` + `pushKanalAnlegen()` |
| `src/lib/push.kanal.test.ts` | neu — hält Manifest und Konstante zusammen |
| `src/components/AppShell.tsx` | Kanal beim Montieren, eigener Effect |
| `src/components/AppShell.push.test.tsx` | Attrappe erweitert, drei Zusagen |
| `src/lib/bildauswahl.ts` | OTA-Aufschub um den nativen Rundlauf; Rumpf nach `hole()` |
| `src/lib/bildauswahl.test.ts` | Reihenfolge, Abbruch-Freigabe, Fehlerfälle |
| `openspec/changes/capacitor-huelle/specs/native-shell/spec.md` | Anforderung Mitteilungskanal |
| `openspec/changes/capacitor-huelle/tasks.md` | Messreihen, Ursache, Messfallen |
| `openspec/changes/capacitor-huelle/uebergabe-android.md` | Gerätebezogene Übergabe |

## Next session: start here

**B3 — Keystore und Signier-Workflow.** In `.github/workflows/` steht bis heute
kein einziger Gradle-Lauf; ohne ihn gibt es keinen Release-Bau und keine
Store-Einreichung (M4). Das ist der größte verbleibende Block von AGE-642. Erste
Handlung: klären, wo der Android-Keystore erzeugt und **zusätzlich außerhalb des
Repos** gesichert wird — er ist unersetzlich, und ohne ihn ist die App im Store
tot. Danach der eigene Workflow, manuell oder per Tag ausgelöst, **nicht** in
`deploy.yml`.

Davor zwei Wischer am Gerät, wenn Donald mag: den Bildweg einmal mit
`Übernehmen` zu Ende gehen, damit auch der Upload selbst belegt ist. Messpunkt
`select count(*), max(created_at) from storage.objects where bucket_id='avatars'`
(Stand 03.09.: 61 Dateien, neuestes vom 27.08.); `profiles.updated_at` taugt
**nicht** als Beleg.

> ⚠ **Vor jeder Gerätemessung**, drei Fallen, alle am 04.09. eingetreten:
> `adb install` belegt die Weboberfläche **nicht** (capgos Bündel gewinnt) ·
> `notifyAppReady` belegt **kein** Neuladen (capgos 10-Sekunden-Timer) · die
> Bildschirmsperre hochsetzen, sonst laufen die Taps an den Sperrbildschirm.

## Open questions

- **Der Debug-Bau schreibt die vollständige Supabase-Sitzung ins logcat**
  (Capacitors ausführliche Plugin-Protokollierung gibt `Preferences.get` samt
  Ergebnis aus). Vor der Store-Einreichung am **Release**-Bau gegenprüfen, dass
  die Stufe dort wirklich aus ist. Eigener Vorgang.
- **`use-gespraech.test.tsx` ist CI-flaky** (`hatAeltere`, Zeile 375) — schlug
  auf einem reinen Doku-PR fehl, lokal 5 von 5 grün. Rerun genügte. Kommt er
  wieder, misst er Laufzeit statt Verhalten und gehört repariert.
- **Realtime im Chat** ist weiterhin ungemessen — es muss jemand schreiben,
  während die App offen ist; ein Log-Beleg genügt nicht.
- **Bildupload auf iOS** ist ungeprüft. Die Ursache war capgo, nicht Android —
  iOS ist also vermutlich genauso betroffen, aber das ist eine Ableitung, keine
  Messung.
- **B5 Startbildschirm** verlangt Deinstallieren und kostet die Anmeldung —
  zuletzt machen. Für Android ohnehin eigener Vorgang (SplashScreen-API).
