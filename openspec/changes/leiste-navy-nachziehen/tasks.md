# Tasks — beide Leisten tragen dasselbe Dunkelblau

## 1. Den Zustand festnageln, bevor etwas wandert

- [ ] 1.1 Gegenprobe vorbereiten: `src/index.chatleiste-tokens.test.ts` prüft
      heute, dass `--sidebar-surface` im navy-Block `#081527` ist. Diese Zusage
      ist das RED dieses Changes — sie muss zuerst umgedreht werden und
      scheitern, bevor das CSS wandert.
- [ ] 1.2 Die Kontraste der linken Leiste als Zusagen schreiben: inaktiver
      Eintrag, Abschnittsmarke, aktiv/Wortmarke/Hover-Schrift, Punkte der
      Wortmarke, Fokusring. Aus den gesetzten Tokenwerten gerechnet, nicht als
      Zahlen hingeschrieben.
- [ ] 1.3 Die Zusage für den hellen Modus **Wert für Wert**: `--leiste-focus`
      auf `:root` ist genau `#2F6BD1`.
- [ ] 1.4 Die Zusage, dass die vier Komponenten den Token wirklich **lesen** —
      sonst liesse sich der Fokusring zurückdrehen und die Suite bliebe grün.
      Das ist der Befund aus AGE-1002, der hier vorweggenommen wird.
- [ ] 1.5 Die Zusage, dass `--color-chrome` im navy-Block `#081527` **bleibt** —
      die Regression, die Entscheidung 1 verhindert, braucht einen Wächter.
- [ ] 1.6 Tests laufen lassen und RED belegen (Ausgabe lesen, nicht annehmen).

## 2. Umsetzen

- [ ] 2.1 `src/index.css`: `--sidebar-surface` im Block
      `html[data-variant="navy"]` auf `#002b51`, mit Kopfkommentar, der auf die
      Antwort zu E7 verweist.
- [ ] 2.2 `src/index.css`: `--leiste-focus` im `@theme`-Block auf `#2f6bd1` (mit
      der Begründung, warum genau dieser Wert) und im navy-Block auf `#b9cce6`.
- [ ] 2.3 Den Kommentar im `@theme`-Block berichtigen, der sagt, die Leiste sei
      „bewusst NICHT `--color-chrome`, weil daran die linke Navigation hängt" —
      gemessen falsch.
- [ ] 2.4 `src/components/AppShell.tsx`: der Fokusring der Wortmarke liest den
      Token.
- [ ] 2.5 `src/components/ui/SidebarNav.tsx`: der Fokusring der Abschnittsmarken
      liest den Token.
- [ ] 2.6 `src/components/feedback/FeedbackButton.tsx`: der Fokusring des
      Knopfes in der Leiste liest den Token. Der Fokusring **im Overlay**
      (`ring-accent-strong`) bleibt — er steht nicht auf der Leiste.
- [ ] 2.7 `src/components/LeistenPill.tsx`: der „leiste"-Zweig liest
      `--leiste-focus`, der „chat"-Zweig weiter `--thread-focus`. Den Kommentar
      berichtigen, der behauptet, links ändere sich nichts.
- [ ] 2.8 Tests laufen lassen und GREEN belegen.
- [ ] 2.9 Den Kommentar in `AppShell.chatleiste.test.tsx` nachziehen, der
      `#081527` als Farbe der eingeklappten Leiste nennt.

## 3. Nachweisen

- [ ] 3.1 Volle Suite, `lint`, `typecheck`, `build`. Nach dem Build und vor
      jedem `git add`: `git checkout -- src/content/release-entries.generated.ts`.
- [ ] 3.2 Positivkontrolle: `--sidebar-surface` versuchsweise auf `#081527`
      zurückdrehen und belegen, dass die neuen Zusagen rot werden. Die Kopie
      liegt im Scratchpad, **nicht** per `git checkout` zurückholen.
- [ ] 3.3 Positivkontrolle für den Fokusring: eine der vier Klassen auf
      `ring-accent` zurückdrehen und belegen, dass der Lese-Wächter rot wird.
- [ ] 3.4 Sichtprobe gegen den lokalen Stack bei 1440 px: hell und navy, die
      Navigation aufgeklappt und eingeklappt, der aktive Eintrag, ein Eintrag
      unter dem Zeiger, der Fokusring per Tastatur. Am laufenden Baum gemessen,
      nicht an den Tokens. Zählstände vorher und nachher protokollieren, `.env.local`
      danach löschen, vite beenden.
- [ ] 3.5 Belegen, dass `/onboarding`, `/willkommen` und ein sekundärer Knopf
      ausserhalb der Leisten im navy-Modus unverändert `#081527` tragen — der
      „kein Durchschlagen"-Beleg dieses Changes.

## 4. Abschliessen

- [ ] 4.1 `docs/technisches-handbuch.md`: den Satz berichtigen, die Leiste sei
      „ausdrücklich nicht das `#081527` der linken Navigation".
- [ ] 4.2 `REVIEWS.md` schreiben: kein Fremdreviewer, mit Begründung.
- [ ] 4.3 Code-Review auf dem Diff.
- [ ] 4.4 Befunde abarbeiten.
- [ ] 4.5 `openspec validate --all` grün.
- [ ] 4.6 Vorab-Sonde auf den Neuigkeiten-Eintrag (H1, Linear-Zeile, nur
      Mitglieder-Sprache unter `## What Changes`, keine Ausschluss-Punkte) —
      **vor** dem Archivieren.
- [ ] 4.7 Archivieren, `pnpm release:entries`, Diffgrösse messen.
- [ ] 4.8 PR mit den gerechneten Zahlen im Text. Keine Migration, also kein
      `drift-gate`-Hinweis nötig.
