# Tasks — dieselbe Anwendung, in einer nativen Hülle (AGE-642)

Phasiert nach dem, was sie **voraussetzen**. Phase A braucht nichts als dieses
Repository und läuft sofort. Ab Phase B braucht es Xcode, Android Studio und
Konten — siehe „Voraussetzungen" im Proposal. Die Reihenfolge ist bewusst: das
Riskanteste zuerst, solange es noch im Browser prüfbar ist.

## Phase A — im Browser prüfbar, ohne eine Zeile nativen Codes

### A1. Der Sitzungsspeicher zieht um

Die einzige Änderung an bestehendem Code, die schiefgehen kann. Sie kommt
allein und zuerst.

- [x] `@capacitor/core` und `@capacitor/preferences` als Abhängigkeit. Beide
      sind reine npm-Pakete; für diesen Schritt ist kein natives SDK nötig.
- [x] **RED**: Test — im Web geht `auth.storage` auf `window.localStorage`,
      **mit demselben `storageKey`** wie bisher. Der Test liest den Schlüssel,
      unter dem eine bestehende Sitzung liegt, und verlangt, dass der Client sie
      danach findet. *Positivkontrolle:* mit einem geänderten Schlüssel muss
      derselbe Test rot werden — sonst prüft er nur, dass irgendetwas liest.
- [x] **RED**: Test — nativ liest und schreibt der Adapter über `Preferences`,
      und `getItem` gibt den Wert zurück, den `setItem` gelegt hat.
- [x] **RED**: Test — `removeItem` entfernt den Eintrag **tatsächlich**. Ein
      Adapter, dessen Löschen ins Leere läuft, ergäbe ein Konto, das sich nicht
      abmelden lässt.
- [x] **`auth.storageKey` auf den heute geltenden Wert festnageln.** Bisher ist
      er der Default der Bibliothek; ein Minor-Upgrade von
      `@supabase/supabase-js`, das das Format ändert, meldete alle Web-Mitglieder
      ab. Der Test darf den Schlüssel **nicht gegen sich selbst** prüfen — er
      trägt den erwarteten Wert als Literal, sonst wandern beide Seiten
      gemeinsam.
- [x] Weiche in `src/lib/supabase.ts`: `Capacitor.isNativePlatform()` entscheidet.
      Im Web-Zweig **kein** Wrapper — `localStorage` unverändert durchreichen.
- [x] **Beleg (Browser, nicht jsdom):** vor dem Umbau anmelden, umbauen, Seite
      neu laden, weiterhin angemeldet. Das ist die Abnahme aus dem Issue, und
      sie lässt sich in jsdom nicht führen.

      **Gefahren am 27.08. gegen den lokalen Stack**, mit dem *echten*
      Reihenfolgen-Aufbau statt einer nachgestellten Sitzung:

      1. `src/lib/supabase.ts` auf den Stand **vor** A1 zurückgesetzt, Vite
         gestartet, im Browser über den Client angemeldet. Geschrieben wurde
         `sb-127-auth-token` — der Schlüssel, den die Bibliothek selbst bildet.
      2. Die neue Fassung eingespielt, Seite neu geladen.
      3. Ergebnis: derselbe Schlüssel noch da, `sitzungsprobe@local.test` in der
         Sitzung, **keine** Umleitung auf `/login`, und der Client stellt
         REST-Anfragen. Die Aktivierungswand erscheint — richtig so: das Konto
         ist ein reiner GoTrue-Nutzer ohne `activated_at`, und diese Wand sieht
         nur, wer **angemeldet** ist. Sie ist damit selbst ein Beleg.

      Nebenbefund, nicht Teil dieses Changes: das Anmeldeformular liess sich
      über gesetzte Feldwerte **nicht** absenden — es ging keine einzige
      `/auth/v1/token`-Anfrage raus, ohne dass eine Fehlermeldung erschien. Ob
      das nur an der Automatisierung liegt oder auch einen Passwortmanager
      betrifft, ist offen. **Eigene Aufgabe wert, hier bewusst nicht verfolgt.**
- [ ] **Beleg (Gerät), sobald Phase B steht — nicht erst in Phase E.** Alle drei
      RED-Tests oben laufen in jsdom gegen eine **Attrappe** von `Preferences`.
      Ein Adapter, dessen `removeItem` auf dem Gerät ins Leere läuft, wäre dort
      grün und hier kaputt — genau die Sorte Vakuum-Test, die dieses Repo
      wiederholt getroffen hat. Sobald eine Schale startet: anmelden, App
      beenden, neu starten (angemeldet), abmelden, neu starten (Anmeldung).
      Diese Zeile ist der eigentliche Beweis für A1; die drei jsdom-Tests
      sichern nur die Verdrahtung.

### A2. Die Routen werden geteilt

- [x] Grundlinie festhalten: `pnpm build`, Größe des Eintrittsbündels roh und
      gzip notieren. Gemessen am 27.08. auf `0dd4b8b`: **1.181,77 kB / 347,78 kB**.
- [x] **RED**: Test — `navItems` trägt für jede Route weiterhin `path`, `label`
      und `section`, und die Sidebar rendert unverändert. Der Umbau berührt
      `Component`; die Zusage ist, dass er sonst nichts berührt.
      **Gemessen 01.09., an Mutationen statt am Vorkommen der Namen** — 31 Läufe
      der vollen Suite (210 Dateien, 2.327 Tests, 15 s je Lauf), jede Mutation
      einzeln, das Original danach jedes Mal wieder grün:
      * **`path` je Route: war gedeckt.** `/aktivitaet` verstellt → 11 Dateien
        rot; `/chat` → 2; `/profil/bearbeiten` → 1. Feld ganz weg: `tsc` fällt.
      * **`section` je Route: war gedeckt.** Drei Mutationen, 1 bis 4 Dateien
        rot. Feld ganz weg: `tsc` fällt, plus `nav.test.ts`.
      * **Sidebar unverändert: war gedeckt.** In `AppShell.tsx` die Beschriftung
        gegen den Pfad getauscht → 5 Dateien rot; den Abschnitts-Filter
        entfernt → 7. Die Zusage „die Sidebar liest `path`, `label`, `section`,
        nicht `Component`" trägt also.
      * **`label` war die Lücke, und nur für die neun `sub`-Einträge.** Drei
        Umbenennungen liefen **still** durch — typecheck grün, 210/210 grün:
        „Nachrichten" zurück auf „Chat" (die Änderung, die AGE-583 mit Begründung
        vorgenommen hat), „Neu in der App" auf „Neues", `/profil/bearbeiten` auf
        „Profil". Ein **leeres** Label auf `/chat` ebenso: ein Link ohne
        zugänglichen Namen, von nichts bemerkt. Feld ganz weg → nur `tsc`.
      * **Und der schwerste: `/neues` ganz entfernt, samt `lazy()`-Import.**
        typecheck grün, 210/210 grün. Die Route aus AGE-631 wäre verschwunden,
        ohne dass eine Zusage darauf zeigte. (Ohne den Import wäre es
        `noUnusedLocals` aufgefallen — ein Zufallstreffer, keine Zusage.)
      * **Geschlossen:** ein vollständiges Routen-Verzeichnis in
        `src/config/nav.test.ts` (Pfad + Beschriftung, alle 14, nach Pfad
        sortiert verglichen — die verbindliche Reihenfolge steht schon je
        Abschnitt darüber). **Gegenprobe: alle sechs vorher stillen Mutationen
        röten jetzt**, das Original bleibt grün. Preis, ehrlich benannt: eine
        gewollte Umbenennung kostet eine Zeile in der Liste.
- [x] `Component` in `src/config/nav.ts` auf `lazy()` umstellen; die statischen
      Seitenimporte in `src/App.tsx` ebenso — **außer** `HomeRedirect` und
      `LoginPage`.
- [x] Ein `Suspense`-Rahmen um den Routen-Block, Fallback ohne Spinner (nur die
      Höhe des Inhaltsbereichs).
- [x] Admin-Seiten mit umstellen. Das kehrt den Kommentar in `App.tsx:155-161`
      um — **der Kommentar wird mitgeändert**, samt Zahl (61,2 kB
      `RELEASE_EINTRAEGE` über `AdminNeuigkeitenPage.tsx:7`). Ein Kommentar, der
      das Gegenteil des Codes behauptet, ist schlimmer als keiner.
- [x] Bestehende Routen-Tests auf asynchrones Rendern anpassen, **ohne eine
      einzige Assertion zu lockern**. Das ist Arbeit, keine Nebenwirkung: nach
      `lazy()` findet ein synchrones `getBy*` nichts, bis der Chunk aufgelöst
      ist, und ein Teil der 174 Testdateien rendert Routen heute synchron. Wer
      hier „läuft unverändert durch" hinschreibt, hat die Aufgabe nicht
      geplant, sondern gehofft. Die Anpassung ist mechanisch (`findBy*` statt
      `getBy*`), die Zusagen der Tests bleiben Wort für Wort dieselben.
- [x] **Beleg 1 (Zahl):** dieselbe Messung nach dem Umbau, mit demselben Befehl.
      Ziel: unter **1.024 kB** roh. **Erreicht: 600,53 kB** (Eintrittsbündel).

      Die ehrlichere Zahl steht daneben, und sie ist die, die zählt: die
      **Erstlast** — Eintritt plus alles, was `index.html` daneben vorlädt, plus
      CSS. Eine eigene Datei ist nicht dasselbe wie „wird nicht geladen".

      | | vorher | nachher |
      | --- | ---: | ---: |
      | Eintrittsbündel roh | 1.189,90 kB | **600,53 kB** |
      | Erstlast roh (mit CSS) | 1.261,69 kB | **927,26 kB** |
      | Erstlast gzip | 363,08 kB | **269,95 kB** |
      | Dateien in der Erstlast | 2 | 11 |

      −26 % über die Leitung. Der grösste einzelne Posten, der wanderte, ist
      `AdminNeuigkeitenPage` mit 70,66 kB (davon 61,2 kB erzeugte
      Änderungsliste) — die Seite, deren Kommentar behauptete, sie sei „klein".

      **Nicht** gewandert ist der Supabase-Client: 202,89 kB, jetzt in einer
      eigenen Datei, die trotzdem vorgeladen wird. Wer nur auf die Grösse des
      Eintrittsbündels sieht, hält das für einen Gewinn. Es ist keiner.

      **Nachgemessen 02.09. am LIVE ausgelieferten Artefakt — die Zahlen oben
      sind nicht die, die ankommen.** Sie entstanden mit `pnpm build` ohne
      Secrets, und zwei Variablen ändern das Bündel erheblich:

      * **`VITE_SENTRY_DSN` fehlt → das Sentry-SDK fällt heraus.** `dsn` wird
        zur Bauzeit durch `undefined` ersetzt, `if (dsn)` fällt weg, und mit ihm
        `replayIntegration` und das Browser-Tracing (`instrument.ts:20-23`).
        Gegenprobe am selben Baum, heute, nur der DSN verstellt: **644,83 kB
        ohne, 813,12 kB mit** — 168,29 kB Unterschied im Eintrittsbündel. Und
        die Zerlegung selbst ändert sich mit: **10 Dateien in der Erstlast ohne,
        22 mit**.
      * **Die Supabase-Variablen fehlen → der Client schrumpft auf 9,12 kB**
        statt 209,99 kB. Ein Vergleich Datei für Datei zwischen dem Bau mit DSN
        und dem Live-Stand zeigt genau **einen** Unterschied, und das ist dieser
        (+200,87 kB); alles andere ist byte-gleich.

      Der Deploy baut mit `infisical run --env=prod` und hat beides. Gemessen am
      ausgelieferten Bündel (`app.effbeezee.com`, `2c6e86a`, 02.09.):

      | | notiert (ohne Secrets) | **live ausgeliefert** |
      | --- | ---: | ---: |
      | Eintrittsbündel roh | 600,53 kB | **813,32 kB** |
      | Erstlast roh (mit CSS) | 927,26 kB | **1.254,40 kB** |
      | Erstlast gzip | 269,95 kB | **378,22 kB** |
      | Dateien in der Erstlast | 11 | **22** |

      **Was davon berührt die Zusage: nichts.** Die Spec verlangt das
      Eintrittsbündel unter 1.024 kB roh — 813,32 kB, Abstand 210,68 kB. Der
      Abstand ist aber ein Fünftel und nicht die zwei Fünftel, die 600,53 kB
      nahelegen, und er schrumpft schon: derselbe Befehl, der am 27.08. 600,53
      kB ergab, ergibt heute 644,83 kB.

      **Was NICHT nachgemessen ist: die −26 %.** Die Grundlinie entstand
      ebenfalls ohne Secrets; eine Grundlinie mit ihnen gibt es nicht, und
      `0dd4b8b` nachzubauen hilft nicht — `package.json` und die Sperrdatei sind
      seither stark gewandert, ein Bau dort misst auch andere Abhängigkeiten.
      Die beiden notierten Zahlen sind also untereinander vergleichbar, nur
      eben nicht mit dem, was ausgeliefert wird.

      **Der Wächter trägt auch die echte Form:** gegen den Bau mit DSN — 21
      JS-Dateien in der Erstlast statt 9 — meldet
      `scripts/entry-chunk-guard.ts` weiterhin „keine unerlaubte Seite darin".
      Das war nicht selbstverständlich: im CI-Job `verify` läuft er ohne
      Secrets und sieht damit eine andere Zerlegung als die ausgelieferte.
- [x] **Beleg 2 (Struktur) — als Skript, nicht als Behauptung.** Die Spec
      verspricht „strukturell geprüft"; eine Messung von Hand erfüllt das genau
      einmal und ist bei der nächsten Abhängigkeit wertlos. Also ein Skript, das
      die Source-Map des Eintrittsbündels seinen Quellmodulen zuordnet und
      gegen eine **Erlaubnisliste** prüft: Hülle, Wachen, `HomeRedirect`,
      `HomePage`, `LoginPage`. Alles andere aus `src/pages/` im Eintritt macht
      den Lauf rot. Im CI, neben den übrigen Wächtern.

      Gebaut als `scripts/entry-chunk-guard{,.logic,.logic.test}.ts`, im Job
      `verify` hinter `pnpm build`. **Drei Dinge, die er über die erste Fassung
      hinaus kann, und jedes davon hat einen Grund:**

      1. Er liest die **ganze Erstlast**, nicht nur das Eintrittsbündel. Die
         erste Fassung sah allein `index-*.js` — und war damit blind für die
         neun Dateien, die `index.html` daneben vorlädt. Eine Seite, die dorthin
         rutscht, wäre unbemerkt zurück im Erststart gewesen.
      2. Er bricht ab, wenn eine **Source-Map fehlt**. Ohne sie wäre er blind
         und trotzdem grün.
      3. Er bricht ab, wenn die Erstlast nicht einmal `src/App.tsx` enthält —
         ein unvollständiger Bau darf nicht als „alles sauber" durchgehen.

      **Positivkontrolle gefahren:** mit geleerter Erlaubnisliste meldet er
      genau die drei erlaubten Seiten und endet mit 1. Vor dem Umbau meldete er
      **28**. Ein Wächter, der nie rot wird, ist von einem, der prüft, nicht zu
      unterscheiden.

      Er hat sich dabei selbst bewährt: `ActivationScreen.tsx` stand in keiner
      Planung und liegt trotzdem zu Recht im Erststart — `ActivationGate`
      umschliesst die ganze Hülle und rendert ihn für jedes unbestätigte Konto.
      Gefunden hat das der Wächter, nicht ich.
- [x] **Nicht geändert, mit Begründung festgehalten:** `/` zeigt einem
      angemeldeten Mitglied **nicht** den Feed, sondern `HomePage` —
      `HomeRedirect.tsx:60-67` gibt sie in jedem Zweig zurück, der einzige
      andere Ausgang ist `/willkommen`. Der Feed liegt auf `/aktivitaet` und
      darf lazy sein. Steht hier, weil die Annahme naheliegt und einmal zu
      einem Befund geführt hat.

