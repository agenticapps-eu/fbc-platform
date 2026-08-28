# notifications (Delta)

## ADDED Requirements

### Requirement: Eine Release-Note öffnet sich mittig und kann Bilder tragen

Das System SHALL eine zugestellte Release-Note auf Anforderung als **zentriertes
Modal** zeigen, mit gesperrtem Seiten-Scroll und einer Fokus-Falle, und SHALL
sie über Kreuz, `Escape` und einen Klick auf den Hintergrund wieder schliessen.

Das Overlay SHALL an `document.body` portalisiert werden. Ein `fixed`-Overlay
innerhalb der Kartenliste wird in dieser Anwendung zweifach eingefangen — die
Karte trägt beim Überfahren ein `transform`, der Seitenkopf ein
`backdrop-filter`; beides erzeugt einen neuen Bezugsrahmen, in dem `fixed` nicht
mehr am Viewport hängt.

Eine Release-Note SHALL **Bilder** tragen können. Diese SHALL zur Bauzeit
feststehen und mit dem Bündel ausgeliefert werden, aus demselben Grund wie die
Eintragsliste: was im Bündel steht, ist per Konstruktion ausgeliefert. Ein
Upload-Weg SHALL für Release-Bilder NICHT bestehen.

Die Bildfläche SHALL ihre Abmessungen vor dem Laden kennen, damit der Text
darunter beim Eintreffen des Bildes nicht verrutscht.

Der Hinweis in der Glocke SHALL die **betroffene** Note öffnen, nicht nur die
Fläche zeigen.

#### Scenario: Ein Klick öffnet die Note mittig

- **WHEN** ein Mitglied auf eine Release-Note in der Liste klickt
- **THEN** öffnet sie sich als zentriertes Modal, und die Seite dahinter scrollt
  nicht mit

#### Scenario: Escape schliesst

- **WHEN** das Modal offen ist und das Mitglied `Escape` drückt
- **THEN** schliesst es, und der Blick steht wieder an derselben Stelle der Liste

#### Scenario: Die Glocke öffnet die gemeinte Note

- **WHEN** ein Mitglied den Release-Hinweis in der Glocke aktiviert
- **THEN** öffnet sich `/neues` mit genau der angekündigten Note offen

#### Scenario: Eine Note ohne Bilder zeigt keine leere Fläche

- **WHEN** eine zugestellte Note zu keinem ihrer Changes ein Bild hat
- **THEN** steht im Modal der Text allein, ohne Platzhalter und ohne Lücke

#### Scenario: Kein Bild wird hochgeladen

- **WHEN** ein Admin eine Release-Note zusammenstellt
- **THEN** gibt es an keiner Stelle einen Weg, ein Bild hochzuladen — die Bilder
  stehen im Bündel
