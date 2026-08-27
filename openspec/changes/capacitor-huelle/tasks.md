# Tasks — dieselbe Anwendung, in einer nativen Hülle (AGE-642)

Phasiert nach dem, was sie **voraussetzen**. Phase A braucht nichts als dieses
Repository und läuft sofort. Ab Phase B braucht es Xcode, Android Studio und
Konten — siehe „Voraussetzungen" im Proposal. Die Reihenfolge ist bewusst: das
Riskanteste zuerst, solange es noch im Browser prüfbar ist.

## Phase A — im Browser prüfbar, ohne eine Zeile nativen Codes

### A1. Der Sitzungsspeicher zieht um

Die einzige Änderung an bestehendem Code, die schiefgehen kann. Sie kommt
allein und zuerst.

- [ ] `@capacitor/core` und `@capacitor/preferences` als Abhängigkeit. Beide
      sind reine npm-Pakete; für diesen Schritt ist kein natives SDK nötig.
- [ ] **RED**: Test — im Web geht `auth.storage` auf `window.localStorage`,
      **mit demselben `storageKey`** wie bisher. Der Test liest den Schlüssel,
      unter dem eine bestehende Sitzung liegt, und verlangt, dass der Client sie
      danach findet. *Positivkontrolle:* mit einem geänderten Schlüssel muss
      derselbe Test rot werden — sonst prüft er nur, dass irgendetwas liest.
- [ ] **RED**: Test — nativ liest und schreibt der Adapter über `Preferences`,
      und `getItem` gibt den Wert zurück, den `setItem` gelegt hat.
- [ ] **RED**: Test — `removeItem` entfernt den Eintrag **tatsächlich**. Ein
      Adapter, dessen Löschen ins Leere läuft, ergäbe ein Konto, das sich nicht
      abmelden lässt.
- [ ] **`auth.storageKey` auf den heute geltenden Wert festnageln.** Bisher ist
      er der Default der Bibliothek; ein Minor-Upgrade von
      `@supabase/supabase-js`, das das Format ändert, meldete alle Web-Mitglieder
      ab. Der Test darf den Schlüssel **nicht gegen sich selbst** prüfen — er
      trägt den erwarteten Wert als Literal, sonst wandern beide Seiten
      gemeinsam.
- [ ] Weiche in `src/lib/supabase.ts`: `Capacitor.isNativePlatform()` entscheidet.
      Im Web-Zweig **kein** Wrapper — `localStorage` unverändert durchreichen.
- [ ] **Beleg (Browser, nicht jsdom):** vor dem Umbau anmelden, umbauen, Seite
      neu laden, weiterhin angemeldet. Das ist die Abnahme aus dem Issue, und
      sie lässt sich in jsdom nicht führen.
- [ ] **Beleg (Gerät), sobald Phase B steht — nicht erst in Phase E.** Alle drei
      RED-Tests oben laufen in jsdom gegen eine **Attrappe** von `Preferences`.
      Ein Adapter, dessen `removeItem` auf dem Gerät ins Leere läuft, wäre dort
      grün und hier kaputt — genau die Sorte Vakuum-Test, die dieses Repo
      wiederholt getroffen hat. Sobald eine Schale startet: anmelden, App
      beenden, neu starten (angemeldet), abmelden, neu starten (Anmeldung).
      Diese Zeile ist der eigentliche Beweis für A1; die drei jsdom-Tests
      sichern nur die Verdrahtung.

### A2. Die Routen werden geteilt

- [ ] Grundlinie festhalten: `pnpm build`, Größe des Eintrittsbündels roh und
      gzip notieren. Gemessen am 27.08. auf `0dd4b8b`: **1.181,77 kB / 347,78 kB**.
- [ ] **RED**: Test — `navItems` trägt für jede Route weiterhin `path`, `label`
      und `section`, und die Sidebar rendert unverändert. Der Umbau berührt
      `Component`; die Zusage ist, dass er sonst nichts berührt.
