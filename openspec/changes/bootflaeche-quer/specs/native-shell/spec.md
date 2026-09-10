## MODIFIED Requirements

### Requirement: Die Startfläche trägt die Marke, nicht die leere Fläche des Frameworks

Die Fläche, die zwischen dem Antippen des Symbols und dem ersten Bild der
Anwendung steht, SHALL die Marke zeigen. Sie SHALL NOT die weiße Fläche sein,
die `npx cap add` hinterlässt.

**Es sind zwei Flächen, nicht eine.** Zuerst zeigt das Betriebssystem den
nativen Startbildschirm, danach steht der WebView, bis die Anwendung das erste
Mal zeichnet. Wann die erste der zweiten weicht, entscheidet das System und
nicht diese Anwendung — es ist ohne ein eigenes Plugin **nicht** steuerbar.
Die Zusage lautet deshalb nicht, dass der Übergang gesteuert wird, sondern dass
er nichts zu sehen gibt: beide Flächen SHALL denselben Grundton tragen, sodass
zwischen ihnen keine andersfarbige Fläche erscheint.

Die Boot-Fläche des WebViews SHALL **vor dem ersten Zeichnen** entscheiden, ob
sie erscheint. Eine Entscheidung, die erst im Anwendungscode fällt, kommt zu
spät: der Inhalt des Wurzelelements steht im ausgelieferten Dokument und wird
gezeichnet, bevor irgendein Modul geladen ist. Die Web-Fläche SHALL sich dabei
nicht ändern.

Die Startfläche SHALL aus den Quellen dieses Repositories erzeugt werden — der
Marke, dem Bild und den Schriften, die auch die Web-Fläche trägt. Eine von Hand
gepflegte zweite Fassung SHALL NOT danebenstehen.

**Die Erzeugung SHALL fail-closed sein, und zwar für alle drei Quellen.** Fehlt
eine, oder wird sie nicht so gebunden wie verlangt, SHALL der Lauf abbrechen und
nichts schreiben. Der Grund ist ein gemessener: das Rasterwerkzeug ersetzt eine
unbekannte Schrift **stillschweigend** durch eine ähnliche — eine Serifenschrift
kam als Grotesk heraus, ohne Fehlermeldung — und lädt Bilder über eine
Fremdbibliothek, die bei fehlendem Format ebenso still ausfällt. Beide Male
entstünde eine plausibel aussehende Datei, der niemand ansieht, dass sie falsch
ist.

Der Nachweis, dass die Schriften des Repositories gebunden sind, SHALL
**positiv** geführt werden: die verlangte Familie SHALL nachweislich auf die
Schriftdatei dieses Repositories auflösen. Der Nachweis, dass Systemschriften
nicht durchgreifen, ist die Gegenprobe dazu und SHALL NOT an seiner Stelle
stehen — eine gelungene stille Ersetzung als Kontrolle zu führen widerspricht
der Zusage, die diese Anforderung gibt.

Die Komposition SHALL **im Verhältnis** zur Bildschirmfläche verankert sein,
nicht in festen Punkten, und SHALL in **beiden Orientierungen** und auf **beiden
Gerätefamilien** halten — die Anwendung erlaubt Hoch- und Querformat und ist als
universelles Bündel gebaut. Bild, Verlauf und Schriftzug SHALL NOT gegeneinander
verrutschen können.

**Die Boot-Fläche SHALL dafür eine eigene Querfassung des Bildes laden, nicht
dieselbe formatfüllend beschnittene.** Ein Hochkantband, das quer mit `cover` in
ein Band von rund 3,6:1 gelegt wird, zeigt nur etwa ein Fünftel seiner Höhe —
gemessen am Pixel 11 Pro 670 von 3239 Zeilen, also 20,7 %, gegen rund 97 %
hochkant. Übrig bleibt die Wand zwischen den beiden abgebildeten Personen, und
beide Gesichter fallen heraus. Was die native Fläche über ihre eigene
Querfassung auswählt, SHALL die Boot-Fläche im WebView ebenso auswählen.

**Das Merkmal dieser Auswahl SHALL die verfügbare HÖHE sein, nicht die
Orientierung allein.** Die Anwendung ist ein universelles Bündel; ein Tablet quer
hat reichlich Höhe und bekommt nativ weiterhin das Hochkantband. Eine Regel, die
nur nach der Orientierung fragt, zeigte dort im WebView das Querband und risse
damit genau die Naht auf, die diese Anforderung weiter oben zusagt. Die Schwelle
SHALL als benannte Konstante neben den übrigen Zahlen der Komposition stehen und
maschinell gegen die Regel geprüft werden, die sie anwendet — sonst stünde sie
allein im Stylesheet, wo die drei anderen Zahlen ausdrücklich nicht stehen.

