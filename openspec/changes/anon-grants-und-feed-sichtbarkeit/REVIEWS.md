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

### HIGH `fbc_profile_search_doc` — **widerlegt, gemessen**

`profiles.search_doc` **ist** `attgenerated='s'` und `proacl` **ist** `null`
(= `EXECUTE` an `PUBLIC`) — insoweit stimmt die Prämisse. Die Folgerung stimmt
nicht. In einer Transaktion gemessen, mit Gegenprobe:

| nach `revoke … from public, anon` | |
|---|---|
| `has_function_privilege('authenticated', …)` | **false** (`proacl = {postgres=X}`) |
| **direkter** Aufruf als `authenticated` | `42501 permission denied` |
| `UPDATE`, der die generierte Spalte neu berechnet | **geht durch** |

Der Entzug greift also nachweislich; Postgres prüft `EXECUTE` beim Auswerten
eines Generierungsausdrucks trotzdem nicht. **Kein `grant` an `authenticated`
nötig** — der wäre eine Fläche, die niemand braucht. Der direkte Aufruf ist die
Gegenprobe, ohne die „ging durch" auch „Entzug hat nicht gegriffen" heißen könnte.

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
