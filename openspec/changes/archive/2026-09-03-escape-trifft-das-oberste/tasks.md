# Aufgaben — `escape-trifft-das-oberste` (AGE-697)

Alle Zeilennummern gegen `0b6aa29` gemessen, dem Stand, auf dem dieser Branch
abzweigt.

## A · RED

- [x] A1 · Zusage aus Szenario 1 und 2 in `src/components/AppShell.overlay.test.tsx`:
      Schublade auf, Feedback auf, Escape — Formular weg, Schublade steht und
      trägt wieder `aria-modal="true"`; zweites Escape schliesst die Schublade.
- [x] A2 · Zusage aus Szenario 3 in `src/components/feedback/FeedbackButton.test.tsx`:
      Formular ohne Schublade darunter, Escape schliesst es.
- [x] A3 · **RED belegt, je aus dem richtigen Grund:**
      - A1: `Unable to find an accessible element with the role "dialog" and
        name /navigation/i` — die Schublade war nach Escape **mit weg**.
      - A2: `expected <div …> to be null` — das Formular stand nach Escape
        **noch da**.

## B · GREEN

- [x] B1 · In `FeedbackButton.tsx` ein Escape-Lauscher am `document` in der
      **Capture**-Phase mit `stopPropagation()`, nach dem Vorbild von
      `EmojiAuswahl.tsx:145-152`. Er ruft `close()` — denselben Weg wie
      „Abbrechen", damit ein angehängtes Bild mit weg ist.
- [x] B2 · `true` als dritter Parameter an `addEventListener` **und**
      `removeEventListener`.
- [x] B3 · `AppShell.tsx` und `useOverlay.ts` **unberührt** — `git status` nennt
      beide nicht.

## C · Abnahme

- [x] C1 · Die AGE-688-Zusage wich auf „Abbrechen" aus, mit einer Begründung, die
      seit diesem Change nicht mehr stimmt. Der Zeigerweg bleibt als eigene
      Zusage stehen, der Kommentar ist auf den neuen Stand gezogen — eine
      stehengebliebene Begründung ist schlimmer als keine.
- [x] C2 · **Zwei Gegenproben, beide röten:**
      - `stopPropagation()` entfernt → `1 failed | 6 passed`.
      - Blasenphase statt Capture (`true` weggelassen) → `1 failed | 6 passed`.
      Die Capture-Regel ist damit belegt und nicht bloss behauptet.
- [x] C3 · Ohne Formular darüber schliesst Escape die Schublade weiterhin — die
      bestehende Zusage „sperrt die Seite dahinter und hält den Fokus" fährt
      genau das und bleibt grün.
- [x] C4 · `pnpm test` **2478/2478** (219 Dateien) · `pnpm lint` Exit 0
      (7 Warnungen, alle Bestand) · `pnpm typecheck` Exit 0 · `pnpm build`
      Exit 0. Je der Exit-Code geprüft, nicht die Ausgabe.
- [x] C5 · `openspec validate --all` **32/32**.
- [ ] C6 · **Sichtprobe im Browser NICHT gefahren** — dieselbe Begründung wie in
      AGE-688: der Diff verschiebt kein Pixel, und der lokale Stack trägt die
      Gerätesitzung aus AGE-642. Am Gerät wäre ohnehin die Zurück-Taste der
      interessantere Weg, und die läuft über `schliesseOberstesOverlay()`, nicht
      über Escape.

## Nachlauf, nicht Teil dieses Changes

Zwei Escape-Lauscher derselben Bauart bleiben ungemessen: `AppShell.tsx:186`
(Profilmenü) und `AppShell.tsx:521` (Nachrichten-Schublade). Ob über ihnen ein
Overlay stehen kann, hat niemand geprüft. Eine gemeinsame Stelle für Escape —
`schliesseOberstesOverlay()` für die ganze Schale — wäre der Umbau, der das
grundsätzlich löst; er beträfe jede Fläche mit eigenem Lauscher und ist ein
eigener Vorgang.
