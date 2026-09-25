---
reviewers: [gemini, codex]
models: [gemini-cli-0.28.2-standardmodell, gpt-6-sol]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: c779ab7208f08a9183c148fe35e5992e35dadaef51df3d546992162ddc6aa87d
---

# Change review — release-backfill

Zwei Reviewer, zwei Hersteller, keiner davon der eigene (Claude ist
ausgeschlossen, Regel 2 des Skills). Beide haben `REQUEST-CHANGES` gegeben.
Der Prompt trug neben den vier Artefakten einen Kontextkopf mit den
Funktionsrümpfen, dem Auslöser, den Policies und den PROD-Messwerten vom
25.09. — sonst hätte kein Reviewer beurteilen können, ob die Zusagen tragen.

Beim Modell: `codex` nennt sein Modell selbst (`gpt-6-sol`), `gemini` nicht —
die CLI ist 0.28.2 ohne festgelegtes Modell in `~/.gemini/settings.json`, also
ihr Standardmodell. Das ist ehrlicher als eine erfundene Modellkennung, aber
schwächer als das, was Regel 4 verlangt; bei einem künftigen Lauf gehört das
Modell fixiert.

## Reviewer: gemini

Modell: gemini-cli 0.28.2, Standardmodell (nicht festgelegt). Die Überschrift
bleibt blank — das Gate zählt eine Stimme nur bei `## Reviewer: <hersteller>`
ohne Zusatz, und ein Modellname in Klammern macht den Hersteller unbekannt.

VERDICT: REQUEST-CHANGES

- [HIGH] `notifications` — Ein einziger Filter in `beitrag_ankuendigen()`
  verhindert 598 Hinweise. Der Plan sichert das mit einem Test ab, aber ein
  Test prüft Verhalten und behebt keine Zerbrechlichkeit. `angekuendigt_am IS
  NULL` an einem veröffentlichten Beitrag heisst „noch anzukündigen" — der
  Zustand ist mehrdeutig. — `release_feed_post_sync()` soll
  `angekuendigt_am` beim Insert setzen.
- [MEDIUM] `posts` — Eine Migration ohne auflösbaren Autor erzeugte 23 Notes
  und null Beiträge, still. — Bestätigen, dass `raise exception` benutzt wird
  und die Transaktion wirklich zurückrollt.
- [LOW] `release_notes` — Hätte ein Admin einen Entwurf zu einer der 23
  Geschichten angelegt, **ohne** `entry_slugs` zu füllen, erzeugte die
  Migration eine Dublette. — Zusätzlich über `title` prüfen.

## Reviewer: codex

Modell: gpt-6-sol (von der CLI selbst gemeldet).

VERDICT: REQUEST-CHANGES

- [HIGH] `proposal.md` / Wirkung auf `/neues` — Die Behauptung „die 23
  erscheinen dort" ist falsch: `fetchZugestellte()` lädt 20, die Seite hat
  kein Nachladen. Drei Notes sind dort sofort unerreichbar. — Paging
  nachziehen oder den Anspruch zurücknehmen.
- [HIGH] `tasks.md` 3.7 / `design.md` 5 — Das `update` greift **jeden**
  Entwurf mit passendem Slug. Auf DEV oder lokal stellte es damit einen
  fremden Admin-Entwurf zu und widerspräche der eigenen Zusage „ändert
  nichts Vorhandenes". Der partielle Index auf `posts.release_note_id`
  verhindert zwei Notes zu einem Slug nicht. — Nur die von dieser Migration
  eingefügten IDs aktualisieren; laut scheitern, wenn ein Slug schon einem
  fremden Entwurf gehört.
- [HIGH] `tasks.md` 7–9 — Archivieren und `release:entries` stehen **nach**
  Merge und PROD-Deploy; die Artefakte fehlen damit im geprüften PR, und es
  widerspricht der Hausregel „archivieren vor oder mit `wt merge`, nie
  danach". — Vor dem Merge archivieren, erzeugen, validieren, committen;
  PROD danach.
