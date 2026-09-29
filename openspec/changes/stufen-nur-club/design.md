# Entwurf — stufen-nur-club (AGE-969)

## Die eine Entscheidung, die alles andere trägt

**Sichtbarkeit und Recht sind zwei Dinge, und sie bekommen zwei Konstanten.**

Der naheliegende Griff wäre, die genannten Stufen aus `CLUB_RANK` abzuleiten:

```ts
const GENANNT = LEVEL_ORDER.filter((k) => LEVELS[k].rank >= CLUB_RANK);
```

Heute ergäbe das genau die richtige Menge — und es wäre trotzdem falsch.

*Die erste Fassung dieses Absatzes begründete das falsch,* und der Fremdreview
hat es gefangen: sie behauptete, ein gesenktes `CLUB_RANK` „schaltete das
Verzeichnis für BOOST frei". Das stimmt nicht. `has_level(4)` steht in den
SQL-Policies und bliebe hart; die Datenbank gäbe nichts heraus.

**Was tatsächlich passierte, ist subtiler und schlimmer:** Oberfläche und RLS
liefen auseinander. Das Verzeichnis sähe für BOOST *erreichbar* aus, der Knopf
wäre offen, und die Datenbank verweigerte die Antwort. Ein Mitglied bekäme
einen Fehler statt einer Absage, und niemand wüsste auf Anhieb, welche der
beiden Seiten recht hat.

Deshalb: **eine eigene Liste**, die heute deckungsgleich ist, und die richtige
Abhängigkeitsrichtung — die Anzeige hängt an keiner Rechtegrenze. Wenn BOOST
zurückkommt, ändert sich eine Liste; wenn der Club anderswo beginnt, ändert
sich `CLUB_RANK`. Nie beides durch einen Griff.

*Verworfen — `LEVEL_ORDER` kürzen:* das wäre Löschen, und Donald hat
ausdrücklich das Gegenteil gesagt. Ausserdem liest `levelLabel` daraus, und die
Admin-Einzelbearbeitung braucht den Namen einer gesetzten niedrigeren Stufe
weiterhin.

*Verworfen — ein Schalter zur Laufzeit:* eine Anzeigeentscheidung, die kippen
kann, verlangt, dass jede Fläche beide Fälle aushält, und eine Zusage könnte
dann nur noch „je nachdem" lauten.

## Was an die Stelle eines Namens tritt — ausgeschrieben

Beide Reviewer haben hier dasselbe beanstandet, und sie haben recht: die erste
Fassung sagte nur, was **nicht** dastehen darf. Der Satz, der stattdessen
dasteht, ist aber der einzige sichtbare Inhalt dieses Change — und ihn sieht
die einzige Gruppe, die **wächst**: Selbstregistrierungen landen auf `active`,
der Kaufweg ruht, von dort führt kein Weg nach oben.

**Ein Zugangssatz, der die Sackgasse verschweigt, wäre genau das Verschweigen,
das dieser Change an anderer Stelle vermeidet.** Also steht er ausgeschrieben
in der Spec, mit Kontaktweg:

> **Dein Konto ist bestätigt.**
> Der Clubzugang beginnt bei Discover. Eine Stufe lässt sich hier zurzeit nicht
> selbst buchen — schreib uns über **Support › Feedback**, dann melden wir uns.

| Stelle | heute | künftig |
|---|---|---|
| `TierBadge` | `Active` | **nichts** — die Plakette entfällt |
| Einstellungen, Karte „Mitgliedschaft" | `Active-Mitglied` | der Zugangssatz oben |
| `ProfileHero` | `Active Member` | nichts |
| Dashboard-Kachel „Mitgliedschaft" | `Active` | `—`, darunter „Clubzugang ab Discover" |
| Verzeichnis-Karte | `Active` | nichts |
| `MembershipSummary` | `Active` + „Nächster Schritt: Boost" | der Zugangssatz, keine nächste Stufe |

**Die Plakette entfällt, sie wird nicht leer.** Ein sichtbarer Kasten ohne
Inhalt liest sich als Fehler; `TierBadge` liefert `null`. Dass die sechs
Aufrufstellen das vertragen, ist zu **prüfen**, nicht anzunehmen — je Stelle
eine Zusage.

**Der Kontaktweg ist Support › Feedback**, nicht eine Adresse im Text. Den
Bereich gibt es seit AGE-904 in der Seitenleiste, er ist ohne Stufe erreichbar,
und eine Rückmeldung von dort eröffnet ein Gespräch mit der Administration. Eine
Mailadresse im Text wäre ein zweiter Weg, der gepflegt werden müsste.

## Der Wächter — und warum die erste Fassung unbaubar war

Die erste Fassung versprach einen Test über dem **gebauten Bündel**: die Wörter
Active, Boost und Connect kommen darin nicht vor. Der Fremdreview hat gezeigt,
dass diese Zusage **ab dem ersten Build falsch** ist, und zwar aus drei Gründen,
die alle in diesem Change selbst stehen:

1. `levels.ts` behält alle sechs Einträge **samt Labels** — ausdrücklich. Die
   Datei wird von Mitgliederkomponenten importiert, die Strings liegen also
   zwingend im Bündel.
2. Die Admin-Einzelbearbeitung **muss** den Namen einer gesetzten niedrigeren
   Stufe anzeigen können. `levelLabel("active")` bleibt also nötig.
