# Session Handoff — 2026-09-04 (AGE-605 abgeschlossen, PR #342)

> ## ⚠ ZUERST — drei Dinge
>
> **1. Diese Übergabe führt AGE-605.** Die Datei ist für alle parallelen
> Sitzungen dieselbe und kollidiert bei jedem Rebase. **Nicht zusammenführen.**
>
> **2. DER DEPLOY VON `main` IST BLOCKIERT, bis die Migration auf PROD läuft.**
> Das ist die dringendste Zeile dieser Datei. Das `drift-gate` ist seit dem
> Merge rot — korrekt und wie vorgesehen:
>
> ```
> DRIFT — lokal vorhanden, auf dem Ziel fehlend: 20260904160000
> Migrationshistorie weicht ab. Erst `migrate-prod` freigeben, dann deployen.
> ```
>
> Das trifft **jeden** Deploy von `main`, auch fremde — **AGE-642 eingeschlossen**.
> Der `CI`-Lauf selbst ist grün; rot ist allein der `Deploy`-Workflow. Die vier
> Pflichtchecks sind davon nicht betroffen, Merges gehen also weiter.
>
> **Der PROD-Lauf ist ein eigener, ausdrücklicher Schritt (Aufgabe 10.4) und
> nicht vom Merge gedeckt — er braucht Donalds Freigabe.** Danach ist der Deploy
> wieder frei.
>
> **3. AGE-642 läuft PARALLEL und stand VORHER in dieser Datei.** Der Worktree
> ist `fbc-platform.donald-age-642-capacitor-huelle` — **nicht anfassen.** Seine
> Übergabe ist hier überschrieben, wie es die Konvention vorsieht; sie steht
> vollständig in `git show 6ed68c4:session-handoff.md`. Die Gerätebelege im
> Detail liegen ohnehin dauerhaft in
> `openspec/changes/capacitor-huelle/uebergabe-android.md` und in dessen
> `tasks.md`, Phase E — die sind von diesem Überschreiben nicht betroffen.

## Accomplished

**AGE-605 ist fertig und liegt als PR #342 vor.** Der Stand aus der letzten
Sitzung (geplant, fremdreviewt, Migration geschrieben, Tests fehlten) ist
abgeschlossen — **und die Migration war beim Übernehmen kaputt.**

| Artefakt | Stand |
|---|---|
| Migration `20260904160000_…` | umgebaut, gegen die DB gelaufen |
| `supabase/tests/anmeldung_rpc_exklusiv_test.sql` | **neu, 25 Zusagen**, in `ci.yml` |
| `grants_test.sql` | Snapshot nachgezogen, genau **eine** Zeile |
| Change | archiviert als `2026-09-04-anmeldung-nicht-an-den-rpcs-vorbei` |
| Neuigkeiten-Eintrag | erzeugt, **Freigabe offen** (siehe unten) |

Abnahme: pgTAP **28 Dateien / 1185** grün (vorher 27 / 1160) ·
lint/typecheck/build je **Exit 0** · `openspec validate` **31/31**.
`pnpm test` **2543** nach dem Rebase auf `6ed68c4` (vorher 2536 — die sieben
neuen kommen aus AGE-642s `bildauswahl.test.ts`, nicht von hier).

## Decisions

### Der Fund, der die Sitzung getragen hat: Schicht 1 war fail-OPEN

Die geplante Fassung hatte **beide Schichten in EINER `SECURITY INVOKER`-
Triggerfunktion**. Damit zählte die Kapazitätsschicht unter der RLS des
Schreibenden, und `regs_select_self_or_host` lässt ein Mitglied nur die
**eigenen** Anmeldezeilen sehen — sie sah bei jedem Angreifer **null belegte
Plätze**. Genau an der Zusage, die sie tragen sollte.

Gemessen mit Positivkontrolle, weil eine einzelne Beobachtung zwei Ursachen
hätte haben können:

| Sonde | Zähler sieht | INSERT ins volle Event |
|---|---|---|
| fremd gehostetes Event | 0 | **ging durch** |
| selbst gehostetes Event | 1 | abgewiesen (23514) |

