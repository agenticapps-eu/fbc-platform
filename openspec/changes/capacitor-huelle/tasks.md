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
      `url`, `checksum` und `sessionKey` schreiben. Das ist capgos „end to end
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
        `checksum_required` ab; fehlte `sessionKey`, gälte die Verschlüsselung
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

**Runbook: `geraetesitzung-d5.md`** (31.08.). Die drei Proben tragen sprechende
Fassungen — `0.0.0+600df00d` heil, `0.0.0+defec7ed` defekt, `0.0.0+c1ea4ed0`
das Aufräumen —, die Griffe sind am gebauten `dist/` gemessen und fassen
**keine Quelldatei** an. Die Falle, die dort ganz oben steht: eine Probe unter
einer BEREITS eingetragenen Fassung ist ein Upsert und überschreibt das gute
Bündel.

- [ ] Eine sichtbare Änderung erreicht ein Gerät ohne Store-Einreichung —
      einmal vollständig durchgespielt.
- [ ] Und einmal der Rückweg: ein absichtlich defektes Bündel ausliefern, Gerät
      landet wieder auf der vorigen Fassung. Ein Rückweg, den nie jemand
      ausgelöst hat, ist eine Behauptung.

## Phase E — Abnahme

Die Liste des Issues, jede Zeile auf **echter Hardware**, nicht im Simulator.

- [ ] Beide Apps starten auf echten Geräten.
- [ ] Anmelden, Feed, Chat, Profil bearbeiten, Bild hochladen — je einmal auf
      iOS und Android.
- [ ] Die Sitzung überlebt einen Neustart der App auf beiden Plattformen.
- [ ] Eine bestehende Web-Sitzung ist nach dem Storage-Umbau weiterhin angemeldet.
- [ ] Kein Inhalt unter Notch oder Home-Indikator.
- [ ] Android-Zurück navigiert, statt die App zu schließen.
- [ ] Realtime im Chat funktioniert im Vordergrund.
- [ ] Eintrittsbündel gemessen unter 1.024 kB roh (Grundlinie 1.181,77 kB).
- [ ] OTA einmal durchgespielt.

## Vor dem Abschluss

- [ ] `openspec validate --all` grün.
- [ ] `REVIEWS.md`: mindestens zwei Reviewer **fremder** Anbieter, vor der
      ersten Codezeile.
- [ ] Code-Review auf den Diff, nicht auf den Plan.
- [ ] `openspec archive capacitor-huelle`.
