## Context

Heute (gemessen in `AppShell.tsx` und `index.css`, Stand `dc50198`):

| Zustand | Klasse | Wert `hell` | Wert `navy` |
|---|---|---|---|
| eingeklappt | `fbc-sidebar-surface` | `#FFFFFF` | `#081527` |
| ausgeklappt | `border-line bg-canvas` | `#FFFFFF` | `#FFFFFF` |

Im hellen Modus sind beide weiss, der Unterschied ist dort also unsichtbar. Im
dunklen klappt die Leiste von navy auf weiss um — und das ist **Absicht**, mit
einer Begründung im Code, die ausdrücklich „im navy-Theme gemessen, nicht
gewählt" sagt: ausgeklappt trägt die Leiste `ThreadList`, und die schreibt
`text-ink` auf `hover:bg-soft`. Auf Chrome-Fläche wäre sie unlesbar.

Was in der Leiste Farbe trägt, vollständig aufgezählt:

| Ort | heute |
|---|---|
| Leiste (Rahmen) | `border-chrome-border` / `border-line` |
| Kopf eingeklappt | `border-b border-chrome-border`, Symbol `text-on-chrome` |
| Ungelesen-Punkt eingeklappt | `bg-accent`, Ziffer `text-canvas` |
| Kopf ausgeklappt | `border-b border-line`, Titel `text-ink` |
| `ThreadList` Trennlinien | `divide-line` |
| `ThreadList` Zeile aktiv | `bg-accent-soft/40` |
| `ThreadList` Zeile Hover | `hover:bg-soft` |
| `ThreadList` Name | `text-ink` |
| `ThreadList` Abzeichen | `bg-accent`, Ziffer `text-canvas` |
| `ThreadList` Vorschau | `text-muted` |

`ThreadList` steht an **zwei** Orten: in dieser Leiste und auf `/chat`. Die
Seite `/chat` bleibt hell.

## Goals / Non-Goals

**Goals:**

- Die Leiste ist im Modus `navy` durchgehend `#002B51`, ein- und ausgeklappt.
- Jedes Element darin erfüllt die Kontrastschwellen auf **allen drei** Flächen
  (Grundfläche, Hover, aktive Zeile) — gerechnet, nicht geschätzt.
- Im Modus `hell` ändert sich kein Pixel.
- `ThreadList` bleibt **eine** Komponente ohne Variantenargument.

**Non-Goals:**

- Die linke Navigation (Frage E7 an Detlev).
- `ChatFenster`, `ChatFensterReihe`, `/chat`.
- Ein dunkler Lesemodus für Inhalte (AGE-492 bleibt).
- Die Geometrie, das Ein-/Ausklappen, der Pill, die Ungelesen-Meldung.

## Decisions

### 1. Der Ort entscheidet, nicht ein Argument

`ThreadList` bekommt **keinen** `variante`-Prop. Stattdessen liest sie
Leisten-Tokens, die auf `:root` auf die Inhaltsfarben zurückfallen und nur
innerhalb von `.fbc-chat-rail` überschrieben werden:

```css
:root {
  --thread-ink: var(--color-ink);
  --thread-muted: var(--color-muted);
  /* … */
}
html[data-variant="navy"] .fbc-chat-rail {
  --chat-rail-surface: #002b51;
  --thread-ink: #ffffff;
  /* … */
}
```

Verworfen: ein Prop (`<ThreadList aufDunkel />`). Es wäre ein zweiter Zustand,
der mit dem Theme-Schalter synchron gehalten werden muss, und jede neue Fläche,
die die Liste einbaut, müsste ihn richtig setzen. Die Kaskade weiss es von
selbst.

Verworfen: eine zweite Komponente. Der Prompt verlangt ausdrücklich, die
bestehende wiederzuverwenden, und zwei Fassungen derselben Liste laufen
auseinander.

### 2. Die Fläche hängt an einem eigenen Token, nicht an `--color-chrome`

`--chat-rail-surface` statt `--color-chrome`. Die linke Navigation hängt an
`--color-chrome`; sie mitzufärben ist genau die offene Frage E7. Ein eigener
Token macht aus einem Ja dort einen Einzeiler und aus einem Nein kein Problem.

### 3. Die Aktivfläche ist aufgehelltes Weiss, nicht die Akzentfarbe

Gerechnet, und die naheliegende Wahl fällt durch:

| Aktivfläche | Name (`#FFFFFF`) | Vorschau (`#B9CCE6`) |
|---|---|---|
| `#1F53B0` (Akzent der Navigation) | 7,2:1 ✓ | **2,9:1 ✗** |
| `rgb(255 255 255 / 0.12)` → `#1F4466` | 10,1:1 ✓ | 6,2:1 ✓ |

