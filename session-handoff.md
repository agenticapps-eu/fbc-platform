# Session Handoff — 2026-09-07 (AGE-630: Event-Vorlagen und Serientermine)

> ## ⚠ ZUERST — Scope dieser Übergabe
>
> **1. Sie führt nur AGE-630** (Event-Vorlagen und wiederkehrende Termine),
> Branch `donald/age-630-event-vorlagen-und-serien`. Die Datei ist für alle
> parallelen Sitzungen dieselbe und kollidiert bei jedem Rebase —
> **nicht zusammenführen**, überschreiben.
>
> **2. Vorher stand hier AGE-642 B3** (Android-Signierung, Release-Workflow).
> Vollständig in `git show 118ed46:session-handoff.md` (PR #354, auf `main`
> seit 06.09. — der frühere Zeiger auf `b346043` ist überholt). **Diese Sitzung
> läuft noch** — Linear steht auf *In Progress*, und ihr Worktree
> `fbc-platform.donald-age-642-capacitor-huelle` **darf nicht abgeräumt
> werden**. Offen dort: iOS-Signierung, `versionCode` = 1, der
> `android-release`-Workflow ist gebaut, aber **nie gelaufen** — er wartet auf
> ein geschütztes GitHub-Environment, das nur Donald anlegen kann; solange
> dürfen auch Dependabot #349–#351 nicht gemergt werden. Dazu B5.
> Von AGE-630 aus ist daran nichts zu tun.
>
> **3. Die Begründungen im Detail stehen NICHT hier**, sondern in
> `openspec/changes/events-vorlagen-und-serientermine/` — `design.md` (D1–D8),
> `REVIEWS.md` (13 Befunde) und im Kopf der Migration. Diese Datei ist der
> Überblick.

## Accomplished

- **Worktree-Landschaft aufgeräumt.** AGE-605-Worktree entfernt (PR #342
  gemergt, 777,9 MiB), fünf Residuen-Verzeichnisse gelöscht, **15 verwaiste
  vite/vitest-Prozesse** beendet (ältester vom 25.08.), Ports 5173–5202 frei.
  Übrig: `main`, AGE-642 (fremd), AGE-630.
- **AGE-630 geplant, fremdreviewt, überarbeitet.** OpenSpec-Change
  `events-vorlagen-und-serientermine`, 4 Artefakte, `validate` grün.
- **Plan-Review durch zwei fremde Anbieter**, beide REQUEST-CHANGES:
  `gemini-pro` (6 Befunde) und `opencode`/`hf:moonshotai/Kimi-K3` (7 Befunde),
  zusammen **6 HOCH**. Alle behandelt, Plan in 2. Fassung.
- **Gruppe 2 + 3 gebaut** (Datenmodell): RED → GREEN → Gegenprobe.
  `Files=4, Tests=496, Result: PASS`.
- Zwei Commits: `b26aff9` (Plan), `84676f4` (Datenmodell).

## Decisions

- **Materialisieren statt rechnen.** `event_registrations` hängt per FK an
  `events.id`, und `register_for_event` sperrt diese Zeile zum Zählen. Eine
  berechnete Serie hätte für einen künftigen Termin keine `id`.
- **Vorlagen UND Wiederholung in einem Change** (Donald, gegen meinen
  Vorschlag, erst Vorlagen zu bauen).
- **Rechte wie bei Events heute.** Gemessen: `events_write_host` trägt **kein**
  `has_level`-Gate; die Stufenprüfung sitzt auf `regs_write_own`.
- **Komposit-FK `(vorlage_id, host_id)`** statt einfachem FK. Aus der Review:
  `events_write_host` kennt `vorlage_id` nicht, und die FK-Prüfung läuft
  **nicht** unter der RLS der Zieltabelle — sonst hätte ein Host Events auf die
  Slots einer fremden Reihe schreiben können, deren Erzeugung danach lautlos in
  `on conflict do nothing` gelaufen wäre.
- **`slot_datum` statt `starts_at`** als Idempotenzschlüssel. Beide Reviewer
  unabhängig: hängt sie an `starts_at`, legt die Regel einen verschobenen
  Termin erneut an.
- **Cover: zweiter Lese-Zweig nur für den Host, Kopie durch den Client, UUID.**
  Die erste Fassung war **nicht baubar** — eine SQL-Funktion kann die Datei
  nicht kopieren, und `event_cover_lesbar()` schlägt nur über
  `events.cover_path` nach, das Vorlagen-Cover wäre selbst seinem Host unlesbar.
