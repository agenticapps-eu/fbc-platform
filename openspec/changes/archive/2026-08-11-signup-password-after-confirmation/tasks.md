# Tasks — Passwort nach der Bestätigung (AGE-527)

Test vor Code. Ein Haken ohne gesehenen roten Lauf ist keiner.

## 1. Plan-Review (vor der ersten Codezeile)

- [x] 1.1 `openspec validate --all` grün
- [x] 1.2 Zwei Reviewer **anderer Hersteller** über die Deltas, `REVIEWS.md`
- [x] 1.3 Einsprüche einarbeiten oder mit Begründung abweisen

## 2. Die Registrierung ohne Passwort

- [x] 2.1 Vitest **RED**: das Registrierungsformular zeigt **kein** Passwortfeld
- [x] 2.2 Vitest **RED** (Befund HIGH): die Registrierung **geht durch** —
      `signUp` wird aufgerufen und **keine** Schema-Meldung erscheint. Das Zod-
      Schema verlangt heute `password` in beiden Modi; wer nur das Feld entfernt,
      baut einen Knopf, der wortlos nichts tut. Ein Test, der bloß „wurde ohne
      Passwort aufgerufen" prüft, sieht das nicht
- [x] 2.3 Vitest **RED**: zwei Registrierungen erzeugen **verschiedene**
      Passwörter — ein fester Platzhalter wäre ein Generalschlüssel (D1).
      **Kein Krypto-Mock**: eine deterministische Attrappe machte diesen Test
      wertlos
- [x] 2.4 Vitest **RED**: das erzeugte Passwort erfüllt die Mindestlänge des
      Projekts (10), sonst lehnt der Anmeldedienst still ab
- [x] 2.5 `AuthProvider.signUp` auf `(email, fullName)` umstellen (D2), Passwort
      aus dem CSPRNG
- [x] 2.6 `LoginPage`: Passwortfeld nur noch im Login-Modus, **und das Schema
      modusbewusst** machen (Union oder `superRefine`)
- [x] 2.7 `auth-context.ts` nachziehen — die Signatur steht dort ein zweites Mal
- [x] 2.8 Alle Aufrufer und Attrappen nachziehen (`auth-fixtures`,
      `LoginPage.test.tsx` assertiert heute hart `"geheim1234"`)
- [x] 2.9 Alle Zweige **GREEN**

## 3. Der Erfolgsschirm

- [x] 3.1 Vitest **RED**: nach `activated` erscheint die Bestätigung, und der
      Login wird **nicht** sofort gezeigt. Dazu die Negativprobe (Befund
      MEDIUM): es ist **weder** das Passwortformular **noch** das „Link
      anfordern"-Formular sichtbar — die Verzweigung ist heute zweiwertig, und
      der Erfolg fällt sonst in den Anfordern-Zweig
- [x] 3.2 Vitest **RED**: ein Knopf führt sofort zum Login
- [x] 3.3 Vitest **RED**: ohne Zutun folgt die Weiterleitung nach der
      angekündigten Frist (Zeit im Test kontrolliert, nicht abgewartet)
- [x] 3.4 Vitest **RED**: beim Zweck `reset` spricht der Text vom
      zurückgesetzten Passwort, nicht von einer Aktivierung (D4)
- [x] 3.5 `ActivationRedeemPage` umbauen: Erfolg als **dritter** Fall der
      Verzweigung; `signOut` sofort, nur die Weiterleitung wartet (D3)
- [x] 3.6 Vitest **RED**: `signOut` läuft **sofort** beim Übergang in den
      Erfolgszustand, nicht erst mit der Weiterleitung (D3) — sonst hält der
      Browser zehn Sekunden ein serverseitig widerrufenes Token
- [x] 3.7 Alle Zweige **GREEN**

## 4. Sichtprobe statt Vertrauen

- [x] 4.1 Lokaler Stack: registrieren **ohne** Passwortfeld, Link öffnen,
      Passwort setzen, Erfolgsschirm gesehen. **Ohne echte Mail**: der
      Function-Server lief mit ungültigem Resend-Schlüssel, das Token habe ich
      selbst gesetzt — die Zustellung ist in AGE-526 belegt und musste hier
      niemanden ein zweites Mal behelligen
- [x] 4.2 Mit dem gesetzten Passwort angemeldet: die Startseite steht, Stufe
      „Basic", volle Navigation — der Weg trägt bis ins Konto
- [x] 4.3 Denselben Schirm über `/passwort-neu` geprüft (Zweck `reset`):
      „Dein **neues** Passwort ist gesetzt" plus der Hinweis auf die Abmeldung
      auf allen Geräten — kein Wort von einer Aktivierung, und der doppelte
      Fußzeilen-Link fehlt dort ebenfalls

## 5. Abschluss

- [x] 5.1 Unabhängiger Reviewer über den **Diff** — nachgeholt am 2026-08-11
      nach dem Merge (er war durchgerutscht). APPROVE mit vier Befunden: drei
      behoben, einer entkräftet. Auflösung in `REVIEWS.md`
- [x] 5.2 `verification-before-completion`: 499 Vitest, Typen sauber, eslint
      ohne Fehler; der ganze Weg lokal gegangen und am Live-Bundle gemessen
- [x] 5.3 PR #154 gemergt und ausgerollt (Bundle `index-D9sUq5Ru.js` trägt alle
      drei Marker); Linear AGE-527 auf Done
