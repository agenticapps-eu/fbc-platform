---
reviewers: [gemini, codex]
models: [gemini (Modell nicht aufgeloest), "codex gpt-6-astra"]
verdicts: [APPROVE, REQUEST-CHANGES]
reviewed_artifacts_sha: 6c680ce82706e766f7248f74fbcf46652c3751691f16de857aaf1fbd7fe3e733
---

# Change review — oeffentlicher-release-blog

Zwei Anbieter, ein APPROVE und ein REQUEST-CHANGES, 11 Befunde. Der Review lief
am 08.09. gegen Fassung 1 der Artefakte (Digest oben, 642 Zeilen). Alles unten
ist in Fassung 2 eingearbeitet oder mit Grund abgelehnt.

**Claude war ausgeschlossen** — es hat diesen Change geschrieben, und ein Host
darf seinen eigenen Change nicht reviewen.

**Das Modell hinter `gemini` liess sich nicht auflösen.** Der Wrapper gab keine
`MODEL:`-Zeile aus, und die Ausgabe trug keinen Modellnamen. Nach Regel 4 dieses
Schrittes ist das ein Mangel: zwei Arme auf dasselbe Modell wären eine Meinung
mit zwei Namen. Hier fällt es nicht ins Gewicht, weil der zweite Reviewer
(`gpt-6-astra`) nachweislich ein anderer Anbieter ist — aber es ist nicht
belegt, sondern nur nicht widerlegt.

## Reviewer: codex (gpt-6-astra)

VERDICT: REQUEST-CHANGES

- **[HIGH] release-blog + admin — Die Anforderungen widersprechen sich.** Das
  Repository soll die einzige Verfassungsstelle sein und die Zustellung eine
  Abschrift, aber ein Admin darf den Text vollständig überschreiben; diese
  Fassung bliebe nur in der Datenbank und stellte genau das Problem wieder her,
  das der Change beheben will.
- **[HIGH] design §2, tasks §1/§5 — Kein Skript im Artefakt verhindert kein
  PII.** Personenbezogene Angaben können in das kuratierte Modul geraten und
  sind über das öffentliche Repository dauerhaft offengelegt. Die
  vorgeschlagenen Artefakt-Prüfungen liefen grün darüber hinweg.
- **[MEDIUM] proposal/Why, design §4, tasks §5 — Die Geschichten setzen ein
  Vorher voraus.** „ohne Doppelungen“, „beide Leisten … derselbe Pill“, „der
  Feed-Umbau“ — obwohl die erklärte Absicht ist, eine unbekannte App
  einzuführen. Ausserdem belegt ein Archiveintrag nicht, dass das Verhalten
  heute noch besteht oder für jede Stufe gilt.
- **[MEDIUM] design §4 vs. release-blog/Übersicht — Thematisch oder
  chronologisch?** Das Design verspricht Themen, die Anforderung schreibt
  „jüngste zuerst“, und im Modell steht kein Themenfeld. Das sind zwei
  verschiedene Navigationen.
- **[MEDIUM] design §2, tasks 2.2–2.4 — Die Suche nach `supabase` und
  `<script>` belegt die Zusage nicht.** Ereignis-Attribute, `javascript:`,
  Rahmen und externe Stile entkommen ihr. Und nur der Rumpf wird maskiert —
  Titel und Slug sind unbestimmt.
- **[MEDIUM] tasks §4–§5 — Die Auslieferung steht vor dem Schreiben und der
  Freigabe.** Ein Commit könnte einen Entwurf veröffentlichen, bevor 5.3 ihn
  abnimmt. Es gibt keinen Veröffentlichungszustand.
- **[MEDIUM] design §1/§3, tasks §3 — Wie mehrere Geschichten eine Nachricht
  werden, ist unbestimmt.** Die Umsetzung könnte Entwicklertitel behalten oder
  ganze Geschichten in die Aufzählungsvorlage pressen und die drei
  vorgeschlagenen Tests trotzdem bestehen.
- **[MEDIUM] release-blog/Offline-Szenario — Verspricht mehr als geliefert
  wird.** Eine statische Seite „ohne Netzwerkzugriff“ zu öffnen ist unmöglich;
  statisches HTML beseitigt Laufzeit-Datenabhängigkeiten, macht die Seite aber
  nicht offline verfügbar.

## Reviewer: gemini (Modell nicht aufgeloest)

VERDICT: APPROVE

- **[LOW] design §1** — Ein einzelnes Modul für alle Geschichten kann mit der
  Zeit unhandlich werden. Schwelle nennen oder als Schuld benennen.
- **[LOW] design §5** — Der Schutz vor versehentlich veröffentlichten internen
  Angaben hängt an Sorgfalt; ein ausdrücklicher Prüfschritt fehlt.
