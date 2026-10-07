# Tasks — Neuigkeiten als Absender

## 1. Den heutigen Zustand festnageln

- [x] 1.1 pgTAP-Zusage, die **heute rot** ist: `feed_top_authors` zählt einen
      Beitrag mit `kind = 'release'` mit. Das ist das RED dieses Changes und
      zugleich der Wächter gegen den Konflikt aus Entscheidung 5.
- [x] 1.2 Zusage, dass `kind = 'event'` **weiterhin mitzählt** — die
      Entscheidung vom 25.08. ist damit festgenagelt und nicht nur notiert.
      Sie ist heute grün und muss es bleiben; ein Change, der auf
      `kind = 'member'` verengt, wird hier rot.
- [x] 1.3 Gegenprobe im selben Fall: ein Beitrag mit `kind = 'member'` zählt
      sehr wohl. Ohne sie wäre eine Null auch dann grün, wenn die Funktion gar
      nichts mehr zählt.
- [x] 1.4 Die Zusage, die `security invoker` begründet, bleibt unberührt und
      wird nachgefahren: ein terminierter Mitgliedsbeitrag zählt NICHT mit.
- [x] 1.5 Nachsehen, ob der bestehende Prüfstand der Release-Karte die
      Ersetzung wirklich misst oder nur seine eigene Vorrichtung. Er reicht
      der Komponente einen Autor, der schon „eff.bee.zee" heisst — die
      Ersetzung in `feed.ts` prüft er damit NICHT. Falls dafür keine andere
      Zusage existiert, gehört sie nachgetragen; das ist der Beleg, dass die
      Karte aus dem Umfang fällt.
- [x] 1.6 Laufen lassen und RED belegen — Ausgabe lesen, nicht annehmen.

## 2. Die Migration

> **Eine neue Datei.** Zeitstempel von heute, also nach allen eingespielten.

- [x] 2.1 `create or replace function public.feed_top_authors(int)` mit
      `where p.kind in ('member', 'event')`. `security invoker` BLEIBT — der
      Grund steht im Kopf der Migration, nicht nur im Entwurf.
- [x] 2.2 Positivliste, keine Ausschlussliste (Entscheidung 2), mit dem Grund
      im Kopf: ein künftiger vierter Typ wird still ausgelassen statt still
      mitgezählt.
- [x] 2.3 `comment on function` nachziehen — der heutige Text sagt „nach Zahl
      der Beiträge" und wird damit falsch.
- [x] 2.4 Die Grants NICHT anfassen: `create or replace` behält sie, und ein
      überflüssiges `grant` verschleiert, was sich wirklich ändert.

## 4. Nachweisen

- [x] 4.1 pgTAP grün, volle Vitest-Suite, `lint`, `typecheck`, `build`. Nach
      dem Build und vor jedem `git add`:
      `git checkout -- src/content/release-entries.generated.ts`.
- [x] 4.2 Kein Eintrag in `ci.yml` noetig: die Zusagen stehen in
      `feed_sidebar_test.sql`, und die Datei ist dort seit AGE-582 gelistet.
      Geprueft, nicht angenommen.
- [x] 4.3 **Wirkung messen, vorher und nachher**, gegen den lokalen Stack:
      welche Konten die Funktion liefert und mit welchen Zahlen. Eine Funktion,
      die „jetzt richtig zählt", ohne dass jemand beide Stände gesehen hat, ist
      eine Behauptung.
- [x] 4.3b **Den Funktionsrumpf** vorher/nachher mit
      `EXPLAIN (ANALYZE, BUFFERS)` messen (Befund der Plan-Review): Zeilen,
      Plan, Puffer, Laufzeit. Gegen PROD bereits erhoben und in REVIEWS.md
      festgehalten — gegen den lokalen Stand wiederholen, damit der Beleg zum
      ausgelieferten Rumpf gehört. **Kein Index**, solange keine Messung ihn
      verlangt.
- [ ] 4.4 Zählstände des geteilten Stacks vorher/nachher protokollieren.
      KEINE Sichtprobe nötig: dieser Change fasst keine Oberfläche an.
- [ ] 4.5 Gegenprobe zum Wächter aus 1.1/1.2: mit der alten Funktion fällt er
      aus, mit der neuen nicht.

## 5. Abschliessen

- [x] 5.1 Fremdreviewer auf dem Plan — es ist eine Migration an einer Funktion,
      Donalds Regel vom 26.08. greift. Zwei Anbieter, keiner davon der eigene.
- [x] 5.2 Code-Review auf dem Diff.
- [x] 5.3 Befunde abarbeiten.
- [x] 5.4 ADR in `docs/decisions/` — Nummer eins über der höchsten, erst `ls`.
      Die locked decision ist Entscheidung 1: die Urheberschaft bleibt in den
      Daten, ein Plattform-Konto wird abgelehnt.
- [ ] 5.5 `openspec validate --all` grün.
- [ ] 5.6 Vorab-Sonde auf den Neuigkeiten-Eintrag, dann archivieren,
      `pnpm release:entries`, Diffgrösse messen.
- [ ] 5.7 PR. **In den Text: nach dem Merge blockt `drift-gate` jeden Deploy,
      bis `migrate-prod` dispatcht und der Lauf mit `gh run rerun --failed`
      wiederholt ist.** Und: `migrate-prod` braucht Donalds Ansage.
- [ ] 5.8 **In AGE-1001 nachtragen** (Entscheidung 5, verschärft durch den
      HIGH-Befund der Plan-Review). Drei Dinge, nicht eines:
      - der Zeitstempel von `20261003160000_verzeichnis_dicht.sql` wandert
        hinter den dieses Changes;
      - ihr `feed_top_authors`-Rumpf trägt den Filter;
      - **beide Richtungen werden gemessen**: ein Neuaufbau (`db reset` gegen
        leer) UND ein Hochrüsten (ein Stand mit diesem Change bekommt AGE-1001
        nachgereicht). Erst wenn die Funktion in beiden Fällen den Filter
        trägt, ist es erledigt. Der Test aus 1.1 ist der Wächter, nicht der
        Beleg — er läuft nur im Neuaufbau.
- [x] 5.9 Folgevorgang für den Potential Score anlegen (Befund der Plan-Review,
      von Donald am 07.10. ausdrücklich NICHT in diesen Change gezogen).