- [MEDIUM] `design.md` 4 — Der Plan nennt die Ausgabe-Daten die Tage, an
  denen Geschichten „vorgestellt wurden", während `release-ausgaben.ts`
  ausdrücklich sagt, sie seien gesetzt und nicht gemessen. Das
  zurückdatierte `sent_at` erscheint auf `/neues` als Zustelldatum. —
  Ausdrücklich als redaktionelles Ausgabedatum benennen und bestätigen.
- [MEDIUM] `tasks.md` 8.2 — Absolute Zielzahlen (308 / 0 / 40) setzen
  voraus, dass zwischen Messung und Deploy nichts Fremdes geschrieben wird.
  Ein legitimer neuer Beitrag liesse die Abnahme scheitern; gegenläufige
  Schreibvorgänge verdeckten eine Regression. — Unmittelbar vor und nach dem
  Deploy messen und die **Differenz** prüfen.
- [MEDIUM] `community-feed` MODIFIED — Der Text sagt, `author_id` trage „den
  Admin, der zugestellt hat"; die Migration wählt die kleinste Admin-ID, und
  diese Person hat nichts zugestellt. — Für den Nachtrag als
  System-Zuschreibung definieren.
- [LOW] `proposal.md` Why — Verloren geht die einzige **öffentliche** Fläche;
  ein Feed nur für Mitglieder ersetzt öffentliche Verfügbarkeit nicht. —
  Ausdrücklich sagen, dass öffentlicher Zugang entfällt.

## Not counted

Keiner. Beide Aufrufe endeten mit Exit 0 und lieferten eine Bewertung.
`claude` wurde nicht gerufen — eigener Hersteller, Regel 2.

## Resolution

### gemini [HIGH] `angekuendigt_am` — teilweise übernommen

Der Befund ist richtig, die vorgeschlagene Stelle nicht. `angekuendigt_am` im
**Auslöser** zu setzen änderte das Verhalten jeder künftigen echten
Zustellung, nicht nur des Nachtrags — das ist ein Eingriff in AGE-718 und
bräuchte ein eigenes Delta auf eine Anforderung, die dieser Change gar nicht
anfasst. Ein Nachtrag, der im Vorbeigehen einen geteilten Auslöser umbaut, ist
genau die Art Diff, die niemand mehr sauber zurücknehmen kann.

Übernommen wird die Härtung dort, wo sie hingehört: **die Migration stempelt
`angekuendigt_am` auf genau den 23 Zeilen, die sie erzeugt.** Damit stehen
unsere Daten auf zwei unabhängigen Beinen — dem `kind = 'member'`-Filter und
einem nicht-NULL-Stempel —, ohne fremdes Verhalten zu verschieben. Die
pgTAP-Zusage bleibt, denn sie prüft die Wirkung und nicht den Wortlaut.

Die Zerbrechlichkeit des Auslösers für **künftige** Zustellungen bleibt damit
bestehen und wird als Folgepunkt notiert, nicht stillschweigend übergangen.
Sie ist heute folgenlos, weil `beitrag_ankuendigen()` nach `kind` filtert.

### gemini [MEDIUM] Autor — übernommen, war bereits der Plan

Aufgabe 3.5 sagt „laut abbrechen"; das wird zu `raise exception` präzisiert.
Die Migrationsdatei läuft in einer Transaktion, der Abbruch rollt sie
vollständig zurück.

### gemini [LOW] Zusätzlich über `title` prüfen — abgelehnt

Ein zweiter, schwächerer Schlüssel neben `entry_slugs` schafft ein neues
Problem, statt eines zu lösen: ein Admin-Entwurf, der zufällig denselben Titel
trägt, liesse die Migration eine Geschichte **stillschweigend überspringen** —
und ein übersprungener Nachtrag sieht von einem erfolgreichen nicht anders aus.
Der Fall, den gemini meint (Entwurf ohne `entry_slugs`), wird durch die
Auflösung zu codex' zweitem HIGH ohnehin erfasst: die Migration aktualisiert
nur ihre eigenen Zeilen und lässt fremde Entwürfe unberührt.

### codex [HIGH] `/neues` — übernommen, Umfang erweitert