- **[LOW] tasks §5** — Der redaktionelle Ablauf ist unbestimmt: bearbeitet der
  Redakteur die TypeScript-Datei selbst?

## Auflösung

| Befund | Erledigt |
| --- | --- |
| HIGH Widerspruch | **Eingearbeitet.** Der Satz „SHALL NOT denselben Text an zwei Stellen unabhängig pflegen“ ist raus. An seine Stelle tritt die Unterscheidung, die vorher fehlte: **der Blog liest die Datei, die Zustellung ist ein Ereignis.** Eine vor dem Versand geänderte Fassung gilt für diesen Versand, wirkt nicht zurück, erscheint nie im Blog. Neues Szenario in beiden Deltas. |
| HIGH PII | **Eingearbeitet.** Neue Anforderung „Eine veröffentlichte Geschichte trägt keine personenbezogenen Daten“, neuer Proposal-Abschnitt 4, Wächter als Aufgabe 1.6 und ein Durchgang von Hand als 4.4 — **vor dem Commit**, weil das Repository öffentlich ist. Der Wächter ist ausdrücklich als Netz benannt, nicht als Zusage: einen Klarnamen erkennt er nicht. |
| MEDIUM Vorher-Annahme | **Eingearbeitet.** Neue Anforderung „führt in eine Funktion ein und berichtet keine Änderung“; alle 23 Titel in `design.md` §4 umgeschrieben; drei Fragen je Geschichte (wozu, wie heute, ab welcher Stufe). Prüfung gegen Anforderung **und** Anwendung gilt jetzt für alle 23, nicht nur die zwei leeren. |
| MEDIUM Themen vs. Datum | **Eingearbeitet.** `thema` steht im Modell, die Anforderung gliedert nach Thema und ordnet **innerhalb** eines Themas jüngste zuerst. Test 2.1 zieht nach. |
| MEDIUM Wächter zu schwach | **Eingearbeitet.** Aus der Verbotsliste wird eine **Erlaubnisliste** (Elemente und Attribute aufgezählt, `href` nur mit `/`-Anfang). Aufgabe 2.4 rötet zuerst gegen vier untergeschobene Gestalten — drei davon hätte die alte Suche durchgelassen. Jedes Feld wird maskiert, der Slug zusätzlich als Pfadbestandteil geprüft. |
| MEDIUM Deploy vor Freigabe | **Eingearbeitet.** Die Blöcke sind vertauscht: Texte und Freigabe sind jetzt §4, die Auslieferung §5. Dazu ein `freigegeben`-Merker im Modell und die Zusage, dass Nichtfreigegebenes im Repository liegen darf, ohne öffentlich zu sein. |
| MEDIUM Zusammensetzung | **Eingearbeitet.** Regeln in `design.md` §3 und im Admin-Delta: ein Eintrag → sein Titel und sein Text ohne Vorlage; mehrere → Listenreihenfolge, eigene Überschriften, Absätze erhalten. Neue Aufgabe 3.2 mit der Begründung, warum 3.1 allein grün sein könnte. |
| MEDIUM Offline überversprochen | **Eingearbeitet.** Das Szenario heisst jetzt „braucht nach dem Laden nichts mehr“ statt „ohne Netzwerkzugriff“. |
| LOW Moduldateigrösse | **Nicht geändert.** Bei 23 Geschichten ist es kein Problem; die erzeugte Nachbardatei trägt heute 948 Zeilen. Eine Schwelle jetzt zu erfinden wäre eine Regel ohne Anlass. |
| LOW PII-Prüfschritt | Deckt sich mit dem HIGH oben, dort erledigt. |
| LOW Redaktioneller Ablauf | **Nicht als Zusage geändert**, aber benannt: Donald arbeitet über diese Sitzung, die Datei zu bearbeiten ist für ihn kein Bruch. Aufgabe 4.5 hält die Abnahme als eigenen Schritt fest. |

## Was dieser Schritt eingebracht hat

Der eine Befund, den keine Messung gezeigt hätte, ist der **Selbstwiderspruch**:
er stand vollständig im Text, in zwei Absätzen, die je für sich richtig klangen.
Der zweite ist **PII** — und der ist unangenehmer, weil der Change eine
Sicherheitszusage *führte* („kein Weg zu Mitgliederdaten“) und dabei den Weg
übersah, der nicht durch das Artefakt läuft, sondern durch den Commit. Ein
Wächter, der das Ausgelieferte prüft, kann ein öffentliches Repository nicht
schützen.

Der Gate-Trailer fehlt, wie in jedem `REVIEWS.md` dieses Repositories. Er würde
den Review per Digest an Artefakte binden, die dieser Review gerade geändert
hat; von Hand nachgetragen behauptete er eine Bindung, die es nie gab.
