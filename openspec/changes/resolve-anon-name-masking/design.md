## Context

Dieser Change schreibt eine Entscheidung fest und ändert keinen Produktionscode.
Das ist die ungewöhnlichste Eigenschaft daran, und sie ist auch das einzige
echte Risiko: Ein Change ohne Diff kann jede Behauptung aufstellen, ohne dass
irgendetwas widerspricht.

**Ausgangslage, gemessen am 2026-08-13:**

| Fläche | Stand |
|---|---|
| `src/lib/displayAuthor.ts` | Ausgeloggt „Ein Mitglied", kein Avatarbild |
| `src/lib/feed.ts` `fetchAuthors` | Ohne Session wird `profiles_public` nicht angefragt |
| `src/lib/events.ts` `hostsFor` | Ohne Session weder `profiles_public` noch `partners` |
| `HomePage.tsx` `PublicHome` | Events, öffentliche Beiträge, Testimonials, Kennzahlen — **keine Mitgliederliste** |
| `displayAuthor.test.ts` | 3 Fälle, mit Gegenprobe eingeloggt |
| `anon-anreicherung.test.ts` | Positivliste `ANON_DARF_LESEN` + Gegenproben |

Es gibt also heute **keine Fläche, auf der ein Gast einen Mitgliedsnamen sähe**.
Die Prämisse in AGE-291 („die öffentliche Startseite zeigt öffentliche Beiträge
und **Mitglieder**") trifft auf `PublicHome` nicht zu.

Offen war allein das stufenweise Auflösen nach Mitgliedsstufe, das der Spec als
„pending" führte. Es ist gestrichen.

## Goals / Non-Goals

**Goals:**

- Die Anforderung in `directory-search` sagt, was gilt, statt was fehlt.
- Die verworfene Alternative steht benannt und begründet im Spec, damit sie nicht
  als vergessene Lücke zurückkehrt.
- Das Geländer für neue anon-Flächen ist ausgesprochen — AGE-540 baut dagegen.
- Die Behauptung „das Verhalten steht schon und ist festgenagelt" wird **belegt**,
  nicht behauptet.

**Non-Goals:**

- Kein neues Verhalten, keine neue Testdatei, keine Migration.
- Keine Änderung an `HomePage.tsx` — auch nicht an den erfundenen Kennzahlen
  (`120+ Mitglieder`, `24 Events 2026`) und Testimonials. Sie sind im Proposal
  als Folgepunkt notiert; sie hier mitzunehmen wäre ein Cleanup im
  Entscheidungs-Commit.
- Kein neuer anon-Lesepfad, in keiner Richtung.

## Decisions

### 1. Der Beleg ist eine Mutationsprobe, kein neuer Test

Die Regel des Repos ist RED vor GREEN. Ein Change ohne Produktionsdiff hat
nichts, was rot werden könnte — und ein **neu geschriebener** Test, der sofort
grün ist, belegt nichts (es wäre genau der Vakuumtest, den dieses Repo schon
zweimal gefangen hat).

Der Beleg läuft deshalb andersherum: die **bestehenden** Tests werden einmal rot
gemacht, indem der Produktionscode vorübergehend kaputtgemacht wird, und danach
wieder grün, indem der Eingriff zurückgenommen wird. Das misst genau die Frage,
die dieser Change offen hat — **halten die Tests die Anforderung wirklich, oder
wären sie auch ohne sie grün?**

Drei Proben, eine je Aussage der Anforderung:

| Probe | Eingriff | Muss rot werden in |
|---|---|---|
| A — Anzeige | `displayAuthor` gibt auch ausgeloggt den echten Namen zurück | `displayAuthor.test.ts` |
| B — Daten | `fetchAuthors` fragt `profiles_public` auch ohne Session an | `anon-anreicherung.test.ts` |
| C — Positivliste | eine für `anon` gesperrte Relation zusätzlich ausgeloggt anfragen | `anon-anreicherung.test.ts` („Die Regel, nicht der Einzelfall") |

Probe C ist die wichtigste: sie prüft nicht das bekannte Verhalten, sondern ob
der **Wächter** einen bisher unbekannten Verstoß fängt. Sie ist der Grund, warum
das Geländer für AGE-540 überhaupt trägt.

Verworfene Alternative: die Aussagen einfach durch Lesen des Codes belegen. Das
ist genau die Bauweise, die in diesem Repo dreimal danebenlag — zuletzt bei
`service_role`, wo drei Testsuiten und zwei Reviews eine Lücke übersahen, die
erst die Sichtprobe fand.

Die Eingriffe werden **nicht committet**. Sie laufen im Arbeitsbaum, ihre Ausgabe
wird gelesen und in `tasks.md` festgehalten, dann per gezieltem
`git checkout -- <datei>` zurückgenommen — nie breit, weil der Arbeitsbaum hier
dauerhaft ungesicherte Dateien trägt.

### 2. REMOVED + ADDED statt MODIFIED

Der Kopf der alten Anforderung ist selbst die Falschaussage („is only partially
resolved"). Ein `MODIFIED`-Block mit umgeschriebenem Kopf fände beim Archivieren
das Original nicht mehr — dieselbe Falle, die dieses Repo bei Szenario-Titeln
schon getroffen hat. Also `REMOVED` mit `**Reason**` und `**Migration**`, plus
zwei `ADDED`-Anforderungen.

Verworfene Alternative: Kopf stehen lassen und nur den Rumpf drehen. Dann hieße
die laufende Wahrheit weiterhin „only partially resolved" und sagte das Gegenteil
ihres Inhalts.

### 3. Zwei Anforderungen, nicht eine

Die erste beschreibt den **Ist-Zustand** (zwei Ebenen, Anzeige plus Daten). Die
zweite ist eine **Regel für künftige Flächen**. Sie in eine zu gießen hieße, dass
jede spätere Änderung am Ist-Zustand die Regel mitanfasst — und die Regel ist das,
was AGE-540 trägt.

## Risks / Trade-offs

**Ein Change ohne Diff kann sich nicht irren, weil er nichts tut — und genau
deshalb kann seine Beschreibung falsch sein, ohne dass es auffällt.**
→ Die Mutationsprobe ist die Gegenmaßnahme. Ohne sie ist dieser Change ein
Meinungsbeitrag.

**Die Streichung des stufenweisen Auflösens kann als Sicherheitslücke gelesen
werden.**
→ Sie ist keine: die Stufen entscheiden über die Daten, nicht über die Anzeige.
Der Spec-Text sagt das ausdrücklich und nennt die verworfene Alternative. Wer
später anderer Meinung ist, findet die Begründung statt eines Lochs.

**Das Geländer für neue anon-Flächen ist eine Anforderung, kein Zwang.**
→ Es hängt an `anon-anreicherung.test.ts` und dessen Positivliste. Die trägt so
lange, wie ein neuer Lesepfad über `fetchFeed`/`fetchEvents`/`fetchComments`
läuft. Eine völlig neue Datei mit eigenem Supabase-Aufruf umginge sie. Das ist
benannt, nicht behoben — es zu beheben hieße, einen Lint-Wächter zu bauen, und
das ist ein eigener Change.

**Der Spec-Slot ist `directory-search`, obwohl die Maskierung im Feed sitzt.**
→ Bewusst: dort steht die alte Anforderung, und `community-feed` trägt bereits
die Feed-Seite derselben Sache (Zeile 464-494). Ein dritter Slot machte drei
Stellen aus zweien. Die neue Anforderung verweist auf beides.
