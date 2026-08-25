# Messung — AGE-597

Alles am 25.08.2026 erhoben. Zwei Werkzeuge:

- `scripts/probe-age597-kompass-bestand.ts` — liest PROD **nur lesend**
  (`set default_transaction_read_only = on`) und gibt **ausschließlich Zahlen**
  aus. Keine Titel, keine Beschreibungen, keine Kennungen: das Repo ist
  öffentlich, und wörtliche Kompass-Zeilen tragen Firmen, Orte und URLs auch
  ohne Klarnamen. Die Regel selbst läuft dabei aus dem echten Code
  (`src/lib/kompass-anzeige.ts`), nicht aus einer Kopie.
- Chrome DevTools gegen den lokalen Stack, mit **selbst geschriebenen**
  Fixtures, die die gemessenen Formen an ihren Extremwerten nachbilden.

## Der Bestand bewegt sich, während man ihn misst

Zwei Lesungen, 23 Minuten auseinander, beide am 25.08.:

| | 20:49 | 21:12 |
|---|---|---|
| Zeilen gesamt | 112 | **117** |
| `source = chip` | 19 | **24** |
| `source = editor` | 93 | 93 |
| Abschnitte mit Inhalt | 97 | **98** |

Fünf neue Marken-Zeilen, alle mit bekanntem Schlüssel und einem Titel, der exakt
der Kategoriename ist. PROD ist in Benutzung, während hier gemessen wird — und
das ist genau der Grund, warum keine dieser Zahlen als Invariante in die
Anforderung geschrieben wurde. Die Zahlen unten sind die Lesung von **20:49**,
sofern nicht anders vermerkt; die Regeln hängen an keiner von ihnen.

## Der Bestand — 112 Zeilen (offers + needs), 50 Profile

| Merkmal | Zahl |
|---|---|
| `source = chip` / `editor` / anderes | 19 / 93 / 0 |
| `chip` mit Beschreibung · `chip` ohne Kategorie | 0 · 0 |
| `editor` mit Kategorie · ohne Beschreibung | 0 · 0 |
| Kategorie-Schlüssel, die `config/matching` kennt | 19 von 19 |
| Kategorien mit mehr als einem Titel-Wert | 0 |
| Titel, der vom Klartext der Kategorie abweicht | 0 |
| `'-` am Zeilenanfang: Titel · Beschreibung | 13 · 13 |
| längste Beschreibung · über 500 Zeichen | 1048 · 4 |
| meiste Marken: ein Profil · **eine Reihe** | 11 · **6** |

## Die Präfix-Regel — drei Annahmen des Proposals widerlegt

Das Proposal nahm an, der Import kappe bei 80 Zeichen **mitten im Wort**, und
verlangte deshalb einen unscharfen Vergleich bis zur letzten Wortgrenze.
Gemessen an den 93 Freitext-Zeilen:

| Kandidaten-Regel | Treffer |
|---|---|
| wörtliches Präfix der ersten Zeile | 58 |
| … der ganzen Beschreibung | 58 |
| … whitespace-normalisiert | 58 |
| **bis zur letzten Wortgrenze** | **81** |
| Titel mit Zeilenumbruch | 0 |

Die Wortgrenzen-Regel fasst **20 Zeilen zu viel** — Titel, die mit ihrer
Beschreibung nur die ersten Worte teilen. Warum die drei 80-Zeichen-Titel
trotzdem keine wörtlichen Präfixe sind, sagt die Stelle der Abweichung:

```
{"rohLaenge":80,"divergenzAb":79,"codeImTitel":8230,"codeInBeschreibung":32}   ×3
```

