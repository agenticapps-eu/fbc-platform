## Why

AGE-929.

AGE-904 hat „Support" als **Sonderbau** gebaut: eine eigene `<nav>`-Landmarke am
Fuss der Seitenleiste, über dem Einklapp-Schalter, ausserhalb von `SidebarNav`.
Das war die kleinste Form, die den Feedback-Knopf unangetastet liess — und sie
ist an der Oberfläche als Fremdkörper zu sehen: der Abschnitt lässt sich nicht
zuklappen wie „Mein Bereich" und „Administration", er trägt eine andere
Trennlinie, seine Einträge haben einen anderen Symbolabstand, und er scrollt
nicht mit den übrigen Abschnitten, sondern klebt am Fuss.

Gewünscht ist Support als **normaler Abschnitt** in der Reihe: Hauptnavigation →
Mein Bereich → Support → Administration.

## What Changes

- Der Abschnitt „Support" wird ein gewöhnlicher Sidebar-Abschnitt: mit
  Überschrift, klappbar (`klappbar: true`), mit derselben Trennlinie und
  denselben Abständen wie „Mein Bereich" und „Administration".
- **Reihenfolge**: hinter „Mein Bereich", vor „Administration". Für ein Konto
  ohne Admin-Rolle ist Support damit der letzte Abschnitt.
- Der Sonderbau `SupportAbschnitt` in `AppShell.tsx` entfällt, samt seiner
  eigenen `<nav aria-label="Support">`-Landmarke und seinen beiden Wrappern
  (Fuss der Desktop-Leiste, Fuss der Schublade).
- `SidebarNav` lernt, dass ein Abschnitt neben seinen Einträgen **einen Eintrag
  mit Aktion statt Pfad** tragen kann — die kleinste Form dafür, weil „Feedback"
  kein Ort ist, sondern ein Overlay öffnet.
- `NavIcon` bekommt das Symbol für `/hilfe/tutorials`. Ohne diese Zeile fiele
  der Eintrag beim Umzug in `SidebarNav` still auf den Platzhalter `dot` zurück,
  wo der Sonderbau `bulb` zeichnet.
- Die Einträge bleiben, was sie sind: **Tutorials** (`/hilfe/tutorials`) und
  **Feedback** (öffnet das bestehende Formular). Kein dritter Eintrag, kein
  Verweis auf Mitgliedschaft oder Kaufweg.
- Die Zusagen aus AGE-688 (genau ein `aria-modal`, wenn das Formular aus der
  Schublade heraus offen steht) und AGE-697 (Escape trifft das oberste Overlay)
  gelten unverändert weiter und werden weiter geprüft.

Keine Breaking Changes: keine Route ändert sich, kein Recht, kein Schema.

## Capabilities

### New Capabilities

Keine.

### Modified Capabilities

- `support-tutorials`: Die Anforderung, die den Abschnitt **am Fuss der
  Seitenleiste, über dem Einklapp-Schalter** verortet, wird ersetzt durch eine,
  die ihn **als Abschnitt zwischen „Mein Bereich" und „Administration"** verortet
  und ihn auf die Form der übrigen Abschnitte verpflichtet (Überschrift,
  klappbar, gleiche Abstände). Die Zusagen zu den zwei Einträgen, zu den drei
  Zuständen der Leiste und zum unangetasteten Feedback-Formular bleiben
  inhaltlich bestehen.

Die Capability `feedback-qm` wird **nicht** geändert: das Formular selbst bleibt,
wie es ist. Dieser Change bewegt nur seinen Auslöser.

## Impact

- `src/components/AppShell.tsx` — `SupportAbschnitt` entfällt; der Abschnitt wird
  in `SidebarContent` eingereiht, neben dem bestehenden Anhängen von
  „Administration". Die beiden Render-Stellen am Fuss (Desktop-Leiste,
  Schublade) fallen weg; `onFeedbackOffenChange` wandert durch `SidebarContent`.
- `src/components/ui/SidebarNav.tsx` — ein Abschnitt kann einen Eintrag mit
  Aktion tragen.
- `src/components/ui/NavIcon.tsx` — Symbol für `/hilfe/tutorials`.
- `src/components/AppShell.support.test.tsx` — die Zusagen aus AGE-904 werden auf
  die neue Verortung gezogen; die Zusage „kein achter Menüeintrag" wird auf das
  umgestellt, was sie eigentlich meint (Tutorials steht nicht unter den sieben
  sichtbaren Menüeinträgen), weil der Abschnitt jetzt **in** der
  Hauptnavigations-Landmarke liegt.
- `src/components/ui/SidebarNav.akkordeon.test.tsx` — neue Zusage für den
  Eintrag mit Aktion.
- Unberührt: `src/config/nav.ts` (`/hilfe/tutorials` bleibt `section: "sub"`, die
  sieben sichtbaren Einträge bleiben sieben), `FeedbackButton.tsx` in seiner
  Logik, alle Routen, alle Rechte, das Schema.
