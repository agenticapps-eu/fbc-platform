## RENAMED Requirements

- FROM: `### Requirement: Der Feedback-Knopf schwebt nur dort, wo er nichts verdeckt`
- TO: `### Requirement: Der Feedback-Eintrag steht in der Leiste und verdeckt nichts`

## MODIFIED Requirements

### Requirement: Der Feedback-Eintrag steht in der Leiste und verdeckt nichts

Der Weg zum Feedback SHALL ein Eintrag **in der Seitenleiste** sein — am Fuss,
über dem Einklapp-Schalter, seit AGE-904 als einer von zwei Einträgen des
Abschnitts „Support". Unterhalb des `lg`-Breakpoints SHALL er in der
Navigationsschublade stehen, dem einzigen Ort, an dem die Leiste dort erreichbar
ist.

Er SHALL NOT über dem Inhalt schweben. Diese Zusage beschrieb bis AGE-566 einen
schwebenden Knopf, der unterhalb des `sm`-Breakpoints in den Dokumentfluss fiel
und darüber unten rechts schwebte; seit AGE-566 schwebt er in keiner Breite
mehr, und die Zusage wird hier auf den gemessenen Stand gebracht.

Er SHALL NOT stattdessen um einige Pixel verschoben werden. Ein fester Knopf
über einer Kachelreihe kollidierte beim nächsten Formular wieder, und dann
merkte es niemand, weil niemand danach messen würde. Genau das war zweimal der
Anlass: AGE-529 (über der Kachel „Frage") wurde durch Verschieben gelöst,
AGE-528/9.7 hat es gemessen — auf 375×812 mit geöffnetem Composer lag der Knopf
(240–340 × 690–732) auf der kuratierten Kachel „Frage" (240–299 × 697–723), und
`document.elementFromPoint` in deren Mitte lieferte „Feedback". Aus der Leiste
heraus kann diese Kollision nicht wiederkehren: dort konkurriert der Eintrag mit
nichts.

In der eingeklappten Leiste SHALL er sein Symbol ohne Beschriftung zeigen und
dabei einen zugänglichen Namen behalten.

#### Scenario: Auf dem Telefon verdeckt er keine Bedienelemente

- **WHEN** die Seite auf 375 px Breite mit geöffnetem Composer am Seitenanfang
  dargestellt wird
- **THEN** liegt kein Feedback-Auslöser über dem Inhalt
- **AND** `document.elementFromPoint` in der Mitte jeder sichtbaren kuratierten
  Kachel liefert diese Kachel, nicht den Feedback-Auslöser

#### Scenario: Am Schreibtisch steht er am Fuss der Leiste

- **WHEN** die Seitenleiste dargestellt wird
- **THEN** steht der Eintrag „Feedback" an ihrem Fuss, über dem
  Einklapp-Schalter

#### Scenario: Eingeklappt bleibt er benennbar

- **WHEN** die Seitenleiste eingeklappt dargestellt wird
- **THEN** zeigt der Eintrag nur sein Symbol
- **AND** er trägt den zugänglichen Namen „Feedback"
