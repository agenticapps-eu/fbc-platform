# Tasks — ein Pill für beide Leisten (AGE-638)

## 1. Das Bauteil

- [x] **RED**: Test — der Pill trägt einen Namen, der die **Handlung** und die
      Leiste nennt, und wechselt ihn beim Auslösen. Ein Test, der nur „ein Knopf
      ist da" prüft, bliebe nach jedem Umbau grün und sagte nichts.
- [x] **RED**: Test — die **vier** Pfeilrichtungen: Seite × Zustand. Nur der
      Name geprüft, bliebe ein umgedrehter Pfeil unsichtbar.
- [x] **RED**: Test — `aria-expanded` folgt dem Zustand, und der Pill ist ein
      echtes `button`.
- [x] `LeistenPill` in `src/components/` — `seite: "links" | "rechts"`,
      gespiegelte Rundung und Verschiebung, **eigene** Farbtokens (nicht vom
      Elternteil geerbt).

## 2. Links: die untere Zeile fällt weg

- [x] **RED**: Test — die Navigationsleiste trägt **keine** untere
      Einklapp-Zeile mehr, und der Feedback-Zugang steht weiterhin da.
      Positivkontrolle zur Verneinung: ohne sie wäre der Test auch grün, wenn
      die ganze Leiste fehlte.
- [x] Untere Einklapp-Zeile aus `AppShell.tsx` entfernen, Pill oben montieren.

## 3. Rechts: Pill dazu, alter Knopf weg, Sprechblase wird Anzeige

- [x] **RED**: Test — die Kopfzeile der aufgeklappten rechten Leiste trägt
      **keinen** eigenen Einklapp-Knopf mehr. Ohne diese Verneinung bestünde
      der Test auch dann, wenn beide Schalter nebeneinander stünden — und
      genau das wäre das Gegenteil des Ziels.
- [x] **RED**: Test — eingeklappt ist die Sprechblase **kein Knopf** mehr,
      ihre Zahl aber weiterhin ablesbar und angesagt.
- [x] Namenskollision auflösen: die Sprechblasen-Ansage führt mit der **Zahl**
      (`3 ungelesene Nachrichten`), damit `/^Nachrichten ausklappen/` weiterhin
      **genau ein** Element trifft — den Pill.
- [x] Pill an der rechten Leiste montieren, gespiegelt; alten Knopf entfernen.

## 4. Regression — bestehende Zusagen, die grün bleiben müssen

Ausdrücklich **kein RED**: diese Tests stehen schon und sind heute grün. Sie
sollen den Umbau überleben, nicht ihn treiben.

- [x] `AppShell.chatleiste.test.tsx` läuft unverändert durch: beide Leisten
      merken sich getrennt (`fbc.sidebarCollapsed` / `fbc.chatCollapsed`), das
      Einklappen der einen nimmt die andere nicht mit, im Band zwischen
      1024 und 1280 px ist links angedockt und rechts eine Schublade.

## 5. Belege — der Teil, den jsdom nicht kann

- [x] **Umbruchpunkte beidseitig** gemessen: **1023 / 1024 px** und
      **1279 / 1280 px**. Unterhalb steht die jeweilige Leiste nicht — und in
      **keiner** der beiden Schubladen darf ein Pill auftauchen.
- [x] Ragt der Pill wirklich über die Kante? Dieses Repo hat überhängende
      Elemente schon zweimal eingefangen (`.fbc-card:hover` über `transform`,
      der Kopf über `backdrop-filter`).
- [x] **Verdeckt der rechte Pill etwas im Kopf?** Er ragt oben in dessen Fläche,
      und dort stehen Glocke und Profilmenü. Klick auf beide, gemessen.
- [x] Zustandsmatrix im Browser: beide Leisten × offen/eingeklappt × **beide
      Themes** (hell und navy). Der Pill ist im navy-Theme weiss auf
      `rgb(8,21,39)` — gemessen, nicht geschätzt.
- [x] Tastaturprobe: der Pill ist ein echtes `<button type="button">` mit
      `tabIndex 0`, `focus()` greift.
      **Nicht gemessen: das Auslösen selbst per Enter und Leertaste.** Ein
      synthetisches `KeyboardEvent` löst bei einem Knopf nichts aus — das ist
      Browserverhalten, das nur eine echte Tastatureingabe erreicht. Die
      Behauptung „mit Enter auslösbar" stünde hier also unbelegt; belegt ist,
      dass es ein Knopf ist, für den der Browser dieses Verhalten mitbringt.
- [ ] **Offen: der mehrstellige Ungelesen-Zähler im Browser.** Gemessen wurde
      er nur im Test (`3`). Ob eine zweistellige Zahl den Rail sprengt, ist im
      Browser nicht geprüft — der lokale Stack hat keine Nachrichten.
- [x] `pnpm test`, `pnpm lint`, `tsc --noEmit`, `vite build` mit gesetzten
      `VITE_*`-Variablen (ohne sie baut es 236 kB ohne App-Code und meldet 0).
