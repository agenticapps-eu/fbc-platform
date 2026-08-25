## ADDED Requirements

### Requirement: Ein Titelbild-Feld trägt das Verhältnis, auf das zugeschnitten wird

Das System SHALL die Felder, die ein hochgeladenes Titelbild aufnehmen, im
Seitenverhältnis **3:1** anlegen — dem Verhältnis, auf das beide Zuschneider
(`ProfilPage`, `EventCoverPicker`) das Bild bereits festlegen. Ein Feld, dessen
Verhältnis von dem der gespeicherten Bilder abweicht, erzwingt eine Wahl
zwischen Beschnitt und leerer Fläche; die Abweichung selbst ist die Ursache,
nicht die gewählte `object-fit`-Regel.

Diese Anforderung gilt für genau drei Bauteile und SHALL NOT als allgemeine
Regel für jedes Bild der Anwendung gelesen werden:

- den Profilkopf (`ProfileHero`),
- das Bildfeld der Event-Kachel,
- das Bildfeld des Event-Kopfes.

Ausdrücklich **nicht** erfasst sind die Zuschnitt-Vorschauen in `ProfilPage`
und `EventCoverPicker`, die Bilder im Feed und die Karte des
Mitgliederverzeichnisses. Sie sind entweder Werkzeug-Oberfläche oder tragen
anderes Bildmaterial; eine Regel, die sie stillschweigend mitbindet, wäre beim
Archivieren sofort verletzt.

Der Profilkopf SHALL dabei **keinen Höhendeckel** mehr führen. Das nimmt die
Deckelung aus AGE-566 zurück. Ihre Begründung — eine mitwachsende Bahn schiebt
den Namen unter die Falz — bleibt richtig und ist der bewusst gezahlte Preis:
eine Bahn mit fester Höhe **ist** auf einer breiten Seite selbst rund 6:1, und
in ihr kann ein 2,7:1-Bild nur beschnitten oder von breiten Balken umgeben
sein. Nachgemessen bei 1370 px Fensterbreite: die Bahn steht in einer
Inhaltsspalte von 1217 px, war mit Deckel 1217 x 256 px (also selbst 4,75:1)
und schnitt von einem 2,70:1-Bild 43,2 % der Höhe weg. Ohne Deckel wird sie
1217 x 406 px.

Das Bild SHALL innerhalb seines Feldes **vollständig** sichtbar sein. Wo das
gespeicherte Bild nicht genau 3:1 ist, SHALL es eingepasst und nicht
beschnitten werden.

Die Bestände hinter den drei Feldern sind **zwei verschiedene Buckets**, und sie
sind getrennt gemessen — eine Zahl aus dem einen belegt für das andere nichts:

- `covers` (Profilbanner), alle 55 Objekte: Median 2,70:1, Minimum 1,33:1,
  Maximum 3,00:1, keines breiter als 3:1. Für die 49 Bilder zwischen 2,2:1 und
  2,95:1 bleiben schmale Ränder, für die vier Ausreißer darunter breitere.
- `event-covers` (Event-Titelbilder) auf PROD: **ein** Objekt, und das ist
  3,00:1 — es kam durch `EventCoverPicker`. Alles, was über das Produkt
  hochgeladen wird, ist 3:1 und sitzt randlos.

Der **Demo-Seed** ist die benannte Ausnahme und SHALL NOT als Gegenbeispiel
gegen diese Anforderung gelten: seine acht Event-Bilder (1,50:1, eines 1,33:1)
sind Seiten-Heldenbilder, die am Zuschneider vorbei hochgeladen werden. Sie
stehen unter dieser Regel mit rund 25 % freier Fläche je Seite in der Kachel.
Das ist ein Mangel des Seeds, der Material erzeugt, das das Produkt so nie
herstellt — nachzuziehen ist der Seed, nicht das Feld.

Geschützt ist das **gespeicherte** Bild, nicht das Original vor dem Zuschnitt.
Beide Upload-Wege schneiden zu, bevor gespeichert wird; eine Zusage über das
ursprüngliche Motiv könnte diese Anforderung nicht halten.

