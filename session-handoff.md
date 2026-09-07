# Session Handoff — 2026-09-07 (AGE-630 zu, AGE-705 liegt bereit)

> ## ⚠ ZUERST — Scope dieser Übergabe
>
> **1. Sie führt AGE-705**, und AGE-705 ist noch nicht angefangen: kein Branch,
> kein Worktree, keine Zeile Code. Die Datei ist für alle parallelen Sitzungen
> dieselbe und kollidiert bei jedem Rebase — **nicht zusammenführen**,
> überschreiben.
>
> **2. AGE-642 läuft in einer EIGENEN Sitzung**
> (`fbc-platform-donald-age-642-capacitor-hu-57`), Worktree
> `../fbc-platform.donald-age-642-capacitor-huelle`. Von hier aus ist daran
> **nichts** zu tun — und der Worktree darf nicht abgeräumt werden.
>
> **3. AGE-630 ist abgeschlossen und ausgeliefert.** Die Details dazu stehen in
> `openspec/changes/archive/2026-09-07-events-vorlagen-und-serientermine/`
> (`tasks.md`, `REVIEWS.md`, `design.md`) — nicht hier. Die vorige Fassung
> dieser Datei führte sie im Detail; sie ist damit erledigt.

## Accomplished

- **AGE-630 vollständig geschlossen.** PR [#361](https://github.com/agenticapps-eu/fbc-platform/pull/361)
  (Squash `6490c0e`) war noch offen — CI grün, gemergt, `main` nachgezogen.
  Linear steht auf **Done** (15:47:51; der Merge hat ihn selbst zugemacht).
- **Die zwei AGE-630-Nachzügler abgearbeitet**, beide als Entscheidung, nicht
  als Fix:
  - **Release-Text in Mitgliedersprache geschrieben** (8 Stichpunkte). Er ist
    **nicht versendet** — und soll es womöglich auch nicht mehr einzeln, siehe
    AGE-705.
  - **Cover-Größen gegen PROD gemessen** (design.md D5, unten).
- **AGE-705 angelegt** — Donalds Zuruf vom 07.09., der nächste Punkt für den
  08.09.

## Decisions

- **Der Release-Entwurf wird nicht an der Quelle repariert.**
  `src/lib/release-entwurf.ts` sagt im Kopf selbst, der generierte Text sei ein
  Vorschlag zum Überschreiben. Das archivierte Proposal umzuschreiben hätte eine
  abgeschlossene OpenSpec-Change verändert, um ein Symptom zu behandeln, das per
  Design vorgesehen ist.
- **Der Versand bleibt Donalds Klick.** Ein Rundruf erreicht alle 74 Profile.
- **AGE-705 kam in „Go-Live August 2026", nicht in den Nach-Go-Live-Backlog** —
  es ist die nächste aktive Arbeit, kein Später.
- **AGE-560 wurde NICHT angefasst.** Sie heißt „Release-Mechanismus neu denken"
  und liest sich wie ein Duplikat, gehört aber zu **fx-signals**
  (`apps/web/src/components/WhatsNew.tsx`). Falsches Repo, gleiche Wörter.

### Der Befund, nach dem niemand gefragt hatte

Beim Messen von D5: **4 der 7 Objekte in `event-covers` (PROD) hängen an keinem
Event.** Grund ist, dass **nie etwas aus dem Bucket gelöscht wird** — `feed.ts`
und `feedback.ts` rufen `storage.remove()`, die Event- und Profilpfade nie; in
`src/lib/profile.cover.test.ts:137` steht das ausdrücklich als Absicht.

Ein gelöschtes Event, ein ausgetauschtes Titelbild und eine verworfene
Vorlagen-Erzeugung lassen ihre Datei dauerhaft liegen — und eine Serie legt bis
zu 52 Kopien an. **Hat noch keinen Vorgang.** Donald wurde gefragt und hat
stattdessen AGE-705 gesetzt; die Frage ist also offen, nicht abgelehnt.

Die eigentliche D5-Zahl ist dagegen langweilig, und das ist die Antwort: 7
WebP-Bilder, 84.876–115.486 B, **Median 89.820 B**. Eine 52er-Serie kostet
**≈ 4,5 MiB** — neben `ota-buendel` (189 MB in 63 Objekten) belanglos.
**D5 ist keine Speicherfrage.**

## Files modified

- `session-handoff.md` — diese Datei (die vorige Fassung ist als `6490c0e` auf
  `main`).
- Sonst **keine** Code-Änderung in dieser Sitzung.
- Ausserhalb des Repos: `cover-seitenverhaeltnisse-gemessen.md` in der Memory um
  die PROD-Messung und den Waisen-Befund ergänzt; der Release-Text liegt im
  Scratchpad (`release-age-630-mitgliederfassung.md`) — **flüchtig**, er steht
  vollständig im Sitzungsprotokoll und im Kern in AGE-705.

## Next session: start here

**AGE-705 lesen, nicht neu messen.** Der Ist-Zustand steht vollständig im
Issue-Rumpf: 76 Archiv-Verzeichnisse → 75 Einträge → **263 Stichpunkte**, davon
57 mit AGE-Bezug; der heutige Weg Entwurf → `/admin/neuigkeiten` → `release_notes`
(draft→sent) → `ReleaseNoteModal`; `posts_kind_check` als geschlossene Menge;
die Domain- und die RLS-Lage.

Der erste Schritt ist **keine Zeile Code**, sondern die eine Entscheidung, aus
der alle anderen folgen: **wo der lesbare Text dauerhaft lebt** — in
`release_notes` (DB als Quelle, Website und Aktivität lesen daraus) oder im Repo
(Build als Quelle, der Admin-Versand liest daraus). Danach die Auswahl treffen,
welche der 75 Einträge ein Mitglied überhaupt interessieren. Erst dann ein
OpenSpec-Proposal.

**Reihenfolge-Vorschlag aus dem Issue:** Quelle + Auswahl (ohne Code) →
Aktivität (kleinste Fläche, ganz in der App) → Website. Die Tutorials sind der
grösste Textblock und hängen an keinem der drei technischen Schritte.

**Nicht anfassen: die Mobile-Spur.** AGE-642 (M2) ist *In Progress* und gehört
der anderen Sitzung; AGE-643 (Deep Links) und AGE-644 (Store-Einreichung) hängen
daran.

**Sonst offen im Projekt** (Stand 07.09.): AGE-610 (Klärungen mit Detlev und
dem Anwalt, kein Code), AGE-684 + AGE-512 (Resend als SMTP und die Trennung der
Secrets — beide fassen dieselbe Konfiguration an, gehören zusammen), AGE-607
(Überlauf im Browser messen), AGE-606 (`format:check` rot, 211 Dateien),
AGE-516 (Rückstufung bei geplatzter Zahlung).

## Open questions

- **Bekommen die Waisen-Cover einen Vorgang?** Siehe oben — gefragt, nicht
  beantwortet.
- **Wird der AGE-630-Release-Text noch einzeln versendet**, oder geht er in der
  neuen Systematik aus AGE-705 auf? Im Issue ist er als Nachzügler vermerkt.
- **`effbeezee.com` ohne `www`** — Weiterleitung bei Strato, oder gar nicht?
  Der Apex kann kein CNAME, das ist gemessen und steht in AGE-256.
- Aus AGE-630 unverändert offen: beim Löschen einer Vorlage zukünftige leere
  Termine mitnehmen? `events.vorlage_id` ist für fremde Mitglieder lesbar
  (bewusst hingenommen).

> ⚠ **Nicht der Titel schliesst den Vorgang, sondern der BRANCHNAME.** Diese
> Übergabe ist der Beleg: ihr PR-Titel trug bewusst AGE-630 und nicht AGE-705 —
> der Branch hiess trotzdem `donald/uebergabe-age-705`, und der Merge von #362
> setzte **AGE-705 auf Done**, zwei Sekunden nach dem Merge, an einem Vorgang
> ohne eine Zeile Code. Zurückgesetzt auf *Todo* um 16:32.
>
> **Die Regel lautet deshalb:** vor `git checkout -b` fragen, ob dieser PR den
> Vorgang wirklich erledigt. Wenn nein, gehört **kein Kürzel in den Branchnamen**
> — auch nicht in den Titel, aber der Branch allein genügt der Automation. Und
> danach trotzdem nachsehen: `list_issues` mit `updatedAt: -PT1H`.
