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

- [ ] 3.1 **RED:** Test, dass `apple-app-site-association` die App-Kennung
      `WQZJ8649TN.com.effbeezee.app` und alle vier Pfade führt. Rot, solange die
      Datei fehlt.
- [ ] 3.2 **RED:** Test, dass `assetlinks.json` gültiges JSON ist, den
      Paketnamen `com.effbeezee.app` führt und **mindestens einen**
      SHA-256-Fingerabdruck trägt.
- [ ] 3.3 **RED:** Test, dass `public/_headers` der endungslosen Datei
      `application/json` zuweist. Ohne den Typ lehnt Apple sie ab, und man sieht
      es der Datei nicht an.
- [ ] 3.4 Die drei Tests laufen lassen und die **roten** Ausgaben festhalten.

## 4. Die beiden Dateien

- [ ] 4.1 `public/.well-known/apple-app-site-association` anlegen: `applinks`
      mit `appIDs` und `components`. Die Pfade stehen dort als **Muster**, nicht
      als Routen: `/aktivierung`, `/chat/*`, `/events/*`, `/p/*` — ein
      Doppelpunkt-Platzhalter aus der Routentabelle wäre dort wirkungslos
      (Befund gemini, NIEDRIG). Kein Kommentar im JSON — die Datei muss strikt
      geparst werden können.
- [ ] 4.2 Den Upload-Fingerabdruck beschaffen: `pnpm android:keystore` erzeugt
      den Keystore aus Infisical, danach der SHA-256 über `keytool`/`apksigner`.
      **Der Keystore darf den Baum nicht verlassen** — er liegt unter einer
      Ignorierzeile, und der Wächter aus `native-shell` bricht den Lauf, wenn
      eine `.keystore`/`.jks` im Baum liegt. Nach dem Ablesen entfernen.
- [ ] 4.3 `public/.well-known/assetlinks.json` anlegen, mit dem
      Upload-Fingerabdruck **und dem Vermerk über die Lücke** — der
      Play-App-Signing-Fingerabdruck fehlt und wird in AGE-644 nachgetragen.
      Der Vermerk steht als `#`-Kommentar neben der Inhaltstyp-Regel in
      `public/_headers` und in der Abnahme von AGE-644 — nicht in der Datei:
      `assetlinks.json` ist strikt geparstes JSON, ein Zusatzschlüssel wäre ein
      Fehler statt eines Hinweises.
- [ ] 4.4 `public/_headers`: Inhaltstyp für die endungslose Datei.
- [ ] 4.5 Die drei Tests aus §3 laufen lassen — jetzt grün.
- [ ] 4.6 Nach dem Deploy **live** messen, ohne `-L` und mit Blick auf den
      Rumpf: beide Adressen liefern ihr eigenes JSON, nicht die Startseite.
      Gegen die Zahl aus 1.1 halten (7986 Bytes wären der Fehlschlag).

## 5. Die Anmeldung der Domain an beiden Plattformen

- [ ] 5.1 Apple-Portal: Fähigkeit *Associated Domains* an der App-ID setzen.
      **Vor** dem ersten Bau — sonst greift die automatische Signierung zum
      Wildcard-Profil und der Bau scheitert, wie bei `aps-environment` in M2.
- [ ] 5.2 `ios/App/App/App.entitlements`: `applinks:app.effbeezee.com`.
- [ ] 5.3 `AndroidManifest.xml`: **ein** `intent-filter` mit
      `android:autoVerify="true"`, `VIEW`/`DEFAULT`/`BROWSABLE`,
      `android:scheme="https"`, `android:host="app.effbeezee.com"` und **je
      einem `android:pathPrefix`** für die vier Pfade.
- [ ] 5.3b Test, dass der Filter die vier Pfade nennt und **nicht** die ganze
      Domain beansprucht. Ohne die Einschränkung öffnete `/passwort-neu` oder
      `/login` auf Android die App und auf iOS den Browser — eine Asymmetrie,
      die niemand entschieden hat (Befund opencode, HOCH).
- [ ] 5.4 Beide Bauten laufen lassen und **nur den Bau** prüfen, bevor
      irgendetwas am Gerät gemessen wird. Ein gescheiterter Bau sieht sonst wie
      ein gescheiterter Deep Link aus.

## 6. Der Weg ins Routing — RED, dann GREEN

- [ ] 6.1 **RED:** Test, dass eine geöffnete Adresse in den Pfad übersetzt wird
      und die Navigation auslöst.
- [ ] 6.1b **RED, und das ist der teuerste Pfad:** Test, dass `#token=…` die
      Übersetzung überlebt. Der Aktivierungs-Token steht im **Fragment**, nicht
      im Query (am Repo bestätigt: `src/instrument.test.ts:37`,
      `App.test.tsx:232`). Wer nur `pathname` und `search` mitführt, öffnet die
      App auf dem Aktivierungspfad ohne Token (Befund opencode, MITTEL).
- [ ] 6.2 **RED:** Test, dass eine Adresse ohne bekannten Pfad **nichts**
      bewegt. Das ist die Gegenprobe — ohne sie belegte ein grüner Test auch
      einen Sprung auf gut Glück.
- [ ] 6.3 Zuhörer auf `appUrlOpen` in `AppShell.tsx`, nach dem Vorbild von
      `pushZielZuhoerer`: er steht, sobald die Hülle steht, nicht nach dem
      Anmelden.