Die frei bleibende Fläche SHALL die Gestaltung tragen, die das Feld ohne Bild
zeigt, und diese SHALL **unter** dem Bild liegen, nicht neben ihm. Ein
Platzhalter, der nur im Zweig „kein Bild" existiert, lässt beim eingepassten
Bild die Fläche des Elternteils durchscheinen — eine flache Füllfarbe neben dem
Motiv liest sich als Fehler, nicht als Rahmung.

Marken, die auf dem Bild liegen — die Datumsmarke des Events — SHALL am
Container hängen bleiben und nicht am Bild. Sie beschriften die Kachel, nicht
das Motiv.

Der Nachweis SHALL im Browser geführt werden, aus den Maßen des Containers
(`getBoundingClientRect`), den natürlichen Maßen des Bildes und dem daraus
berechneten Faktor `s = min(bw/nw, bh/nh)`. Ein Test in jsdom SHALL
ausdrücklich nur als **strukturelle** Zusage gelten: unter `cover` wie unter
`contain` behält die `<img>`-Box die Maße ihres Containers, und nur der gemalte
Inhalt darin unterscheidet sich — jsdom sieht davon nichts und kann die
Einpassung daher nicht belegen.

#### Scenario: Das Bildfeld hat das Verhältnis des Zuschnitts

- **WHEN** eines der drei Bauteile mit einem Titelbild gerendert wird
- **THEN** ist sein Bildfeld 3:1

#### Scenario: Die Kachel hält 3:1 auch ohne Titelbild

- **WHEN** eine Event-Kachel ohne Titelbild gerendert wird
- **THEN** ist ihr Feld 3:1
- **AND** der Grund ist die Ausrichtung im Raster: bebilderte und unbebilderte
  Kacheln stehen nebeneinander und dürfen nicht ungleich hoch sein

#### Scenario: Der Event-Kopf ohne Titelbild bleibt ein flaches Band

- **WHEN** der Event-Kopf ohne Titelbild gerendert wird
- **THEN** ist er ein flaches Band und NICHT 3:1
- **AND** er steht allein, es gibt kein Raster auszurichten, und ein
  3:1-Platzhalter wäre auf einer 1100 px breiten Seite rund 370 px leerer
  Verlauf über dem Titel

#### Scenario: Ein gespeichertes 3:1-Bild sitzt randlos

- **WHEN** ein genau auf 3:1 zugeschnittenes Bild dargestellt wird
- **THEN** füllt es sein Feld vollständig aus, ohne Beschnitt und ohne freie
  Fläche

#### Scenario: Ein abweichendes Bild wird eingepasst, nicht beschnitten

- **WHEN** ein Bild mit einem anderen Verhältnis als 3:1 dargestellt wird
- **THEN** ist es vollständig sichtbar
- **AND** es fehlt an keiner Kante ein Teil des gespeicherten Bildes

#### Scenario: Die freie Fläche liegt unter dem Bild

- **WHEN** ein eingepasstes Bild sein Feld nicht ausfüllt
- **THEN** zeigt die verbleibende Fläche dieselbe Gestaltung wie das Feld ohne
  Bild

#### Scenario: Die Höhe des Profilkopfes folgt der Breite

- **WHEN** der Profilkopf bei zwei verschiedenen Fensterbreiten dargestellt wird
- **THEN** verhält sich seine Höhe wie seine Breite, ohne obere Schranke

#### Scenario: Ein schmaleres Fenster beschneidet nicht

- **WHEN** dieselbe Ansicht bei einer schmaleren Fensterbreite dargestellt wird
- **THEN** bleibt das ganze Bild sichtbar
- **AND** Größe und Lage der freien Fläche dürfen sich dabei ändern

#### Scenario: Die Datumsmarke bleibt am Feld

- **WHEN** ein Event-Bild eingepasst dargestellt wird und dabei freie Fläche
  entsteht
- **THEN** sitzt die Datumsmarke weiterhin an der Ecke des Feldes