3. `release-entries.generated.ts` behält sieben Vorkommen **absichtlich** und
   ist Teil desselben Builds.

Ein Wächter, der Rollen nicht unterscheiden kann, kann diese drei nicht von
einer echten Fundstelle trennen. Er wäre ab Tag eins rot oder müsste eine
Ausnahmeliste führen — und eine Ausnahmeliste ist wieder genau die Inventur,
die er ersetzen sollte.

**Die ehrliche Fassung misst die gerenderten Mitgliederansichten, nicht das
Bündel.** Ein Test rendert die betroffenen Flächen zweimal — einmal mit einem
Konto auf `active`, einmal mit einem auf `discover` — und prüft:

* auf `active`: keiner der drei Namen kommt im gerenderten Text vor, und der
  Zugangssatz steht da;
* auf `discover`: die Plakette trägt „Discover".

Das ist die Zusage, die die Sichtprobe ohnehin von Hand geprüft hätte, nur
automatisiert. Sie deckt weniger ab als das Versprechen der ersten Fassung —
und sie ist einlösbar.

**Was sie nicht sieht, steht im Testkopf**, statt verschwiegen zu werden:
Inhalte, die ein Admin zur Laufzeit pflegt (Beiträge, Events, Neuigkeiten), und
Flächen ausserhalb von React.

## Die Inventur, jetzt vollständig

Der Fremdreview hat zu Recht beanstandet, dass „jede Fläche, die ein Mitglied
erreichen kann" mehr ist als `src/`. Nachgemessen am 29.09.:

| Fläche | Befund |
|---|---|
| Mailtexte (`send-activation/emails.ts` u. a.) | **kein** Stufenname |
| Edge Functions | Treffer nur in Tests, Kommentaren und dem ruhenden Kaufweg (`level`-Schlüssel, nicht gerendert) |
| Native Hülle | `capacitor.config.ts` liefert `webDir: "dist"` — **dasselbe Bündel**, keine eigene Fläche |
| Blog | liest `release-geschichten.ts`; ein Treffer, der Slug heisst `2026-09-02-rechte-matrix-stufen` und trägt den Namen **nicht** |
| Zur Laufzeit gepflegte Inhalte | nicht prüfbar, benannt statt verschwiegen |

Damit trägt die Anforderung „Anwendung, native Hülle und Blog" — die Hülle,
weil sie dasselbe Bündel ausliefert, und das ist gemessen statt angenommen.

## Der Stolperdraht, der sich selbst erklärt

Ein Test, der die heutige Deckungsgleichheit von genannter Menge und Clubstufen
festhält, **soll** beim angekündigten „BOOST kommt zurück" fallen. Ohne
Erklärung ist das ein Stolperdraht: in sechs Monaten fällt er, niemand weiss
warum, und er wird stillschweigend gelöscht.

Er bekommt deshalb eine Fehlermeldung, die den nächsten Bearbeiter anleitet —
was der Test festhält, warum er fällt, und was zu tun ist. Ein Test ohne diese
Meldung wäre hier schlechter als ein Kommentar.

## Die AGB

§3.2 zählt heute die **alten** Namen auf — Basic · Connect · Discover ·
Exchange · Focus · Impact — und ist seit AGE-903 nicht nachgezogen. Die
Änderung ist damit **zweierlei**, und beides gehört in die Kopf-Notiz: eine
Kürzung auf die angebotenen Stufen **und** die Berichtigung zweier Namen, die
es nicht mehr gibt.

Der Text trägt die Kürzung aus sich heraus: er leitet mit „Der Anbieter bietet
**derzeit insbesondere** folgende Mitgliedschaftsstufen an" ein, und der Absatz
danach behält ausdrücklich das Recht vor, „zusätzliche Stufen einzuführen".
Sachlich stimmt die kürzere Liste sogar besser: ACTIVE, BOOST und CONNECT
tragen 0 € und keine Clubfunktion — sie werden nicht *angeboten*, sondern
technisch zugewiesen.

**Was hier nicht passiert:** keine andere Zeile wird angefasst. Der Dateikopf
hält fest, dass der Text von einer Kanzlei stammt und vollständig übernommen
ist; er bekommt einen Vermerk, was auf wessen Entscheidung geändert wurde.
**Und als Annahme benannt:** dass eine Kürzung an dieser Aufzählung ohne
Rückfrage bei der Kanzlei vertretbar ist. Das ist die Einschätzung eines
Nichtjuristen.

## Was diese Änderung NICHT leistet

**Sie ist Oberflächenkosmetik, und das soll dastehen.** Das Repo ist
öffentlich: `levels.ts`, die Historie der AGB und dieser Change selbst nennen
alle sechs Stufen weiterhin. „Nirgends mehr auftauchen" gilt für das, was ein
Mitglied in der Anwendung sieht — nicht für das, was jemand im Quelltext liest.

**Die Prämisse „niemand steht unterhalb des Clubs" zerfällt am Tag nach dem
Merge.** Sie hing an einer einmaligen Bereinigung; die nächste
Selbstregistrierung stellt den Zustand wieder her. Genau deshalb ist der
Zugangssatz oben ausgeschrieben und nicht dem Zufall überlassen — er ist der
Dauerzustand, nicht die Ausnahme. Wer diese Konten laufend hochzieht, ist eine
Betriebsfrage und steht ausdrücklich **nicht** in diesem Change.
