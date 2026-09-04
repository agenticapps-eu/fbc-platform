# Session Handoff — 2026-09-04 (AGE-642 B3: Android-Signierung und Release-Workflow)

> ## ⚠ ZUERST — Scope dieser Übergabe
>
> **1. Sie führt nur AGE-642 (M2, Capacitor-Hülle), Block B3.** Die Datei ist
> für alle parallelen Sitzungen dieselbe und kollidiert bei jedem Rebase —
> **nicht zusammenführen**, überschreiben.
>
> **2. Vorher stand hier AGE-605** (Anmeldungen/Kapazität, PR #342). Vollständig
> in `git show e1dd52a:session-handoff.md`. Eine Zeile daraus gilt weiter und
> **betrifft AGE-642 unmittelbar** — sie steht deshalb unten unter „Von AGE-605
> übernommen", nicht im Verlauf.
>
> **3. Die Gerätebelege im Detail stehen NICHT hier**, sondern in
> `openspec/changes/capacitor-huelle/uebergabe-android.md` und in `tasks.md`,
> Phase E. Diese Datei bleibt der Überblick.

## Von AGE-605 übernommen — gilt weiter

**Der Deploy von `main` ist blockiert, bis die PROD-Migration läuft.** Das
`drift-gate` ist rot, korrekt und wie vorgesehen:

```
DRIFT — lokal vorhanden, auf dem Ziel fehlend: 20260904160000
```

Das trifft **jeden** Deploy von `main`, AGE-642 eingeschlossen. Der `CI`-Lauf ist
davon nicht betroffen, die Pflichtchecks auch nicht — Merges gehen weiter. Der
PROD-Lauf ist ein eigener, ausdrücklicher Schritt (AGE-605 Aufgabe 10.4) und
**braucht Donalds Freigabe**.

## Accomplished

**B3, Android-Hälfte, komplett — PR #344.** iOS ist bewusst ein eigener Vorgang.

| Datei | Was |
|---|---|
| `scripts/android-keystore{,.logic}.ts` + 3 Testdateien | erzeugt `key.properties` + Keystore aus Infisical, Muster von `firebase-config.ts` |
| `android/app/build.gradle` | `signingConfigs.release` + Abbruch, wenn Material fehlt |
| `.github/workflows/android-release.yml` | `workflow_dispatch` + Tag `android-v*`, baut AAB **und** APK |

**Der Widerspruch der Aufgabe ist aufgelöst:** der Keystore darf nirgends im
öffentlichen Repo liegen, muss dem Bau aber vorliegen → über die **ignorierten**
Dateien, die der `native-secrets-guard` absichtlich nicht ansieht.

**Der stille Ausgang, der jetzt laut ist:** ohne `key.properties` bricht Gradle
**nicht** ab, sondern schreibt klaglos ein unsigniertes Release-Artefakt.

**Gemessen, nicht behauptet:**

| Lauf | Material | Ausgang |
|---|---|---|
| `assembleRelease bundleRelease` | ja | BUILD SUCCESSFUL, beide signiert |
| `assembleRelease` | **nein** | exit 1 bei `packageReleaseResources`, **kein Artefakt** |
| `assembleDebug` | nein | exit 0 — unberührt |

`apksigner` meldet SHA-256 `7ae18622…2fda`, zeichengleich mit dem Fingerabdruck
des Keystores. Kette reproduziert: beide Dateien gelöscht, aus `infisical run
--env=prod` neu erzeugt → derselbe Fingerabdruck.

## Decisions

- **Der Keystore ist NICHT unersetzlich** — die Aussage stand in `proposal.md`
  und im Delta und ist seit Aug. 2021 falsch. Play App Signing ist für neue Apps
  verpflichtend, Google hält den App-Signaturschlüssel, unserer ist der
  **Upload**-Schlüssel und über die Play Console zurücksetzbar. Beide Stellen
  korrigiert; die Sicherung bleibt gefordert, aus schwächerem Grund.
- **Infisical + eine Offline-Kopie** (Donald, 04.09.) statt Tresor-Disziplin.
- **Android zuerst, iOS eigener Vorgang** (Donald, 04.09.).
- **`versionCode` bewusst NICHT mitgenommen.** Das Schema ist eine Entscheidung
  und verzahnt sich mit `version_build` des OTA-Wegs.
- **`ERWARTETER_FINGERABDRUCK` im Workflow**, nachträglich auf Reviewer-Befund:
  `apksigner verify` allein belegt nur, *dass* signiert wurde, nicht *womit*.

## ⚠ Zwei Handgriffe, die nur Donald tun kann

1. **`~/Downloads/effbeezee-android-upload-keystore/` an einen verschlüsselten
   Ort bringen und den Ordner dann löschen.** Dort liegt das Passwort im
   Klartext. Das ist die beschlossene Offline-Kopie; `LIESMICH.md` erklärt alles.
2. **PR #344 hat `mergeable=CONFLICTING` gemeldet** — Ursache war allein diese
   Übergabedatei, jetzt gemergt und aufgelöst. Nach dem Push neu prüfen.

## Files modified

Siehe PR #344 — 13 Dateien. Die drei, die zählen, stehen oben in der Tabelle.
Dazu `scripts/firebase-config{,.logic}.ts`: die Herkunftsangabe sagte fest
„Umgebung dev", und der Release-Bau ruft jetzt auch mit `prod`.

## Next session: start here

**Der Workflow ist gebaut, aber noch nie gelaufen.** Erste Handlung: nach dem
Merge von #344 einmal `workflow_dispatch` auf `android-release` auslösen und
zusehen. Alles davor ist lokal belegt, die Runner-Seite nicht — offen sind dort
genau drei Annahmen: dass `android-actions/setup-android` die Build-Tools
mitbringt, die `apksigner` findet; dass `jarsigner` aus `setup-java` im PATH
steht; und dass `pnpm exec cap sync android` auf dem Runner dieselben fünf
Plugins verdrahtet wie lokal.

Danach **`versionCode`** — ohne es lässt sich das Artefakt genau einmal zu Play
hochladen.

> ⚠ **Java-Falle, am 04.09. eingetreten:** Android Studios mitgelieferte JBR ist
> Java **25**, Gradle 8.14.3 bricht daran mit `Unsupported class file major
> version 69` ab. Lokal `JAVA_HOME=/opt/homebrew/opt/openjdk@21` setzen;
> `/usr/bin/keytool` ohne JAVA_HOME ist nur ein Stub.

## Open questions

- **Geschütztes GitHub-Environment für `android-release`.** Beide Auslöser bauen
  den Ref, auf dem sie stehen — wer ein Tag setzen kann, führt Code mit Zugriff
  auf die prod-Geheimnisse aus. Keine **neue** Fläche (`deploy.yml` trägt
  denselben Token), aber die Stelle, an der sie sich verengen ließe. Ist eine
  Repository-Einstellung, kein Diff.
- **`curl | sudo bash` für die Infisical-CLI** bleibt ungepinnt — bestehende
  Praxis in `deploy.yml`, offener Punkt AGE-495 Audit 8.6. Ein Diff, der das nur
  im neuen Workflow löst, erzeugte zwei Wahrheiten.
- **Der Debug-Bau schreibt die vollständige Supabase-Sitzung ins logcat.** Vor
  der Store-Einreichung am **Release**-Bau gegenprüfen. Eigener Vorgang.
- **`use-gespraech.test.tsx` ist CI-flaky** (`hatAeltere`) — rerun genügt.
- **Realtime im Chat** ist weiterhin ungemessen.
- **Bildupload auf iOS** ist ungeprüft. Die Ursache war capgo, nicht Android —
  iOS ist vermutlich genauso betroffen, aber das ist eine Ableitung.
- **B5 Startbildschirm** verlangt Deinstallieren und kostet die Anmeldung —
  zuletzt machen.
