# Beide Leisten klappen über denselben halben Pill am Rand ein

Linear: **AGE-638**

## Why

Die beiden angedockten Leisten sind gespiegelt gebaut — bis auf ihren
Einklapp-Schalter. Der ist an zwei Stellen, in zwei Gestalten, in zwei Farben.
Gemessen am 27.08. in `src/components/AppShell.tsx`:

| | links (Navigation) | rechts (Nachrichten) |
| --- | --- | --- |
| Ort | **unten**, eigene Zeile über dem Rand (`:607`) | **oben**, im Kopf der Leiste (`:677`) |
| Gestalt | volle Breite, Pfeil **plus** Wort „Einklappen" | quadratischer Icon-Knopf, nur Pfeil |
| Farbe | `text-on-chrome` | `text-muted` |
| Zustand eingeklappt | derselbe Knopf, nur Pfeil gespiegelt | ein **anderes** Element: die Sprechblase mit Zähler (`:653`) |

Donald am 27.08., mit Bildschirmfoto:

> „Rechte Sidebar klappt man oben ein, linke unten, beide bitte unten oder oben,
> so einen halben Pill am Rand der Sidebar zum Ein- und Ausklappen nutzen."

Die Spec verlangt für die zweite Leiste ausdrücklich „built to the same rules"
(`design-system/spec.md:262`) — und über den Ort des Schalters sagt sie
**nichts**. Genau in dieser Lücke sind die beiden auseinandergelaufen.

## What Changes

- **Ein Bauteil statt zweier.** Ein halber Pill am Innenrand jeder Leiste, der
  über die Kante hinausragt, gespiegelt an beiden. Er klappt ein und aus.
- **Oben an beiden**, auf Höhe der Kopfzeile (Donalds Entscheidung).
- **Immer sichtbar**, nicht erst beim Darüberfahren.
- **Die untere Einklapp-Zeile links entfällt.** Die Feedback-Zeile darüber
  bleibt, wo sie ist — sie kam in AGE-566 aus einem eigenen Grund dorthin.
- **Die Sprechblase im eingeklappten rechten Rail bleibt klickbar.** Sie ist
  zugleich der Ungelesen-Melder, den `design-system/spec.md:1372` verlangt; eine
  grosse Fläche, die aussieht wie ein Knopf und nicht reagiert, wäre schlechter
  als eine Redundanz. Der Pill ist das **einheitliche** Bauteil, nicht das
  einzige.

## Was ausdrücklich NICHT dazugehört

- **Keine Änderung an den Umbruchpunkten.** Die Leisten stehen ab `lg` bzw.
  `xl`; darunter bleiben die Schubladen und ihre Schalter in der Topbar, wie
  `design-system/spec.md:270` es verlangt.
- **Kein Ziehen zum Verbreitern.** Der Pill schaltet, er zieht nicht.
- **Keine neue Zustandsverwaltung.** `collapsed` und `chatCollapsed` bleiben,
  samt getrennter Speicherung und der Zusage, dass das Einklappen der einen die
  andere nicht mitnimmt.
