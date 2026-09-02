# Session Handoff — 2026-09-02 (AGE-598: Teil A steht, Teil B ist offen)

> ## ⚠ ZUERST — drei Dinge
>
> **1. Diese Datei ist geteilt und trägt jeweils EINEN Vorgang.** Sie steht auf
> AGE-598. Die AGE-642-Fassung ist nicht verloren
> (`git show origin/main:session-handoff.md`). **Nicht zusammenführen.**
>
> **2. AGE-642 läuft PARALLEL** (Worktree `fbc-platform.donald-age-642-capacitor-huelle`).
> **Nicht anfassen.** Der lokale Supabase-Stack ist mit dieser Sitzung geteilt —
> Donald hat den `db reset` heute freigegeben, die dortigen lokalen Daten sind weg.
>
> **3. Teil A ist fertig, Teil B noch nicht angefangen.** Gruppen 1, 2, 3, 3b und
> 3c sind abgehakt und belegt; ab Gruppe 4 ist nichts geschehen.

## Accomplished

Fünf Aufgabengruppen, vier Commits, alles am laufenden Schema gemessen.

| Commit | Was |
|---|---|
| `1184114` | **Grundlinie** (2.1): `rls_test` 437, `directory_search_test` 24. Plus 1.1–1.3 abgehakt |
| `3abc1d8` | **`cso` über den Delta** (1.4): vier Befunde, alle eingearbeitet |
| `004a3ca` | **Positivkontrollen** (2.2/2.3), gesondiert |
| `3a81655` | **RED** für die Verzeichnisliste (3.1–3.3) |
| `1923aaa` | **GREEN**: Migration `20260902150000_verzeichnis_ab_connect.sql` (3.4–3.8, 3b, 3c) |

**Endstand der Läufe:** `rls_test` **437/437 unverändert** · `directory_search_test`
35/35 · `grants_test` 15/15 · vitest **2463/2463** · `typecheck` und `lint` Exit 0.

Die 437 sind der eigentliche Beleg: die neue Rang-2-Schwelle hat die alte
Rang-3-Grenze **nicht** mitgenommen. Genau dafür war Aufgabe 2.1 da.

### Fünf Befunde am Plan, alle am Code gemessen

1. **Die Rang-2-Schwelle ist keine Datengrenze.** `profiles_public` liefert einem
   `basic`-Konto dieselben Basisfelder ohne jede Stufenprüfung. 3.3 las sich als
   Zusicherung über Daten und trägt nur eine über die RPC. In D1 ausgeschrieben.
2. **Aufgabe 5.6 wies auf die falsche Reparatur.** grants_test §6 bricht bei einer
   neuen Funktion nur, wenn der `revoke` fehlt — die Liste nachzuziehen erteilte
   `anon` EXECUTE auf ein `security definer`-Prädikat. Umformuliert.
3. **Die Staffelung ERWEITERT Rang-3-Rechte.** Klausel 320 lautet heute
   `has_level(4)`; `rls_test.sql:260` sagt zu, dass `discover` im geschlossenen
   Modus **nicht** senden darf. Das kippt. 6.5 suchte nur Welpenschutz-Zusagen.
4. **`branche` muss in `profiles_public` ans Ende** — `create or replace view`
   erlaubt nur angehängte Spalten.
5. **`HeaderSearch.tsx` braucht den Selbst-Zweig** (AGE-540, Punkt 2 im Kopf). Ein
   blosses `has_level(2)` als Eintrittstor gäbe null Zeilen, und ein `basic`-Konto
   fände in der Kopfzeilen-Suche nicht einmal mehr sich selbst — **still**.

## Decisions

- **Eine Migration für 3.4 + 3b.4 + 3c.2, nicht drei.** *Warum:* ohne 3b wäre die
  Maskierung Kulisse, ohne 3c fiele `branche` still auf NULL. Drei Migrationen
  ergäben zwei Zwischenzustände, die niemand haben will und die trotzdem in der
  Historie stünden.
- **Die Maskierung nutzt die RLS-Asymmetrie statt einer Rangzahl.** `left join`
  über `profiles_public` (umgeht RLS) und `public.profiles` (Rang 3); unterhalb
  Rang 3 kommt rechts NULL an, `coalesce` macht das leere Array daraus. Deshalb
  steht im Rumpf **keine `3`** — am Katalog geprüft, nicht an der Datei.
