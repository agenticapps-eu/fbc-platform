# Aufgaben — `ein-modal-zur-zeit` (AGE-688)

Alle Zeilennummern gegen `2359eae` gemessen, dem Stand, auf dem dieser Branch
abzweigt.

## A · RED

- [x] A1 · In `src/components/AppShell.overlay.test.tsx` eine Zusage aus dem
      ersten Szenario: Schublade öffnen, den Feedback-Zugang **darin** betätigen,
      dann belegen, dass genau ein Element `aria-modal="true"` trägt, dass
      dieses das Formular ist und dass die Schublade weiterhin steht.
- [x] A2 · Die Zählung über `document.querySelectorAll('[aria-modal="true"]')`
      geführt, nicht über `screen`: das Formular hängt per Portal an `body`,
      ausserhalb des Render-Containers. Identität über
      `getByRole("dialog", { name: /feedback geben/i })` — `getByLabelText` ist
      nicht der zugängliche Name.
- [x] A3 · **RED belegt:** `1 failed | 4 passed`, Fehlschlag an der Zählung
      (`expected […] to have a length of 1 but got 2`) und nicht am Harness —
      der Klick fand den Knopf, die Ausgabe zeigt ihn samt `<span>Feedback</span>`.
- [x] A4 · Zweite Zusage (Szenario 2): nach „Abbrechen" im Formular trägt die
      Schublade wieder `aria-modal="true"`.
      **Nicht über Escape gemessen** — `AppShell.tsx:508` schliesst auf Escape
      die Schublade selbst, ungeachtet dessen, was über ihr liegt. Die Zusage
      hätte sonst an einem losgelösten Knoten gemessen. Bestand, siehe Nachlauf.
- [x] A5 · Dritte Zusage (Szenario 3): Schublade am Breakpoint mit offenem
      Formular abhängen, danach erneut öffnen — sie trägt wieder `aria-modal`.

## B · GREEN

- [x] B0 · **Verworfener erster Weg, als Messung festgehalten.** „Schublade
      schliessen" (`onOeffnen` → `setMobileNavOpen(false)`) lief auf `0` statt
      `1` Knoten hinaus: `<FeedbackButton />` steht INNERHALB der Schublade,
      ihr Schliessen hängt die Komponente ab und nimmt den `open`-Zustand mit,
      an dem das Portal hängt. Das Formular ging gar nicht erst auf.
      Zurückgenommen, nicht repariert.
- [x] B1 · `FeedbackButton` meldet über `onOffenChange` (`FeedbackButton.tsx:53-66`),
      ob sein Formular offen ist — als Effekt auf `open`, nicht an den
      einzelnen `setOpen(false)`-Stellen (`close()`, Erfolgszweig von
      `submit()`, Rückweg aus `useOverlay`).
- [x] B1a · Aus dem Diff-Review am eigenen Code: gemeldet wird
      `Boolean(user) && open`, nicht bloss `open` — dieselbe Bedingung wie am
      Hook darüber und aus demselben Grund. Bei Sitzungsverlust rendert die
      Komponente nichts mehr; „offen" zu melden liesse die Schublade ohne
      `aria-modal` zurück, ohne dass etwas über ihr läge.
- [x] B2 · `AppShell` führt `feedbackInSchublade` und hängt das `aria-modal` der
      Schublade daran (`AppShell.tsx:1157`). Der Aufruf in `AppShell.tsx:871`
      (Seitenleiste ab `lg`) bleibt ohne Meldung — dort gibt es keine Schublade.
- [x] B3 · `useOverlay` **unberührt** — `git diff --stat` nennt die Datei nicht.
- [x] B4 · **GREEN belegt:** `AppShell.overlay.test.tsx` + `FeedbackButton.test.tsx`
      **28 passed**.

## C · Abnahme

- [x] C1 · Zwei Gegenproben, damit die Zusagen nicht leer laufen:
      - `aria-modal` fest auf `"true"` → Szenario 1 rötet (`1 failed | 4 passed`). ✔
      - Aufräumen im Effekt entfernt → **alle sechs bleiben grün.** Ursache
        gemessen: die neu gemountete Instanz meldet beim Aufsetzen selbst
        `false`. Das Aufräumen spart genau einen Renderdurchgang mit falschem
        Attribut. Delta und Kommentar sagen das jetzt so — die Zusage steht auf
        dem beobachtbaren Verhalten, nicht auf der Zeile.
- [ ] C2 · **Sichtprobe im Browser NICHT gefahren.** Begründung: der Diff
      verschiebt kein Pixel — er ändert ein ARIA-Attribut und legt einen
      Zustand an. Dass das Formular sichtbar über der Schublade steht, ist in
      AGE-688 bereits am Bestand gemessen (`z-50`, Portal hinter `#root`). Der
      lokale Stack ist ausserdem geteilt und trägt gerade die Gerätesitzung aus
      AGE-642. Nachzuholen, falls jemand die Fläche ohnehin aufmacht.
- [x] C3 · `pnpm test` **2476/2476** (219 Dateien) · `pnpm lint` Exit 0
      (7 Warnungen, alle Bestand) · `pnpm typecheck` Exit 0 · `pnpm build`
      Exit 0. Je der Exit-Code geprüft, nicht die Ausgabe.
- [x] C4 · `openspec validate --all` **32/32**.

## Nachlauf, nicht Teil dieses Changes

`AppShell.tsx:508` schliesst auf Escape die Off-Canvas-Navigation, **ohne zu
prüfen, ob ein Overlay über ihr liegt**. Wer bei offenem Feedback-Formular
Escape drückt, verliert beides auf einmal — das Formular nicht, weil es Escape
behandelt, sondern weil sein Auslöser mit der Schublade abhängt. Bestand, keine
Regression aus diesem Change, und `useOverlay` hätte mit
`schliesseOberstesOverlay()` bereits das Werkzeug dafür. Eigener Vorgang.