- **Ein Rundruf je Erzeugung, Feed je Termin.** Gemessen: zwei
  `after insert for each row`-Trigger auf `events` — 52 Termine hätten 52
  plattformweite Rundrufe samt Push in einer Transaktion ausgelöst.
- **Zeitzone per Trigger, nicht `check`.** Ein `check` darf keine Unterabfrage
  enthalten. Die Abkürzung „Hilfsfunktion als `immutable`" wäre eine
  Falschaussage.
- **Obergrenze 52** je Aufruf; **Vorlage löschen** lässt Termine überleben
  (`on delete set null`, `cascade` verworfen).
- **Frühjahrsumstellung: weiterschalten** (02:30 → 03:30), nicht auslassen —
  ein still fehlender Termin ist der schlechtere Ausgang.

## Files modified

| Pfad | Was |
| --- | --- |
| `openspec/changes/events-vorlagen-und-serientermine/proposal.md` | Warum, Umfang, Impact |
| `…/design.md` | **2. Fassung** nach Review, D1–D8, gemessene Zeitzonenwerte |
| `…/specs/events/spec.md` | Delta, 11 Requirements — u. a. Slot-Besetzung, Rundruf, Serienänderung |
| `…/tasks.md` | 10 Gruppen; 1–3 abgehakt |
| `…/REVIEWS.md` | beide Reviews, je Befund die Behandlung |
| `supabase/migrations/20260906090000_event_vorlagen_und_serientermine.sql` | **neu** — Tabelle, komposit-FK, Indizes, Zeitzonen-Trigger |
| `supabase/tests/event_vorlagen_test.sql` | **neu** — 21 Zusagen inkl. Sicherheitszusage + Positivkontrollen |
| `supabase/tests/grants_test.sql` | Golden um `event_vorlagen` ergänzt |
| `.github/workflows/ci.yml` | neue Testdatei in die Liste |

## Next session: start here

**Gruppe 4, die Wiederholungsregel — RED zuerst.** Die Datenschicht steht und
ist grün; es fehlt die Auswertung der drei Regelformen. Erste Handlung: in
`supabase/tests/` eine Datei für die Regel anlegen (oder
`event_vorlagen_test.sql` erweitern) mit den **bereits verifizierten** Daten aus
`specs/events/spec.md` — wöchentlich ab 01.09.2026 → 01./08./15./22.09.; erster
Dienstag ab 09/2026 → 01.09., 06.10., 03.11., 01.12.2026 (kalendarisch geprüft,
auch von opencode unabhängig nachgerechnet). Dazu die vier Grenzfälle:
Monatsstart *ist* der gesuchte Wochentag (01.09.2026 ist ein Dienstag),
`monatlich_tag = 31` überspringt Monate und zählt sie **nicht** in `anzahl`
mit, Frühjahrslücke (02:30 → 03:30), Herbstüberlappung (genau ein Termin,
erste Lesart). Erst danach die Auswertung bauen. Anschließend Gruppen 5–8 (RPC,
Serienänderung, Cover, Rundruf) — Donald hat „durchlaufen" gesagt, also nicht
nach jeder Gruppe rückfragen.

**Vor dem Messen:** `pnpm install --frozen-lockfile` (ein frischer Worktree hat
keine `node_modules`), und der lokale Stack trägt die Migration bereits — sie
wurde per `psql` eingespielt, **nicht** per `db reset`, weil der Stack geteilt
ist und Objekte trägt, die in keiner Migration stehen.

## Open questions

- **Vorlagenliste: eigene Seite oder in die bestehende Eventverwaltung?**
  Reine Oberflächenfrage, blockiert das Datenmodell nicht.
- **Beim Löschen einer Vorlage anbieten, zukünftige leere Termine mitzunehmen?**
  (Review NIEDRIG, gemini.) DB-Standard `set null` bleibt in jedem Fall das Netz.
- **Cover-Größenverteilung im Bucket ist nicht gemessen.** Steht so in `design.md`
  D5 — nachholen, falls jemand die Speicherkosten der Kopie-je-Termin bestreitet.
- **`events.vorlage_id` ist für fremde Mitglieder lesbar** — Grobstruktur fremder
  Serien ableitbar. Bewusst hingenommen, unter Risks vermerkt.
