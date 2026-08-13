---
reviewers: [gemini, codex]
models: [gemini-cli-0.28.2, gpt-5.6-sol]
verdicts: [APPROVE, REQUEST-CHANGES]
reviewed_artifacts_sha: c3f6fb8fbe35936b480c30bc1c72fa85d91f0d8488c213b07fa54e41da08cc88
---

# Change review — resolve-anon-name-masking (AGE-291)

Zwei Anbieter, beide **nicht** der Anbieter des Autors. Zeitgrenze 900 s statt
der Standard-300 s; beide Läufe endeten mit Exit 0.

**Zur Modellangabe, weil sie hier schwächer ist als die Regel verlangt:**
`codex` ist aus `~/.codex/config.toml` belegt (`model = "gpt-5.6-sol"`,
`model_reasoning_effort = "high"`). Für `gemini` gibt der Wrapper das aufgelöste
Modell nicht her und die Konfiguration nennt keins; auf Nachfrage nennt sich die
CLI selbst `gemini-1.5-pro`, was für Version 0.28.2 unglaubwürdig ist. **Eine
Selbstauskunft ist kein Beleg** — festgehalten ist deshalb die CLI-Version, nicht
ein geratenes Modell. Dass es sich um zwei verschiedene Anbieter handelt, steht
davon unberührt.

## Reviewer: gemini (CLI 0.28.2)

VERDICT: APPROVE

- [MEDIUM] design.md → Risks — Das `ANON_DARF_LESEN`-Geländer ist umgehbar von
  jedem neuen Lesepfad, der nicht in diesem Test aufgerufen wird. — Über die
  Konstante einen Kommentar setzen, der ihre Rolle als zentrales Geländer
  benennt und verlangt, neue anon-Lesepfade in diesen Testpfad aufzunehmen.
- [LOW] proposal.md → Anschlussrisiko — Die vertagten Platzhalterzahlen auf
  `HomePage.tsx` gehen ohne eigenen Vorgang verloren. — Eigenes Linear-Issue
  anlegen.

Genannte, nicht ausgesprochene Annahmen: dass die RLS die einzige und korrekte
Stufengrenze ist und Zeilen ganz oder gar nicht liefert (**keine Zwischenform wie
eine Zeile mit geleertem `name`**); dass künftige Entwickler das Geländer kennen;
dass es keinen Fall gibt, in dem jemand eine Profilzeile lesen darf, den Namen
aber trotzdem maskiert sehen sollte.

> Die erste und die dritte dieser Annahmen sind genau das, was codex unten als
> HIGH widerlegt. gemini hat sie benannt und für sicher gehalten; das war sie
> nicht.

## Reviewer: codex (gpt-5.6-sol, reasoning effort high)

VERDICT: REQUEST-CHANGES

- [HIGH] spec delta:45 — **Die RLS-Begründung ist falsch.** `profiles_public`
  läuft mit `security_invoker = off` und gibt `name` an **jede** aktivierte
  authentifizierte Stufe heraus, unabhängig von
  `profiles_select_self_or_discover`. Ein `basic`- oder `connect`-Konto kann
  darüber alle Namen aufzählen, obwohl `search_directory` ihm nur die eigene
  Zeile liefert. Die Streichung ist damit eine echte PII-Entscheidung, nicht die
  Entfernung einer überflüssigen Frontend-Regel. — Entweder stufenaufgelöste
  Namen in der Datenbank bauen, oder die Streichung beibehalten und **ehrlich
  hinschreiben**, dass alle aktivierten Mitglieder jeden öffentlichen Namen lesen
  können.
- [HIGH] anon-anreicherung.test.ts:102 — **`ANON_DARF_LESEN` ist kein Geländer
  für künftige Flächen.** Der Test ruft vier importierte Funktionen auf und
  zeichnet nur `.from(...)` auf. Eine neue AGE-540-Datei mit eigenem
  `supabase.from(...)` bliebe grün — und schlimmer: `.rpc(...)` ist gemockt,
  **ohne den Namen aufzuzeichnen**, eine anon-DEFINER-Such-RPC umginge die
  Prüfung also vollständig. Probe C belegt nur Erkennung **innerhalb** des
  bestehenden Aufrufgraphen. — Anforderung und Proposal auf die vier heute
  ausgeführten Pfade zurücknehmen und für AGE-540 einen eigenen Test verlangen,
  oder ein repositoriumsweites Mittel bauen (zentrales anon-Lesetor oder
  Lint-/AST-Regel), das Relationen **und** RPCs erfasst.
- [HIGH] `openspec/changes/finish-ui-polish/` — **Ein aktiver Change plant genau
  das Gegenteil.** `finish-ui-polish` trägt AGE-291 mit elf Aufgaben, führt
  stufenaufgelöste Namen in der Datenbank ein (Schwelle `has_level(4)`,
  `exchange`) und **entfernt dieselbe Anforderung** aus der
  entgegengesetzten Richtung. Wer zuerst archiviert, macht den anderen
  widersprüchlich oder unarchivierbar. — `finish-ui-polish` ausdrücklich
  zurückziehen oder überarbeiten, bevor dieser Change zugelassen wird —
  oder diesen Change verwerfen und dort weiterbauen.
- [MEDIUM] spec delta:27 — „An keiner Stelle den Namen … eines Mitglieds" ist
  breiter als das Belegte: öffentliche Beitragstexte und Eventbeschreibungen
  können Namen als gewöhnlichen Inhalt tragen. Die neue laufende Wahrheit wäre
  damit schon falsch, ohne dass je `profiles_public` angefragt wird. — Auf
  **strukturierte Identitätsfelder** aus Profil-/Host-Daten einschränken und
  selbstverfasste Inhalte ausdrücklich ausnehmen.
