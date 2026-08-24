# Session Handoff — 2026-08-24 (sechzehnte Sitzung)

**AGE-581 ist gemergt und auf PROD.** 11.5 (Fremd-Review) und 11.6 (Sichtprobe)
abgeschlossen, sechs Befunde, vier davon behoben. PR #201 gemergt, `migrate-prod`
gelaufen, alle drei Flächen einzeln belegt. 67 von 76 Aufgaben. 1433 Vitest,
606 pgTAP, 90 Deno.

## Accomplished

**11.5 — Diff-Review durch zwei Fremdanbieter.** codex 7 Befunde, gemini 10.
Jeder gegen den Code nachgeprüft; **6 von geminis 10 widerlegt** (der als HIGH
gemeldete `payment_type`-Fehler war seit `5a1ed03` behoben, `log_admin_action`
existiert, Zeilenzustand überlebt die Paginierung nicht — `key={m.id}`).

**Vier Befunde behoben, jeder mit Gegenprobe** (Donalds Entscheidung: die drei
billigen plus HIGH-1 vor den Merge):

| Befund | Fix |
|---|---|
| HIGH `[true,true]` war eine Behauptung | `sollGebannt()`, Auth-Schritt läuft immer |
| `array_length` zählte Dimensionen | Migration `20260824110000`, `cardinality` + `ndims` |
| Aktivierungswege ohne Lebenszyklus | Migration `20260824120000`, drei Stellen + Status `blocked` |
| Zustandsspalte sagte „Aktiviert" | Lebenszyklus geht vor, `muted` |

**11.6 — Sichtprobe, zweiter Befund gefunden und behoben.** Die Detailseite
meldete über einem GELÖSCHTEN Mitglied „bestätigt", darunter ein voll
bearbeitbares Formular. Rein clientseitig behoben, keine Migration.

**Auf PROD gebracht, dreifach belegt.** PR #201 → `7e7f113`; `migrate-prod`
plan+apply grün; danach **unabhängig gelesen**: PROD 79/79, null fehlend, null
nur-remote, und die vier geänderten Funktionsrümpfe tragen den neuen Inhalt.
Deploy per `gh run rerun --failed` nachgezogen — `drift-gate` danach grün,
`functions` lieferte `admin-set-member-ban` (neu, v1) und `send-activation`
(v5). Live-Bündel trägt die Zeichenketten aus dem jüngsten Commit.

## Decisions

- **Der Lebenszyklus ERSETZT die Aktivierungsplakette, statt danebenzustehen.**
  *Warum:* ob ein entferntes Konto einmal bestätigt war, ist Vorgeschichte und
  kommt beim Wiederherstellen zurück; zwei Plaketten hätten in jeder Zeile die
  Breite verschoben, wie „unbekannt" schon einmal.
- **Der Wächter steht in `mark_activated`, nicht nur in den Aufrufern.**
  *Warum:* ein Gate, das nur in den Aufrufern steht, fehlt beim nächsten
  Aufrufer. `admin_activate_member` trägt ihn ein zweites Mal, damit der Admin
  den Grund genannt bekommt statt eines Fehlers aus einer fremden Funktion.
- **`blocked` als neuer Status statt `unknown` zurückzugeben.** *Warum:* nach
  aussen sind beide 202 und ununterscheidbar (Anti-Aufzählung), im Protokoll
  steht aber der wahre Grund. Die Erlaubnisliste in `status.ts` erzwingt, dass
  ein neuer Status bewusst nachgezogen wird.
- **`array_ndims > 1` wird zusätzlich abgewiesen.** *Warum:* `cardinality()`
  allein zählte richtig, liesse aber weiter mehrdimensionale Arrays zu, für die
  das Ergebnis der Funktion sinnlos ist.
- **HIGH-2, Paging der Teilnehmer-RPC, Draft-Überschreiben und zwei
  LOW-Zusagen NICHT behoben** — als Folge notiert. *Warum:* HIGH-2 braucht zwei
  gleichzeitige Admins und einen eigenen Entwurf (Outbox/Versionswert).

## Files modified

- `supabase/functions/admin-set-member-ban/ban.ts` — `sollGebannt()`,
  `banDauerFuer(boolean)`, Invariante statt Fallunterscheidung
