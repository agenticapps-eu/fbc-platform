## ADDED Requirements

### Requirement: Ein Kartenraster bemisst seine Spaltenzahl an seinem Behälter

Ein Raster aus gleichartigen Karten SHALL seine Spaltenzahl an der Breite
**seines eigenen Behälters** schalten, nicht an der Fensterbreite. Der Behälter
SHALL dazu als Abfragebehälter ausgewiesen sein (`@container`), und die
Schwellen SHALL in Containerbreiten stehen (`@[<breite>]:`).

Jedes Raster SHALL eine **Untergrenze je Karte** einhalten und lieber eine
Spalte weniger zeigen, als diese Grenze zu unterschreiten. Die Untergrenze SHALL
**208 px** betragen — das ist die schmalste Karte, die die Anwendung heute schon
ausliefert (1280 px Fensterbreite bei angedockter Nachrichten-Leiste, so
abgenommen in AGE-627), und damit keine neue Meinung, sondern der bereits
geltende Boden.

Der Grund ist gemessen, nicht vermutet. Am 31.08. gegen `63f3237`: alle drei
Kartenraster der Anwendung schalteten am Viewport. Eine angedockte Spalte
verengt die Inhaltsspalte, aber nicht das Fenster — das Raster blieb
dreispaltig, während die Fläche schrumpfte. Mit einer 280 px breiten
Inhaltsspalte rechts fielen die Karten bei 1024 px auf **126 px** und bei
1280 px mit offener Nachrichten-Leiste auf **115 px**. Beides liegt unter den
rund 128 px, die AGE-627 ausdrücklich verworfen hat.

Der Deckel nach oben SHALL erhalten bleiben: ein Raster, für das eine
Höchstzahl an Spalten entschieden wurde, SHALL diese Zahl auch dann nicht
überschreiten, wenn der Behälter breiter wird. Eine Umstellung auf
Containerbreiten SHALL keine Fläche dichter machen, als sie heute ist.

#### Scenario: Die verengte Spalte bricht um, statt zu quetschen

- **WHEN** ein Kartenraster in einem Behälter von 409 px dargestellt wird
- **THEN** zeigt es **eine** Spalte über die volle Breite
- **AND** keine Karte ist schmaler als 208 px

#### Scenario: Der heutige Zustand bleibt unverändert

- **WHEN** ein Kartenraster mit Deckel 3 in einem Behälter von 657 px oder
  873 px dargestellt wird
- **THEN** zeigt es drei Spalten, wie vor der Umstellung

#### Scenario: Ein breiter Behälter macht die Fläche nicht dichter

- **WHEN** derselbe Behälter auf 1376 px wächst
- **THEN** zeigt das Raster weiterhin höchstens drei Spalten

#### Scenario: Die Fensterbreite allein entscheidet nicht mehr

- **WHEN** zwei Raster derselben Art bei gleicher Fensterbreite in
  unterschiedlich breiten Behältern stehen
- **THEN** dürfen sie verschiedene Spaltenzahlen zeigen