## Phase B — das Grundgerüst · braucht Xcode und Android Studio

### B1. Capacitor und die beiden Projekte

- [x] `@capacitor/ios`, `@capacitor/android`, `capacitor.config.ts`.
      `webDir: "dist"`, App-ID und Anzeigename festlegen.

      **Die App-ID war keine offene Wahl mehr.** `com.effbeezee.app` liegt
      bereits als `APNS_BUNDLE_ID` in den Supabase-Secrets (am 28.08. per
      SHA-256 gegen Infisical abgeglichen, `docs/secrets.md`) und ist damit das
      `apns-topic`, gegen das Apple jedes Gerätetoken prüft. Ein abweichender
      Wert hier bräche den Push aus AGE-641 — und zwar erst am echten Gerät.
      Anzeigename `eff.bee.zee`, die Marke aus `index.html` und dem
      Design-System. `webDir: "dist"` ist Vites Standard; `vite.config.ts`
      setzt kein `outDir`.
- [x] `npx cap add ios` und `npx cap add android`; beide Ordner versionieren.

      **Capacitor 8 baut iOS über Swift Package Manager**, nicht über
      CocoaPods: es entsteht `ios/App/CapApp-SPM/Package.swift`, kein
      `Podfile`. Die `pod`-Zeile in den Voraussetzungen ist damit gegenstandslos.
      `cap add android` meldete beim ersten Lauf `Unable to locate a Java
      Runtime` — das mitgelieferte JBR von Android Studio ist **25**, und
      Gradle 8.14.3 reicht nur bis Java 24. Gebaut wird deshalb mit
      `JAVA_HOME=/opt/homebrew/opt/openjdk@21`.
- [x] `.gitignore`: Keystore (`*.keystore`, `*.jks`), `key.properties`,
      `google-services.json`, `GoogleService-Info.plist`, `*.p8`,
      `ios/App/Pods/`, `android/.gradle/`, `*/build/`, `DerivedData/`.

      **Gemessen statt abgeschrieben:** `git check-ignore -v` über alle
      dreizehn Pfade zeigte, dass genau **ein** Muster fehlte —
      `key.properties`. Alles andere deckt entweder die Wurzel-`.gitignore` aus
      AGE-641 ab (`*.jks`, `*.keystore`, `*.p8`, `google-services.json`,
      `GoogleService-Info.plist`) oder Capacitors eigene `android/.gitignore`
      bzw. `ios/.gitignore` (`.gradle/`, `build/`, `local.properties`,
      `App/Pods`, `DerivedData`, die kopierten Web-Assets). `*/build/` war
      deshalb nicht nötig. **Falle für später:** Capacitors
      `android/.gitignore` führt `*.jks`/`*.keystore` **auskommentiert** — die
      Wurzelzeilen greifen trotzdem, aber wer nur dort nachsieht, liest das
      Gegenteil.
- [x] **`Info.plist`: `NSCameraUsageDescription` und
      `NSPhotoLibraryUsageDescription`, deutsch formuliert.** Ohne sie stürzt
      iOS beim ersten Kameraaufruf ab — zur **Laufzeit**, nicht erst in der
      Store-Prüfung. Steht hier und nicht in C3, weil die Schale sie schon beim
      Anlegen mitbekommen soll.

      Formuliert gegen die vier Stellen, an denen die App heute Bilder
      hochlädt (Profilbild, Titelbild, Feed-Beitrag, Event-Titelbild), und in
      der Anrede der App (`du`). **Beleg an der gebauten App, nicht an der
      Quelle:** `xcodebuild … -sdk iphonesimulator` → `BUILD SUCCEEDED`, danach
      `plutil -extract NSCameraUsageDescription raw` auf der `Info.plist`
      *innerhalb* von `App.app` — Text mit intakten Umlauten,
      `CFBundleIdentifier` = `com.effbeezee.app`.
- [x] **Android:** Kamera-Berechtigung im `AndroidManifest.xml` deklarieren und
      die Laufzeit-Abfrage behandeln. Dieselbe Falle, andere Plattform.

      **Die Laufzeit-Abfrage muss dieser Code nicht selbst führen.**
      `BridgeWebChromeClient.onShowFileChooser` ruft `permissionLauncher.launch`
      und bricht den Datei-Dialog sauber ab, wenn abgelehnt wird
      (`BridgeWebChromeClient.java:285-300`).

      **Aber der Zweig greift heute nie.** Er verlangt `isCaptureEnabled()`
      **und** exakt `image/*` in `accept` (Zeile 281-284). Die sechs
      Upload-Felder dieser App führen weder `capture` noch `image/*`, sondern
      eine Typenliste — sie landen alle im System-Dateiwähler. Die Deklaration
      ändert also **vorerst nichts am Verhalten**; sie steht hier, damit die
      Hülle vollständig ist. **C3 muss das aufgreifen**, sonst öffnet die
      Kamera nie.

      Dazu `<uses-feature android:name="android.hardware.camera"
      android:required="false" />`: ohne diese Zeile leitet aapt aus der
      Berechtigung eine **Pflicht**-Kamera ab und Play filtert Geräte ohne
      Kamera aus der Auslieferung. **Beleg an der gebauten APK:**
      `aapt2 dump permissions` → `android.permission.CAMERA`,
      `aapt2 dump badging` → `uses-feature-not-required:
      android.hardware.camera`, `targetSdkVersion:'36'`,
      `application-label:'eff.bee.zee'`, `package: com.effbeezee.app`.
- [x] **Die Gates gegen die neuen Bäume abgedichtet.** `android/` und `ios/`
      tragen eine Kopie des gebauten Web-Bündels, und beide Werkzeuge lasen sie
      mit. Gemessen: `pnpm lint` meldete **12048** Fehler, davon **null** aus
      `src/` — 4076 aus `android/app/build`, 3986 aus `android/app/src`, 3986
      aus `ios/App/App`. Ab dem ersten `cap sync` wäre das Gate wertlos gewesen.
      Beide Bäume nach `eslint.config.js` und `.prettierignore`, dieselbe
      Begründung wie beim schon vorhandenen `supabase/.temp` bzw. `dist`.
      Danach: Lint 0 Fehler; `format:check` fällt von 611 auf **280** — und
      280 ist die vorbestehende Grundlinie (`openspec` 197, `src` 50,
      `scripts` 23, `supabase` 6), also fügt dieser Change der
      Formatierungsschuld nichts hinzu. CI fährt ohnehin nur `lint` und
      `typecheck` (`ci.yml:24-25`).

### B2. Der Wächter gegen native Geheimnisse im öffentlichen Repo

