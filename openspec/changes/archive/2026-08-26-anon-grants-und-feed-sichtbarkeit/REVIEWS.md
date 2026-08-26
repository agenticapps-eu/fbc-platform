---
reviewers: [gemini, codex]
models: [gemini-cli-0.28.2, gpt-5.6-sol]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: ef2b3f4e0ee63d7c18cfa9cd9a44dbe2c2ce6234bf0297b7dd5b1a18173f69a4
---

# Change review — anon-grants-und-feed-sichtbarkeit

Eigener Anbieter (claude) ausgeschlossen. Beide Reviewer sind fremde Anbieter,
beide mit Exit 0 gelaufen und damit gezählt.

**Zum Modell von gemini:** die CLI gibt es in ihrer Ausgabe nicht preis; notiert
ist die CLI-Version. Ein geratener Modellname wäre hier schlechter als eine
Lücke, weil die Regel gerade verhindern soll, dass zwei Arme auf dasselbe Modell
als zwei Meinungen zählen.

## Reviewer: gemini (CLI 0.28.2)
VERDICT: REQUEST-CHANGES

- [MEDIUM] Impact — Die Wirkungsanalyse betrachtet nur die Kosten je Zeile, nicht
  die Folge, dass Konten unter Rang 4 erstmals überhaupt Ergebnismengen bekommen
  (Abfragezeit, Nutzlast, Rendering). — Messung für ein `basic`-Konto ergänzen.
- [LOW] What Changes — Nicht geprüft, ob im Frontend Logik auf die alte
  Rang-Schwelle baut. — Codebase durchsuchen.
- [LOW] Impact — Keine Nutzer-Kommunikation vorgesehen, obwohl bestehende Inhalte
  ein größeres Publikum bekommen. — Mit dem Product Owner klären.

## Reviewer: codex (gpt-5.6-sol)
VERDICT: REQUEST-CHANGES

- [HIGH] `fbc_profile_search_doc` — `profiles.search_doc` sei eine gespeicherte
  generierte Spalte; ein Entzug von `PUBLIC` breche Profil-Schreibzugriffe, weil
  `authenticated` das Recht nur über `PUBLIC` halte.
- [HIGH] Default Privileges — Der Change repariere nur fünf Ist-ACLs und lasse den
  divergenten Funktions-Default stehen; die nächste Funktion erbe wieder `anon`.
- [HIGH] `requiresAuth` — Auf einer `entdecken`-Route setze das eine
  `MembershipGate`-Wand und widerspreche den unveränderten Zusagen zum
  ausgeloggten Schaufenster.
- [HIGH] `Der Feed-Beitrag folgt seinem Event` — Die dauerhafte Anforderung sage
  weiterhin, ein `members`-Event sei unter Rang 4 sichtbar, sein Beitrag nicht;
  das Delta fasse sie nicht an.
- [MEDIUM] Testabdeckung §2 — `former_member_entries`, `post_media`-Zeilen,
  Kommentare, `feed_tag_counts`/`feed_top_authors` und gespiegelte Event-Beiträge
  fehlen; bestehende `rls_test.sql`-Zusagen erwarten ausdrücklich das Gegenteil.
- [MEDIUM] Gegenprobe — Erteilen/Entziehen auf der echten Funktion beweise nur,
  dass `has_function_privilege` den Katalog liest.
- [MEDIUM] Lebenszyklus — `migrate-prod` hängt am `migrate-dev`-Lauf desselben
  Commits, der erst nach dem Merge läuft; die PROD-Zahlen sind vor dem Archivieren
  nicht eintragbar.
- [MEDIUM] Sechser-Positivliste — `post_engagement_counts` und
  `event_registration_counts` gewähren zusätzlich `PUBLIC`.
- [LOW] `post_media_lesbar` — Das Delta sage „nicht dupliziert" und zähle die
  Funktion zugleich als eine von vier Kopien.

## Resolution

### HIGH `fbc_profile_search_doc` — **BESTÄTIGT.** Meine erste Widerlegung war falsch.

Diese Auflösung stand hier zuerst als „widerlegt, gemessen", mit einer Tabelle.
Sie war falsch, und wie sie falsch wurde, ist die eigentliche Lehre.

