# Die Nachrichtenleiste ist im dunklen Modus dunkelblau

Linear: **AGE-1002**

## Why

Detlev hat im Meeting am 03.10. eine konkrete Farbe benannt: die **ausgeklappte**
Nachrichtenleiste rechts soll im dunklen Modus dunkelblau sein — nicht das sehr
dunkle `#081527` der linken Navigation, sondern das Blau der
DK-Real-Invest-Website. Gemessen in deren Elementor-CSS (`post-12.css`,
Fussbereich und Flächen): **`#002B51`**. SPEC 12 §5 (V5 FINAL) führt dieselbe
Forderung als „dieselbe dunkel/blaue Grundwirkung wie die linke Navigation", und
die Go-live-Checkliste führt sie unter A10.

Heute ist die Leiste **zweifarbig**, und das war eine bewusste Entscheidung:
eingeklappt trägt sie `fbc-sidebar-surface` (also Chrome, im dunklen Modus
`#081527`), ausgeklappt `bg-canvas` (weiss). Der Grund steht im Code und ist
gemessen: ausgeklappt trägt sie eine **Liste**, und `ThreadList` schreibt in
`text-ink` auf `hover:bg-soft` — auf dunkler Fläche unlesbar. Vor der
Fallunterscheidung stand im dunklen Modus ein navyer Kopf über einer weissen
Liste.

Damit ist das Problem benannt: die Farbe zu setzen ist ein Einzeiler, die
**Lesbarkeit** ist die Arbeit.

## What Changes

- Die Nachrichtenleiste rechts ist im dunklen Modus dunkelblau (`#002B51`) —
  eingeklappt wie ausgeklappt, also durchgehend eine Fläche.
- Alles darin bleibt lesbar: Namen, Vorschautexte, Zeitstempel, das
  Ungelesen-Abzeichen, der aktive Gesprächspartner und der Zustand unter dem
  Mauszeiger. Die Kontraste sind ausgerechnet und liegen über dem, was die
  Barrierefreiheits-Norm verlangt.
- Im hellen Modus ändert sich **nichts** — die Leiste bleibt dort weiss, wie die
  linke Navigation.
- Die Chat-Fenster und die Seite „Nachrichten" bleiben in beiden Modi hell.

Im Einzelnen:

**Ein Token, zwei Modi.** `--chat-rail-surface` in `src/index.css`: `:root` den
heutigen hellen Wert, `html[data-variant="navy"]` `#002B51`. Die Klasse
`.fbc-chat-rail` bezieht ihn. Damit entfällt die Fallunterscheidung in
`AppShell.tsx` zwischen eingeklappt und ausgeklappt.

**Textfarben als Leisten-Tokens, nicht als Komponentenschalter.** `ThreadList`
und die Kopfzeilen lesen `--thread-ink`, `--thread-muted`, `--thread-hover`,
`--thread-active`, `--thread-line`, `--thread-badge`, `--thread-badge-ink`. Die
fallen auf `:root` auf die heutigen Inhaltsfarben zurück und werden
**ausschliesslich innerhalb von `.fbc-chat-rail`** überschrieben. `ThreadList`
bekommt deshalb **keinen** Variantenschalter und keine zweite Fassung: auf
`/chat` gilt weiter, was dort gilt.

**Die linke Navigation bleibt `#081527`.** Sie nachzuziehen ist die offene Frage
E7 an Detlev; fällt sie mit Ja aus, ist es dann ein Einzeiler in `--sidebar-surface`.

## Was NICHT Teil dieses Changes ist

- Die linke Navigation (Frage E7 an Detlev).
- `ChatFenster`, `ChatFensterReihe` und die Seite `/chat` — sie bleiben hell.
- Ein dunkler Lesemodus für Inhalte. `navy` ist seit AGE-492 eine Markenvariante
  des Rahmens und kein Nachtmodus; diese Zusage bleibt unberührt.

## Capabilities

### New Capabilities

*(keine)*

### Modified Capabilities

- `design-system`: Die rechte Leiste wechselt ihre Fläche beim Aufklappen
  **nicht mehr**. Die bestehende Anforderung zum Pill führt genau diesen Wechsel
  als Tatsache („die rechte tut das beim Aufklappen") und verlangt, dass der
  Pill mitwechselt — das muss nachgezogen werden. Dazu die neue Zusage, dass
  alles in der Leiste auf ihrer Fläche lesbar bleibt, mit ausgerechneten
  Kontrasten.

## Impact

`src/index.css` (Tokens und `.fbc-chat-rail`), `src/components/AppShell.tsx`
(Fallunterscheidung entfällt, Kopfzeilen auf Leisten-Tokens),
`src/components/chat/ThreadList.tsx` (Farbklassen auf Leisten-Tokens),
`src/components/AppShell.chatleiste.test.tsx` (erweitert).

**Nicht betroffen:** die Rechte aus AGE-1000, der Chat selbst, `/chat`, die
Chat-Fenster, die linke Navigation.
