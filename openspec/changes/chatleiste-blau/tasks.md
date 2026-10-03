## 1. Die Tokens

- [x] 1.1 Vitest `src/components/AppShell.chatleiste.test.tsx` erweitern: die
      Leiste trägt in beiden Zuständen `fbc-chat-rail` und **keine**
      zustandsabhängige Flächenklasse — RED
- [x] 1.2 `src/index.css`: `--chat-rail-surface` und die sieben
      `--thread-*`-Tokens auf `:root` (Rückfall auf die Inhaltsfarben),
      Überschreibung unter `html[data-variant="navy"] .fbc-chat-rail`
- [x] 1.3 `.fbc-chat-rail { background: var(--chat-rail-surface); }`

## 2. Die Oberfläche

- [x] 2.1 `AppShell.tsx`: die Fallunterscheidung eingeklappt/ausgeklappt
      entfällt; beide Kopfzeilen und der Ungelesen-Punkt auf Leisten-Tokens
- [x] 2.2 `ThreadList.tsx`: die sieben Farbstellen auf Leisten-Tokens
- [x] 2.3 Vitest GRÜN für 1.1
- [x] 2.4 Ein Test, der die **benutzten** Variablennamen gegen die in
      `index.css` **gesetzten** prüft — ein Tippfehler wird sonst zu „keine
      Farbe" und fällt bei keinem Typcheck auf
- [x] 2.5 `pnpm lint`, `pnpm typecheck`, `pnpm test` grün

## 3. Belegen

- [x] 3.1 Kontraste gegen die gesetzten Tokenwerte nachrechnen — als Test, nicht
      als Notiz, damit eine geänderte Farbe rot wird
- [x] 3.2 Sichtprobe gegen den lokalen Stack bei 1440 px, mit drei eigens
      angelegten Konten und einem Gespräch mit zwei ungelesenen Nachrichten.
      Belegt, dass die App wirklich lokal hängt (`127.0.0.1:54321` in den
      Ressourcen), nicht angenommen. **Gemessen am laufenden Baum**, nicht nur
      an den Tokens: Leiste `rgb(0, 43, 81)` ein- und ausgeklappt, linke
      Navigation unverändert `rgb(8, 21, 39)`, Name `#FFFFFF`, Vorschau
      `#B9CCE6`, Abzeichen `#5B90E0` auf `#00172B`, Leerzustand-Knopf `#D7E4F2`
      auf `#0C2043`. Sieben Screenshots in `.gstack/chatleiste/` — das
      Verzeichnis ist gitignoriert, und das ist hier wichtig: die Bilder zeigen
      Namen aus dem lokalen Spiegel, und der ist nicht anonymisiert
- [x] 3.2b Danach aufgeräumt und nachgezählt: 28 Profile, 28 Konten, 1 Thread,
      6 Nachrichten — der Stand von vorher. `.env.local` gelöscht, der
      vite-Prozess beendet
- [x] 3.3 `/chat` bleibt im dunklen Modus hell — im Bild belegt: Hinweistext
      `rgb(98, 111, 133)` (der HELLE Wert), Seitenhintergrund hell, und die
      Leiste ist dort gar nicht montiert. Das ist der Beleg, dass die
      Umlegung der Chrome-Tokens die Leiste nicht verlässt

## 4. Abschluss

- [x] 4.1 `openspec validate --all` grün
- [ ] 4.2 Code-Review auf dem Diff, Befunde abarbeiten
- [ ] 4.3 `docs/technisches-handbuch.md` nachziehen, wo es die Leisten-Flächen
      nennt
- [ ] 4.4 Archivieren samt Vorab-Sonde auf den Neuigkeiten-Eintrag, dann
      `pnpm release:entries`
