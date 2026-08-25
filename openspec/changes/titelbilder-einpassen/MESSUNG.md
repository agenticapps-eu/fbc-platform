# AGE-596 — Messung im Browser, vorher und nachher

Lokaler Stack (`supabase start`), Vite auf 5173, Chrome per DevTools-Protokoll.
Drei selbst erzeugte Fixtures, keine Mitgliederbilder: **1200x400 = 3,00:1**,
**1080x400 = 2,70:1** (der Median der 55 gemessenen Cover), **800x600 = 1,33:1**
(das Minimum). Jedes trägt farbige Kantenbänder — fehlt ein Band im Bild, fehlt
eine Kante.

Verfahren wie in der Anforderung verlangt: `getBoundingClientRect` des
Containers, `naturalWidth`/`naturalHeight` des Bildes,
`s = min(bw/nw, bh/nh)` bei `contain` bzw. `max(…)` bei `cover`, daraus die
gemalte Größe und der fehlende Anteil je Kante.

## Vorher (`object-cover`)

Profilkopf, Fixture 2,70:1:

| Fenster | Feld | Feld-Verhältnis | Verlust Höhe |
|---|---|---|---|
| 375  | 341 x 128  | 2,66:1 | 0 %    |
| 768  | 703 x 176  | 3,99:1 | 32,4 % |
| 1370 | 1217 x 256 | 4,75:1 | 43,2 % |

Event-Kachel (16:9) bei 1370 px: 2,70:1 verliert **34,2 %** der Breite,
3,00:1 **40,7 %**, 1,33:1 **25 %** der Höhe.
Event-Kopf (3:1) bei 1370 px: 2,70:1 verliert **10,0 %** der Höhe.

## Nachher (3:1 + `object-contain`)

Verlust an JEDER Kante, bei ALLEN drei Breiten, für ALLE drei Fixtures: **0 %.**

| Bauteil | Fenster | Feld | Frei je Seite 3,00 / 2,70 / 1,33 |
|---|---|---|---|
| Profilkopf   | 375  | 341 x 114  | 0 % / 5 % / 27,8 % |
| Profilkopf   | 768  | 703 x 234  | 0 % / 5 % / 27,8 % |
| Profilkopf   | 1370 | 1217 x 406 | 0 % / 5 % / 27,8 % |
| Event-Kachel | 375  | 341 x 114  | 0 % / 5 % / 27,8 % |
| Event-Kachel | 768  | 343 x 114  | 0 % / 5 % / 27,8 % |
| Event-Kachel | 1370 | 394 x 131  | 0 % / 5 % / 27,8 % |
| Event-Kopf   | 1370 | 1217 x 406 | 0 % / 5 % / 27,8 % |

Das 3,00:1-Fixture sitzt randlos — Szenario „Ein gespeichertes 3:1-Bild sitzt
randlos" belegt.

Weiter am Event-Kopf geprüft: der Verlauf steht im Baum **und vor dem Bild**,
und die Datumsmarke sitzt 12/12 px zur Ecke des FELDES (nicht des Bildes,
dessen Rand bei 2,70:1 rund 61 px weiter innen beginnt).

## Was diese Messung korrigiert hat

Das Proposal nannte für den Profilkopf „≈ 6,1:1" und „56 % der Bildhöhe". Beide
Zahlen rechneten mit der FENSTERbreite; der Kopf steht in einer Inhaltsspalte
von 1217 px. Gemessen sind es 4,75:1 und 43,2 %, und die neue Höhe ist **406 px
statt 256** — nicht 457 statt 224. Proposal und Anforderung sind entsprechend
berichtigt. Die beiden Event-Zahlen waren exakt richtig.

## Offen: eine Geschmacksfrage

Bei den vier Ausreißern unter 2,2:1 bleiben **27,8 % je Seite** frei. Ob das
nach Rahmung aussieht oder nach Fehler, entscheidet nicht diese Messung.

## Wie hoch wird der Kopf wirklich — und rutscht der Name unter die Falz?

Die Sorge aus AGE-566 ist nachgemessen. „Kein Höhendeckel" heißt **nicht**
unbegrenzt: die Inhaltsspalte hat eine Höchstbreite von 1374 px, der Kopf wird
also nie höher als **458 px**.

| Fenster | Spalte | Kopf | Anteil der Sichthöhe | Name |
|---|---|---|---|---|
| 1370 x 900  | 1217 | 406 px | 45 % | über der Falz |
| 1512 x 830 (MacBook) | 1359 | 453 px | 55 % | über der Falz, 601–637 px |
| 1920 x 1080 | 1374 | 458 px | 42 % | über der Falz, 606 px |
| 2560 x 1400 | 1374 | 458 px | 33 % | über der Falz |

Der Name bleibt in allen vier Fällen sichtbar. Die Begründung von AGE-566 tritt
also in ihrer wörtlichen Form nicht ein; was bleibt, ist die Wucht des Kopfes —
und das ist eine Geschmacksfrage, keine Messung.

## Nachtrag aus dem Code-Review: `event-covers` ist ein ANDERER Bucket

Der Review hat zu Recht beanstandet, dass die 55 gemessenen Cover den Bucket
`covers` (Profilbanner) betreffen — die Event-Felder hängen an `event-covers`,
und der war nie gemessen. Nachgeholt am 25.08.:

| Bucket | Zeilen | Verhältnisse |
|---|---|---|
| `event-covers` **PROD** | 1 | 3,00:1 |
| `event-covers` **DEV** (Demo-Seed) | 8 | 1,33:1 · 7 × 1,50:1 |

Das ändert die Entscheidung **nicht**, sondern schärft ihre Begründung: was über
`EventCoverPicker` hochgeladen wird, ist 3:1 und sitzt randlos — das einzige
echte Objekt auf PROD belegt genau das. Die acht DEV-Bilder sind
Seiten-Heldenbilder (`public/images/hero-*.webp`), die der Seed am Zuschneider
VORBEI hochlädt; unter `contain` stehen sie mit rund 25 % freier Fläche je Seite
in der Kachel.

**Folgearbeit (nicht in AGE-596):** der Demo-Seed sollte seine Event-Bilder auf
3:1 zuschneiden, sonst zeigt jede DEV- und Demo-Fläche graue Ränder, die es auf
PROD nicht gibt.

**Zweite Folgearbeit (nicht in AGE-596):** die Zuschnitt-Vorschauen in
`ProfilPage` (`h-24 sm:h-28`, `object-cover`) und `EventCoverPicker`
(`aspect-[3/1] object-cover`) sind laut Anforderung ausdrücklich außen vor,
zeigen nach dieser Änderung aber nicht mehr das, was das Mitglied hinterher
sieht. Die Abweichung entsteht durch diese Change und gehört benannt.
