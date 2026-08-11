# Tasks — Passwort nach der Bestätigung (AGE-527)

Test vor Code. Ein Haken ohne gesehenen roten Lauf ist keiner.

## 1. Plan-Review (vor der ersten Codezeile)

- [x] 1.1 `openspec validate --all` grün
- [x] 1.2 Zwei Reviewer **anderer Hersteller** über die Deltas, `REVIEWS.md`
- [x] 1.3 Einsprüche einarbeiten oder mit Begründung abweisen

## 2. Die Registrierung ohne Passwort

- [ ] 2.1 Vitest **RED**: das Registrierungsformular zeigt **kein** Passwortfeld
- [ ] 2.2 Vitest **RED** (Befund HIGH): die Registrierung **geht durch** —
      `signUp` wird aufgerufen und **keine** Schema-Meldung erscheint. Das Zod-
      Schema verlangt heute `password` in beiden Modi; wer nur das Feld entfernt,
      baut einen Knopf, der wortlos nichts tut. Ein Test, der bloß „wurde ohne
      Passwort aufgerufen" prüft, sieht das nicht
- [ ] 2.3 Vitest **RED**: zwei Registrierungen erzeugen **verschiedene**
      Passwörter — ein fester Platzhalter wäre ein Generalschlüssel (D1).
      **Kein Krypto-Mock**: eine deterministische Attrappe machte diesen Test
      wertlos
- [ ] 2.4 Vitest **RED**: das erzeugte Passwort erfüllt die Mindestlänge des
      Projekts (10), sonst lehnt der Anmeldedienst still ab
- [ ] 2.5 `AuthProvider.signUp` auf `(email, fullName)` umstellen (D2), Passwort
      aus dem CSPRNG
- [ ] 2.6 `LoginPage`: Passwortfeld nur noch im Login-Modus, **und das Schema
      modusbewusst** machen (Union oder `superRefine`)
- [ ] 2.7 `auth-context.ts` nachziehen — die Signatur steht dort ein zweites Mal
- [ ] 2.8 Alle Aufrufer und Attrappen nachziehen (`auth-fixtures`,
      `LoginPage.test.tsx` assertiert heute hart `"geheim1234"`)
- [ ] 2.9 Alle Zweige **GREEN**

## 3. Der Erfolgsschirm

- [ ] 3.1 Vitest **RED**: nach `activated` erscheint die Bestätigung, und der
      Login wird **nicht** sofort gezeigt. Dazu die Negativprobe (Befund
      MEDIUM): es ist **weder** das Passwortformular **noch** das „Link
      anfordern"-Formular sichtbar — die Verzweigung ist heute zweiwertig, und
      der Erfolg fällt sonst in den Anfordern-Zweig
- [ ] 3.2 Vitest **RED**: ein Knopf führt sofort zum Login
- [ ] 3.3 Vitest **RED**: ohne Zutun folgt die Weiterleitung nach der
      angekündigten Frist (Zeit im Test kontrolliert, nicht abgewartet)
- [ ] 3.4 Vitest **RED**: beim Zweck `reset` spricht der Text vom
      zurückgesetzten Passwort, nicht von einer Aktivierung (D4)
- [ ] 3.5 `ActivationRedeemPage` umbauen: Erfolg als **dritter** Fall der
      Verzweigung; `signOut` sofort, nur die Weiterleitung wartet (D3)
- [ ] 3.6 Vitest **RED**: `signOut` läuft **sofort** beim Übergang in den
      Erfolgszustand, nicht erst mit der Weiterleitung (D3) — sonst hält der
      Browser zehn Sekunden ein serverseitig widerrufenes Token
- [ ] 3.7 Alle Zweige **GREEN**

## 4. Sichtprobe statt Vertrauen

- [ ] 4.1 Lokaler Stack: registrieren **ohne** Passwortfeld, Mail empfangen,
      Link öffnen, Passwort setzen — und den Erfolgsschirm sehen
- [ ] 4.2 Mit dem gesetzten Passwort anmelden: der Weg trägt bis ins Konto
- [ ] 4.3 Denselben Schirm über `/passwort-neu` prüfen (Zweck `reset`)

## 5. Abschluss

- [ ] 5.1 Unabhängiger Reviewer über den **Diff**
- [ ] 5.2 `verification-before-completion`: jeder Haken trägt einen Beleg
- [ ] 5.3 PR, Linear AGE-527, nach dem Ausrollen archivieren
