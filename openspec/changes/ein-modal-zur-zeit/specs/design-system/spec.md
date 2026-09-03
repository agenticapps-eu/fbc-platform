# design-system — Delta für `ein-modal-zur-zeit`

## ADDED Requirements

### Requirement: Ein Eintrag der Navigationsschublade schliesst sie

Die Off-Canvas-Navigation SHALL sich schliessen, sobald einer ihrer Einträge
betätigt wird. Das SHALL für **jeden** Eintrag gelten, den sie trägt — die
Navigationsziele **und** den Feedback-Zugang, der unterhalb von `lg` nur dort
steht.

Der Grund SHALL festgehalten sein. Die Schublade trägt `aria-modal="true"`, und
das Feedback-Formular ebenfalls; das Formular hängt jedoch per Portal an
`document.body` und liegt damit als Geschwister von `#root` **ausserhalb** der
Schublade. Blieben beide offen, trügen zwei Elemente gleichzeitig
`aria-modal="true"`. Vorlesesoftware, die `aria-modal` befolgt, hält alles
ausserhalb des als modal ausgezeichneten Knotens für inert — sie zeigte die
Schublade und nicht das Formular. Unterhalb von `lg` gibt es keinen zweiten Weg
zum Feedback, die Fläche wäre für sie also nicht bloss umständlich, sondern
unerreichbar.

Solange das Feedback-Formular aus der Schublade heraus offen steht, SHALL genau
**ein** Element `aria-modal="true"` tragen, und das SHALL das Formular sein.

Ein Ablegen des `aria-modal` an der Schublade SHALL NOT an die Stelle dieser
Regel treten. Der Stapel in `useOverlay` ist ein Modulwert **ohne Abonnement**:
ein Eintrag darauf löst in der Schale kein Render aus. Dieser Weg verlangte
zuerst eine Benachrichtigung an Abonnenten in dem Hook, an dem vier Overlays
hängen — Aufwand am geteilten Bauteil für eine Korrektur an einem Attribut.

Diese Anforderung SHALL NOT als Zusage gelesen werden, dass im Dokument
überhaupt nie zwei `aria-modal`-Knoten stehen können. Zugesagt und belegt ist
der Weg aus der Schublade heraus.

#### Scenario: Feedback aus der Schublade lässt genau ein Modal stehen

- **WHEN** die Navigationsschublade unterhalb von `lg` offen ist und der
  Feedback-Zugang darin betätigt wird
- **THEN** ist die Schublade geschlossen
- **AND** trägt genau ein Element im Dokument `aria-modal="true"`, und es ist
  das Feedback-Formular

#### Scenario: Der Zugang ab `lg` bleibt unberührt

- **WHEN** der Feedback-Zugang in der angedockten Seitenleiste ab `lg` betätigt
  wird
- **THEN** öffnet sich das Formular, ohne dass eine Schublade beteiligt ist
