# Aufgaben — `ein-modal-zur-zeit` (AGE-688)

Alle Zeilennummern gegen `2359eae` gemessen, dem Stand, auf dem dieser Branch
abzweigt.

## A · RED

- [ ] A1 · In `src/components/AppShell.overlay.test.tsx` eine Zusage aus dem
      ersten Szenario ergänzen: Schublade öffnen, den Feedback-Zugang **darin**
      betätigen, dann belegen, dass (a) die Schublade weg ist und (b) genau ein
      Element `aria-modal="true"` trägt und dieses das Feedback-Formular ist.
- [ ] A2 · Die Zählung über `document.querySelectorAll('[aria-modal="true"]')`
      führen, nicht über `screen`: das Formular hängt per Portal an `body`,
      ausserhalb des Render-Containers. Die Identität über
      `getByRole("dialog", { name: /feedback/i })` prüfen — `getByLabelText` ist
      nicht der zugängliche Name.
- [ ] A3 · **RED belegen** und die Meldung hier eintragen. Erwartet wird ein
      Fehlschlag an der Zählung (zwei Knoten), nicht am Harness — sonst misst
      die Zusage etwas anderes als den Befund.

## B · GREEN

- [ ] B1 · `FeedbackButton` eine optionale Rückmeldung fürs Öffnen geben und in
      `AppShell.tsx:1176` die Schublade darüber schliessen. Der Aufruf in
      `AppShell.tsx:866` (Seitenleiste ab `lg`) bleibt ohne — dort gibt es keine
      Schublade.
- [ ] B2 · `useOverlay` bleibt unberührt. Wird der Hook in diesem Change
      angefasst, ist der falsche Weg eingeschlagen.
- [ ] B3 · **GREEN belegen:** `pnpm vitest run src/components/AppShell.overlay.test.tsx`
      und `src/components/feedback/FeedbackButton.test.tsx`.

## C · Abnahme

- [ ] C1 · Gegenprobe, dass die Zusage nicht leer läuft: die Änderung in B1
      zurücknehmen, Test muss röten, wieder einsetzen.
- [ ] C2 · Sichtprobe unter `lg` (375 × 812) am laufenden Stand: Schublade auf,
      Feedback öffnen, Formular steht, Schublade ist weg. Danach abschicken und
      prüfen, dass die Seite wieder frei ist (keine stehende Scroll-Sperre).
- [ ] C3 · `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` — je Exit 0,
      und der Exit-Code geprüft, nicht die Ausgabe.
- [ ] C4 · `openspec validate --all` grün.
