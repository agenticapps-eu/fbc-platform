# Session Handoff — 2026-09-04 (AGE-642 B3: Android-Signierung und Release-Workflow)

> ## ⚠ ZUERST — Scope dieser Übergabe
>
> **1. Sie führt nur AGE-642 (M2, Capacitor-Hülle), Block B3.** Die Datei ist
> für alle parallelen Sitzungen dieselbe und kollidiert bei jedem Rebase —
> **nicht zusammenführen**, überschreiben.
>
> **2. Vorher stand hier AGE-605** (Anmeldungen/Kapazität, PR #342). Vollständig
> in `git show e1dd52a:session-handoff.md`. Eine Zeile daraus war eine
> **Sperre für AGE-642** — der blockierte Deploy von `main`. Sie ist seit dem
> Abend des 04.09. **aufgehoben**; der Abschnitt „Von AGE-605 übernommen" unten
> trägt die Auflösung samt Laufnummern und wird nicht gelöscht, damit niemand
> die alte Warnung aus einer früheren Fassung wieder aufgreift. **Es ist von
> dort nichts mehr zu tun.**
>
> **3. Die Gerätebelege im Detail stehen NICHT hier**, sondern in
> `openspec/changes/capacitor-huelle/uebergabe-android.md` und in `tasks.md`,
> Phase E. Diese Datei bleibt der Überblick.

## Von AGE-605 übernommen — ⚠ ERLEDIGT am 04.09. abends, nicht mehr gültig

Hier stand: *„Der Deploy von `main` ist blockiert, bis die PROD-Migration
läuft."* Das galt bis 19:32 und ist **aufgehoben**. Der Satz bleibt als
Korrektur stehen, damit niemand ihn aus einer älteren Fassung wieder aufgreift.

Abgelaufen in dieser Reihenfolge, alles auf Commit `3d20063`:

1. **`migrate-prod` (Lauf 33911148557), grün** — die AGE-605-Sitzung hat ihn
   angestossen. `Applying migration 20260904160000_anmeldung_nicht_an_den_rpcs_
   vorbei.sql` · `OK — 123 Migrationen, Historie abweichungsfrei` · Objekt-
   Drift-Scan `OK — keine Objekt-Abweichung auf prod`.
2. **`Deploy` (Lauf 33904874723) nach Re-Run, alle vier Jobs grün** —
   `drift-gate`, `migrate-dev`, `functions`, `deploy`.

**An der Kante gegengemessen, nicht am Job-Status:** `app.effbeezee.com` liefert
`assets/index-GEx8cTIJ.js` als `application/javascript`; die Negativkontrolle auf
einen erfundenen Pfad liefert `text/html`, der SPA-Fallback ist damit
ausgeschlossen. Das OTA-Bündel `0.0.0+3d20063d3913` steht auf PROD (19:32:08Z).

> **Ein Verdacht, der geprüft und ausgeräumt ist** — damit ihn niemand neu
> aufmacht: alle 49 Bündel tragen dieselbe Semver `0.0.0`, und eines heisst
> `0.0.0+feedbeef` (Testbündel vom 02.09.). Würde die Auswahl über die
> Versions-Zeichenkette tiebreaken, gewänne `feedbeef` lexikalisch. Tut sie
> nicht: `ota_buendel_neuestes` ordnet `created_at desc, version desc`, **Zeit
> zuerst**. An der Funktion gemessen: ein Gerät auf `builtin` bekommt
> `0.0.0+3d20063d3913`, eines auf `feedbeef` ebenfalls, und eines, das schon
> darauf läuft, bekommt nichts.

**AGE-605 ist vollständig abgeschlossen** — gemergt (#342, #343), archiviert,
auf PROD angewandt und dort rein lesend gegengemessen: beide Trigger aktiv,
`…_exklusiv` INVOKER und `…_kapazitaet` DEFINER wie entworfen, `authenticated`
hält nur noch SELECT, Spalten-UPDATE nur `status`/`rating`, Policy UPDATE-only,
EXECUTE auf beiden Wächtern entzogen, 0 überbuchte Events. Linear steht auf Done.

Die vollständige AGE-605-Übergabe — auch der Fund, der jene Sitzung getragen hat
(Schicht 1 war als `SECURITY INVOKER`-Funktion fail-**OPEN**, weil sie unter der
RLS des Schreibenden zählte) — steht in `git show e1dd52a:session-handoff.md` und
dauerhaft in
`openspec/changes/archive/2026-09-04-anmeldung-nicht-an-den-rpcs-vorbei/`.

**Was von AGE-605 offen bleibt, liegt in `AGE-698`** (Backlog, drei
Bestands-Befunde, keiner durch AGE-605 entstanden): der Gastgeber kann
`capacity` unter die Belegung senken · Mitglieder unter `exchange` können sich
anmelden, aber nicht direkt absagen (stammt aus AGE-448) · ein zweiter
`register_for_event`-Aufruf degradiert ein bereits registriertes Mitglied auf
die Warteliste, weil der RPC die eigene Zeile mitzählt.

> **Herkunft dieser drei Absätze:** aus PR #346 der AGE-605-Sitzung, die
> denselben Abschnitt korrigieren wollte und dabei zwei Minuten nach dem Merge
> von #345 von einem älteren Stand gezweigt hatte. Inhalt hierher übernommen,
> #346 ungemergt geschlossen — nicht verloren, nur an einer Stelle statt zweien.

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
2. ~~PR #344 hat `mergeable=CONFLICTING` gemeldet~~ — erledigt, gemergt als
   `3d20063`, CI grün, auf PROD ausgerollt.

## Files modified

Siehe PR #344 — 13 Dateien. Die drei, die zählen, stehen oben in der Tabelle.
Dazu `scripts/firebase-config{,.logic}.ts`: die Herkunftsangabe sagte fest
„Umgebung dev", und der Release-Bau ruft jetzt auch mit `prod`.

## Next session: start here

**Der Workflow ist gebaut, aber noch nie gelaufen.** Erste Handlung: einmal
`workflow_dispatch` auf `android-release` auslösen und zusehen (#344 ist
gemergt). Alles davor ist lokal belegt, die Runner-Seite nicht — offen sind dort
genau drei Annahmen: dass `android-actions/setup-android` die Build-Tools
mitbringt, die `apksigner` findet; dass `jarsigner` aus `setup-java` im PATH
steht; und dass `pnpm exec cap sync android` auf dem Runner dieselben fünf
Plugins verdrahtet wie lokal.

Danach **`versionCode`** — ohne es lässt sich das Artefakt genau einmal zu Play
hochladen.

> ⚠ **Squash-Falle, am 04.09. zweimal eingetreten:** PRs aus diesem Branch
> werden **squash**-gemergt. Der Squash-Commit ist damit kein Vorfahr des
> Branches, git sieht alle Dateien des PRs als „beidseitig geändert", und der
> NÄCHSTE PR meldet `CONFLICTING`, obwohl die Bäume identisch sind. Heilmittel
> nach jedem Merge: `git diff origin/main HEAD` prüfen — ist er leer, gefahrlos
> `git reset --hard origin/main`. Nicht mergen, das doppelt nur die Historie.

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
