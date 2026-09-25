## 1. Klären und messen, bevor gebaut wird

- [x] 1.1 Nur verbergen oder Route unerreichbar? **Unerreichbar per Redirect**,
      Muster AGE-450 (Donald, 25.09.). Der Rückweg für AGE-908 sind zwei Zeilen.
- [x] 1.2 Was an die Stelle des „Upgrade"-Knopfes tritt: **ein Satz, der sagt,
      dass der Club die Stufe freischaltet** (Donald, 25.09.).
- [x] 1.3 Die sieben Einstiege gezählt, nicht geschätzt:
      `grep -rn '"/mitgliedschaft"' src/`.
- [x] 1.4 Gemessen, was das Prüferkonto (`connect`) auf der Seite sieht:
      6 Preiskarten, 4 Upgrade-Knöpfe, Beträge 150/300/600/1200 € pro Jahr.
      Ein `impact`-Konto sieht nichts davon — daher der Eindruck, die Fläche sei
      schon leer.
- [x] 1.5 Geprüft, dass kein aktiver Change dieselbe Anforderung anfasst:
      `grep -rln "billing-upgrades\|AGE-907" openspec/changes/ --exclude-dir=archive`
      → keine Treffer.
- [x] 1.6 Geprüft, dass Punkt 2 und 3 wirklich ohne Delta laufen: keine
      Anforderung in `native-shell` oder `notifications` sagt etwas über die
      Berechtigungsmenge des Manifests oder den Verschlüsselungsschlüssel.
- [x] 1.7 `openspec validate --all` grün (35 Elemente).
- [x] 1.8 **Kein Fremdreviewer** — reine UI- und Dokumentarbeit, kein Schema,
      keine Rechte, keine Sicherheit (Donalds Regel vom 26.08.). Stattdessen der
      Schritt, der dann als einziger bleibt: den `MODIFIED`-Block klauselweise
      gegen die durable Spec gemessen — beide Szenario-Titel zeichengleich, keine
      Klausel verloren, Extraktion mit Positivkontrolle. Eine Klausel, die ich
      eingeschmuggelt hatte („wer `impact` trägt, sieht keine Preise" — wahr, aber
      nirgends spezifiziert), ist wieder heraus: ein `MODIFIED`-Block bekräftigt
      alles, was in ihm steht.

## 2. Wächter zuerst (RED)

- [x] 2.1 `scripts/ios-export-compliance.test.ts`: Schlüssel vorhanden, Wert
      `false`, plus Positivkontrolle auf die Datei. **Rot belegt** (zwei
      Zusagen), dann grün. Mutationstest: Wert auf `true` → rot.
- [x] 2.2 Eigener Wächter für den Kaufweg geschrieben, rot belegt (fand alle
      sieben Einstiege) — und dann **gelöscht**. `redirect-targets.test.ts`
      leistet dasselbe seit AGE-494 und leitet die Routenliste aus `App.tsx` ab.
      Zwei Wahrheiten über eine Zusage sind eine zu viel (design.md,
      Entscheidung 6).
- [x] 2.3 Stattdessen `redirect-targets.test.ts` geschärft: das Muster sah
      `navigate(x ? … : "/route")` nicht — genau die Form von
      `HeaderSearch.tsx:224` —, und es hatte keine Positivkontrollen. Jetzt neun
      davon, fünf die treffen müssen und vier die verschonen müssen. 18 Zusagen
      grün.

## 3. Route unerreichbar machen

- [x] 3.1 `src/config/nav.ts`: `navItem`-Block entfernt, lazy-Import entfernt,
      zwei Kommentare berichtigt — der Kopf und der Block behaupteten seit
      AGE-494 „unerreichbar", was nie stimmte.
- [x] 3.2 `src/App.tsx`: Redirect in die bestehende Traube, mit Begründung und
      Rückweg im Kommentar.
