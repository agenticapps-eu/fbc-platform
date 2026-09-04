# Session Handoff — 2026-09-04 (AGE-605 halb fertig · AGE-542 und AGE-618 ausgeliefert)

> ## ⚠ ZUERST — vier Dinge
>
> **1. Diese Übergabe führt AGE-605.** AGE-542 und AGE-618 stehen darin nur als
> Endstand; ihre ausführliche Fassung liegt auf `main` (`1a95ca0`).
> Die Datei ist für alle parallelen Sitzungen dieselbe und kollidiert bei jedem
> Rebase. **Nicht zusammenführen.**
>
> **2. AGE-605 IST NICHT FERTIG.** Geplant, fremdreviewt, Migration geschrieben —
> **die Tests fehlen vollständig.** Nichts davon ist gegen eine Datenbank
> gelaufen. Der Stand ist committet und gepusht (`82d1b52` auf
> `donald/age-605-anmeldung-nicht-an-den-rpcs-vorbei`), damit er nicht ungepusht
> unsichtbar liegt — nicht, weil er fertig wäre.
>
> **3. AGE-642 läuft PARALLEL** (Worktree
> `fbc-platform.donald-age-642-capacitor-huelle`). **Nicht anfassen.** Hat am
> 04.09. selbst #330, #331 und #333 nach `main` gebracht.
>
> **4. AGE-630 kommt NACH AGE-605**, und zwar in einer eigenen frischen Sitzung
> — so von Donald am 04.09. festgelegt. Nicht vorziehen.

## Accomplished

### Ausgeliefert und abgeschlossen

| Vorgang | PRs | Stand |
|---|---|---|
| **AGE-542** — anon-Wächter leitet seine Fläche ab | #332, #334 | Done, archiviert |
| **AGE-618** — Wächter gegen Einbettung am VideoEmbed vorbei | #335 | Done |
| Übergabe dazu | #336 | auf `main` (`1a95ca0`) |

`main` steht bei `1a95ca0`, `pnpm test` **2536/2536** in 223 Dateien.

### AGE-605 — die Hälfte, die zählt, ist getan

Der **Plan** steht und ist durch zwei fremde Anbieter gegangen. Das war die
teure, entscheidungslastige Hälfte; was fehlt, ist mechanisch.

- `openspec/changes/anmeldung-nicht-an-den-rpcs-vorbei/` — Vorschlag, Entwurf,
  Aufgaben, Spec-Delta. `openspec validate --all` **32/32**.
- `REVIEWS.md` — gemini und codex, **beide REQUEST-CHANGES**, alle Befunde
  eingearbeitet.
- `supabase/migrations/20260904160000_anmeldung_nicht_an_den_rpcs_vorbei.sql` —
  geschrieben, **nie ausgeführt**.

## Decisions

- **Der Trigger hat zwei Schichten.** Schicht 1 prüft die Kapazitätsinvariante
  **rollenunabhängig** für jeden Weg (die RPC eingeschlossen); Schicht 2 sperrt
  den direkten Statuswechsel und ist als **Ausschluss** formuliert
  (`current_user <> <eigentuemer>`), damit eine unbekannte Rolle gesperrt und
  nicht durchgelassen wird.
- **`checked_in` wird über ein Spaltenrecht entzogen**, nicht über eine
  Policy-Bedingung — und die Form ist tragend: erst `revoke update` auf der
  Tabelle, dann `grant update (status, rating)`. Ein `revoke update (checked_in)`
  allein ist ein **No-op**, solange das Tabellenrecht besteht.
- **INSERT und DELETE fallen auch auf Rechte-Ebene**, nicht nur über die Policy.
- **Die Zusage ist eingegrenzt** auf „neue Anmeldungen und Statuswechsel erzeugen
  keine Überbuchung" — nicht „ein Event ist nie überbucht". Grund unten.

## Die drei HIGH-Befunde der Planungs-Review

Alle am Quelltext nachgeprüft, alle zutreffend. **Zwei hätten den Change falsch
gemacht.**

1. **Mein Trigger-Entwurf war fail-OPEN.** Er sollte bei
   `current_user = 'authenticated'` greifen und behauptete im selben Absatz,
   geschlossen auszufallen. Jede andere Rolle wäre vorbeigelaufen.
2. **`register_for_event` ist ein UPSERT**
   (`on conflict … do update set status = excluded.status`). Eine
   Wiederanmeldung nach dem Absagen läuft über den **UPDATE**-Zweig — genau dort,
   wo der neue Trigger feuert. Meine Positivkontrollen hätten nur den
   INSERT-Zweig geprüft und wären grün geblieben, während ein produktiver Weg
   bricht. Genau der Fehler, den ich im Risikoabschnitt selbst als teuersten
   benannt hatte.
