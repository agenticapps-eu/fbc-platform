# Design — die Schrift der linken Leiste

## Entscheidung 1: Eigene Token, nicht `--color-on-chrome` umlegen

`--color-on-chrome` im navy-Block auf `#FFFFFF` zu setzen wäre ein Einzeiler und
wäre falsch. Gemessen, nicht geschätzt — wer liest `text-on-chrome` und
`text-on-chrome-muted`:

| Datei                                | Stellen |
| ------------------------------------ | ------- |
| `src/pages/WillkommenPage.tsx`       | 22      |
| `src/pages/OnboardingPage.tsx`       | 17      |
| `src/components/ui/SidebarNav.tsx`   | 3       |
| `src/components/feedback/FeedbackButton.tsx` | 1 |
| `src/components/LeistenPill.tsx`     | 1       |
| `src/components/ui/Button.tsx`       | 1       |
| `src/components/AppShell.tsx`, `ui/Logo.tsx` | je 1 (nur `-active`) |

Zwei Vollseiten und `Button variant="secondary"` würden mitgefärbt. Der
sekundäre Knopf ist zusätzlich ein **offener** Gestaltungspunkt (Donald, 06.10.,
„diese dunklen Buttons") — ihn hier als Nebenwirkung zu entscheiden, wäre eine
Entscheidung an der falschen Stelle.

Also dasselbe Vorgehen wie bei `--leiste-focus` und `--leiste-badge` in
AGE-1003: zwei eigene Token, die ausschliesslich Elemente der Leistenfläche
lesen.

- `--leiste-ink` — auf `@theme` **genau** `#475569`, im navy-Block `#FFFFFF`
- `--leiste-ink-muted` — auf `@theme` **genau** `#64748B`, im navy-Block `#B9CCE6`

Die `@theme`-Werte sind zeichengleich mit den heutigen `--color-on-chrome` und
`--color-on-chrome-muted`. Damit ist „im hellen Modus ändert sich nichts" keine
Behauptung, sondern eine Zusage, die ein Test Wert für Wert nachprüfen kann.

**Verworfen:** `--leiste-ink` auf `var(--thread-ink)` zeigen zu lassen. Die
`--thread-*`-Token sitzen auf `.fbc-chat-rail` und nicht auf `html`; ein Element
der linken Leiste liegt nicht in diesem Teilbaum und bekäme den Rückfallwert.
Dass beide Leisten dieselbe Zahl tragen, ist eine Absicht — keine Ableitung.

## Entscheidung 2: Zwei Token, nicht eines

Die Nachrichtenleiste führt zwei Töne: `--thread-ink` (`#FFFFFF`) für Namen und
Kopfzeile, `--thread-muted` (`#B9CCE6`) für Vorschau und Uhrzeit. Die linke
Leiste hat dieselbe Rangfolge — Abschnittsmarke über Menüeintrag —, also
bekommt sie beide Töne. Ein einziger weisser Ton für beides löschte die
Rangfolge, und die Marken schrien dann lauter als die Einträge, die sie ordnen.

## Entscheidung 3: Die Hover-Schrift bleibt stehen, obwohl sie im Dunkeln wirkungslos wird

`SidebarNav`, `FeedbackButton` und `LeistenPill` tragen heute
`hover:text-on-chrome-active`. Im navy-Modus ist `--color-on-chrome-active`
`#FFFFFF` — also derselbe Wert, auf dem `--leiste-ink` künftig steht. Der
Schriftwechsel beim Überfahren wird dort **wirkungslos**.

Er bleibt trotzdem stehen, aus zwei Gründen. Im **hellen** Modus wechselt er
weiter von `#475569` auf `#1F53B0` und ist dort das Hauptmerkmal. Und im
dunklen Modus übernimmt die Fläche: `--color-chrome-elevated` hebt sich mit
1,15:1 kaum ab, aber genau so arbeitet die Leiste rechts auch
(`--thread-hover` ist Weiss zu 6 %). Parität war die Vorgabe.

Eine eigene `--leiste-ink-hover` einzuführen wäre ein drittes Token für einen
Wert, der in beiden Modi genau `--color-on-chrome-active` ist. Kein Token für
keinen Unterschied.

## Entscheidung 4: Eingeklappt bleibt die Symbolform allein — benannt, nicht weggeschrieben

Das ist die Folge, die nicht nach Farbe aussieht, und sie gehört vor die
Umsetzung. `NavIcon` nimmt **keine** Farbe an; es erbt `currentColor` von der
Textklasse des Links. Die Merkmale des aktiven Eintrags, je Zustand:

|                                           | heute aufgeklappt | heute eingeklappt | nachher aufgeklappt | nachher eingeklappt |
| ----------------------------------------- | ----------------- | ----------------- | ------------------- | ------------------- |
| halbfette Beschriftung                    | ja                | nein              | ja                  | nein                |
| weisser Linksbalken                       | ja                | nein              | ja                  | nein                |
| Symbolfarbe `#FFFFFF` statt `#9FB4D2`     | ja                | **ja**            | **nein**            | **nein**            |
| Symbolform `solid` statt `line`           | ja                | ja                | ja                  | ja                  |

Eingeklappt sinkt die Zahl der zählenden Merkmale damit von **zwei auf eines**.

Die Norm hält: 1.4.1 verlangt, dass Farbe nicht das **einzige** Mittel ist, und
die Form ist kein Farbmittel. Aber „die Norm hält" ist nicht dasselbe wie „es
ist gut", und AGE-1003 hat die Zweierschaft ausdrücklich in die Spec geschrieben.
Sie wird hier also **geändert**, nicht gerissen: die Spec sagt nachher, dass
eingeklappt die Form allein trägt, und nennt den Grund.

Drei Auswege wurden gerechnet und verworfen:

1. **Inaktive Einträge auf `#B9CCE6` statt `#FFFFFF`.** Hielte die Zweierschaft
   und wäre nicht, was gefragt war — „weiss, gleicher Farbcode".
2. **Die Aktivfläche über 3:1 heben.** `#1F53B0` trägt 2,00:1 gegen `#002B51`.
   Ein Ton, der 3:1 hält, ist deutlich heller und ändert das Bild der Leiste
   stärker als die Schrift, um die es hier geht. Ausserdem erklärt AGE-1003 die
   Füllung ausdrücklich zur Dekoration — sie zum Signal zu befördern, wäre eine
   grössere Entscheidung als diese.
3. **Ein neues Merkmal, etwa ein Ring um das eingeklappte Symbol.** Erfindet
   Gestaltung, um eine Gestaltungsvorgabe zu reparieren.

Die Leiste rechts macht genau diesen Tausch schon: alle Namen stehen auf
`--thread-ink`, der aktive Faden ist allein an seiner Fläche erkennbar. Parität
heisst, denselben Tausch mitzumachen.

## Was ausserhalb bleibt

`--color-on-chrome` (`#9FB4D2`) und `--color-on-chrome-muted` (`#8FA5C4`)
behalten ihre navy-Werte unverändert. Nach dieser Änderung färben sie die beiden
Vollseiten und den sekundären Knopf — nicht mehr die Leiste. Der Kommentar im
`@theme`-Block, der sie der Leiste zuschreibt, wird damit falsch und wird
mitgezogen; genau so ein Kommentar hat bei AGE-1003 eine Messung in die falsche
Richtung geschickt.
