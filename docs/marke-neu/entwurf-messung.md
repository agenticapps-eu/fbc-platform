# Die neue Marke — gemessen, entschieden, fertig zum Einsetzen

Stand 2026-08-29 früh. **Nicht neu messen und nicht neu entwerfen** — der Pfad
unten ist von Donald am 29.08. freigegeben (Variante B). Was hier fehlt, ist nur
noch das Einsetzen an drei Stellen und das Erzeugen der Artefakte.

Beleg: `entwurf-gegen-vorlage.jpeg` in diesem Verzeichnis — Vorlage, neuer
Entwurf und der Entwurf als roter Umriss über der Vorlage.

## Der Pfad

`public/brand/compass-favicon.svg` in voller Länge, so wie die Datei aussehen
soll. `<circle>` fällt ersatzlos weg, der Stern bleibt **ein** `<path>` mit
fünf Teilzügen (Hauptstern + vier Nebenstrahlen) — damit bleibt
`pfade.length === 1` und an `leseMarke()` muss nur die Ring-Erwartung fallen.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <!-- eff.bee.zee Kompassmarke (AGE-492), neue Fassung vom 29.08.: kein Ring
       mehr, dafür vier Nebenstrahlen auf den Diagonalen. Form vermessen an
       docs/marke-neu/marke-allein.jpeg — die Zahlen und die Methode stehen in
       docs/marke-neu/entwurf-messung.md. Alle drei Stellen (diese Datei,
       CompassMark.tsx, docs/design-system.html) müssen dieselbe Form zeigen,
       sonst trägt der Tab ein anderes Logo als die App. -->
  <path d="M24 2 L27.15 20.85 L46 24 L27.15 27.15 L24 46 L20.85 27.15 L2 24 L20.85 20.85 Z
           M27.89 20.11 L29.64 19.9 L34.58 13.42 L28.1 18.36 Z
           M27.89 27.89 L28.1 29.64 L34.58 34.58 L29.64 28.1 Z
           M20.11 27.89 L18.36 28.1 L13.42 34.58 L19.9 29.64 Z
           M20.11 20.11 L19.9 18.36 L13.42 13.42 L18.36 19.9 Z" fill="#1F53B0" />
</svg>
```

`CompassMark.tsx` bekommt denselben `d`, aber `fill="currentColor"` und **ohne**
den `<circle>`; `docs/design-system.html` ebenso. Farbe bleibt, wo sie ist —
geändert wird ausschliesslich die **Form**.

## Was gemessen wurde, und wie

Quelle `marke-allein.jpeg`, 1254². Schwerpunkt aller hellen Bildpunkte
(Schwelle 140 im Graukanal): **626,4 / 625,7**. Hauptstrahl-Radien ab da:
N 181 · S 173 · W 174 · O 176 → **R = 176**. Alle Angaben in Vielfachen von R;
bei viewBox 48 ist R = 22.

| | gemessen | in viewBox 48 |
| --- | --- | --- |
| Nabe (halbe Breite am Hauptstern) | **0,140 R** | **3,15** |
| Nebenstrahl innere Spitze | 0,250 R | r = 5,50 |
| Nebenstrahl breiteste Stelle | 0,313 R, halbe Breite **0,0497 R** | r = 6,89, ±1,09 |
| Nebenstrahl äussere Spitze | **0,680 R** | r = 14,96 |

Der Nebenstrahl ist also eine **Raute mit Spitzen an beiden Enden**, nicht ein
Dreieck mit Basis: von 0,25 R wächst er auf die volle Breite bei 0,313 R und
läuft von dort geradflankig auf die Spitze bei 0,68 R zu. Die Flanken sind
gerade — an beiden Enden linear, in der Messung über neun Stützstellen bestätigt.

**Deckungsprobe** (Entwurf gegen die Schwellenmaske der Vorlage, 600², Anteil
der Schnittmenge an der Vereinigung):

| | Deckung | zu viel Farbe | fehlende Farbe |
| --- | --- | --- | --- |
| heute im Repo (Ring + Stern) | 41,9 % | 52 111 | 6 818 |
| Nabe 3,4 (Hauptstern unverändert) | 85,8 % | 5 813 | 2 026 |
| **Nabe 3,15 (gewählt)** | **87,1 %** | 3 221 | 3 578 |

Der heutige Stand ist die Positivkontrolle: ein Entwurf, der die Vorlage nicht
trifft, fällt in dieser Zahl sichtbar durch. Das Optimum ist flach — 3,1 bis
3,2 liegen innerhalb von 0,2 Prozentpunkten, 3,4 fällt heraus. Die verbleibenden
13 % sind Kantenunschärfe des JPEG entlang eines sehr langen Umrisses, kein
Formfehler.

## Zwei Zahlen der Übergabe vom 29.08. nachts sind falsch

Beide gehen auf **denselben** Fehler zurück: der Mittelpunkt wurde mit
(626, 626) angenommen statt mit dem gemessenen Schwerpunkt. Vier Bildpunkte
Versatz nach Norden, und die Sonde entlang der 45°-Achse verlässt den dünnen
Nebenstrahl seitlich, lange bevor er endet.

- **„Nebenstrahl … bis 0,568 R"** — er reicht bis **0,680 R**. Bei 0,568 R
  verliess die Sonde die Flanke, nicht der Strahl sein Ende.
- **„die Hauptstrahlen ändern sich praktisch nicht … Nabe 0,159 R"** — die Nabe
  misst **0,140 R**. Der Stern der Vorlage ist am Ansatz rund 8 % schlanker als
  der heutige.

Der erste Entwurf wurde nach den alten Zahlen gebaut und **fiel im Umriss über
der Vorlage sichtbar durch** — dort begann die Nachmessung. Das ist der Grund,
warum Schritt 2 („gerendert neben die Vorlage legen") vor allem anderen steht:
zwei Zahlentabellen sahen beide plausibel aus, das Bild entschied.

## Was noch zu tun ist

1. Den Pfad oben an **drei** Stellen einsetzen:
   `public/brand/compass-favicon.svg`, `src/components/ui/CompassMark.tsx`,
   `docs/design-system.html`. Keine vierte Kopie.
2. `leseMarke()` in `scripts/app-icons.logic.ts:72` samt Tests: die
   `<circle>`-Erwartung fällt, das Zeichnen des Rings auch. Ohne diesen Schritt
   scheitert `pnpm app:icons` an der Vorlage, die keinen Kreis mehr hat.
3. `pnpm app:icons` **und** `pnpm splash`. Beleg ans **gebaute** Artefakt
   (mittlere Farbe, `Assets.car`), nicht an die Datei im Arbeitsbaum.
4. **Erst danach** der Startbildschirm-Fehler — die Fläche wird ohnehin neu
   erzeugt.

Unverändert gilt (Donald, 28.08.): die farbigen **Akzentpunkte der Wortmarke
bleiben**, und **„YOUR NEXT OPPORTUNITY" wird nicht übernommen**. Beide
Antworten weichen von den WhatsApp-Vorlagen ab — ein späterer Vergleich
„Vorlage gegen Repo" sieht deshalb nach einem Fehler aus und ist keiner.
