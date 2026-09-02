# Session Handoff — 2026-09-02 (AGE-598: Teil A und B gebaut, Ausrollen offen)

> ## ⚠ ZUERST — drei Dinge
>
> **1. Diese Datei ist geteilt und trägt jeweils EINEN Vorgang.** Sie steht auf
> AGE-598. Die AGE-642-Fassung ist nicht verloren
> (`git show origin/main:session-handoff.md`). **Nicht zusammenführen.**
>
> **2. AGE-642 läuft PARALLEL** (Worktree `fbc-platform.donald-age-642-capacitor-huelle`).
> **Nicht anfassen.** Der lokale Supabase-Stack ist geteilt.
>
> **3. Gruppen 1–8 sind fertig, 9 und 10 nicht angefangen.** Ab Gruppe 9 geht es
> ans Ausrollen, und 9.3 (`migrate-prod`) braucht Donalds ausdrückliche Freigabe.

## Accomplished

Sechs Aufgabengruppen (4, 5, 6, 7, 8) in acht Commits. Teil A stand schon.

| Commit | Was |
|---|---|
| `678b0f3` | **RED** Gruppe 4 — ausgeblendete Filter |
| `e4eb844` | **GREEN** Gruppe 4 — Filter auf maskierten Spalten weg, Hinweis dafür |
| `d84bb71` | **RED** Gruppe 5 — neue pgTAP-Datei + Eintrag in `ci.yml` |
| `a9109a0` | **GREEN** Gruppe 5 — Migration `…180000_kontaktanfrage_staffelung.sql` |
| `1d049d7` | **RED** Gruppe 6 — Welpenschutz |
| `0949864` | **GREEN** Gruppe 6 — Migration `…190000_welpenschutz_entfernen.sql` |
| `5b1dfde` | **RED** Gruppe 7 — Staffelung an der Kontaktfläche |
| `bd338b7` | **GREEN** Gruppe 7 — Begründung an der Stelle des Knopfes |
| `8bbae86` | **fix** — kein Grund, solange `levelRank` null ist |

**Endstand:** `pnpm test` **2473/2473** · `supabase test db` über die **27**
CI-Dateien **1160/1160** · `lint`, `typecheck`, `build` Exit 0 ·
`openspec validate --all` 32/0.

### Was jetzt gilt

- **Verzeichnis** ab `connect`, erweiterte Felder ab `discover` (Teil A).
- **Filter** für Kompetenz, Thema, Angebotsart und die Chip-Gruppen erscheinen
  unterhalb Rang 3 **gar nicht**; an ihrer Stelle steht „Ab Discover kommen
  Filter für Kompetenz, Thema und Angebote dazu." Branche und Region bleiben.
- **Kontaktanfragen gestaffelt**: `basic` gar nicht · `connect` nur an genau
  `connect` · ab `discover` an alle. Prädikat
  `public.darf_kontaktanfrage_senden(uuid)`.
- **Welpenschutz ersatzlos weg**, `public.is_new_member(uuid)` gedroppt.

## Decisions

- **Gruppe 5 und 6 in ZWEI Migrationen, nicht einer.** *Warum:* die Staffelung
  gilt auch ohne das Streichen, und das Streichen ist eine eigene
  Produktentscheidung. Eine gemeinsame Migration hätte beide unlesbar gemacht.
- **Die Frontend-Kopie des Prädikats ist Absicht** (`darfKontaktanfrageSenden`
  in `lib/contact-requests.ts`). *Warum:* dieselbe Begründung wie bei den Rängen
  in `config/levels.ts` — die Grenze ist die Policy. Was die Kopie entscheidet,
  ist nur, ob ein Knopf ein Versprechen bricht.
- **Die Begründung steht an der Stelle des Knopfes, nicht in einem Toast.** Eine
  Hürde, die man erst nach dem Klicken erfährt, ist zweimal enttäuschend.
- **Zwei Sätze statt einem.** `basic` kann niemanden anschreiben, `connect` kann
  es schon, nur nicht dieses Profil. Eine gemeinsame Meldung beantwortete
  jeweils die falsche Frage.
- **Die 42501-Meldung nennt jetzt das Opt-out.** Sie nannte den Welpenschutz —
  eine abgeschaffte Regel zu erklären schickt den Leser auf einen Weg, den es
  nicht gibt.
- **Drei Bestandszusagen umgeschrieben, nicht gedreht:** `rls_test.sql:260`
  (Erweiterung), die zwei Welpenschutz-Zusagen (gestrichen), „Discover sieht,
  darf aber nicht anschreiben" und die 42501-Meldung in
  `PublicProfilePage.test.tsx`. `plan(437)` → `plan(435)`.
