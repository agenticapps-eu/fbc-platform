## 1. Messen, bevor gebaut wird

- [x] 1.1 Beide Verifizierungsadressen live gemessen (11.09., gegen
      `app.effbeezee.com`): **beide fehlen.** Sie antworten mit **HTTP 200**,
      `text/html`, **7986 Bytes**, zeichengleich mit `/` — der SPA-Fallback.
      **Ein Test auf den Statuscode wäre grün gewesen, bevor es die Dateien
      gibt.** Die Prüfung liest deshalb überall den Rumpf.
- [x] 1.2 Arbeitsbaum gemessen: `com.apple.developer.associated-domains` fehlt
      in `ios/App/App/App.entitlements` (dort steht nur `aps-environment`), und
      `AndroidManifest.xml` trägt einen einzigen `intent-filter`, nämlich
      `MAIN`/`LAUNCHER`. Beide Seiten sind unberührtes Feld.
- [x] 1.3 Vite-Verhalten gemessen: `public/.well-known/probe.txt` lag nach
      `pnpm build` als `dist/.well-known/probe.txt` vor. **Das Punktverzeichnis
      überlebt den Bau** — die Voraussetzung für Entscheidung 2. Sonde wieder
      entfernt.
- [x] 1.4 Zuschnitt verkleinert: der Sprung aus der Push-Mitteilung ins Gespräch
      ist **gebaut** (`pushZielZuhoerer`, `src/lib/push.ts`). Das
      Abnahmekästchen „Push öffnet die richtige Unterhaltung" aus AGE-643 hängt
      NICHT an diesem Change und wird hier nicht erneut gebaut.
- [x] 1.5 Kollisionsprüfung: `push-fundament` und `push-waechter` halten
      `MODIFIED`-Blöcke auf `notifications` bzw. `deployment-environments`.
      Dieser Change fasst beide nicht an — alles **ADDED** in `native-shell`.

## 2. Plan-Review (Gate, vor der ersten Codezeile)

- [x] 2.1 `openspec validate --all` grün, `change/deep-links` darunter.
- [x] 2.2 Plan-Review gelaufen: **gemini** und **opencode** (`hf:moonshotai/Kimi-K3`), beide REQUEST-CHANGES, 2 HOCH / 4 MITTEL / 4 NIEDRIG. `codex` nicht angesetzt — delegiert bei dieser Artefaktgröße zurück. `REVIEWS.md` geschrieben. Ursprünglicher Auftrag:, ≥2 Reviewer **anderer Anbieter**, Ergebnis
      nach `REVIEWS.md`.
      **Begründung, warum sie hier NICHT entfällt:** Donalds Regel vom 26.08.
      schaltet Fremdreviewer nur bei Schema, Rechten oder **Sicherheit** ein —
      und dieser Change berührt zwei Sicherheitsflächen. Erstens die
      Domain-Assoziation: eine falsche `assetlinks.json` oder AASA entscheidet
      darüber, welche App Links auf unserer Domain beanspruchen darf. Zweitens
      den Anmeldeweg: die Zielerhaltung ist ohne Verengung auf interne Pfade
      eine offene Weiterleitung. Reines UI ist das nicht.
- [x] 2.3 **Alle** Befunde eingearbeitet, keiner zurückgewiesen. Zwei am Repo
      nachgeprüft und bestätigt (`RequireAuth` verwirft den Ort; der Token steht
      im Fragment), einer teilweise widerlegt (`ActivationGate` navigiert nicht,
      es tauscht den Baum — das Ziel geht dort nicht verloren). Auflösung als
      Tabelle in `REVIEWS.md`.

## 3. Die Auslieferung zuerst — RED

Ohne die Dateien am Netz ist alles Weitere nicht belegbar.

- [x] 3.1 **RED:** Test, dass `apple-app-site-association` die App-Kennung
      `WQZJ8649TN.com.effbeezee.app` und alle vier Pfade führt. Rot, solange die
      Datei fehlt.
- [x] 3.2 **RED:** Test, dass `assetlinks.json` gültiges JSON ist, den
      Paketnamen `com.effbeezee.app` führt und **mindestens einen**
      SHA-256-Fingerabdruck trägt.
