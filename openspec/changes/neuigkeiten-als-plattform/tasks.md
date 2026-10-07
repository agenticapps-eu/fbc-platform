# Tasks — Neuigkeiten als Absender

## 1. Den heutigen Zustand festnageln

- [ ] 1.1 pgTAP-Zusage, die **heute rot** ist: `feed_top_authors` zählt einen
      Beitrag mit `kind = 'release'` mit. Das ist das RED dieses Changes und
      zugleich der Wächter gegen den Konflikt aus Entscheidung 5.
- [ ] 1.2 Dieselbe Zusage für `kind = 'event'`.
- [ ] 1.3 Gegenprobe im selben Fall: ein Beitrag mit `kind = 'member'` zählt
      sehr wohl. Ohne sie wäre eine Null auch dann grün, wenn die Funktion gar
      nichts mehr zählt.
- [ ] 1.4 Die Zusage, die `security invoker` begründet, bleibt unberührt und
      wird nachgefahren: ein terminierter Mitgliedsbeitrag zählt NICHT mit.
- [ ] 1.5 Nachsehen, ob der bestehende Prüfstand der Release-Karte die
      Ersetzung wirklich misst oder nur seine eigene Vorrichtung. Er reicht
      der Komponente einen Autor, der schon „eff.bee.zee" heisst — die
      Ersetzung in `feed.ts` prüft er damit NICHT. Falls dafür keine andere
      Zusage existiert, gehört sie nachgetragen; das ist der Beleg, dass die
      Karte aus dem Umfang fällt.
- [ ] 1.6 Laufen lassen und RED belegen — Ausgabe lesen, nicht annehmen.

## 2. Die Migration

> **Eine neue Datei.** Zeitstempel von heute, also nach allen eingespielten.

- [ ] 2.1 `create or replace function public.feed_top_authors(int)` mit
      `where p.kind = 'member'`. `security invoker` BLEIBT — der Grund steht im
      Kopf der Migration, nicht nur im Entwurf.
- [ ] 2.2 Positivliste, keine Ausschlussliste (Entscheidung 2), mit dem Grund
      im Kopf: ein künftiger vierter Typ wird still ausgelassen statt still
      mitgezählt.
- [ ] 2.3 `comment on function` nachziehen — der heutige Text sagt „nach Zahl
      der Beiträge" und wird damit falsch.
- [ ] 2.4 Die Grants NICHT anfassen: `create or replace` behält sie, und ein
      überflüssiges `grant` verschleiert, was sich wirklich ändert.

## 4. Nachweisen

- [ ] 4.1 pgTAP grün, volle Vitest-Suite, `lint`, `typecheck`, `build`. Nach
      dem Build und vor jedem `git add`:
      `git checkout -- src/content/release-entries.generated.ts`.
- [ ] 4.2 Die neue pgTAP-Datei in `ci.yml` eintragen.
- [ ] 4.3 **Wirkung messen, vorher und nachher**, gegen den lokalen Stack:
      welche Konten die Funktion liefert und mit welchen Zahlen. Eine Funktion,
      die „jetzt richtig zählt", ohne dass jemand beide Stände gesehen hat, ist
      eine Behauptung.
- [ ] 4.4 Zählstände des geteilten Stacks vorher/nachher protokollieren.
      KEINE Sichtprobe nötig: dieser Change fasst keine Oberfläche an.
- [ ] 4.5 Gegenprobe zum Wächter aus 1.1/1.2: mit der alten Funktion fällt er
      aus, mit der neuen nicht.

## 5. Abschliessen

- [ ] 5.1 Fremdreviewer auf dem Plan — es ist eine Migration an einer Funktion,
      Donalds Regel vom 26.08. greift. Zwei Anbieter, keiner davon der eigene.
- [ ] 5.2 Code-Review auf dem Diff.
- [ ] 5.3 Befunde abarbeiten.
- [ ] 5.4 ADR in `docs/decisions/` — Nummer eins über der höchsten, erst `ls`.
      Die locked decision ist Entscheidung 1: die Urheberschaft bleibt in den
      Daten, ein Plattform-Konto wird abgelehnt.
- [ ] 5.5 `openspec validate --all` grün.
- [ ] 5.6 Vorab-Sonde auf den Neuigkeiten-Eintrag, dann archivieren,
      `pnpm release:entries`, Diffgrösse messen.
- [ ] 5.7 PR. **In den Text: nach dem Merge blockt `drift-gate` jeden Deploy,
      bis `migrate-prod` dispatcht und der Lauf mit `gh run rerun --failed`
      wiederholt ist.** Und: `migrate-prod` braucht Donalds Ansage.
- [ ] 5.8 **In AGE-1001 nachtragen** (Entscheidung 5): dessen Migration muss
      vor dem Merge einen Zeitstempel nach diesem bekommen, und ihr
      `feed_top_authors`-Rumpf muss den Filter mitführen. Der Test aus 1.1
      erzwingt es; die Aufgabe macht es auffindbar.
