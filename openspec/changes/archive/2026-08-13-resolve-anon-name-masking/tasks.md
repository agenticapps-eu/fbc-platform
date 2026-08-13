## 1. Plan-Review — erledigt, steht vor allem anderen

- [x] 1.1 `openspec validate --all` grün.
- [x] 1.2 Plan-Review (Schritt 2b): zwei Reviewer anderer Anbieter, Ergebnis in `REVIEWS.md`. gemini APPROVE, codex REQUEST-CHANGES mit drei HIGH.
- [x] 1.3 Befunde eingearbeitet: die falsche RLS-Begründung ersetzt, `REMOVED` → `MODIFIED` (sonst sperren sich dieser Change und `finish-ui-polish` gegenseitig beim Archivieren), die Zusage an AGE-540 zurückgenommen, „spec-only" korrigiert.

## 2. Ausgangsmessung

- [x] 2.1 `pnpm test -- --run src/lib/displayAuthor.test.ts src/lib/anon-anreicherung.test.ts` → **12 Fälle in 2 Dateien, alle grün.**
- [x] 2.2 `git status --short` gelesen: nur `session-handoff.md` schmutzig. Alle drei Zieldateien sauber — die Proben sind erlaubt.
- [x] 2.3 Blob-Hashes notiert:
  - `displayAuthor.ts` → `99e8c1ca373ff8b50b31fa10a6d7936032b835e3`
  - `feed.ts` → `f0bff58844255f23b14212e535c31f0530302949`
  - `anon-anreicherung.test.ts` → `7783da238655b28e97b9ded5a382332614b962f7`

## 3. Mutationsprobe — die Tests einmal rot gesehen

Alle Eingriffe zurückgenommen, alle drei Blob-Hashes nach der Rücknahme identisch mit 2.3, danach jeweils wieder 12/12 grün. Nichts davon ist committet.

- [x] 3.1 **Probe A (Anzeige):** Ausgeloggt-Zweig aus `displayAuthor` entfernt.
      → **ROT, 1 Fall:** `displayAuthor.test.ts > masks name and avatar for anonymous (logged-out) viewers` — `AssertionError: expected 'Eleonora Voss' to be 'Ein Mitglied'`.
      Nebenbefund: `anon-anreicherung.test.ts` blieb dabei **grün**. Die beiden Ebenen sind wirklich unabhängig abgesichert — das war Behauptung und ist jetzt Messung.
- [x] 3.2 **Probe B (Daten):** Session-Bedingung aus `fetchAuthors` entfernt.
      → **ROT, 2 Fälle:** `fragt ausgeloggt profiles_public gar nicht erst an` (`expected [ 'posts', 'profiles_public', …(1) ] to not include 'profiles_public'`) **und** `Die Regel, nicht der Einzelfall` (`expected [ 'profiles_public' ] to deeply equal []`).
- [x] 3.3 **Probe C (Wächter innerhalb des Aufrufgraphen):** `supabase.from("contacts")` in `fetchFeed` — eine gesperrte Relation, die in keinem Test namentlich vorkommt.
      → **ROT, genau 1 Fall:** `Die Regel, nicht der Einzelfall` — `expected [ 'contacts' ] to deeply equal []`. Der Wächter fängt einen unvorhergesehenen Verstoß, ohne dass ihn jemand erraten muss.
- [x] 3.4 **Gegenprobe zur Grenze:** gleichzeitig (a) `supabase.rpc("search_directory_anon", …)` in `fetchFeed` und (b) eine neue, nirgends importierte Datei `src/lib/probe-neue-datei.ts` mit `supabase.from("contacts")`.
      → **GRÜN GEBLIEBEN, 12/12.** Beide Umgehungen bleiben unbemerkt. Das ist der gemessene Beleg für die Reichweiten-Aussage in der Anforderung — und dafür, dass **AGE-540 seinen eigenen negativen Test braucht** und sich nicht auf diesen berufen darf.
- [x] 3.5 A, B und C wurden rot. Kein Anhalten nötig.

## 4. Die zwei Kommentare im Produktionscode

