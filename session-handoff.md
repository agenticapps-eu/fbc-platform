# Session Handoff — 2026-09-09 (AGE-708 Kontolöschung: live, zwei Augenscheins-Punkte offen)

> ## ⚠ ZUERST — Scope dieser Übergabe
>
> **1. Sie beschreibt AGE-708** (Worktree
> `fbc-platform/donald-age-708-kontoloeschung`) und **ersetzt** die Fassung vom
> 08.09. (`4e4b7e0`), die auf die Kontolöschung als nächsten Auftrag zeigte.
> Die Datei ist für alle parallelen Sitzungen dieselbe und kollidiert bei jedem
> Rebase — **nicht zusammenführen**, überschreiben.
>
> **2. Details stehen NICHT hier**, sondern in
> `openspec/changes/kontoloeschung/` — `datenmatrix.md` ist das Abnahmedokument,
> `design.md` trägt die zehn Entscheidungen, `REVIEWS.md` die Resolution.

## Accomplished

**Die Kontolöschung ist gebaut, reviewt, ausgerollt und auf PROD
zurückgelesen.** 40 von 42 Aufgaben. Zwei PRs: **#373** (Code), **#374** (Doku
zum Ausrollen).

| Schicht | Was |
|---|---|
| **Datenbank** | Fremdschlüssel `profiles → auth.users` **entfernt** · `erased_at` als Riegel gegen `admin_restore_member` · `konto_anonymisieren` inkl. Schemawächter |
| **Server** | Edge Function `konto-loeschen`, einziger Eingang, `verify_jwt = true` |
| **Oberfläche** | Karte in den Einstellungen, zweistufige Rückfrage |

**Abnahme:** pgTAP 30/30 neu, CI-Liste 35 Dateien / ~1300 Zusagen · Deno 185 ·
vitest 2639/2639 · lint, typecheck, build je 0. Alle neuen Sicherheitszusagen
per Mutation gegengeprüft.

**PROD zurückgelesen** (09.09., Supabase-MCP, read-only): FK auf `auth.users`
**0** · `erased_at` da · Funktion + Schemawächter da · Restore-Riegel da ·
**0** Grants für anon/authenticated/PUBLIC · 35 FKs auf `profiles` unverändert ·
`konto-loeschen` ACTIVE v1 mit `verify_jwt: true`.

## Decisions

- **Zuschnitt: nur die Löschung** (Donald, 08.09.). AGE-260 steht auf *Backlog /
  nach Go-Live* und hängt an Detlev und dem Anwalt — daran soll die
  Store-Einreichung nicht hängen. Export, Einwilligung und Audit-Log bleiben dort.
- **Anonymisieren, Fremdsicht bleibt** (Donald, 08.09.). Fremde Gesprächsfäden
  zerreissen sonst. Kehrseite bewusst getragen: **Freitext anderer wird nicht
  umgeschrieben** (design.md D9) — eine Nachricht mit einer Telefonnummer und
  eine @-Erwähnung im Beitrag eines anderen bleiben stehen.
- **Apple-Restrisiko getragen** (Donald, 08.09.). codex hielt das Erhalten
  geteilter Inhalte für einen möglichen Ablehnungsgrund. Bewertet als schärfer
  als die Quellenlage; **in AGE-644 als Kommentar vermerkt**, samt der Antwort
  für den Fall der Ablehnung.
- **Branchname ohne Kürzel für Folge-PRs** — AGE-708 soll nicht verfrüht auf
  *Done* kippen. Hat funktioniert: der Vorgang steht korrekt auf *In Progress*.

## Files modified

Alles gemergt (`49b2121`), Arbeitsbaum sauber, lokal auf `origin/main`.

- `supabase/migrations/20260908180000|181000|182000_kontoloeschung_*.sql` *(neu)*
- `supabase/functions/konto-loeschen/{index,loeschen,loeschen.test}.ts` *(neu)*
- `supabase/tests/kontoloeschung_test.sql` *(neu, 30 Zusagen)* · `rls_test.sql`
  (Block 22.20 umgeschrieben, plan 440→441)
- `src/lib/konto-loeschen.ts` *(neu)* · `src/pages/EinstellungenPage.tsx` +
  `.test.tsx` · `src/components/community/CommunityFeed.test.tsx`
- `supabase/config.toml` · `scripts/functions-config.test.ts` · `.github/workflows/ci.yml`
- `openspec/changes/kontoloeschung/*` inkl. `datenmatrix.md`

## Next session: start here

**Nur noch zwei Augenscheins-Punkte, keine Bauarbeit.** Der Weg ist live und für
ein Mitglied erreichbar.

- **4.5 Sichtprobe** der Einstellungskarte in hell und navy.
- **6.4 Gerätetest** iOS und Android. Achtung: an diesem Mac immer nur **ein**
  Gerät, und eine Installation über `devicectl`/`adb` erreicht die Weboberfläche
  nicht, solange ein OTA-Bündel liegt.

Danach `openspec archive kontoloeschung` (Schritt 6 des Workflows) und AGE-708
auf Done. **Vorher nicht archivieren** — der Change ist erst mit dem Augenschein
fertig.

> ⚠ **Beim Testen der Löschung NIE ein echtes Konto nehmen.** Sie ist
> unwiderruflich, `admin_restore_member` verweigert sie ausdrücklich, und PROD
> trägt echte Mitgliederdaten. Nachweise gehören gegen den lokalen Stack mit
> eigens angelegtem Konto.

> ⚠ **Der lokale Stack ist repariert, aber der Grund merkenswert:** Ich hatte die
> drei Migrationen per `psql -f` eingespielt, die Historie kannte sie nicht —
> Schema voraus, Historie hinterher. Per `supabase migration repair --status
> applied … --local` nachgetragen, `migration up` läuft jetzt sauber durch. Wer
> lokal eine Migration von Hand einspielt, trägt sie auch nach.

> ⚠ **`donald/age-708-kontoloeschung` auf `origin` ist der Vor-Merge-Stand**
> (lokal `behind`), der Inhalt liegt gesquasht in `main`. Der Branch kann weg.

## Open questions

- **Die Sichtprobe braucht ein angemeldetes Konto.** Das Rezept biegt über
  `.env.local` später `pnpm dev` um — vor dem Loslegen entscheiden, ob gegen den
  lokalen Stack oder gegen die Live-Seite geprüft wird.
- **`event-covers` bleibt bei der Löschung stehen** (Titelbild gehört zur
  Veranstaltung). Vorschlag steht in `datenmatrix.md` §5, von Donald nicht
  ausdrücklich bestätigt.
- **Laufende Stripe-Abos** beendet die Kontolöschung nicht. Ausserhalb dieses
  Changes, aber real — `profile_legacy.paid_until` trägt ohnehin kein Downgrade.
- **AGE-260** bleibt offen und ist jetzt kleiner: dessen Aufgaben 2.1, 2.3, 3.1
  und 5.4 sowie das Requirement *„Erasure respects retention duties…"* sind hier
  abgedeckt und dürfen dort nicht ein zweites Mal eingeführt werden.
