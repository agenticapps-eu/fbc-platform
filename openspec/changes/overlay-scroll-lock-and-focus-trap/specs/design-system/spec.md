## ADDED Requirements

### Requirement: Ein offenes Overlay hält die Seite dahinter still

Jedes modale Overlay SHALL das Scrollen des Dokuments sperren, solange es offen
ist, und die Scroll-Position beim Schließen **exakt** wiederherstellen.

Die Sperre SHALL `position: fixed` auf dem `body` setzen, zusammen mit einem
negativen `top` in Höhe der gemerkten Scroll-Position sowie `left` und `right`
auf `0`. `overflow: hidden` allein SHALL NOT genügen: auf iOS Safari scrollt
der Inhalt darunter weiter.

Das Wiederherstellen SHALL NOT entfallen. `position: fixed` setzt den
Dokument-Scroll auf null; ein Overlay, das nur die Stile zurücknimmt, lässt den
Leser am Seitenanfang zurück und ist damit schlechter als gar keine Sperre.

Die Sperre SHALL bereits vorhandene Inline-Werte dieser vier Eigenschaften
sichern und beim Freigeben genau wiederherstellen, statt sie zu leeren.

Ein Ausgleich für die Breite des verschwindenden Scrollbalkens SHALL NOT
hinzukommen: `html` trägt `scrollbar-gutter: stable`, der Platz ist ohnehin
reserviert, und ein zusätzliches `padding-right` erzeugte erst den seitlichen
Versatz, den es verhindern soll.

#### Scenario: Bei offenem Overlay steht die Seite

- **WHEN** ein Overlay geöffnet wird, während die Seite 600 px weit gescrollt ist
- **THEN** trägt der `body` `position: fixed` und `top: -600px`

#### Scenario: Nach dem Schließen steht der Leser wieder dort, wo er war

- **WHEN** dasselbe Overlay geschlossen wird
- **THEN** tragen die vier Eigenschaften wieder ihre Ausgangswerte
- **AND** die Scroll-Position ist wieder exakt 600 px

#### Scenario: Zwei Overlays entsperren sich nicht gegenseitig

- **WHEN** zwei Overlays offen sind und eines geschlossen wird
- **THEN** bleibt die Seite gesperrt
- **AND** erst das Schließen des zweiten gibt sie frei und stellt die Position
  wieder her

### Requirement: Ein Overlay mit `aria-modal` hält auch den Fokus

Ein Overlay, das sich als `aria-modal="true"` ausgibt, SHALL den Tastaturfokus
in sich behalten. Tab SHALL in drei Fällen umlenken:

1. auf dem letzten fokussierbaren Element des Overlays zum ersten,
2. mit Shift auf dem ersten zum letzten,
3. **von außerhalb des Overlays** zum ersten (mit Shift: zum letzten).

Fall 3 SHALL NOT entfallen. Drei der vier Overlays versetzen den Fokus beim
Öffnen nicht; ohne ihn stünde er hinter dem Dialog und eine Falle, die nur an
den Rändern des Containers greift, wäre dort wirkungslos.

Beim Öffnen SHALL der gemeinsame Hook den Fokus **nicht** versetzen. Wohin er
zuerst geht, entscheidet das jeweilige Overlay — die Bild-Lightbox etwa setzt
ihn genau einmal beim Öffnen, damit ein Bildwechsel ihn nicht jedes Mal auf
„Schließen" zurückreißt.

Sind mehrere Overlays offen, SHALL **nur das oberste** Tab behandeln.

Beim Schließen SHALL der Fokus an das Element zurückkehren, das ihn vor dem
Öffnen hatte — nur wenn dieses noch im Dokument hängt, ohne Scrollen
(`preventScroll`) und **nach** dem Wiederherstellen der Scroll-Position.

Fokussierbar SHALL heißen: Verweise mit `href`, Schaltflächen, Eingabe-,
Auswahl- und Textfelder sowie Elemente mit `tabindex` — jeweils ohne
`disabled`, ohne `tabindex="-1"` und ohne `input[type="hidden"]`.

#### Scenario: Tab läuft im Overlay um

- **WHEN** der Fokus auf dem letzten fokussierbaren Element eines offenen
  Overlays steht und Tab gedrückt wird
- **THEN** erhält das erste fokussierbare Element des Overlays den Fokus

#### Scenario: Shift-Tab läuft rückwärts um

- **WHEN** der Fokus auf dem ersten fokussierbaren Element steht und Shift-Tab
  gedrückt wird
- **THEN** erhält das letzte fokussierbare Element den Fokus

#### Scenario: Tab von außerhalb springt hinein

- **WHEN** ein Overlay offen ist, der Fokus außerhalb davon liegt und Tab
  gedrückt wird
- **THEN** erhält das erste fokussierbare Element des Overlays den Fokus

#### Scenario: Nur das oberste Overlay fängt Tab

- **WHEN** zwei Overlays offen sind und Tab gedrückt wird
- **THEN** lenkt ausschließlich das zuletzt geöffnete um

#### Scenario: Der Fokus kehrt zum Auslöser zurück

- **WHEN** ein Overlay über eine Schaltfläche geöffnet und danach geschlossen wird
- **THEN** trägt diese Schaltfläche den Fokus wieder
- **AND** die wiederhergestellte Scroll-Position bleibt unverändert

### Requirement: Alle modalen Overlays teilen sich diese eine Regel

Sperre und Fokus-Falle SHALL aus **einem** gemeinsamen Hook in
`src/components/ui/` kommen, an dem jedes gemountete modale Overlay hängt —
Bild-Lightbox, Avatar-Zuschnitt, Feedback-Panel und die Off-Canvas-Navigation.

Vier Einzellösungen SHALL NOT an seine Stelle treten. Der Mangel ist nicht die
fehlende Sperre an einer Stelle, sondern die fehlende Regel: das nächste
Overlay entstünde sonst wieder ohne.

Ein Overlay, das nur per Stilregel ausgeblendet wird statt abgemeldet zu
werden, SHALL seinen Zustand beim Verlassen des zugehörigen Breakpoints
schließen. Sonst hinge die Sperre an einem Overlay, das niemand mehr sieht.

#### Scenario: Jedes gemountete Overlay sperrt

- **WHEN** eines der vier gemounteten Overlays geöffnet wird
- **THEN** ist das Dokument gesperrt, und beim Schließen wird die Position
  wiederhergestellt

#### Scenario: Die Off-Canvas-Navigation schließt am Breakpoint

- **WHEN** die Navigation unterhalb von `lg` geöffnet ist und die Breite `lg`
  erreicht
- **THEN** ist sie geschlossen und die Seite wieder frei
