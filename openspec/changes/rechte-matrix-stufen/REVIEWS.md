---
reviewers: [gemini, opencode]
models: [gemini (Modell nicht ausgewiesen), "hf:moonshotai/Kimi-K3"]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 1cd312cc74ea9f2db00790a15c210220718d0ea868f31a6444c5332693653368
---

# Change review — rechte-matrix-stufen (AGE-598)

Geprüfter Artefaktsatz: `proposal.md` + `design.md` + `tasks.md` + beide
Delta-Specs, 1.035 Zeilen / 51 kB, sha256 oben. **Beide Reviewer haben den
Stand VOR dieser Überarbeitung gelesen** — die Artefakte sind danach als
Antwort auf die Befunde geändert worden.

`claude` ist ausgeschlossen: eigener Anbieter dieses Hosts. `codex` wurde nach
[[codex-delegiert-die-review-weiter]] nicht eingeplant — er liefert bei
Prompts dieser Grösse kein Verdikt und startet statt dessen Unter-Reviewer,
darunter den eigenen Anbieter.

## Reviewer: gemini (Modell nicht ausgewiesen)

VERDICT: REQUEST-CHANGES

- **[HIGH]** design.md D3 / Risiken — Die Entkopplung stellt den Welpenschutz
  **beim Ausrollen sofort und ohne Zutun** scharf. Ein Mitglied, das heute ein
  neues Konto anschreiben kann, könnte es danach nicht mehr. Ein
  Neuigkeiten-Eintrag ist als Milderung einer blockierenden Änderung zu wenig.
  *Fix:* an eine Bedingung knüpfen — entweder erst beim nächsten
  `open_contact = false`, oder ein zweiter, ausdrücklicher Schalter.
- **[MEDIUM]** design.md D1 / tasks 4.3 — Die Frage, ob die Filter für
  maskierte Spalten ausgeblendet werden oder leer laufen, ist in die Umsetzung
  verschoben. Das ist eine Gestaltungs-, keine Implementierungsfrage.
  *Fix:* im Entwurf entscheiden; Empfehlung ausblenden.
- **[LOW]** design.md D2 — `connect` → genau `connect` macht die Funktion für
  das erste `connect`-Mitglied unbrauchbar. *Fix:* die Produktentscheidung
  bestätigen lassen oder auf „connect und höher" lockern.

**Gelesen?** Ja. Alle drei Befunde zitieren die Artefakte an der zutreffenden
Stelle. Keine Datei:Zeile-Belege, also nichts am Repo nachzuschlagen — die
sonst nötige Gegenprobe gegen erfundene Pfade entfällt hier.

## Reviewer: opencode (hf:moonshotai/Kimi-K3)

VERDICT: REQUEST-CHANGES

Hat vor dem Urteil **im Repo gemessen** und die Grundlagen des Entwurfs
bestätigt: `search_directory` ist INVOKER über `profiles` mit `has_level(3)`,
`cr_insert_self` trägt die zwei getrennten `is_contact_open() or`-Klauseln an
den genannten Stellen, und `offers`/`needs`/`profile_interests` sind ebenfalls
mit `has_level(3)` belegt — womit D1s „Maskierung von selbst" für die
berechneten Spalten tatsächlich aufgeht.

- **[HIGH]** `20260613170000_directory_search.sql:55` / D1 — **`search_doc` ist
  ein Orakel auf Rang-3-Daten für die neue Rang-2-Zielgruppe.** Das Dokument
  enthält `competencies` und `interests`; die Volltextklausel bindet nur an
  `is_activated()`, nicht an die Stufe. Ein `connect`-Konto könnte „Hat X die
  Kompetenz Y?" über das Suchfeld beantworten. AGE-291 hat dieselbe Orakelklasse
  für den Namen erkannt und geschlossen. Widerspricht ausserdem der eigenen
  Delta-Zusage, dass ein Filter auf maskierten Spalten leer liefert.
  *Fix:* zweiter tsvector über Basisfelder für Aufrufer unter Rang 3, Bindung
  nach der Form aus AGE-291 — oder die Preisgabe ausdrücklich als gewollt
  festschreiben.
- **[HIGH]** `20260826110000:90-106` vs. Delta — **`branche` fällt durch beide
  Raster.** Die Spalte kommt aus `profiles`, steht aber nicht in
  `profiles_public`; nach D1 fiele sie für `connect` still auf NULL und
  `p_branche` liefe wortlos leer. Die Aufzählung der erweiterten Spalten nennt
  `branche` nicht, die der betroffenen Filter `p_branche` nicht.
  *Fix:* `branche` als Verzeichnis-Facet in `profiles_public` aufnehmen und die
  Aufzählung vervollständigen.
- **[HIGH]** proposal.md „Impact → Betrieb" vs. design.md D3 / tasks 10.3 —
  **Das Proposal widerspricht dem Entwurf.** Es sagt „ändert zunächst nichts",
  das Design sagt das Gegenteil und hat recht. Wer nur das Proposal liest,
  genehmigt ein falsches Risikobild.
  *Fix:* den Betriebs-Absatz korrigieren.
