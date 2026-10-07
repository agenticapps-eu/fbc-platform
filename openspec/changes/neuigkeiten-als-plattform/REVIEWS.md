---
reviewers: [gemini, codex]
models: [gemini-3-pro, gpt-5.2-codex]
verdicts: [APPROVE, REQUEST-CHANGES]
reviewed_artifacts_sha: prompt-1004.txt, 376 Zeilen, 18892 Bytes
---

# Change review — neuigkeiten-als-plattform

## Ein erster Lauf zählt NICHT

Der erste Durchgang lief mit einem **kaputten Prompt**: im Skript, das ihn baute,
standen Backticks in doppelten Anführungszeichen, und die Shell hat sie als
Befehle ausgeführt. Dem Prompt fehlten damit die Werte von `kind`, die Policy auf
`posts` und die Grants — also genau der Kontext, über den geurteilt werden
sollte. Beide Reviewer wurden mit dem vollständigen Prompt neu gefahren;
gegengeprobt wurde, dass die beiden Kontextzeilen im Prompt wirklich stehen
(`grep -c`, nicht Augenmass).

Was unten steht, stammt ausschliesslich aus dem zweiten Lauf.

## Reviewer: gemini (gemini-3-pro)

VERDICT: APPROVE

- [LOW] Performance — der Entwurf analysiert den Abfrageplan des neuen Filters
  nicht. Index auf `posts.kind` erwägen und mit `EXPLAIN` messen.
- [LOW] Design — die Annahme, `feed_top_authors` sei die einzige Stelle mit
  einer solchen Zählung, ist nicht belegt.
- [LOW] Design — ist `kind` für Mitgliedsbeiträge wirklich immer `'member'`?
  (gemini beantwortet die Frage selbst mit ja und fordert keine Aktion.)

## Reviewer: codex (gpt-5.2-codex)

VERDICT: REQUEST-CHANGES

- [HIGH] `design.md` Entscheidung 5 — der pgTAP-Test erzwingt **keinen**
  Zeitstempel. CI baut frisch auf und spielt nach Version ein, dort läuft
  AGE-1001 zuerst und dieser Change danach: grün. Auf PROD ist die Reihenfolge
  umgekehrt, und dort überschreibt AGE-1001 die Funktion. Ein noch nicht
  nachgezogener AGE-1001-Branch hat den Test ausserdem gar nicht.
- [MEDIUM] `proposal.md` / Entscheidung 2 — der Ausschluss von Veranstaltungen
  dreht eine **ausdrückliche Entscheidung vom 25.08.** um. Donalds Wunsch
  betrifft Neuigkeiten, nicht Veranstaltungen.
- [MEDIUM] Umfang — der Potential Score zählt Beiträge ebenfalls je Autor, ohne
  `kind`-Filter. Übersehen.
- [MEDIUM] `tasks.md` — Ergebniszahlen vorher/nachher belegen keine Performance.
  Den Funktionsrumpf mit `EXPLAIN (ANALYZE, BUFFERS)` messen; einen partiellen
  Index erst anhand der Pläne erwägen, bei 44 Beiträgen kein belegter Bedarf.
- [MEDIUM] Spec-Delta — „SHALL fünf Mitglieder" widerspricht dem eigenen
  Ergebnis (drei bleiben übrig). Das Gegenprobe-Szenario gilt nicht allgemein:
  ein Autor ausserhalb der Top fünf hat dort keine Zahl, ein terminierter
  Beitrag erhöht sie nicht.
- [LOW] Spec-Delta — Produktionszahlen und die Behauptung, ein Plattformprofil
  stünde „sofort" im Verzeichnis, vermischen historische Begründung mit
  dauerhaftem Verhalten.

## Nicht gezählt

Keiner. Beide Reviewer liefen mit Exit 0, verschiedene Anbieter, keiner davon
der eigene.

## Resolution

Jeder Befund ist **nachgemessen** worden, bevor er übernommen oder verworfen
wurde.

### [HIGH] Die Reihenfolge — übernommen, Massnahme verdreifacht

Der Befund ist richtig, und die Begründung ist der Teil, den ich nicht hatte:
CI und PROD spielen in **verschiedener** Reihenfolge ein, und ein Test im
Neuaufbau kann den PROD-Fall gar nicht sehen. Entscheidung 5 ist umgeschrieben.
Die Absicherung ist jetzt dreiteilig: der Test als Wächter, das **Umhängen des
Zeitstempels** von AGE-1001 als eigentliche Massnahme, und die Messung **beider**
Richtungen (Neuaufbau und Hochrüsten) als Beleg. Steht zusätzlich als Aufgabe in
AGE-1001.

### [MEDIUM] Veranstaltungen — übernommen, der Entwurf war falsch

Nachgelesen, Wort für Wort, im Kopf von `20260824170000`:

