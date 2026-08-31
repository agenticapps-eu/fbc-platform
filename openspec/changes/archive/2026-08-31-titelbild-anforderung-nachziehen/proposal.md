# Die Titelbild-Anforderung sagt wieder, was gebaut ist

Linear: **AGE-665**

## Why

`openspec/specs/design-system/spec.md` trägt die Anforderung „Ein Titelbild-Feld
trägt das Verhältnis, auf das zugeschnitten wird". Sie ist am 25.08. um 20:18
Wahrheit geworden (AGE-596, PR #215) und beschreibt die Welt seitdem an
mehreren Stellen nicht mehr.

**Der Code verletzt nichts.** Die Aussagen sind keine Vorgaben, die gebrochen
wären, sondern Beschreibungen, die überholt sind — `openspec validate --all`
ist grün, weil die Anforderung in sich stimmig bleibt. Genau diese Klasse
Drift sieht kein Gate; dieselbe wie AGE-652.

**AGE-665 nennt zwei Fälle. Es sind drei, und ein vierter Satz ist falsch
begründet.** Beim Nachmessen für dieses Proposal gefunden:

| # | Aussage der Spec | Wirklichkeit | Beleg |
| --- | --- | --- | --- |
| 1 | Die Zuschnitt-Vorschauen sind „ausdrücklich nicht erfasst" | Beide tragen `aspect-[3/1]` + `object-contain` | `ProfilPage.tsx:304,311`, `EventCoverPicker.tsx:119,121` (AGE-600) |
| 2 | Der Demo-Seed ist „die benannte Ausnahme … nachzuziehen ist der Seed" | Der Seed ist nachgezogen | beide Aufrufstellen rufen `titelbildZuschnitt` (1500 × 500): `import_world_seed.ts:700`, `demo_event_covers.ts:145` (AGE-599) |
| 3 | **Die Verzeichnis-Karte ist „nicht erfasst"** — NEU, in AGE-665 nicht genannt | Sie ist seit AGE-595 `aspect-[3/1]` + `object-contain` | `MemberDirectory.tsx:720,723` |
| 4 | Die Ausgeschlossenen „tragen anderes Bildmaterial" | Falsch für **beide**: die Karte zieht aus `covers` wie der Profilkopf, der Feed über `signEventCovers` aus `event-covers` wie Kachel und Kopf | `MemberDirectory.tsx:691`, `CommunityFeed.tsx:222-233` |

Zu **3** die Zeitachse, weil sie die Lehre trägt: die Fassung, die die Karte
ausschloss, landete am 25.08. um **20:18**; die Karte wurde um **22:38**
konform — 2 h 20 später, am selben Abend. Der Ausschluss war beim Schreiben
richtig. Er ist nicht durch einen Fehler falsch geworden, sondern durch die
nächste Änderung, und drei Tage lang hat ihn niemand nachgelesen — auch
AGE-665 nicht, das zwei Absätze weiter unten fündig wurde.

## What Changes

Ein `MODIFIED`-Block auf die eine Anforderung. **Kein Code.** Die vier
Bauteile, die Vorschauen, die Karte und der Feed bleiben, wie sie sind.

- **Die Verzeichnis-Karte kommt in die Aufzählung** — aus drei Bauteilen werden
  vier. Sie hält die Regel längst; die Anforderung führt das nach, sie verlangt
  nichts Neues.
- **Die Vorschauen bekommen eine eigene Klausel**, nicht einen fünften
  Aufzählungspunkt: „Eine Vorschau SHALL dieselbe Regel tragen wie die Fläche,
  die sie vorwegnimmt." Über die Eigenschaft formuliert, nicht über die zwei
  Namen — sonst ist die nächste Vorschau wieder ein eigener Vorgang.
- **Der Feed bleibt ausgeschlossen, aber mit dem richtigen Grund.** Er ist die
  einzige Fläche, die noch beschneidet (`aspect-[3/1]` **mit** `object-cover`).
  Der Ausschluss ruht damit auf einer offenen Entscheidung — AGE-664 — und
  nicht mehr auf „anderes Bildmaterial".
- **Der Seed-Absatz geht in die Vergangenheitsform** und behält seine gemessene
  Zahl. Ergänzt um den Zustand, der wirklich noch offen ist: der **Bestand**.
- **Die Bucket-Zahlen werden als datierter Beleg gekennzeichnet** (Stand
  25.08.), nicht als fortlaufende Zusage.

## Entscheidungen, die hier getroffen werden

Das Issue nennt zwei davon ausdrücklich als „keine Redaktion". Getroffen sind
sie so:

1. **Vorschauen: eigene Klausel statt fünftem Aufzählungspunkt.** Die Klausel
   sagt den Grund mit und deckt künftige Vorschauen ab. Ein Aufzählungspunkt
   hätte beides nicht getan — und die Liste wäre mit der Verzeichnis-Karte im
   selben Zug auf sechs Einträge gewachsen.
2. **Seed-Absatz: Vergangenheitsform statt Streichung.** Er trägt eine gemessene
   Zahl (rund 25 % freie Fläche je Seite, beim einen 1,33:1-Motiv 27,8 %), und
   die bleibt als Beleg wertvoll. Gestrichen wäre sie fort.
3. **Bucket-Zahlen datieren statt neu messen.** Die Zahlen (55 Objekte in
   `covers`, Median 2,70:1; ein Objekt in `event-covers` auf PROD) stammen vom
   25.08. Ein `MODIFIED`-Block bekräftigt jede Klausel unter neuem Datum — sie
   ungeprüft stehenzulassen hieße, sie neu zu behaupten. **Nachgemessen wurden
   sie nicht:** über den hier erreichbaren Supabase-Zugang ist nur `cparx`
   sichtbar, und der Infisical-Login braucht ein echtes Terminal. Statt einer
   ungedeckten Gegenwartsaussage tragen sie jetzt ihr Datum.

## Capabilities

### New Capabilities

_Keine._ Der Change bleibt im Slot `design-system`.

### Modified Capabilities

- `design-system`: die Anforderung „Ein Titelbild-Feld trägt das Verhältnis, auf
  das zugeschnitten wird" wird ganz neu ausgestellt. Alle **neun** Szenarien
  bleiben zeichengleich erhalten und unverändert.

## Was dieser Change NICHT tut

- **Er fasst den Feed nicht an.** Ob der Ausschluss fällt, ist AGE-664 und
  kippt eine ausgesprochene Entscheidung (AGE-596, `REVIEWS.md:82`). Dieser
  Change macht die Vorlage dafür nur ehrlich: der Feed ist nachweislich
  dieselbe Materialklasse, nicht eine andere.
- **Er repariert den DEV-Bestand nicht.** Die acht alten Objekte in
  `event-covers` bleiben liegen, bis die Abnahme zu AGE-599 läuft; sie schreibt
  in eine geteilte Umgebung und ist Donalds Entscheidung.
- **Er misst die Buckets nicht neu.** Siehe Entscheidung 3.

## Reviewer

**Keiner.** Reine Textarbeit an einer Anforderung — kein Schema, keine Rechte,
keine Sicherheit. Donalds Zuschnitt vom 26.08.: Fremdreviewer nur bei Migration,
RLS, Grants, Policies, Funktionen, Auth.

Was dadurch nicht entfällt, sind die Belege — und die sind hier der eigentliche
Aufwand: jede Klausel des `MODIFIED`-Blocks ist am Code nachgemessen, die neun
Szenarientitel sind maschinell auf Zeichengleichheit geprüft, und jede Zeile,
die nur in der alten Fassung steht, ist einzeln durchgegangen.