Am Code nachgeprüft und **schlimmer als gemeldet**: `NeuesPage` ruft
`fetchZugestellte()` ohne Argumente (also `limit = 20, offset = 0`), hat kein
Nachladen, **und** löst `?note=<id>` allein aus der geladenen Liste auf
(`(notes.data ?? []).find(...)`). Die drei ältesten Notes wären damit nicht nur
unsichtbar — ihre Feed-Karte trüge einen Knopf „Alle Neuerungen", der nichts
öffnet. Drei tote Knöpfe, erzeugt von diesem Change.

**Donald hat am 25.09. entschieden: Paging nachziehen.** `/neues` bekommt ein
Nachladen, und die Auflösung von `?note=` holt eine noch nicht geladene Note
einzeln nach. Das ist Frontend-Arbeit, die AGE-905 nicht genannt hat, und sie
kommt mit einem Delta auf `notifications` (dort ist die Fläche spezifiziert).
Die Behauptung im Proposal wird zugleich korrigiert.

### codex [HIGH] Das `update` könnte einen fremden Entwurf zustellen — übernommen

Der schwerste Befund des Laufs, und er trifft. Der Wächter vor dem Insert
(`not exists … entry_slugs @> array[slug]`) überspringt einen vorhandenen
Entwurf — und die nächste Anweisung hätte ihn dann auf `sent` gesetzt und
seinen unfertigen Text als Karte veröffentlicht. Auf PROD gibt es heute 0
Entwürfe; auf DEV und lokal ist das nichts, worauf man sich verlässt.

Aufgelöst mit einer Unterscheidung, die beide Fälle richtig behandelt:

- Gehört ein Slug bereits einer **zugestellten** Note, ist das der
  Wiederholungsfall — überspringen, schweigend, das ist die Idempotenz.
- Gehört er einem **Entwurf**, den diese Migration nicht angelegt hat, ist die
  Lage mehrdeutig — `raise exception`, nicht raten.
- Das `update` greift nur die IDs, die der Insert selbst
  zurückgegeben hat (`returning`), nicht eine Slug-Menge.

### codex [HIGH] Archivieren vor dem Merge — übernommen

Richtig, und es widerspricht der Hausregel, die ich selbst zitiert habe.
`tasks.md` wird umgestellt: archivieren, `pnpm release:entries`, validieren und
committen gehören **in den PR**; die PROD-Migration bleibt danach, weil sie vom
Feature-Branch nicht geht.

### codex [MEDIUM] Redaktionelle Daten — übernommen als ausgesprochene Entscheidung

Nachgeprüft: `/neues` zeigt `formatDatum(n.sent_at)`, das zurückdatierte Datum
steht dort also als Datum der Mitteilung. **Donald hat am 25.09. bestätigt:
das Ausgabe-Datum gilt als Veröffentlichungsdatum, auch dort.** Der
Migrationskopf und `design.md` nennen die Daten künftig ausdrücklich
*redaktionelle Ausgabedaten* und halten fest, dass sie an zwei Flächen als
Tatsache erscheinen.

### codex [MEDIUM] Absolute Abnahmezahlen — übernommen

Aufgabe 8.2 wird auf Differenzen umgestellt: unmittelbar vor und nach dem
Deploy messen, und geprüft wird `Δ notifications = 0`, `Δ push_zustellungen =
0` sowie genau 23 neue Zeilen mit `kind = 'release'`, an ihren Slugs
identifiziert. Absolute Zahlen bleiben als Beleg im Protokoll, nicht als
Bedingung.

### codex [MEDIUM] `author_id`-Wortlaut — übernommen

Die MODIFIED-Anforderung sagt künftig, `author_id` trage den Admin, der
zugestellt hat, **oder** — bei einem Nachtrag — eine System-Zuschreibung auf
ein Admin-Profil, das nichts zugestellt hat. Die Oberfläche zeigt ohnehin
`eff.bee.zee` und keinen Namen; das steht als gemessene Begründung daneben.

### codex [LOW] „öffentlich" — übernommen