- [ ] `Component` in `src/config/nav.ts` auf `lazy()` umstellen; die statischen
      Seitenimporte in `src/App.tsx` ebenso — **außer** `HomeRedirect` und
      `LoginPage`.
- [ ] Ein `Suspense`-Rahmen um den Routen-Block, Fallback ohne Spinner (nur die
      Höhe des Inhaltsbereichs).
- [ ] Admin-Seiten mit umstellen. Das kehrt den Kommentar in `App.tsx:155-161`
      um — **der Kommentar wird mitgeändert**, samt Zahl (61,2 kB
      `RELEASE_EINTRAEGE` über `AdminNeuigkeitenPage.tsx:7`). Ein Kommentar, der
      das Gegenteil des Codes behauptet, ist schlimmer als keiner.
- [ ] Bestehende Routen-Tests auf asynchrones Rendern anpassen, **ohne eine
      einzige Assertion zu lockern**. Das ist Arbeit, keine Nebenwirkung: nach
      `lazy()` findet ein synchrones `getBy*` nichts, bis der Chunk aufgelöst
      ist, und ein Teil der 174 Testdateien rendert Routen heute synchron. Wer
      hier „läuft unverändert durch" hinschreibt, hat die Aufgabe nicht
      geplant, sondern gehofft. Die Anpassung ist mechanisch (`findBy*` statt
      `getBy*`), die Zusagen der Tests bleiben Wort für Wort dieselben.
- [ ] **Beleg 1 (Zahl):** dieselbe Messung nach dem Umbau, mit demselben Befehl.
      Ziel: unter **1.024 kB** roh.
- [ ] **Beleg 2 (Struktur) — als Skript, nicht als Behauptung.** Die Spec
      verspricht „strukturell geprüft"; eine Messung von Hand erfüllt das genau
      einmal und ist bei der nächsten Abhängigkeit wertlos. Also ein Skript, das
      die Source-Map des Eintrittsbündels seinen Quellmodulen zuordnet und
      gegen eine **Erlaubnisliste** prüft: Hülle, Wachen, `HomeRedirect`,
      `HomePage`, `LoginPage`. Alles andere aus `src/pages/` im Eintritt macht
      den Lauf rot. Im CI, neben den übrigen Wächtern.
- [ ] **Nicht geändert, mit Begründung festgehalten:** `/` zeigt einem
      angemeldeten Mitglied **nicht** den Feed, sondern `HomePage` —
      `HomeRedirect.tsx:60-67` gibt sie in jedem Zweig zurück, der einzige
      andere Ausgang ist `/willkommen`. Der Feed liegt auf `/aktivitaet` und
      darf lazy sein. Steht hier, weil die Annahme naheliegt und einmal zu
      einem Befund geführt hat.

## Phase B — das Grundgerüst · braucht Xcode und Android Studio

### B1. Capacitor und die beiden Projekte

- [ ] `@capacitor/ios`, `@capacitor/android`, `capacitor.config.ts`.
      `webDir: "dist"`, App-ID und Anzeigename festlegen.
- [ ] `npx cap add ios` und `npx cap add android`; beide Ordner versionieren.
- [ ] `.gitignore`: Keystore (`*.keystore`, `*.jks`), `key.properties`,
      `google-services.json`, `GoogleService-Info.plist`, `*.p8`,
      `ios/App/Pods/`, `android/.gradle/`, `*/build/`, `DerivedData/`.
- [ ] **`Info.plist`: `NSCameraUsageDescription` und
      `NSPhotoLibraryUsageDescription`, deutsch formuliert.** Ohne sie stürzt
      iOS beim ersten Kameraaufruf ab — zur **Laufzeit**, nicht erst in der
      Store-Prüfung. Steht hier und nicht in C3, weil die Schale sie schon beim
      Anlegen mitbekommen soll.
- [ ] **Android:** Kamera-Berechtigung im `AndroidManifest.xml` deklarieren und
      die Laufzeit-Abfrage behandeln. Dieselbe Falle, andere Plattform.

