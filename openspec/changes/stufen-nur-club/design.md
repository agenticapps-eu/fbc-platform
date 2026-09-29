# Entwurf — stufen-nur-club (AGE-969)

## Die eine Entscheidung, die alles andere trägt

**Sichtbarkeit und Recht sind zwei Dinge, und sie bekommen zwei Konstanten.**

Der naheliegende Griff wäre, die genannten Stufen aus `CLUB_RANK` abzuleiten:

```ts
const GENANNT = LEVEL_ORDER.filter((k) => LEVELS[k].rank >= CLUB_RANK);
```

Heute ergäbe das genau die richtige Menge — und es wäre trotzdem falsch.
`CLUB_RANK` ist eine **Rechtegrenze**: dieselbe Zahl steht als `has_level(4)`
in sieben Policies und fünf Funktionen. Wer BOOST später wieder *nennen* will,
müsste dann `CLUB_RANK` senken — und schaltete damit das Verzeichnis, die
Kontaktanfragen und die Academy für BOOST frei. Eine Anzeigeentscheidung
verschöbe eine Rechtegrenze.

Deshalb: **eine eigene Liste**, die heute zufällig deckungsgleich ist, und ein
Test, der diese Deckungsgleichheit als *heutigen Stand* festhält statt als
Gesetz. Wenn BOOST zurückkommt, ändert sich eine Liste; wenn der Club anderswo
beginnt, ändert sich `CLUB_RANK`. Nie beides durch einen Griff.

*Verworfen — `LEVEL_ORDER` kürzen:* das wäre Löschen, und Donald hat
ausdrücklich das Gegenteil gesagt. Ausserdem liest `levelLabel` daraus, und ein
Konto auf ACTIVE bekäme dann den rohen Schlüssel `active` zu sehen statt gar
nichts — das Gegenteil des Ziels.

*Verworfen — eine Umgebungsvariable oder ein Schalter in `platform_settings`:*
eine Anzeigeentscheidung, die zur Laufzeit kippen kann, verlangt, dass jede
Fläche beide Fälle aushält, und eine Zusage kann dann nur noch „je nachdem"
lauten. Die drei kommen mit einem Deploy zurück, nicht mit einem Klick.

## Was an die Stelle eines Namens tritt

Unterhalb des Clubs gibt es **keinen Ersatznamen**, sondern eine Aussage über
den Zugang. Der Unterschied ist nicht kosmetisch: „Mitglied" wäre ein neuer
Stufenname, der später mit BOOST kollidiert, und er behauptete eine Zugehörigkeit,
die gerade nicht besteht.

| Stelle | heute | künftig |
|---|---|---|
| `TierBadge` | `Active` | **nichts** — die Plakette entfällt |
| Einstellungen, Kopf | `Active-Mitglied` | `Clubzugang ab Discover` |
| `ProfileHero` | `Active Member` | nichts |
| Dashboard-Kachel „Stufe" | `Active` | `—` mit Erläuterung darunter |
| Verzeichnis-Karte | `Active` | nichts |
| `MembershipSummary` | `Active` + „Nächster Schritt: Boost" | Zugangssatz, keine nächste Stufe |

**Die Plakette entfällt, sie wird nicht leer.** Ein leeres Abzeichen ist ein
sichtbarer Kasten ohne Inhalt und sieht nach einem Fehler aus; `TierBadge`
liefert `null`, und die sechs Aufrufstellen vertragen das, weil sie die
Plakette in einer Flexbox neben anderem führen. Das ist zu prüfen, nicht
anzunehmen — je Aufrufstelle eine Zusage.

## Was NICHT angefasst wird, und warum

**`/mitgliedschaft`** — seit AGE-907 auf `/` umgeleitet, also nicht erreichbar.
AGE-928 baut die Seite als reine Anzeige neu und bringt eigene Entscheidungen
mit (in den nativen Hüllen ohne Preise). Sie liest dann `GENANNTE_STUFEN`; das
ist die ganze Naht, die es braucht.

**`release-entries.generated.ts`** — sieben Treffer, und **kein Mitglied sieht
sie**. Gemessen: die Liste wird ausschliesslich von `AdminNeuigkeitenPage` und
`lib/release-notes.ts` gelesen; die beiden anderen Fundstellen sind Kommentare.
Es ist der Vorrat, aus dem ein Admin eine Mitteilung zusammenstellt. Und falls
einzelne Einträge auch dort nicht mehr auftauchen sollen: die Markierung
**gibt es schon** (`release_entry_skips`, AGE-636), samt Policy und pgTAP. Hier
entsteht also nichts.

**`StyleguidePage`** — hinter `import.meta.env.DEV`, nie im Bündel.

**Die Schwellen-Texte** — alle drei `minTier` im Baum lauten `discover`, und
`MembershipGate`, `HeaderSearch`, `MemberDirectory` und `PublicProfilePage`
benennen ausschliesslich `CLUB_LEVEL`. Sie bleiben, wie sie sind; eine Änderung
wäre Arbeit ohne Wirkung.

## Die AGB

§3.2 zählt heute die **alten** Namen auf — Basic · Connect · Discover ·
Exchange · Focus · Impact — und ist seit AGE-903 nicht nachgezogen. Sie wird
auf Discover · Focus · Impact gekürzt (Donald, 29.09.).

Der Text trägt das aus sich heraus: der einleitende Satz lautet „Der Anbieter
bietet **derzeit insbesondere** folgende Mitgliedschaftsstufen an", und der
Absatz danach behält ausdrücklich das Recht vor, „zusätzliche Stufen
einzuführen". Eine Liste, die heute drei nennt und morgen fünf, ist damit
vorgesehen.

**Was hier nicht passiert:** keine andere Zeile der AGB wird angefasst. Der
Dateikopf hält fest, dass der Text von einer Kanzlei stammt und vollständig
übernommen ist; eine Kürzung an einer Aufzählung ist das Äusserste, was ohne
Rückfrage vertretbar ist — und sie steht hier, weil Donald sie ausdrücklich
entschieden hat.

## Die Blog-Geschichte

„Das Verzeichnis beginnt bei Connect" beschreibt eine Schwelle, die seit
AGE-903 bei DISCOVER liegt. Titel und Text nennen künftig Discover.

Das ist **keine Umschrift der Geschichte**, sondern eine Berichtigung: der Satz
war eine Aussage über den heutigen Zustand, und der hat sich geändert. Das
Archiv unter `openspec/changes/archive/` bleibt davon unberührt — dort steht,
was damals galt, und das ist dort auch richtig.

## Wie das geprüft wird

Die tragende Zusage ist eine **Verneinung**, und Verneinungen sind die
schwächste Sorte Test. Deshalb steht neben jeder eine Positivkontrolle:

* `levels.ts` führt weiterhin **sechs** Einträge — sonst wäre „nicht gelöscht"
  gebrochen, und der Test dazu ist die Positivkontrolle zum Rest.
* Ein Konto auf `discover` trägt eine Plakette; eines auf `active` keine. Beide
  Hälften, sonst bestünde die Zusage auch mit einer Plakette, die es nie gibt.
* Ein Wächter über dem gebauten Bündel: die Wörter `Active`, `Boost` und
  `Connect` kommen darin als Stufenname nicht mehr vor. Das ist die einzige
  Zusage, die **alle** Flächen auf einmal abdeckt — einschliesslich der, die
  ich beim Zählen übersehen habe.

Der letzte Punkt ist der wichtigste: neun Fundstellen habe ich gezählt, und die
Erfahrung dieses Projekts sagt, dass eine Inventur keine fehlende Stelle
findet. Ein Test gegen das Artefakt findet sie.
