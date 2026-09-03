# design-system — Delta für `escape-trifft-das-oberste`

## ADDED Requirements

### Requirement: Ein Escape schliesst genau ein Overlay — das oberste

Liegen zwei modale Overlays übereinander, SHALL ein Druck auf Escape **nur das
obere** schliessen. Das untere SHALL danach offen stehen, und ein zweiter Druck
SHALL es schliessen.

Das obere Overlay SHALL Escape dafür am Dokument in der **Capture-Phase**
behandeln und die Weitergabe stoppen. Der Grund SHALL festgehalten sein: die
Schale schliesst ihre Schubladen über eigene `document`-Lauscher in der
Blasenphase; ohne Capture schlösse ein Tastendruck beides auf einmal. Der
Emoji-Wähler folgt dieser Regel bereits, das Feedback-Formular bis zu dieser
Anforderung nicht.

Das Feedback-Formular SHALL mit Escape schliessen, **auch dort, wo keine
Schublade darunter liegt**. Bis zu dieser Anforderung hatte es überhaupt keinen
Escape: unterhalb von `lg` schloss der Tastendruck die Schublade darunter und
riss das Formular mit ab, ab `lg` bewirkte er nichts.

Diese Anforderung SHALL NOT als Zusage gelesen werden, dass jede Fläche der
Schale ihren Escape über eine gemeinsame Stelle führt. Die übrigen Lauscher —
Profilmenü und Nachrichten-Schublade — behalten ihre eigene Bauart, und ob über
ihnen ein Overlay stehen kann, ist ungemessen.

#### Scenario: Escape über der Schublade trifft nur das Formular

- **WHEN** das Feedback-Formular über der offenen Navigationsschublade steht und
  Escape gedrückt wird
- **THEN** ist das Formular geschlossen
- **AND** steht die Schublade weiterhin offen und trägt wieder `aria-modal="true"`

#### Scenario: Das zweite Escape schliesst die Schublade

- **WHEN** danach erneut Escape gedrückt wird
- **THEN** ist auch die Schublade geschlossen

#### Scenario: Escape schliesst das Formular auch ohne Schublade darunter

- **WHEN** das Feedback-Formular aus der angedockten Seitenleiste geöffnet wurde
  und Escape gedrückt wird
- **THEN** ist das Formular geschlossen
