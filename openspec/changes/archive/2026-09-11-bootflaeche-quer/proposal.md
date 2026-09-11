# Die Startfläche passt sich dem Querformat an

Linear: **AGE-716**

## Why

Am 10.09. am Pixel 11 Pro quer aufgezeichnet: die Boot-Fläche zeigt die helle
Fensterwand zwischen den beiden Personen, beide Gesichter fallen oben heraus.
Das ist dasselbe Bild, das AGE-712 für iOS beseitigt hat — auf der Web-Seite
ist es geblieben.

Die Anforderung, die das schon heute verbietet, steht in `native-shell`: die
Komposition „SHALL in **beiden Orientierungen** und auf **beiden
Gerätefamilien** halten". Quer hält sie nicht. Dies ist deshalb keine neue
Zusage, sondern eine, die eingelöst wird — und die Anforderung sagt danach
zusätzlich, **woran** die Auswahl hängt, weil das die Stelle ist, an der die
naheliegende Lösung falsch ist.

## Die Ursache, an drei Stellen belegt

Jede Zeile hier ist der Befehl, der sie widerlegen würde, wenn sie falsch wäre.

1. **`src/index.css:430` lädt EIN Bild** mit `background-size: cover`.
   `grep -n 'url("/brand/splash-' src/index.css` → zwei Treffer, Zeile 430 das
   Band, Zeile 447 der Schriftzug. Keine Querfassung.
2. **`public/brand/` enthält keine Querfassung.** `ls public/brand/` →
   `compass-favicon.svg`, `splash-band.webp` (900×1210), `splash-schriftzug.png`.
3. **`scripts/splash.ts` schreibt fürs Web genau eine Bandfassung.** Die
   Querfassung `splash-band-quer.jpg` geht ausschliesslich in den iOS-Katalog:
   `cat ios/App/App/Assets.xcassets/Splash.imageset/Contents.json` zeigt sie
   unter `"height-class": "compact"`.

**Geometrie.** Quer ist das Band `100vw × 62vh` = 2410×670, also 3,60:1. Das
Hochkantband hat 900×1210, also 0,744:1. Mit `cover` skaliert es auf 2410×3239 —
sichtbar bleiben 670 von 3239 Zeilen, **20,7 %**. Hochkant sind es 1080×1494
(0,723:1) gegen 0,744:1, praktisch verlustfrei.

Kurz: hochkant beschneidet rund 3 %, quer rund 79 %.

Das Material dafür ist längst da. `AUSSCHNITT_QUER` und `BAND_QUER` (1600×457)
stehen seit AGE-712 in `scripts/splash.logic.ts`; es fehlt allein die Ausleitung
ins Web und die Regel, die sie quer wählt.

## What Changes

- Beim Start im Querformat zeigt die Übergangsfläche jetzt einen eigenen
  Bildausschnitt: beide Personen sind im Bild, statt nur der hellen Wand
  zwischen ihnen.

Im Einzelnen:

| Stelle                        | Änderung                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `scripts/splash.logic.ts`     | `WEB_DATEIEN.bandQuer` und `QUER_SCHWELLE`, beide mit Begründung                |
| `scripts/splash.ts`           | das quere Band ein zweites Mal ausleiten → `public/brand/splash-band-quer.webp` |
| `src/index.css`               | eine `@media`-Regel, dieselbe Rampe, anderes `url()`                            |
| `scripts/stempel.logic.ts`    | die neue Datei in `ERGEBNISSE`                                                  |
| `src/boot-flaeche.test.ts`    | die Schwelle gegen das CSS halten, wie die drei bestehenden Zahlen              |
| `openspec/specs/native-shell` | die Auswahl und ihr Merkmal als Zusage                                          |

## Was NICHT dazugehört

Der iOS-Katalog, das Storyboard, die Android-Startfläche. Sie
tragen den Querausschnitt schon (AGE-712) beziehungsweise können ihn nicht
tragen (AGE-713: die SplashScreen-API kennt keine Orientierungsvarianten).

## Impact

- **Betroffen:** die Boot-Fläche im WebView, quer, auf Geräten unter der
  Schwelle. Hochkant ändert sich nichts, im Browser ändert sich nichts — die
  Regel steht wie die bestehenden unter `html[data-boot="nativ"]`.
- **Ein Bild mehr im Startweg.** Es wird nicht zusätzlich geladen, sondern
  statt des anderen: die beiden `url()` stehen in einander ausschliessenden
  Regeln. Der Browser lädt keins von beiden.
- **Risiko:** eine falsch gesetzte Schwelle zeigt auf einem Tablet quer das
  Querband und reisst die Naht auf, die AGE-713 als nahtlos gemessen hat. Genau
  dagegen steht die Schwelle als geprüfte Konstante. Siehe `design.md`.
