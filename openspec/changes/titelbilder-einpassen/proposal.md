# Titelbild-Felder auf das Verhältnis bringen, auf das zugeschnitten wird

Linear: AGE-596

## Why

Drei Felder nehmen ein hochgeladenes Titelbild auf, und keines hat das
Verhältnis der Bilder, die darin landen:

| Fläche | Feld | gegen ein 2,7:1-Bild |
|---|---|---|
| Profilkopf | `h-32 … xl:h-64`, bei 1370 px **4,75:1** | 43,2 % der Bildhöhe fallen weg |
| Event-Kachel | `aspect-[16/9]` = **1,78:1** | 34 % der Bildbreite fallen weg |
| Event-Kopf | `aspect-[3/1]` | ~10 %, praktisch unauffällig |

Die Zahlen der ersten und der zweiten Zeile sind am 25.08. im Browser
nachgemessen (`getBoundingClientRect`, `naturalWidth`/`naturalHeight`,
`s = min|max(bw/nw, bh/nh)`). Die Event-Zahl war exakt richtig; die Zahl des
Profilkopfes stand vorher auf „≈ 6,1:1" und „56 %" und war **falsch**: sie
rechnete mit der FENSTERbreite, der Kopf steht aber in einer Inhaltsspalte von
1217 px. Richtung und Größenordnung bleiben, die Zahl ist korrigiert.

Zwei verschiedene Geometrien mit einem Symptom — im einen Fall ist das Feld
breiter als das Bild, im anderen schmaler. `object-cover` ist dabei nicht die
Ursache, sondern die Regel, die die Abweichung sichtbar macht.

## Die Messung, auf der das steht

Alle **55** Objekte des `covers`-Buckets wurden gelesen und ihre Maße aus den
Dateiköpfen bestimmt, 0 Fehlschläge:

| Seitenverhältnis | Anzahl |
|---|---|
| 2,2:1 – 2,95:1 | **49** |
| genau 3:1 (aus dem Zuschneider) | 2 |
| 1,6:1 – 2,2:1 | 2 |
| 1:1 – 1,6:1 | 2 |

Median **2,70:1**, Minimum 1,33:1, Maximum 3,00:1 — **keines breiter als 3:1**.

Beide Upload-Wege schneiden auf 3:1 zu (`aspect={3}`), das betrifft aber nur 2
von 55; die übrigen 53 kommen aus dem WP-Import.

## What Changes

- Die drei Bildfelder werden **3:1**.
- Der Profilkopf verliert seinen Höhendeckel.
- Das Bild wird eingepasst statt beschnitten, damit die Abweichler unter 3:1
  Ränder bekommen statt Verluste.
- Der Platzhalter-Verlauf rückt **unter** das Bild, damit die Ränder nicht als
  flache Fläche erscheinen.

## Impact

- `openspec/specs/design-system/` — eine neue Anforderung
- `src/components/profile/ProfileHero.tsx`
- `src/components/events/EventCover.tsx`

Keine Migration, keine RPC, kein Secret.

## Entscheidungen und ihre Kosten

**Der Deckel fällt** (Donald, 25.08., nach der Messung). Der erste Entwurf
wollte den Deckel behalten und nur einpassen — das wären auf dem Profilkopf
**48 % leerer Verlauf** gewesen, das Bild ein Streifen in der Mitte. Deckel und
„ganzes Bild ohne Balken" schließen einander aus, weil eine gedeckelte Bahn auf
einer breiten Seite selbst 6:1 ist. Preis: der Kopf wird bei 1370 px rund
406 px hoch statt 256, und die Begründung von AGE-566 („schiebt den Namen unter
die Falz") tritt ein.

**Die Regel bindet drei Bauteile, nicht alle Bilder.** Der Plan-Review hat zu
Recht beanstandet, dass „jedes Titelbild" auch die Zuschnitt-Vorschauen, die
Feed-Bilder und die neue Verzeichnis-Karte binden würde — die Anforderung wäre
beim Archivieren sofort verletzt gewesen. Der Geltungsbereich steht jetzt
ausdrücklich in der Anforderung.

## Non-goals

- Die Höhe an das einzelne Bild zu binden. Ein Feld, dessen Verhältnis vom
  Upload abhängt, lässt das Raster ausfransen.
- Den Zuschneider anzufassen. 3:1 bleibt, was er liefert.
- Die vier Ausreißer unter 2,2:1 nachträglich zuzuschneiden.