- **Aufgabe 7.3 ist gegenstandslos geworden** — es gibt keine
  Welpenschutz-Ablehnung mehr. In `tasks.md` ausgeschrieben, nicht abgehakt.

## Files modified

- **neu** `supabase/migrations/20260902180000_kontaktanfrage_staffelung.sql`
- **neu** `supabase/migrations/20260902190000_welpenschutz_entfernen.sql`
- **neu** `supabase/tests/kontaktanfrage_staffelung_test.sql` (32 Zusagen)
- **neu** `src/components/community/MemberDirectory.stufen.test.tsx`
- **neu** `src/pages/PublicProfilePage.staffelung.test.tsx` (6 Zusagen)
- `.github/workflows/ci.yml` — die neue pgTAP-Datei eingetragen
- `supabase/tests/rls_test.sql` — 437 → 435
- `src/components/community/MemberDirectory.tsx` + drei Testdateien
- `src/lib/contact-requests.ts`, `src/pages/PublicProfilePage.tsx` + Tests
- `openspec/changes/rechte-matrix-stufen/tasks.md`

## Next session: start here

**Gruppe 8 ist vollständig, der Diff-Review steht in `REVIEWS.md`.** `opencode`
hat **Freigabe** gegeben (drei NIEDRIG: einer reproduziert nicht, zwei sind
dokumentierte Entscheidungen aus dem Migrationskopf); `gemini` war unbrauchbar,
beide Belege erfunden — **nicht noch einmal aufrollen.**

**Erster Handgriff: Gruppe 9, das Ausrollen.** PR öffnen, CI grün abwarten,
mergen (9.1), dann `migrate-dev` auf demselben SHA (9.2). **9.3 `migrate-prod`
ausdrücklich bei Donald erfragen** — Schreibzugriff auf PROD. Und 9.6: **kein
Flag umlegen**, weder `open_contact` noch sonst etwas.

Der Worktree ist sauber, Basis `1872d1e`, letzter Code-Commit `8bbae86`
(darüber liegt nur noch dieser Doku-Commit), **nichts gepusht**.

### Rezept für die Sichtprobe, falls sie noch einmal gebraucht wird

Die Migrationen liegen **nur lokal**. `.env.local` mit
`VITE_SUPABASE_URL=http://127.0.0.1:54321` + ANON_KEY aus `supabase status`,
dann `pnpm exec vite --port 5210 --strictPort` (**nicht** `pnpm dev`), Konten per
GoTrue-Admin (`password` **und** `email_confirm: true`), danach `tier`/
`activated_at` per SQL. **Die App hängt über `localhost:5210`, nicht über
`127.0.0.1:5210`** — letzteres antwortet mit 000.

**Alles zurückgebaut:** `.env.local` gelöscht, vite gestoppt, die drei
QA-Konten per GoTrue-Admin entfernt, `open_contact` wieder auf `true`. Der
lokale Stack trägt jetzt **0 Profile und 0 Kontaktanfragen** — falls dort etwas
steht, ist es fremd.

## Open questions

- **Die Rechte-Erweiterung für Rang 3** ist jetzt **gebaut**, nicht nur geplant:
  ein `discover`-Konto darf im geschlossenen Modus an jeden senden. Donald hat
  die *Richtung* nie ausdrücklich bestätigt; sie folgt aus seiner Entscheidung
  vom 25.08. Vor dem Ausrollen ansprechen.
- **`branche` ist jetzt für JEDES aktivierte Konto lesbar**, auch für `basic`,
  das die Verzeichnisfläche gar nicht betritt — `profiles_public` ist
  RLS-umgehend und ohne Stufenschwelle. Das ist die Entscheidung aus D7 (ohne
  sie liefe der Branchenfilter für `connect` wortlos leer), aber es ist die
  einzige Stelle des Changes, an der Daten für eine niedrigere Stufe sichtbar
  werden. Von opencode im Diff-Review benannt. **Donald vorlegen.**
- **`open_contact` auf `false`** wartet weiter auf Donald. Gemessen folgenlos.
- **`EmojiAuswahl.test.tsx` flakt im Gesamtlauf** — einmal rot („rotes Herz"
  nicht gefunden), allein und im Wiederholungslauf grün. Gehört zu AGE-645.
- **Der Neuigkeiten-Eintrag `2026-09-02-feedback-ausbauen`** ist weiterhin nicht
  freigegeben.
- Unverändert offen — **High:** 610. **Medium:** 618 · 542 · 512 · 605 · 607 ·
  630 · 669 · 680 · 684 · 688. **Low:** 664 · 660 · 606.
