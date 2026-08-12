# Diff review — overlay-scroll-lock-and-focus-trap

Stufe 2: ein unabhängiger Leser auf dem **Diff**, nicht auf dem Plan. Anderer
Vendor als der eigene.

## Reviewer: codex (gpt-5.2-codex)

VERDICT: REQUEST-CHANGES

[HIGH] `useOverlay.ts` — Der Hook nehme an, `document.activeElement` sei der
Auslöser. Bei Zeigerbedienung gelte das nicht; Safari lasse den Fokus auf dem
`body`. Fix: den Auslöser durchreichen.

[MEDIUM] `useOverlay.ts` — Die Aufräumung gebe den Fokus auch dann zurück, wenn
ein **nicht oberstes** Overlay schließt, und risse ihn damit aus dem noch
sichtbaren oberen heraus. Der Stapeltest schließe nur in LIFO-Reihenfolge und
prüfe Scrollen, nicht Fokus.

[LOW] `useOverlay.test.tsx` — Der Rückgabetest belege nur `activeElement`,
weder `preventScroll` noch die Reihenfolge gegenüber `scrollTo`. Beide Zusagen
könnten still zurückfallen.

## Resolution

**[MEDIUM] übernommen.** Der Fall trägt: `stapel` wurde bisher nur für Sperre
und Tab-Besitz gelesen, nicht für die Fokus-Rückgabe. Rot zuerst — neuer Test
„reißt den Fokus nicht aus einem noch offenen oberen Overlay", der mit dem
alten Stand fiel —, dann `warOben` in der Aufräumung. Mutationsgeprüft: nimmt
man die Bedingung wieder heraus, fällt genau dieser Test.

**[LOW] übernommen.** Neuer Test mit Spion auf `focus` des Auslösers: er prüft
das Argument `{ preventScroll: true }` **und** die Reihenfolge
`["scrollTo", "focus"]`. Beim Schreiben fiel auf, dass die erste Fassung ins
Leere prüfte — der Spion war vor dem echten `focus()` gesetzt, also merkte sich
der Hook `document.body` als Auslöser. Mutationsgeprüft: ohne `preventScroll`
fällt der Test.

**[HIGH] nicht übernommen — begründet.** Der Befund stimmt sachlich: Safari
fokussiert eine Schaltfläche beim Zeigerklick nicht, `vorher` ist dort `body`,
und die Rückgabe entfällt still. Drei Gründe, es trotzdem so zu lassen:

1. **Der Rückfall ist der heutige Zustand.** Ohne diesen Change gibt kein
   Overlay den Fokus zurück. Auf Safari mit der Maus bleibt es dabei — es wird
   nichts schlechter, nur an einer Stelle nicht besser.
2. **Wo die Rückgabe zählt, greift sie.** Sie ist eine Tastatur-Zusage, und bei
   Tastaturbedienung ist der Auslöser fokussiert — auch in Safari. Wer mit der
   Maus klickt, merkt von einer fehlenden Fokus-Rückgabe nichts.
3. **Der Preis wäre API-Umbau.** Den Auslöser durchzureichen hieße, alle vier
   Anschlüsse um einen zweiten Ref zu erweitern und jede aufrufende Stelle zu
   ändern — für einen Fall, dessen Fehlerbild „genau wie vorher" lautet.

Die Grenze steht jetzt als Kommentar an der Stelle im Code, an der sie gilt,
statt in dieser Datei zu verschwinden. Wenn die iPhone-Sichtprobe (Aufgabe 4.5)
zeigt, dass es in der Praxis stört, ist der Umbau ein eigenes Issue mit einem
gemessenen Anlass.