Der Verlauf, der das Bild ausblendet, SHALL in derselben Farbe enden, auf der
der Schriftzug steht, und SHALL diese Farbe an der Unterkante seiner Fläche
erreichen — **in jeder Orientierung**. Ein in das Bild eingebackener Verlauf
erfüllt das nicht: wird das Bild formatfüllend beschnitten, wird der Verlauf
mitbeschnitten und seine Unterkante ist nicht mehr die Grundfarbe.

Der Grundton SHALL ausdrücklich gesetzt sein und SHALL NOT von der Darstellung
des Systems abhängen. Diese Anwendung hat kein dunkles Inhaltsthema; eine
Fläche, die dem Systemthema folgt, wäre im Dunkelmodus schwarz und stünde damit
unter dunkler Schrift.

**Diese Anforderung weicht bewusst von Apples Empfehlung ab**, den
Startbildschirm textfrei zu halten. Der Grund für jene Empfehlung ist die
Lokalisierbarkeit; diese Anwendung ist einsprachig deutsch. Wird sie es einmal
nicht mehr, ist der eingebackene Claim die Stelle, die nachzieht — das steht
hier, damit es dann gefunden wird.

Der Beleg SHALL **auf dem Gerät** und **nach einer frischen Installation**
geführt werden. iOS hält den Startbildschirm in einem Zwischenspeicher: eine
geänderte Fläche erscheint nach einem gewöhnlichen Neustart unter Umständen
nicht, und ein Beleg ohne vorheriges Löschen der App belegt den alten Zustand.

Der Beleg am erzeugten Bild SHALL **regionsweise** geführt werden, nicht über
einen Mittelwert. Die Komposition endet absichtlich in derselben Farbe, mit der
sie vorher vollflächig gefüllt war; ein Mittelwert kann beide Zustände deshalb
nicht sicher unterscheiden.

#### Scenario: Der Kaltstart zeigt die Marke

- **WHEN** die frisch installierte App auf einem Gerät kalt gestartet wird
- **THEN** zeigt die Fläche vor dem ersten Bild der Anwendung Marke, Wortmarke
  und Claim
- **AND** sie ist nicht die leere Fläche des Frameworks

#### Scenario: Zwischen den beiden Flächen erscheint keine fremde Farbe

- **WHEN** der native Startbildschirm dem WebView weicht
- **THEN** ist dabei keine andersfarbige Fläche zu sehen

#### Scenario: Die Web-Fläche zeigt die Boot-Fläche nicht

- **WHEN** dieselbe Auslieferung im Browser geöffnet wird
- **THEN** erscheint die Boot-Fläche der App dort zu keinem Zeitpunkt

#### Scenario: Das Bild hat in beiden Orientierungen keine sichtbare Kante

- **WHEN** die Startfläche im Hoch- oder im Querformat gezeichnet wird
- **THEN** geht das Bild ohne erkennbare Grenze in die Fläche über, auf der der
  Schriftzug steht
- **AND** der Schriftzug steht innerhalb der Fläche und wird nicht abgeschnitten

#### Scenario: Eine nicht gebundene Repo-Schrift bricht die Erzeugung ab

- **WHEN** die Erzeugung feststellt, dass die verlangte Schriftfamilie nicht auf
  die Schriftdatei dieses Repositories auflöst
- **THEN** bricht sie ab und schreibt nichts

#### Scenario: Eine fehlende Quelle bricht die Erzeugung ab

- **WHEN** Marke, Bild oder Schrift nicht gelesen werden können
- **THEN** bricht die Erzeugung ab und schreibt nichts
- **AND** es entsteht keine Fläche, in der die fehlende Quelle durch etwas
  anderes ersetzt wurde

#### Scenario: Eine Änderung an der Quelle erreicht die Startfläche

- **WHEN** Marke, Bild oder Claim im Repository geändert werden und die
  Erzeugung erneut läuft
- **THEN** trägt die erzeugte Startfläche die Änderung, ohne dass eine Datei von
  Hand nachgezogen wird

#### Scenario: Die Boot-Fläche quer zeigt die Gesichter, nicht die Wand dazwischen

- **WHEN** die Boot-Fläche auf einem quer gehaltenen Telefon gezeichnet wird
- **THEN** zeigt sie den queren Ausschnitt des Bildes, denselben Bildbereich, den
  die native Fläche dort zeigt
- **AND** sie zeigt nicht das hochkant beschnittene Band

#### Scenario: Eine Fläche mit viel Höhe behält quer das Hochkantband

- **WHEN** die Boot-Fläche quer gezeichnet wird und die Höhe der Fläche die
  Schwelle überschreitet
- **THEN** zeigt sie dasselbe Hochkantband, das die native Startfläche dort zeigt
- **AND** zwischen den beiden Flächen entsteht keine Naht