- [x] 3.3 `src/App.test.tsx`: Redirect belegt, für `connect` UND `impact`.
      **Zwei Fassungen davor waren wertlos, beide vom Mutationstest überführt** —
      die erste wartete auf „Aktivität" (ein Eintrag der Seitenleiste, sofort da,
      egal welche Seite rendert), die zweite auf Text aus `MemberDashboard`, das
      `/` in diesem Aufbau gar nicht rendert. Gemessen wird jetzt die ADRESSE.
      Mutanten: Redirect weg → rot; Route als echte Seite zurück → rot.
- [x] 3.4 `src/config/nav.test.ts`: aus beiden Listen genommen, „vierzehn" →
      „dreizehn", plus eine eigene Zusage, dass die Route **gar nicht** mehr als
      navItem existiert (mit Positivkontrolle) — ein bloßes Streichen wäre auch
      grün, wenn sie mit Menüeintrag zurückkäme.

## 4. Die sieben Einstiege

- [x] 4.1 `ProfilAnsichtPage.tsx`: `showManageCta` nicht mehr übergeben — und in
      `MembershipSummary` ganz entfallen (design.md, Entscheidung 4), samt den
      zwei Zusagen dazu und dem `MemoryRouter` im Test, der ohne Link Kulisse war.
- [x] 4.2 `AppShell.tsx`: Menüeintrag entfernt. `tier` bleibt in Gebrauch
      (`TierBadge`), keine unbenutzte Variable.
- [x] 4.3 `MemberDashboard.tsx`: nur `to` entfernt, `cta` bleibt — wie bei der
      Event-Kachel ohne Event.
- [x] 4.4 `EinstellungenPage.tsx`: Knopf entfernt, Abzeichen und Stufenname
      bleiben.
- [x] 4.5 `MembershipGate.tsx`: Knopf → Satz. Test zuerst umgedreht: kein
      Kaufweg (beide Rollen geprüft), der Satz ist da (Positivkontrolle), die
      anonyme Fläche führt unverändert in die Registrierung.
- [x] 4.6 `HeaderSearch.tsx`: Verzweigung aufgelöst, immer ins Verzeichnis.
      Knopf heißt „Im Verzeichnis weitersuchen". Test erwartet `/mitglieder?q=…`.
- [x] 4.7 `EventDetailPage.tsx`: Link entfernt, Satz behalten, `{" "}` mit.
- [x] 4.8 **Eine achte Stelle, die im Plan fehlte:**
      `AppShell.identity.test.tsx` trug zwei Zusagen zum Menüeintrag — „NICHT für
      `impact`" (AGE-633) und „weiterhin für eine niedrigere Stufe". Genau diese
      Unterscheidung war das Problem. Beide sind zu einer über **alle sechs
      Stufen** zusammengefasst; die erste allein stehen zu lassen wäre wertlos
      geworden.

## 5. Zwei Punkte aus AGE-907 ohne Spec-Delta

- [x] 5.1 `ios/App/App/Info.plist`: `ITSAppUsesNonExemptEncryption` = `false`,
      mit Begründung im Kommentar. 13 Zeilen eingefügt, keine gelöscht — die
      Datei mischt Tabs und Leerzeichen, deshalb byte-genau eingesetzt statt
      neu formatiert. `plutil -lint` OK, `plutil -extract` liest `false`.
- [x] 5.2 `POST_NOTIFICATIONS` im **zusammengeführten** Manifest nachgewiesen —
      debug und release, Berechtigungsmengen zeichengleich, beigetragen von
      `firebase-messaging:25.0.1` (Blame-Report). **Nichts ergänzt:** eine zweite
      Deklaration derselben Berechtigung wäre eine zweite Wahrheit. Weg dorthin,
      weil er beim letzten Versuch scheiterte: `npx cap update android` mit
      gesetztem `VITE_SUPABASE_URL`, davor `mkdir -p
      android/app/src/main/assets` und ein `dist/index.html`, dazu eine
      `google-services.json`-Attrappe; dann die beiden Manifest-Tasks mit
      `JAVA_HOME` 21 — **ohne Pipe**, Exit-Code selbst gelesen.