Die Prämisse stimmte: `profiles.search_doc` ist `attgenerated = 's'` und der
`proacl` der Funktion ist `null`, `authenticated` hält das Recht also allein über
`PUBLIC`. Meine Gegenmessung sollte zeigen, dass ein `UPDATE` trotzdem durchgeht —
und sie zeigte das auch. Nur hatte sie nichts gemessen: die Sonde lief als
`authenticated` **ohne gesetzte JWT-Claims**, ihr `UPDATE` traf wegen RLS **null
Zeilen**, und die generierte Spalte wurde nie berechnet. „Ging durch" hieß in
Wahrheit „hat nichts angefasst".

Aufgefallen ist es erst an `rls_test.sql` Abschnitt 15, wo der Schreibweg mit
echter Identität läuft:

```
have: DENIED:permission denied for function fbc_profile_search_doc
want: OK
```

Postgres prüft `EXECUTE` beim Auswerten eines Generierungsausdrucks also **sehr
wohl**, und gegen den Schreibenden. Ohne einen Grant fiele jedes Profil-UPDATE
eines Mitglieds.

**Behoben:** die Migration gibt `authenticated` das Recht ausdrücklich zurück;
`anon` bleibt außen vor, weil ein ausgeloggter Aufrufer kein Profil schreibt. Am
Katalog gegengeprüft, welche weiteren Objekte an den entzogenen Funktionen
hängen: nur `profiles.search_doc`, und `array_jaccard` hängt an keiner
generierten Spalte, keinem Index und keiner View — es bleibt zu Recht entzogen.

**Merksatz, der hier gefehlt hat:** ein `UPDATE`, das null Zeilen trifft, ist kein
bestandener Test. Das steht so schon in den Projektnotizen — eine fremde
Schreiboperation endet unter RLS mit null Zeilen statt mit `42501` — und ich habe
es beim Bauen der Sonde nicht angewandt. Eine Sonde braucht dieselbe Gegenprobe,
die dieser Change von seinen Zusagen verlangt: erst zeigen, dass sie überhaupt
ausschlägt.

### HIGH Default Privileges — **angenommen** (und unabhängig selbst gefunden)

War bereits vor dem Review in `design.md` umgeschwenkt, nachdem die Messung die
erste Entscheidung widerlegt hatte. Codex kommt unabhängig zum selben Schluss.
Donald hat die Reichweite entschieden: `from public, anon, authenticated`,
`service_role` bleibt.

### HIGH `requiresAuth` — **angenommen, die Aufgabe entfällt ersatzlos**

