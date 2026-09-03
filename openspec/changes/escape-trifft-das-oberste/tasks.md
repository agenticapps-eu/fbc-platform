# Aufgaben — `escape-trifft-das-oberste` (AGE-697)

Alle Zeilennummern gegen `0b6aa29` gemessen, dem Stand, auf dem dieser Branch
abzweigt.

## A · RED

- [ ] A1 · Zusage aus Szenario 1 und 2 in `src/components/AppShell.overlay.test.tsx`:
      Schublade auf, Feedback auf, Escape — Formular weg, Schublade steht und
      trägt wieder `aria-modal="true"`; zweites Escape schliesst die Schublade.
- [ ] A2 · Zusage aus Szenario 3 in `src/components/feedback/FeedbackButton.test.tsx`:
      Formular ohne Schublade darunter, Escape schliesst es.
- [ ] A3 · **RED belegen** und die Meldungen hier eintragen. Erwartet: A1
      scheitert daran, dass die Schublade mit weg ist; A2 daran, dass das
      Formular noch steht.

## B · GREEN

- [ ] B1 · In `FeedbackButton.tsx` einen Escape-Lauscher am `document` in der
      **Capture**-Phase, mit `stopPropagation()`, nach dem Vorbild von
      `EmojiAuswahl.tsx:145-152`. Er ruft `close()` — denselben Weg wie
      „Abbrechen", damit ein angehängtes Bild nicht stehen bleibt.
- [ ] B2 · `true` als dritter Parameter an `addEventListener` **und**
      `removeEventListener`; ohne ihn wird der Lauscher nicht abgemeldet.
- [ ] B3 · `AppShell.tsx` bleibt unberührt, `useOverlay` ebenfalls. Steht eine
      der beiden Dateien im Diff, ist der falsche Weg eingeschlagen.

## C · Abnahme

- [ ] C1 · Die AGE-688-Zusage, die auf „Abbrechen" ausweichen musste, wieder auf
      Escape stellen und den Ausweich-Kommentar entfernen — sonst bleibt im Repo
      eine Begründung stehen, die nicht mehr stimmt.
- [ ] C2 · Gegenprobe: `stopPropagation()` entfernen → die Zusage aus Szenario 1
      muss röten. Sonst belegt sie die Capture-Regel nicht.
- [ ] C3 · Gegenprobe, dass die Bedienung nicht schlechter wird: ohne Formular
      darüber schliesst Escape die Schublade weiterhin (bestehende Zusage in
      `AppShell.overlay.test.tsx`, muss grün bleiben).
- [ ] C4 · `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` — je Exit 0.
- [ ] C5 · `openspec validate --all` grün.