`capacity` war in **beiden** Fällen sichtbar — RLS auf `events` ist damit als
Ursache ausgeschlossen.

**Warum keine Review das gefunden hat:** die Planungs-Review prüfte einen
Entwurf ohne RLS-Kontext, der Diff-Review sah schon die Korrektur. Es kam
allein aus dem Lauf gegen die Datenbank. **Eine Migration, die nie gegen eine
Datenbank gelaufen ist, ist ungeprüft** — auch mit zwei fremden Freigaben auf
dem Plan.

### Zwei Trigger statt einem

Weil die Schichten gegensätzliche Rechtemodelle brauchen: `…_wache_exklusiv`
ist `SECURITY INVOKER` (braucht `current_user`), `…_wache_kapazitaet` ist
`SECURITY DEFINER` (muss alle Zeilen sehen). `force row level security` ist auf
beiden Tabellen aus, Eigentümer `postgres` — nachgesehen, nicht angenommen.

**Die Reihenfolge hängt am NAMEN** (BEFORE-Trigger feuern alphabetisch), damit
ein direkter Statuswechsel an einem vollen Event „nicht direkt" meldet und nicht
„voll". Zusage 2 pinnt das fest; Umbenennen macht sie rot.

### Schicht 1 sperrt die `events`-Zeile

Aus dem Diff-Review (opencode): ohne `for update` kämen unter READ COMMITTED bei
`belegt = capacity - 1` zwei gleichzeitige Schreiber **beide** durch. Ich habe
die Sperre aufgenommen statt die Zusage abzuschwächen. Mit zwei Sitzungen
nachgemessen: die zweite läuft an genau dieser Zeile in den `lock_timeout`.

### Der Test hält den Mechanismus, nicht nur das Ergebnis

Die vier Wege scheitern schon an den **Spaltenrechten**. Eine Datei, die nur sie
prüft, bliebe grün, während die Kapazitätsschicht wirkungslos ist — sie käme nie
zum Zug. Abschnitt 4 stellt deshalb eine spätere Lockerung der Rechte **nach**
und ist die einzige Zusage, die `SECURITY DEFINER` festhält.

**Drei Mutationen gefahren**, jede fing genau die richtigen Zusagen:
DEFINER→INVOKER (24, 25), Schicht 2 entfernt (2), Tabellenrecht zurück (3, 4,
7–11). Und ohne CI-Eintrag wird der Dateilisten-Wächter rot.

Eine Zusage habe ich dabei **nachgeschärft**: „Schicht 1 allein" prüfte in
Wahrheit die Policy mit, solange die Nachstellung sie stehen ließ — die Mutation
meldete eine RLS-Ablehnung statt der Überbuchung. Erst mit gelockerter Policy
zeigt sie, was sie behauptet.

## Files modified

- `supabase/migrations/20260904160000_anmeldung_nicht_an_den_rpcs_vorbei.sql` —
  zwei Trigger statt einem, Schicht 1 `SECURITY DEFINER` + `for update` + Weg D
- `supabase/tests/anmeldung_rpc_exklusiv_test.sql` — **neu**, 25 Zusagen
- `supabase/tests/grants_test.sql` — Snapshot; Kopf benennt den blinden Fleck
  (`role_table_grants` zeigt **keine** Spaltenrechte)
- `.github/workflows/ci.yml` — neue pgTAP-Datei eingetragen
- `openspec/specs/events/spec.md` — Delta gefaltet (2 Anforderungen)
- `openspec/changes/archive/2026-09-04-anmeldung-nicht-an-den-rpcs-vorbei/` —
  archiviert, `REVIEWS.md` um den Diff-Review ergänzt
- `src/content/release-entries.generated.ts` — ein Eintrag

## Next session: start here

**PR #342 ist gemergt** (`7849ff2`, 04.09. 17:40Z), CI auf `main` grün, Linear
AGE-605 steht durch die Automation auf **Done**. Der Branch ist damit erledigt.

