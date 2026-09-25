## Context

`android-release.yml` baut, signiert, weist die Signatur an **beiden** Artefakten
nach (APK per `apksigner`, AAB per `jarsigner` ohne `-strict`, weil ein
Upload-Schlüssel immer selbstsigniert ist) und legt AAB und APK ab. Dort endet
er. Der Spiegel zur iOS-Seite ist seit `53a5577` halb.

**Was es NICHT gibt, und das prägt jede Entscheidung unten:**

| | Stand |
|---|---|
| Google-Entwicklerkonto | vorhanden (Donald, 25.09.) |
| App im Play Store | vorhanden |
| **Service-Konto für die Publishing-API** | **existiert nicht** |
| **JSON-Schlüssel in Infisical** | **existiert nicht** |
| **Geschlossener Testkanal** | **noch nicht angelegt** |

Bei iOS konnte ich `altool` lokal mit erfundenen Werten aufrufen und an der
Fehlermeldung ablesen, dass `--p8-file-path` greift. **Hier ist nichts
messbar.** Die Publishing-API verlangt ein echtes Service-Konto, eine echte
App und einen echten Kanal.

## Goals / Non-Goals

**Goals:**

- Ein getaggter Lauf lädt das AAB in den Kanal `internal`.
- Ein Handstart bleibt gefahrlos, auch auf eine Tag-Referenz gerichtet.
- Fehlt der Schlüssel, bricht der Lauf **laut** ab.
- Der Signierschlüssel bleibt dort, wo er ist — der Upload braucht ihn nicht.

**Non-Goals:**

- **Das erste AAB.** Das geht von Hand (Donald, 25.09.). Erst dabei entstehen
  Kanal und Tester-Liste.
- **Staged Rollout, `whatsNew`-Texte, Mehrsprachigkeit.** Für einen
  geschlossenen Test ohne Nutzen.
- **Die Testpflicht selbst** (12 Tester, 14 Tage). Das ist Play-Konsole, nicht CI.

## Decisions

### 1. Fremde Action statt eigenem API-Tanz

Die Publishing-API ist kein einzelner Aufruf: `edits.insert` → `bundles.upload`
→ `tracks.update` → `edits.commit`, jeder Schritt mit eigener Fehlerbehandlung.
Selbst geschrieben wären das ~60 Zeilen, die ich **nicht ausführen kann** — kein
Service-Konto, keine App, kein Kanal.

Deshalb `r0adkll/upload-google-play`, auf
`e738b9dd8f2476ea806d921b64aacd24f34515a5` (v1.1.5) gepinnt.

**Der Preis ist benannt, und der SHA-Pin deckt ihn nur halb.** Eine fremde
Action sieht den Service-Konto-Schlüssel. Ein Pin verhindert, dass sich der Code
unter uns *ändert* — er sagt **nichts** darüber, ob der gepinnte Code
vertrauenswürdig ist. Diese Unterscheidung stammt aus dem Plan-Review und wird
hier nicht weggeredet.

Was den Rest trägt, ist nicht der Pin, sondern der **Schadensumfang**: Das
Service-Konto bekommt Zugriff auf genau diese App und genau die Rolle, die ein
Release braucht. Es ist rotierbar — anders als der Keystore, dessen Verlust
teurer wäre und der im selben Job liegt, bereits heute, neben drei anderen
fremden Actions (`pnpm/action-setup`, `android-actions/setup-android`,
`actions/setup-java`).

**Wer das Vertrauen ausspricht:** Donald, am 25.09., nach Vorlage der
Alternative. Der Plan-Review schlug Workload Identity Federation vor — keine
langlebigen Schlüssel, dafür ein Identity-Pool in der Google Cloud und eine
Vertrauensbeziehung zu GitHub. **Verworfen wegen des Einrichtungsaufwands**,
bewusst und mit bekanntem Preis.

*Verworfen:* `fastlane supply` — zieht eine Ruby-Werkzeugkette in einen Job, der
heute keine hat. *Verworfen:* eigener API-Aufruf — mehr Code, den niemand
erproben kann, und die Fehlerbehandlung der Action ist ihr eigentlicher Wert.

### 2. Laut scheitern, nicht still überspringen

Der Schritt davor prüft `PLAY_SERVICE_ACCOUNT_JSON` mit derselben Form, die die
iOS-Seite für den ASC-Schlüssel benutzt:

```
: "${PLAY_SERVICE_ACCOUNT_JSON:?fehlt in Infisical prod (AGE-907, Play-Upload)}"
```

**Und er legt ihn als DATEI unter `$RUNNER_TEMP` ab, nicht in die Umgebung.**
Der erste Entwurf wollte ihn nach `$GITHUB_ENV` schreiben; der Plan-Review hat
zwei Gründe genannt, warum das falsch ist, und beide stimmen:

1. **Roh-JSON enthält Zeilenumbrüche.** `$GITHUB_ENV` braucht dafür die
   Begrenzer-Form; ein naives `echo K=V >> $GITHUB_ENV` bricht.
