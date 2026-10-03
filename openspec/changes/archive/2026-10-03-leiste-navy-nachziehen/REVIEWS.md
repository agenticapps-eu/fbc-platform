# Change review — leiste-navy-nachziehen

## Keine Fremdreviewer, und warum

Donalds Regel vom 26.08.2026: **Fremdreviewer nur bei Schema, Rechten oder
Sicherheit — reines UI direkt bauen.** Dieser Change ändert zwei Token-Zeilen in
`src/index.css`, vier Klassennamen und zwei Dokumentationsstellen; er fasst keine
Migration, keine Policy, keine RPC und keinen Rechteweg an.
`openspec validate --all` ist grün (37/37).

Das ist ein **Verzicht mit Begründung**, keine Auslassung — dieselbe Lage wie bei
`chatleiste-blau`, dem Change, dessen offene Frage dieser hier beantwortet.

## Was an die Stelle der Plan-Review tritt

Vier Messungen am gebauten Zustand, jede gegen eine Vermutung, die eine
Plan-Review bestätigt hätte, statt sie zu prüfen. Sie stehen mit Zahlen in
`design.md`:

1. Die Topbar ist `bg-canvas/85` — eine Inhaltsfarbe und **nicht** betroffen.
   Vermutet war das Gegenteil.
2. Die linke Navigation hängt **nicht** an `--color-chrome`. Die Spec von
   AGE-1002 behauptet es ausdrücklich und ist darin falsch.
3. Die Hover-Fläche ist **keine** Verschlechterung (1,11:1 → 1,15:1).
4. Der Fokusring **fällt durch** (3,61:1 → 2,83:1). Das war nicht vermutet und
   ist der eine Befund, der aus dem angekündigten Einzeiler eine Änderung mit
   Testbedarf macht.

Drei der vier Messungen haben eine Vermutung **widerlegt**. Eine Review, die
Farben nicht nachrechnet und die Token-Konsumenten nicht zählt, hätte keine
davon gefunden.

Der **Code-Review auf dem Diff** (Schritt 4) entfällt dadurch nicht und ist als
Aufgabe 4.3 geführt. Bei AGE-1002 hat er auf derselben Fläche vier zählende
Befunde geliefert, darunter einen kritischen — die Erwartung hier ist nicht
null.

<!-- Kein Trailer: dieser Record ist von Hand geschrieben und zählt keinen
     Reviewer. Das Gate rechnet Reviewer ohnehin nur aus und blockt nie. -->
