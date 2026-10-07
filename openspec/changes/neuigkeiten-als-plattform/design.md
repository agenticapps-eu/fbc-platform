# Design — Neuigkeiten als Absender

## Entscheidung 1: `posts.author_id` bleibt, wie es ist

Der naheliegende Weg wäre ein „Plattform-Konto" in `profiles`, dem die
Neuigkeiten gehören. Er ist der falsche, und der Grund ist gemessen: eine Zeile
in `profiles` steht **sofort** in `profiles_public` und damit im
Mitgliederverzeichnis, in der Suche und in jeder Zählung über Mitglieder. Jede
dieser Stellen müsste sie fortan ausnehmen — und jede neue Stelle, die jemand
später baut, müsste es wieder.

Die Urheberschaft bleibt deshalb in den Daten, wo sie für die Nachvollziehbarkeit
hingehört. Sie wird nur **nicht mehr angezeigt** und **nicht mehr gezählt**.
`author_id` bleibt `not null` mit seinem Fremdschlüssel; keine Migration am
Schema, nur an einer Funktion.

**Verworfen:** eine Spalte `absender text` auf `posts`. Sie wäre eine zweite
Wahrheit über dieselbe Sache — die Art des Beitrags steht schon in `kind`, und
zwei Felder, die dasselbe entscheiden, laufen auseinander.

## Entscheidung 2: Eine Positivliste, keine Ausschlussliste

Die Zählung nimmt `kind = 'member'` statt `kind not in ('release','event')`.

Das Ergebnis ist heute identisch, die Haltbarkeit nicht: ein vierter
Beitrags-Typ, den jemand später einführt, wird von der Ausschlussliste **still
mitgezählt** und von der Positivliste **still ausgelassen**. Still ist beides,
aber nur eine der beiden Richtungen schadet. Eine Liste der „aktivsten
Mitglieder", die versehentlich erzeugte Einträge mitzählt, ist genau der Fehler,
den dieser Change behebt — er darf nicht durch die Hintertür zurückkommen.

## Entscheidung 3: `security invoker` bleibt

`feed_top_authors` zählt `posts` unter den Rechten des Aufrufers, und beide
SELECT-Policies auf `posts` tragen `veroeffentlicht_ab <= now()`. Als DEFINER
zählte sie terminierte Beiträge mit. Das Sichtbarkeits-Prädikat wird **nicht**
in die Funktion kopiert; Kopien laufen auseinander. Diese Entscheidung stammt
aus AGE-1001 und wird hier nur nicht umgeworfen.

## Entscheidung 4: An der Karte wird NICHTS getan, und das ist ein Ergebnis

Die erste Lesart war, dass `ReleaseCard` den Mitgliedsnamen zeigt — sie zeichnet
schliesslich `post.author.name` und einen `Avatar`. Nachgemessen stimmt das
nicht: `feed.ts` ersetzt bei `kind = 'release'` den Autor durch
`absenderDerAnwendung()` (Name `eff.bee.zee`, kein Bild). Die Karte bekommt also
nie einen Mitgliedsnamen zu sehen. Gebaut mit AGE-718 am 11.09., und die Spec
verlangt es seit damals ausdrücklich.

Das steht hier, weil ein Entwurf auch festhalten muss, was er NICHT tut, und
warum. Die naheliegende Stelle sieht falsch aus; wer sie „repariert", baut die
Ersetzung ein zweites Mal — und zwei Fassungen derselben Ersetzung laufen
auseinander.

## Entscheidung 5: Der Konflikt mit AGE-1001 wird ein TEST, keine Notiz

Das ist die wichtigste Entscheidung dieses Entwurfs, und sie betrifft nicht den
Code, sondern die Reihenfolge.

`AGE-1001` (Branch `verzeichnis-dicht`, noch nicht gemerged) trägt in seiner
Migration einen **vollständigen** `create or replace` von `feed_top_authors` —
die Funktion musste dort umgebaut werden, weil ihr der Entzug von
`profiles_public` sonst die Grundlage nähme. Ihr Rumpf ist gegen den HEUTIGEN
Stand geschrieben, also **ohne** den Filter aus diesem Change.

Landet dieser Change zuerst und AGE-1001 danach, **überschreibt AGE-1001 den
Filter lautlos**. Nichts schlüge fehl; die Liste zählte wieder Neuigkeiten mit,
und niemand sähe es, bis es jemandem wieder auffällt.

Eine Notiz im Vorgang würde das nicht verhindern — Notizen werden gelesen, wenn
man sie sucht. Stattdessen bekommt dieser Change eine **pgTAP-Zusage**, dass
`feed_top_authors` Neuigkeiten und Veranstaltungs-Ankündigungen nicht mitzählt.
Sie wandert mit in die Suite, und auf dem Branch von AGE-1001 wird sie in dem
Moment rot, in dem dessen Migration den Filter wegnimmt. Der Konflikt kann sich
damit nicht mehr verstecken.

Dazu kommt die Reihenfolge der Migrationen: AGE-1001 trägt den Zeitstempel
`20261003160000`, dieser Change einen von heute. Wird dieser zuerst eingespielt,
käme AGE-1001 danach mit einem **älteren** Stempel — ausserhalb der Reihenfolge.
AGE-1001 ist nicht gemerged und nirgends ausser auf dem geteilten lokalen Stack
eingespielt; seine Migration SOLL deshalb vor dem Merge auf einen Stempel nach
diesem hier gezogen und ihr `feed_top_authors`-Rumpf um den Filter ergänzt
werden. Das steht als Aufgabe in AGE-1001, nicht hier — aber der Test, der es
erzwingt, steht hier.
