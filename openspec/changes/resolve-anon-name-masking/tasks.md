## 1. Plan-Review — erledigt, steht vor allem anderen

- [x] 1.1 `openspec validate --all` grün.
- [x] 1.2 Plan-Review (Schritt 2b): zwei Reviewer anderer Anbieter, Ergebnis in `REVIEWS.md`. gemini APPROVE, codex REQUEST-CHANGES mit drei HIGH.
- [x] 1.3 Befunde eingearbeitet: die falsche RLS-Begründung ersetzt, `REMOVED` → `MODIFIED` (sonst sperren sich dieser Change und `finish-ui-polish` gegenseitig beim Archivieren), die Zusage an AGE-540 zurückgenommen, „spec-only" korrigiert.

## 2. Ausgangsmessung

- [ ] 2.1 `pnpm test -- src/lib/displayAuthor.test.ts src/lib/anon-anreicherung.test.ts` laufen lassen und die Zahl bestandener Fälle notieren. Ohne diese Zahl ist „danach wieder grün" keine Aussage.
- [ ] 2.2 `git status --short` lesen. Ist `src/lib/displayAuthor.ts`, `src/lib/feed.ts` oder `src/lib/anon-anreicherung.test.ts` schmutzig, wird die zugehörige Probe **verweigert**, nicht vorsichtig gefahren — `git checkout -- <datei>` vernichtet vorbestehende Änderungen.
- [ ] 2.3 Von jeder Zieldatei den Blob-Hash notieren (`git hash-object <datei>`). Er ist die Messgröße für „sauber zurückgenommen".

## 3. Mutationsprobe — die Tests einmal rot sehen

Jede Probe: Eingriff einbauen, Testlauf lesen, **rote** Fälle namentlich hier festhalten, Eingriff mit `git checkout -- <datei>` zurücknehmen, Blob-Hash gegen 2.3 prüfen, Testlauf erneut lesen. Kein Eingriff wird committet.

- [ ] 3.1 **Probe A (Anzeige):** in `displayAuthor.ts` den Ausgeloggt-Zweig entfernen. Erwartet rot: „masks name and avatar for anonymous (logged-out) viewers".
- [ ] 3.2 **Probe B (Daten):** in `feed.ts` `fetchAuthors` die Session-Bedingung entfernen. Erwartet rot: „fragt ausgeloggt profiles_public gar nicht erst an" **und** „fragt ausgeloggt ausschließlich Relationen an, die anon lesen darf".
- [ ] 3.3 **Probe C (Wächter innerhalb des Aufrufgraphen):** einen ausgeloggten Lesepfad um eine Abfrage auf eine gesperrte, in keinem Test namentlich genannte Relation erweitern. Erwartet rot: **nur** „Die Regel, nicht der Einzelfall". Belegt Erkennung **innerhalb** des bestehenden Aufrufgraphen — mehr nicht, und genau so steht es jetzt in der Anforderung.
- [ ] 3.4 **Gegenprobe zur Grenze (neu, aus dem Review):** einen Aufruf auf eine gesperrte Relation aus einer **nicht importierten** Datei sowie einen `supabase.rpc("…")`-Aufruf einbauen und belegen, dass der Prüfstand **grün bleibt**. Das ist kein Mangel, den dieser Change behebt — es ist der Nachweis für die Reichweiten-Aussage in der Anforderung und für AGE-540, dass es seinen eigenen Test braucht.
- [ ] 3.5 Wird A, B oder C **nicht** rot: anhalten und melden. Eine Anforderung, deren Test sie nicht hält, darf nicht als laufende Wahrheit archiviert werden.

## 4. Die zwei Kommentare im Produktionscode

- [ ] 4.1 `src/lib/displayAuthor.ts` — „Folgeschritt (nicht hier): stufenweise Auflösung je Mitgliedsstufe" bekommt seine Adresse: `finish-ui-polish` (AGE-291), Resolver in der Datenbank, Schwelle `has_level(4)`. Ohne Adresse liest sich der Satz als vergessene Idee.
- [ ] 4.2 `src/lib/anon-anreicherung.test.ts` — über `ANON_DARF_LESEN` einen Kommentar, der Rolle **und Grenze** festhält: erfasst nur die hier aufgerufenen Pfade, erfasst **keine** Funktionsaufrufe (der Mock hält den Namen nicht fest), und eine neue anon-Fläche braucht ihren eigenen Nachweis.
- [ ] 4.3 `pnpm test` vollständig; Zahl gegen 2.1 halten. `pnpm lint`, `pnpm format:check` — **nie** `pnpm format`.

## 5. Gegenprobe an der Oberfläche

- [ ] 5.1 Lokal ausgeloggt `/` und `/aktivitaet` öffnen: Autoren heißen „Ein Mitglied", kein Avatarbild, keine Mitgliederliste auf der Startseite.
- [ ] 5.2 In der Netzwerk-Ansicht bestätigen, dass ausgeloggt keine Anfrage auf `profiles_public` oder `partners` läuft — der Test misst den Stub, dies misst den Browser.
- [ ] 5.3 Eingeloggt gegenprüfen, dass Namen und Avatarbilder erscheinen. Ohne diese Zeile belegt 5.1 nur, dass nichts geladen wird.
- [ ] 5.4 Die neue Aussage der Anforderung an der Datenbank belegen: ein aktiviertes `basic`-Konto liest `profiles_public` und bekommt fremde Namen; dasselbe Konto ruft `search_directory` auf und bekommt nur die eigene Zeile. **Das ist der Beleg für den unbequemen Teil des Specs** — ohne ihn ist er eine Behauptung.

## 6. Abschluss

- [ ] 6.1 `openspec validate --all` grün.
- [ ] 6.2 **Vor** dem PR archivieren: `openspec archive resolve-anon-name-masking`, damit die gefaltete `openspec/specs/directory-search/spec.md` **im geprüften Diff** liegt. Danach prüfen, dass die Anforderung dort ihren Kopf behalten hat (sonst findet `finish-ui-polish` sie später nicht mehr) und der neue Rumpf steht.
- [ ] 6.3 Commit auf dem Feature-Branch, Conventional Commit mit `(AGE-291)`.
- [ ] 6.4 PR öffnen; die Mutationsproben **mit gelesener Ausgabe** in die Beschreibung, dazu der Beleg aus 5.4. Keine Behauptungen.
- [ ] 6.5 Code-Review auf dem Diff durch einen unabhängigen Leser.
- [ ] 6.6 CI grün auf der HEAD-SHA prüfen (`check-runs`, nicht `run list`), mergen, Merge mit `gh pr view --json state` bestätigen.
- [ ] 6.7 AGE-291 in Linear **offen lassen** — die Sache ist vertagt, nicht erledigt. Erst `get_issue` lesen (der Status setzt sich über die GitHub-Automation selbst; ein Merge könnte ihn fälschlich auf Done schalten). Kommentar hinterlassen: die Maskierung für Ausgeloggte steht auf zwei Ebenen, die Startseite zeigt Gästen keine Mitgliederliste, und der offene Teil ist die stufenweise Auflösung in `finish-ui-polish`.
- [ ] 6.8 Zwei Folgepunkte als Issues anlegen: die erfundenen Kennzahlen und Testimonials auf `HomePage.tsx:81`, und ein repositoriumsweites Mittel gegen anon-Lesepfade (zentrales Lesetor oder Lint-Regel), das auch Funktionsaufrufe erfasst.