Ein Satz im Proposal: die Geschichten verlieren ihre einzige **öffentliche**
Fläche, und der Nachtrag stellt sie für **aktivierte Mitglieder** wieder her.
Das ist keine Wiederherstellung öffentlicher Verfügbarkeit.

## Folgepunkte (nicht in diesem Change)

- `release_feed_post_sync()` setzt `angekuendigt_am` nicht. Für die 23
  nachgetragenen Zeilen behebt die Migration das; für jede künftige echte
  Zustellung bleibt der Zustand an einem einzigen Filter hängen.
- Die Release-Karte kürzt ihren Text nicht (`whitespace-pre-line`, kein „mehr
  anzeigen"). Bei 23 Karten zu 480–1279 Zeichen wird die Aktivität lang.

## Nachtrag nach der Review — was die Reviewer NICHT gesehen haben

Der `digest` im Trailer deckt den **heutigen** Stand von `proposal.md`,
`design.md` und `specs/**`, nicht den, der gemini und codex vorlag. Der
Unterschied gehört benannt, sonst behauptete die Prüfsumme eine Review, die es
zu diesem Text nicht gab. Nach den beiden Bewertungen kam **ein** Punkt dazu,
aus einer anderen Quelle:

**Beim Bauen korrigiert: der Autor-Wächter hätte `main` rot gemacht.** Die
Fassung, die beide Reviewer sahen, brach bei jedem fehlenden Admin ab — gemini
hatte das als MEDIUM sogar ausdrücklich bestätigt („MUSS `raise exception`
benutzen"). Beide haben dabei übersehen, was erst der erste Lauf zeigte: der
CI-Job `migrations` fährt `supabase db reset` gegen eine **frische** Datenbank
ohne `seed.sql`, dort gibt es 0 Profile und 0 `staff_roles`, und die Migration
wäre bei jedem Lauf gescheitert. Die Anforderung unterscheidet jetzt zwei
Lagen: 0 Profile → überspringen; Profile ohne Admin → abbrechen. Beide
Grenzfälle sind gefahren. Das ist eine Verschärfung der Spec nach der Review,
kein Nachgeben gegenüber einem Befund.

**`release-geschichten.ts` wird doch angefasst — eine Zeile.** Ausgelöst von
einem Hinweis der Parallelsitzung fbc-platform-61 (AGE-907), nicht von einem
Reviewer. AGE-907 hat mit `935b987` sieben Einstiege in den Kaufweg entfernt,
darunter den Link „Mitgliedschaft ansehen" neben dem gesperrten
Anmeldeknopf. Die Geschichte
`2026-08-25-event-anmeldeknopf-teilnahmeschwelle` beschreibt genau diesen Weg
(„und wo du zur Mitgliedschaft kommst") und ist damit seit heute falsch.

Nachgemessen statt vermutet: **kein** Text der 23 trägt eine URL oder einen
Routenpfad (0 Treffer), und von den sieben entfernten Einstiegen beschreibt
genau dieser eine Satz einen. `redirect-targets.test.ts` hätte das nie
gefunden — er leitet seine Routenliste aus `App.tsx` ab und sieht weder
Prosa noch Datenbankinhalte.

Donald hat am 25.09. entschieden, den Halbsatz zu streichen. Das Proposal ist
entsprechend korrigiert; die Zusage „`release-geschichten.ts` bleibt
unverändert" stand dort vorher und war ab diesem Moment falsch.

Am **Entwurf** der Lösung ändert das nichts: Weg, Datum, Idempotenz,
Autorauflösung und die Stille gegenüber `notifications` stehen unberührt so
da, wie beide Reviewer sie gesehen haben. Eine zweite Review-Runde wäre
dafür unverhältnismässig; wäre der Entwurf berührt worden, stünde hier das
Gegenteil.

<!-- openspec-review-trailer v1
implementing-host: claude
digest: sha256:d377d78146f5d9ccfac157c6be7c95367547a3d59db2e25f682dad7da1213c39
producer-version: 1.3.1
tasks-digest: sha256:a989595f67ae3295739bf2a9a3e64416a938deb08723b8b2163183941dfb0a3b
-->
