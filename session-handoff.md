# Session Handoff — 2026-09-07 (AGE-630: Event-Vorlagen und Serientermine)

> ## ⚠ ZUERST — Scope dieser Übergabe
>
> **1. Sie führt nur AGE-630** (Event-Vorlagen und wiederkehrende Termine),
> Branch `donald/age-630-event-vorlagen-und-serien`. Die Datei ist für alle
> parallelen Sitzungen dieselbe und kollidiert bei jedem Rebase —
> **nicht zusammenführen**, überschreiben.
>
> **2. Daneben läuft AGE-642 B3** (Android-Signierung, Release-Workflow).
> Vollständig in `git show 118ed46:session-handoff.md` (PR #354). **Diese
> Sitzung läuft noch** — Linear steht auf *In Progress*, ihr Worktree
> `fbc-platform.donald-age-642-capacitor-huelle` **darf nicht abgeräumt
> werden**. Offen dort: iOS-Signierung, `versionCode` = 1, der
> `android-release`-Workflow ist gebaut, aber **nie gelaufen** — er wartet auf
> ein geschütztes GitHub-Environment, das nur Donald anlegen kann; solange
> dürfen Dependabot #349–#351 nicht gemergt werden. Dazu B5.
> Von AGE-630 aus ist daran nichts zu tun.
>
> **3. Die Begründungen im Detail stehen NICHT hier**, sondern in
> `openspec/changes/events-vorlagen-und-serientermine/` — `design.md` (D1–D8),
> `REVIEWS.md` und in den Migrationsköpfen. Diese Datei ist der Überblick.

## Accomplished

**Gruppen 4–8 gebaut, jede RED → GREEN → Gegenprobe.** Fünf Commits, dazu der
Rebase auf `origin/main` (nur `session-handoff.md` kollidierte).

| Gruppe | Was steht |
| --- | --- |
| 4 | `event_serie_slots()` — drei Regelformen, Ortszeit, beide Umstellungen |
| 5 | `event_serie_erzeugen()` — Obergrenze 52 vor dem Einfügen, Idempotenz |
| 6 | D7: erneute Erzeugung zieht die **unbelegte Zukunft** nach |
| 7 | Cover je Termin + zweiter Lese-Zweig in `event_cover_lesbar()` |
| 8 | Ein Rundruf je Erzeugung statt 52, Feed bleibt je Termin |

**Abnahme gemessen, nicht behauptet:** pgTAP 34 Dateien / **1265 Zusagen** grün
(in Blöcken gefahren, siehe unten), `pnpm typecheck` 0, `pnpm lint` 0,
`pnpm test` **2568/2568**, `openspec validate --all` 32/32.

**Gegenproben:** 15 Mutationen gefahren, 14 fallen. Die eine, die grün blieb
(zielloses `on conflict`), ist in Gruppe 7 nachgeholt und fällt dort.

## Decisions

- **Der Plan war an einer Stelle falsch und ist korrigiert.** D4 und das
  Spec-Delta sagten für die Herbstüberlappung „erste Lesart (Sommerzeit), das
  Postgres-Verhalten". Beides zugleich ist unmöglich; die Sonde, auf die sie
  sich beriefen, wandelte 02:30 hin und zurück und bekam 02:30 — das gilt für
  **beide** Lesarten. Gegen UTC gemessen liefert Postgres 01:30Z = 02:30 CET =
  die **zweite** Lesart. Übernommen wurde das Gemessene; tragend bleibt „genau
  ein Termin". `design.md`, Spec-Delta und `tasks.md` sind nachgezogen.
- **Der Rundruf läuft als Anweisungs-Trigger, nicht aus der RPC.** Ein Aufruf
  von `hinweis_rundruf()` in der `INVOKER`-RPC hätte `authenticated` das
  Ausführungsrecht darauf gekostet — wer sie aufrufen darf, schreibt an jedes
  aktivierte Mitglied, beliebig oft.
- **Der Hinweistyp bleibt `event_created`.** `hinweis_erwuenscht()` hat ein
  `case` ohne `else` hinter `coalesce(…, true)`; ein eigener Typ ginge an
  **jedes** Mitglied, auch an die mit abgeschaltetem `notify_app_event`.
  Gemessen: die Mutation auf einen eigenen Typ lässt genau diese Zusage fallen.
- **Die Anmeldungsprüfung in D7 ruht auf einer fremden Policy.**
  `not exists (… event_registrations …)` läuft unter RLS und trägt nur, weil
  `regs_select_self_or_host` dem Host die Anmeldungen seiner Events zeigt.
  Steht im Migrationskopf; Wächter ist Zusage 5 in
  `event_serie_aenderung_test.sql`.
- **Gemessene Folge, keine Absicht:** ein verschobener, anmeldungsfreier
  Zukunftstermin wird von der erneuten Erzeugung auf seinen Slot
  zurückgeholt. Folgt zwingend aus D7. Als eigene Zusage festgehalten.
- **`events.arten.test.ts` umgestellt** von „genau eine Constraint-Definition"
  auf „alle sagen dasselbe" — strenger, nicht schwächer.

## Files modified

| Pfad | Was |
| --- | --- |
| `supabase/migrations/20260907090000_event_serie_regel.sql` | **neu** — `event_serie_slots()` |
| `…/20260907093000_event_serie_erzeugen.sql` | **neu** — die RPC |
| `…/20260907100000_event_serie_aenderung.sql` | **neu** — D7-Aktualisierung |
| `…/20260907103000_event_cover_lesbar_vorlagen.sql` | **neu** — zweiter Lese-Zweig |
| `…/20260907110000_event_serie_cover.sql` | **neu** — `p_cover_pfade`, drop+Neuanlage |
| `…/20260907113000_event_serie_rundruf.sql` | **neu** — Rundruf je Erzeugung |
| `supabase/tests/event_serie_{regel,erzeugen,aenderung,cover,rundruf}_test.sql` | **neu** — 52 Zusagen |
| `supabase/tests/rls_test.sql` | +5 Zusagen zum Vorlagen-Cover, plan 435 → 440 |
| `src/lib/events.arten.test.ts` | Wächter auf „alle sagen dasselbe" |
| `.github/workflows/ci.yml` | fünf neue pgTAP-Dateien in die Liste |
| `openspec/changes/…/{design,tasks}.md`, `specs/events/spec.md` | Herbst-Korrektur, Gruppen 4–8 abgehakt |

## Next session: start here

**Gruppe 9, die Oberfläche — aber erst die offene Frage klären.** Der Rest ist
gebaut und grün; es fehlt die UI und danach Gruppe 10 (Abnahme, Diff-Review,
Archivieren). Erste Handlung: Donald fragen, ob die **Vorlagenliste eine eigene
Seite** bekommt oder in die bestehende Eventverwaltung gehört — das entscheidet
den Zuschnitt von 9.1 und ist nicht ableitbar.

Was in Gruppe 9 sonst wartet, alles schon vorbereitet:
`EventForm` und den bestehenden Cropper wiederverwenden (9.1); der
Erzeugen-Dialog kann die Vorschau direkt aus `event_serie_slots()` holen, die
Funktion trägt `grant execute` an `authenticated` (9.2); **die Client-Hälfte von
7.7** — `storage.copy()` je Termin mit **UUID**-Namen vor dem RPC-Aufruf, die
Reihenfolge der Pfade muss der nach `slot_datum` sortierten Slotliste
entsprechen, die RPC prüft die Länge und weist Abweichungen mit 22023 ab; und
`src/lib/database.types.ts` **von Hand** nachziehen, `supabase gen types` darf
nicht darüberlaufen (9.4).

**Vor dem Messen:** der lokale Stack trägt alle sechs Migrationen bereits (per
`psql` eingespielt, **nicht** `db reset` — der Stack ist geteilt). Und:
`supabase test db` mit der ganzen CI-Liste scheitert in diesem Worktree an der
Pfadlänge (`NOTESTS`) und legt bei unquotierter Dateiliste Streuverzeichnisse
unter `supabase/tests/` an, die danach `pnpm lint` mit `ENAMETOOLONG` töten. In
Blöcken zu 7 fahren, Liste immer als Array übergeben.

## Open questions

- **Vorlagenliste: eigene Seite oder in die bestehende Eventverwaltung?**
  Blockiert Gruppe 9, sonst nichts.
- **Beim Löschen einer Vorlage anbieten, zukünftige leere Termine mitzunehmen?**
  (Review NIEDRIG.) DB-Standard `set null` bleibt in jedem Fall das Netz.
- **Cover-Größenverteilung im Bucket ist nicht gemessen** (design.md D5).
- **`REVIEWS.md` trägt keinen signierten Trailer** — das §18-Gate meldet das bei
  jedem Commit als `NOTE`, blockt aber nicht. Vor dem Archivieren nachziehen.
- **`events.vorlage_id` ist für fremde Mitglieder lesbar** — bewusst
  hingenommen, unter Risks vermerkt.