**Erster Handgriff: die PROD-Migration mit Donald klären** — sie ist der einzige
offene Punkt und blockt bis dahin jeden Deploy (siehe Kasten oben). `migrate-dev`
ist im Deploy-Lauf bereits **grün durchgelaufen**, die DEV-Fläche trägt die
Migration also schon; offen ist allein PROD.

Danach: `wt remove` für diesen Worktree, und die drei alten Remote-Zweige.

**Und dann AGE-630** (Event-Vorlagen und Serientermine) in einer **eigenen
frischen Sitzung** — so von Donald am 04.09. festgelegt, nicht vorziehen. Der
Vorgang nennt vier offene Produktentscheidungen und drei Schema-Fallen, darunter
dass `events_cover_path_key` **UNIQUE** ist und eine Serie sich das Coverbild
deshalb nicht teilen kann.

## Open questions

- **Der Neuigkeiten-Eintrag ist erzeugt, aber nicht freigegeben.** Sein erster
  Punkt lautet „Für Mitglieder ändert sich nichts Sichtbares" — dieselbe Lage
  wie bei AGE-542, das Donald deshalb zurückgehalten hat. **Entscheidung offen.**
  Nebenbei: der zweite Punkt verweist auf „Nicht in diesem Change", einen
  Abschnittsnamen aus dem Proposal — in einem mitgliedersichtbaren Text ein
  Fremdkörper. Fiele beim Zurückhalten ohnehin weg.
- **Drei Befunde gehören Donald**, alle **Bestand** und nicht durch diesen
  Change entstanden. Für keinen wurde ein Vorgang angelegt:
  - **Ein Gastgeber kann `events.capacity` unter die bestehende Belegung
    senken** (`updateEvent`, `src/lib/events.ts:601`). Deshalb ist die Zusage
    dieses Changes eingegrenzt.
  - **Mitglieder unter `exchange` können sich anmelden, aber nicht direkt
    absagen.** Die RPC lässt öffentliche Events ab `basic` zu, `regs_write_own`
    verlangt `has_level(4)`.
  - **NEU, am 04.09. gemessen:** ein **zweiter** `register_for_event`-Aufruf
    degradiert ein bereits registriertes Mitglied auf die Warteliste — der RPC
    zählt die eigene Zeile mit (`v_count` schliesst `v_uid` nicht aus). Bei
    `capacity` 1: `registered → waitlist`. **Selbstheilend**, der dritte Aufruf
    stellt `registered` wieder her; deshalb kein Blocker, aber für ein Mitglied
    sichtbar.
- **PROD-Ausgangsmessung:** 0 überbuchte Events — bei **2** Events, von denen
  **keines** eine `capacity` trägt. Die Null ist kein Verdienst einer Schranke.
  Sobald das erste Event mit Platzbegrenzung angelegt wird, zählt diese
  Migration; vorher ist sie gegenstandslos. Das ist das Argument für den
  PROD-Lauf, nicht gegen ihn.
- **`REVIEWS.md` trägt keinen signierten Trailer** — von Hand geschrieben, die
  Reviewer direkt per Bash gerufen. Das Gate meldet `trailer-absent`; blockt
  nichts, gilt für **jede** `REVIEWS.md` dieses Repos.
- **Neue Reviewer-Falle, heute gemessen:** gemini kann den Diff **weder** aus
  `.gstack/` (ignoriert) **noch** aus dem Scratchpad unter `/private/tmp/…`
  lesen — letzterer liegt ausserhalb seines Arbeitsverzeichnisses („Path not in
  workspace"). Beide bisher dokumentierten Ablagen fallen damit aus. Was
  funktioniert: **den Diff direkt in den Prompt legen** (54 kB liefen problemlos).
  `opencode` liest `.gstack/` weiterhin.
- **Drei Remote-Zweige stehen nach früheren Merges noch auf `origin`**
  (`age-542-*` zweimal, `age-618-*`). Aufräumen ist Donalds Entscheidung.
