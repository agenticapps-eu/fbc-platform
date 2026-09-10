# Entwurf: die Querfassung der Boot-Fläche

## Die Entscheidung, die nicht naheliegt

Die naheliegende Regel ist `@media (orientation: landscape)`. **Sie ist falsch**,
und der Grund steht nicht im CSS, sondern in der Projektdatei:

```
$ grep -n "TARGETED_DEVICE_FAMILY" ios/App/App.xcodeproj/project.pbxproj
317:				TARGETED_DEVICE_FAMILY = "1,2";
339:				TARGETED_DEVICE_FAMILY = "1,2";
```

`"1,2"` heisst iPhone **und** iPad, und `Info.plist` erlaubt dem iPad alle vier
Lagen. Die native Fläche wählt das Querband über `"height-class": "compact"` —
ein iPad quer ist _regular_ und bekommt dort weiterhin das **Hochkantband**.

Eine reine Orientierungsregel zeigte im WebView daneben das Querband. Zwischen
nativer Fläche und Boot-Fläche stünden dann zwei verschiedene Ausschnitte
desselben Fotos, und das ist genau die Naht, die AGE-713 am 10.09. als nahtlos
gemessen hat.

**Gewählt: `(orientation: landscape) and (max-height: 500px)`** — die Spiegelung
von `compact` in der Sprache, die CSS hat.

## Warum 500 px trägt

| Fläche             | Höhe quer       | Seite der Schwelle     |
| ------------------ | --------------- | ---------------------- |
| iPhone, quer       | rund 390–430 pt | darunter → Querband    |
| Pixel 11 Pro, quer | rund 411 px     | darunter → Querband    |
| iPad, quer         | 768–1024 pt     | darüber → Hochkantband |

Zwischen 430 und 768 liegt der ganze Spielraum; 500 sitzt darin mit Abstand nach
beiden Seiten. Android-Tablets verhalten sich damit wie iPads, was richtig ist:
sie haben quer dieselbe Höhe zur Verfügung.

Die Zahl steht als `QUER_SCHWELLE` in `scripts/splash.logic.ts` und wird von
`src/boot-flaeche.test.ts` gegen die Regel gehalten, die sie anwendet. Drei
Zahlen der Komposition werden dort schon so geführt; diese ist die vierte. Eine
Schwelle, die nur im Stylesheet steht, verschiebt jemand, ohne dass etwas rot
wird.

## Warum das Web-Querband 1600 px breit ist

Das Hochkantband geht mit 900 px ins Web statt mit den nativen 1290 — die
Boot-Fläche soll den Start überbrücken, nicht verlängern.

Quer greift dieselbe Überlegung nicht. Die **Quelle** ist 1600 px breit
(`public/images/hero-mitglieder.webp`, 1600×1068); mehr wäre Hochrechnen, und
`BAND_QUER` schöpft sie mit 1600×457 bereits aus. Zugleich ist das Querband
**flächenmässig kleiner** als das Hochkantband: 1600×457 sind 731 kpx gegen
900×1210 = 1.089 kpx. Die grössere Kantenlänge kostet hier also keine Bytes,
sondern spart welche. Deshalb entsteht das Web-Querband aus **demselben Raster**
wie die iOS-Fassung, nur anders kodiert — ein zweiter `rsvg-convert`-Lauf bei
gleicher Breite erzeugte dieselben Pixel ein zweites Mal.

**Gemessen nach dem Bau:** 27 kB gegen 42 kB hochkant. Die Vorhersage trägt —
das breitere Bild ist das leichtere, und der Startweg wird nicht länger.

## Was der Test hält, und was er nicht kann

Er hält **Geometrie und Verdrahtung**: dass die Schwelle im CSS die Konstante
ist, dass jede Datei aus `WEB_DATEIEN` ein `url()` hat, dass jedes dieser `url()`
unter `html[data-boot="nativ"]` steht.

Er kann **nicht** beurteilen, ob beide Gesichter im Bild sind — dafür gilt
dieselbe Feststellung wie in AGE-712: ein Skalar misst hier das Gegenteil dessen,
was gemeint ist. Diese Zusage trägt der Augenschein am Gerät.

**Der Parser im Test braucht dafür eine Korrektur.** `regelnMitUrl` liest
`([^{}]+)\{([^}]*)\}` und nimmt bei einem `@media`-Block die Medien-Bedingung als
Selektor — die Prüfung „steht unter `data-boot`" ginge damit fälschlich rot. Mit
`([^{}]+)\{([^{}]*)\}` überspringt der Ausdruck den äusseren Block und findet die
innere Regel. Für flache Regeln ist beides identisch; die Zusage wird nicht
gelockert, sondern erst auf verschachtelte Regeln anwendbar gemacht.
