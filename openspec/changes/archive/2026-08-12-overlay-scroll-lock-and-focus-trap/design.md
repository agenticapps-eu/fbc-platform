# Design — ein Hook für Sperre und Falle

## Warum ein Hook und kein `<Dialog>`-Primitiv

Das naheliegende Gegenmodell wäre eine Komponente: `<Dialog open>…</Dialog>`,
die Markup, Scrim, Sperre und Falle zusammen mitbringt. Sie wäre auf Dauer das
bessere Haus — und ist hier trotzdem falsch, aus einem Grund:

**Die vier Overlays haben vier verschiedene Markups.** Die Lightbox portalt an
`document.body` und muss das auch (`.fbc-card:hover` setzt einen `transform`,
der jedes `position: fixed` darunter einfängt — gemessen 847×615 statt
1280×900). Die Navigation ist eine Schublade mit `inset-y-0 left-0 w-72`. Das
Feedback-Panel ist unter `sm` ein Bogen von unten und darüber eine Karte rechts
unten. Der Cropper ist ein zentrierter Kasten mit einem Canvas, in dem gezogen
wird.

Ein Primitiv, das alle vier trägt, ist entweder eine Sammlung von Sonderfällen
oder ein Umbau aller vier Markups. Beides ist mehr, als das Issue verlangt, und
das Issue sagt es selbst: „Kein neues Primitiv, kein Umbau am Markup."

Ein Hook nimmt genau das Verhalten, das allen vier fehlt, und lässt das Markup
in Ruhe. Wenn später ein Primitiv entsteht, benutzt es diesen Hook.

## Die Signatur

```ts
useOverlay<T extends HTMLElement = HTMLDivElement>(aktiv: boolean): RefObject<T | null>
```

**Generisch, nicht `HTMLElement`** — aus dem Plan-Review. Unter den installierten
React-19-Typen (`react` 19.2.8, `@types/react` 19.2.18) ist ein
`RefObject<HTMLElement | null>` nicht an das `ref` eines `<div>` zuweisbar;
`RefObject` ist in `current` invariant. Alle vier Container sind `<div>`, daher
die Vorgabe — der Typparameter kostet nichts und hält den Hook offen.

Ein Rückgabewert, ein Argument. Der Ref geht an den Overlay-Container; daran
hängt die Fokus-Falle. Die Sperre braucht ihn nicht, aber zwei Hooks
nebeneinander wären zwei Anschlüsse pro Overlay statt einem — und die Abnahme
verlangt ausdrücklich **einen** Hook.

## Die Sperre: warum `position: fixed` und nicht `overflow: hidden`

`body { overflow: hidden }` ist die verbreitete Fassung und auf iOS Safari
wirkungslos: der Seiteninhalt scrollt weiter, weil dort das visuelle Viewport
unabhängig läuft. Die Fassung, die hält:

```
body.style.position = "fixed"
body.style.top      = `-${scrollY}px`
body.style.left     = "0"
body.style.right    = "0"
```

`left`/`right` müssen mit, sonst kollabiert der Body auf seine Inhaltsbreite,
sobald er aus dem Fluss genommen wird — die Seite ruckt seitlich.

**Und die Rückgabe ist der eigentliche Punkt.** `position: fixed` setzt den
Dokument-Scroll auf 0. Wer beim Schließen nur die Stile entfernt, landet am
Seitenanfang — das ist schlechter als heute, wo man wenigstens an der falschen,
aber selbst gescrollten Stelle steht. Also wird die Position vor dem Sperren
gemerkt und danach mit `window.scrollTo(0, y)` exakt wiederhergestellt.

**Fremde Inline-Stile werden gesichert, nicht überschrieben** (Plan-Review). Ein
global wiederverwendbarer Hook, der beim Freigeben `position`, `top`, `left`
und `right` pauschal leert, zerstört, was ein anderer dort gesetzt hat. Beim
Übergang 0 → 1 werden die vier Werte gemerkt und beim Übergang 1 → 0 exakt
zurückgeschrieben.

### Was hier NICHT nötig ist: Ausgleich für die Scrollbar-Breite