- `supabase/functions/admin-set-member-ban/index.ts` — zweiter Schritt läuft immer
- `supabase/functions/admin-set-member-ban/ban.test.ts` — +2 Zusagen
- `supabase/functions/send-activation/status.ts` + `.test.ts` — `blocked`
- `supabase/migrations/20260824110000_former_member_entries_cardinality.sql` — **neu**
- `supabase/migrations/20260824120000_aktivierung_prueft_lebenszyklus.sql` — **neu**
- `supabase/tests/member_lifecycle_rpc_test.sql` — +5 Zusagen, plan(39)
- `src/pages/AdminMitgliederPage.tsx` + `.test.tsx` — Zustandsspalte, +4 Zusagen
- `src/pages/AdminMitgliedPage.tsx` + `.test.tsx` — Kopfzeile, +4 Zusagen
- `src/lib/admin-profile.ts` — `deaktiviert`/`geloescht` in `AdminProfileData`
- `openspec/changes/add-admin-member-lifecycle/tasks.md` — 11.5, 11.6

## Next session: start here

**Abschnitt 12, die Datenpflege auf PROD** — 12.0 bis 12.7, und sie ist Teil der
ABNAHME von AGE-581 („59 Mitglieder mit gesetzter Zahlungsart, 56 mit
`paid_until`, 11 deaktiviert"). Linear steht trotzdem schon auf **Done**, weil
die GitHub-Automation beim Merge schaltet — der Status ist also kein Beleg.
Erste Handlung: **12.7, der Trockenlauf**, der die Umgebung nennt und die
Wirkung zeigt, BEVOR 12.1–12.6 laufen. Danach 12.0, der zeilenweise Abgleich als
Beleg ins Repo — dabei die Regel beachten, dass **keine Klarnamen und keine
Adressen** ins öffentliche Repo dürfen.

Werkzeuge stehen: `scripts/probe-age581-abgleich.ts` und
`scripts/age581-abgleich-tabelle.mjs`. PROD lesen geht per `infisical run
--env=prod -- node <datei im Repo>` mit `SUPABASE_DB_URL_PROD` und
`scripts/supabase-root-2021-ca.crt` — die Datei MUSS im Repo liegen, sonst
findet node `pg` nicht; danach löschen. Schreibende PROD-Wege blockt der
Klassifikator, bis Donald sie ausdrücklich freigibt.

## Open questions

- **Ich habe das PROD-DB-Passwort ins Terminal ausgegeben** (`infisical secrets
  --env=prod` ohne Maskierung, 24.08.). Es steht nicht im Repo, aber im
  Sitzungsprotokoll. Rotation ist Donalds Entscheidung.
- **Vier Review-Befunde bleiben offen:** HIGH-2 (Zeilensperre endet vor dem
  GoTrue-Aufruf; braucht zwei gleichzeitige Admins) · `event_attendees`-RPC ohne
  `limit`/`offset` · Draft und Server-Baseline sind in der Mitgliedschaftszeile
  derselbe Zustand · zwei pgTAP-Negativzusagen laufen vor ihrem Fixture.
- **`app.fairbusinessclub.de` hat weiter keinen DNS-Eintrag.** Go-Live-Punkt.
- **69 von 71 Mitgliedern auf PROD sind nicht aktiviert** — sie kommen erst über
  den Aktivierungsversand herein. Seit heute gilt: ein deaktiviertes oder
  gelöschtes Konto bekommt dabei KEINEN Link mehr (Status `blocked`).
- **Das Onlinetreffen ist am 25.08.**, also morgen.
- Unverändert offen: 7.5 stimmt nur zur Hälfte · kein Nachsetz-Weg für eine
  gelöschte Zeile ohne Ban · `grund` ohne Aufrufer · `admin_audit.actor` ohne
  `on delete cascade` · Abweichungen 4.5 und 9.3 begründet, nicht abgenommen ·
  Downgrade (AGE-516) · `admin_list_feedback()` ohne Paging.
- **Der lokale Stack trägt jetzt veränderte Testdaten** (Carla deaktiviert +
  Zahlungsart Stripe, Bodo aktiviert, Dora deaktiviert ohne Löschung).
  `scripts/probe-age581-sichtprobe-daten.ts` stellt sie mit neuem Passwort her.
