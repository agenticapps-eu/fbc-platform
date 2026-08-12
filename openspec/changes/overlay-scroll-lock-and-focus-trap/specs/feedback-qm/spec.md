## ADDED Requirements

### Requirement: Der Feedback-Knopf schwebt nur dort, wo er nichts verdeckt

Der schwebende Feedback-Knopf SHALL unterhalb des `sm`-Breakpoints **nicht**
schweben, sondern am Ende der Seite im Dokumentfluss stehen. Ab `sm` SHALL er
unverändert unten rechts schweben.

Er SHALL NOT stattdessen um einige Pixel verschoben werden. Ein fester Knopf
über einer Kachelreihe kollidierte beim nächsten Formular wieder, und dann
merkte es niemand, weil niemand danach messen würde.

Der Anlass ist gemessen (AGE-528, Task 9.7): auf 375×812 mit geöffnetem
Composer liegt der Knopf (240–340 × 690–732) auf der kuratierten Kachel
„Frage" (240–299 × 697–723); `document.elementFromPoint` in deren Mitte
liefert „Feedback".

#### Scenario: Auf dem Telefon verdeckt er keine Bedienelemente

- **WHEN** die Seite auf 375 px Breite mit geöffnetem Composer am Seitenanfang
  dargestellt wird
- **THEN** steht der Feedback-Knopf im Dokumentfluss am Seitenende
- **AND** `document.elementFromPoint` in der Mitte jeder sichtbaren kuratierten
  Kachel liefert diese Kachel, nicht den Feedback-Knopf

#### Scenario: Am Schreibtisch bleibt alles wie es war

- **WHEN** die Seite ab dem `sm`-Breakpoint dargestellt wird
- **THEN** schwebt der Knopf unverändert unten rechts