### B2. Der Wächter gegen native Geheimnisse im öffentlichen Repo

- [ ] **RED**: Test — der Wächter meldet eine Keystore-Datei, die im
      Arbeitsbaum liegt, und bricht ab. *Negativbefund braucht eine
      Positivkontrolle:* ohne die Datei muss derselbe Lauf grün sein, sonst ist
      ein Wächter, der immer bricht, von einem, der prüft, nicht zu
      unterscheiden.
- [ ] **RED**: Test — er prüft den **Baum**, nicht den Diff: eine Datei, die
      kein aktueller Commit anfasst, wird trotzdem gemeldet.
- [ ] Wächter schreiben und in `ci.yml` einhängen.
- [ ] **Einmaliger Lauf über die Historie** beim Einführen des Wächters. Er
      prüft den Baum und sieht damit nicht, was in einem früheren Commit liegt —
      und genau dieser Fall ist am 23.08. schon einmal eingetreten. Findet der
      Lauf etwas, ist das eine Rotation, kein Löschen: ein Geheimnis in der
      Historie eines öffentlichen Repos gilt als offengelegt.

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

## Phase C — Ränder, Zurück-Taste, Kamera

### C1. Sichere Ränder

- [ ] `viewport-fit=cover` in `index.html:7`. **Zuerst** — ohne das Meta sind
      alle `env(safe-area-inset-*)` null, und jede weitere Zeile wirkungslos.
- [ ] `env(safe-area-inset-*)` **ergänzend** (nicht ersetzend) an Kopfzeile,
      beiden angedockten Leisten und Chatfenster.
- [ ] **Beleg auf dem Gerät**, ausdrücklich nicht in jsdom: dort sind die Insets
      immer null, und ein Test darüber wäre grün, gleich was die App tut.

### C2. Android-Zurück

- [ ] **RED**: Test — bei offenem Overlay schließt Zurück das Overlay und
      navigiert **nicht**. Die Reihenfolge ist der Punkt, den man übersieht:
      mehrere Flächen führen ihren Offen-Zustand über den Verlaufsschlüssel
      (`HeaderSearch.tsx:80`, `MemberDirectory.tsx:80`, `LegalZurueck.tsx:24`).
- [ ] **RED**: Test — mit Verlauf geht Zurück eine Seite zurück; ohne Verlauf
      schließt es die App **nicht**.
- [ ] Beide Tests prüfen die **Entscheidungsfunktion**, nicht das Ereignis:
      `backButton` ist ein natives Capacitor-Ereignis, das in jsdom nie feuert.
      Ein Test, der auf die Ereignisquelle wartet, wäre grün, weil nichts
      passiert — dieselbe Falle wie bei `env(safe-area-inset-*)`.
- [ ] **`@capacitor/app` als Abhängigkeit hinzufügen.** Sie fehlt bisher in
      jeder Phase: A installiert `core` und `preferences`, C3 `camera`, D den
      Updater. Ohne sie gibt es weder `backButton` noch das Wegschicken in den
      Hintergrund, und die RED-Tests oben könnten nie grün werden.
- [ ] Handler auf `@capacitor/app` `backButton` legen.
- [ ] **Beleg auf einem Android-Gerät:** durch drei Ebenen navigieren, Overlay
      öffnen, zweimal zurück — Overlay zu, eine Ebene zurück, App noch offen.

### C3. Kamera und Fotoauswahl

- [ ] **RED**: Test — der gemeinsame Aufrufpunkt gibt im Web eine Datei aus dem
      bestehenden `<input>` zurück; die sechs Aufrufer kennen keine Plattform.
- [ ] Aufrufpunkt bauen, `@capacitor/camera` im nativen Zweig.
- [ ] Die sechs Stellen umstellen: `ProfilPage.tsx:278,317`,
      `CommunityFeed.tsx:943,2042`, `EventCoverPicker.tsx:120`,
      `WillkommenPage.tsx:603`.
