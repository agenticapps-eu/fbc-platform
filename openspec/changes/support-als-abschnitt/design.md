## Context

`SidebarNav` (`src/components/ui/SidebarNav.tsx`) rendert Abschnitte aus reinen
Daten: `SidebarNavSection = { title?, items: SidebarNavItem[], klappbar? }`, und
`SidebarNavItem = { path, label, abzeichen? }`. Jeder Eintrag wird ein
`NavLink` — ein **Ort**. Der Abschnitt bringt Überschrift, Akkordeon
(Zustand: die Menge der zugeklappten Titel), Trennlinie und Abstände mit.

„Feedback" ist kein Ort. `FeedbackButton` ist ein Knopf, der ein per Portal an
`document.body` gehängtes Overlay öffnet, und er trägt zwei Zusagen, die genau
dort wohnen, wo sein Zustand wohnt:

- **AGE-688** — `onOffenChange` meldet nach oben, ob das Formular offen steht,
  damit die Off-Canvas-Schublade ihr `aria-modal` abgibt, solange es über ihr
  liegt.
- **AGE-697** — ein `keydown`-Lauscher in der **Capture**-Phase mit
  `stopPropagation`, damit Escape erst das Formular trifft und nicht zugleich
  die Schublade schliesst, in der sein Auslöser steht.

Deshalb stand der Abschnitt bis AGE-904 ausserhalb von `SidebarNav`: der
Sonderbau `SupportAbschnitt` zeichnete Überschrift und Tutorials-Link selbst und
setzte `FeedbackButton` unverändert darunter.

Gemessen an der Vorlage der übrigen Abschnitte weicht dieser Sonderbau an vier
Stellen ab, und das ist es, was man sieht:

| | Abschnitt (`SidebarNav`) | Sonderbau (`SupportAbschnitt`) |
|---|---|---|
| Überschrift | Knopf mit Chevron, klappt zu | `<p>`, tot |
| Trennung nach oben | `mt-1 border-t border-chrome-border pt-4` | `border-t` am Wrapper, `p-2` |
| Symbolabstand im Eintrag | `gap-3` | `gap-2` (Tutorials **und** Feedback) |
| Polsterung eingeklappt | `px-2 py-2.5` | `px-2 py-2` |
| Lage | scrollt mit | `shrink-0` am Fuss, klebt |

Dazu: `NavIcon` kennt `/hilfe/tutorials` nicht. Wandert der Eintrag nach
`SidebarNav`, greift dort `NACH_ROUTE[path] ?? "dot"` — das Symbol fiele still
auf den Platzhalter zurück, während der Sonderbau `bulb` zeichnet.

## Goals / Non-Goals

**Goals:**

- Support ist ein Abschnitt wie „Mein Bereich" und „Administration" — gleiche
  Überschrift, gleiches Akkordeon, gleiche Trennlinie, gleiche Abstände.
- Reihenfolge Hauptnavigation → Mein Bereich → Support → Administration.
- Die kleinste Form, mit der ein Abschnitt einen Eintrag mit **Aktion** statt
  Pfad tragen kann.
- Die Zusagen AGE-688 und AGE-697 bleiben dort, wo sie sind, und bleiben geprüft.

**Non-Goals:**

- Das Feedback-Formular selbst (`feedback-qm`) wird nicht angefasst — weder sein
  Inhalt noch sein Overlay noch sein Zustand.
- Kein dritter Eintrag, kein Deep Link auf `/hilfe/tutorials`, keine Änderung an
  `navItems` oder an den sieben sichtbaren Menüeinträgen.
- Keine Route, kein Recht, kein Schema.

## Decisions

### Entscheidung 1 — Der Abschnitt trägt einen optionalen Nachtrag, keinen Eintrags-Union

`SidebarNavSection` bekommt **ein** optionales Feld:

```ts
/** Ein Eintrag, der keine Route öffnet sondern eine Aktion auslöst. */
nachtrag?: ReactNode;
```

`SidebarNav` rendert ihn hinter `section.items`, unter derselben Bedingung
`offen` wie die Einträge. Der Support-Abschnitt entsteht damit als

```ts
{ title: "Support", klappbar: true,
  items: [{ path: "/hilfe/tutorials", label: "Tutorials" }],
  nachtrag: <FeedbackButton … /> }
```

**Warum diese und keine andere.** Drei Formen standen zur Wahl:

- **A — Nachtrag am Abschnitt** (gewählt). Eine optionale Zeile im Typ, drei
  Zeilen im Renderer. `FeedbackButton` bleibt unverändert, mit ihm bleiben
  Overlay-Zustand, `onOffenChange` und der Capture-Lauscher an Ort und Stelle.
  Preis: ein `ReactNode` in einer sonst reinen Datenstruktur — die `items` eines
  Abschnitts zählen nicht mehr alles auf, was in ihm steht. Das ist der Grund,
  warum die neue Spec „genau zwei Einträge" ausdrücklich zusagt und der Test sie
  nicht über `items.length` prüft.

- **B — Eintrags-Union** `{ path, label } | { aktion, label, symbol }`, aus dem
  `SidebarNav` wahlweise `NavLink` oder `<button>` macht. Liest sich sauberer und
  zählt alles auf. Verlangt aber, den Offen-Zustand des Formulars aus
  `FeedbackButton` **heraus** nach `AppShell` zu heben oder die Komponente in
  Auslöser und Panel zu zerlegen. Genau daran hängen AGE-688 und AGE-697; beide
  Zusagen würden umgebaut, um ein Layout zu ändern. Verworfen: der Preis steht in
  keinem Verhältnis, und er wird in einer Währung bezahlt (Zugänglichkeit), in
  der dieses Projekt schon zweimal Lehrgeld gezahlt hat.

