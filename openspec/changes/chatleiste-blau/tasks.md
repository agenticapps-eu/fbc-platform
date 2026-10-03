## 1. Die Tokens

- [ ] 1.1 Vitest `src/components/AppShell.chatleiste.test.tsx` erweitern: die
      Leiste trägt in beiden Zuständen `fbc-chat-rail` und **keine**
      zustandsabhängige Flächenklasse — RED
- [ ] 1.2 `src/index.css`: `--chat-rail-surface` und die sieben
      `--thread-*`-Tokens auf `:root` (Rückfall auf die Inhaltsfarben),
      Überschreibung unter `html[data-variant="navy"] .fbc-chat-rail`
- [ ] 1.3 `.fbc-chat-rail { background: var(--chat-rail-surface); }`

## 2. Die Oberfläche

- [ ] 2.1 `AppShell.tsx`: die Fallunterscheidung eingeklappt/ausgeklappt
      entfällt; beide Kopfzeilen und der Ungelesen-Punkt auf Leisten-Tokens
- [ ] 2.2 `ThreadList.tsx`: die sieben Farbstellen auf Leisten-Tokens
- [ ] 2.3 Vitest GRÜN für 1.1
- [ ] 2.4 Ein Test, der die **benutzten** Variablennamen gegen die in
      `index.css` **gesetzten** prüft — ein Tippfehler wird sonst zu „keine
      Farbe" und fällt bei keinem Typcheck auf
- [ ] 2.5 `pnpm lint`, `pnpm typecheck`, `pnpm test` grün

## 3. Belegen

- [ ] 3.1 Kontraste gegen die gesetzten Tokenwerte nachrechnen — als Test, nicht
      als Notiz, damit eine geänderte Farbe rot wird
- [ ] 3.2 Sichtprobe gegen den lokalen Stack: hell und navy, ein- und
      ausgeklappt, mit ungelesenem Thread und aktivem Hover, Breite xl.
      Screenshots nach `.gstack/chatleiste/`
- [ ] 3.3 Prüfen, dass `/chat` und die Chat-Fenster in beiden Modi hell bleiben
      — im Bild, nicht nur im Test

## 4. Abschluss

- [ ] 4.1 `openspec validate --all` grün
- [ ] 4.2 Code-Review auf dem Diff, Befunde abarbeiten
- [ ] 4.3 `docs/technisches-handbuch.md` nachziehen, wo es die Leisten-Flächen
      nennt
- [ ] 4.4 Archivieren samt Vorab-Sonde auf den Neuigkeiten-Eintrag, dann
      `pnpm release:entries`