3. **Ein vierter Bypass:** die eigene `registered`-Zeile auf ein anderes, volles
   Event umhängen (`event_id` ändern). Der Status bleibt `registered`, eine
   Übergangsregel sieht nichts.

## Next session: start here

**Worktree:** `/Users/donald/worktrees/fbc-platform/donald-age-605-anmeldung-nicht-an-den-rpcs-vorbei`,
Zweig `donald/age-605-anmeldung-nicht-an-den-rpcs-vorbei`, Stand `82d1b52`.

**Erster Handgriff: `tasks.md` Gruppe 2 und 3.** Die Migration ist geschrieben,
aber **nie gelaufen** — sie kann Syntaxfehler enthalten. Reihenfolge:

1. Ausgangsmessung (Gruppe 2): auf PROD rein lesend zählen, ob es überbuchte
   Events gibt. **Selbst-Check-ins sind historisch NICHT messbar** — die Zeile
   speichert den Handelnden nicht; das ist benannt, keine Zahl erfinden.
2. `supabase/tests/anmeldung_rpc_exklusiv_test.sql` bauen: vier Exploit-Proben,
   vier dauerhafte Zusagen, sieben Positivkontrollen. Die Namen der Zusagen
   stehen in `tasks.md` Gruppen 3, 4, 6 und 7.
3. **Die Datei MUSS in `.github/workflows/ci.yml` eingetragen werden.** Eine
   pgTAP-Datei mit `plan()` ist kein Beleg, dass sie läuft — zwei lagen hier
   schon monatelang tot im Repo.
4. Golden-Snapshot in `grants_test.sql` nachziehen (Gruppe 8): aus einem
   Tabellenrecht werden Spaltenrechte, und eine Funktion kommt dazu. **Die
   Differenz benennen, nicht die Liste blind ersetzen.**
5. Diff-Review, PR, archivieren.

**Werkzeuge im Haupt-Checkout unter `.gstack/`** (gitignoriert):
`probe-eintrag.mts` (Neuigkeiten-Vorschau **vor** dem Archivieren),
`prod-anon-katalog.mts` (rein lesende PROD-Messung), `eingriff.py`.

## Open questions

- **Zwei Befunde gehören Donald**, beide **Bestand** und nicht durch diesen
  Change entstanden. Für keinen wurde ein Vorgang angelegt — fremde Vorgänge
  nicht ungefragt anlegen:
  - **Ein Gastgeber kann `events.capacity` unter die bestehende Belegung
    senken.** `updateEvent` (`src/lib/events.ts:601`) schreibt das Feld regulär.
    Deshalb ist die Zusage dieses Changes eingegrenzt.
  - **Mitglieder unter `exchange` können sich anmelden, aber nicht direkt
    absagen.** Die RPC lässt öffentliche Events ab `basic` und Mitglieder-Events
    ab `has_level(3)` zu, `regs_write_own` verlangt `has_level(4)`.
- **`REVIEWS.md` trägt keinen signierten Trailer** — ich habe sie von Hand
  geschrieben. Das Gate meldet sie als `trailer-absent`; es blockt nichts, aber
  sie zählt dort nicht als verifizierbar.
- **Der Neuigkeiten-Eintrag zu AGE-542 wird NICHT freigegeben** — Donalds
  Entscheidung vom 04.09.: für Mitglieder ändert sich nichts Sichtbares.
- **`pnpm lint` ist im Haupt-Checkout rot, vorbestehend und fremd** — alle Fehler
  aus `.gstack/age595/` und `.gstack/age602/`. CI sieht das nie; über
  `src scripts functions` steht es bei 0 Fehlern.
- **`node_modules` veraltet nach einem `main`-Pull** (Capacitor-Pakete aus
  AGE-642). 102 rote Testdateien, `typecheck` Exit 2 — sieht aus wie ein eigener
  Schaden und ist keiner. `pnpm install` behebt es.
- **Drei Remote-Zweige stehen nach dem Merge noch auf `origin`**
  (`age-542-*` zweimal, `age-618-*`). Lokal weg; Aufräumen ist Donalds
  Entscheidung.
- **Nach AGE-605 kommt AGE-630** (Event-Vorlagen und Serientermine) in einer
  eigenen frischen Sitzung. Der Vorgang nennt vier offene Produktentscheidungen
  und drei Schema-Fallen — darunter, dass `events_cover_path_key` **UNIQUE** ist
  und eine Serie sich das Coverbild deshalb nicht teilen kann.