Der übliche Begleitschritt — `padding-right` in Scrollbalken-Breite, damit die
Seite beim Sperren nicht seitlich springt — **entfällt in diesem Projekt**.
`src/index.css:187` setzt `scrollbar-gutter: stable` auf `html`, und der
Kommentar dort nennt den Anlass beim Namen (AGE-237: „springt herum"). Der
Platz ist reserviert, ob ein Balken da ist oder nicht; ein zusätzliches
`padding-right` würde erst einen Sprung erzeugen. Der Plan-Review hat das als
HIGH gemeldet — zu Recht im Allgemeinen, hier durch eine bestehende
Entscheidung bereits erledigt.

## Die Zählung und der Stapel

Zwei gleichzeitig offene Overlays sind kein Gedankenspiel — das Feedback-Panel
liegt im AppShell und ist auf jeder Seite erreichbar, auch bei offener
Lightbox. Der Hook führt deshalb **einen Modulstapel**, keinen Schalter und
keinen bloßen Zähler:

- **Die Sperre** hängt an der Stapeltiefe: nur 0 → 1 sperrt, nur 1 → 0 gibt
  frei. Die gemerkte Position und die gesicherten Stile gehören dem ersten
  Sperrer.
- **Die Falle** hängt an der Stapelspitze: **nur das oberste Overlay behandelt
  Tab.** Ohne diese Regel behandelten zwei aktive Fallen denselben Tastendruck
  und rissen den Fokus gegeneinander (Plan-Review, HIGH). Schließt das oberste,
  übernimmt das darunterliegende.

Der Stapel steht **im Modul**, nicht in einem Ref: er muss über
Komponentengrenzen hinweg derselbe sein, und genau das kann ein Ref nicht.

## Die Falle: Tab fangen, Fokus nicht stehlen

Der Hook hört auf `keydown` und behandelt **nur** Tab. Drei Fälle, nicht zwei:

1. Fokus auf dem **letzten** Knoten im Container, Tab → erster Knoten.
2. Fokus auf dem **ersten** Knoten, Shift-Tab → letzter Knoten.
3. **Fokus außerhalb des Containers**, Tab → erster Knoten (Shift-Tab →
   letzter).

Fall 3 kam aus dem Plan-Review und ist der wichtigste: **drei der vier Overlays
versetzen den Fokus beim Öffnen gar nicht.** Bei Navigation, Cropper und
Feedback-Panel steht er also hinter dem Dialog, und eine Falle, die nur an den
Rändern des Containers umlenkt, griffe dort nie — die Zusage „hält den Fokus"
wäre erneut eine, die der Code nicht einhält.

**Beim Öffnen bewegt der Hook den Fokus trotzdem nicht.** Die Lightbox tut das
selbst und begründet es: stünde es im Effekt, der bei jedem Bildwechsel läuft,
risse jeder Wechsel den Fokus zurück auf „Schließen". Fall 3 fängt die anderen
drei beim **ersten Tastendruck** ein, ohne beim Öffnen einzugreifen.

Beim **Schließen** gibt der Hook den Fokus an das Element zurück, das vor dem
Öffnen aktiv war — mit zwei Vorsichtsmaßnahmen aus dem Review:

- **Nur wenn es noch im Dokument hängt** (`isConnected`). Ein Auslöser kann
  verschwinden, während das Overlay offen ist.
- **`focus({ preventScroll: true })`**, und **nach** dem Wiederherstellen der
  Scroll-Position. Ein gewöhnliches `focus()` scrollt das Element in den Blick
  und verschöbe genau die Position, die eine Zeile vorher „exakt"
  wiederhergestellt wurde.

### Was „fokussierbar" heißt — und wo diese Definition endet

`a[href]`, `button`, `input`, `select`, `textarea`, `[tabindex]` — jeweils ohne
`disabled`, ohne `tabindex="-1"` und ohne `input[type="hidden"]`.

Der Review verlangte zusätzlich, unsichtbare Knoten (versteckte Vorfahren,
`display: none`) auszufiltern. **Das wird bewusst nicht getan**, und der Grund
ist prüfbar: die einzigen Wege dahin sind `offsetParent`, `getClientRects()`
oder `checkVisibility()` — in jsdom liefert das erste immer `null`, das zweite
immer eine leere Liste. Ein Sichtbarkeitsfilter machte in den Tests **jeden**
Knoten unfokussierbar und die Falle damit zu einer Attrappe, die grün ist. Der
Preis ist benannt: enthält ein Overlay einen versteckten Knopf, kann der Umlauf
ihn treffen. Keines der vier tut das heute.

Enthält ein Overlay gar nichts Fokussierbares, tut der Hook nichts. Einen
Container mit `tabindex="-1"` zu erfinden, wäre der Markup-Umbau, den das Issue
ausschließt.

## Der Anschluss, der eine Falle hat: die Off-Canvas-Navigation

`AppShell.tsx:444` rendert die Schublade unter `{mobileNavOpen && …}` und
versteckt sie ab `lg` **nur per CSS** (`lg:hidden`). Wer sie auf dem Telefon
öffnet und das Fenster über `lg` zieht, hat sie unsichtbar, aber
`mobileNavOpen` bleibt `true` — mit dem Hook daran wäre der Body **dauerhaft
gesperrt**, ohne sichtbaren Grund. Einen Resize-Wächter gibt es dort nicht; der
einzige Effekt (`:287`) behandelt Escape.

Deshalb gehört zu diesem Change eine Zeile, die das Issue nicht vorsah: beim
Überschreiten von `lg` schließt die Navigation. Das ist keine Kosmetik, sondern
die Bedingung dafür, dass die Sperre dort überhaupt angeschlossen werden darf.

## Der Anschluss mit der Hook-Regel: das Feedback-Panel

`FeedbackButton.tsx:35` steht ein `if (!user) return null;` **nach** den
`useState`-Aufrufen. Ein `useOverlay(open)` dahinter verletzt die Hook-Regeln,
sobald sich der Anmeldezustand ändert. Der Hook wird deshalb **vor** dem frühen
Rückgabewert gerufen und mit `Boolean(user) && open` aktiviert — dann kann auch
ein Sitzungsverlust bei offenem Panel keine aktive Sperre ohne sichtbares
Overlay hinterlassen.

## Der Feedback-Knopf: `sm:fixed` statt `fixed`

Er wird in `AppShell.tsx:469` **nach** `<main>` gerendert. Nimmt man ihm unter
`sm` das `fixed`, fällt er von selbst ans Ende des Dokumentflusses — „am
Seitenende" ist also keine neue Position, sondern die, die er ohne `fixed`
ohnehin hätte. Kein Umzug in die Navigation, kein neuer Montagepunkt.

Nebenbefund, **nicht** in diesem Change: der Kommentar an `bottom-20`
begründet den Abstand mit dem DesignSwitcher, der „bei bottom-4 rechts unten
sitzt". Der ist seit AGE-492 nicht mehr gemountet, `bottom-20` weicht also
einem Knopf aus, den es nicht gibt. Eigene Zeile, eigenes Issue — hier wäre es
Beifang.

## Wie das rot werden kann

- **Sperre:** `window.scrollY` auf 600, Hook aktiv → `body.style.position` ist
  `fixed`, `top` ist `-600px`. Heute ist beides leer.
- **Rückgabe:** beim Lösen sind die Stile auf ihren **Ausgangswerten** und
  `window.scrollTo` wurde mit `(0, 600)` gerufen — als Spion belegt, weil jsdom
  nicht wirklich scrollt. **Die wichtigste Zeile des Changes:** ohne sie ist
  die Sperre schlechter als keine.
- **Fremde Stile:** mit vorbelegtem `body.style.top` sperren und lösen → der
  Ausgangswert steht wieder da.
- **Stapel:** zwei Sperren, eine gelöst → weiterhin gesperrt. Zwei Fallen, Tab
  → nur die obere lenkt um.
- **Falle, Fall 3:** Fokus außerhalb, Tab → erster Knoten im Overlay.
- **Fokus-Rückgabe:** Knopf außerhalb fokussiert, Overlay auf und zu → Knopf
  hat ihn wieder; ein inzwischen entfernter Auslöser bricht nichts.
- **Je Overlay:** nicht nur „Body gesperrt", sondern **ein Fokusumlauf** — nur
  der beweist, dass der Ref auch am Container hängt. Ein Anschluss, der den
  Hook ruft und den Ref vergisst, wäre sonst grün (Plan-Review, MEDIUM).
- **Knopf unter `sm`:** die Klassenliste trägt `sm:fixed` und **kein** nacktes
  `fixed`. Schwächer als ein Layouttest — jsdom hat kein Layout und kennt keine
  Breakpoints. Die echte Messung steht in der Abnahme und braucht einen Browser.

## Was diese Sitzung nicht beweisen kann

Die iPhone-Sichtprobe. jsdom hat kein Layout, kein Safari und kein visuelles
Viewport — dass die Seite hinter dem Overlay wirklich stillsteht und beim
Schließen nicht springt, ist am Gerät zu sehen und nirgends sonst. Der Test
belegt, dass die richtigen Stile gesetzt und die richtige Position
wiederhergestellt wird; dass Safari sich daran hält, belegt er nicht.
