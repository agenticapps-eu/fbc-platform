# Session Handoff — 2026-09-07 (AGE-630 abgeschlossen und ausgeliefert)

> ## ⚠ ZUERST — Scope dieser Übergabe
>
> **1. Sie führt AGE-630, und AGE-630 ist fertig.** Kein Branch, kein Worktree,
> nichts Offenes. Die Datei ist für alle parallelen Sitzungen dieselbe und
> kollidiert bei jedem Rebase — **nicht zusammenführen**, überschreiben.
>
> **2. AGE-642 läuft in einer EIGENEN Sitzung**
> (`fbc-platform-donald-age-642-capacitor-hu-57`), Worktree
> `../fbc-platform.donald-age-642-capacitor-huelle`. Von hier aus ist daran
> **nichts** zu tun — und der Worktree darf nicht abgeräumt werden.
>
> **3. Die Details stehen NICHT hier**, sondern in
> `openspec/changes/archive/2026-09-07-events-vorlagen-und-serientermine/` —
> `tasks.md` (Belege je Aufgabe), `REVIEWS.md` (beide Review-Stufen),
> `design.md` (D1–D8). Diese Datei ist der Überblick.

## Accomplished

**AGE-630 „Event-Vorlagen und Serientermine" ist gebaut, geprüft, gemergt,
migriert und live.** PR [#359](https://github.com/agenticapps-eu/fbc-platform/pull/359)
(Squash `ccf186d`) und [#360](https://github.com/agenticapps-eu/fbc-platform/pull/360)
(Übergabe). Change archiviert, **10 Requirements** in `openspec/specs/events/spec.md`.

Ein Host legt eine Vorlage an (Titel, Ort, Uhrzeit, Wiederholungsregel) und
erzeugt daraus bis zu 52 Termine — mit Pflichtvorschau davor. Erzeugte Termine
sind gewöhnliche `events`-Zeilen und erben Kapazität, Warteliste, Check-in und
Anmeldung unverändert.

**Alle drei Flächen sind durch:**

| Fläche | Weg | Beleg |
|---|---|---|
| DB **DEV** | `migrate-dev` automatisch | success |
| DB **PROD** | `migrate-prod` **von Hand** | Historie danach `OK — 131 Migrationen, abweichungsfrei` |
| Frontend + OTA | `gh run rerun <id> --failed` | `deploy` success, OTA-Kopf `0.0.0+ccf186d50a97` |

Edge Functions sind nicht betroffen. Linear steht auf **Done**.

## Decisions

- **Die Vorlagen bekommen keine eigene Seite**, sondern den vierten Reiter unter
  `/events` — in der Linie von AGE-442 („keine weitere Unterseite") und AGE-494
  („ein dritter Weg zum selben Ort").
- **Die Vorschau ruft dieselbe Funktion, die danach schreibt.** Eine nachgebaute
  Datumsrechnung wäre eine zweite Wahrheit, die an der nächsten Zeitumstellung
  auseinanderläuft.
- **Ein Anweisungs-Trigger statt eines Aufrufs in der RPC.** Der naheliegende Weg
  hätte `authenticated` das Ausführungsrecht auf `hinweis_rundruf` gekostet — und
  wer die aufrufen darf, kann die gesamte Mitgliedschaft anschreiben.
- **Drei Review-Befunde bewusst NICHT behoben**, jeder mit Grund in `REVIEWS.md`:
  doppelter `Europe/Berlin`-Fallback, stille Kappung im Bis-Datum-Modus des
  Clients, `v_anzahl = 0` ohne 22023.

### Der Befund, den nichts anderes gesehen hätte

**`event_serie_slots()` hatte keine Obergrenze für `p_anzahl`.** Die 52er-Grenze
sitzt in `event_serie_erzeugen()` — aber `authenticated` ruft die Slot-Funktion
direkt auf, das braucht die Vorschau. Gemessen: `p_anzahl = 100000` lieferte
100000 Zeilen. Kein Datenleck (die Funktion liest keine Zeile), sondern
**Verfügbarkeit** auf einer geteilten Datenbank.

Behoben in `20260907120000`. **Die Grenze ist 53, nicht 52** — der Enddatum-Pfad
sondiert absichtlich mit 53; eine 52 hätte genau diese Prüfung erschlagen.

Er war in keiner Plan-Review, in keiner Sichtprobe und in keinem der 2596 Tests
sichtbar — er hängt nicht am Verhalten, sondern an einer Grenze zwei Funktionen
weiter. Gefunden hat ihn der Diff-Review (opencode), der trotzdem APPROVE gab.

## Files modified

Vollständige Liste in `…/archive/2026-09-07-…/tasks.md`. Die Substanz:

- 8 Migrationen (`20260906090000` … `20260907120000`)
- `src/lib/event-vorlagen.ts`, `VorlageForm/VorlagenPanel/SerieErzeugen.tsx`
- 6 neue pgTAP-Dateien; `grants_test.sql` §8b, `rls_test.sql` §20.7b
- `openspec/specs/events/spec.md` — +10 Requirements

## Next session: start here

**Im Projekt „eff.bee.zee — Go-Live August 2026" ist nichts mehr *In
Progress*** — AGE-630 war das letzte. Offen sind dort nur Backlog-Vorgänge
(Stand 07.09., in Linear gemessen):

| Vorgang | Prio | Worum es geht |
|---|---|---|
| AGE-610 | High | Klärungen mit Detlev und dem Anwalt — **kein Code** |
| AGE-684 | Medium | Resend als SMTP in Supabase Auth; erst danach lässt sich `rate_limit_email_sent` anheben |
| AGE-512 | Medium | Stripe- und Resend-Secrets zwischen DEV und PROD trennen |
| AGE-607 | Medium | Überlauf-Messung im Browser statt im Quelltext |
| AGE-606 | Low | `format:check` rot (211 Dateien), läuft in keinem Workflow |
| AGE-516 | — | Rückstufung bei geplatzter Zahlung |

**Empfehlung: AGE-684 und AGE-512 zusammen.** Beide hängen an Resend und der
Trennung der Secrets zwischen den zwei Projekten; einzeln fasst man dieselbe
Konfiguration zweimal an. Es ist ausserdem der Pfad, den ein **neues** Mitglied
zuerst trifft. Präzedenzfall aus der Memory: ein für lokales Testen gesetztes
`APP_URL` liess **jede** Mail der Live-Seite auf `localhost` zeigen.

**Nicht anfassen: die Mobile-Spur.** AGE-642 (M2, Urgent) ist *In Progress* und
gehört der anderen Sitzung; AGE-643 (Deep Links) und AGE-644
(Store-Einreichung) hängen daran.

### Zwei Nachzügler aus AGE-630 — Entscheidungen, keine Fixes

1. **Der Release-Eintrag ist ein Entwurf in Ingenieurssprache.** Er heisst
   „Wiederkehrende Termine aus einer Vorlage" und trägt AGE-630, aber die acht
   Stichpunkte reden von `event_vorlagen` und `BYDAY=1TU`. Der Admin schreibt
   ihn vor dem Versand um — bis dahin erfährt kein Mitglied, dass es die
   Funktion gibt.
2. **Die Cover-Größenverteilung im Bucket ist ungemessen** (design.md D5). Bei
   52 Kopien je Serie eine Speicher-, keine Korrektheitsfrage — aber eine Zahl
   dazu wäre billig und steht bisher nirgends.

## Open questions

- **Beim Löschen einer Vorlage zukünftige leere Termine mitnehmen?** (Review
  NIEDRIG.) Heute sagt der Toast „Bereits erzeugte Termine bleiben bestehen".
- **`events.vorlage_id` ist für fremde Mitglieder lesbar** — bewusst
  hingenommen, unter Risks vermerkt.
- **`REVIEWS.md` trägt keinen signierten Trailer.** Wird als `trailer-absent`
  gemeldet, blockt nicht — von Hand nachgetragen behauptete er eine Bindung, die
  es nie gab.

> ⚠ **`wt remove --reap` am eigenen Worktree beendet die Shell darin mit** (Exit
> 144), und die Sitzung bleibt danach auf den gelöschten Pfad **gepinnt** —
> `git -C …` wird noch abgelehnt. Der Ausweg ist kein Befehl, sondern
> **`ExitWorktree` mit `action: "keep"`**. Hat auf Anhieb funktioniert, obwohl
> die Werkzeugbeschreibung sagt, es wirke nur auf `EnterWorktree`-Sitzungen.

> ⚠ **Ein Doku-Nachzügler macht den Linear-Vorgang wieder auf.** Merge von #359
> → Done (13:25), **Öffnen** von #360 → In Progress (13:38), Merge von #360 →
> Done (15:33). Nach dem Merge eines Folge-PRs also **noch einmal** nachsehen.