> ENTSCHIEDEN am 25.08. (Donald): gezählt werden ALLE sichtbaren Beiträge, also
> auch die `kind = 'event'`-Beiträge … ein Verein, der Veranstaltungen
> ausrichtet, hält das Ausrichten für Aktivität.

Der Kopf nennt sogar die Fixzeile vorweg (`and p.kind = 'member'`) und ihren
Preis. Mein Entwurf hätte diese Entscheidung stillschweigend umgedreht, an einer
Beschwerde vorbei, die Neuigkeiten betraf. **Donald am 07.10.: die Entscheidung
vom 25.08. bleibt.** Die Bedingung ist jetzt `kind in ('member', 'event')` —
weiterhin eine Positivliste.

Wirkung dadurch: Konto A 23 → 0 (fällt aus der Liste, das Anliegen ist gelöst),
Konto B 18 → 18 statt 11.

### [MEDIUM] Der Potential Score — bestätigt, eigener Vorgang

Gefunden und nachgemessen. `recompute_potential_score` zählt in seiner
Aktivitäts-Dimension `count(*) from public.posts where author_id = …` ohne
`kind`-Filter. Die Folge, auf PROD gerechnet:

| Konto | Score heute | Aktivität heute | ohne Neuigkeiten |
| ----- | ----------- | --------------- | ---------------- |
| 1     | 28          | 32              | **9**            |
| 2     | 59          | 41              | 34               |
| 3     | 56          | 10              | 10               |
| 4     | 49          | 9               | 9                |

Donald am 07.10.: **eigener Vorgang.** Ein Score, der sich über Nacht ändert,
überrascht ein Mitglied mehr als eine Rangliste und verdient eine eigene
Entscheidung samt Hinweis. Nicht in diesen Change gezogen.

### [MEDIUM/LOW] Performance — gemessen, und der Index ist WIDERLEGT

Beide Reviewer fragen danach, gemini fordert einen Index. Gemessen auf PROD mit
`EXPLAIN (ANALYZE, BUFFERS)`, derselbe Rumpf einmal mit und einmal ohne Filter:

|                | heute (ohne Filter)        | nachher (mit Filter)             |
| -------------- | -------------------------- | -------------------------------- |
| Kosten         | 32,10                      | **18,07**                        |
| Puffer         | 74                         | **71**                           |
| Ausführung     | 1,261 ms                   | **0,842 ms**                     |
| Plan           | Hash Join, 2× Seq Scan     | Nested Loop, Index Scan auf `profiles_pkey` |

Der Filter macht die Abfrage **billiger**, nicht teurer: er reduziert die Zeilen,
die in den Verbund gehen, und der Planer wechselt deshalb von Hash Join auf
Nested Loop mit Indexzugriff. Ein Index auf `posts.kind` wird vom Planer bei 44
Zeilen ohnehin nicht gewählt — er kommt **nicht** in diese Migration. Codex
kommt unabhängig zum selben Schluss („bei 44 Beiträgen besteht kein belegter
Indexbedarf"). Falls `posts` je so wächst, dass es zählt, wäre der hilfreiche
Index ein **partieller** auf `(author_id) where kind in ('member','event')` —
und auch das erst nach einer Messung, nicht vorsorglich.

### [LOW] Die zweite Zählstelle — gesucht und gefunden

gemini fordert die Code-Suche ein, die der Entwurf behauptet hatte, ohne sie zu
zeigen. Durchgeführt, über Migrationen, `src/` und den Funktionskatalog:
`feed_top_authors`, `post_engagement_counts` und `recompute_potential_score`
aggregieren über `posts`. Nur die erste und die dritte zählen je Autor; die
dritte ist der Befund darüber. `post_engagement_counts` zählt je Beitrag und ist
nicht betroffen.

### [MEDIUM] Spec-Delta, Listenlänge und Gegenprobe — übernommen

„SHALL fünf" ist auf „**bis zu fünf**, jedes mit mindestens einem sichtbaren
zählenden Beitrag" präzisiert; der Widerspruch zum eigenen Ergebnis ist damit
weg. Das Gegenprobe-Szenario gilt jetzt für ein **bereits gelistetes** Mitglied
und einen **veröffentlichten, sichtbaren** Beitrag, und ein eigenes Szenario
hält fest, dass ein terminierter Beitrag die Zahl nicht erhöht.

### [LOW] Spec-Delta, Messwerte in der Anforderung — übernommen

Die Produktionszahlen und das „sofort im Verzeichnis" stehen nicht mehr in der
dauerhaften Anforderung. Die Begründung gegen ein Plattform-Konto ist auf das
reduziert, was dauerhaft gilt: eine Profilzeile ist eine Mitgliedszeile.

### [LOW] `kind` immer `'member'` bei Mitgliedsbeiträgen

gemini beantwortet die Frage selbst und fordert keine Aktion. Gegengeprüft:
`kind` nimmt genau die drei Werte an, und der Schreibweg für einen
Mitgliedsbeitrag setzt `'member'`. Keine Änderung.
