# Design

## Warum `REMOVED` + `ADDED` für die kuratierten Lektionen, aber `MODIFIED` für den Rest

Ein `MODIFIED`-Block muss **jedes** Szenario der bestehenden Anforderung
enthalten, und `openspec archive` ordnet sie über ihre **Überschrift** zu. Ein
umbenanntes Szenario findet es nicht mehr und bricht ab, statt es still zu
löschen (gemessen am 09.08. bei `member-activation-flow`). Ein Szenario lässt
sich durch `MODIFIED` also nicht entfernen — nur sein Rumpf lässt sich ändern.

Daraus folgt der Zuschnitt:

| Anforderung | Instrument | Grund |
| --- | --- | --- |
| `Academy lists curated video lessons` | **`REMOVED` + `ADDED`** | Ihr Szenario „Der kuratierte Block steht über den geteilten Videos" wird **falsch**. Ein Szenario, dessen Aussage stirbt, kann nur mit seiner Anforderung gehen. |
| `Die Academy zeigt geteilte Videos in zwei Reitern` | `MODIFIED` | Der Titel bleibt **wahr**: es sind weiter genau zwei Reiter für geteilte Videos. Nur die Ortsangabe „unterhalb des kuratierten Blocks" ändert sich. Alle fünf Szenarien bleiben Wort für Wort. |
| `Die Academy hat Suche, Hashtags und Sortierung in einer rechten Spalte` | `MODIFIED` | Titel und Zweck bleiben. Zwei Klauseln ändern sich. |

### Der `REMOVED`-Block, klauselweise geprüft

Ein `REMOVED` nimmt **alle** Klauseln mit, auch die weiter wahren. Jede wird
deshalb einzeln entschieden, nicht der Block als Ganzes:

| Klausel der alten Anforderung | Schicksal |
| --- | --- |
| Feste, im Code definierte Liste; Titel, Beschreibung, Einbettung je Lektion | **übernommen** |
| Die Plattform hostet kein Video selbst | **übernommen** |
| Einwilligungstor des Design-Systems, **keine Ausnahme** für die Academy | **übernommen** |
| Bleibt Konstante im Code, wandert nicht in die Datenbank — samt Begründung (drei redaktionelle Videos sind kein Inhaltsmodell; ein Kurs-Schema wäre AGE-262) | **übernommen** |
| „Redaktioneller Block **oben**, oberhalb der geteilten Videos" | **ersetzt** — dritter Reiter |
| Szenario „Academy shows the curated lessons" | **übernommen**, Rumpf um den Streifen ergänzt |
| Szenario „Der kuratierte Block steht über den geteilten Videos" | **ersetzt** durch „Die Redaktion ist der dritte Reiter" |
| Szenario „Eine kuratierte Lektion lädt den Anbieter nicht ungefragt" | **übernommen**, Wortlaut unverändert |

### Eine Überschrift bleibt bewusst ungenau

`#### Scenario: Die kuratierten Lektionen bleiben oben` in der Spalten-Anforderung
behält ihren Titel, obwohl „oben" nach diesem Change „im dritten Reiter" heißt.
Ihre **Aussage** ist eine andere und bleibt richtig: die Redaktion steht *nicht
in der Spalte*, wird also nicht gefiltert. Der Rumpf sagt das künftig genau.

Der Titel wandert nicht mit, weil er der Schlüssel ist — ihn zu schärfen kostete
das Szenario beim Archivieren. Das ist der bewusst gezahlte Preis, hier
aufgeschrieben, damit der Nächste ihn nicht für ein Versehen hält.

## Der Rasterrahmen

Heute (`AcademyPage.tsx`):

```
<div flex-col gap-8>
  <FormatHero/>
  <section> Aus der Redaktion </section>   ← full-width, über allem
  <Tabs>  Alle → <GeteilteVideos mitFilter>  ← Spalte steckt HIER drin
          Meine → <MeineAcademy>              ← und fehlt hier ganz
```

Künftig, nach dem Muster der Aktivität:

```
<div flex-col gap-8>
  <FormatHero/>
  <FilterSpalte filter={…}>          ← Raster um Reiterzeile UND Inhalt
    <Tabs>  Alle · Meine Academy · Redaktion
```

`FilterSpalte` trägt die vier Sticky-Bedingungen aus AGE-626 bereits
(`lg:sticky`, `lg:top-20`, `lg:self-start`, `lg:max-h` + `overflow-y-auto`) und
wird nicht angefasst — sie bekommt nur einen anderen Platz im Baum.

## Die Felder folgen dem aktiven Reiter

Suche und Sortierung wirken auf `posts`. Die Redaktion ist eine Konstante im
Code; ein Suchfeld, das sie nicht durchsucht, wäre eine Lüge an der Oberfläche.
Die Spalte steht deshalb seitenweit, führt ihre Felder aber nur für die beiden
Reiter, auf die sie wirken, und auf dem Redaktionsreiter einen Satz, der sagt
warum.

Verworfen: die Spalte auf dem Redaktionsreiter ganz auszublenden. Dann spränge
die Inhaltsbreite beim Reiterwechsel um 16rem — genau das Zappeln, gegen das
AGE-629 die Behälter-Schwellen eingezogen hat.

## Der Streifen

Video links mit fester Spaltenbreite, Text rechts. Unterhalb der
Behälter-Schwelle fällt der Streifen in die heutige Anordnung zurück
(Video oben, Text darunter) — ein 200-px-Video neben zwei Wörtern Text ist
kein Streifen mehr.

Die Schwelle ist eine **Behälter**-Abfrage, keine Fenster-Abfrage: die Kachel
steht in einem Raster, das die Filterspalte verengt. Das ist die Lektion aus
AGE-629, und `kartenraster.test.ts` hält sie fest — es zählt
`AcademyPage.tsx` bereits zu den drei Kartenflächen.

## Risks

- **Der Wächter `kartenraster.test.ts` sieht `AcademyPage.tsx`.** Jede
  Spaltenzahl mit Viewport-Präfix macht ihn rot. Der Streifen darf seine
  Schwelle also nur als `@[…]` schreiben.
- **`openspec archive` ist die einzige Kontrolle** für die Szenario-Zuordnung;
  `validate` sieht sie nicht. Schritt 6 ist deshalb kein Formalakt.
- **Die Reiterreihenfolge ist eine Entscheidung, keine Ableitung.** Donald hat
  „Alle · Meine Academy · Redaktion" gewählt und die Alternative (Redaktion
  zuerst) ausdrücklich verworfen.
