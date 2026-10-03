# Change review — chatleiste-blau

## Keine Fremdreviewer, und warum

Donalds Regel vom 26.08.2026: **Fremdreviewer nur bei Schema, Rechten oder
Sicherheit — reines UI direkt bauen.** Dieser Change ändert CSS-Tokens und
Klassennamen; er fasst keine Migration, keine Policy, keine RPC und keinen
Rechteweg an. `openspec validate --all` ist grün (37/37).

Das ist ein **Verzicht mit Begründung**, keine Auslassung. Zum Vergleich: der
unmittelbar vorangehende Change `rechte-v5-final` hat zwei Fremdreviewer gesehen
(gemini, codex) und daran auch zwei echte Blocker gefunden — dort ging es um RLS
und Leserechte.

## Was an die Stelle der Plan-Review tritt

Die Entscheidung, die hier hätte gefunden werden müssen, ist **gerechnet** statt
begutachtet: die naheliegende Aktivfläche (`#1F53B0`, der Akzent der linken
Navigation) trägt den Vorschautext nur mit **2,9:1** und fällt damit durch. Das
steht mit Zahlen in `design.md` Entscheidung 3 und als Zusage in der Spec. Eine
Review, die Farben nicht nachrechnet, hätte es nicht gefunden.

Der **Code-Review auf dem Diff** (Schritt 4) entfällt dadurch nicht und ist als
Aufgabe 4.2 geführt.

<!-- Kein Trailer: dieser Record ist von Hand geschrieben und zählt keinen
     Reviewer. Das Gate rechnet Reviewer ohnehin nur aus und blockt nie. -->