- [MEDIUM] displayAuthor.ts:6 — Der Kopfkommentar sagt weiterhin
  „Folgeschritt (nicht hier): stufenweise Auflösung je Mitgliedsstufe" und
  widerspricht dem vorgeschlagenen `SHALL NOT`. — Umschreiben. **Damit ist die
  Behauptung „kein Produktionscode wird berührt" widerlegt.**
- [MEDIUM] tasks.md:31 — Die Aufgaben mergen den PR **vor** dem Archivieren. Der
  gemergte PR ließe die laufende Wahrheit unverändert, und das Archiv entstünde
  danach als ungeprüfter Diff mit Druck zu einem Direkt-Commit auf `main`. — Auf
  dem Feature-Branch archivieren und die gefaltete
  `openspec/specs/directory-search/spec.md` **im geprüften PR** mitführen.
- [MEDIUM] tasks.md:6 — Die Mutationsproben stehen **vor** Validierung und
  Plan-Review, obwohl 2b vor jeder Code-Änderung liegt. Und `git checkout --
  <datei>` kann vorbestehende Änderungen an `displayAuthor.ts`/`feed.ts`
  vernichten; die Dateien nur zu notieren schützt sie nicht. — Reihenfolge
  drehen; Proben verweigern, wenn ein Ziel schmutzig ist, oder in einem eigenen
  Worktree fahren und den Blob-Hash danach vergleichen.
- [LOW] spec delta:69 — Das eingeloggte Gegenszenario behauptet, dieselben
  Flächen fragten `profiles_public` **und** `partners` an und zeigten danach ein
  Stufen-Badge. Feed-Pfade fragen `partners` nicht an, und Partner-Hosts tragen
  kein Stufen-Badge. — Feed/Profil und Event/Partner trennen.

## Nicht gezählt

Keiner. Beide Läufe endeten mit Exit 0 innerhalb der Zeitgrenze. `claude` wurde
nicht aufgerufen — es ist der Anbieter des Autors.

## Resolution

### Nachgeprüft, bevor gehandelt wurde

Alle drei HIGH-Befunde wurden an der Platte gegengeprüft, nicht geglaubt:

| Befund | Prüfung | Ergebnis |
|---|---|---|
| `profiles_public` umgeht die Stufe | `20260612082726:64` (`security_invoker = off`), `20260715140000:118` (`grant select … to authenticated`) | **bestätigt** |
| Geländer erfasst `.rpc` nicht | `anon-anreicherung.test.ts:124` — `rpc: async () => …`, ohne Aufzeichnung | **bestätigt** |
| `finish-ui-polish` plant das Gegenteil | `proposal.md:6` und `tasks.md:3-16` — DB-Resolver, Schwelle `has_level(4)` | **bestätigt** |

### HIGH 3 → dem Auftraggeber vorgelegt, nicht selbst entschieden

Der Widerspruch zwischen diesem Change und `finish-ui-polish` ist **keine
Redaktionsfrage**. Er entscheidet, ob 70 importierte Mitglieder einander mit
vollem Namen sehen oder nicht, und er ist vier Tage vor dem Umzug gestellt.
Beides sind Entscheidungen des Auftraggebers. **Dieser Change bleibt bis dahin
offen.**

Erschwerend: die Empfehlung, auf die hin „streichen" gewählt wurde, stützte sich
auf die Aussage „die RLS gattert die Daten bereits nach Stufe". HIGH 1 widerlegt
genau diese Aussage. Die Entscheidung wurde also auf falscher Grundlage getroffen
und ist erneut vorzulegen — das ist der eigentliche Ertrag dieses Reviews.

### HIGH 1 → wird eingearbeitet, sobald die Richtung feststeht

Bleibt es beim Streichen, ersetzt eine ehrliche Formulierung die falsche: nicht
„die RLS gattert nach Stufe", sondern „vollständige Namen sind
Verzeichnisdaten für **jedes aktivierte Konto**, `basic` eingeschlossen; das ist
die abgenommene Folge". Die verworfene Alternative bleibt benannt, aber mit dem
richtigen Grund.

### HIGH 2 → wird eingearbeitet, unabhängig von der Richtung

Die Anforderung „Neue anon-Flächen geben keine Mitgliedsnamen preis" wird auf das
zurückgenommen, was der Test wirklich hält, und AGE-540 bekommt einen **eigenen**
negativen Test statt eines geerbten Versprechens. Die `.rpc`-Lücke wird im Spec
benannt: der Mock zeichnet den RPC-Namen nicht auf, eine anon-DEFINER-RPC liefe
also durch. Das war der Kern der Zusage an AGE-540 und ist damit hinfällig.

### MEDIUM/LOW → alle angenommen

- `displayAuthor.ts:6` wird umgeschrieben. Der Change ist damit **nicht mehr
  spec-only**; das Proposal wird entsprechend korrigiert, statt die Behauptung
  zu retten.
- Die Anforderung wird auf strukturierte Identitätsfelder eingeschränkt,
  selbstverfasste Inhalte ausdrücklich ausgenommen.
- Aufgaben umgestellt: Plan-Review vor die Mutationsproben; Proben nur bei
  sauberem Ziel; Archivieren **vor** dem PR, damit die gefaltete Spec im
  geprüften Diff liegt.
- Das Gegenszenario wird in Feed/Profil und Event/Partner getrennt.
- gemini MEDIUM (Kommentar über `ANON_DARF_LESEN`) wird übernommen — er kostet
  nichts und ist der einzige Hinweis, den ein späterer Leser dort findet.
- gemini LOW (eigenes Issue für die erfundenen Kennzahlen auf `HomePage.tsx`)
  wird übernommen.