- [ ] **Beleg:** Zuschnitt und Upload dahinter sind unverändert — dieselben
      Seitenverhältnisse je Bucket wie bisher.
- [ ] **Beleg auf beiden Geräten**, wie bei C1 und C2: einmal aus der Kamera,
      einmal aus der Galerie, Bild danach auf dem Profil sichtbar. Die native
      Auswahl ist genau der Teil, den kein Test im Browser je berührt.

## Phase D — OTA · selbst gehostet auf Cloudflare

### D1. Der Weg, auf dem ein Bündel entsteht

Ohne diesen Schritt gibt es drei Endpunkte, die Anfragen beantworten, und nichts,
was das System je befüllt.

- [ ] Veröffentlichungs-Schritt: `dist/` zu einem Zip mit `index.html` an der
      Wurzel, SHA-256 bilden, mit dem **privaten** Schlüssel signieren, Zip nach
      R2 laden, Manifest registrieren (Fassung, URL, Prüfsumme,
      Vertragsnummer der Schale).
- [ ] **Den Anlass festlegen, nicht nur den Schritt.** `deploy.yml` baut Web,
      der native Workflow läuft von Hand — dazwischen gibt es heute nichts, das
      ein Bündel veröffentlichte. Ohne einen benannten Auslöser (Vorschlag: bei
      jedem Deploy auf `main`) erreichen Web-Änderungen nie ein Gerät, und die
      zentrale Zusage der Spec wäre **per Konfiguration** unerfüllbar.
- [ ] **Fassungsschema festlegen:** welcher Commit ergibt welche Bündel-Fassung,
      und was gilt, wenn ein Store-Bau und ein `main`-Deploy sich überholen.
- [ ] Signaturschlüsselpaar erzeugen; **privaten Schlüssel nach Infisical**,
      öffentlichen als `publicKey` in die Konfiguration.

### D2. Die Vertragsnummer der Schale — Feld, Stempelstelle, Regel

Dreimal dieselbe Zahl, dreimal woanders. Wird das nicht festgelegt, erfindet
jeder Schritt in D3 seine eigene Auslegung.

- [ ] **Feld** benennen, in dem die Schale ihre Nummer an `updateUrl` meldet.
- [ ] **Stempelstelle** benennen: wo die Schale sie trägt. **Nicht** die
      App-Version — zwei Store-Builds derselben Version können verschiedene
      Plugin-Mengen haben, und genau darum geht es.
- [ ] **Regel** festhalten: die Nummer steigt in **jedem** PR, der ein Plugin
      hinzufügt, entfernt oder seine native Fassung hebt. Ein solcher PR geht
      über den Store.

### D3. Endpunkte und Schutz

- [ ] `@capgo/capacitor-updater`; `updateUrl`, `channelUrl`, `statsUrl` in
      `capacitor.config.ts` auf eigene Endpunkte.
- [ ] Drei Cloudflare Pages Functions; Bündel-Zips nach R2.
- [ ] **RED**: Test — der Endpunkt liefert ein Bündel **nicht** an eine Schale
      mit zu niedriger Vertragsnummer.
- [ ] **RED**: Test — ein Bündel ohne passende Prüfsumme wird abgewiesen und die
      installierte Fassung bleibt in Betrieb.

### D4. Der Rückweg — ohne ihn ist OTA eine Einbahnstraße

- [ ] `notifyAppReady()` nach erfolgreichem Start aufrufen und das
      Rollback-Verhalten konfigurieren.
- [ ] **RED**: Test — ein Bündel, das **signiert und gültig** ist, aber beim
      Start scheitert, fällt auf die vorige Fassung zurück.
- [ ] Das Szenario im Spec-Delta ergänzen. Die bisherige Zusage deckt nur das
      **unsignierte** Bündel ab; ein signiertes, das startet und dann weiß
      bleibt, bricht ohne diesen Rückweg **jedes** Gerät dauerhaft — bis eine
      neue Schale durch den Store geht. Das ist der teuerste denkbare Fehler
      dieses Changes.

### D5. Beleg

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
