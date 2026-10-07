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

## Entscheidung 2: Nur die Neuigkeiten fallen raus — Veranstaltungen bleiben

Der erste Entwurf nahm `kind = 'member'` und hätte damit auch
Veranstaltungs-Ankündigungen ausgeschlossen. Das war **falsch**, und der Befund
kam aus der Plan-Review (codex, MEDIUM): der Kopf der ursprünglichen Migration
hält eine ausdrückliche Entscheidung fest.

> ENTSCHIEDEN am 25.08. (Donald): gezählt werden ALLE sichtbaren Beiträge, also
> auch die `kind = 'event'`-Beiträge, die der Trigger dem Gastgeber anlegt. […]
> *Warum mitzählen:* ein Event-Beitrag steht als Karte IM Feed. Wer ihn dort
> sieht, sieht eine Aktivität dieses Mitglieds […] Und ein Verein, der
> Veranstaltungen ausrichtet, hält das Ausrichten für Aktivität.
> *Der Preis:* ein Gastgeber vieler Veranstaltungen steht weiter oben, ohne je
> etwas geschrieben zu haben.

Die Beschwerde, die diesen Change ausgelöst hat, betrifft **Neuigkeiten**, nicht
Veranstaltungen. Eine Produktentscheidung nebenbei umzudrehen, weil die
naheliegende Bedingung sie mit erfasst, wäre genau die Art von stillem
Mitnehmen, die dieser Entwurf an anderer Stelle ablehnt. Am 07.10. bestätigt:
die Entscheidung vom 25.08. bleibt.

Die Bedingung lautet deshalb **`kind in ('member', 'event')`**.

**Es bleibt eine Positivliste**, und das ist der zweite Teil der Entscheidung.
`kind <> 'release'` hätte heute dasselbe Ergebnis und nicht dieselbe
Haltbarkeit: eine vierte Beitragsart, die jemand später einführt, würde von
einer Ausschlussliste **still mitgezählt** und von der Positivliste **still
ausgelassen**. Still ist beides, aber nur eine der beiden Richtungen bringt den
Fehler zurück, den dieser Change behebt.

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

**Und der Test allein genügt nicht — das ist der Befund der Plan-Review
(codex, HIGH), und er ist richtig.**

Die Begründung ist unangenehm präzise: CI baut die Datenbank **frisch** auf und
spielt die Migrationen in der Reihenfolge ihrer Zeitstempel ein. AGE-1001 trägt
den `20261003160000`, dieser Change einen von heute — im Neuaufbau läuft
AGE-1001 also ZUERST und dieser Change danach. Der Filter steht am Ende da, der
Test ist grün. **Auf PROD ist die Reihenfolge die umgekehrte**, weil dieser
Change zuerst gemerged und eingespielt wird: dort käme AGE-1001 hinterher und
überschriebe die Funktion. Ein Test, der nur im Neuaufbau läuft, kann diesen
Unterschied nicht sehen.

Dazu kommt: ein AGE-1001-Branch, der noch nicht nachgezogen ist, hat diesen Test
überhaupt nicht.

Die Absicherung ist deshalb **dreiteilig** und nicht einteilig:

1. Der pgTAP-Test wandert mit und wird rot, sobald der Filter fehlt — er fängt
   den Fall, dass jemand die Funktion anfasst, **nachdem** beide Changes da
   sind.
2. AGE-1001s Migration bekommt **vor** ihrem Merge einen Zeitstempel **nach**
   diesem Change, und ihr `feed_top_authors`-Rumpf trägt den Filter. Damit ist
   die Reihenfolge in beiden Richtungen dieselbe. Das ist die eigentliche
   Massnahme; der Test ist ihr Wächter, nicht ihr Ersatz.
3. Beides wird **gemessen, nicht angenommen**: einmal im Neuaufbau (`db reset`
   gegen eine leere Datenbank) und einmal im Hochrüsten (ein Stand, auf dem
   dieser Change schon liegt, bekommt AGE-1001 nachgereicht). Erst wenn die
   Funktion in BEIDEN Fällen den Filter trägt, ist die Sache erledigt.

AGE-1001 ist nicht gemerged und nirgends ausser auf dem geteilten lokalen Stack
eingespielt — das Umhängen ist deshalb erlaubt und kostet nichts.
