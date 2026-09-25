# Session Handoff — 2026-09-25 (AGE-905 Release-Backfill, gebaut, nicht committet)

> **Scope dieser Übergabe: AGE-905.** Fremde offene Punkte stehen hier bewusst
> NICHT. Die vorige Fassung (13.09., M4 / AGE-644) steht in
> `git log -- session-handoff.md` und gehört der Sitzung, die daran arbeitet.
>
> Worktree `donald-age-905-release-backfill`, Branch
> `donald/age-905-release-backfill`. **Nichts ist committet.**

> ## ⚠ ZUERST — drei Dinge, die auf dem Rechner zurückgeblieben sind
>
> 1. **`.env.local` liegt im Worktree** (gitignored) und zeigt auf den lokalen
>    Stack. Solange sie da ist, zeigt **jedes** `pnpm dev` in diesem Worktree
>    auf lokal statt DEV, ohne das zu sagen. **Nach der Sichtprobe löschen.**
> 2. **Ein vite-Server läuft auf Port 5219** (`pnpm exec vite --port 5219
>    --strictPort`, Log in `/tmp/905-vite.log`). Beenden, wenn die Sichtprobe
>    durch ist.
> 3. **Eine geliehene Adminzeile steht in der lokalen `staff_roles`.** Sie war
>    vorher leer. Zurücknehmen mit:
>    `delete from public.staff_roles where profile_id = '00000000-0000-0000-0000-000000000238';`

## Accomplished

- Abstimmung mit fbc-platform-61 (AGE-907) **vor** der ersten Codezeile: keine
  Kollision, lokaler Stack freigegeben. Zwei Hinweise von dort übernommen.
- OpenSpec-Change `release-backfill`: Proposal, Design, zwei Delta-Specs,
  Tasks, REVIEWS.md mit signiertem Trailer. `openspec validate --all` grün.
- **Fremdreview vor dem Code** (Regel für DB-Arbeit): gemini und codex, beide
  REQUEST-CHANGES, 4× HOCH / 4× MITTEL / 2× NIEDRIG. Alle eingearbeitet ausser
  einem begründet abgelehnten. Das Gate zählt 2 Reviewer.
- Migration `20260925120000_release_backfill.sql`: 23 Notes + 23 Feed-Karten,
  über den bestehenden Auslöser, ohne `send_release_note()`.
- `scripts/mess-905.ts` + `.logic.ts` + 11 Zusagen: misst **Differenzen**,
  jede Zusage mit Positivkontrolle.
- `supabase/tests/release_backfill_test.sql`: 23 pgTAP-Zusagen, in `ci.yml`
  eingetragen, Wächter grün.
- `/neues` lädt nach und löst Tiefenlinks auch ausserhalb der ersten Seite auf
  (+ 8 Zusagen in `NeuesPage.paging.test.tsx`).
- Lokal: 2881 Tests grün, `pnpm lint` 0 Fehler, `pnpm typecheck` grün.

## Decisions

- **Migration mit Datensätzen statt Admin-Skript** (Donald, 25.09.): kein
  Client kann `status='sent'` schreiben, ein Skript bräuchte also erst eine
  DEFINER-RPC — eine dauerhafte API-Fläche für einen einmaligen Lauf.
- **Ausgabe-Datum, minutenweise gestaffelt** (Donald, 25.09.): der Feed ordnet
  über `(veroeffentlicht_ab desc, id desc)`; gleiche Zeitstempel ordneten die
  Karten einer Ausgabe nach uuid, also auf jedem Bestand anders.
- **Das Ausgabe-Datum gilt auch auf `/neues` als Datum der Mitteilung**
  (Donald, 25.09.), obwohl `release-ausgaben.ts` seine Daten „gesetzt und
  nicht gemessen" nennt.
- **`/neues` bekommt Paging in diesem Change** (Donald, 25.09.): ohne das
  hätten drei der 23 Karten einen Knopf getragen, der nichts öffnet.
- **Der Halbsatz „und wo du zur Mitgliedschaft kommst" ist gestrichen**
  (Donald, 25.09.): AGE-907 hat den Weg mit `935b987` entfernt, der Satz steht
  seit AGE-904 live und falsch im Tutorial — und der Nachtrag wäre die letzte
  Gelegenheit gewesen, ihn vor dem Einfrieren zu korrigieren.