- **Der Volltext genauso:** `coalesce(p.search_doc, <Basis-Vektor>) @@ …`. Kein
  `case`, kein `has_level(3)`.
- **Der Basis-Vektor ist `name, company, branche, short_bio, roles`** — nicht die
  Liste aus D6. *Warum:* er **muss eine Teilmenge von `search_doc` sein**. `roles`
  kommt dazu (sichtbar und in `search_doc`), `region` fällt weg (in
  `profiles_public`, aber nicht in `search_doc` — sonst könnte `connect` nach der
  Region suchen und `discover` nicht). Als Zusage 36 festgehalten.
- **Inline statt generierter Spalte mit GIN-Index.** *Warum:* bei 74 Profilen
  folgenlos; ab Rang 3 läuft weiterhin der indizierte Weg. Die Schwelle ist das
  Paging, wie `src/lib/directory.ts` es für die Kontaktliste benennt.
- **Zusage 26 ist entfernt, nicht umgeschrieben.** Sie sagte den Ist-Zustand zu und
  ist mit der Migration rot geworden — genau dafür war sie da. Nachfolge ist 27;
  beide zu behalten hiesse, dieselbe Frage zweimal zu stellen.
- **Die CLAUDE.md-Routing-Ergänzung, die `cso` anbietet, ist ausgelassen.** Ein
  eingechecktes CLAUDE.md nebenbei umzuschreiben gehört nicht in diesen Change.

## Files modified

- **neu** `supabase/migrations/20260902150000_verzeichnis_ab_connect.sql`
- `supabase/tests/directory_search_test.sql` — 24 → 35 Zusagen, zwei neue Fixtures
  (Frida = `discover`, Gero = `connect`)
- `src/config/nav.ts` — `minTier: "connect"` · `src/config/nav.test.ts`
- `src/components/MembershipGate.test.tsx` — drei Zusagen nachgezogen, eine neu
- `src/lib/database.types.ts` — `branche` auf `profiles_public` (handgepflegt!)
- `openspec/changes/rechte-matrix-stufen/{tasks,design}.md`
- `.gstack/security-reports/2026-09-02-170000.json` (nicht eingecheckt)
- Zwei Erinnerungen erweitert: `grants-test-golden-snapshot-trap`,
  `lokaler-stack-ist-geteilt`

## Next session: start here

**Erster Handgriff: Gruppe 4** aus `openspec/changes/rechte-matrix-stufen/tasks.md`
— die Frontend-Tests 4.1–4.3 (RED), dann 4.4. Entschieden ist es schon (D5): die
Filter für Kompetenz, Biete-/Suche-Kategorien, Thema und Angebotsart werden für
`connect` **ausgeblendet**, nicht leer gelassen, und an ihrer Stelle steht ein
Hinweis, ab welcher Stufe es sie gibt. Der Branchenfilter bleibt sichtbar — er
läuft seit dieser Migration auf einem Basisfeld.

Danach Gruppe 5 (Prädikat `darf_kontaktanfrage_senden`), 6 (Welpenschutz raus),
7 (Oberfläche). **Bei 6.5 die drei namentlich genannten `rls_test`-Fundstellen
abarbeiten** — 260 kippt, 268 fällt, 272 bleibt grün aus dem falschen Grund.

Der Worktree ist sauber, `node_modules` ist installiert, der lokale Stack trägt
alle 121 Migrationen. Basis `1872d1e`, HEAD `1923aaa`, nichts gepusht.

## Open questions

- **`open_contact` auf `false`** wartet weiter auf Donald — nach dem Ausrollen,
  am besten **vor** dem Öffnen der Selbstregistrierung. Gemessen folgenlos.
- **Die Rechte-Erweiterung für Rang 3** (Befund 3) ist in D2 ausgeschrieben, aber
  Donald hat sie in dieser Form noch nicht bestätigt. Sie folgt aus seiner
  Entscheidung vom 25.08.; die **Richtung** (discover darf mehr als heute) stand
  dort nicht ausdrücklich dabei.
- **AGE-688** (`sm`-Doppelmodal) liegt unangefasst im Backlog.
- **Der Neuigkeiten-Eintrag `2026-09-02-feedback-ausbauen`** ist weiterhin nicht
  freigegeben.
- Unverändert offen — **High:** 610. **Medium:** 618 · 542 · 512 · 605 · 607 ·
  630 · 669 · 680 · 684 · 688. **Low:** 664 · 660 · 606.