Also die zweite. Und der Vorschautext musste von `#8FA5C4` (dem Muted der linken
Navigation, 5,7:1 auf der Grundfläche) auf `#B9CCE6` aufgehellt werden — auf der
aktiven Zeile wäre `#8FA5C4` mit **4,0:1** durchgefallen.

Die vollständige gerechnete Tabelle steht in der Spec, nicht hier: sie ist eine
Zusage und keine Entwurfsnotiz.

### 4. Chrome wird innerhalb der Leiste umgelegt — für genau einen Knopf

`Button variant="secondary"` steht im Leerzustand der Leiste („Noch kein
Gespräch … Mitglieder entdecken") und trägt `bg-chrome text-on-chrome`. Auf
`#002B51` ergibt das **1,3:1** — gerechnet, nicht geschätzt, und damit
unsichtbar. Für ein neues Mitglied ist das der Normalfall dieser Leiste, nicht
ein Randfall.

`--color-chrome` und `--color-on-chrome` werden deshalb **innerhalb von
`.fbc-chat-rail`** umgelegt: `#D7E4F2` auf `#0C2043`, also ein heller Knopf auf
dunkler Leiste (11,1:1 und 12,5:1).

**Berichtigt nach dem Code-Review — die erste Fassung dieses Absatzes war an
zwei Stellen falsch, und beide hingen zusammen.**

Sie behauptete „die beiden Chrome-Tokens" und „der einzige Verbraucher". Der
Knopf liest **fünf** (`--color-chrome-border`, `--color-chrome`,
`--color-on-chrome`, `--color-chrome-elevated` und, aus `base`,
`--color-soft` als Versatz des Fokusrings), und es sind **zwei** Knöpfe:
„Mitglieder entdecken" im Leerzustand und „Weitere Gespräche" beim Blättern.

Die Folge war kein Schönheitsfehler: `hover:bg-chrome-elevated` blieb auf dem
navy-Wert `#0E1F38`, und die Schrift `#0C2043` darauf trägt **1,0:1**. Beim
Überfahren wäre die Aufschrift schlicht verschwunden — derselbe Fehler, gegen
den die Umlegung existiert, nur einen Zustand weiter.

Und der Test konnte es nicht sehen, weil er genau die zwei Tokens prüfte, die
umgelegt **waren**. Ein Wächter, der nur nachsieht, was man schon getan hat,
bewacht nichts. Er prüft jetzt alle fünf und beide Zustände des Knopfes.

Die Keule bleibt vertretbar, aber aus einem schwächeren Grund als behauptet:
nicht weil nur ein Element betroffen ist, sondern weil alle betroffenen
Elemente derselbe Knopf in zwei Vorkommen sind und die Umlegung die Leiste
nicht verlässt — was `/chat` im Bild belegt.

Verworfen: den Knopf im Leerzustand zu einem Textlink machen. Er steht derselbe
auf `/chat`, und dort ist der Knopf richtig — eine Komponente mit zwei
Gestalten wäre teurer als zwei Zeilen CSS.

Verworfen: `variant="ghost"`. Dessen Schrift (`#1F53B0`) trägt auf `#002B51`
nur 2,2:1.

### 5. Die Leiste behält ihre Ränder, aber mit einem Token

`border-chrome-border` (eingeklappt) und `border-line` (ausgeklappt) werden zu
`--thread-line`. Im dunklen Modus `rgb(255 255 255 / 0.16)`: eine Trennlinie ist
keine bedeutungstragende Grafik, sie muss nur sichtbar sein.

## Risks / Trade-offs

- **Die eingeklappte rechte Leiste passt nicht mehr zur linken.** Vorher beide
  `#081527`, jetzt `#002B51` gegen `#081527`. Das ist die Folge von Detlevs
  Vorgabe („eingeklappt und ausgeklappt dieselbe Fläche") und steht als
  Anforderung ausdrücklich so drin, damit es nicht als Fehler gelesen wird.
  Fällt E7 mit Ja aus, verschwindet der Unterschied.
- **Die Kontrastzahlen sind gerechnet, nicht im Bild gemessen.** Sie gelten für
  die Tokenwerte; ob eine Fläche in der laufenden Anwendung wirklich diese Farbe
  trägt, belegt erst die Sichtprobe. Beides gehört in die Verifikation.
- **`ThreadList` liest ab jetzt Variablen statt Tailwind-Farbklassen.** Ein
  Tippfehler in einem Variablennamen fällt nicht beim Typcheck auf, sondern wird
  zu „keine Farbe" — der Browser nimmt dann die geerbte. Gegenmittel: ein Test,
  der die gesetzten Variablen gegen die Liste der benutzten prüft.
- **Zwei Orte, eine Komponente.** Wer später eine dritte Fläche baut, die
  `ThreadList` auf dunklem Grund einbaut, muss die Tokens dort setzen. Das steht
  in der Anforderung; ohne sie wäre es eine Falle.
