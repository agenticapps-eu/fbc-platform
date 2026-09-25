## REMOVED Requirements

### Requirement: Der Feedback-Eintrag steht in der Leiste und verdeckt nichts

**Reason**: Die Anforderung verortet den Eintrag „am Fuss, über dem
Einklapp-Schalter" und sagt das in einem eigenen Szenario noch einmal zu
(„Am Schreibtisch steht er am Fuss der Leiste"). Beides wird mit AGE-929 falsch:
der Support-Abschnitt ist ein gewöhnlicher Abschnitt zwischen „Mein Bereich" und
„Administration" geworden, und sein zweiter Eintrag steht dort, wo der Abschnitt
steht. Sie wird durch die gleichnamige unten ersetzt, die **nur** die Verortung
nachzieht.

**Migration**: Keine. Der Eintrag bleibt derselbe, das Formular unverändert, und
die beiden Zusagen, die an ihm hängen — genau ein `aria-modal`, solange er aus
der Schublade heraus offen steht (AGE-688), und Escape trifft das oberste
Overlay (AGE-697) — stehen unverändert in `support-tutorials`.

## ADDED Requirements

### Requirement: Der Feedback-Eintrag steht im Support-Abschnitt und verdeckt nichts

Der Weg zum Feedback SHALL ein Eintrag **in der Seitenleiste** sein — seit
AGE-904 als einer von zwei Einträgen des Abschnitts „Support", seit AGE-929 an
der Stelle, an der dieser Abschnitt steht: zwischen „Mein Bereich" und
„Administration". Unterhalb des `lg`-Breakpoints SHALL er in der
Navigationsschublade stehen, dem einzigen Ort, an dem die Leiste dort erreichbar
ist.

Er SHALL NOT über dem Inhalt schweben, in keiner Breite.

Er SHALL NOT stattdessen um einige Pixel verschoben werden. Ein fester Knopf
über einer Kachelreihe kollidierte beim nächsten Formular wieder, und dann
merkte es niemand, weil niemand danach messen würde. Genau das war zweimal der
Anlass: AGE-529 (über der Kachel „Frage") wurde durch Verschieben gelöst, und
AGE-528/9.7 hat den Rückfall gemessen — auf 375×812 mit geöffnetem Composer lag
der Knopf (240–340 × 690–732) auf der kuratierten Kachel „Frage"
(240–299 × 697–723), und `document.elementFromPoint` in deren Mitte lieferte
„Feedback". Aus der Leiste heraus kann diese Kollision nicht wiederkehren: dort
konkurriert der Eintrag mit nichts.

In der eingeklappten Leiste SHALL er sein Symbol ohne Beschriftung zeigen und
dabei einen zugänglichen Namen behalten.

Er SHALL in Polsterung und Symbolabstand nicht von einem Eintrag mit Pfad zu
unterscheiden sein. Er steht in derselben Spalte wie sie; eine eigene Form
liesse den Abschnitt an seiner zweiten Zeile auseinanderfallen.

#### Scenario: Auf dem Telefon verdeckt er keine Bedienelemente

- **WHEN** die Seite auf 375 px Breite mit geöffnetem Composer am Seitenanfang
  dargestellt wird
- **THEN** liegt kein Feedback-Auslöser über dem Inhalt
- **AND** `document.elementFromPoint` in der Mitte jeder sichtbaren kuratierten
  Kachel liefert diese Kachel, nicht den Feedback-Auslöser

#### Scenario: Am Schreibtisch steht er im Support-Abschnitt

- **WHEN** die Seitenleiste dargestellt wird
- **THEN** steht der Eintrag „Feedback" im Abschnitt „Support"
- **AND** dieser Abschnitt steht zwischen „Mein Bereich" und „Administration"

#### Scenario: Er sitzt wie ein Eintrag mit Pfad

- **WHEN** der Abschnitt „Support" offen dargestellt wird
- **THEN** trägt „Feedback" dieselbe Polsterung und denselben Symbolabstand wie
  „Tutorials"

#### Scenario: Eingeklappt bleibt er benennbar

- **WHEN** die Seitenleiste eingeklappt dargestellt wird
- **THEN** zeigt der Eintrag nur sein Symbol
- **AND** er trägt den zugänglichen Namen „Feedback"
