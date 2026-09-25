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

**Dies ersetzt die Verortung aus AGE-904 vom selben Tag.** Dort hiess es „ein
Abschnitt „Support" am Fuss der Seitenleiste, über dem Einklapp-Schalter" — der
Abschnitt ist derselbe und trägt dieselben zwei Einträge, er steht nur nicht
mehr am Fuss. Der Satz steht hier, weil die Neuigkeiten-Einträge aus diesem
Abschnitt erzeugt werden und beide Einträge sonst nebeneinander stünden, ohne
dass einer den anderen aufhebt.

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

- `feedback-qm`: Die Anforderung „Der Feedback-Eintrag steht in der Leiste und
  verdeckt nichts" verortet ihn „am Fuss, über dem Einklapp-Schalter" und sagt
  das in einem eigenen Szenario noch einmal zu. Beides wird falsch. Sie wird
  ersetzt durch „Der Feedback-Eintrag steht im **Support-Abschnitt** und
  verdeckt nichts" — dieselben Zusagen gegen Überdecken und für den zugänglichen
  Namen, neue Verortung, dazu die Zusage, dass er in Polsterung und
  Symbolabstand wie ein Eintrag mit Pfad sitzt.

  Das **Formular** selbst bleibt unverändert: Inhalt, Overlay, Zustand, die
  beiden Effekte. Dieser Change bewegt nur seinen Auslöser und zieht die
  Beschreibung nach.

  Beim ersten Entwurf stand hier „`feedback-qm` wird nicht geändert". Das war
  falsch, und es fiel erst beim Durchsuchen der Spezifikationen nach der alten
  Verortung auf — nicht bei `validate`, das eine Anforderung, die der Code
  widerlegt, nicht sehen kann.

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