- **`angekuendigt_am` wird in der MIGRATION gestempelt, nicht im Auslöser**
  (gegen den Vorschlag von gemini): der Auslöser gehört jeder künftigen echten
  Zustellung, nicht diesem Nachtrag.

## Files modified

- `supabase/migrations/20260925120000_release_backfill.sql` — neu, 606 Zeilen
- `supabase/tests/release_backfill_test.sql` — neu, 23 Zusagen
- `.github/workflows/ci.yml` — eine Zeile: die neue Suite in die Dateiliste
- `scripts/mess-905.ts`, `mess-905.logic.ts`, `mess-905.logic.test.ts` — neu
- `src/pages/NeuesPage.tsx` — Paging + Tiefenlink-Auflösung
- `src/pages/NeuesPage.paging.test.tsx` — neu, 8 Zusagen
- `src/lib/release-notes.ts` — `fetchEineNote`, `releaseNoteEinzelKey` (rein
  additiv, 0 gelöschte Zeilen)
- `src/content/release-geschichten.ts` — **eine** Zeile (der Halbsatz)
- `openspec/changes/release-backfill/` — die fünf Artefakte

## Gemessene Belege

| Fläche | vorher | nachher |
| --- | --- | --- |
| PROD `release_notes` | 0 | *(noch nicht gefahren)* |
| PROD `notifications` | 308 (0 × `release_note`) | muss 308 bleiben |
| PROD `push_zustellungen` | 0 | muss 0 bleiben |
| lokal `posts kind=release` | 0 | **23** |
| lokal `notifications` | 47 | **47 (Δ 0)** |
| lokal `push_zustellungen` | 0 | **0 (Δ 0)** |

Zweiter Lauf lokal: `INSERT 0 0`, Δ 0 überall.

**Drei Mutationen als Positivkontrolle**, jede zurückgenommen und die Rücknahme
per `diff` belegt: Auslöser auf `now()` → 3 Zusagen rot; Art-Filter in
`beitrag_ankuendigen()` entfernt → die gemeinte Zusage rot; Nachladen in
`NeuesPage` entfernt → 3 Zusagen rot. Dazu die zwei Riegel gegen den fremden
Entwurf **einzeln** gemessen: jeder allein verhindert den Schaden.

## Next session: start here

**Die Sichtprobe fehlt, sonst nichts.** Das chrome-devtools-Profil war von
einer anderen Sitzung belegt, und es abzuschiessen hätte fremden Browserzustand
gekostet — Donald hat die Übergabe gewählt. Der Server läuft bereits auf
`http://localhost:5219/` (**`localhost`, nicht `127.0.0.1`** — vite bindet an
den ersten Treffer der Namensauflösung). Anmelden mit
`age905-sichtprobe@example.invalid` / `Sichtprobe905!x` (Stufe `connect`,
aktiviert). Zu prüfen: die Aktivität zeigt sechs Ausgaben vom 05.09. zurück zum
01.08., innerhalb jeder Ausgabe in Leseordnung; Glocke und Ungelesen-Zähler
unverändert; `/neues` zeigt 20 und holt die letzten drei über „Ältere laden";
ein Tiefenlink von der ältesten Karte öffnet ihre Mitteilung; ausgeloggt
erscheint keine Release-Karte; und der Tutorialsatz unter `/hilfe/tutorials`
endet jetzt bei „welche Stufe nötig ist." Danach **die drei Aufräumpunkte oben
abarbeiten**, dann committen (Conventional Commits mit `(AGE-905)`),
archivieren **vor** dem Merge, `pnpm release:entries`, PR gegen `main`. Die
PROD-Migration läuft erst **nach** dem Merge von `main` aus — vom Feature-Branch
ist sie unmöglich, das sind zwei Schritte.

## Open questions

- Keine offenen Entscheidungen. Zwei **Folgepunkte**, bewusst nicht gebaut:
  `release_feed_post_sync()` stempelt `angekuendigt_am` für künftige echte
  Zustellungen weiterhin nicht (heute folgenlos, weil `beitrag_ankuendigen()`
  nach `kind` filtert), und die Release-Karte kürzt ihren Text nicht — bei 23
  Karten zu 480–1279 Zeichen wird die Aktivität lang.
- Nach dem Nachtrag bestehen 58 % der PROD-Aktivität aus Release-Karten
  (23 von 40). Gewollt und im Design begründet: die sechs Ausgabe-Daten liegen
  überwiegend **vor** dem ältesten Bestandsbeitrag (17.08.), die Karten sammeln
  sich also unten.
