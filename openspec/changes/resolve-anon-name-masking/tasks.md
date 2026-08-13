## 1. Ausgangsmessung

- [ ] 1.1 `pnpm test -- src/lib/displayAuthor.test.ts src/lib/anon-anreicherung.test.ts` laufen lassen und die Zahl bestandener Fälle notieren. Ohne diese Zahl ist „danach wieder grün" keine Aussage.
- [ ] 1.2 `git status --short` lesen und die ungesicherten Dateien im Arbeitsbaum notieren, damit die Rücknahme in 2.x gezielt bleibt (nie breites `git checkout`).

## 2. Mutationsprobe — die Tests einmal rot sehen

Jede Probe: Eingriff einbauen, Testlauf lesen, **rote** Fälle namentlich in dieser Datei festhalten, Eingriff mit `git checkout -- <datei>` einzeln zurücknehmen, Testlauf erneut lesen. Kein Eingriff wird committet.

- [ ] 2.1 **Probe A (Anzeige):** in `src/lib/displayAuthor.ts` den Ausgeloggt-Zweig entfernen, sodass auch ohne Session der echte Name zurückkommt. Erwartet rot: `displayAuthor.test.ts` „masks name and avatar for anonymous (logged-out) viewers". Ergebnis hier eintragen, dann zurücknehmen und grün bestätigen.
- [ ] 2.2 **Probe B (Daten):** in `src/lib/feed.ts` `fetchAuthors` die Session-Bedingung entfernen, sodass `profiles_public` auch ohne `uid` angefragt wird. Erwartet rot: `anon-anreicherung.test.ts` „fragt ausgeloggt profiles_public gar nicht erst an" **und** „fragt ausgeloggt ausschließlich Relationen an, die anon lesen darf". Ergebnis eintragen, zurücknehmen, grün bestätigen.
- [ ] 2.3 **Probe C (Positivliste als Wächter):** einen ausgeloggten Lesepfad um eine Abfrage auf eine für `anon` gesperrte, in keinem Test namentlich genannte Relation erweitern (z. B. `profiles` oder `contacts`). Erwartet rot: **nur** „Die Regel, nicht der Einzelfall". Das ist der Beleg, dass der Wächter einen unvorhergesehenen Verstoß fängt — die Aussage, auf die sich AGE-540 stützt. Ergebnis eintragen, zurücknehmen, grün bestätigen.
- [ ] 2.4 Falls eine Probe **nicht** rot wird: den Change anhalten und melden. Eine Anforderung, deren Test sie nicht hält, darf nicht als laufende Wahrheit archiviert werden — dann fehlt hier doch Testarbeit, und das ändert den Umfang des Changes.

## 3. Gegenprobe an der Oberfläche

- [ ] 3.1 Lokal ausgeloggt `/` und `/aktivitaet` öffnen und sichtprüfen: Autoren heißen „Ein Mitglied", kein Avatarbild, kein Mitgliederverzeichnis auf der Startseite. Die Sichtprobe steht hier, weil sie in diesem Repo mehrfach gefunden hat, was grüne Tests durchgelassen haben.
- [ ] 3.2 In der Netzwerk-Ansicht bestätigen, dass ausgeloggt keine Anfrage auf `profiles_public` oder `partners` läuft — der Test misst den Stub, dies misst den Browser.
- [ ] 3.3 Eingeloggt gegenprüfen, dass Namen und Avatarbilder unverändert erscheinen. Ohne diese Zeile belegt 3.1 nur, dass nichts geladen wird.

## 4. Spec-Delta abschließen

- [ ] 4.1 `openspec validate --all` grün.
- [ ] 4.2 Plan-Review (Schritt 2b): ≥2 Reviewer **anderer Anbieter** über das Delta, Ergebnis in `REVIEWS.md`. Reviewer ausdrücklich auf die zwei Stellen ansetzen, an denen dieser Change schwach ist: (a) Ist die Streichung des stufenweisen Auflösens wirklich harmlos, oder verdeckt die RLS-Begründung einen Fall? (b) Trägt die Positivliste als Geländer für AGE-540, oder ist sie umgehbar?
- [ ] 4.3 Befunde aus `REVIEWS.md` einarbeiten oder je Befund begründen, warum nicht.

## 5. Abschluss

- [ ] 5.1 Commit auf dem Feature-Branch, Conventional Commit mit `(AGE-291)`; der Commit-Text nennt, dass kein Produktionscode geändert wurde und wodurch das belegt ist.
- [ ] 5.2 PR öffnen; die drei Mutationsproben mit ihrer gelesenen Ausgabe in die PR-Beschreibung, nicht nur als Behauptung.
- [ ] 5.3 CI grün auf der HEAD-SHA prüfen (`check-runs`, nicht `run list`), dann mergen und den Merge mit `gh pr view --json state` bestätigen.
- [ ] 5.4 `openspec archive resolve-anon-name-masking` — Delta faltet in `openspec/specs/directory-search/spec.md`. Danach prüfen, dass die alte Anforderung „Author name masking is only partially resolved" dort **nicht mehr** steht und die zwei neuen stehen.
- [ ] 5.5 AGE-291 in Linear prüfen — der Status setzt sich über die GitHub-Automation selbst; erst `get_issue` lesen, dann entscheiden, ob überhaupt geschrieben werden muss. Die vier Korrekturen an der Issue-Beschreibung (keine Mitgliederliste auf der Startseite; Maskierung liegt auf zwei Ebenen; stufenweises Auflösen gestrichen; Tests existieren bereits) als Kommentar hinterlassen.