- [x] 4.1 `src/lib/displayAuthor.ts` — der Folgeschritt hat jetzt eine Adresse (`finish-ui-polish`, Schwelle `has_level(4)`), und der Kommentar sagt ausdrücklich, dass der Grund **nicht** „die RLS erledigt das" ist. Dazu der Hinweis, dass diese Funktion die obere von zwei Ebenen ist.
- [x] 4.2 `src/lib/anon-anreicherung.test.ts` — über `ANON_DARF_LESEN` steht jetzt, was der Wächter leistet und was nicht, mit beiden in 3.4 gemessenen Lücken beim Namen.
- [x] 4.3 `pnpm test` vollständig → **744/744 in 103 Dateien**, unverändert gegenüber der Ausgangslinie (richtig so für eine reine Kommentar-Änderung). `pnpm lint` → 0 Fehler, 4 vorbestehende Warnungen in fremden Dateien. `pnpm format:check` meldet 109 Dateien Altbestand — **keine davon ist eine dieses Changes** (geprüft). `pnpm format` wurde nicht ausgeführt.

## 5. Gegenprobe an der Oberfläche

- [x] 5.1–5.3 **Bewusst nicht im Browser geprüft, mit Begründung.** Der Diff ist mechanisch als kommentar-only nachgewiesen: `git diff -U0 src/` enthält nach Abzug von Kommentar- und Leerzeilen **null** Zeilen (43 Einfügungen, 1 Löschung, alles Kommentar). Ein Laufzeitverhalten, das sich nicht geändert haben kann, im Browser nachzusehen misst nichts — die Aussage über das Verhalten tragen die Mutationsproben in §3, und die haben rot/grün echt gemessen. Wäre eine ausführbare Zeile im Diff, gälte diese Begründung nicht.
- [x] 5.4 **Die neue Spec-Aussage an der Datenbank belegt** (DEV, rein lesend, in einer zurückgerollten Transaktion; Rolle wie im pgTAP über `set local role authenticated` + `request.jwt.claims`):

  ```
  Testkonto: tier=basic
  öffentliche Profile insgesamt: 40
  als basic ueber profiles_public  : 38 Zeilen, 38 mit Namen
    fremde Namen (Beispiele)       : Donald (Testkonto AGE-495) | Basic Demo | Discover Demo
  als basic ueber search_directory : 1 Zeilen, davon fremd: 0
  ```

  **38 fremde Namen über die View, 0 über die RPC.** Genau die Divergenz, die der Spec jetzt beschreibt und die meine ursprüngliche Begründung bestritten hätte. (38 statt 40: zwei Profile sind nicht aktiviert — der Gate-Rumpf der View greift, wie vorgesehen.)

## 6. Abschluss

- [ ] 6.1 `openspec validate --all` grün.
- [ ] 6.2 **Vor** dem PR archivieren: `openspec archive resolve-anon-name-masking`, damit die gefaltete `openspec/specs/directory-search/spec.md` **im geprüften Diff** liegt. Danach prüfen, dass die Anforderung ihren Kopf behalten hat (sonst findet `finish-ui-polish` sie später nicht mehr) und der neue Rumpf steht.
- [ ] 6.3 Commit auf dem Feature-Branch, Conventional Commit mit `(AGE-291)`.
- [ ] 6.4 PR öffnen; die Mutationsproben und der DB-Beleg gehören mit ihrer gelesenen Ausgabe in die Beschreibung.
- [ ] 6.5 Code-Review auf dem Diff durch einen unabhängigen Leser.
- [ ] 6.6 CI grün auf der HEAD-SHA prüfen (`check-runs`, nicht `run list`), mergen, Merge mit `gh pr view --json state` bestätigen.
- [ ] 6.7 AGE-291 in Linear **offen lassen** — vertagt, nicht erledigt. Erst `get_issue` lesen (die GitHub-Automation könnte den Status beim Merge fälschlich auf Done schalten). Kommentar: Maskierung für Ausgeloggte steht auf zwei Ebenen, die Startseite zeigt Gästen keine Mitgliederliste, der offene Teil ist die stufenweise Auflösung in `finish-ui-polish` — und die gemessene Zahl aus 5.4 dazu.
- [ ] 6.8 Zwei Folgepunkte als Issues: die erfundenen Kennzahlen und Testimonials auf `HomePage.tsx:81`, und ein repositoriumsweites Mittel gegen anon-Lesepfade, das auch Funktionsaufrufe erfasst (in 3.4 als Lücke gemessen).
