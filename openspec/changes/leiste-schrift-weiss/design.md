# Design — die Schrift der linken Leiste

## Entscheidung 1: Eigene Token, nicht `--color-on-chrome` umlegen

`--color-on-chrome` im navy-Block auf `#FFFFFF` zu setzen wäre ein Einzeiler und
wäre falsch. Gemessen, nicht geschätzt — wer liest `text-on-chrome` und
`text-on-chrome-muted`:

| Datei                                | Stellen |
| ------------------------------------ | ------- |
| `src/pages/WillkommenPage.tsx`       | 22      |
| `src/pages/OnboardingPage.tsx`       | 17      |
| `src/components/ui/SidebarNav.tsx`   | 3       |
| `src/components/feedback/FeedbackButton.tsx` | 1 |
| `src/components/LeistenPill.tsx`     | 1       |
| `src/components/ui/Button.tsx`       | 1       |
| `src/components/AppShell.tsx`, `ui/Logo.tsx` | je 1 (nur `-active`) |

Zwei Vollseiten und `Button variant="secondary"` würden mitgefärbt. Der
sekundäre Knopf ist zusätzlich ein **offener** Gestaltungspunkt (Donald, 06.10.,
„diese dunklen Buttons") — ihn hier als Nebenwirkung zu entscheiden, wäre eine
Entscheidung an der falschen Stelle.

Also dasselbe Vorgehen wie bei `--leiste-focus` und `--leiste-badge` in
AGE-1003: zwei eigene Token, die ausschliesslich Elemente der Leistenfläche
lesen.

- `--leiste-ink` — auf `@theme` **genau** `#475569`, im navy-Block `#FFFFFF`
- `--leiste-ink-muted` — auf `@theme` **genau** `#64748B`, im navy-Block `#B9CCE6`

Die `@theme`-Werte sind zeichengleich mit den heutigen `--color-on-chrome` und
`--color-on-chrome-muted`. Damit ist „im hellen Modus ändert sich nichts" keine
Behauptung, sondern eine Zusage, die ein Test Wert für Wert nachprüfen kann.

**Verworfen:** `--leiste-ink` auf `var(--thread-ink)` zeigen zu lassen. Die
`--thread-*`-Token sitzen auf `.fbc-chat-rail` und nicht auf `html`; ein Element
der linken Leiste liegt nicht in diesem Teilbaum und bekäme den Rückfallwert.
Dass beide Leisten dieselbe Zahl tragen, ist eine Absicht — keine Ableitung.

## Entscheidung 2: Zwei Token, nicht eines

Die Nachrichtenleiste führt zwei Töne: `--thread-ink` (`#FFFFFF`) für Namen und
Kopfzeile, `--thread-muted` (`#B9CCE6`) für Vorschau und Uhrzeit. Die linke
Leiste hat dieselbe Rangfolge — Abschnittsmarke über Menüeintrag —, also
bekommt sie beide Töne. Ein einziger weisser Ton für beides löschte die
Rangfolge, und die Marken schrien dann lauter als die Einträge, die sie ordnen.

## Entscheidung 3: Die Hover-Schrift bleibt stehen, obwohl sie im Dunkeln wirkungslos wird

`SidebarNav`, `FeedbackButton` und `LeistenPill` tragen heute
`hover:text-on-chrome-active`. Im navy-Modus ist `--color-on-chrome-active`
`#FFFFFF` — also derselbe Wert, auf dem `--leiste-ink` künftig steht. Der
Schriftwechsel beim Überfahren wird dort **wirkungslos**.

Er bleibt trotzdem stehen, aus zwei Gründen. Im **hellen** Modus wechselt er
weiter von `#475569` auf `#1F53B0` und ist dort das Hauptmerkmal. Und im
dunklen Modus übernimmt die Fläche: `--color-chrome-elevated` hebt sich mit
1,15:1 kaum ab, aber genau so arbeitet die Leiste rechts auch
(`--thread-hover` ist Weiss zu 6 %). Parität war die Vorgabe.

Eine eigene `--leiste-ink-hover` einzuführen wäre ein drittes Token für einen
Wert, der in beiden Modi genau `--color-on-chrome-active` ist. Kein Token für
keinen Unterschied.

## Entscheidung 4: Die Symbolform traegt den eingeklappten Zustand — und sie wird dafuer erst vollständig gemacht

Das ist die Folge, die nicht nach Farbe aussieht, und sie hat die Umsetzung
verändert. `NavIcon` nimmt **keine** Farbe an; es erbt `currentColor` von der
Textklasse seines Links. Die Merkmale des aktiven Eintrags, je Zustand:

|                                       | vorher aufgeklappt | vorher eingeklappt | nachher aufgeklappt | nachher eingeklappt |
| ------------------------------------- | ------------------ | ------------------ | ------------------- | ------------------- |
| halbfette Beschriftung                | ja                 | nein               | ja                  | nein                |
| weisser Linksbalken                   | ja                 | nein               | ja                  | nein                |
| Symbolfarbe `#FFFFFF` statt `#9FB4D2` | ja                 | **ja**             | **nein**            | **nein**            |
| Symbolform `solid` statt `line`       | ja                 | ja                 | ja                  | ja                  |

Eingeklappt sinkt die Zahl der zählenden Merkmale von zwei auf eines. Die Norm
hält — 1.4.1 verlangt, dass Farbe nicht das **einzige** Mittel ist, und eine
Form ist kein Farbmittel. Die Leiste rechts macht denselben Tausch: alle Namen
stehen dort auf `--thread-ink`, der aktive Faden ist allein an seiner Fläche
erkennbar.

### Und dann hat die Messung einen bestehenden Mangel aufgedeckt

Die Tabelle oben setzt voraus, dass jedes Symbol der Leiste eine gefüllte
Fassung **hat**. Gemessen hatten es **neun von zwölf**:

| Eintrag              | Glyph             | gefüllte Fassung |
| -------------------- | ----------------- | ---------------- |
| `/hilfe/tutorials`   | `bulb`            | **nein**         |
| `/admin/mitglieder`  | `dot` (Rückfall)  | **nein**         |
| `/admin/feedback`    | `dot` (Rückfall)  | **nein**         |

Für diese drei war der aktive Zustand eingeklappt **schon vorher** allein an der
Symbolfarbe erkennbar — also allein an Farbe, und genau das verbietet die
bestehende Anforderung „Farbe trägt nie allein eine Bedeutung". Der Kopf von
`MASSIV` in `ui/icons.tsx` verspricht ausdrücklich das Gegenteil: „Das trägt die
Auswahl auch dann, wenn die Leiste eingeklappt ist und kein Label danebensteht."

AGE-1003 hat diesen Mangel nicht gesehen, weil seine Tabelle die Symbolform als
gegeben annahm. Sichtbar wurde er erst, als diese Änderung das andere Merkmal
wegnahm: aus „allein an der Farbe" wäre „an nichts" geworden.

**Deshalb gehört die Reparatur in diesen Change und nicht in einen nächsten.**
Ohne sie wäre die Änderung nicht nur eine Verringerung, sondern für drei
Einträge ein Ausfall. Zwei Glyphen bekommen eine gefüllte Fassung: `bulb` und
`dot`. `dot` ist der **Rückfall** von `NavIcon` für jeden Pfad ohne eigenes
Symbol — damit gilt die Zusage auch für jede Route, die noch niemand gezeichnet
hat. Robust gebaut statt daran erinnert.

### Warum die Messung zuerst falsch war, und was daran zu lernen ist

Die erste Zählung lief über `navItems` und meldete **keine** Lücke. Alle drei
Lücken lagen in der zweiten Quelle: „Meine Anfragen", „Support" und
„Administration" hängt `AppShell` selbst ein, sie stehen nicht in `navItems`.
Dieselbe Lektion wie bei den zwanzig Aufrufstellen in AGE-1001 — *die Wurzeln
nennen, nicht nur die Ebenen*. Der Wächter in `SidebarNav.active.test.tsx`
leitet seine Liste deshalb aus **beiden** Quellen ab, und eine Positivkontrolle
hält fest, dass die Liste nicht leer ist.

Gegengeprobt wurde der Wächter, statt ihm zu glauben: mit den alten Glyphen
fällt er mit genau drei Fehlschlägen aus, benannt nach den drei Pfaden.

### Drei andere Auswege, gerechnet und verworfen

1. **Inaktive Einträge auf `#B9CCE6` statt `#FFFFFF`.** Hielte das
   Farbmerkmal — und wäre nicht, was gefragt war („weiss, gleicher Farbcode").
2. **Die Aktivfläche über 3:1 heben.** `#1F53B0` trägt 2,00:1 gegen `#002B51`.
   Das Fenster, in dem eine Füllung gleichzeitig 3:1 gegen die Leiste und
   4,5:1 für weisse Schrift hält, ist schmal: `#3570D8` schafft 3,05:1 und
   4,71:1, beides knapp. Eine Schwelle mit 0,05 Reserve ist keine Zusage, und
   die Leiste sähe sichtbar anders aus als gefragt war. Ausserdem erklärt
   AGE-1003 die Füllung ausdrücklich zur Dekoration — sie zum Signal zu
   befördern, wäre eine grössere Entscheidung als diese.
3. **Den Linksbalken auch eingeklappt zeigen.** Kehrt eine ausdrückliche
   Entscheidung aus AGE-1003 um („neben einem zentrierten Icon in einer
   schmalen Leiste liest er sich als Rand, nicht als Marke").

## Was ausserhalb bleibt

`--color-on-chrome` (`#9FB4D2`) und `--color-on-chrome-muted` (`#8FA5C4`)
behalten ihre navy-Werte unverändert. Nach dieser Änderung färben sie die beiden
Vollseiten und den sekundären Knopf — nicht mehr die Leiste. Der Kommentar im
`@theme`-Block, der sie der Leiste zuschreibt, wird damit falsch und wird
mitgezogen; genau so ein Kommentar hat bei AGE-1003 eine Messung in die falsche
Richtung geschickt.
