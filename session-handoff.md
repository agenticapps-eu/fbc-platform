# Session Handoff — 2026-09-12 (Abend: Aufräumen, Dependabot, AGE-644 angefangen)

> ## ⚠ ZUERST
>
> **1. AGE-643 (M3, Deep Links) ist und bleibt zu.** Nichts daran offen. Die
> vorige Übergabe stimmt in diesem Punkt; dieser Abschnitt ersetzt sie nur,
> weil danach noch etwas passiert ist.
>
> **2. Die vorige Übergabe irrt an einer Stelle, und die kostet sonst Tage.**
> Sie nennt „Kontolöschung im Produkt" als Bauarbeit für AGE-644. **Die ist
> seit dem 09.09. fertig und auf PROD ausgerollt** — AGE-708, fünf PRs
> (#373–#378), `src/lib/konto-loeschen.ts`, drei Migrationen, ein pgTAP-Test
> und neun Requirements in `openspec/specs/privacy/spec.md`. In AGE-644 ist
> das Häkchen trotzdem leer. **Nicht neu bauen.**
>
> **3. Die Dependabot-Schlange ist leer.** #394–#397 alle gemergt, `main` grün
> (CI und Deploy auf `2521854e`). Darunter der Major-Sprung Vitest 4 → 5.
>
> **4. Alle Worktrees bis auf `main` sind weg.** 2,5 GiB frei. Es gibt keinen
> Worktree mehr, in dem noch jemand sitzt.

## Was diese Sitzung getan hat

### Aufgeräumt

Drei Worktrees entfernt, alle drei vorher **dateiweise** gegen `main` geprüft,
nicht nur am Commit-Graphen — jeder trug zwei Commits, die als Squash schon in
`main` standen.

| Worktree | Wo der Inhalt liegt |
| --- | --- |
| `donald-age-643-deep-links` | `3532a6d` |
| `donald-age-705-...-blog` | `8a6d47c` |
| `donald-age-708-kontoloeschung` | 0 Commits vor `main` |

### Dependabot

Vier PRs, nacheinander, nie parallel — das Rezept aus dem Gedächtnis trug
unverändert.

| PR | Inhalt | Nacharbeit |
| --- | --- | --- |
| #394 | `pnpm/action-setup` 6.0.10 → 6.1.0 | keine, nur Basis nachziehen |
| #395 | `supabase-js`, `framer-motion` | `deno install --frozen=false` |
| #396 | vier Entwicklungsabhängigkeiten | `deno install --frozen=false` |
| #397 | **Vitest 4 → 5** | Konflikt in beiden Sperrdateien aufgelöst |

**Bei #397 haben beide Sperrdateien kollidiert**, weil #396 vorher landete.
Aufgelöst wie im Gedächtnis beschrieben: `--theirs`, dann `pnpm install
--lockfile-only` und `deno install --frozen=false`, beide **erzeugt**, nicht
zusammengeschrieben. Aus `package.json` blieb Vitest 5 aus dem Branch und
Wrangler 4.130.0 aus `main`.

**Die Zahl, auf die es beim Major-Sprung ankam:** Vitest 5 fährt **247 Dateien
und 2821 Tests** — genau so viele wie Vitest 4. Ein grünes CI allein hätte
nicht ausgeschlossen, dass die Suite still schrumpft.

Nebenbei gemessen und für später wichtig: `deploy` ist auf einem
Dependabot-PR rot, solange nur Dependabot gepusht hat. Nach `gh pr
update-branch` läuft er im normalen Secret-Kontext und wird grün. Er ist
ohnehin kein Pflichtcheck.

### AGE-644 angefangen — und der technische Kern ist nicht, was dort steht

Der Vorgang liest sich wie Kontoarbeit. Gemessen ist die Lage anders.

**Von neun Abnahmezeilen sind sieben Donalds Arbeit oder blockiert:**
Google-Konto und Testzwang, Tester anfragen, Store-Formulare, Veröffentlichen,
Verlängerungstermine. Der Play-Fingerabdruck für `assetlinks.json` hängt daran,
dass die App in der Play Console existiert. Die Kontolöschung ist erledigt
(siehe oben).

**Übrig bleibt eine einzige echte Frage, und sie ist offen:** wie ein
Store-Prüfer in die App kommt, ohne echte Mitgliederdaten zu sehen.

Gemessener Stand dazu:

- **Das Verzeichnis ist ab `connect` gegated** (`src/config/nav.ts:105`) — ein
  Prüfer auf `basic` sähe es nicht.
- **Aber das reicht nicht.** `/aktivitaet` und `/events` tragen **gar kein**
  `minTier`. Der Prüfer sähe dort Beiträge, Namen und Bilder echter
  Mitglieder, egal auf welcher Stufe sein Konto steht.
- **Auf DEV ausweichen geht nicht.** Seit dem Spiegel (AGE-576) trägt DEV die
  echten Mitglieder aus PROD, und `docs/demo-zugang.md` ist als historisch
  markiert: die Demo-Welt existiert nicht mehr, 0 von 72 Konten sind Demo.

Es gibt also **heute keine Stufe und keine Fläche**, auf der ein Prüfer eine
funktionierende App ohne echte Personendaten sieht. Das ist keine Formalie:
die Frage ist ungelöst, und sie steht vor der Einreichung, nicht danach.

## Die Entscheidung, die Donald treffen muss

Drei Wege, alle mit einem echten Preis:

1. **Hinnehmen.** Der Prüfer bekommt ein normales Konto und sieht die echte
   Gemeinschaft. Null Bauarbeit. Der Preis ist eine Datenschutz-Entscheidung
   über 70 Mitglieder, die dem nicht zugestimmt haben.
2. **Demo-Sicht bauen.** Ein Prüferkonto sieht einen erfundenen Bestand. Das
   ist RLS-Arbeit quer über Feed, Events und Verzeichnis — nach Donalds eigener
   Regel mit Fremdreviewer, und der teuerste der drei Wege.
3. **Leeres Konto.** Der Prüfer sieht eine funktionierende, aber fast leere
   App. Kostet vermutlich eine Ablehnungsrunde nach Richtlinie 4.2, also
   mehrere Tage — genau das, was AGE-644 vermeiden will.

**Ohne diese Entscheidung lässt sich für AGE-644 kein OpenSpec-Change
schreiben**, weil Weg 1 und 3 gar keinen brauchen und Weg 2 ein großer ist.

## Noch offen, klein

- **85 verwaiste Remote-Branches** aus gemergten PRs. GitHub löscht sie hier
  nicht automatisch. Aufräumen ist ein Einzeiler, aber es ist ein Schreibzugriff
  auf die Fernkopie und wurde deshalb nicht ungefragt gemacht.
- **AGE-644 trägt das Kontolöschungs-Häkchen unangehakt.** Bewusst nicht
  angefasst — Donald hatte die Korrektur nicht mit ausgewählt.

## Next session: start here

**Zuerst fragen, welcher der drei Prüferzugangs-Wege gilt.** Erst danach steht
fest, ob AGE-644 überhaupt einen OpenSpec-Change bekommt. Parallel dazu ist der
längste Weg unverändert das Google-Konto samt Testzwang-Bedingungen, und den
kann nur Donald gehen.

Vor dem Anfangen `ListAgents` — am 12.09. liefen sechs Sitzungen, zwei davon in
diesem Repo.

## Zwei Fallen dieser Sitzung

1. **Ein `cd` in einen Worktree verschiebt die Sitzung stumm mit.** Zweimal
   passiert, beide Male beim bloßen *Lesen* eines fremden Worktrees. Mit
   `git -C <pfad>` arbeiten, nie mit `cd`.
2. **Eine Übergabe ist kein Beleg.** Die vorige nannte die Kontolöschung als
   offene Bauarbeit; sie war seit drei Tagen live. Der Unterschied kostete
   einen `grep`, hätte aber sonst Tage gekostet.
