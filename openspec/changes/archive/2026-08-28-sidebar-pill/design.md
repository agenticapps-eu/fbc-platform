# Design — ein Pill für beide Leisten (AGE-638)

## Entscheidungen

### 1. Ein Bauteil, zweimal montiert — nicht zwei, die sich ähneln

Die beiden Schalter sind auseinandergelaufen, weil sie **nie dasselbe Bauteil
waren**. Ein gemeinsames Aussehen, das aus zwei Quelltexten kommt, läuft wieder
auseinander; das ist keine Vermutung, sondern genau das, was hier passiert ist.

Also eine Komponente, zweimal gerufen, mit `seite: "links" | "rechts"`. Zwei
Aufrufer sind der Grund, aus dem es sie geben darf — bei einem wäre sie eine
Abstraktion auf Verdacht.

### 2. Der Pill hängt an der Leiste, nicht am Rahmen

`absolute` **innerhalb** der `<aside>`, um die halbe eigene Breite nach aussen
geschoben. Nicht `fixed` am Rahmen: die Leiste ändert ihre Breite beim
Ein- und Ausklappen (`4,5rem` ↔ offen), und ein Element am Rahmen müsste diese
Breite ein zweites Mal kennen. Es käme dieselbe Rechnung an zwei Stellen heraus
— und die zweite wäre die, die jemand vergisst.

Die `<aside>` trägt **kein** `overflow-hidden`; der Scroll-Behälter ist ein
Kind. Der Überhang ist damit möglich. **Zu prüfen bleibt es trotzdem im
Browser** — dieses Repo hat überhängende Elemente schon zweimal eingefangen
(`.fbc-card:hover` über `transform`, der Kopf über `backdrop-filter`), und
jsdom sieht so etwas nie.

### 3. Oben, auf Höhe der Kopfzeile

Donalds Entscheidung. Beide Leisten haben dort eine `h-16`-Zeile, die mit der
Topbar auf einer Linie liegt; der Pill sitzt auf deren Mitte. Das ist der eine
Ort, an dem beide Leisten schon heute dieselbe Höhe haben.

Verworfen — mittig auf halber Leistenhöhe: der Pill stünde neben wechselndem
Inhalt (Navigation links, Threadliste rechts) und läge bei jeder Leiste woanders
im Verhältnis zu dem, was daneben steht.

### 4. Immer sichtbar

Donalds Entscheidung, und sie hat einen zweiten Grund: ein Schalter, der erst
bei Mauskontakt erscheint, ist auf Touch-Geräten gar nicht erreichbar. Man
bräuchte dort ein zweites Verhalten — und wäre wieder bei zwei Bauteilen, aus
denen dieser Vorgang gerade eines macht.

### 5. Die Sprechblase wird zur Anzeige — der Pill ist der einzige Schalter

**Diese Entscheidung ist in der Fremd-Review gekippt worden**, und die Rechnung
dahinter ist einfach genug, dass sie hier stehen muss.

Der erste Entwurf liess die Sprechblase im eingeklappten Rail klickbar:
„eine grosse Fläche, die aussieht wie ein Knopf und nicht reagiert, wäre
schlechter als eine Redundanz." Das stimmt für sich — übersieht aber, **wo** die
beiden dann stünden (codex, HIGH): in derselben `h-16`-Zeile eines Rails von
**4,5 rem** Breite. Zwei Knöpfe, keine 40 px auseinander, die dasselbe tun. Das
ist keine hilfreiche Redundanz mehr, sondern eine Mehrdeutigkeit auf engstem
Raum — und sie widerspricht der Anforderung „**ein** Bedienelement", die dieser
Vorgang gerade aufstellt.

Also: eingeklappt ist die Sprechblase eine **Anzeige** — die Zahl, mit einer
Ansage für Vorlesesoftware, ohne Klickverhalten. Geschaltet wird über den Pill,
der an derselben Stelle steht wie links.

`design-system/spec.md:1372` verlangt vom Rail, dass er Ungelesenes **meldet** —
nicht, dass er es anklickbar macht. Die Zusage bleibt erfüllt.

Was dabei verlorengeht, ist ein grosses Ziel für die Maus. Der Ausgleich ist,
dass der Pill **auf derselben Höhe** sitzt: die Bewegung ist dieselbe, nur ein
paar Pixel weiter nach aussen.

### 5a. Der z-index ist KEIN Problem — gemessen, nicht gehofft

Ein Reviewer meldete HIGH: der Pill könne unter dem klebenden Kopf
verschwinden, „falls dieser z-50 ist". Gemessen in `AppShell.tsx`:

| Element | z-index |
| --- | --- |
| `<header>` (`:711`) | **z-30**, `sticky`, mit `backdrop-blur` |
| linke `<aside>` (`:575`) | **z-40** |
| rechte `<aside>` (`:643`) | **z-40** |

Der Kopf liegt **unter** beiden Leisten. Der Pill als Kind einer `z-40`-Leiste
malt darüber, und das `backdrop-filter` des Kopfes wirkt auf das, was **hinter**
ihm liegt — nicht auf das davor. Der Befund ist damit gegenstandslos.

**Was er richtig streift, ist etwas anderes:** der Pill ragt oben in die Fläche
des Kopfes hinein, und der Kopf trägt rechts Glocke und Profilmenü. Ob der
rechte Pill dort etwas verdeckt oder Klicks abfängt, ist eine **Messung im
Browser**, keine Rechnung — sie steht in den Aufgaben.

### 5b. Vier Pfeilrichtungen, nicht zwei

