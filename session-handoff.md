# Session Handoff — 2026-08-28 (später Abend, fünf kleine Vorgänge)

> ## ⚠ ZUERST LESEN: `main` deployt seit 17:40 nicht mehr
>
> **Nicht meine Arbeit, nicht selbst reparieren.** DEV trägt die Migration
> **`20260828200000`**, das Repo kennt sie nicht — weder auf `origin/main` noch
> auf `origin/donald/age-642-capacitor-huelle`. `migrate-dev` fällt, und
> `drift-gate`, `deploy`, `functions` werden **alle übersprungen**:
> `Remote migration versions not found in local migrations directory.`
>
> Deploy-Läufe auf `main`: 17:20 `116d3db` (AGE-600) **success** ← letzter
> grüner · 17:40 `587964a` (AGE-599) failure · 17:48 `aa8eb5e` (Übergabe)
> failure, beide an derselben Version.
>
> **Praktisch heißt das:** die Frontend-Änderung aus AGE-600 ist um 17:20 **live
> gegangen**. Ausstehend sind nur AGE-599 (nur Seed-Skripte, für Nutzer
> unsichtbar) und die Übergabe (nur Doku). Der Rückstand ist klein — rot bleibt
> der Lauf trotzdem.
>
> **Erste Aktion:** prüfen, ob `20260828200000` inzwischen auf `main` liegt
> (`git ls-tree origin/main supabase/migrations/`). Wenn ja: `gh run rerun
> --failed` auf dem jüngsten Deploy. Wenn nein: **nicht** selbst reparieren
> (`dev-db-ist-geteilt-blockt-jeden-deploy`). `fbc-platform-b7` ist am 28.08.
> um 17:52 per `SendMessage` informiert — mit Lauf-ID, Version und beiden Wegen
> (pushen bzw. `migration repair --status reverted`). **PROD ist nicht
> betroffen.**