- [x] **RED**: Test — der Wächter meldet eine Keystore-Datei, die im
      Arbeitsbaum liegt, und bricht ab. *Negativbefund braucht eine
      Positivkontrolle:* ohne die Datei muss derselbe Lauf grün sein, sonst ist
      ein Wächter, der immer bricht, von einem, der prüft, nicht zu
      unterscheiden.

      **RED gemessen, nicht behauptet:** gegen einen Stub, der `[]` zurückgibt,
      waren **7 von 9** Zusagen in `native-secrets-guard.logic.test.ts` rot —
      und die **2 grünen waren genau die Positivkontrollen** („meldet nichts,
      wenn derselbe Baum den Keystore nicht enthält", „verwechselt harmlose
      Nachbarn nicht"). Nach der Umsetzung 9/9 grün.
- [x] **RED**: Test — er prüft den **Baum**, nicht den Diff: eine Datei, die
      kein aktueller Commit anfasst, wird trotzdem gemeldet.

      Das kann die reine Funktion **nicht** halten — sie bekommt eine Liste
      Pfade und kann gar nicht falsch liegen; woher die Liste kommt, entscheidet
      allein der Runner. Deshalb `native-secrets-guard.cli.test.ts`: ein echtes
      Wegwerf-Repository, Commit 1 bringt den Keystore, Commit 2 fasst etwas
      anderes an. Eine nachgestellte git-Ausgabe hätte nur belegt, dass der Test
      nachstellt, was er prüfen will.

      **Mutations-Gegenprobe** (Runner auf `git diff --name-only HEAD~1 HEAD`
      umgebaut, Datei vorher nach ausserhalb des Repos gesichert): **5 von 6**
      Zusagen wurden rot, überlebt hat **genau** die Positivkontrolle, die grün
      bleiben muss. Danach zurückgespielt, wieder 6/6.
- [x] Wächter schreiben und in `ci.yml` einhängen.

      Aufgeteilt nach dem Muster von `entry-chunk-guard`: `*.logic.ts` (reine
      Regeln), `*.logic.test.ts`, `*.cli.test.ts`, Runner.

      **Der Baum ist zweierlei:** verfolgte Dateien (`git ls-files`) — der
      eingetretene Schaden — und unverfolgte, aber **nicht ignorierte**
      (`--others --exclude-standard`) — was ein einziges `git add .` öffentlich
      machen würde. **Ignorierte bleiben absichtlich aussen vor:** B3 verlangt,
      dass der Keystore lokal und im Signier-Workflow vorliegt, also unter einer
      Ignorierzeile; ein Wächter, der darauf anschlägt, wäre auf jedem Rechner
      rot, und ein immer roter Wächter wird abgeschaltet. Die Gegenprobe dazu
      steht im Test: dieselbe Datei per `git add -f` verfolgt **wird** gemeldet.

      Wie bei `entry-chunk-guard` eine Selbstprüfung gegen den stillen Leerlauf:
      enthält der Baum nicht einmal `package.json`, bricht er mit **2** ab
      statt grün zu sein.

      In `ci.yml` **vor** lint/typecheck/test — ein Fund macht jede weitere
      Minute Rechenzeit sinnlos. Der flache Klon von `actions/checkout` stört
      nicht: dort ist der Arbeitsbaum vollständig, nur die Historie nicht.

      **Rot/grün am echten Repo belegt**, nicht nur im Test: eine angelegte
      `ios/KONTROLLE.mobileprovision` → exit 1 mit Grund und Rotationshinweis,
      nach dem Löschen wieder exit 0 bei 1292 Dateien.
- [x] **Einmaliger Lauf über die Historie** beim Einführen des Wächters. Er
      prüft den Baum und sieht damit nicht, was in einem früheren Commit liegt —
      und genau dieser Fall ist am 23.08. schon einmal eingetreten. Findet der
      Lauf etwas, ist das eine Rotation, kein Löschen: ein Geheimnis in der
      Historie eines öffentlichen Repos gilt als offengelegt.

      **Ergebnis: sauber.** `git rev-list --objects --all` → **1896**
      verschiedene Pfade, durch dieselben Regeln geschickt (kein nachgebautes
      grep), **kein Treffer**. *Positivkontrolle,* weil ein Negativbefund sonst
      nichts belegt: derselbe Lauf mit einem eingeschleusten
      `KONTROLLE/erfunden.keystore` meldet ihn, und die Stichprobe zeigt saubere
      Pfade (`.codex/skills/…`) — die Zeilenzerlegung liegt also nicht daneben.
      Das Skript war ein Wegwerf-Stück ausserhalb des Repos, wie beim
      `pg_cron`-Vorgang in AGE-641.
- [x] **`.gitignore` nachgezogen: `*.mobileprovision`, `*.provisionprofile`.**
      Der Wächter hat die Lücke gefunden, nicht das Auge — beide Endungen teilen
      mit keiner bestehenden Zeile ein Muster. Die zwei Schichten tun
      Verschiedenes: die Ignorierzeile verhindert das versehentliche
      Hinzufügen, der Wächter findet, was per `git add -f` oder über eine
      Musterlücke trotzdem hineingerät. Ohne die Ignorierzeile fiele der Fund
      erst in CI auf — und da ist der Push in ein **öffentliches** Repo schon
      geschehen.

### B3. Signaturmaterial, dann der eigene Workflow

Die Signierung kommt **vor** dem Workflow und vor Phase E: ein physisches Gerät
nimmt keine unsignierte App an. Ohne diesen Schritt ist die Abnahme „startet auf
echten Geräten" nicht erreichbar, und das fiele erst ganz am Ende auf.

- [ ] **iOS:** Entwickler-Zertifikat und Provisioning Profile (oder
      App-Store-Connect-API-Schlüssel) bereitstellen. Woher sie kommen, gehört
      in dieselbe Zeile wie ihr Name — nach Infisical, nicht ins Repo.
- [ ] **Android:** Keystore erzeugen, **außerhalb des Repos sichern**,
      `key.properties` aus CI-Secrets erzeugen lassen. Derselbe Keystore, der
      nirgends im Repo liegen darf, muss dem Workflow zur Laufzeit vorliegen —
      das ist der Widerspruch, den diese Zeile auflöst.
- [ ] Neuer Workflow, ausgelöst per `workflow_dispatch` und Tag, der das
      Material aus den Secrets einspeist.
- [ ] **Beleg:** ein Pull Request, der nur Web-Dateien ändert, löst ihn **nicht**
      aus, und der Web-Deploy läuft wie bisher.

### B4. Das App-Symbol ✅

Der Startbildschirm ist die einzige Fläche, die jemand sieht, BEVOR er die App
öffnet — und dort stand bis zum 28.08. das Symbol des Frameworks.

- [x] **RED, und zwar gemessen statt behauptet:** die mittlere Farbe der
      vorhandenen Symbole, über `sips` auf 1×1 geschrumpft und die Bildpunkte
      selbst gelesen. `#ebf6fe` (iOS) und `#e6f2fa` / `#e0eff9` (Android) —
      nahezu weiss, das Standardsymbol. Nachher `#212d3d` auf beiden Seiten.
- [x] **Eine Quelle:** `scripts/app-icons.logic.ts` liest Ring und Stern aus
      `public/brand/compass-favicon.svg` (seit B6 nur noch den Stern) — derselben Marke, die der Browser-Tab
      trägt — und erzeugt daraus alle fünfzehn Dateien beider Plattformen.
      Keine vierte Kopie der Marke im Repo. `pnpm app:icons`.
- [x] Genommen ist die **Favicon**-Fassung und nicht die der Komponente: die
      beiden unterscheiden sich in genau einer Grösse (Ring 3.5 statt 2.5, dafür
      r=15.5 statt 16.5), und diese ist die für kleine Grössen gehärtete. Ein
      App-Symbol wird mit 60 pt gezeichnet, in der Einstellungsliste mit 29.
      **ÜBERHOLT seit B6 (29.08.):** mit dem Ring ist dieser Unterschied
      entfallen — Favicon und Komponente sind jetzt formgleich. Das Favicon
      bleibt die Quelle, aber aus einem anderen Grund (siehe B6).
- [x] Farbe: weiss auf Navy `#081527` — die zweite dokumentierte Markenpaarung
      (`docs/design-system.html`, „Invers · Weiß auf Navy"). Durchsichtigkeit
      verbietet iOS ohnehin, und blau auf navy wären 1,9:1.
- [x] Androids adaptives Symbol: Fläche als **Farbe** (`ic_launcher_background`
      auf Navy gezogen), Vordergrund nur die Marke, in der inneren
      Sicherheitszone (66 von 108). Eine mitgezeichnete Fläche im Vordergrund
      wanderte beim Parallax-Effekt der Startbildschirme sichtbar mit.
- [x] Zwei tote Vorlagen des Frameworks entfernt (`drawable/ic_launcher_-
      background.xml`, `drawable-v24/ic_launcher_foreground.xml`) — von keinem
      `mipmap-anydpi-v26`-Eintrag referenziert, aber im Paket mitgeliefert.
- [x] **GREEN:** zehn Zusagen auf die Erzeugung, davon drei durch eine
      Mutations-Gegenprobe belegt (Marke bis an die Kante · Vordergrund aus der
      Sicherheitszone geschoben · Favicon-Blau stehen gelassen → drei rot).
- [x] **Beleg am GEBAUTEN Artefakt**, nicht an der Vorlage: `AppIcon60x60@2x.png`
      *innerhalb* von `App.app` misst `#212c3d`, und dieselben Symbole aus der
      entpackten `app-debug.apk` messen `#212d3d` in jeder Dichte.

### B5. Die Startfläche

Nach dem Symbol die zweite Fläche, die niemand aufrufen muss: sie steht zwischen
dem Antippen und dem ersten Bild der Anwendung. Bis hierher war sie Capacitors
weißes PNG.

**Es sind zwei Flächen.** Erst der native Startbildschirm
(`LaunchScreen.storyboard`), dann der WebView, bis React zeichnet. Wann die erste
der zweiten weicht, ist ohne `@capacitor/splash-screen` **nicht steuerbar** —
die Zusage ist deshalb nicht der gesteuerte Übergang, sondern der gemeinsame
Grundton, der ihn unsichtbar macht.

Diese Aufgabe ist nach der Plan-Review überarbeitet (`REVIEWS.md`, zwei fremde
Anbieter, beide REQUEST-CHANGES). Was sich dadurch geändert hat, steht bei den
betroffenen Punkten.

- [x] **RED, regionsweise statt als Mittelwert.** Der Mittelwert taugt hier
      nicht: die Komposition endet absichtlich in demselben Weiß, mit dem die
      Fläche vorher vollflächig gefüllt war — beide Zustände können denselben
      Mittelwert haben. *Aus der Review (opencode, HIGH).* Gemessen wird
      stattdessen: **oberste 20 % ≠ Weiß**, **unterste Zeile = Weiß**,
      **Markenregion nicht leer**. Vorher-Stand festgehalten: die Vorlage misst
      `#ffffff`, und die drei Renditions liegen in `Assets.car` mit je
      14 710 Bytes, SHA1 `73CC0B89…` (Scale 3).
- [x] **Es gibt kein `Splash.imageset` INNERHALB von `App.app`.** `actool`
      backt Image Sets in `Assets.car`; der Beleg am gebauten Artefakt läuft
      deshalb über `assetutil --info` und die SHA1 der Renditions, nicht über
      eine Datei im Bündel. *Aus der Review (opencode, HIGH).* Bei B4 ging es
      nur deshalb anders, weil App-Symbole zusätzlich lose im Bündel liegen.
      **Angewandt am 30.08.:** `Splash`, `SplashSchriftzug` und `SplashVerlauf`
      liegen im gebauten `Assets.car`. Damit ist auch die Lesart widerrufen, die
      Startfläche fehle, *weil* kein `Splash.imageset` im Bündel liege — sie
      liegt dort erwartungsgemäss nicht und ist trotzdem da. Ob die Fläche beim
      Start erscheint, ist damit **nicht** belegt; das kann nur das Gerät.
- [x] **Eine Quelle, drei Zutaten, alle schon im Repo:** die Marke aus
      `public/brand/compass-favicon.svg` (dieselbe wie App-Symbol und Tab), das
      Bild aus `public/images/hero-mitglieder.webp` (dasselbe wie das
      Login-Panel) und die Schriften aus `public/fonts/*.woff2`. `pnpm splash`.
- [x] **Drei Ebenen, nicht zwei — und das ist der Punkt, an dem der Entwurf
      umgebaut wurde.** Der Verlauf wird **nicht** ins Foto eingebacken, sondern
      ist eine eigene, gestreckte Ebene über dem Foto. *Aus der Review (beide,
      HIGH/MEDIUM):* die App erlaubt Querformat (`UISupportedInterfaceOrientations`)
      und ist universell gebaut (`TARGETED_DEVICE_FAMILY = "1,2"`). Ein
      eingebackener Verlauf wird beim formatfüllenden Beschneiden mitbeschnitten
      — quer läge seine Unterkante mitten im Farbverlauf, und die Kante des
      Bildes wäre sichtbar. Als eigene Ebene endet er **immer** an der Unterkante
      seiner Fläche in Weiß.
- [x] **Der Verlauf ist der vom Login-Panel** (`LoginPage.tsx:277`): vier Stopps
      — deckend · 22 % · 32 % bei 70 % · 44 % bei 25 % · 58 % durchsichtig. Zwei
      Stopps ergaben dort eine sichtbare Kante bei 26 %; diese Rampe läuft lang
      und flach aus. Sie endet in `--color-canvas` `#ffffff`, **derselben Farbe,
      die auch die Fläche darunter trägt.**
- [x] **Der Grundton wird ausdrücklich gesetzt.** Das Storyboard steht heute auf
      `systemBackgroundColor` — im Dunkelmodus **schwarz**. Bisher unsichtbar
      unter dem deckenden weißen PNG; in dieser Komposition wäre es die Fläche
      unter dem Schriftzug. *Abgeleitet aus einem Review-Befund (gemini), dessen
      Kern — „die App braucht einen Dunkelmodus-Entwurf" — zurückgewiesen ist:
      `data-variant` kennt nur `hell` und `navy`, ein dunkles Inhaltsthema gibt
      es nicht, `--color-canvas` ist immer `#ffffff`.*
- [x] **Alle drei Ebenen am Verhältnis aufgehängt, nicht an Punkten:** Foto auf
      den oberen 62 % der Höhe, Schriftzug bei 58 % Höhe und 25 % hoch. Daraus
      folgt die Invariante, die den Text von jeder Bildlage trennt:
      `schriftzugOben ≥ bandAnteil × 0.78` — der Punkt, ab dem die Rampe
      deckend weiß ist. Sie gilt für jede Bildschirmgröße und jede Orientierung,
      weil beide Seiten Anteile derselben Höhe sind. **Das ist eine Zusage, die
      ein Test prüfen kann**, im Gegensatz zu „sieht auf dem SE auch gut aus".
- [x] **Das `webp` wird vor dem Rastern nach PNG dekodiert, mit Abbruch.**
      *Aus der Review (opencode, HIGH):* `rsvg-convert` lädt eingebettete Bilder
      über gdk-pixbuf und fällt bei fehlendem WebP-Loader **still** aus — genau
      das Fehlerbild, vor dem der Schrift-Punkt warnt. `sips` dekodiert,
      der Lauf bricht ab, wenn dabei nichts entsteht.
- [x] **Die Schriftbindung wird POSITIV nachgewiesen.** *Aus der Review
      (opencode, HIGH), und der Befund sitzt:* die erste Fassung führte als
      „Positivkontrolle", dass `Georgia` auf eine Grotesk zurückfällt — also ein
      gelungenes stilles Ersetzen, genau das, was die Anforderung verbietet.
      Jetzt umgekehrt: `fc-match` muss für **Inter** und **Fraunces** auf die
      entpackte Repo-TTF zeigen, sonst bricht der Lauf ab. Die Gegenprobe
      (Systemschrift greift nicht durch) steht daneben, nicht an ihrer Stelle.
- [x] **`PANGOCAIRO_BACKEND=fc` ist nötig und wird am Verhalten geprüft, nicht
      am Variablennamen.** `rsvg-convert` nimmt auf macOS über pango sonst den
      **CoreText**-Pfad und ignoriert jede eigene `fonts.conf` stillschweigend:
      gemessen kam Fraunces als Grotesk heraus, ohne Fehlermeldung. Ob die
      Variable in einem anderen pango-Bau wirkt, ist offen — deshalb entscheidet
      die `fc-match`-Prüfung eine Zeile darüber, nicht die Variable.
      *Aus der Review (opencode, LOW).*
- [x] **`woff2_decompress` als Werkzeug** (`brew install woff2`), wie
      `rsvg-convert` bei B4. Die entstehenden TTF sind Zwischenergebnisse und
      werden **nicht** versioniert — die `woff2` im Repo bleiben die einzige
      Fassung der Schriften.
- [x] **GREEN:** Zusagen auf die Erzeugung — die vier Stopps des Verlaufs, die
      Verhältnis-Invariante oben, der Ausschnitt als **Anteil** des Quellbildes
      (nicht als feste Pixel, *Review opencode LOW*), und dass die Marke aus dem
      Favicon gelesen und nicht abgeschrieben ist. Mit Mutations-Gegenprobe:
      Rampe auf zwei Stopps · Schriftzug über die Invariante geschoben · Marke
      fest verdrahtet → jeweils rot.
- [ ] **Boot-Fläche: die Entscheidung fällt im `<head>`, nicht im Anwendungscode.**
      *Aus der Review (opencode, MEDIUM), und der Befund war richtig:* Inhalt in
      `#root` steht im ausgelieferten Dokument und wird gezeichnet, **bevor**
      irgendein Modul lädt — `Capacitor.isNativePlatform()` käme zu spät, und die
      Boot-Fläche erschiene auch im Browser. Das Inline-Skript im `<head>`, das
      heute schon vor dem First Paint die Design-Variante setzt, entscheidet es
      mit. **Erst messen, ob die Lücke überhaupt sichtbar ist** — sie ist heute
      weiß auf weiß.
- [ ] **Beleg auf dem Gerät, NACH dem Löschen der App.** *Aus der Review (beide,
      LOW/MEDIUM):* iOS hält den Startbildschirm in einem Zwischenspeicher; ein
      Beleg ohne vorheriges Löschen zeigt womöglich die alte Fläche und belegt
      nichts. Bildschirmfoto im Hoch- **und** im Querformat.
- [x] **Grössenzuwachs des Bündels messen und nennen** (*Review gemini, LOW*).
      **Gemessen am 31.08. mit `actool` (Xcode 26.6), also am KOMPILIERTEN
      `Assets.car` und nicht an den Quelldateien** — die beiden Zahlen gehen
      auseinander, und nur die erste wird ausgeliefert:

      | | `Assets.car` | Quelldateien |
      |---|---|---|
      | Capacitor-Vorgabe (`8710c18^`) | 62.104 B | 124.222 B |
      | Marken-Startfläche (HEAD) | 392.040 B | 401.384 B |
      | **Zuwachs** | **+329.936 B ≈ +322 KiB** | +277.162 B |

      **Die Quelldateien hätten den Zuwachs um ~53 KB zu NIEDRIG angegeben.**
      Grund ist die Vorgabe, nicht unsere Fläche: ihre drei `splash-2732x2732*.png`
      sind byte-identisch (derselbe Blob `33ea6c9`), und `actool` legt sie einmal
      ab — 123.819 B Quelle werden zu 62.104 B. Wer hier die Dateigrössen
      subtrahiert, misst eine Ersparnis mit, die es im Paket nie gab.

      Der Zuwachs ist **iOS-allein**; Android bleibt unberührt (siehe die Zeile
      dazu weiter unten). Getragen wird er fast vollständig von
      `splash-band.jpg` (310.891 B) — dem einzigen Foto-Motiv der drei.

      Ein Optimierer wie `oxipng` kommt bewusst **nicht** dazu: eine weitere
      Werkzeug-Abhängigkeit für einen Lauf, der ein paarmal im Jahr stattfindet.
- [ ] **Offen, als eigener Vorgang notiert:** `pnpm splash --check` in der CI,
      die die Raster neu erzeugt und gegen die committeten diffed. Ohne das ist
      „eine Änderung an der Quelle erreicht die Startfläche" von Hand gehalten,
      nicht erzwungen. *Review opencode, MEDIUM.* **Gilt für `pnpm app:icons`
      (B4) genauso** — deshalb ein Vorgang für beide, nicht einer hier.
- [ ] **Android bleibt hier bewusst aussen vor, mit Grund.** Seit Android 12
      zeichnet die SplashScreen-API die Startfläche aus
      `windowSplashScreenBackground` und einem Symbol; das Bitmap unter
      `@drawable/splash`, das Capacitor anlegt, wird dort nicht mehr gezeigt.
      Zehn weitere PNG zu erzeugen hiesse, tote Dateien auszuliefern. Eigener
      Vorgang mit eigenem Entwurf — und ohnehin erst prüfbar, wenn die App auf
      einem Android-Gerät läuft (offen seit B1).

### B6. Die neue Marke ✅

Der Ring fällt ersatzlos, dafür kommen vier Nebenstrahlen auf die Diagonalen.
Vermessen, entschieden und freigegeben am 29.08.; die Zahlen, die Methode und
die Deckungsprobe stehen in `docs/marke-neu/entwurf-messung.md` und werden hier
nicht wiederholt.

- [x] **Eingesetzt an den drei handgepflegten Stellen, keine vierte Kopie:**
      `public/brand/compass-favicon.svg`, `src/components/ui/CompassMark.tsx`,
      `docs/design-system.html` (dort **sieben** Vorkommen, nicht eines — zwei
      davon trugen die Favicon-Fassung mit dem verstärkten Ring). Nachgemessen:
      elf Vorkommen des Pfades im Repo, davon zwei in erzeugten Dateien, und
      **genau ein** verschiedener Pfad darunter.
- [x] `leseMarke()` in `scripts/app-icons.logic.ts`: `Marke.ring` entfällt samt
      Zeichnen des Rings. Ein `<circle>` wird jetzt **verboten** statt
      übergangen — sonst zeichnete der Generator ihn still nicht mit und das
      Symbol trüge eine andere Marke als der Tab.
- [x] Mitgezogen, weil es dieselbe `Marke` verbraucht: `schriftzugSvg()` in
      `scripts/splash.logic.ts`. Ohne diesen Schritt hätte der Typ nicht mehr
      gepasst.
- [x] **GREEN:** 29 Zusagen in `app-icons.logic.test.ts` und
      `splash.logic.test.ts`, angepasst statt gelöscht — die Ring-Zusagen sind
      durch Stern-Zusagen ersetzt (fünf Teilzüge als Positivkontrolle zur Regex;
      „folgt einem geänderten Stern" als Gegenprobe zum Abschreiben). Die
      NaN-Wache entfällt mit dem Ring: es wird keine Zahl mehr aus einer Form
      gelesen. Ganze Reihe: 2246 Tests grün.
- [x] **Beleg am erzeugten Artefakt, nicht an der Datei im Arbeitsbaum:**
      `pnpm app:icons` und `pnpm splash` neu gefahren, 21 Dateien geändert.
      Mittlere Farbe des iOS-Symbols `#212c3c` → `#152132`, Weissanteil
      10,03 % → 5,24 % — der Ring war der Unterschied.
- [x] **Deckungsprobe gegen die Vorlage, aus dem Repo heraus gerendert:**
      90,9 % (Schnittmenge durch Vereinigung, 600², Mitte und R **gemessen**
      statt angenommen: 626,4/625,7 und R=176, beides reproduziert). Als
      Positivkontrolle derselbe Test gegen den alten Stand aus `HEAD`: 42,2 %.
      Umriss über der Vorlage sichtgeprüft.

## Phase C — Ränder, Zurück-Taste, Kamera

### C1. Sichere Ränder

- [x] `viewport-fit=cover` in `index.html:12`. **Zuerst** — ohne das Meta sind
      alle `env(safe-area-inset-*)` null, und jede weitere Zeile wirkungslos.
- [x] `env(safe-area-inset-*)` **ergänzend** (nicht ersetzend) an Kopfzeile,
      beiden angedockten Leisten und Chatfenster.
- [ ] **Beleg auf dem Gerät**, ausdrücklich nicht in jsdom: dort sind die Insets
      immer null, und ein Test darüber wäre grün, gleich was die App tut.

### C2. Android-Zurück

- [x] **RED**: Test — bei offenem Overlay schließt Zurück das Overlay und
      navigiert **nicht**. Die Reihenfolge ist der Punkt, den man übersieht:
      mehrere Flächen führen ihren Offen-Zustand über den Verlaufsschlüssel
      (`HeaderSearch.tsx:80`, `MemberDirectory.tsx:80`, `LegalZurueck.tsx:24`).
- [x] **RED**: Test — mit Verlauf geht Zurück eine Seite zurück; ohne Verlauf
      schließt es die App **nicht**.
- [x] Beide Tests prüfen die **Entscheidungsfunktion**, nicht das Ereignis:
      `backButton` ist ein natives Capacitor-Ereignis, das in jsdom nie feuert.
      Ein Test, der auf die Ereignisquelle wartet, wäre grün, weil nichts
      passiert — dieselbe Falle wie bei `env(safe-area-inset-*)`.
- [x] **`@capacitor/app` als Abhängigkeit hinzufügen.** Sie fehlt bisher in
      jeder Phase: A installiert `core` und `preferences`, C3 `camera`, D den
      Updater. Ohne sie gibt es weder `backButton` noch das Wegschicken in den
      Hintergrund, und die RED-Tests oben könnten nie grün werden.
- [x] Handler auf `@capacitor/app` `backButton` legen. Er steht in
      `AppShell.tsx`, nicht in `src/lib/`: er braucht Navigation UND den
      Overlay-Stapel, und `src/lib` importiert nirgends aus `src/components` —
      diese Schichtung ist nicht umgekehrt worden.
- [x] **Beim Bauen entschieden, weil die Anforderung es erzwingt:** „Overlay
      schliessen, ohne zu navigieren" braucht einen Weg, das oberste Overlay zu
      schliessen. `useOverlay` führte den Stapel bereits (für die Tab-Falle),
      hatte aber keinen Ausgang. Er bekommt zwei — `istOverlayOffen()` und
      `schliesseOberstesOverlay()` — und eine **Pflicht**-Schliessfunktion als
      zweites Argument. Pflicht, nicht optional, aus demselben Grund, aus dem
      der Hook überhaupt entstand (AGE-529): der Mangel wäre nicht die eine
      Fläche, die Zurück nicht bedient, sondern die fehlende Regel. Der Typ
      erzwingt sie an allen acht Anschlussstellen, heute und beim nächsten
      Overlay. **Kein synthetisches Escape ins Dokument** — das träfe jeden
      `document`-Lauscher auf einmal, ein Fehlerbild, das `EmojiAuswahl.tsx`
      bereits beschreibt.
- [x] **`hatVerlauf` liest `window.history.state.idx`, NICHT
      `location.key !== "default"`.** Der erste Entwurf nahm die Regel aus
      `LegalZurueck.tsx`, um keinen zweiten Begriff von „es gibt ein Zurück"
      zu schaffen. **Das trägt hier nicht, und es fiel erst bei der Durchsicht
      auf:** `RequireAuth` und `HomeRedirect` ersetzen beim Kaltstart den
      ersten Eintrag (`<Navigate replace />`). Der Schlüssel wäre dann nicht
      mehr `"default"`, ein Eintrag dahinter gäbe es trotzdem nicht — Zurück
      liefe ins Leere, statt zu minimieren. In `react-router@7.18.2` gemessen,
      nicht angenommen: erster Eintrag `index = 0` · `push`
      `index = getIndex() + 1` · **`replace` `index = getIndex()`**. Für
      `LegalZurueck` bleibt die alte Regel richtig — dort entscheidet sie eine
      Aufschrift nach einer Navigation, die stattgefunden hat.
- [ ] **Beleg auf einem Android-Gerät:** durch drei Ebenen navigieren, Overlay
      öffnen, zweimal zurück — Overlay zu, eine Ebene zurück, App noch offen.

### C3. Kamera und Fotoauswahl

- [x] **RED**: Test — der gemeinsame Aufrufpunkt gibt im Web eine Datei aus dem
      bestehenden `<input>` zurück; die sechs Aufrufer kennen keine Plattform.
- [x] Aufrufpunkt bauen, `@capacitor/camera` im nativen Zweig.
- [x] Die sechs Stellen umstellen. Nachgemessen, die Zeilen waren gewandert:
      `ProfilPage.tsx:278,331` · `CommunityFeed.tsx:995,2169` ·
      `EventCoverPicker.tsx:129` · `WillkommenPage.tsx:603`.
- [x] **Beim Bauen entschieden, weil die API sich unter der Aufgabe bewegt
      hat:** `@capacitor/camera` 8.2.3 führt `getPhoto` samt eingebauter
      „Kamera oder Galerie?"-Rückfrage als **veraltet** und verweist für die
      Rückfrage auf eine eigene Oberfläche. Gewählt (Donald, 31.08.): die
      aktuelle API — `takePhoto` und `chooseFromGallery` — mit **eigener**
      Rückfrage in den vorhandenen Overlay-Bausteinen. Der Nebengewinn ist der
      Grund, warum es die bessere Wahl war: nur `chooseFromGallery` kann
      `allowMultipleSelection`, der Feed behält damit seine Mehrfachauswahl.
      Die Anforderung in `specs/native-shell/spec.md` ist nachgezogen; sie
      sprach vom „nativen Ablauf mit der Wahl".
- [x] **`limit` ist der REST, nicht das Maximum** — mit eigener Zusage und
      Mutations-Gegenprobe. Im Web hält der Dateidialog nichts, nativ hielte es
      niemand, und `waehleBilder` verwürfe den Überschuss stumm.
- [x] **`EncodingType.JPEG` bei der Kamera**, mit eigener Zusage. Das ist die
      Lehre vom 17.08.: ein HEIC vom iPhone zeigte im Zuschnitt eine leere
      Fläche und einen toten Knopf, ohne ein Wort. `chooseFromGallery` kennt
      die Option nicht — dort trägt der Zweig, den `AvatarCropper` dafür hat.
- [x] **Zwei Stellen mussten umgebaut werden, und das ist sichtbar:**
      `WillkommenPage:603` und `CommunityFeed:2169` trugen ein **sichtbares**
      Dateifeld, das zugleich der Auslöser war — ein `<label>` löst sein Feld
      unabweisbar selbst aus, es gäbe also keine Stelle, an der die Rückfrage
      aufgehen könnte. Beide liegen jetzt versteckt hinter einem Knopf, wie die
      vier anderen. Der Dateidialog im Browser ist derselbe; **was sich ändert,
      ist die Optik des Auslösers.** Bei `CommunityFeed:995` ändert sich nichts
      — dort trugen die Klassen schon ein Knopf-Aussehen und wandern wörtlich
      mit.
- [x] **Beleg:** Zuschnitt und Upload dahinter sind unverändert — dieselben
      Seitenverhältnisse je Bucket wie bisher.
- [ ] **Beleg auf beiden Geräten**, wie bei C1 und C2: einmal aus der Kamera,
      einmal aus der Galerie, Bild danach auf dem Profil sichtbar. Die native
      Auswahl ist genau der Teil, den kein Test im Browser je berührt.

## Phase D — OTA · selbst gehostet auf Supabase

> **Korrigiert am 31.08.** Diese Phase stand bis dahin auf Cloudflare Pages
> Functions plus R2. Sie liegt jetzt auf **Supabase** — Begründung in
> `design.md` §8, kurz: die einzige Begründung für R2 lautete „steht bereits"
> und war gemessen falsch. R2 stand nie; Supabase Storage steht mit vier
> Buckets. Wer eine ältere Fassung dieser Datei gelesen hat, hat einen
> R2-Bucket erwartet, den es nicht gibt.

### D1. Der Weg, auf dem ein Bündel entsteht

Ohne diesen Schritt gibt es drei Endpunkte, die Anfragen beantworten, und nichts,
was das System je befüllt.

- [x] Bucket **per Migration** anlegen (31.08., `20260831100000_ota_buendel.sql`):
      `ota-buendel`, `public = true`, **8 MiB**, **`application/octet-stream`**
      (kein `application/zip` — es liegt ein AES-Chiffrat darin; der Downloader
      des Plugins prüft den Content-Type gar nicht). **Keine Policy**, und das
      ist gemessen richtig: `service_role` trägt `rolbypassrls = true` und alle
      sieben Rechte auf `storage.objects`. Die 8 MiB sind das Fangnetz gegen
      einen entgleisten Upload, **nicht** gegen mitgelieferte Sourcemaps (die
      wögen 4,43 MB und kämen durch) — deren Ausschluss gehört in den
      Veröffentlichungs-Schritt, wo er prüfbar ist.
      Nach dem Muster der vier bestehenden:
      `public = true`, `file_size_limit`, `allowed_mime_types`. Gemessene Größe
      je Bündel: **2,71 MB** ohne Sourcemaps (4,43 MB mit). Öffentlich ist hier
      kein Zugeständnis: mit gesetztem `publicKey` liegt im Bucket **Chiffrat**,
      kein lesbares `dist/` — die Datei ist nur mit dem öffentlichen Schlüssel
      lesbar. **Mime-Typ erst festlegen, wenn die Verschlüsselung steht**; ein
      AES-Chiffrat ist kein `application/zip` mehr.
- [x] Manifest **per Migration** als Tabelle (31.08., dieselbe Datei):
      `public.ota_buendel` mit `version` (PK), `url`, `checksum`, `session_key`,
      `benoetigte_schale`, `created_at`. RLS an, **keine Policy, kein Grant** —
      Muster `activation_tokens`; gelesen und geschrieben wird allein mit der
      Service-Rolle über SECURITY-DEFINER-Funktionen, die mit D3 dazukommen.
      Vier Bedingungen an den Spalten halten je eine Messung am Plugin fest;
      `supabase/tests/ota_buendel_test.sql` belegt sie mit je einer
      Positivkontrolle (13 Zusagen, lokal grün). Die Spaltennamen sind die
      Feldnamen der Antwort an `updateUrl` — der Endpunkt bildet eins zu eins ab.
      Ursprünglich gefordert war:
      Vertragsnummer der Schale **und `sessionKey`** (Form `iv:sessionKey`, beides
      Base64 — am Plugin gemessen, `CapacitorUpdaterPlugin.java:4173`). Mit RLS,
      die dem Endpunkt das Lesen erlaubt und das Schreiben niemandem außer dem
      Veröffentlichungs-Schritt.
- [x] **Veröffentlichungs-Schritt gebaut** (31.08.): `scripts/ota-buendel.logic.ts`
      (das Rechnen, mit Test), `scripts/ota-buendel.ts` (zippen, hochladen,
      eintragen), `20260831140000_ota_buendel_veroeffentlichen.sql` (der
      Schreibweg als SECURITY-DEFINER-Funktion, nur `service_role`) und ein
      Schritt in `deploy.yml`, der **nur auf `main`** läuft.

      **Belegt, nicht behauptet:**
      * Der **Rundlauf des Geräts**, mit dem **echten** Schlüssel und dem
        **echten** 2,75-MB-Bündel: sessionKey RSA-geöffnet → AES entschlüsselt →
        byte-gleich zum Zip → Prüfsumme passt zum Klartext. 10 Zusagen in
        `ota-buendel.logic.test.ts`, dazu die Abweisung eines 4096-Bit-Schlüssels.
      * Das **Zip**, an einem echten `dist/` gemessen: `index.html` an der
        Wurzel, **0** von 64 Sourcemaps darin, 2,75 MB.
      * Der **Schreibweg** in `ota_buendel_test.sql` §21–26: `security definer`,
        `anon` und `authenticated` dürfen ihn NICHT ausführen, `service_role`
        schon, ein zweiter Aufruf ersetzt statt zu scheitern, und die
        CHECK-Bedingungen greifen auch auf diesem Weg.

      **NICHT belegt** und erst beim ersten Deploy auf `main` sichtbar: der
      Upload in den Bucket und der RPC-Aufruf über das Netz. Beide brauchen ein
      laufendes Projekt mit angewandten Migrationen.

      **Ein Fund am Rande, der die Wahl der Krypto-Bibliothek festnagelt:**
      `RSA.swift:253` trägt wörtlich den Kommentar „For PKCS1 padding from
      Node.js privateEncrypt" und prüft auf genau dieses Blockformat. Node ist
      hier die Referenz, gegen die die iOS-Seite geschrieben wurde — nicht eine
      von mehreren Möglichkeiten. Dieselbe Datei polstert zwei Zeilen darüber
      hart auf 256 Byte: RSA-2048, ein zweites Mal und an ganz anderer Stelle.

      Ursprünglich gefordert war: `dist/` zu einem Zip mit
      `index.html` an der Wurzel und **ohne `.map`-Dateien**; SHA-256 bilden;
      das Zip mit einem zufälligen **AES**-Schlüssel verschlüsseln; diesen
      Sitzungsschlüssel **und** die Prüfsumme mit dem **privaten** RSA-Schlüssel
      verschlüsseln; Chiffrat in den Bucket laden; Manifest-Zeile mit `version`,
      `url`, `checksum` und `session_key` schreiben. Das ist capgos „end to end
      encryption v2", nicht eine losgelöste Signatur — siehe `design.md` §8.
      Hochladen über `SUPABASE_SERVICE_ROLE_KEY` aus Infisical — der Job fährt
      ohnehin über `infisical run`.

      **Vier Einzelheiten, am 31.08. am Quelltext gemessen; jede einzelne würde
      sonst erst auf dem Gerät auffallen, und dort still:**

      1. **Die Prüfsumme gehört zum KLARTEXT-Zip, nicht zum Chiffrat.** Das
         Plugin entschlüsselt zuerst und rechnet dann
         (`CapgoUpdater.java:851-856`). Wer die SHA-256 über die hochgeladene
         Datei bildet, liefert die falsche.
      2. **Verschlüsselt werden die 32 ROHEN Digest-Bytes**, nicht die 64
         Hex-Zeichen. Das Gerät hext das Ergebnis selbst auf und vergleicht mit
         `calcChecksum`, das Kleinbuchstaben-Hex liefert (`CryptoCipher.java:266`).
      3. **Das Feld `checksum` trägt Hex**, nicht Base64 — beides wird
         angenommen, Hex ist das neue Format. Bei RSA-2048 also genau 512
         Zeichen; die Bedingung an der Spalte erzwingt es.
      4. **`sessionKey` ist `<iv>:<sessionKey>`**, beides Base64, der IV
         **unverschlüsselt** (`CryptoCipher.java:151-152`). Fehlt der
         Doppelpunkt, hält das Plugin die Verschlüsselung für abgeschaltet und
         versucht, Chiffrat zu entpacken — ohne Fehlermeldung, die das erklärt.

      **Nicht die Tabelle direkt beschreiben.** `service_role` hält in `public`
      keine Tabellenrechte (AGE-312); ein `.from("ota_buendel").insert(…)`
      scheitert erst zur Laufzeit. Der Schreibweg ist eine
      SECURITY-DEFINER-Funktion mit `grant execute … to service_role`, Muster
      `issue_activation_token`. Für den **Bucket** gilt das nicht: dort trägt
      `service_role` alle Rechte und umgeht die RLS — gemessen.
- [x] **Anlass festgelegt** (Donald, 31.08.): jeder Deploy auf `main`. Derselbe
      Job, der `dist/` schon baut und zu Pages lädt. Jeder andere Anlass hieße,
      dass ein vergessener Auslöser Geräte **still** zurücklässt.
- [x] **Fassungsschema festgelegt** (Donald, 31.08.): `<Semver aus
      package.json>+<kurzer SHA>`, z. B. `1.4.0+8fbc49bdeadb`. Beantwortet zugleich,
      was gilt, wenn Store-Bau und `main`-Deploy sich überholen: verschiedene
      SHAs, also verschiedene Fassungen.
- [x] **RSA-Schlüsselpaar neu erzeugt — 2048 Bit** (Donald, 31.08. nachmittags,
      nach dem Befund unten).

      **Gemessen an `~/Documents/capgo_privat.pem`, fünf Punkte:** 2048 Bit ·
      PKCS#1 in beiden Dateien (`BEGIN RSA PRIVATE KEY` / `BEGIN RSA PUBLIC
      KEY`) · Chiffrat **256 Byte**, also genau was das Plugin verlangt ·
      Rundlauf *privat verschlüsselt → öffentlich geöffnet* byte-gleich über 32
      Bytes · Base64 **344** und Hex **512** Zeichen, also genau die Längen, die
      `ota_buendel` als Bedingung führt.

      **Diesmal ist die GRÖSSE ausdrücklich geprüft** — das ist der Unterschied
      zu den drei Belegen vom Vormittag, die Format, Übertragung und Rundlauf
      prüften und die Länge gerade nicht.

      **Nicht selbst nachgemessen:** dass der Wert in Infisical `prod` derselbe
      ist wie die Datei auf der Platte. Das braucht ein echtes Terminal; Donald
      hat es abgelegt und gesagt. Der erste Deploy auf `main` ist die Stelle, an
      der es sich zeigt — und er scheitert dann laut, nicht still, weil
      `bildeBuendel` die Längen prüft, bevor irgendetwas hochgeladen wird.

      **Korrektur vom 31.08., nachmittags.** Am Vormittag desselben Tages galt
      diese Aufgabe als erledigt und dreifach belegt: 4096 Bit, PKCS#1, in
      Infisical `prod`. **Die Schlüssellänge ist falsch, und die drei Belege
      haben sie nicht geprüft** — sie prüften Format, Übertragung und Rundlauf,
      also drei Fragen, unter denen die Größe nicht vorkam. Ein Rundlauf
      gelingt mit jeder Schlüssellänge.

      Gemessen am Quelltext von `@capgo/capacitor-updater@8.51.15`:
      `decryptChecksum` bricht ab, wenn das Chiffrat der Prüfsumme **nicht
      genau 256 Byte** lang ist — auf beiden Plattformen, hart, mit
      „Checksum is not RSA encrypted" (`CryptoCipher.java:254`,
      `CryptoCipher.swift:74`). 256 Byte heißt **RSA-2048**. Der hinterlegte
      4096-Bit-Schlüssel liefert gemessen **512 Byte**; Gegenprobe mit einem
      frischen 2048-Bit-Schlüssel: 256 Byte, und der Rundlauf gibt die 32
      Digest-Bytes byte-gleich zurück.

      **Der Fehlschlag wäre still gewesen:** die Prüfsumme ist Pflicht, sobald
      ein `publicKey` gesetzt ist. Das Bündel lädt, die Prüfung scheitert, das
      Gerät bleibt auf der alten Fassung — und kein Log auf unserer Seite sagt
      warum. Aufgefallen wäre es frühestens beim ersten Gerätetest.

      **Was aus der alten Fassung weiter gilt** (geprüft, Klausel für Klausel):
      **PKCS#1** ist richtig und wird von beiden Plattformen ausdrücklich
      verlangt (`CryptoCipher.java:145`, `CryptoCipher.swift:241`);
      `openssl rsa -pubout` liefert das falsche Format, `-RSAPublicKey_out` das
      richtige. Die Ablage in Infisical `prod` als `CAPGO_PRIVATE_KEY` ist der
      richtige Ort, und der mehrzeilige PEM-Wert ist dort ungekürzt angekommen —
      das war die Lehre aus `APNS_KEY_P8` vom 28.08. und sie trägt weiter.
      **Nur die Länge ändert sich.**

      Erzeugung: `openssl genrsa -traditional -out capgo_privat.pem 2048`,
      dann `openssl rsa -in capgo_privat.pem -RSAPublicKey_out`. Danach
      `CAPGO_PRIVATE_KEY` in Infisical `prod` ersetzen. Die alten
      4096-Bit-Dateien in `~/Documents` gehören gelöscht, damit nicht später
      die falsche gegriffen wird.
- [x] **Die Länge ist in der Datenbank festgehalten** (31.08.). Die Bedingung
      `ota_buendel_checksum_rsa2048_hex` verlangt 512 Hex-Zeichen = 256 Byte.
      Ein mit dem 4096-Bit-Schlüssel gebildetes Chiffrat (1024 Zeichen) wird
      beim Schreiben abgewiesen, statt dass jedes Gerät das Bündel schweigend
      verweigert. `ota_buendel_test.sql` belegt beide Richtungen.
- [x] Öffentlichen Schlüssel als `publicKey` in `capacitor.config.ts` eintragen.
      **Erledigt mit D3** — `capacitor.config.ts:105`, PKCS#1 und 2048 Bit,
      bewacht von `scripts/capacitor-config.test.ts` (Kopfzeile wörtlich,
      `modulusLength === 2048`). Die Zeile stand hier als offen, war es am
      31.08. aber nicht mehr; nachgeführt am 31.08. Dass es der RICHTIGE
      Schlüssel ist und nicht bloss irgendeiner derselben Bauart, hält
      `pruefeSchluesselpaar` im Veröffentlichungs-Schritt — und seit dem
      31.08. der Beleg am lebenden Bündel unter D3.

### D2. Die Vertragsnummer der Schale — Feld, Stempelstelle, Regel

Dreimal dieselbe Zahl, dreimal woanders. Wird das nicht festgelegt, erfindet
jeder Schritt in D3 seine eigene Auslegung. Alle drei sind am 31.08. **am
Quelltext des Plugins gemessen** worden, nicht geraten.

- [x] **Feld: `version_build`.** Das einzige Feld im POST an `updateUrl`, das auf
      **beiden** Plattformen aus `plugins.CapacitorUpdater.version` kommt
      (`CapacitorUpdaterPlugin.java:725`, `CapacitorUpdaterPlugin.swift:268`).
      `custom_id` scheidet aus: aus **JavaScript** gesetzt (`setCustomId`), die
      Web-Schicht erklärte damit ihren eigenen Vertrag.
- [x] **Stempelstelle: `plugins.CapacitorUpdater.version` in
      `capacitor.config.ts`** — am 31.08. auch wirklich **eingetragen**, Wert
      `1.0.0`. Sie ist keine tote Konfiguration, obwohl das Plugin erst mit D3
      dazukommt: `scripts/ota-buendel.ts` liest sie heute schon und stempelt
      jedes Bündel damit. Beleg: `capacitor.config.json` liegt in
      `android/app/src/main/assets/` und `ios/App/App/` — **neben** `public/`,
      nicht darin. OTA tauscht `public/`; die Nummer bleibt der Schale und ist
      nur über den Store änderbar. Ausdrücklich **nicht** die App-Version.
- [x] **Regel** festgehalten (`design.md` §8): die Nummer steigt in **jedem** PR,
      der ein Plugin hinzufügt, entfernt oder seine native Fassung hebt. Ein
      solcher PR geht über den Store.

### D3. Endpunkte und Schutz

> **Vorab, gemessen am 31.08. und bindend für den `updateUrl`-Endpunkt:** das
> Gerät vergleicht die angebotene Fassung mit der eigenen **auf Ungleichheit,
> nicht auf Grösse** (`CapacitorUpdaterPlugin.java:4909`, `.swift:4360`).
> Liefert der Endpunkt ein älteres Bündel, installiert das Gerät es
> kommentarlos. Die Abfrage MUSS deshalb ausdrücklich nach `created_at`
> absteigend ordnen und das erste Bündel nehmen, dessen `benoetigte_schale` das
> Gerät erfüllt. Ein `select … limit 1` ohne `order by` wäre ein Rückschritt,
> der wie ein Zufall aussieht.

- [x] `@capgo/capacitor-updater@8.51.15` hinzufügen. **Nicht `9.x` oder `10.x`**
      — die tragen die höhere Zahl, fordern aber `@capacitor/core: ^5.0.0`;
      `latest` ist bewusst `8.51.15`. Nach dem Hinzufügen: `deno install
      --frozen=false`, danach **zwingend** `pnpm install`, sonst wird der
      Deno-Job rot.
      **Erledigt 31.08.**, in dieser Reihenfolge und mit `fbc-platform-f4`
      abgestimmt (null offene PRs, keine ungesicherte Sperrdatei). In
      `package.json` steht die Fassung **exakt**, ohne `^`: ein Caret liesse
      `pnpm update` auf `8.x` wandern, und die Fassungswahl hier ist eine
      Messung, keine Untergrenze. Keine unerfüllte peer-Zusage.
- [x] `updateUrl`, `channelUrl`, `statsUrl` in `capacitor.config.ts` auf die
      eigenen Endpunkte; dazu `plugins.CapacitorUpdater.version` als
      Vertragsnummer (D2) und der `publicKey`.
      **Erledigt 31.08.** Zwei Entscheidungen, die dort nicht offensichtlich
      sind:
      * **Der Projekt-Host steht nicht als Zeichenkette in der Datei**, sondern
        kommt aus `process.env.VITE_SUPABASE_URL` — dieselbe Quelle wie in
        `scripts/ota-buendel.ts`, und das Repo ist öffentlich. Fehlt die
        Variable, **wirft** `cap sync`, statt eine Vorgabe einzusetzen: eine
        leere URL schaltet den Weg nicht ab, sondern legt ihn auf
        `plugin.capgo.app` (`CapacitorUpdaterPlugin.java:98-100`,
        `.swift:101-103`) — samt `device_id` und `app_id` jedes Geräts, aus
        einer Abwesenheit heraus, die in keinem Diff steht.
      * **Der öffentliche Schlüssel steht im Repo**, PKCS#1, acht Zeilen. Er
        gehört dorthin: er steckt ohnehin in jeder ausgelieferten App. Gemessen
        am 31.08.: 2048 Bit, und Modulus identisch mit dem privaten Teil in
        `~/Documents/capgo_privat.pem`. Bewacht von
        `scripts/capacitor-config.test.ts` (4 Zusagen) — die Kopfzeile prüft
        `decryptFile` wörtlich und kehrt sonst **ohne Ausnahme** zurück
        (`CryptoCipher.java:145`).
- [x] Drei Supabase Edge Functions. **Für jede ein `config.toml`-Block mit
      `verify_jwt = false`** — fehlt der Block, gilt `true`, und das Gateway
      antwortet mit 401 **vor** dem Handler. Ein Gerät hat kein JWT, und der
      Fehler stünde in keinem Log der Function.
      **Erledigt 31.08.**: `ota-update`, `ota-channel`, `ota-stats`, alle drei
      mit Block. `scripts/functions-config.test.ts` sagt es je Function
      einzeln zu; sein bestehender Vergleich Verzeichnis ⇄ Deklaration deckt
      die Vollzähligkeit.
      * **Der Leseweg brauchte eine eigene Migration**
        (`20260831160000_ota_buendel_neuestes.sql`, SECURITY DEFINER, nur
        `service_role`). `service_role` hält auf `ota_buendel` kein SELECT, und
        `rolbypassrls` umgeht die RLS, nicht ein fehlendes Recht — ein
        `.from(...)` wäre durch Typecheck und Tests gelaufen.
      * **Sie nimmt ZWEI Argumente, und das kam aus dem Fremd-Review** (Runde 5,
        HIGH): die Vertragsnummer sagt, was ein Gerät tragen KANN, die laufende
        Fassung, ab wo es überhaupt noch vorwärts geht. `order by created_at
        desc` allein liefert die neueste Zeile im MANIFEST — das ist nicht
        dasselbe wie „neuer als das, was läuft". Steht ein Gerät weiter vorn,
        bekäme es sonst ein älteres Bündel und installierte es kommentarlos.
      * **Die Verdrahtung zur Datenbank ist eine eigene Funktion**
        (`manifestZugriff`), weil sie sonst zwischen Attrappe und pgTAP
        hindurchfiele — ein Tippfehler im RPC-Namen wäre durch beide Suiten
        gegangen (Fremd-Review, HIGH).
      * **`ota-channel` und `ota-stats` speichern nichts.** Sie existieren
        allein, damit die zwei Wege nicht bei capgo landen. `ota-stats`
        protokolliert `action` und ausdrücklich **nicht** `device_id`.
      * `.rpc()` gibt einen `PostgrestFilterBuilder` zurück, kein Promise — die
        Zusicherung fiel in `deno check` auf, genau wie beim Herauslösen von
        `redeem.ts`.
- [x] **RED**: Test — der Endpunkt liefert ein Bündel **nicht** an eine Schale
      mit zu niedriger Vertragsnummer.
      **Erledigt 31.08., auf beiden Seiten der Grenze**, weil ein Mock, der
      beides behauptet, nur sich selbst prüft:
      * `supabase/tests/ota_buendel_test.sql` §32 — die Auswahl selbst, gegen
        vier Zeilen mit ausdrücklich gesetztem `created_at` (`now()` ist die
        Zeit der **Transaktion**; aus dem Default wären alle vier gleich und die
        Ordnung fiele still auf den Tiebreaker). §33 ist die Positivkontrolle,
        §34 hält fest, dass nach Zeit geordnet wird und nicht nach der höchsten
        erfüllbaren Nummer, §35 dass der Vergleich zahlenweise ist.
      * `supabase/functions/ota-update/antwort.test.ts` — dass der Endpunkt die
        Vertragsnummer überhaupt weiterreicht und nicht selbst filtert.
      * **Mutationsprobe am laufenden Stack** (31.08.): `order by version desc`
        statt `created_at` → 5 von 41 rot; Zeichenkettenvergleich statt `int[]`
        → 1 rot; `is null` aus dem Wächter entfernt → 1 rot; Untergrenze der
        laufenden Fassung entfernt → 1 rot; `>=` statt `>` → 1 rot. Original
        jedes Mal wieder grün.
- [ ] **RED**: Test — ein Bündel ohne passende Prüfsumme wird abgewiesen und die
      installierte Fassung bleibt in Betrieb.
      **Halb erledigt 31.08., und die Teilung ist keine Bequemlichkeit.** Die
      Zusage hat zwei Hälften, und nur eine liegt in unserem Code:
      * **Unsere Hälfte, belegt:** ein Angebot ist vollständig oder es ist
        keines (`antwort.test.ts`). Fehlte `checksum`, lehnte das Gerät mit
        `checksum_required` ab; fehlte `session_key`, gälte die Verschlüsselung
        als nicht gesetzt (`CryptoCipher.java:141`), das Gerät entpackte
        Chiffrat und scheiterte **ohne Hinweis auf die Ursache**. Dazu §38 der
        pgTAP-Datei: die vier Spalten kommen der richtigen Zuordnung zurück.
        Und seit dem Fremd-Review (Runde 5, HIGH): `pruefeSchluesselpaar` im
        Veröffentlichungs-Schritt — der `publicKey` der Schale muss zum
        privaten Schlüssel des Deploys gehören, sonst fällt der Job. Vorher
        belegte nichts mehr als „irgendein 2048-Bit-Schlüssel".
      * **Neu am 31.08.: der Krypto-Weg des Geräts, nachgestellt am LEBENDEN
        Bündel.** `pruefeSchluesselpaar` läuft im Deploy und vergleicht zwei
        Schlüssel miteinander — es fasst das ausgelieferte Bündel nie an. Nichts
        belegte bis dahin, dass die Kette am fertigen Artefakt aufgeht. Jetzt
        schon, gegen PROD (`viwntbodrtqxgmqyxluh`), Manifest
        `0.0.0+e8a2abcdcb21`, mit dem Schlüssel **aus `capacitor.config.ts`
        gelesen** statt abgeschrieben:

        1. `sessionKey` RSA-geöffnet (PKCS#1) → AES-128-CBC-Schlüssel und IV.
        2. Chiffrat (2.997.808 B) entschlüsselt → 2.997.792 B, beginnend mit
           `PK` — ein echtes Zip, nicht Unsinn, der zufällig durchläuft.
        3. SHA-256 des Klartext-Zips == RSA-geöffnete `checksum`,
           **byte-gleich** (`ec0737e811bd8ed2…`).

        **Mit Positivkontrolle, sonst belegte ein grüner Lauf nichts:** ein
        einziges gekipptes Byte im Chiffrat → `8d75277684dff5db…` statt
        `ec0737e8…`, die Probe rötet. Das ist genau der Fehlschlag, der auf dem
        Gerät still bliebe.

        **Was das NICHT belegt:** das ist unsere Nachbildung von `CryptoCipher`,
        nicht das Plugin selbst — und alles danach (installieren, neu starten,
        `notifyAppReady`, Rückfall) bleibt Gerätebeleg. Belegt ist die
        Krypto-Hälfte, und zwar am ausgelieferten Artefakt statt an einer
        Vorrichtung.
      * **Offen, und zwar als Gerätebeleg:** dass das Gerät ein Bündel mit
        falscher Prüfsumme verwirft **und auf der laufenden Fassung bleibt**,
        ist Verhalten des Plugins. Ein Mock könnte es nur behaupten. Der zweite
        Teil des Satzes hängt zudem an **D4** (`notifyAppReady`) — ohne den
        Rückweg gibt es kein „bleibt in Betrieb", nur ein „installiert nicht".

### D4. Der Rückweg — ohne ihn ist OTA eine Einbahnstraße

- [x] `notifyAppReady()` nach erfolgreichem Start aufrufen und das
      Rollback-Verhalten konfigurieren. **Erledigt** — `src/lib/ota.ts` ist ein
      Nebenwirkungs-Modul ohne Export, in `main.tsx` als **zweiter** Import
      direkt hinter `./instrument`. Der Import IST der Aufruf; damit gibt es
      keine Funktion, die jemand zu rufen vergessen kann. Ohne Bedingung (die
      Web-Umsetzung ist ein `return { bundle: BUNDLE_BUILTIN }`,
      `dist/esm/web.js:172`) und ohne `await` (ein top-level `await` machte aus
      einer hakenden Brücke einen Startfehler).
- [x] **Das Rollback-Verhalten war die eigentliche Arbeit:**
      `autoDeleteFailed: false` in `capacitor.config.ts`. Die Vorgabe ist
      `true` und macht aus dem Rückfall eine **Endlosschleife** — am 31.08. an
      8.51.15 auf beiden Plattformen gemessen: `checkRevert()` setzt das
      kaputte Bündel auf ERROR und rollt zurück (`.swift:3353`, `.java:5140`),
      das anschliessende Löschen mit `removeInfo: false` **überschreibt dieses
      ERROR mit DELETED** (`CapgoUpdater.swift:2325`, `.java:1632`), und DELETED
      ist genau der Zweig, der beim nächsten Start dasselbe Bündel **erneut
      lädt** (`.swift:4364-4379`, `.java:4999`) statt abzubrechen, wie ERROR es
      täte (`.swift:4391`, `.java:4915`). Der Abbruch-Zweig ist mit der Vorgabe
      toter Code. **Der Endpunkt aus D3 kann das nicht auffangen:**
      `ota_buendel_neuestes` liefert, was streng später eingetragen wurde als
      das Laufende — nach dem Rückfall läuft wieder die ältere Fassung, das
      kaputte Bündel ist also weiterhin „später". Die Schleife ist nur auf dem
      Gerät zu brechen.
- [x] **RED**: Test — ein Bündel, das **signiert und gültig** ist, aber beim
      Start scheitert, fällt auf die vorige Fassung zurück. **Zur Hälfte
      belegt, und die Hälfte ist benannt** — wie schon bei der zweiten
      RED-Zusage aus D3. Belegt ist unsere Hälfte, mit drei Zusagen in
      `src/lib/ota.test.ts` und einer in `scripts/capacitor-config.test.ts`,
      alle vier gegengeprüft: eine Plattform-Bedingung im Modul lässt zwei
      Zusagen umfallen, ein top-level `await` die dritte, `autoDeleteFailed:
      true` die vierte. Der Rückfall selbst ist Verhalten des Plugins und in
      jsdom nicht herstellbar — er hängt an einem Zeitgeber im nativen Teil.
      Er gehört damit zu den Gerätebelegen, nicht in den vitest-Lauf; ein Test,
      der ihn hier behauptete, wäre grün, weil nichts passiert (dieselbe Falle
      wie bei `env(safe-area-inset-*)` und dem `backButton`).
- [x] Das Szenario im Spec-Delta ergänzen. **Erledigt** — gemessen am 31.08.:
      der `ADDED`-Block in `specs/native-shell/spec.md` trägt die Rückweg-Zusage
      (Z. 214–221) **und** das Szenario „Ein signiertes, aber defektes Bündel
      rollt zurück" (Z. 237–242). Die bisherige Zusage deckte nur das
      **unsignierte** Bündel ab; ein signiertes, das startet und dann weiß
      bleibt, bricht ohne diesen Rückweg **jedes** Gerät dauerhaft — bis eine
      neue Schale durch den Store geht. Das ist der teuerste denkbare Fehler
      dieses Changes.
      **Nachgetragen am 31.08. beim Bauen:** eine zweite Zusage und ein zweites
      Szenario, „Ein zurückgerolltes Bündel wird nicht ein zweites Mal
      installiert". Ohne sie ist der Rückfall nur EINEN Start lang wahr — siehe
      den `autoDeleteFailed`-Befund oben. Das Szenario beschreibt bewusst das
      Gerät und nicht die Konfiguration: die Zusage muss auch dann noch gelten,
      wenn das Plugin einmal ausgetauscht wird.

### D5. Beleg

**Runbook: `geraetesitzung-d5.md`** (31.08.). Die Proben tragen sprechende
Fassungen; **gelaufen sind am Ende `feedbeef` (Probe 1), `600dfee1` heil,
`defec7ed` defekt und `c1ea4ed2` das Aufräumen** — die geplanten `600df00d`
und `c1ea4ed0` wurden unterwegs verbraucht, `600dfeed` verbrannt (siehe unten).
Die Griffe sind am gebauten `dist/` gemessen und fassen **keine Quelldatei**
an. Die Falle, die dort ganz oben steht: eine Probe unter
einer BEREITS eingetragenen Fassung ist ein Upsert und überschreibt das gute
Bündel.

- [x] Eine sichtbare Änderung erreicht ein Gerät ohne Store-Einreichung —
      einmal vollständig durchgespielt. **02.09., iPhone 17 Pro, iOS 26.6.**
      Bündel `0.0.0+feedbeef` (Marke am gebauten `dist/`, keine Quelldatei
      angefasst): heruntergeladen, entschlüsselt, entpackt, Prüfsumme
      abgeglichen, in Betrieb genommen. Beleg auf beiden Seiten — der rote
      Balken stand am Gerät, und im Log:
      `Version successfully loaded: … "version": "0.0.0+feedbeef" … "status":
      "success"` samt `[notifyAppReady was called]`. Danach ist es auch
      `Fallback bundle`, hat sich also bewährt.

      **Möglich wurde das erst durch den `session_key`-Fix** (`d398500`): davor
      brach die Entschlüsselung ab (`Encryption not set, no public key or
      session, ignored` → `cannotUnzip`), und zwar bei JEDEM Bündel, nicht nur
      bei der Probe. Gegenprobe nach dem Fix: die fünf alten Fehlerbilder
      kommen **0 Mal** vor, bei 36 CapgoUpdater-Zeilen als Positivkontrolle.

      **Falle fürs Runbook:** `devicectl … --terminate-existing` löst die
      Übernahme NICHT aus. Es killt den Prozess, statt ihn in den Hintergrund
      zu schicken — und die Übernahme hängt genau an diesem Wechsel
      (`Check for pending update` → `Background timestamp saved` →
      `Reloading`). Diese Zeilen kamen im Kill-Lauf 0 Mal vor. Die Konsole
      taugt zum Mitlesen, die Geste muss am Gerät passieren.
- [x] **Vorbedingung des Rückwegs: `ota-stats` war blind.** Behoben 02.09.,
      bevor die Probe lief — sonst hätte sie nichts gemessen.

      capgo puffert die Statistik und sendet **Stapel**: auf der Leitung steht
      ein JSON-**Array**, nicht ein Objekt (iOS `CapgoUpdater.swift:3300`
      `parameters: eventsToSend`, Android `CapgoUpdater.java:3084`
      `new JSONArray()`). Der Endpunkt las `rumpf.action` an genau diesem
      Array, bekam `undefined` und schrieb `ohne` — im Gerätelauf `Sent 9
      events` gegen dreimal `action: "ohne"`. Daneben bleibt die Einzelform
      echt (`sendRateLimitStatistic` in beiden Schalen, Androids
      `DownloadService.sendStatsAsync`), also nimmt der Endpunkt **beide**.

      **Zweiter Fehler am selben Ort, schwerer als der erste:** die Rumpfgrenze
      stand auf 8 KiB. Ein voller Stapel sind 200 Ereignisse
      (`maxPendingStats` == `MAX_PENDING_STATS`, beide Schalen), gemessen
      **~94 KiB** — es passten **17 von 200** hindurch. Und `413` gilt keiner
      Schale als vorübergehend (`isTransientStatsFailure`: nur 429, 408,
      >= 500), das Gerät verwirft den Stapel also **endgültig**. Die Grenze war
      kein Schutz, sondern stiller Verlust. Jetzt 256 KiB, plus ein Deckel von
      `MAX_EREIGNISSE = 200` protokollierten Aktionen, damit der offene
      Endpunkt durch die weitere Grenze nicht zum Log-Verstärker wird.

      Vorgehen wie beim `session_key`-Fix: erst die Zusagen umgedreht (RED
      gesehen: 5 rot / 3 grün), dann der Code. Die Entscheidung liegt jetzt in
      `meldung.ts`, geprüft mit 11 Zusagen; eine davon liest `index.ts` als
      Text und belegt die Verdrahtung. Alle fünf tragenden Zusagen sind
      mutations-gegengeprobt — Rückbau rötet je einzeln.

      **Am LIVE ausgelieferten Endpunkt gegengeprüft** (PROD, nach Deploy
      `86c4afe`), nicht an den Eingaben — drei Sonden mit Positivkontrolle:

      | Sonde | Rumpf | HTTP | Logzeile |
      |---|---|---|---|
      | Stapel, klein | 1.358 B | 200 | `gesamt: 3`, `actions: ["download_complete","update_fail","set"]` |
      | Stapel, 100 Ereignisse | 45.301 B | 200 | `gesamt: 100`, 100 echte Aktionen |
      | zu gross | 317.101 B | 413 | `rumpf_zu_gross, laenge: 317101` |

      Die mittlere Sonde ist der Unterschied: 45 KiB lagen über der alten
      8-KiB-Grenze, die alte Fassung hätte `413` geantwortet. Die dritte ist
      die Positivkontrolle — ohne sie wäre „kein 413" auch dann grün, wenn die
      Grenze schlicht verschwunden wäre. Und die Aktionen stehen namentlich im
      Log statt dreimal `ohne`.

      **Fremd-Review 02.09. — der Fix hatte denselben Fehler eine Ebene höher.**
      Zwei unabhängige Reviewer (gemini, plus ein Haus-Reviewer) fanden
      denselben Kern: `meldung.status` war im Betrieb **tot**, `index.ts`
      hartkodierte die Statuscodes. Belegt per Mutation — `413` → `400`, der
      413-Zweig auf `200 ok` gedreht, der 405-Wächter gelöscht, `actions` aus
      der Logzeile entfernt: **alle blieben 11/11 grün.** Ausgerechnet dieser
      Status entscheidet, ob das Gerät wiederholt oder endgültig verwirft.

      Ursache war die Zusage selbst: sie las `index.ts` als **Text** und
      grepte auf den Aufruf. Ein Reviewer zeigte, dass sogar ein Datenleck
      (`req.clone()`, Rohrumpf ins Log — mit `device_id`) so hindurchkam.

      Behoben: der Handler liegt jetzt als `behandleAnfrage` in `meldung.ts`
      und wird **ausgeführt** geprüft — echte `Request`, echte Antwort, echte
      Logzeile. `index.ts` ist ein dreizeiliges `Deno.serve` und entscheidet
      nichts mehr. Alle sieben Mutationen oben röten jetzt, das Leck
      eingeschlossen. 17 Zusagen statt 11.

      Zwei kleinere Befunde mit übernommen: `RUMPF_GRENZE` zählt
      UTF-16-Einheiten, nicht Bytes (bis zu 768 KiB — kein Schutzloch, weil
      `req.text()` vorher ohnehin voll puffert; im Kommentar richtiggestellt,
      denn `TextEncoder` legte eine zweite Kopie an und machte es schlimmer),
      und die Herstellerverweise standen als Zeilennummern da, sechs davon 1
      bis 118 Zeilen daneben — jetzt Symbolnamen, die beim nächsten
      Plugin-Update nicht driften.

      Nicht übernommen: die Rumpfgrenze auf 128 KiB zu senken (gemini,
      MITTEL). Die Grenze ist nicht die DoS-Kontrolle — `req.text()` puffert
      davor —, und `413` ist endgültiger Verlust. Bei dieser Fehlerrichtung ist
      Luft nach oben das sichere Ende.

      **Nachgezogen 02.09.: dieselbe Naht in den zwei Nachbarn** (Donald: „zieh
      das nach"). Das Quelltext-Grep-Muster steckte auch in `ota-update` und
      `send-push`.

      * **`ota-update`** — Handler nach `antwort.ts` als `behandleAnfrage`,
        ausgeführt geprüft. Ungedeckt waren der 405-Wächter, der `catch` auf
        `req.json()` und der `content-type`. Der Statusfehler von `ota-stats`
        existierte hier **nicht**: `ergebnis.status` wurde bereits konsumiert.
      * **`send-push`** — die Torwächter nach `aufruf.ts` als `pruefeAufruf`.
        Das war der wertvollere Fund: die **Webhook-Authentifizierung**
        (`timingSafeEqual`, 401) hatte **null** Abdeckung, ebenso das fehlende
        Secret (500) und die Weiche Webhook/Wiederholungslauf. Alle
        bestehenden Zusagen der Function galten `anbieter.ts` und
        `nachrichten.ts`.

      **Zehn Mutationen, zehnmal rot** — darunter „401 → 200", „Vergleich
      übersprungen", „Status hartkodiert". Die Sonde selbst brauchte dabei eine
      Positivkontrolle: eine syntaktisch kaputte Mutante lief gar nicht und sah
      im ersten Anlauf wie GRÜN aus.

      Eine **beabsichtigte** Verhaltensänderung: ein Rumpf `null` warf vorher in
      `aufruf.record?.id` eine `TypeError` und wurde zu 500; jetzt ist es ein
      400, und es ist zugesagt.

      **Offen geblieben:** `Zustellung` liegt weiter in `send-push/index.ts`,
      und die Zusage auf `apnsMitHostErkennung` grept dort noch Quelltext. Das
      herauszulösen wäre ein Umbau der Zustellschleife — verhaltenstragender
      Code, keine Testgerüste. Bewusst nicht mitgenommen.
- [x] Und einmal der Rückweg: ein absichtlich defektes Bündel ausliefern, Gerät
      landet wieder auf der vorigen Fassung. Ein Rückweg, den nie jemand
      ausgelöst hat, ist eine Behauptung.

      **Ausgelöst 03.09., iPhone 17 Pro, iOS 26.6 — und zwar wirklich.** Die
      Reihenfolge aus dem Runbook ist gelaufen: `0.0.0+600dfee1` heil und mit
      Marke, am Gerät übernommen und bestätigt (`Updated to bundle` →
      `Version successfully loaded` → `[notifyAppReady was called]`, Status von
      `pending` auf `success`); erst danach `0.0.0+defec7ed`.

      Dass das defekte Bündel **wirklich lief**, ist die Stelle, an der der
      Beleg sonst schief hängt — im Log steht sie namentlich:

      ```
      Updated to bundle: … "version": "0.0.0+defec7ed"
      endBackGroundTaskWithNotif Kein Buendel fuer diese Schale current: 0.0.0+defec7ed
      [error] notifyAppReady was not called, roll back current bundle: … defec7ed
      Storing info for bundle [TVwx3d82Pa] … "status": "error"
      ```

      Und die Zugabe, zweimal hintereinander gemessen (Gesten 4 und 5):
      `Latest version is in error state. Aborting update. current: 0.0.0+600dfee1
      latestVersionName: 0.0.0+defec7ed` — `defec7ed` bleibt im Manifest das
      neueste und wird trotzdem liegen gelassen. `autoDeleteFailed: false`
      greift.

      **Zweite Belegseite, `ota-stats`, unabhängig und deckungsgleich** (alle
      Zeilen nach Probenbeginn 14:34:12 UTC):

      | UTC | Aktionen |
      |---|---|
      | 14:34:56 | `download_complete, set_next` |
      | 14:35:12 | `set`, **`webview_javascript_error`**, `page_loaded` |
      | 14:35:32 | **`app_launch_timeout, update_fail, set`** |
      | 14:36:08 | `download_fail` |
      | 14:36:14 | `download_fail` |

      `webview_javascript_error` ist der Griff selbst: `#root` fehlt,
      `main.tsx` wirft an `document.getElementById("root")!`. Die Seite lädt
      (`page_loaded`), nur bestätigt sie nie.

      **Abweichung vom Runbook §3b:** dort steht `update_fail`/**`revert`** als
      erwartetes Paar. Das echte Gerät schreibt `update_fail`/**`set`**.
      Inhaltlich dasselbe; wer nach `revert` grept, findet nur die
      Nachstellung vom 02.09. §3b ist entsprechend berichtigt.

      **Die Falle, die diesen Lauf einen Anlauf gekostet hat — und die im
      Runbook fehlte.** Der erste Rückfallpunkt `0.0.0+600dfeed` ist
      gescheitert und musste durch `600dfee1` ersetzt werden. Nicht am Bündel:
      dasselbe `dist/` rendert im Browser vollständig samt Marke, ohne
      Konsolenfehler, und der Download aufs Gerät war heil
      (`download_complete`, nicht `download_fail`). Gescheitert ist es an
      **drei Hintergrundwechseln im Vier-Sekunden-Takt** innerhalb der
      Zehn-Sekunden-Frist: dreimal `webview_unclean_restart`, jedes Mal
      `page_loaded` ohne `app_launch_ready`, dann `app_launch_timeout` →
      `update_fail`. Danach führt das Gerät die Kennung dauerhaft als ERROR,
      und sie ist verbrannt — ein zweiter Versuch darunter wäre zusätzlich der
      Upsert aus §1.

      Der Grund, warum das passiert: die Übernahme braucht **zwei getrennte
      Runden** — eine, die lädt (`download_complete` → `set_next`), und eine,
      die übernimmt. Das Runbook sagte „einmal mehr schliessen und öffnen als
      man erwartet", aber nicht, dass jeder weitere Wechsel die Frist des
      frisch gestarteten Bündels **zurücksetzt**. Nach dem Öffnen in Runde 2
      gehört die App 20 Sekunden in Ruhe gelassen. §2 und §3 sagen das jetzt.

      **Vorbereitet 02.09. abends — in der Fassung von heute Mittag hätte die
      Probe nichts belegt.** Drei Befunde, alle am Manifest bzw. am lebenden
      Endpunkt gemessen, alle im Runbook (`geraetesitzung-d5.md`) nachgezogen:

      * **Der Rückfall trug keine Marke mehr.** Das neueste Bündel ist
        `8d3cd941f991`, ein normaler CI-Bau; die Marke aus Probe 1
        (`feedbeef`) liegt sechs Bündel darunter. Der Beleg für Schritt 3 wäre
        auf „der Bildschirm ist nicht weiss" zusammengefallen — und genauso
        sieht es aus, wenn das defekte Bündel **nie installiert** wurde. Probe
        2 veröffentlicht deshalb zuerst ein markiertes gutes Bündel
        (`600dfeed`), dann erst `defec7ed`.
      * **Das Manifest bewegt sich von allein.** `deploy.yml:715` veröffentlicht
        bei **jedem** `main`-Push ein Bündel, auch bei einem Doku-Commit —
        sechs Stück zwischen 14:03 und 16:04. Ein Merge während Probe 2 macht
        `defec7ed` still zum Vorletzten und nimmt Schritt 4 den
        `autoDeleteFailed`-Beleg. Also Merge-Sperre für die Dauer der Probe;
        umgekehrt räumt der nächste Merge `defec7ed` von selbst ab.
      * **Die Aufräum-Kennung des Runbooks war belegt.** §4 veröffentlichte
        unter `c1ea4ed0` — seit 12:47 im Manifest. Der Lauf wäre ein Upsert mit
        altem `created_at` gewesen, also **nicht** das neueste Bündel: das
        Aufräumen hätte grün ausgesehen und nichts aufgeräumt. Jetzt `c1ea4ed2`,
        als frei geprüft (23 Bündel im Manifest, keines trägt sie).

      **Die zweite Belegseite ist am ausgelieferten Artefakt nachgestellt**,
      nicht am Quelltext gelesen: ein Stapel gegen den PROD-Endpunkt ergab
      02.09. um 18:54:17 UTC
      `{"fn":"ota-stats","event":"gemeldet","gesamt":2,"actions":["update_fail","revert"]}`.
      Die Senke benennt die Aktionen also wirklich, statt wie bis heute Mittag
      `action: "ohne"` zu schreiben. **Diese eine Zeile stammt von der Probe,
      nicht vom Gerät** — der Beleg für Probe 2 ist nur eine Zeile *nach* deren
      Beginn.

      Der Lesepfad dafür steht als Befehl im Runbook (§3b) und ist wörtlich aus
      der Datei heraus ausgeführt. Fünf stille Fallen dabei, die erste neu:
      **ohne `iso_timestamp_end` antwortet die API `{"result":[]}`**, obwohl sie
      „defaults to the current time" zusagt; das 24-h-Fenster schneidet das
      **Ende** ab (eine 31-h-Spanne verschwieg alles nach Stunde 24 und sah aus
      wie „Gerät sendet nicht mehr"); die Aufnahme hinkt Minuten hinterher;
      `edge_logs` ist die falsche Quelle; und der Supabase-MCP ist gesperrt, der
      Weg ist die Management-API mit `SUPABASE_ACCESS_TOKEN` aus Infisical dev.

## Phase E — Abnahme

Die Liste des Issues, jede Zeile auf **echter Hardware**, nicht im Simulator.

> ### Androidlauf 03.09. — Pixel 11 Pro, Android 17 (SDK 37)
>
> Sieben Punkte belegt, **zwei Fehler gefunden**, beide reproduziert und mit
> Positivkontrolle. Werkzeuge: `adb` aus `~/Library/Android/sdk/platform-tools`
> (nicht im PATH), und **JDK 21** — das JBR von Android Studio ist Java 25, an
> dem Gradle 8.14.3 mit `Unsupported class file major version 69` abbricht.
>
> **Vorher war `@capgo/capacitor-updater` in der Android-Schale gar nicht
> verdrahtet.** In `package.json` stand es, in `android/capacitor.settings.gradle`
> nicht — jeder Android-Bau lief ohne Luftweg, und der Fehlermodus war
> Schweigen. `cap sync android` hat es nachgezogen; die beiden Gradle-Dateien
> sind Teil dieses Commits.

- [x] Beide Apps starten auf echten Geräten. **Android 03.09.** (iOS seit D5).
- [ ] Anmelden, Feed, Chat, Profil bearbeiten, Bild hochladen — je einmal auf
      iOS und Android.

      **Android 03.09.: alles bis auf den Bildupload.** Anmelden, Nachrichten-
      liste, Konversation, Profil und „Profil bearbeiten" laden vollständig.

      **⛔ Der Bildupload bricht still ab.** Gemessen zweimal, mit Zählpunkten
      davor und danach: Bucket `avatars` **61 Dateien vorher, 61 nachher**,
      neuestes Objekt unverändert vom 27.08., `profiles.avatar_url` bleibt
      leer. Keine Fehlermeldung, kein Eintrag im Log.

      Der Ablauf: Der gemeinsame Dialog („Aufnehmen" / „Aus der Mediathek")
      erscheint, der System-Photo-Picker öffnet — **ohne** Berechtigungsabfrage,
      das ist richtig so. Nach der Bildauswahl kommt **kein Zuschnitt-Fenster**;
      die App landet auf der Startseite. Im Log steht dazu genau ein Ereignis:
      `webview_dom_content_loaded` — **die WebView lädt neu**, der React-Zustand
      ist weg, und der Ablauf, der nach der Auswahl weitergehen müsste, existiert
      nicht mehr.

      **Capgo ist ausgeschlossen** (`No new version available`, `Kein Buendel
      fuer diese Schale`); der Prozess überlebt durchgehend. Belegt ist damit
      der Reload, **nicht** seine Ursache — die naheliegende Erklärung ist, dass
      Android die Activity zerstört, während der Picker im Vordergrund liegt.
      Das ist noch zu graben.

      **Die Tragweite reicht über den Avatar hinaus:** derselbe Mechanismus
      trifft jeden Ablauf, der die App verlässt und zurückkommt — Kamera,
      Dateiauswahl, ein externer Login.
- [x] Die Sitzung überlebt einen Neustart der App auf beiden Plattformen.
      **Android 03.09.:** harter `am force-stop` (Prozess nachweislich weg),
      danach Neustart — weiterhin angemeldet. Der Storage-Umbau greift sichtbar:
      `Preferences set` mit `sb-…-auth-token` beim Anmelden, `Preferences get`
      beim Start. Nicht `localStorage`.
- [ ] Eine bestehende Web-Sitzung ist nach dem Storage-Umbau weiterhin angemeldet.
- [x] Kein Inhalt unter Notch oder Home-Indikator. **Android 03.09.:** System
      meldet einen Cutout von 172 px oben (Punch-Hole bei x=494–586); der
      App-Header liegt darunter, die Fußzeile über dem Gestenbalken.

      Notiz, kein Mangel: in Screenshots sind die **Systemleisten-Icons** auf
      dem hellen Hintergrund kaum zu erkennen. Am Gerät sind sie laut Donald
      lesbar — der Screenshot übertreibt den Kontrastverlust.
- [x] Android-Zurück navigiert, statt die App zu schließen. **03.09., beide
      Fälle:** auf einer Unterseite zurück zur Startseite, App läuft weiter; auf
      der Wurzelseite zum Launcher, **Prozess lebt weiter** statt abgewürgt zu
      werden.
- [ ] Realtime im Chat funktioniert im Vordergrund.

      Offen und **nicht allein messbar**: dafür muss jemand schreiben, während
      die App offen ist. Ein Log-Beleg genügt nicht — Supabase Realtime läuft in
      der WebView und schreibt nicht ins logcat.

### ✅ Android: die Push-Erlaubnis tötete die App — behoben 04.09.

**Der Befund vom 03.09.:** wer „Erlauben" tippte, konnte die App danach nicht
mehr starten. Reproduziert, mit Positivkontrolle: Berechtigung entzogen → App
startet; Berechtigung erteilt → Prozess stirbt beim Start.

```
FATAL EXCEPTION: CapacitorPlugins
java.lang.IllegalStateException: Default FirebaseApp is not initialized in this process
  at com.google.firebase.messaging.FirebaseMessaging.getInstance
  at PushNotificationsPlugin.register(PushNotificationsPlugin.java:103)
```

Der Dialog erschien beim Öffnen der Nachrichten (`pushEinrichten`); danach
genügte `AppShell.tsx:662` (`pushLebenszeichen` beim Start), um den Absturz bei
**jedem weiteren Start** auszulösen, ohne dass noch jemand etwas antippte.

**Das `try/catch` in `src/lib/push.ts:82` konnte das prinzipiell nicht fangen.**
Die Exception fliegt auf Capacitors nativem Plugin-Thread (`HandlerThread.run`),
nicht im JS-Kontext — sie tötet den Prozess, bevor ein JS-Handler sie sieht.

#### Die Ursache lag eine Ebene tiefer als vermutet

Am 03.09. stand hier „`google-services.json` fehlt". Das stimmte, war aber nicht
der Grund, sondern die Folge. Gemessen am 04.09. gegen die Firebase-Management-API:

```
GET firebase.googleapis.com/v1beta1/projects/effbeezee-f9b48/androidApps → 200 {}
```

**Im Firebase-Projekt war gar keine Android-App registriert.** Es gab die Datei
nicht, weil es das Gegenstück nicht gab. Dass FCM am 28.08. als „authentifiziert"
belegt wurde (`400 INVALID_ARGUMENT` auf ein erfundenes Token), widerspricht dem
nicht: die v1-Sende-API antwortet auf Projektebene und sagt über registrierte
Apps nichts. Der Beleg deckte die Senderseite, nie die Empfängerseite.

- [x] **Android-App im Firebase-Projekt registrieren.** Per
      `androidApps.create` mit dem Dienstkonto aus `FCM_SERVICE_ACCOUNT` —
      `testIamPermissions` wies `firebase.clients.create` vorher aus, geraten
      wurde nichts. App-ID `1:837618406403:android:764720a952fb886c5aea36`.
      Ein SHA-1-Fingerabdruck ist **nicht** nötig; den verlangt Google Sign-In,
      nicht FCM.
- [x] **Die Konfiguration kommt aus Infisical, nicht aus dem Repo.**
      `GOOGLE_SERVICES_JSON` (Umgebung `dev`) → `pnpm android:firebase` schreibt
      `android/app/google-services.json`. Die Datei steht in `.gitignore` und
      wird vom `native-secrets-guard` gemeldet; nach dem Erzeugen bleibt er
      grün bei 1462 Dateien — ignorierte Pfade sind dort absichtlich aussen vor
      (siehe B2).

      **`prod` trägt den Wert nicht.** `infisical secrets set --env=prod` ist aus
      Claude Code heraus geblockt. Es ist ein einziges Firebase-Projekt für
      beide Umgebungen, also derselbe Wert — Donald muss ihn nachtragen.
- [x] **RED gemessen**, nicht behauptet: gegen einen Stub, der immer
      `{fehler: null}` gibt, waren **6 von 7** Zusagen in
      `firebase-config.logic.test.ts` rot — und die eine grüne war genau die
      Positivkontrolle „lässt die passende Konfiguration durch". Nach der
      Umsetzung 7/7.

      Geprüft wird **eine** Sache, und zwar die, die der Gradle-Lauf nicht
      prüft: dass die Projektkennung der Datei die des Dienstkontos ist. Ein
      falscher *Paketname* bricht den Bau von selbst ab („No matching client
      found for package name") — das doppelt zu prüfen wäre Ballast. Die
      Konfiguration eines **fremden** Projekts mit demselben Paketnamen baut
      dagegen sauber durch, und der Fehler fiele erst auf, wenn FCM
      `SenderId mismatch` antwortet.
- [x] **Fehlt die Datei, bricht der Bau** (Donalds Entscheidung, 04.09.).
      Capacitors Vorlage stand als `try`/`catch` mit einer `logger.info`-Zeile
      in `android/app/build.gradle` — sie baute schweigend eine Schale, die auf
      dem Gerät stirbt. Jetzt eine `GradleException`, die den Befehl nennt.
      *Positivkontrolle vor dem Erzeugen der Datei:* `./gradlew :app:help` →
      `BUILD FAILED`, `build.gradle` Zeile 62, mit
      `infisical run --env=dev -- pnpm android:firebase` im Text.

      Der Preis ist benannt und angenommen: ohne das Secret lässt sich Android
      nicht mehr bauen.
- [x] **Beleg am Artefakt, nicht an der Eingabe.** `aapt2 dump resources` auf
      `app-debug.apk`: `google_app_id`, `gcm_defaultSenderId 837618406403`,
      `project_id effbeezee-f9b48` liegen im gebauten Paket.
- [x] **Beleg am Gerät (Pixel 11 Pro, 04.09.).** Erlaubnis per
      `pm grant … POST_NOTIFICATIONS` erteilt — sie stand auf `USER_FIXED`, die
      App hätte selbst nicht mehr fragen dürfen. Dann **drei Kaltstarts**
      (`am force-stop` je davor): drei lebende Prozesse, **0 FATAL** im
      `crash`-Puffer, dreimal `[push] Token abgelegt, Plattform android`. Genau
      der Fehlermodus, der bisher jeden *weiteren* Start tötete.
- [x] **Beleg auf PROD:** `push_tokens` trägt erstmals eine `android`-Zeile,
      `created_at` 07:19:15 UTC — dieselbe Sekunde wie die Logzeile. Eine Zeile,
      nicht zwei: die doppelte `registration` beim Start ist ein Upsert.
- [x] **Die Zustellung selbst — belegt 04.09., 09:30 UTC+2.** Donald hat
      `.gstack/run-android-push-probe.sh` ausgelöst; das Werkzeug benutzt
      `fcmKoerper` und `baueBenachrichtigung` aus `send-push` selbst, nicht
      einen Nachbau.

      ```
      HTTP 200 {"name":"projects/effbeezee-f9b48/messages/0:1788507051231731%…"}
      bewerteFcm: {"ergebnis":"zugestellt","grund":null}
      ```

      **Und `200` allein wäre kein Beleg** — es heisst „von FCM angenommen",
      nicht „angezeigt". Auf dem Gerät nachgemessen: `FirebaseMessaging` in
      logcat eine Sekunde später, zwei aktive Mitteilungen des Pakets, und im
      Screenshot der Mitteilungsleiste steht „**Neue Nachricht** — Androidprobe
      hat Ihnen geschrieben." mit dem Markensymbol. Damit ist die Kette
      Token → FCM → Gerät → Anzeige geschlossen.

#### Nebenbefund derselben Messung: die App deklariert keinen Mitteilungskanal

Gefunden, weil `dumpsys notification` mitgelesen wurde — nicht gesucht:

```
channel=fcm_fallback_notification_channel  importance=3
sound=null  vibrate=null  defaults=0
```

logcat dazu: `Missing Default Notification Channel metadata in AndroidManifest`.

Die Mitteilung landet in dem Kanal, den **FCM selbst anlegt**, weil die App
keinen benennt (`com.google.firebase.messaging.default_notification_channel_id`
fehlt im Manifest). Zwei Folgen, beide gemessen, keine davon ein Ausfall:

1. **`default_sound: true` in `fcmKoerper` ist auf Android 8+ wirkungslos.** Ton
   und Vibration sind dort Eigenschaften des KANALS, nicht der Nachricht — daher
   `sound=null vibrate=null defaults=0`. Der Wert steht im Code und tut nichts.

   **Korrektur vom Nachmittag, gemessen:** der Fallback-Kanal ist **nicht**
   tonlos. Er trägt `mSound=content://settings/system/notification_sound`; die
   drei Nullen oben sind Felder der NACHRICHT, nicht des Kanals. Was ihm fehlt,
   ist `mVibrationEnabled=false` und `mImportance=3` — also Vibration und
   Einblendung, nicht der Ton. Die Behauptung „deshalb kam die Testzustellung
   stumm an" hält der Messung damit nicht stand und ist hiermit zurückgenommen.
2. **In den Systemeinstellungen heisst der Kanal „Sonstiges".** Wer die
   Mitteilungen der App feiner einstellen will, findet keinen Namen, der etwas
   bedeutet — und eine spätere Trennung nach Nachricht / Kontaktanfrage ist ohne
   eigene Kanäle gar nicht möglich.

**Eigener Vorgang, nicht hier.** Push funktioniert; das ist eine Frage der
Güte, nicht der Funktion, und sie berührt iOS nicht (Kanäle gibt es dort nicht).

##### Nachtrag 04.09.: doch hier — der Kanal ist gebaut, der Beleg steht aus

Donald hat den Vorgang am 04.09. hierher gezogen, klein und abgegrenzt. Gebaut
ist er, am Gerät gemessen ist er noch **nicht** — dieser Abschnitt trennt
beides ausdrücklich.

- [x] `com.google.firebase.messaging.default_notification_channel_id` steht als
      `<meta-data>` im `AndroidManifest.xml`. Die Datei ist nicht von
      `cap sync` erzeugt; die Kamera-Rechte stehen schon von Hand darin.
- [x] Der Kanal wird angelegt: `pushKanalAnlegen()` in `src/lib/push.ts`, über
      `createChannel()` des Push-Plugins — kein nativer Code. Gerufen in
      `AppShell.tsx` **beim Montieren, ohne Bedingung**: nicht am Konto, nicht
      an der Erlaubnis, nicht am Öffnen der Nachrichten. Ein Kanal, den es zum
      Zustellzeitpunkt nicht gibt, fällt auf den Fallback zurück, und die
      Mitteilung ist dann schon stumm angekommen.
- [x] **Ein** Kanal, `id=mitteilungen`, Name „Nachrichten und
      Kontaktanfragen". Keine Trennung nach Art — ein abgeschalteter Kanal
      lässt sich aus der App nie wieder einschalten.
- [x] `importance: 4` (HIGH: Ton und Einblendung). Der Versand setzt
      `priority: "high"`, damit die Nachricht nicht bis zum nächsten
      Doze-Wartungsfenster liegen bleibt — käme sie dann lautlos an, wäre dafür
      nichts gewonnen. Herunterstellen kann das Mitglied selbst; von der App
      aus geht es nach dem Anlegen in keine Richtung mehr.
- [x] `vibration: true` **ausdrücklich**, und das ist der eine nicht
      offensichtliche Griff: Capacitors `NotificationChannelManager` liest das
      Feld mit dem Vorgabewert **false** und ruft dann `enableVibration(false)`
      — anders als Android selbst, wo ein Kanal dieser Stufe vibriert. Ohne die
      Zeile bliebe `vibrate=null` genau so bestehen, wie oben gemessen.
- [x] **Kein** `sound`: ohne den Schlüssel ruft die Brücke `setSound` gar nicht
      erst, und der Kanal behält den Standardton des Systems. Ein Wert dort
      verlangte eine eigene Datei unter `res/raw` — und ein `sound` ohne diese
      Datei wäre ein stummer Kanal, also derselbe Ausgang wie vorher.
- [x] `default_sound: true` in `fcmKoerper` bleibt **stehen**. Es ist nicht tot:
      unterhalb von Android 8 gibt es keine Kanäle, dort greift es weiterhin,
      und `minSdkVersion = 24` (`android/variables.gradle`) reicht bis
      Android 7.0 — API 24 und 25 liegen darunter. Auf denselben Geräten
      antwortet `createChannel` mit `unavailable` — deshalb fängt
      `pushKanalAnlegen` und gibt `"fehler"` zurück, statt den Start aufzuhalten.
- [x] Die Kennung steht an zwei Stellen und wird zusammengehalten:
      `src/lib/push.kanal.test.ts` liest das Manifest und vergleicht mit
      `PUSH_KANAL_ID`. Ohne diese Prüfung ist eine Abweichung stumm — FCM legt
      sich wieder seinen Fallback an, der eigene Kanal steht ungenutzt daneben.
- [x] Gegenprobe gefahren, vier Mutationen, alle rot: Manifestwert verstellt ·
      `<meta-data>` ganz entfernt · `vibration: true` entfernt · den Aufruf aus
      `AppShell` entfernt. Danach wieder grün.
- [x] `pnpm typecheck`, `pnpm lint` (0 Fehler), `pnpm test` (221 Dateien,
      2.495 Tests) grün; `prettier --check` auf den berührten Dateien sauber.
      `pnpm format:check` ist repoweit schon vorher rot (323 Dateien) — nicht
      von diesem Diff.
- [x] **Der Kanal ist am Gerät belegt — 04.09., 16:42, Pixel 11 Pro.** Und er
      brauchte dafür keine Zustellung: `dumpsys notification` führt die Kanäle
      eines Pakets unter `AppSettings:` auf, unabhängig davon, ob je etwas
      angekommen ist. Damit ist die Messung von der blockierten Sonde
      **entkoppelt**.

      *Vorher*, aus dem laufenden Bau von 09:19 — die Positivkontrolle, am
      selben Gerät genommen, nicht aus dem Protokoll übernommen:

      ```
      AppSettings: com.effbeezee.app  importance=DEFAULT userSet=true
        NotificationChannel{mId='fcm_fallback_notification_channel',
          mName=Miscellaneous, mImportance=3, mVibrationEnabled=false}
      ```

      Genau ein Kanal, und es ist der von FCM.

      *Nachher*, nachdem das Bündel mit dem Kanal lief:

      ```
      NotificationChannel{mId='mitteilungen',
        mName=Nachrichten und Kontaktanfragen, mDescription=hasDescription,
        mImportance=4, mSound=content://settings/system/notification_sound,
        mVibrationEnabled=true, mDeleted=false}
      ```

      Drei Zusagen dieses Vorgangs stehen damit **gemessen** da, nicht
      begründet: `mImportance=4`, `mVibrationEnabled=true` (ohne die
      ausdrückliche Zeile stünde hier `false`, wie beim Fallback daneben) und
      `mSound=…/notification_sound` — der Standardton des Systems, **weil**
      kein `sound` übergeben wurde.
- [x] Auch die Deklaration ist am **Artefakt** belegt, nicht an der Quelle:
      `aapt2 dump xmltree --file AndroidManifest.xml app-debug.apk` zeigt
      `…default_notification_channel_id` mit `="mitteilungen"` (Zeile 109).
- [x] **Und die zugestellte Mitteilung trägt ihn — 04.09., 17:11:15.** Donald
      hat die Sonde ausgelöst (`HTTP 200`, `bewerteFcm {"ergebnis":"zugestellt"}`),
      danach am Gerät gemessen:

      ```
      NotificationRecord  pkg=com.effbeezee.app  tag=FCM-Notification:112503055
        Notification(channel=mitteilungen …)   importance=4
      ```

      **Die beste Gegenprobe liefert dasselbe Gerät gleich mit:** die
      Zustellung vom Vormittag liegt noch in der Leiste und trägt weiterhin
      `tag=FCM-Notification:84878922 … channel=fcm_fallback_notification_channel`.
      Zwei Zustellungen, dieselbe App, dasselbe Gerät, verschiedene Kanäle —
      vorher und nachher nebeneinander, nicht nacheinander behauptet.

      `importance=4` **am Datensatz** (vormittags stand dort `3`) ist der
      Beleg, dass die Einstufung wirklich vom Kanal kommt und nicht vom
      Versand: an `fcmKoerper` hat sich nichts geändert.

      `vibrate=null sound=null defaults=0` steht weiterhin an der Mitteilung —
      und das ist **richtig so**, kein Rest: es sind Felder der NACHRICHT, und
      seit Android 8 entscheidet der Kanal. Genau das war der Befund.

      *Nicht gemessen:* ob es hörbar geklingelt hat. Der Dump führt in dieser
      Fassung kein `mLastAudiblyAlertedMs`. Kanal, Stufe und
      `mVibrationEnabled=true` stehen; das Ohr am Gerät ist Donalds.
- [x] Der Fallback-Kanal bleibt als Objekt liegen (`AppSettings` führt ihn
      weiter) — er wird nur nicht mehr benutzt. Löschen wäre möglich, ist aber
      nicht nötig und nicht Teil dieses Vorgangs.

      Für Wiederholungen steht die Sonde hier:

      ```bash
      adb shell dumpsys notification --noredact | grep -i effbeezee
      ```

      Erwartet: `channel=mitteilungen`, **nicht**
      `fcm_fallback_notification_channel`, dazu `vibrate` ungleich `null`.
      *Die Positivkontrolle steht oben* — der Fallback ist als Vorzustand
      protokolliert und muss sich ändern. Aus Claude Code heraus lässt sich das
      Werkzeug nicht starten (der Klassifikator blockt jeden sendenden Lauf
      unter `--env=prod`); Donald löst es aus.

      **Zwei Fallen beim Nachmessen.** Der Kanal wird beim Start angelegt: eine
      Zustellung, die vor dem ersten Start der neuen Schale ankommt, trägt noch
      den Fallback. Und ein bereits angelegter Kanal ändert sich durch ein
      erneutes `createChannel` **nicht** — wer Stufe oder Vibration später
      verstellt, sieht die Änderung erst nach dem Deinstallieren der App.

**iOS ist nicht betroffen** und der Diff fasst `ios/` nicht an.

##### Und der teuerste Befund des Nachmittags: `adb install` belegt die Weboberflaeche NICHT

Die erste Messung sagte **„Kanal nicht entstanden"** — nach `assembleDebug`,
`adb install -r` und einem Start. Das war ein **falsches Negativ, erzeugt vom
Messaufbau**, nicht vom Code:

```
APK eingebaut:   assets/public/assets/index-BD2EPi9B.js   ← enthaelt den Kanal
Geraet fuehrt:   index-DYeyA4YQ.js  (capgo-Buendel 95eQQYkgGH)  ← vom Vortag
```

**Capgos gespeichertes Buendel gewinnt gegen die frisch installierte Schale.**
Ein `adb install` tauscht die native Huelle; die Weboberflaeche kommt weiter aus
`files/versions/<id>/`. Wer nach dem Installieren misst, misst den Stand von
vorgestern und haelt seine Aenderung fuer wirkungslos.

Erkennbar ist es an genau zwei Zeilen im logcat — und nur an ihnen:

```
CapgoUpdater: notifyAppReady was called. This is fine: <buendel-id>
Capacitor/Console: File: https://localhost/assets/index-XXXX.js
```

Steht dort eine andere `index-*.js` als in der APK (`unzip -l app-debug.apk`),
laeuft OTA-Code. **Vor jeder Messung am Geraet diese beiden Werte
gegeneinanderhalten** — sonst prueft man Eingaben statt des Artefakts.

**Was NICHT hilft:** `am force-stop` und neu starten. Einmal gefahren, das
Buendel blieb dasselbe. Capgo haengt an Hintergrund/Vordergrund, nicht am
Prozesstod.

**Was half:** die zwei Runden aus D5 — `KEYCODE_HOME`, ~8 s, wieder oeffnen,
dann **25 s nichts anfassen**. Danach lief `wi3AmIcidl` / `index-Cvttx3UQ.js`
mit `notifyAppReady` bestaetigt. Das Buendel war zu diesem Zeitpunkt bereits
geladen (16:39, waehrend des ersten Starts) und wartete auf die Uebernahme.

**Was NICHT noetig war und die Anmeldung gekostet haette:** `pm clear`. Die
Sitzung liegt in `shared_prefs/CapacitorStorage.xml` unter genau einem
Schluessel; ein `pm clear` haette sie mitgenommen und den Bildupload-Test
(Aufgabe 2) blockiert, der eine Anmeldung braucht.

*Nebenbei, aus demselben Log:* dieser **Debug**-Bau schreibt die vollstaendige
Supabase-Sitzung ins logcat — Capacitors ausfuehrliche Plugin-Protokollierung
gibt `Preferences.get` samt Ergebnis aus. Kein Fund fuer die Oeffentlichkeit,
aber vor der Store-Einreichung am **Release**-Bau gegenzupruefen, dass die
Stufe dort wirklich aus ist. Eigener Vorgang, nicht hier.

- [x] Eintrittsbündel gemessen unter 1.024 kB roh (Grundlinie 1.181,77 kB).
      **Gemessen 02.09. am ausgelieferten Artefakt** (`app.effbeezee.com`,
      `2c6e86a`) statt an einem Bau auf der eigenen Maschine — ein Bau ohne
      Secrets unterschätzt es um 168 kB, siehe A2, Beleg 1:
      **813,32 kB roh / 253,03 kB gzip.** Unter 1.024 kB, Abstand 210,68 kB.
      Die einzige Zeile dieser Phase, die kein Gerät braucht: dieselbe Datei
      lädt die Schale.
- [x] OTA einmal durchgespielt. Siehe D5 — `0.0.0+feedbeef` am 02.09. auf dem
      iPhone 17 Pro, und der Rückweg am 03.09. Aufgeräumt ist es auch:
      **`0.0.0+c1ea4ed2` liegt ohne Marke obenauf** (Probe 3, 03.09. 14:38 UTC
      — am Endpunkt gegengeprüft, und am Gerät ist der rote Balken nach zwei
      Gesten weg). Damit ist zugleich belegt, dass das Gerät nach dem Rückfall
      wieder normal aktualisiert und nur `defec7ed` liegen lässt.

## Vor dem Abschluss

- [ ] `openspec validate --all` grün.
- [ ] `REVIEWS.md`: mindestens zwei Reviewer **fremder** Anbieter, vor der
      ersten Codezeile.
- [ ] Code-Review auf den Diff, nicht auf den Plan.
- [ ] `openspec archive capacitor-huelle`.
