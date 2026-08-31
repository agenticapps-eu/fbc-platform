# Der Umbruch trennt „Abbrechen" nicht mehr von „Posten"

Linear: **AGE-674**

## Why

AGE-670 gab dem Composer einen Rückweg und der Aktionszeile ein `flex-wrap`,
damit der dritte Knopf die Karte nicht aufweitet. Beides ist richtig. Die
angemeldete Sichtprobe am echten Composer zeigte am selben Tag, dass der
Umbruch an der **falschen Stelle** greift.

Auf 375 × 812 (Chrome, DEV, angemeldet):

```
[Bild] [Video] [Abbrechen]
                  [Posten]
```

Gemessen an den `top`-Werten: **388** gegen **432**. „Abbrechen" steht bei den
Knöpfen, die etwas **hinzufügen**, „Posten" allein darunter. Die zwei Knöpfe,
die dieselbe Frage beantworten, sind getrennt.

**Das ist kein Fehler im engeren Sinn** — Überlauf 0, nichts abgeschnitten,
alles bedienbar. Es ist eine Gruppierung, die die falsche Geschichte erzählt,
und sie ist erst am Bildschirm sichtbar: die Zahlen aus AGE-670 waren alle
grün.

## What Changes

- **„Abbrechen" und „Posten" brechen gemeinsam um.** Sie liegen in einer
  eigenen Hülle, die selbst nicht umbricht; umgebrochen wird künftig die
  Medien-Zeile **über** die Aktionen, statt die Aktionen auseinanderzureissen.
- Sichtbar ändert sich sonst nichts: dieselben Knöpfe, dieselbe Reihenfolge,
  dieselbe Ausrichtung nach rechts.

Vorher/nachher, als Sonde im laufenden Browser gemessen:

| | vorher | nachher |
| --- | --- | --- |
| `top` „Abbrechen" / „Posten" | 388 / 432 | **430 / 430** |
| Breite der Aktionshülle | — | 178 px (in 293 px Innenmaß) |
| Höhe der Gruppe | 80 px | 78 px |
| Waagerechter Überlauf | 0 | **0** |
| Kartenbreite | 343 px | 343 px |

## Was NICHT dazugehört

- **Die Reihenfolge bleibt.** „Abbrechen" links, „Posten" rechts — das Delta
  sagt ausdrücklich, dass die Klausel die Reihenfolge nicht vorgibt.
- **Der Umbruch aus AGE-670 bleibt.** Die Hülle liegt *in* der umbrechenden
  Gruppe; nähme man den Umbruch heraus, käme der 44-px-Überlauf zurück.

## Verfahren

**Kein Fremdreviewer, keine Plan-Review (2b)** — reines UI, kein Schema, keine
Rechte, keine Sicherheitsgrenze. Donalds stehende Regel.

## Die Falle beim Bauen

Die Zusage aus AGE-670 („lässt die Aktionsgruppe umbrechen") holte die
umbrechende Gruppe über `parentElement` von „Abbrechen". Nach dieser Änderung
ist das die neue Hülle **ohne** `flex-wrap`, und die Zusage wird rot. Sie ist
mitzuziehen — über die Medien-Zeile statt über „Abbrechen". Dass sie überhaupt
anschlägt, ist der Beleg, dass sie etwas misst und keine Attrappe ist.
