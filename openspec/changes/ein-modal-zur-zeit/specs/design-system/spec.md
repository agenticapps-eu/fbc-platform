# design-system — Delta für `ein-modal-zur-zeit`

## ADDED Requirements

### Requirement: Über der Navigationsschublade trägt nur das obere Overlay `aria-modal`

Steht in der Off-Canvas-Navigation ein Zugang, der ein weiteres modales Overlay
öffnet, SHALL die Schublade ihr `aria-modal` abgeben, solange dieses Overlay
offen ist. Genau **ein** Element SHALL dann `aria-modal="true"` tragen, und das
SHALL das obere Overlay sein. Beim Schliessen SHALL die Schublade es
zurückerhalten.

Betroffen ist heute genau ein Zugang: der Feedback-Eintrag, der unterhalb von
`lg` **nur** in der Schublade steht.

Der Grund SHALL festgehalten sein. Die Schublade trägt `aria-modal="true"`, und
das Feedback-Formular ebenfalls; das Formular hängt jedoch per Portal an
`document.body` und liegt damit als Geschwister von `#root` **ausserhalb** der
Schublade. Tragen beide das Attribut, hält Vorlesesoftware, die `aria-modal`
befolgt, alles ausserhalb des als modal ausgezeichneten Knotens für inert — sie
zeigte die Schublade und nicht das Formular. Unterhalb von `lg` gibt es keinen
zweiten Weg zum Feedback; die Fläche wäre damit nicht bloss umständlich,
sondern unerreichbar.

Die Schublade SHALL dabei **offen bleiben**. Sie stattdessen zu schliessen
SHALL NOT der Weg sein, und der Grund SHALL mit der Messung festgehalten sein:
der Feedback-Zugang wird **innerhalb** der Schublade gerendert. Sie zu
schliessen hängt ihn ab und nimmt den Zustand mit, an dem das Portal hängt —
gemessen am 03.09., das Formular ging dann gar nicht erst auf (null Knoten mit
`aria-modal="true"` statt einem).

Woher die Schale von dem oberen Overlay erfährt, SHALL das Overlay selbst
melden. Der Stapel in `useOverlay` SHALL NOT die Quelle sein: er ist ein
Modulwert ohne Abonnement, ein Eintrag darauf löst in der Schale kein Render
aus. Die Meldung SHALL an den Zustand gebunden sein und nicht an die einzelnen
Wege, auf denen er sich ändert — Abbrechen, Absenden, Escape und Klick auf den
Schleier führen zusammen an mehreren Stellen zum Schliessen, und eine davon zu
übersehen liesse die Schublade ohne `aria-modal` zurück.

Wird die Schublade abgehängt, während das Formular offen steht — etwa beim
Sprung über `lg` —, SHALL eine erneut geöffnete Schublade wieder
`aria-modal="true"` tragen.

Diese Anforderung SHALL NOT als Zusage gelesen werden, dass im Dokument
überhaupt nie zwei `aria-modal`-Knoten stehen können. Zugesagt und belegt ist
der Weg aus der Schublade heraus.

#### Scenario: Feedback aus der Schublade lässt genau ein Modal stehen

- **WHEN** die Navigationsschublade unterhalb von `lg` offen ist und der
  Feedback-Zugang darin betätigt wird
- **THEN** steht das Feedback-Formular offen
- **AND** trägt genau ein Element im Dokument `aria-modal="true"`, und es ist
  das Formular
- **AND** steht die Schublade weiterhin offen

#### Scenario: Die Schublade bekommt ihr `aria-modal` zurück

- **WHEN** das aus der Schublade geöffnete Feedback-Formular wieder geschlossen
  wird
- **THEN** trägt die Schublade wieder `aria-modal="true"`

#### Scenario: Nach dem Abhängen kommt die Schublade wieder modal hoch

- **WHEN** die Schublade mit offenem Feedback-Formular am Breakpoint schliesst
  und danach erneut geöffnet wird
- **THEN** trägt sie wieder `aria-modal="true"`

#### Scenario: Der Zugang ab `lg` bleibt unberührt

- **WHEN** der Feedback-Zugang in der angedockten Seitenleiste ab `lg` betätigt
  wird
- **THEN** öffnet sich das Formular, ohne dass eine Schublade beteiligt ist