Die Richtung hängt an **zwei** Achsen: Seite × Zustand (codex, MEDIUM). Ein
Test, der nur den Namen prüft, sieht einen umgedrehten Pfeil nicht.

| | offen | eingeklappt |
| --- | --- | --- |
| links | Pfeil nach **links** (einklappen) | Pfeil nach **rechts** (ausklappen) |
| rechts | Pfeil nach **rechts** (einklappen) | Pfeil nach **links** (ausklappen) |

### 5c. Die Farbe gehört der LEISTE — eine Ausbuchtung, kein Knopf darauf

Hier steht eine Kehrtwende, und sie gehört benannt.

**Der Reviewer verlangte das Gegenteil** (codex, MEDIUM): der Pill solle seine
Farben selbst setzen, sonst sähe eine gemeinsame Komponente an zwei Eltern
verschieden aus. Das wurde gebaut — weisse Fläche, `border-muted` als Rand,
5,0:1 Kontrast, alles gemessen und belegt.

**Donald hat es am Bildschirm gesehen und verworfen** (27.08.):

> „Das ist nicht schön, es soll wie ein Bestandteil der Sidebar hell oder dunkel
> aussehen, gleiche Farben, kein Rand, einfach eine Ausbuchtung."
>
> „Schatten ist es, der Schatten hebt es ab."

Der Reviewer hatte technisch recht und gestalterisch unrecht: „an beiden Leisten
gleich aussehen" war nie das Ziel. Das Ziel ist **an beiden Leisten dieselbe
Geste** — und die Geste ist, dass die Leiste sich wölbt. Eine Wölbung hat
naturgemäss die Farbe dessen, was sich wölbt.

Also: Fläche und Schriftfarbe der **Leiste**, kein Rahmen, und abgehoben wird
über einen **gerichteten Schatten** nach aussen. Der ist nicht Zierde — im
hellen Theme ist die Leiste weiss (`rgb(255,255,255)`) und der Kopf, in den der
Pill oben hineinragt, ebenfalls; ohne Schatten wäre die Wölbung dort unsichtbar.
Gemessen, nicht vermutet.

Weil die rechte Leiste ihre Fläche beim Aufklappen **wechselt** (Chrome-Rail →
Inhaltsfläche), bekommt das Bauteil dafür einen Schalter `flaeche`. Eine feste
Angabe hinterliesse beim Umschalten einen Fleck in der falschen Farbe an ihrer
Kante.

Gemessen nach dem Umbau: im navy-Theme trägt der Pill `rgb(8,21,39)` — **exakt**
die Fläche der Leiste.

### 6. Die Namen sind Anker — und einer davon kollidiert

Gemessen in `AppShell.chatleiste.test.tsx`: die bestehenden Zusagen greifen die
Schalter über ihre **zugänglichen Namen** — `"Navigation einklappen"` (Z. 178,
188) und `/^Nachrichten ausklappen/` (Z. 112). Diese Namen beschreiben die
Handlung, nicht das Bauteil; der Pill erbt sie deshalb unverändert, und die
Zusagen überleben den Umbau, statt ersetzt zu werden.

**Eine Kollision entsteht dabei trotzdem.** Eingeklappt trägt die rechte Leiste
heute die Sprechblase mit dem Namen `"Nachrichten ausklappen, N ungelesen"`.
Bekommt der Pill denselben Namensanfang, treffen `/^Nachrichten ausklappen/`
plötzlich **zwei** Elemente, und `queryByRole` wirft „multiple elements" — der
Test fällt an einer Mehrdeutigkeit, nicht an einem Fehler.

Aufgelöst über den Namen der Sprechblase, nicht über den des Pills: sie führt
ab jetzt mit ihrer eigentlichen Aussage, der **Zahl**, und nennt das Ausklappen
danach. Das ist ohnehin die bessere Ansage — ihre erste Aufgabe ist der Zähler.

| | vorher | nachher |
| --- | --- | --- |
| Pill rechts | — | `Nachrichten ausklappen` |
| Sprechblase | `Nachrichten ausklappen, 3 ungelesen` | `3 ungelesene Nachrichten, Leiste ausklappen` |

### 7. Die untere Zeile links fällt weg, die Feedback-Zeile nicht

Der Einklapp-Knopf unten links entfällt — er ist es ja, der ersetzt wird. Die
**Feedback**-Zeile darüber bleibt: sie kam in AGE-566 dorthin, weil der Knopf
vorher über dem Inhalt schwebte und auf der Startseite den Aufruf „Mitglieder
entdecken" halb zudeckte. Dieser Grund gilt unverändert.

### 8. Was der Pill für die Spec bedeutet

`design-system/spec.md:262` sagt über die Leisten: „never rounded or floating".
Ein gerundeter, überhängender Pill sieht auf den ersten Blick aus wie ein Bruch
— und wird ohne ausgesprochene Abgrenzung von der nächsten Person als einer
gelesen und „repariert".

Die Abgrenzung: der Satz gilt der **Leiste als Fläche** — sie bleibt bündig,
volle Höhe, ungerundet. Der Pill ist ihr **Bedienelement**, nicht ihre Kante.
Das gehört in die Spec geschrieben, nicht in einen Kommentar.

## Sicherheit (cso)

Reine Darstellung. Kein Datenzugriff, keine neue Route, kein Recht. Die einzige
Grenze in der Nähe ist die, dass beide Leisten nur angemeldet rendern
(`design-system/spec.md:283`) — daran ändert dieser Vorgang nichts.