- [x] 3.3 **RED:** Test, dass `public/_headers` der endungslosen Datei
      `application/json` zuweist. Ohne den Typ lehnt Apple sie ab, und man sieht
      es der Datei nicht an.
- [x] 3.3b **RED, nachgetragen:** Test, dass der Vermerk über den fehlenden
      Play-Fingerabdruck in `public/_headers` steht. Die Spec verlangt ihn
      (Szenario „Die offene Stelle ist auffindbar vermerkt"), §3 zählte ihn
      nicht auf — eine unbelegte Zusage.
- [x] 3.4 Rot festgehalten, 4/4, und **jede aus dem richtigen Grund**: zweimal
      „Datei fehlt", zweimal „keine Regel in `_headers`". Alle vier stehen in
      `src/deep-links.auslieferung.test.ts`.

## 4. Die beiden Dateien

- [x] 4.1 `public/.well-known/apple-app-site-association` angelegt: `applinks`
      mit `appIDs` und `components`. Die Pfade stehen dort als **Muster**, nicht
      als Routen: `/aktivierung`, `/chat/*`, `/events/*`, `/p/*` — ein
      Doppelpunkt-Platzhalter aus der Routentabelle wäre dort wirkungslos
      (Befund gemini, NIEDRIG). Kein Kommentar im JSON — die Datei muss strikt
      geparst werden können.
- [x] 4.2 Den Upload-Fingerabdruck beschafft: `pnpm android:keystore` erzeugt
      den Keystore aus Infisical, danach der SHA-256 über `keytool`/`apksigner`.
      **Der Keystore darf den Baum nicht verlassen** — er liegt unter einer
      Ignorierzeile, und der Wächter aus `native-shell` bricht den Lauf, wenn
      eine `.keystore`/`.jks` im Baum liegt. Nach dem Ablesen entfernen.
      **Gelaufen am 12.09.,** nachdem Donald `infisical login` ausgeführt hat:
      `infisical run --env=prod -- pnpm android:keystore` schrieb 2648 Bytes,
      `keytool -list -v` gab den SHA-256. Keystore und `key.properties` sind
      unmittelbar danach wieder aus dem Baum — nachgesehen, es liegt keine
      `.jks` mehr darin.
      Ein Debug-Bau hätte nicht geholfen: `android/app/build/outputs/apk/debug/`
      trägt den DEBUG-Schlüssel — genau das irreführende Bild aus 8.3.
- [x] 4.3 `public/.well-known/assetlinks.json` angelegt, mit dem
      Upload-Fingerabdruck **und dem Vermerk über die Lücke** — der
      Play-App-Signing-Fingerabdruck fehlt und wird in AGE-644 nachgetragen.
      Der Vermerk steht als `#`-Kommentar neben der Inhaltstyp-Regel in
      `public/_headers` und in der Abnahme von AGE-644 — nicht in der Datei:
      `assetlinks.json` ist strikt geparstes JSON, ein Zusatzschlüssel wäre ein
      Fehler statt eines Hinweises.
- [x] 4.4 `public/_headers`: Inhaltstyp für die endungslose Datei — samt dem
      Vermerk aus 4.3 und dem Verweis auf `src/lib/deep-links.ts`, den die
      beiden JSON-Dateien selbst nicht tragen können.
- [x] 4.5 **4 von 4 grün.** Kein roter Test mehr im Zweig. Beide Dateien
      liegen nach `pnpm build` zeichengleich in `dist/.well-known/`.
- [x] 4.6 Live gemessen, ohne `-L` und mit Blick auf den
      Rumpf: beide Adressen liefern ihr eigenes JSON, nicht die Startseite.
      Gegen die Zahl aus 1.1 halten (7986 Bytes wären der Fehlschlag).
      Der Bau trägt die Datei: nach `pnpm build` liegt sie als
      `dist/.well-known/apple-app-site-association` und ist zeichengleich mit
      der Quelle (gemessen 12.09.). Das belegt den Bau, nicht die Auslieferung.

      **Auf der VORSCHAU-Fläche des PR gemessen (12.09.,
      `donald-age-643-deep-links.fbc-platform.pages.dev`), und damit ist die
      letzte offene Frage dieses Changes beantwortet:** Cloudflare wendet die
      Inhaltstyp-Regel auf die endungslose Datei an.

      | Adresse | Status | Inhaltstyp | Bytes |
      | --- | --- | --- | --- |
      | `/.well-known/apple-app-site-association` | 200 | `application/json` | 272 |
      | `/.well-known/assetlinks.json` | 200 | `application/json` | 325 |
      | `/chat/abc-123` (Gegenprobe) | 200 | `text/html` | **7986** |

      Die 7986 sind dieselbe Zahl wie in 1.1 — dort war sie der Fehlschlag, hier
      ist sie der Beleg: der SPA-Fallback antwortet unverändert und zeichengleich
      mit `/`. Der Browserweg ist also unberührt.

      **Gegen `app.effbeezee.com` wiederholt, nach dem Merge von #399
      (12.09., Deploy auf `e2abc83` grün) — zeichengleiches Ergebnis:**

      | Adresse | Status | Inhaltstyp | Bytes |
      | --- | --- | --- | --- |
      | `/.well-known/apple-app-site-association` | 200 | `application/json` | 272 |
      | `/.well-known/assetlinks.json` | 200 | `application/json` | 325 |
      | `/chat/abc-123` (Gegenprobe) | 200 | `text/html` | **7986**, zeichengleich mit `/` |

      Damit ist 4.6 erfüllt und die Anforderung „Beide Dateien sind als sie
      selbst abrufbar" am Netz belegt, nicht am Bau. Die Gegenprobe deckt
      zugleich „Der Browserweg bleibt unberührt" ab.

## 5. Die Anmeldung der Domain an beiden Plattformen

- [x] 5.1 **Erledigt von Donald am 12.09.** Apple-Portal: Fähigkeit *Associated Domains* an der App-ID setzen.
      **Vor** dem ersten Bau — sonst greift die automatische Signierung zum
      Wildcard-Profil und der Bau scheitert, wie bei `aps-environment` in M2.
      **Kein Profil nachzuziehen:** dieser Bau signiert serverseitig
      (`-allowProvisioningUpdates` plus ASC-Schlüssel, siehe Kopf von
      `.github/workflows/ios-release.yml`). Es gibt kein gespeichertes
      Provisioning-Profil als Secret, das die neue Fähigkeit nachtragen müsste —
      Xcode und CI ziehen beim nächsten Bau ein frisches.
- [x] 5.2 `ios/App/App/App.entitlements`: `applinks:app.effbeezee.com`.
- [x] 5.3 `AndroidManifest.xml`: **ein** `intent-filter` mit
      `android:autoVerify="true"`, `VIEW`/`DEFAULT`/`BROWSABLE`,
      `android:scheme="https"`, `android:host="app.effbeezee.com"` und **je
      einem `android:pathPrefix`** für die vier Pfade.
- [x] 5.3b Test, dass der Filter die vier Pfade nennt und **nicht** die ganze
      Domain beansprucht. Ohne die Einschränkung öffnete `/passwort-neu` oder
      `/login` auf Android die App und auf iOS den Browser — eine Asymmetrie,
      die niemand entschieden hat (Befund opencode, HOCH).
      `src/deep-links.native.test.ts` hält beide Plattformen gegen dieselbe
      Liste. **Gegenprobe gefahren:** ein `data`-Element ohne `pathPrefix`
      macht den Test rot — Android verschmilzt alle `data`-Elemente eines
      Filters, ein einziges ohne Präfix beanspruchte den ganzen Host, und die
      drei anderen Zeilen sähen weiter richtig aus.
- [x] 5.4 Beide Bauten gelaufen und **nur den Bau** prüfen, bevor
      irgendetwas am Gerät gemessen wird. Ein gescheiterter Bau sieht sonst wie
      ein gescheiterter Deep Link aus.
      **Beide grün am 12.09., und beide am ARTEFAKT nachgemessen, nicht an der
      Eingabe:**
      Android `assembleDebug` BUILD SUCCESSFUL (exit 0, ohne Pipe gelesen). Das
      **gebaute** Manifest unter
      `android/app/build/intermediates/merged_manifests/debug/` trägt genau
      EINEN `autoVerify`-Filter mit allen vier `pathPrefix` — der Test in §5.3b
      liest die Quelle, dies liest das Ergebnis der Zusammenführung.
      iOS `xcodebuild … -destination generic/platform=iOS` BUILD SUCCEEDED
      (exit 0). `codesign -d --entitlements` auf der gebauten `App.app` zeigt
      `com.apple.developer.associated-domains` mit
      `applinks:app.effbeezee.com` — die Fähigkeit aus 5.1 hat es also bis ins
      signierte Binary geschafft, und nicht nur ins Portal.
      Zwei Anmerkungen für den nächsten Lauf: `DEVELOPMENT_TEAM` steht NICHT im
      Projekt, es muss wie in CI auf der Kommandozeile mitgegeben werden
      (`DEVELOPMENT_TEAM=WQZJ8649TN`), sonst bricht der Bau mit „requires a
      development team" ab. Und `cap sync` erzeugt erneut die **vorbestehende**
      Drift auf `Package.swift`/`Package.resolved` (8.5.0 → 8.5.1); sie wurde
      wieder verworfen, weil sie nicht zu diesem Change gehört.

## 6. Der Weg ins Routing — RED, dann GREEN

- [x] 6.1 **RED:** Test, dass eine geöffnete Adresse in den Pfad übersetzt wird
      und die Navigation auslöst.
- [x] 6.1b **RED, und das ist der teuerste Pfad:** Test, dass `#token=…` die
      Übersetzung überlebt. Der Aktivierungs-Token steht im **Fragment**, nicht
      im Query (am Repo bestätigt: `src/instrument.test.ts:37`,
      `App.test.tsx:232`). Wer nur `pathname` und `search` mitführt, öffnet die
      App auf dem Aktivierungspfad ohne Token (Befund opencode, MITTEL).
- [x] 6.2 **RED:** Test, dass eine Adresse ohne bekannten Pfad **nichts**
      bewegt. Das ist die Gegenprobe — ohne sie belegte ein grüner Test auch
      einen Sprung auf gut Glück.
- [x] 6.3 Zuhörer auf `appUrlOpen` in `AppShell.tsx`, nach dem Vorbild von
      `pushZielZuhoerer`: er steht, sobald die Hülle steht, nicht nach dem
      Anmelden.
- [x] 6.3b Die vier Pfade **einmal** als Modul aussprechen; AASA und Manifest
      verweisen im Kommentar darauf. Sonst stehen sie an drei Stellen und laufen
      auseinander, ohne dass es jemand vor dem Gerätetest merkt.
- [x] 6.4 Test, dass der Zuhörer beim Abräumen wieder entfernt wird — dasselbe
      Muster, das der `backButton`-Zuhörer daneben bereits trägt.

**Gemessen, nicht behauptet.** Vier Mutationen an `src/lib/deep-links.ts`, jede
fing der Test: `hash` weggelassen (1 rot), Host-Prüfung entfernt (2 rot),
frühes Abräumen entfernt (1 rot), Präfix-Prüfung entfernt (5 rot). Die
Verdrahtung hängt an einer eigenen Datei — `AppShell.deep-links.test.tsx`, 3 rot,
sobald der Effect aus `AppShell.tsx` verschwindet. Ein ausgewertetes Modul ist
kein Zuhörer, der hängt.

## 7. Die Zielerhaltung über die Anmeldung

- [x] 7.1 **RED:** Test, dass ein nicht angemeldetes Mitglied nach der Anmeldung
      am ursprünglichen Ziel steht und nicht auf der Startseite.
- [x] 7.2 **RED, und das ist der Sicherheitsteil:** Test, dass ein Ziel mit
      Schema, Host oder führendem `//` **verworfen** wird und die Anmeldung auf
      die Startseite führt. Ohne diese Verengung ist die Zielerhaltung eine
      offene Weiterleitung, ausgelöst direkt nach der Eingabe der Zugangsdaten.
- [x] 7.3 Umsetzen, und zwar **an diesen beiden Stellen**:
      `src/components/RequireAuth.tsx` reicht das Ziel über den
      Navigationszustand weiter — es tut heute `<Navigate to="/login" replace />`
      und **verwirft den Ort vollständig** (am Repo bestätigt, Befund opencode
      HOCH) — und `src/pages/LoginPage.tsx` liest ihn nach erfolgreicher
      Anmeldung. **Kein Query-Parameter:** `LoginPage` führt bereits `?modus=`
      (Zeile 89), und ein Ziel im Query stünde in jedem Zugriffsprotokoll.
      Der Aktivierungsweg bleibt ausgenommen — das Token trägt die Identität.
- [x] 7.3b Test, dass ein angemeldetes, **nicht aktiviertes** Konto sein Ziel
      behält. `ActivationGate` tauscht den gerenderten Baum aus und navigiert
      NICHT, die Adresse bleibt also stehen — geprüft am Repo. Die Review
      vermutete hier eine zweite Wand; es ist keine. Die Zusage gehört trotzdem
      gepinnt, weil sie heute nur aus der Bauart folgt.
- [x] 7.4 Test, dass der Aktivierungsvorgang **keine** Anmeldung verlangt und
      kein Hinweis auf die App davorliegt.

Alle sieben stehen in `src/zielerhaltung.test.tsx`, gegen die echte Hülle: die
Sitzung erscheint per Neurendern, so wie eine erfolgreiche Anmeldung sie meldet.
**Gegenprobe zu 7.2:** ohne die Verengung in `zielNachAnmeldung` gehen genau
die drei Sicherheitszusagen rot.

**Zwei Annahmen des Plans haben beim Messen nicht gehalten:**

- `/events/:id` liegt **nicht** hinter `RequireAuth` (`src/App.tsx:156` —
  „anon darf öffentliche Events sehen"). Ein Event-Link verlangt dort also gar
  keine Anmeldung, und die Zielerhaltung ist nie im Spiel. Die Fälle 7.1/7.2
  laufen deshalb über `/chat/:threadId` und `/p/:id`.
- Die tatsächlich greifende Stelle in `LoginPage` ist **nicht** das `navigate`
  nach `signIn`, sondern der `<Navigate>`-Guard am Kopf der Komponente: der
  Auth-Zuhörer meldet die Sitzung, bevor `signIn` auflöst. Beide führen jetzt
  dasselbe Ziel; stünde es nur an einer, wäre es die falsche.

## 8. Gerätebeleg

Grüne Tests belegen hier fast nichts — alles hängt an zwei Dateien auf einem
fremden Host und an zwei Betriebssystemen.

- [x] 8.0 **Zuerst den Kaltstart**, nicht den Warmstart: App vollständig
      beenden, dann den Link öffnen. Das ist der Fall, der beim ersten Kontakt
      aus der Einladungsmail zählt, und der einzige, dessen Zustellung dieser
      Change nur behauptet statt gemessen hat (Befund opencode, NIEDRIG).
      **Auf Android am 12.09. gemessen, und zwar als echter Kaltstart:** die App
      war frisch installiert und per `am force-stop` beendet, der Link legte die
      Task selbst an — `rootOfTask=true`, `topResumedActivity=
      com.effbeezee.app/.MainActivity`, und als auslösende Absicht steht dort
      `act=VIEW cat=[BROWSABLE] dat=https://app.effbeezee.com/events/… cmp=
      com.effbeezee.app/.MainActivity`. **Kein Auswahldialog dazwischen**, keine
      `ResolverActivity` im Stapel. Auf iOS steht der Kaltstart aus, weil er
      einen Fingertipp braucht (8.1).
- [x] 8.0b **Den Weg des Abnahme-Baus auf iOS festlegen und gehen.** Entitlement
      und Manifest sind nativ und reisen NICHT über den OTA-Weg — der tauscht
      nur `public/`. Ohne Store-Einreichung (die ist AGE-644) erreicht also
      keine iOS-Fassung mit `applinks:` ein Gerät von allein. Gewählter Weg:
      Direktinstallation aus Xcode auf ein registriertes Gerät, wie in M2/B3.
      **Gegangen am 12.09.**: `xcodebuild … -destination id=544B9818-…
      DEVELOPMENT_TEAM=WQZJ8649TN` (BUILD SUCCEEDED), danach
      `xcrun devicectl device install app` auf das iPhone 17 Pro — **über** die
      bestehende App, die Anmeldung bleibt also stehen. Am gebauten Artefakt
      gemessen, nicht an der Quelle: `codesign -d --entitlements` nennt
      `applinks:app.effbeezee.com` und `application-identifier
      WQZJ8649TN.com.effbeezee.app`, **zeichengleich mit der `appIDs`-Zeile der
      live ausgelieferten AASA**.
- [ ] 8.1 **iOS, App installiert:** Aktivierungslink aus einer echten Mail
      öffnen. Die App öffnet sich am Ziel. Beim Messen den Entwicklermodus der
      Association verwenden und das im Beleg **vermerken** — Apple
      zwischenspeichert die Datei, und ein Lauf ohne diesen Vermerk belegt
      nicht, was er zu belegen scheint.
      **Vorarbeit erledigt, der Tipp fehlt.** Die App liegt installiert auf dem
      Gerät (8.0b). **Der Entwicklermodus wird nicht gebraucht**, und das ist
      gemessen statt angenommen: Apples CDN führt die Datei bereits in der
      richtigen Fassung —
      `https://app-site-association.cdn-apple.com/a/v1/app.effbeezee.com`
      antwortet **200, `application/json`, 272 Bytes**, inhaltsgleich mit dem
      Ursprung. Ein Gerät ohne Entwicklermodus bekommt also dieselbe Datei.
      `devicectl` kennt kein „URL öffnen", und iOS lässt sich weder tippen noch
      abfotografieren — der Rest ist Handarbeit.
- [ ] 8.2 **iOS, App nicht installiert:** derselbe Link öffnet die Website und
      der Vorgang läuft zu Ende.
- [x] 8.3 **Android, direkt installiertes Paket:** dasselbe Paar. Das Paket
      MUSS mit dem **Upload-Schlüssel** signiert sein, nicht mit dem
      Debug-Schlüssel — `autoVerify` vergleicht den Signierer der installierten
      App gegen `assetlinks.json`, und ein Debug-Bau scheitert mit genau dem
      irreführenden Bild, vor dem dieser Change warnt. Vor dem Gerätelauf mit
      `apksigner verify --print-certs` gegen den in 4.3 eingetragenen
      Fingerabdruck halten (Befund opencode, MITTEL). Der Beleg gilt
      ausdrücklich **nicht** für die Play-Fassung (Entscheidung 6).
      **Am 12.09. vollständig gemessen**, jeder Schritt am Artefakt oder am
      Gerät, keiner an der Quelle:

      | Was | Gemessen woran | Ergebnis |
      | --- | --- | --- |
      | Signierer | `apksigner verify --print-certs` auf dem gebauten APK | `7ae186…d12fda` |
      | Erwartung | live ausgelieferte `assetlinks.json` | derselbe Wert |
      | Filter | `aapt2 dump xmltree` **auf dem APK** | genau **ein** `autoVerify`, alle vier `pathPrefix` |
      | Bauart | `dumpsys package` nach der Installation | `DEBUGGABLE` ist **weg** |
      | Signatur am Gerät | `pm get-app-links` | `7A:E1:…:DA` |
      | Verifizierung | `pm get-app-links` | `app.effbeezee.com: verified` |

      Der Debug-Bau davor trug in `pm get-app-links` **gar keine Domain** — die
      Gegenprobe zur Verifizierung ist also der Vorzustand selbst.
- [x] 8.4 Die drei übrigen Pfade je einmal auf einer Plattform, aus WhatsApp und
      aus Mail heraus.
      **Alle vier Pfade auf Android gemessen, je aus dem Kaltstart** — und
      daneben zwei Gegenproben, die NICHT in der App landen dürfen:

      | Adresse | landet in |
      | --- | --- |
      | `/aktivierung#token=…` | App |
      | `/chat/<uuid>` | App |
      | `/events/<uuid>` | App |
      | `/p/<uuid>` | App |
      | `/passwort-neu#token=…` | **Chrome** (bewusst draussen, Entscheidung 10) |
      | `/verzeichnis` | **Chrome** (gewöhnliche Anwendungsroute) |

      **Das Fragment überlebt den Weg durchs Betriebssystem:** die zugestellte
      Absicht trägt wörtlich
      `dat=https://app.effbeezee.com/aktivierung#token=PROBE-12345`. Genau
      dieser Teil ist der teure — `pathname`+`search` allein öffneten die App
      ohne Token.
      **Was hier NICHT belegt ist:** die Absicht kam aus `am start`, nicht aus
      Gmail oder WhatsApp. Für die Zustellung des Links ist das dasselbe
      (`VIEW`/`BROWSABLE`, dieselbe Adresse), für die Rückkehr in die
      Absender-App nicht — das ist 8.4b.
- [ ] 8.4b Den **Rückweg** prüfen: die Brotkrume oben links auf iOS und die
      Zurück-Taste auf Android führen in die Anwendung zurück, aus der der Link
      kam (Befund gemini, NIEDRIG). Das leistet das Betriebssystem, aber nur bei
      einem echten Universal Link — bricht es, ist es ein Hinweis darauf, dass
      der Link anders geöffnet wurde als gedacht. **Braucht eine echte
      Absender-App, also Handarbeit.**
- [ ] 8.5 Gerät zurückstellen, wie es übernommen wurde. **Offen und eine
      Entscheidung:** auf dem Pixel stand ein DEBUG-Bau vom 10.09. ohne
      Link-Filter, jetzt steht dort der Release-Bau. Der alte liegt gesichert
      im Ablageordner der Sitzung (`alt-debug.apk`, 18 MB). Zurückspielen hiesse
      die Verifizierung wieder verlieren; das iPhone wurde nur überschrieben und
      ist unverändert angemeldet.

### Was die vier Starts auf dem Bildschirm ergaben (12.09., entsperrtes Gerät)

Die Tabelle oben sagt, dass die App startet. Sie sagt nicht, **wo** sie landet.
Vier Bildschirmfotos im Ablageordner der Sitzung (`age643/01-…04-…png`), jedes
nach einem `force-stop` aufgenommen, das Konto auf dem Gerät **abgemeldet**:

| Adresse | Bildschirm | Warum das richtig ist |
| --- | --- | --- |
| `/aktivierung#token=…` | „Passwort festlegen" | Der Token aus dem **Fragment** ist angekommen, sonst stünde hier ein Fehler. Das ist der teuerste Weg des Changes, und er trägt. |
| `/chat/<uuid>` | Login | liegt hinter `RequireAuth`, und niemand ist angemeldet |
| `/events/<uuid>` | Event-Seite, „existiert nicht oder ist für dich nicht sichtbar" | liegt **nicht** hinter `RequireAuth` (`src/App.tsx:156`) — die Seite kommt ohne Anmeldung, die erfundene UUID findet nichts |
| `/p/<uuid>` | Login | hinter `RequireAuth` |

**Nicht belegt ist die Zielerhaltung über die Anmeldung hinweg** — dafür müsste
man sich auf dem Gerät anmelden. Sie hängt an dem `<Navigate>`-Wächter am Kopf
von `LoginPage` und ist dort durch Tests gedeckt, nicht durch diesen Lauf.

### Der offene Punkt: ein Warmstart auf iOS verlor den Token (12.09.)

Donald tippte den Aktivierungslink in der Mail an, während die App auf dem
iPhone **im Hintergrund lief und angemeldet war**. Die App kam nach vorn und
zeigte die **Startseite**, nicht das Formular.

**Die naheliegende Erklärung ist falsch**, und das ist der Grund, warum der
Punkt hier steht: „angemeldet, deshalb Startseite" trägt nicht. Die
Weiterleitung in `ActivationRedeemPage` steht hinter

```
if (!token && user && isActivated === true && zweck === "aktivierung")
```

— sie verlangt ausdrücklich **kein** Token. Mit Token rendert die Seite das
Formular, angemeldet oder nicht. Die Startseite belegt also, dass `token`
leer war: entweder ging der Sprung nicht los, oder er verlor das Fragment.

Was danach gemessen wurde:

| Plattform | Zustand | Ergebnis |
| --- | --- | --- |
| Android | kalt, abgemeldet | „Passwort festlegen" |
| Android | **warm**, abgemeldet | „Passwort festlegen" |
| iOS | kalt, angemeldet | „Passwort festlegen" (Donald) |
| iOS | **warm**, angemeldet | **Startseite** (Donald, einmalig) |

Der Warmstart als solcher ist damit **nicht** die Ursache — auf Android trägt
er. Offen bleiben zwei Kandidaten, die sich nur am iPhone trennen lassen: die
Plattform selbst, oder der angemeldete Zustand. Ein zweiter Warmlauf auf dem
iPhone steht aus.

**Der Weg, auf dem das Token reist, erklärt, warum das überhaupt heikel ist:**
`entnimmAktivierungsFragment()` läuft als allererstes in `instrument.ts`, legt
das Token in eine Modulvariable und **räumt das Fragment per `replaceState`
aus der Adresszeile**. `holeAktivierungsToken()` gibt es **genau einmal**
heraus. Wer diesen Pfad zweimal in derselben Lebensdauer der App durchläuft,
bekommt beim zweiten Mal `null` — ohne dass irgendwo ein Fehler erscheint.

### Eine Sonde, die wie ein Beleg aussieht und keiner ist

`cmd package resolve-activity -a VIEW -c BROWSABLE -d <adresse>` meldete für
alle vier Pfade `android/…ResolverActivity`, also den Auswahldialog — das las
sich wie „die Verifizierung greift nicht". **Der wirkliche Start ging in
demselben Zustand direkt in die App**, ohne Dialog, nachgelesen im
Aktivitätenstapel. `resolve-activity` bildet die App-Link-Vorzugsregel nicht ab.
Ebenso harmlos: `pm get-app-links` führt die Domain unter
`Selection state → Disabled`; die Auswahl gilt nur für **un**verifizierte
Domains. Wer eine dieser beiden Ausgaben als Befund meldet, schickt den nächsten
Leser ins Manifest, wo nichts falsch ist.

## 9. Abnahme und Abschluss

- [x] 9.1 `pnpm test`, `typecheck`, `lint`, `build`, `openspec validate --all` —
      alle grün, Zahlen festhalten. Gemessen am 12.09. auf `60eaa4e`:
      `pnpm test` **2803 grün** (245 Dateien) · `typecheck` 0 · `lint` 0 Fehler
      / 7 Warnungen (Vorzustand) · `pnpm build` grün (unter
      `infisical run --env=prod`, seit vite 8 nötig) ·
      `openspec validate --all` 34/34.
- [ ] 9.2 `cso`-Gate: die Domain-Assoziation gibt nichts frei, was die Website
      nicht ohnehin freigibt, und die Zielerhaltung verlässt die Anwendung
      nicht.
- [ ] 9.3 `qa`-Gate auf dem Aktivierungsweg — er ist der teuerste Fehlerfall und
      der einzige, den niemand meldet.
- [ ] 9.4 `requesting-code-review` auf dem **Diff**.
- [ ] 9.5 `openspec archive deep-links`.
- [ ] 9.6 PR, Linear auf den richtigen Endstand. **Dabei den überholten
      Blockervermerk „blockiert durch AGE-256" aus dem Rumpf von AGE-643
      nehmen** — AGE-256 ist erledigt, die Domain läuft seit dem 01.09.
- [ ] 9.7 In AGE-644 den Nachtrag festhalten: Play-App-Signing-Fingerabdruck in
      `assetlinks.json`. Ohne ihn verifiziert die über Play verteilte App ihre
      Links nicht, und das Fehlerbild führt in die Irre.