- [x] 5.3 `docs/store-datenschutzangaben.md`: Befund 3 als widerlegt vermerkt,
      mit Herkunft und Weg; Befund 2 als erledigt, mit der Korrektur „zwei
      Stellen" → sieben und dem `zeigtPreise`-Befund; Punkte 2 und 3 der
      Absende-Liste abgehakt.

## 6. Prüfen

- [x] 6.1 `pnpm typecheck` grün, `pnpm lint` 0 Fehler (7 Warnungen, alle
      vorbestehend und in fremden Dateien), `pnpm test` 2846 Zusagen grün.
      Kein `pnpm format`.
- [x] 6.2 Sichtprobe im Browser, gegen den **lokalen** Stack, mit einem eigens
      angelegten Konto auf `connect` (der Stufe des Prüferkontos) und danach auf
      `basic`. Belegt, dass die App wirklich lokal hängt, statt es anzunehmen:
      alle Supabase-Anfragen gingen an `127.0.0.1:54321`, kein einziger
      `supabase.co`-Host.

      | Fläche | Befund |
      | --- | --- |
      | `/profil` | Karte „Deine Mitgliedschaft / Connect / Nächster Schritt: Discover" da, **kein** Knopf „Mitgliedschaft verwalten", kein Link |
      | Profilmenü | „Mein Bereich", „Profil", „Logout" — **kein** „Mitgliedschaft"; das Stufen-Abzeichen „Connect" steht weiter darin |
      | `/einstellungen` | „Mitgliedschaft / Connect / Connect-Mitglied", **kein** „Stufe ansehen & upgraden" |
      | `/` (Startseite) | Kachel „Mitgliedschaft / Connect / Deine aktuelle Stufe" **ohne** „Plan verwalten →"; die Nachbarkachel trägt ihr „Zur Aktivität →" weiter — die Positivkontrolle, dass Kachel-Pfeile überhaupt rendern |
      | `/mitgliedschaft` | landet auf `/`; 0 Preiskarten im DOM, keine Beträge, kein Jahr/Monat-Schalter, kein „Upgrade", kein „Testzahlung" |
      | Stufen-Wand (`/mitglieder` als `basic`) | „Dieser Bereich ist ab Connect verfügbar" + „Höhere Stufen schaltet der Fair Business Club für dich frei — sprich uns an."; **genau ein** Knopf, „Zur Startseite" |
      | Kopfzeilen-Suche als `basic` | Enter führt auf `/mitglieder?q=anna`, nicht in den Kaufweg |

      Der Link am Event ist **nicht** von Hand geprüft — er bräuchte ein Event mit
      Mindeststufe `discover`; er ist durch den Diff und die Tests gedeckt.

      Aufgeräumt: Konto gelöscht (`DELETE /auth/v1/admin/users` antwortet 200 und
      lässt `profiles` UND `member_settings` stehen — beide Zeilen von Hand
      entfernt), Stufenverteilung wieder wie vorgefunden (basic 3, connect 4,
      discover 3, exchange 3, focus 6, impact 8), `.env.local` gelöscht,
      vite auf 5219 gestoppt.
- [~] 6.3 Code-Review durch einen unabhängigen Reviewer, auf dem Diff.
      **Bewusst entfallen** (Donalds Regel 26.08.: Fremdreviewer nur bei
      Schema, Rechten, Sicherheit — dies ist reine UI- und Dokumentarbeit).
      Stattdessen der `MODIFIED`-Block klauselweise gegen die durable Spec
      gemessen.
- [x] 6.4 `openspec validate --all` erneut grün.

## 7. Abschluss

- [x] 7.1 Conventional Commit mit `AGE-907`, signiert. `0bf422b` (Code) und
      `39051a0` (Sichtprobe).
- [x] 7.2 PR gegen `main`. In den Text: der Rückweg für AGE-908, der widerlegte
      Manifest-Verdacht, die drei wertlosen Testfassungen und was sie überführt
      hat, und dass der Merge AGE-907 wahrscheinlich schließt, obwohl alle
      Handschritte offen bleiben.
- [x] 7.3 Archivieren **erst nach** dem Merge, dann `pnpm release:entries`.
      PR #419 als `935b987` auf `main` gemerged (25.09.), danach archiviert.