- [ ] 6.3b Die vier Pfade **einmal** als Modul aussprechen; AASA und Manifest
      verweisen im Kommentar darauf. Sonst stehen sie an drei Stellen und laufen
      auseinander, ohne dass es jemand vor dem Gerätetest merkt.
- [ ] 6.4 Test, dass der Zuhörer beim Abräumen wieder entfernt wird — dasselbe
      Muster, das der `backButton`-Zuhörer daneben bereits trägt.

## 7. Die Zielerhaltung über die Anmeldung

- [ ] 7.1 **RED:** Test, dass ein nicht angemeldetes Mitglied nach der Anmeldung
      am ursprünglichen Ziel steht und nicht auf der Startseite.
- [ ] 7.2 **RED, und das ist der Sicherheitsteil:** Test, dass ein Ziel mit
      Schema, Host oder führendem `//` **verworfen** wird und die Anmeldung auf
      die Startseite führt. Ohne diese Verengung ist die Zielerhaltung eine
      offene Weiterleitung, ausgelöst direkt nach der Eingabe der Zugangsdaten.
- [ ] 7.3 Umsetzen, und zwar **an diesen beiden Stellen**:
      `src/components/RequireAuth.tsx` reicht das Ziel über den
      Navigationszustand weiter — es tut heute `<Navigate to="/login" replace />`
      und **verwirft den Ort vollständig** (am Repo bestätigt, Befund opencode
      HOCH) — und `src/pages/LoginPage.tsx` liest ihn nach erfolgreicher
      Anmeldung. **Kein Query-Parameter:** `LoginPage` führt bereits `?modus=`
      (Zeile 89), und ein Ziel im Query stünde in jedem Zugriffsprotokoll.
      Der Aktivierungsweg bleibt ausgenommen — das Token trägt die Identität.
- [ ] 7.3b Test, dass ein angemeldetes, **nicht aktiviertes** Konto sein Ziel
      behält. `ActivationGate` tauscht den gerenderten Baum aus und navigiert
      NICHT, die Adresse bleibt also stehen — geprüft am Repo. Die Review
      vermutete hier eine zweite Wand; es ist keine. Die Zusage gehört trotzdem
      gepinnt, weil sie heute nur aus der Bauart folgt.
- [ ] 7.4 Test, dass der Aktivierungsvorgang **keine** Anmeldung verlangt und
      kein Hinweis auf die App davorliegt.

## 8. Gerätebeleg

Grüne Tests belegen hier fast nichts — alles hängt an zwei Dateien auf einem
fremden Host und an zwei Betriebssystemen.

- [ ] 8.0 **Zuerst den Kaltstart**, nicht den Warmstart: App vollständig
      beenden, dann den Link öffnen. Das ist der Fall, der beim ersten Kontakt
      aus der Einladungsmail zählt, und der einzige, dessen Zustellung dieser
      Change nur behauptet statt gemessen hat (Befund opencode, NIEDRIG).
- [ ] 8.0b **Den Weg des Abnahme-Baus auf iOS festlegen und gehen.** Entitlement
      und Manifest sind nativ und reisen NICHT über den OTA-Weg — der tauscht
      nur `public/`. Ohne Store-Einreichung (die ist AGE-644) erreicht also
      keine iOS-Fassung mit `applinks:` ein Gerät von allein. Gewählter Weg:
      Direktinstallation aus Xcode auf ein registriertes Gerät, wie in M2/B3.
      Ohne diesen Schritt ist 8.1 nicht ausführbar (Befund opencode, MITTEL).
- [ ] 8.1 **iOS, App installiert:** Aktivierungslink aus einer echten Mail
      öffnen. Die App öffnet sich am Ziel. Beim Messen den Entwicklermodus der
      Association verwenden und das im Beleg **vermerken** — Apple
      zwischenspeichert die Datei, und ein Lauf ohne diesen Vermerk belegt
      nicht, was er zu belegen scheint.
- [ ] 8.2 **iOS, App nicht installiert:** derselbe Link öffnet die Website und
      der Vorgang läuft zu Ende.
- [ ] 8.3 **Android, direkt installiertes Paket:** dasselbe Paar. Das Paket
      MUSS mit dem **Upload-Schlüssel** signiert sein, nicht mit dem
      Debug-Schlüssel — `autoVerify` vergleicht den Signierer der installierten
      App gegen `assetlinks.json`, und ein Debug-Bau scheitert mit genau dem
      irreführenden Bild, vor dem dieser Change warnt. Vor dem Gerätelauf mit
      `apksigner verify --print-certs` gegen den in 4.3 eingetragenen
      Fingerabdruck halten (Befund opencode, MITTEL). Der Beleg gilt
      ausdrücklich **nicht** für die Play-Fassung (Entscheidung 6).
- [ ] 8.4 Die drei übrigen Pfade je einmal auf einer Plattform, aus WhatsApp und
      aus Mail heraus.
- [ ] 8.4b Den **Rückweg** prüfen: die Brotkrume oben links auf iOS und die
      Zurück-Taste auf Android führen in die Anwendung zurück, aus der der Link
      kam (Befund gemini, NIEDRIG). Das leistet das Betriebssystem, aber nur bei
      einem echten Universal Link — bricht es, ist es ein Hinweis darauf, dass
      der Link anders geöffnet wurde als gedacht.
- [ ] 8.5 Gerät zurückstellen, wie es übernommen wurde.

## 9. Abnahme und Abschluss

- [ ] 9.1 `pnpm test`, `typecheck`, `lint`, `build`, `openspec validate --all` —
      alle grün, Zahlen festhalten.
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