- **C — Sonderbau bleibt, wird aber nachgebaut**: eigenes Akkordeon, eigene
  Trennlinie, eigene Abstände. Verworfen, weil es die vier Abweichungen oben
  nicht beseitigt sondern verdoppelt — jede spätere Änderung an `SidebarNav`
  müsste hier von Hand nachgezogen werden, und genau das ist im Vergleich oben
  schon einmal schiefgegangen.

### Entscheidung 2 — Der Feedback-Knopf wird auf die Form eines Eintrags gezogen

`gap-2` → `gap-3` und `py-2` → `py-2.5` im eingeklappten Fall, damit Symbol und
Beschriftung dort sitzen wie in jedem anderen Eintrag. Das ist die einzige
Änderung an `FeedbackButton.tsx`, und sie betrifft ausschliesslich die
`className` seines Auslösers — keine Logik, kein Zustand, kein Effekt.

Verworfen: die Abweichung stehen lassen. Die Abnahme verlangt „optisch nicht von
den anderen Abschnitten zu unterscheiden", und 4 px Symbolabstand in der zweiten
Zeile eines dreizeiligen Abschnitts sind genau die Art Abweichung, die man sieht
ohne sie benennen zu können.

### Entscheidung 3 — Der Abschnitt wird in `SidebarContent` eingereiht, neben „Administration"

Support wird an `sections` angehängt, **bevor** der `staffRole === "admin"`-Zweig
„Administration" anhängt. Damit steht die Reihenfolge an einer Stelle und ergibt
sich nicht aus zwei entfernten. Für ein Konto ohne Admin-Rolle ist Support der
letzte Abschnitt, ohne dass das gesondert behandelt werden müsste.

Support ist wie „Administration" **kein** `navItem`-Abschnitt: seine Einträge
werden hier aufgezählt, nicht aus `navItems` gefiltert. `/hilfe/tutorials` bleibt
`section: "sub"` — die Zusage „genau sieben sichtbare Menüeinträge" in
`nav.test.ts` bleibt damit unberührt und muss nicht angefasst werden.

Anders als „Administration" hängt Support an **keiner** Bedingung: Hilfe ist
keine Frage der Stufe und keine der Rolle (bestehende Spec, `support-tutorials`).

### Entscheidung 4 — `/hilfe/tutorials` bekommt sein Symbol in `NACH_ROUTE`

`bulb`, dasselbe wie im Sonderbau, und ausdrücklich **nicht** `academy`: dieses
Symbol trägt zwei Zeilen höher den Menüeintrag „Academy", und zwei Einträge
derselben Leiste mit demselben Symbol heben sich gegenseitig auf. Die Begründung
stand im Sonderbau und wandert mit.

Verworfen: den Rückfall auf `dot` hinnehmen. Er ist still — nichts schlägt fehl,
das Symbol wird nur nichtssagend.

### Entscheidung 5 — Die Landmarke „Support" entfällt

Der Abschnitt liegt künftig **in** `<nav aria-label="Hauptnavigation">`, so wie
„Mein Bereich" und „Administration". Eine zweite Navigations-Landmarke für drei
Zeilen wäre die Ausnahme, die dieser Change gerade abschafft.

Folge für die Tests: `AppShell.support.test.tsx` findet den Abschnitt nicht mehr
über `getByRole("navigation", { name: "Support" })`. Die Zusagen werden auf die
Überschrift gezogen. Die Zusage „kein achter Menüeintrag" prüfte bisher, dass
„Tutorials" **nicht** in der Hauptnavigations-Landmarke steht — das wäre ab jetzt
falsch. Sie wird auf das umgestellt, was sie meint: `/hilfe/tutorials` ist
`section: "sub"`, und die sieben sichtbaren Menüeinträge bleiben sieben.

## Risks / Trade-offs

- **Der Abschnitt scrollt jetzt mit.** Auf einer kurzen Fläche kann Support aus
  dem Bild laufen, wo er vorher am Fuss klebte. → Das ist die Folge von „normaler
  Abschnitt" und ausdrücklich gewünscht; „Administration" verhält sich genauso.
  Wird in der Sichtprobe auf der niedrigsten geprüften Höhe angesehen.

- **`nachtrag` ist eine Tür für Beliebiges.** Wer später irgendetwas in einen
  Abschnitt hängen will, findet hier den Weg. → Der Name sagt „ein Nachtrag",
  nicht „ein Slot", der Typkommentar nennt den einen Zweck, und es gibt genau
  einen Aufrufer. Ein zweiter wäre der Anlass, auf Form B umzustellen.

- **Die `items` eines Abschnitts zählen nicht mehr alles auf.** Ein Test, der
  über `items.length` zählt, übersähe „Feedback". → Kein bestehender Test tut
  das; die neuen Zusagen zählen über das, was gerendert ist.

- **Eine Zusage über Klassennamen ist spröde.** Der Vergleich „Feedback sitzt wie
  Tutorials" hängt an Tailwind-Klassen. → Sie wird als **Gleichheit** der
  layoutrelevanten Klassen geprüft, nicht mit `toContain`: eine
  `toContain`-Zusage überlebt ein angehängtes `|| true`, wie die Parallelsitzung
  am 25.09. im Code-Review gefunden hat. Gleichheit fällt in beide Richtungen um.

## Migration Plan

Reines Frontend. Kein Schema, keine Migration, kein Deploy-Schritt ausser dem
gewöhnlichen. Zurückrollen heisst den Commit zurücknehmen.

## Open Questions

Keine.