- **[HIGH, angeschnitten]** design.md „Context" — **„Nirgends gemessen: Wie alt
  ist der Bestand?"** Der Rest des Befundes wurde vom Werkzeugprotokoll
  überschrieben; der Kern ist eindeutig, weil `is_new_member` auf
  `profiles.created_at` steht und der Import alle 72 Profile in einem Lauf
  angelegt hat.

## Not counted

- **codex** — nicht eingeplant, siehe oben. Kein Ausfall, eine Entscheidung.
- **claude** — eigener Anbieter, ausgeschlossen durch Regel 2 des Skills.

**opencode wurde nach dem Verdikt von Hand gestoppt** (`pkill`, Exit 144). Er
hatte Verdikt und vier Befunde geliefert und danach wieder Spec-Dateien
gelesen; der vierte Befund ist deshalb nur im Kopf erhalten. Das ist ein
Abbruch nach der Lieferung, kein Timeout vor ihr — die Stimme zählt.

## Resolution

| Befund | Antwort |
|---|---|
| gemini HIGH (sofortiger Welpenschutz) · opencode HIGH-3 (Proposal ≠ Design) · opencode HIGH-4 (Alter des Bestands) | **Übernommen — und die drei zusammen haben die Regel gekippt.** Erste Antwort war ein zweiter Schalter `welpenschutz_aktiv` mit Vorgabe `false`. Dann wurde HIGH-4 gemessen: alle 74 Profile sind jünger als 30 Tage, der Fluchtweg deckt rund 2 % der Paare. Eine Schutzregel, die man wegen ihrer eigenen Wirkung nie einschalten kann, ist keine Regel. Donald hat sie daraufhin am 02.09. **ersatzlos gestrichen** — „haben andere Plattformen auch nicht". D3 ist entsprechend neu, `is_new_member(uuid)` wird mit gedroppt (gemessen: genau ein lebender Aufrufer), und die Aussage des Proposals wird wahr, statt durch einen Schalter wahr gemacht zu werden. |
| opencode HIGH-1 (`search_doc`-Orakel) | **Übernommen.** Neue Anforderung „Der Volltext gibt nicht preis, was die Ausgabe maskiert" plus D6 und Aufgabengruppe 3b: zweiter tsvector über Basisfelder, Bindung nach AGE-291. Der teuerste Befund der Runde — er hätte den Change in genau die Klasse Leck verwandelt, gegen die er schützt. |
| opencode HIGH-2 (`branche`) | **Übernommen.** D7: `branche` wird Basisfeld und kommt in `profiles_public`. Die Delta-Aufzählung ist auf „genau diese fünf sind erweitert, alle übrigen sind Basis" umgestellt, damit keine Spalte mehr ohne Zuordnung bleibt. Die Erweiterung dessen, was `profiles_public` preisgibt, ist als Entscheidung ausgeschrieben, nicht als Aufräumarbeit. |
| opencode HIGH-4 (Alter des Bestands) | **Übernommen als Messauftrag,** nicht als Blocker: die Vorgabe `false` verhindert die Wirkung. Neue Aufgabengruppe 6b misst die `created_at`-Verteilung auf PROD, **bevor** der Schalter je umgelegt wird, und legt Donald die Folgefrage vor, ob `is_new_member` für importierte Mitglieder das richtige Datum liest. |
| gemini MEDIUM (Filter offen gelassen) | **Übernommen.** D5 entscheidet: die Filter werden **ausgeblendet**, nicht leer laufen gelassen, plus ein Hinweis, ab welcher Stufe es sie gibt. Aufgabe 4.x umgeschrieben von „entscheiden" auf „umsetzen". |
| gemini LOW (`connect` → genau `connect`) | **Nicht geändert, und das ist eine Entscheidung.** Donald hat die Auslegung am 25.08. ausdrücklich getroffen, samt der benannten Folge, dass ein `connect`-Mitglied bei heutigem Bestand niemanden erreicht. Der Entwurf sagt das in D2 unverblümt. Eine Lockerung auf „connect und höher" wäre eine neue Produktentscheidung, keine Korrektur. |

**Nach dieser Überarbeitung ist der Artefaktsatz nicht mehr der geprüfte.** Der
Gate-Trailer fehlt deshalb bewusst: er bindet den Review per Digest an die
Artefakte, und ihn von Hand nachzutragen behauptete eine Bindung, die es nicht
gibt. Der Gate meldet das als `trailer-absent` und blockt nicht.

---

# Diff-Review (Aufgabe 8.7) — 2026-09-02

Gegenstand ist der **Diff**, nicht der Plan: `git diff main...HEAD` ohne
`session-handoff.md` und `openspec/`, 2.245 Zeilen, in `.gstack/age598-diff.txt`
(gitignoriert). Zwei Arme direkt per Bash, `REVIEWER_TIMEOUT=900`. `claude` ist
ausgeschlossen (eigener Anbieter), `codex` nicht eingeplant.