2. **Ein Wert aus Infisical ist nicht automatisch GitHub-maskiert.** Die
   Maskierung gilt für Repository-Secrets, nicht für alles, was ein Schritt
   holt. Eine Prüfung „kommt kein `echo` vor" belegt Log-Sicherheit also nicht.

Die Datei löst beides und ist zugleich **das Muster, das nebenan schon läuft**:
`ios-release.yml` legt den ASC-Schlüssel genauso unter `$RUNNER_TEMP` ab, aus
demselben Grund (außerhalb des Arbeitsbaums eines öffentlichen Repos). Die
Action nimmt dafür `serviceAccountJson` — den **Pfad** — statt
`serviceAccountJsonPlainText`.

*Verworfen: `if` auf das Secret* — ein Tag-Lauf wäre dann grün, ohne etwas
ausgeliefert zu haben. Das ist die Sorte Fehlschlag, die dieses Repo an anderer
Stelle ausdrücklich bekämpft: ein grüner Lauf, der nichts belegt.

Konsequenz, die ausgesprochen gehört: **Bis der Schlüssel in Infisical liegt,
ist jedes `android-v*`-Tag ein roter Lauf.** Das ist gewollt. Ein Handstart
bleibt davon unberührt und grün.

### 3. Kanal `internal` — entschieden, nicht geraten (Donald, 25.09.)

Der erste Entwurf setzte `internal` als **Vermutung** und wollte sie im Wächter
pinnen. Der Plan-Review hat das zu Recht als HIGH markiert: eine noch offene
Entscheidung in einen Test zu nageln, härtet die Vermutung statt sie zu klären.

**Donald hat sie am 25.09. entschieden: `internal` zuerst.** Damit ist der Wert
eine Festlegung, und ein Wächter darf sie pinnen.

Der Preis ist bekannt und ausgesprochen: **`internal` zahlt NICHT auf die
Testpflicht ein** (12 Tester, 14 Tage) — dafür braucht es einen geschlossenen
Test. `internal` ist der Kanal, der belegt, dass Authentifizierung, Upload und
Rechte stimmen, **ohne** in den Kanal zu schreiben, an dem die Frist hängt. Der
Wechsel auf den geschlossenen Kanal ist danach eine Zeile plus eine Zusage.

### 3b. `releaseFiles` (Plural), `track` (Einzahl) — am gepinnten Stand geprüft

Der Plan-Review nannte **beide** Eingaben veraltet. Am README der gepinnten
Fassung `e738b9dd…` nachgesehen, und dort stimmt nur die Hälfte:

- `releaseFile` steht **durchgestrichen**: „Please switch to using `releaseFiles`
  as this will be removed in the future." → Plural nehmen.
- `track` steht **unverändert in den eigenen Beispielen** der Action
  (`track: production`, `track: internal`). `tracks` ist die Mehrfach-Variante,
  keine Ablösung. → Einzahl bleibt.

### 4. Nur das AAB, nicht das APK

Play nimmt für neue Apps ausschließlich AAB. Das APK bleibt Artefakt für
Gerätetests (`adb install`) und geht nicht an den Store.

## Risks / Trade-offs

**Nichts davon ist gemessen** → Anders als bei iOS gibt es keine lokale Probe.
*Minderung:* keine, die ehrlich wäre. Der erste Lauf ist die erste Erprobung,
und er wird wahrscheinlich mindestens einmal rot.

**`internal` zahlt nicht auf die Testpflicht ein** → Der geschlossene Test (12
Tester, 14 Tage) braucht einen anderen Kanal. *Minderung:* keine nötig, das ist
die Entscheidung; der Wechsel ist eine Zeile plus eine Zusage. **Aber es darf
niemand glauben, die Frist liefe schon.**

**Die fremde Action sieht den Schlüssel** → Der SHA-Pin deckt nur die
Unveränderlichkeit, nicht die Vertrauenswürdigkeit (Plan-Review). Was trägt, ist
der begrenzte Schadensumfang und die Rotierbarkeit des Service-Kontos.

**`versionCode` aus der Lauf-Nummer** → Play lehnt einen doppelten
`versionCode` ab, wie Apple eine doppelte Build-Nummer. Ein Re-Run desselben
Tags scheitert. *Minderung:* dieselbe Regel wie auf der iOS-Seite, jetzt im Kopf
benannt.

## Migration Plan

Keine. Rückweg ist das Entfernen der zwei Schritte.

## Open Questions

- **Wie heißt der geschlossene Kanal?** Offen, entscheidet sich beim ersten
  Handupload. Betrifft diesen Change erst, wenn von `internal` gewechselt wird.
- **Trägt das Service-Konto die Rolle „Release-Manager"?** Ohne sie scheitert
  `tracks.update` mit einem Rechtefehler, nicht mit einem Authentifizierungsfehler
  — die beiden sind im Log leicht zu verwechseln.
- **Läuft die App-Signatur über Play App Signing?** Wenn ja, ist unser Keystore
  der *Upload*-Schlüssel (so steht es in `native-shell`), und das AAB ist
  korrekt signiert. Wenn nein, lehnt Play es ab.