U+2026 („…") im Titel, ein Leerzeichen in der Beschreibung — gekappt wird an der
**Wortgrenze**, und das Auslassungszeichen ist das Merkmal. Die umgesetzte
Regel schneidet es ab und vergleicht dann wörtlich:

| | Zahl |
|---|---|
| Titel mit Auslassungszeichen | 35 |
| davon von der Regel gefasst | 35 |
| Titel entfällt (58 wörtlich + 35 gekürzt) | **93** |
| Titel bleibt stehen | **0** |

Im heutigen Bestand überlebt also **kein** Editor-Titel. Die Proposal-Zeile
„vier Zeilen, deren Titel keinerlei Bezug zur Beschreibung hat" ist damit
widerlegt. Ein eigenständiger Titel bleibt trotzdem stehen — dafür gibt es einen
eigenen Test, samt Sperre gegen die zu gierige Wortgrenzen-Regel.

## Abnahme über den ganzen Bestand, nicht an einem Beispiel

Beide Regeln über alle 97 gefüllten Abschnitte gerechnet:

| Merkmal | Zahl |
|---|---|
| Abschnitte, die **leer** würden | **0** |
| meiste Marken in einer Reihe | 6 |
| meiste Textblöcke in einem Abschnitt | 1 |
| längster angezeigter Text | 1048 Zeichen |

## Vorher/nachher im Browser, gleiche Daten

Lokaler Stack, ein fremdes Profil mit sechs Marken je Reihe, einer unbekannten
Kategorie, dem 1048-Zeichen-Text, einem mit „…" gekürzten Titel, einem
`'-`-Eintrag — und **gesetzten** Themen-Scores (8,0 · 6,0 · 10,0 · 4,0).

| @1370 px | vorher (HEAD) | nachher |
|---|---|---|
| „Ich biete": Höhe · Kästen | 677 px · 7 | **298 px · 0** |
| „Ich suche": Höhe · Kästen | 468 px · 5 | **233 px · 0** |
| Marken | rohe Schlüssel (`kapital`, `know_how`) | Klartext (Kapital, Know-how) |
| unbekannte Kategorie `zeitreisen` | als Marke sichtbar | **entfällt** |
| Erfolgsradar | 210 px, „Sein 8.0 …" | **fort — obwohl Scores gesetzt sind** |
| Seitenhöhe | 2994 px | **2146 px** |
| Abruf `profile_theme_scores` | — | **0** |

Dass der Radar **trotz gesetzter Scores** fehlt, ist der Punkt: die Anforderung
verlangt ausdrücklich, dass das Ausblenden nicht an der Leere der Daten hängt.

Umlauf bei schmalem Fenster (gemini [HIGH]), gemessen am Element, nicht am
Fenster: bei **375 px** stehen die sechs Marken in **einer** Liste und laufen auf
**zwei** Zeilen um; kein Element meldet Überlauf (`scrollWidth > clientWidth`),
die Seite scrollt nicht waagerecht.

## Mutationen — jede neue Zusage trägt

Zwölf gezielte Verbiegungen der Umsetzung, jede einzeln angewandt und
zurückgenommen; **jede** färbt mindestens einen Test rot.

| Mutation | rot |
|---|---|
| alle Zeilen als Freitext behandeln | 4 |
| Titel der Marken-Zeile doch zeigen | 4 |
| unbekannte Kategorie als großgeschriebenen Schlüssel zeigen | 1 |
| Aufzählungszeichen nicht putzen | 1 |
| Auslassungszeichen nicht abschneiden | 1 |
| unscharfe Wortgrenzen-Regel statt der scharfen | 1 |
| Umbrüche der Beschreibung falten | 2 |
| jede Marke in eine eigene Reihe | 1 |
| Erfolgsradar wieder anzeigen | 1 |
| Erfolgsradar wieder im Hinweistext | 1 |
| Themen-Scores wieder abfragen | 1 |
| `source` nicht mitlesen | 1 |

## Zweite Runde — was die Code-Review auf den Diff geändert hat

Vier Befunde, alle angenommen (Herleitung in `REVIEWS.md`). Zwei davon hingen an
einem Irrtum in meiner eigenen Plan-Review-Auflösung: `AngeboteGesuchePage` ist
zwar nicht geroutet, exportiert aber `AngeboteGesucheEditor`, den `CompassPage`
als Reiter „Suche & Biete" unter `/kompass` einhängt. Der reiche Editor **lebt**,
und er verlangt für jede Zeile Titel *und* Kategorie, während `source` das
Speichern überlebt.

| vorher (erste Fassung) | jetzt |
|---|---|
| Marke nur für `source = 'chip'` | Marke für **jede** Zeile mit bekannter Kategorie |
| `chip`-Titel entfällt immer | Titel entfällt, wenn er den **Klartext der Kategorie** oder den Anfang der Beschreibung wiederholt |
| Karte an `offers.length > 0` | Karte daran, ob **etwas erscheint** |
| Prüfskript baut die Blöcke nach | Prüfskript ruft `kompassAnzeige` — denselben Code wie die Seite |

Für den heutigen Bestand ändert das **nichts**: alle 24 chip-Titel sind exakt
der Kategoriename, keine der 93 Editor-Zeilen trägt eine Kategorie, kein
Abschnitt bliebe leer. Die Regel steht damit auf ihrer Begründung, nicht auf
einem Zustand — was die Bewegung von 112 auf 117 Zeilen oben unterstreicht.

Der vierte Befund war eine Falle, die ich in der Umsetzung bewusst vermieden und
im Prüfskript wieder aufgemacht hatte: `.test()` auf einem `/g`-Regex merkt sich
`lastIndex` und zählt beim nächsten Aufruf zu wenig. Erkennung läuft jetzt über
eine eigene, nichtglobale Fassung; `String.replace` war nie betroffen.