**Sitzung:** `fbc-platform-f4`, Worktree `fbc-platform.neuigkeiten-archiv` (der
Name gehört zu einem längst archivierten Change). Parallel lief
`fbc-platform-b7` an **AGE-642** (PR #277): **mobil dort, alles andere hier**,
ohne Berührung mit deren Dateien. **PROD wurde migriert**, von Donald
ausdrücklich freigegeben.

## Accomplished

| PR | Vorgang | Stand |
| --- | --- | --- |
| #278 | **AGE-657** — Seitenindex auf `messages` | gemergt, auf PROD angewendet und nachgelesen |
| #279 + #281 | **AGE-659** (neu angelegt) — pgTAP-Dateiliste bewacht | gemergt |
| #280 | **AGE-600** — Zuschnitt-Vorschauen passen ein | gemergt |
| #282 | **AGE-599** — Demo-Seed schneidet Titelbilder zu | gemergt, Abnahme offen (siehe unten) |

Jeder PR mit zwei fremden Diff-Reviewern — bei dreien davon zu Unrecht, siehe
„Was schiefging".

**AGE-657 wurde gemessen, nicht begründet** — das Repo trägt ein Gegenbeispiel,
in dem derselbe Ansatz gefordert und vom Planer nie gewählt wurde
(`20260826170000_…:69-83`). Also derselbe Aufbau: 20 000 Nachrichten lokal, als
`authenticated` **mit Claims**, unter voller RLS. Erste Seite vorher Seq Scan +
Sort, 20 512 Puffer, 66,2 ms → nachher Index Scan **ohne Sort**, 295 Puffer,
0,96 ms; Cursor-Seite 15 267 → 426 Puffer.

**AGE-600 wurde im Browser gemessen**, nicht nur im Test: 4:3-Prüfbild auf dem
lokalen Chat-Testkonto, beide Zustände auf **derselben Seite**. Vorher Feld
646 × 112 = **5,77:1** mit `object-cover`, davon fielen **77,2 % der Bildhöhe**
heraus; nachher 646 × 215 = **3,00:1** mit `object-contain`, 0 %. Gegenprobe:
der Profilkopf malt 568 × 426, die Vorschau 284 × 213 — derselbe Ausschnitt.

## Decisions

- **`concurrently` bleibt in der Migration.** Der Einwand aus dem Issue
  („bricht `migrate-prod`") ist **gemessen falsch**: `db push` (CLI 2.111.0)
  fasst eine Migration in eine Transaktion, **nur nicht eine mit CONCURRENTLY**
  (zwei Gegenproben). Preis: diese Datei ist nicht atomar — deshalb steht genau
  **eine** Anweisung darin.
- **`messages_thread_id_idx` bleibt vorerst** (jetzt **AGE-660**). Echtes
  Präfix, also redundant — aber ein `drop` in derselben transaktionslosen Datei
  könnte halb angewendet stehenbleiben, und bei 23 Zeilen ist nichts zu gewinnen.
- **Der pgTAP-Wächter bricht an einem Kommentar ab, statt ihn zu überspringen.**
  Eine zu kurze Liste macht den Vergleich rot, eine zu lange löge grün.
- **AGE-599 fasst ZWEI Aufrufstellen an**, obwohl das Issue nur eine nennt —
  nur eine zu reparieren hätte den Befund halb behoben und ganz für erledigt
  erklärt.
- **AGE-658 nicht angefasst** (liegt in PR #277 bei b7 und ist dort erledigt);
  **AGE-640 gehört zu cPARX**, nicht hierher.

## Was schiefging

**#279 wurde gemergt, bevor seine Diff-Review zurück war.** Beide Reviewer
fanden danach zwei **falsche Datumsangaben** in meinen eigenen Kommentaren
(`display_name_test.sql` liegt seit dem 26.08. im Repo, nicht 27.08.; die
`ci.yml`-Warnung seit dem **05.08.**, nicht 24.08.). Korrigiert in #281, samt
Linear-Titel — und die richtigen Zahlen schärfen die Pointe: beide Vorfälle
traten *nach* der Warnung ein, nach 18 bzw. 23 Tagen. **Bei AGE-600 dieselbe
Sorte:** „50 % der Breite" war falsch, es ist die Höhe. Beide Male eine Zahl,
die ich abgeschrieben statt gerechnet habe.

**Und drei der vier Diff-Reviews hätten gar nicht laufen sollen.** Donald hat am
26.08. entschieden: Fremdreviewer **nur bei Schema, Rechten oder Sicherheit** —
reines UI und Textarbeit gehen direkt durch (`reviewer-nur-bei-migration-und-rls`).
AGE-657 war richtig; AGE-600, AGE-659 und AGE-599 nicht. Grund: **die Memory
stand in keiner Zeile des Index**, und der Index war über seiner Lesegrenze,
sein Ende also ohnehin unsichtbar. Beides behoben; die Regel steht jetzt in
Zeile 1. TDD, Gegenproben und die Browser-Sichtprobe bleiben — die hat er
ausdrücklich nicht gestrichen.

## Files modified

- `supabase/migrations/20260828180000_messages_seitenindex.sql` — **neu**, eine
  Anweisung, Kopf mit Messung, Grenze und Rückweg für den invaliden Index
- `scripts/pgtap-dateiliste.test.ts` (**neu**) + `.github/workflows/ci.yml`
- `src/pages/ProfilPage.tsx` + `ProfilPage.cover.test.tsx` (**neu**);
  `src/components/events/EventCoverPicker.tsx` + `.test.tsx` (**neu**)
- `supabase/seed/event_cover_zuschnitt.ts` + `.test.ts` (**neu**),
  `import_world_seed.ts`, `demo_event_covers.ts`

## Next session: start here

**Alle fünf PRs sind gemergt.** Nachzuholen ist am Code nichts.

**Erste Aktion steht im Kasten ganz oben** — der Deploy auf `main` ist durch
eine fremde DEV-Migration blockiert.

**Danach eine Entscheidung, die nur Donald treffen kann** — die Abnahme von
AGE-599, und sie hat **zwei** Schritte, nicht einen:

1. **Die acht bestehenden Objekte in `event-covers` auf DEV löschen.** Ein
   Seed-Lauf allein ersetzt sie nicht: beide Upload-Stellen schicken
   `x-upsert: false`, und das ist Absicht mit gemessener Begründung
   (`demo_event_covers.ts:92-96` — in privaten Buckets scheitert ein Upsert an
   der SELECT-Policy). Ein zweiter Lauf meldet „vorhanden" und lässt das alte
   Bild liegen; die Pfade ändert der PR nicht.
2. **Dann den Seed laufen lassen und messen** (3,00:1 ± 0,01 für alle acht,
   danach `/events` im Browser).

Beides schreibt in eine geteilte Umgebung und wurde deshalb **nicht**
ausgeführt. Der Zuschnitt selbst ist lokal an den echten Dateien gemessen.
`x-upsert` wurde bewusst nicht umgestellt — die Einstellung gilt für jeden
Seed-Upload, nicht nur für Titelbilder.

**PROD ist sauber:** `migrate-prod` (Lauf `33192980642`) lief mit `plan` und
`apply` grün, `messages_thread_created_id_idx` steht dort mit
`indisvalid = true`. Der Deploy auf `main` war danach zweimal vollständig grün
(17:01 und 17:20) — **erst der Lauf um 17:40 fiel**, und zwar an der fremden
DEV-Migration, nicht an einer dieser Änderungen. Siehe den Kasten oben.

**Diese Sitzung hat selbst eine Spec-Drift erzeugt: AGE-665.**
`design-system/spec.md` ab Zeile 856 nennt die Zuschnitt-Vorschauen
„ausdrücklich nicht erfasst" (AGE-600 hat sie nachgezogen) und den Demo-Seed
„die benannte Ausnahme, nachzuziehen ist der Seed" (AGE-599 tut genau das). Der
Code verletzt nichts, die Anforderung beschreibt die Welt nur nicht mehr;
`validate` sieht das nicht. **Nicht von Hand am durable-truth-Text vorbei
reparieren.**

Danach sind die nächsten kleinen Vorgänge **AGE-664** (die letzte
Event-Titelbild-Fläche, die noch beschneidet), **AGE-660** und **AGE-618**.

## Open questions

- **AGE-658 ist erledigt, nicht offen** — gebaut in PR #277 („nur nativ zähmen,
  Web unverändert"). Steht hier, weil ich beim Sichten das Gegenteil annahm.
- **Die Event-Vorschau aus AGE-600 wurde nicht im Browser nachgemessen** — sie
  braucht ein Event mit Titelbild und eine Rolle, die es bearbeiten darf.
- **AGE-664 kippt eine ausgesprochene Entscheidung** (AGE-596 hat Feed,
  Vorschauen und Verzeichnis-Karte ausgeschlossen, `REVIEWS.md:82`). Zwei der
  drei Ausnahmen sind eingeholt; ob die dritte fällt, ist eine Entscheidung.
- Unverändert offen: AGE-610 · AGE-512 · Aktivierungsversand 69/72 · Rotation
  des PROD-DB-Passworts · AGE-598 · AGE-256 · AGE-606 · AGE-628/629/630.

## Was diese Sitzung über das Verfahren gelernt hat

**Drei neue Memories** — `db-push-transaktion-und-concurrently`,
`linear-team-spannt-mehrere-repos`, plus ein Abschnitt in
`reviewer-cli-timeouts` (gemini erfindet Belege, opencode misst). **Und der
Index selbst war das Problem:** 30,4 KB bei 24,4 KB Lesegrenze, sein Ende also
unsichtbar. Neu geschrieben auf 15,7 KB, alle 140 Einträge behalten.

**Eine Zahl aus einem Issue ist keine Messung** — zweimal übernommen, zweimal
falsch, und beide Male stand die richtige Rechnung zwei Absätze weiter im
eigenen Text. **Und eine Gegenprobe, die nur EINE falsche Lage ausschliesst,
sieht genauso grün aus wie eine, die alle ausschliesst** (mein Zuschnitt-Test
prüfte nur das erste Pixel; „von unten" wäre dort auch grün gewesen).
