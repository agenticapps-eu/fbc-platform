# Design — kein seitliches Schieben bei 320 px

## Die Messmethode, und warum nicht die naheliegende

`documentElement.scrollWidth > clientWidth` ist der uebliche Griff und **allein
nicht ausreichend**. In diesem Repo hat er schon einmal „passt" gemeldet, wo
339 px echter Bedarf bestand, und in der Geraete-Emulation waechst `innerWidth`
mit dem Fehler mit — die Groesse, gegen die man prueft, ist dann selbst
verfaelscht.

Gemessen wird deshalb **je Element**, gegen `documentElement.clientWidth`:

1. `getBoundingClientRect().right − clientWidth` — ragt das Element hinaus?
2. `scrollWidth − clientWidth` **am Element selbst** — braucht sein Inhalt mehr,
   als es hergibt?

Und zwei Filter, ohne die die Liste unbrauchbar ist:

- **`position: fixed` ausschliessen.** Overlays haengen am Viewport und sind ein
  eigener Fehlerfall.
- **`.sr-only` ausschliessen.** Vorleser-Text ist absichtlich beschnitten und
  meldet sich sonst auf jeder Route als Treffer. In der ersten Messung auf
  `/events/:id` waren vier von vier Treffern genau das.

Nur **Blattknoten** werden als Taeter gezaehlt. Ein Vorfahr laeuft ueber, *weil*
ein Kind es tut; ihn mitzuzaehlen erzeugt eine Kette identischer Meldungen und
verdeckt die Stelle, die man aendern muss.

## Die Gegenprobe, die den Befund zum Beleg macht

Eine Messung „vorher gross, nachher klein" ist mit einem Zufall daneben
vereinbar. Deshalb wird in **drei** Schritten gemessen: Fehler feststellen,
Eigenschaft setzen, Eigenschaft **wieder zuruecknehmen**. Kommt der Fehler
zurueck, ist die Aenderung die Ursache.

Auf `/` ergab das 434 → 320 → 434, und nach dem Setzen blieb **kein** weiteres
ueberlaufendes Element uebrig.

## Der Waechter

Zwei Regeln, beide aus dem, was gemessen wurde — keine dritte auf Verdacht.

**Regel 1 — feste Spalten brauchen einen Breakpoint.** Eine Rasterdefinition mit
einer festen Laenge (`rem`, `px`, `ch`) ohne vorangestelltes `sm:`/`md:`/`lg:`/
`xl:` ist verboten. Das ist eine reine Textpruefung, ohne Fehlalarme, und trifft
heute genau zwei Zeilen.

**Regel 2 gibt es nicht mehr.** Sie sollte von einem kuerzenden Element die
JSX-Vorfahren hinaufgehen und beim ersten Flex-/Grid-Kind `min-w-0` verlangen.
Der Plan-Review hat gezeigt, dass sie **keinen der beiden gemessenen Faelle**
gesehen haette:

- `MemberDashboard.tsx` — der kuerzende Text steht in `DashTile`, das Raster in
  einer anderen Komponentenfunktion **derselben Datei**. Die JSX-Kette bricht an
  der Komponentengrenze ab.
- `MemberDirectory.tsx` — das fehlende `min-w-0` sitzt in `Motion.tsx`, also in
  einer **anderen Datei**.

Das ist kein Feinschliff: zwischen kuerzendem Text und Rasterkind liegt in
diesem Code **regelmaessig** eine Komponentengrenze, weil genau dafuer
Komponenten da sind. Ein Waechter, der an jeder Grenze verstummt, ist bei jedem
realen Fall gruen — ein Vakuumtest mit Zeremonie.

## Stattdessen: den Defekt wegkonstruieren

Die Muster laufen nicht ueber beliebige Stellen, sondern durch **zwei geteilte
Bausteine**. Traegt jeder von ihnen `min-width: 0`, kann das Muster an den
Aufrufstellen nicht mehr entstehen — es gibt nichts mehr zu detektieren.

| Baustein | behebt | gemessen |
|---|---|---|
| `Card` | die eingeloggte Startseite | 434 → **320**, zurueckgenommen 434 |
| `StaggerItem` | das Verzeichnis | 359 → **320**; dieselbe Eigenschaft auf der Karte: 359 → 359 |

Zwei Zeilen statt eines Parsers, und die Zusage haengt am Baustein statt an der
Sorgfalt jeder kuenftigen Aufrufstelle. `min-width: 0` senkt nur den Boden: es
macht nichts breiter und nichts schmaler als die Spur, in der das Element steht.
Bei breiten Fenstern ist es wirkungslos.

**Was dabei verloren geht, offen gesagt:** eine dritte Flaeche, die weder `Card`
noch `StaggerItem` benutzt, ist von dieser Konstruktion nicht gedeckt und wird
von keinem Test gefunden. Die Ergebnismessung bleibt Handarbeit. Das ist der
Grund fuer den Folge-Vorgang zur browsergestuetzten Messung — nicht ein
Nachgedanke, sondern die benannte Luecke dieses Zuschnitts.

## Warum kein `overflow-x: hidden` auf dem Seitencontainer

Es ist der schnellste Weg, die Zusage zu erfuellen, und der schlechteste. Der
Ueberlauf verschwindet aus der Messung, der Inhalt aber auch — er steht dann
ausserhalb und ist mit keiner Geste mehr erreichbar. Die Zusage lautet, dass
nichts ueberlaeuft, nicht dass man es nicht sieht. Deshalb steht das Verbot in
der Anforderung selbst und nicht nur hier.

## Verworfene Alternative: Playwright in CI

Eine echte Browser-Messung ueber alle Routen bei 320/375/414 px waere die
ehrliche Erfuellung des Abnahmepunkts „laeuft in CI mit". Verworfen am 26.08.
(Donald), weil sie eine neue Dev-Abhaengigkeit, einen Browser-Download in CI und
einen eigenen Job bedeutet — und weil ein **eingeloggter** Zustand in CI
herstellbar sein muesste, sonst deckte sie nur die oeffentlichen Routen ab und
damit keine der drei gemessenen Stellen.

Als Folge-Issue notiert, nicht stillschweigend fallengelassen.

**Der Plan-Review hat dieses Argument gedreht, nicht bestaetigt.** Die statische
Pruefung wurde gewaehlt, weil sie „die Ursache prueft". Sie kann die gemessenen
Ursachen aber gerade **nicht** sehen. Damit ist der Folge-Vorgang nicht mehr
eine Kuer, sondern die einzige Fassung dieser Zusage, die sich wiederholen
laesst. Entscheidung Donald, 26.08., in Kenntnis dieses Befunds: trotzdem jetzt
konstruktiv loesen und die Messung von Hand fuehren.