## Reviewer: opencode (`hf:moonshotai/Kimi-K3`)

**VERDICT: Freigabe.** Drei Befunde, alle NIEDRIG.

Er hat **selbst gemessen** statt gelesen: den lokalen Stack befragt, den Katalog
gelesen (`prosecdef`, `proconfig`, Funktionsrechte), `cr_insert_self` über
`pg_get_expr(polwithcheck)` Klausel für Klausel gegen den Vorstand aus
`20260806080100_activation_gate.sql:312-333` verglichen, ein `connect`-Konto
impersoniert und `vitest` über die sieben berührten Testdateien gefahren.

| Befund | Antwort |
|---|---|
| **1 — NIEDRIG:** ein geteilter Link mit `theme=…`/`competency=…` schicke bei einem `connect`-Konto einen verdeckten Filter an die RPC | **Reproduziert NICHT.** `DIRECTORY_QUERY_PARAM` ist `"q"`, und der Anfangszustand liest daraus **nur** `query` (`MemberDirectory.tsx:56`). `theme`, `competency`, `offering`, `offers`, `needs` kommen nie aus der Adresszeile. Der Kommentar an derselben Stelle sagt das seit AGE-629 ausdrücklich. Die „Messbar"-Zeile des Befundes trägt an der entscheidenden Stelle einen Platzhalter statt einer URL — er hat den Link nie gebaut. |
| **2 — NIEDRIG:** `branche` in `profiles_public` ist eine **Preisgabe-Erweiterung**: die Sicht ist RLS-umgehend und ohne Stufenschwelle, die Branche ist damit für jedes aktivierte Konto lesbar, auch für `basic` | **Zutreffend, und es ist eine Entscheidung, kein Fehler** — so auch von opencode eingeordnet. Sie steht in D7 und im Migrationskopf (§6), und sie war nötig, damit der Branchenfilter für `connect` nicht wortlos leer läuft. **Für Donald aufgeschrieben**, weil sie die einzige Stelle des Changes ist, an der Daten für eine Stufe sichtbar werden, die die Verzeichnisfläche gar nicht betritt. |
| **3 — NIEDRIG:** der Basis-Vektor läuft ohne den GIN-Index | **Bekannt und im Migrationskopf (§5) benannt**, samt der Schwelle, ab der es falsch wird: das Paging. Bei 74 Profilen folgenlos; ab Rang 3 läuft weiterhin der indizierte Weg. Als bestätigte Beobachtung übernommen, nicht als Nacharbeit. |

Seine Negativbefunde decken die sechs Prüffragen ab: kein Leck über den
`left join`, keine Orakel-Funktion über die Filterparameter, der Basis-Vektor
ist echte Teilmenge von `search_doc`, `darf_kontaktanfrage_senden` ist gehärtet
und öffnet `anon` keinen Weg, `cr_insert_self` ist bis auf den absichtlich
gestrichenen Welpenschutz vollständig, die pgTAP-Planzahlen stimmen
(35 · 32 · 435 = 437−2) und die Ablehnungen sind an der RLS-Meldung verankert.

## Reviewer: gemini (Modell nicht ausgewiesen)

**VERDICT: Nacharbeit — beide Befunde am Repo widerlegt.** Er hat den Diff aus
dem Scratchpad gelesen und trotzdem auf erfundene Belege gestützt:

- Der HOCH-Befund gilt einer Datei `supabase/tests/database/age-598-rechte-matrix.test.sql`.
  **Es gibt sie nicht**, und das Verzeichnis `supabase/tests/database/` auch nicht.
  `is_empty` kommt in `directory_search_test.sql` **null**mal vor.
- Der MITTEL-Befund behauptet, `search_directory` prüfe den Vektor
  `profiles_public.search_doc`. Die Sicht **hat keine solche Spalte**; der
  Rumpf liest `p.search_doc` aus der RLS-gefilterten Tabelle
  (`20260902150000…:224`), und genau darauf beruht die Maskierung.

Die Sache hinter dem MITTEL-Befund — leckt der Volltext? — ist von Zusage 11.1
in `directory_search_test.sql` abgedeckt und von opencode unabhängig
nachgemessen. Das ist dasselbe Bild wie am 28.08.: geminis Verdikt taugt als
zweite Stimme, seine Belege nicht.

## Was der Review NICHT gefunden hat, die Sichtprobe aber schon

`/p/:id` liegt hinter `<RequireAuth>`, nicht hinter `<MembershipGate>`. Die
Seite rendert also, bevor `levelRank` da ist — und `null` sah in der neuen
Begründung wie Rang 0 aus. Ein `discover`-Konto las für einen Moment, es dürfe
niemanden anschreiben. Behoben in `8bbae86`, mit Zusage und Gegenprobe.

**Kein Gate-Trailer:** er bindet einen Review per Digest an die Artefakte des
Plans. Dieser Review gilt einem Diff, nicht den Artefakten.