`community-feed` sagt wörtlich, die Aktivitätsseite trage „weder `requiresAuth`
noch eine Mindeststufe", und `App.tsx:37` bestätigt die Folge. Die Prämisse des
Handoffs („`/aktivitaet` trägt kein `minTier`" als Lücke) war ein Fehlschluss:
das Fehlen ist die Entscheidung. AGE-601 behebt das eigentliche Problem — der Feed
ist danach nicht mehr leer. **`nav.ts` wird nicht angefasst.**

### HIGH Event-Beitrag — **angenommen**

Die Anforderung wird per `MODIFIED` nachgezogen. AGE-601 **löst** die dort selbst
als Rätsel benannte Asymmetrie: Event und Beitrag stimmen danach überein.

### MEDIUM Testabdeckung, Gegenprobe, Positivliste, LOW Wortlaut — **angenommen**

- Die Gegenprobe läuft auf einer **Wegwerf-Funktion** und belegt damit zugleich,
  dass der neue Default wirkt.
- `post_engagement_counts` und `event_registration_counts` bekommen
  `revoke … from public` plus ausdrücklichen `grant` — am lokalen Katalog
  bestätigt (`=X/postgres` neben den benannten Rollen).
- Der Wortlaut zu `post_media_lesbar` wird auf „delegiert an einen Helfer"
  umgestellt.

### MEDIUM Lebenszyklus `migrate-prod` — **angenommen als benannte Grenze**

Stimmt: die PROD-Zahlen entstehen erst nach dem Merge. Das ist keine Lücke dieses
Changes, sondern die Reihenfolge der Pipeline. `tasks.md §5` bleibt offen bis
nach dem Deploy, und die Anforderung sagt ausdrücklich, dass der Rechte-Zustand
bis dahin als **unbelegt** gilt.

### gemini MEDIUM Nutzlast — **angenommen, klein**

Der Feed pagiert bereits (`Der Feed lädt seitenweise`), die Nutzlast ist also
begrenzt. Eine Messung für ein `basic`-Konto kommt in die Sichtprobe.

### gemini LOW Frontend-Logik — **geprüft, nichts gefunden**

Kein Frontend-Code gatet den Feed auf Rang 4; die einzigen Fundstellen sind zwei
**Kommentare** in `src/lib/feed.ts` (Zeilen 13 und 338), die die alte Regel
beschreiben und mitgezogen werden.

### gemini LOW Nutzer-Kommunikation — **an Donald verwiesen**

Produktentscheidung, kein technischer Befund. Im Handoff festgehalten.

---

# Code-Review auf dem Diff (Schritt 4)

Zwei fremde Anbieter, beide Exit 0. Eigener Anbieter (claude) ausgeschlossen.

## Reviewer: gemini (CLI 0.28.2) — VERDICT: APPROVE

Zwei LOW, beide ausdrücklich als „kein Defekt" formuliert: sie bestätigen die
Verlagerungen der Testabsicht (`feed_top_authors` → Abschnitt 1 über
`feed_tag_counts`; `post_saves` → Wortlaut-Wächter) als richtig begründet und
dokumentiert. Keine Änderung.

## Reviewer: codex (gpt-5.6-sol) — VERDICT: REQUEST-CHANGES

### MEDIUM `array_jaccard` behält `authenticated` in PROD — **bestätigt, behoben**

Der beste Befund des Durchgangs, weil er **genau die Fehlerklasse ist, die dieser
Change behebt**. Am PROD-Katalog nachgemessen:

| `array_jaccard` | |
|---|---|
| PROD `proacl` | `{=X, postgres=X, anon=X, **authenticated=X**, service_role=X}` |
| lokal (vorher) | `null` — alles nur über `PUBLIC` |

`revoke … from public, anon` hätte lokal auch `authenticated` mitgenommen, in
PROD aber nicht. Die Migration hätte die Instanzen an dieser Funktion
**auseinanderlaufen lassen** — und mein Migrationskommentar behauptete zugleich,
`authenticated` habe hier keinen Aufrufer.

**Behoben:** `from public, anon, authenticated`. Zwei Zusagen ergänzt: eine, die
für alle sieben angefassten Funktionen **beide** Client-Rollen festhält, und eine
Ausdehnung der Mechanik-Zusage auf `authenticated`.

**Und die ehrliche Einschränkung, gemessen (Mutation M9):** die Zustands-Zusage
bemerkt diesen Fehler **lokal nicht** — nimmt man `authenticated` aus dem revoke,
bleibt sie grün, weil das Recht hier ohnehin nur über `PUBLIC` kommt. Dieselbe
Blindheit wie M1. Was die Lücke schliesst, ist die PROD-Katalog-Messung nach
`migrate-prod`; die instanzunabhängige **Regel** hält Abschnitt 9.

### MEDIUM `post_saves`-Orakel-Wächter ist zu locker — **bestätigt, behoben**

Der Wächter prüfte `EXISTS \( SELECT 1.*FROM posts` und liess die **Korrelation**
`p.id = post_saves.post_id` offen — `exists (select 1 from posts)` hätte
gematcht, und die Policy prüfte nichts mehr. Ersetzt durch einen Vergleich des
**vollständigen** Ausdrucks.

Codex' zweite Beobachtung stimmt ebenfalls: bei einem deaktivierten Aufrufer
fällt `is_activated()` vor dem `exists`. Das steht seit dem Umbau als Kommentar
in der Datei; der Wächter ist die Kompensation und ist jetzt scharf genug, um sie
einzulösen.

### LOW falsche Abdeckungs-Behauptungen zur Autoren-Klausel — **bestätigt, behoben**

Drei Zusagen behaupteten, den dritten Prädikat-Zweig (`author_id = auth.uid()`)
zu prüfen. Seit AGE-601 trägt sie der `members`-Zweig allein; sie blieben auch
ohne den dritten Zweig grün. Die Beschriftungen sagen das jetzt und verweisen
auf den Wortlaut-Wächter in `member_lifecycle_test.sql` (7.18), der den Zweig im
Policy-Text pinnt — die einzige Stelle, die ihn noch hält.

### Abnahme nach den Korrekturen

pgTAP 10 Dateien / **738 Zusagen**, vitest **1694**, `tsc` sauber, eslint 0 Fehler.
