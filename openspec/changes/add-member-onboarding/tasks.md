## 1. Plan-Review — erledigt, steht vor allem anderen

- [x] 1.1 Plan-Review (Schritt 2b): zwei Reviewer anderer Anbieter (gemini, codex), Ergebnis in `REVIEWS.md`. Beide REQUEST-CHANGES, 4 HIGH und 7 MEDIUM.
- [x] 1.2 Fünf Tatsachenbehauptungen vor der Übernahme an der Platte nachgeprüft: `saveProfile` schreibt alles (**bestätigt**) · `profiles_select_self_or_discover` = `has_level(3)` (**bestätigt**) · `region` ist Freitext (**bestätigt**) · `NARROW_ROUTES` wirkt nur in der Shell (**bestätigt**) · Index gegen Full Table Scan (**widerlegt**, der Zugriff ist ein Primärschlüsseltreffer).
- [x] 1.3 Befunde eingearbeitet; die Produktfrage (ein Ausweg oder zwei) an Donald entschieden — zwei Auswege plus Nutzenerklärung.
- [x] 1.4 Ausgangslinie festgehalten, gemessen am 2026-08-14 auf `deb6b7e`: **795 Tests in 104 Dateien, alle grün** (`pnpm test`, 7,96 s). Am Ende ist „+n neue Tests" gegen diese Zahl zu belegen.

## 2. Der Merker in `member_settings`

- [ ] 2.1 Migration: `alter table public.member_settings add column onboarded_at timestamptz;` mit Entscheidungskopf — warum **nicht** in `profiles` (`profiles_select_self_or_discover` gibt ab `discover` fremde Vollzeilen frei), warum Spalte statt `localStorage`, warum ein Merker für „beendet" und keiner für „vertagt".
- [ ] 2.2 **Kein** neuer Grant und **keine** neue Policy — und das gehört in den Kopf, nicht ins Schweigen. `member_settings` trägt `grant select, insert, update` auf Tabellenebene (`20260630130000:17`) und `member_settings_own` (`for all`). Muster: `20260804120000_member_settings_theme.sql`.
- [ ] 2.3 Gegenprobe, dass `grants_test.sql` **unberührt** bleibt: `pnpm supabase test db` mit ausdrücklicher Dateiliste laufen lassen — ohne Liste meldet der Befehl FAIL, weil die elf `probe_*.sql` kein pgTAP sind. Bricht der Golden-Snapshot doch, ist die Annahme aus 2.2 falsch und nicht der Snapshot.
- [ ] 2.4 **RED → GREEN** in pgTAP: Ein Konto setzt den Merker auf der **eigenen** Zeile (gelingt). Ein Konto setzt ihn auf einer **fremden** — erwartet wird **`OK` mit null geänderten Zeilen**, **nicht** `42501`: `member_settings_own` filtert die fremde Zeile über `USING` heraus, und PostgreSQL führt das Statement erfolgreich aus. Anschließend den unveränderten Fremdwert nachlesen — ohne diese Nachlese belegt „null Zeilen" nichts. `42501` nur für `anon` erwarten, wo das Recht fehlt.
- [ ] 2.5 **RED → GREEN:** Ein Konto **ohne** Einstellungszeile beendet die Strecke → die Zeile existiert danach und trägt den Merker. Der Schreibweg ist ein `upsert`; ein `update` änderte null Zeilen und meldete dabei keinen Fehler.
- [ ] 2.6 `database.types.ts` regenerieren, Diff ansehen: nur die eine Spalte.
- [ ] 2.7 pgTAP-Fallen: `alike()` statt `like()`; `try_as()` meldet jeden Fehler als DENIED — bei einer Überraschung den echten Fehler suchen, nicht die Zusicherung anpassen.

## 3. Die Weiche in `HomeRedirect` (die riskanteste Stelle)

- [ ] 3.1 **RED:** Über `<App />` an `/`, angemeldet, aktiviert, Merker `null` → die Strecke erscheint. Muss gegen den heutigen Stand rot werden (`HomeRedirect` rendert heute unbedingt `HomePage`).
- [ ] 3.2 **RED:** derselbe Aufbau mit gesetztem Merker → Startseite, **keine** Umleitung.
- [ ] 3.3 **RED:** **ausgeloggt** an `/` → öffentliche Startseite. Ohne diesen Test schlägt die Falle aus `ActivationRedeemPage.tsx:129-135` erneut zu: für einen Ausgeloggten meldet das System „aktiviert".
- [ ] 3.4 **RED:** angemeldet, **nicht** aktiviert → Aktivierungsbildschirm. Belegt, dass die Weiche das Gate nicht unterläuft.
- [ ] 3.5 **RED:** angemeldet, Merker `null`, Aufruf von `/mitglieder` → das Verzeichnis. Belegt, dass die Weiche **keine** Wand ist.
- [ ] 3.6 **RED:** Merker **lädt noch** → weder Strecke noch Inhalt der Startseite. Ein Test, der den Merker vorbelegt, wäre vorher wie nachher grün und prüfte diesen Zustand nie.
- [ ] 3.7 **RED:** Lesen des Merkers **schlägt fehl** → Startseite, **keine** Umleitung. Ein Netzfehler darf niemanden in die Strecke werfen.
- [ ] 3.8 **RED:** Merker gerade gesetzt, Navigation auf `/` → **keine** Rückkehr in die Strecke. Der gelesene Zustand muss vor der Navigation nachziehen.
- [ ] 3.9 **GREEN:** `HomeRedirect` entscheidet wieder — drei Zustände (lädt / Fehler / fertig), `isActivated === true` ausdrücklich.
- [ ] 3.10 Der Kommentarkopf von `HomeRedirect.tsx` sagt heute „entscheidet endgültig nichts mehr". Er wird Teil des Diffs und muss die neue Wahrheit sagen.

## 4. Die Strecke — Gerüst, Nutzenerklärung, zwei Auswege

- [ ] 4.1 Route `/willkommen` in `App.tsx`, außerhalb der `AppShell`, hinter `RequireAuth` + `ActivationGate` — wie `/onboarding` (`App.tsx:176-190`). **Kein** Eintrag in `NARROW_ROUTES`: die Liste wird in `AppShell.tsx:268` *innerhalb* der Shell gelesen und wäre hier wirkungslos.
- [ ] 4.2 **RED → GREEN:** Vor dem ersten Schritt steht die Nutzenerklärung, und sie spricht vom Mitglied, nicht von der Plattform.
- [ ] 4.3 **RED → GREEN:** **Vertagen** auf **jedem** Schritt → Startseite, Merker **nicht** gesetzt, Strecke erscheint beim nächsten Aufruf von `/` wieder. Je Schritt ein Fall, nicht nur der erste.
- [ ] 4.4 **RED → GREEN:** **Überspringen** auf **jedem** Schritt → Hinweis erscheint zuerst, danach Startseite und Merker gesetzt.
- [ ] 4.5 **RED → GREEN:** Der Hinweis benennt den Kompass-Filter als das, was ohne Kategorien fehlt. Kein Drohton — die Zusicherung prüft den Text, nicht nur seine Existenz.
- [ ] 4.6 **RED → GREEN:** Abschluss des letzten Schritts setzt den Merker.
- [ ] 4.7 **RED:** Konto mit gesetztem Profilbild **und** Standort — der Fortschritt nennt **zwei** Schritte, nicht drei, und die Strecke endet nach dem zweiten. Ein Test gegen eine feste Drei wäre vorher wie nachher grün.
- [ ] 4.8 **RED → GREEN:** Wiederkehr beginnt beim **ersten leeren Feld**, nicht wieder beim ersten Schritt.
- [ ] 4.9 Kein `useOverlay`, kein Portal, kein Scroll-Lock — eine Seite, keine Schicht.

## 5. Schritt 1 — Berufsbezeichnung (feldbezogen schreiben)

- [ ] 5.1 **RED → GREEN:** vorhandene `headline` erscheint als vorbelegter Wert; der Text des Schritts ist bestätigend statt fragend. Leere `headline` → fragender Text, leeres Feld.
- [ ] 5.2 **RED:** Ein Konto mit hinterlegten Interessen **und** gefüllter Kontaktzeile schließt den Schritt ab — Interessen und Kontaktzeile sind danach **unverändert**. Der Test muss gegen einen `saveProfile`-Aufruf **rot** werden: `profile.ts:303` schreibt alle Profilspalten, upsertet `profile_contacts` bedingungslos und ersetzt `profile_interests` und `profile_goals` vollständig.
- [ ] 5.3 **GREEN:** feldbezogenes `update({ headline })` auf `id = auth.uid()`. Aus `profile.ts` wird **nur** der Bild-Upload wiederverwendet.
- [ ] 5.4 **RED → GREEN:** Abbruch **nach** dem Weitergehen lässt den Wert stehen.

## 6. Schritt 2 — Kompass-Kategorien (der eigentliche Zweck)

- [ ] 6.1 **RED → GREEN:** Die Chips kommen aus `categoryOptionsForSide` für beide Seiten. Keine zweite Kategorienliste, kein kopiertes Vokabular — `config/compass.ts` ist die einzige Quelle. **Keine** feste Gesamtzahl zusichern: sechs je Seite, elf verschiedene Werte, `immobilien` auf beiden.
- [ ] 6.2 **RED:** Eine bereits gesetzte Kategorie ist **nicht bedienbar**. Der Test klickt sie an und erwartet, dass nichts gelöscht wird. Muss gegen eine normal abwählbare Chip-Reihe rot werden.
- [ ] 6.3 **RED:** Ein Konto mit einem vorhandenen Eintrag `source = 'editor'` samt Beschreibung, Tags und Volumenband durchläuft den Schritt; alle drei stehen danach **unverändert**. Das ist die Falle aus dem Kopf von `profile-categories.ts`.
- [ ] 6.4 **GREEN:** Schreiben ausschließlich über `saveCategorySelection`, rein additiv. Kein eigener Schreibpfad, keine Kopie der Abgleichsregeln. `ConfirmationRequiredError` kann damit nicht entstehen — nicht aus Gewohnheit, sondern weil die Oberfläche das Abwählen nicht anbietet.
- [ ] 6.5 **RED → GREEN:** Eine gewählte Kategorie macht das Mitglied im **Kategorienfilter des Verzeichnisses** auffindbar. Das ist die Abnahme für diesen Schritt — `profile_completion` ist es ausdrücklich **nicht** (proposal.md, Befund 2).
- [ ] 6.6 Freitext: eigener Lesepfad für `offers.description` / `needs.description` — `fetchCategorySelection` lädt **keine** Beschreibungen. Festlegen und testen: je Seite, Zeilen **ohne** Kategorie eingeschlossen, mehrere Zeilen als Liste. Ein Test je Fall, plus einer für „kein Freitext → kein Platzhalter".

## 7. Schritt 3 — Profilbild und Standort

- [ ] 7.1 **RED → GREEN:** Nur das **leere** Feld erscheint; ist eines gesetzt, fehlt es im Schritt.
- [ ] 7.2 Bild-Upload über den vorhandenen Weg aus `profile.ts`. In privaten Buckets **`upsert: false`** — `upsert: true` scheitert an der SELECT-Policy, und der Fehler zeigt fälschlich auf die RLS.
- [ ] 7.3 `region` ist ein **Freitextfeld** (`ProfileFieldsets.tsx:46`, `<Input {...register("region")}>`). **Keine** Auswahlliste erfinden — es gibt keine abgenommene Liste der FBC-Standorte. In der Strecke **ohne** die `min(1)`-Pflicht aus `profile.ts:38`: hier wird ergänzt, nicht validiert.
- [ ] 7.4 **RED → GREEN:** feldbezogenes Schreiben wie in 5.3, mit derselben Gegenprobe auf unberührte Kindtabellen.

## 8. Tests, die nichts prüfen — Gegenprobe

- [ ] 8.1 Kein `vi.mock` auf eigene Komponenten. Gemockt wird **nur** der Rand zur Datenbank.
- [ ] 8.2 Für jeden als RED markierten Test belegen, dass er gegen den **alten** Stand rot wird — alte Fassung zurückspielen, Suite laufen lassen, Zahl notieren. Behauptet, nicht gemessen, zählt nicht.
- [ ] 8.3 Kein Test, der einen Zustand **vorbelegt**, wo die App ihn erst nach dem Mount bekommt. `useState(wert)` nimmt einen später eintreffenden Wert nie an — der Fall, der in AGE-540 grün war und live falsch. Betrifft hier besonders 3.6.

## 9. Datenbank-Sonde (Nachweis statt Zusage)

- [ ] 9.1 `scripts/probe-…-onboarding-merker.ts` nach dem Muster von `probe-9-kopfzeilensuche-rls.ts`: Wegwerf-Konten in einer **zurückgerollten** Transaktion, gegen den **lokalen** Stack. Belegt: eigene Zeile schreibbar; fremde Zeile → **null geänderte Zeilen und der Fremdwert unverändert**; `anon` → `42501`.
- [ ] 9.2 Belegt zusätzlich, dass ein Mitglied ab `discover` beim Lesen eines fremden Kontos den Merker **nicht** sieht. Das ist der Grund für `member_settings` statt `profiles` und gehört nachgewiesen, nicht behauptet.
- [ ] 9.3 Jede Null zurechenbar machen — dasselbe Konto, ein Zustand geändert, anderes Ergebnis.

## 10. Sichtprobe im Browser (UI-Gate)

- [ ] 10.1 Lokal starten und die Strecke **durchspielen** — nicht Screenshots einzelner Schritte. Grüne Tests haben in AGE-492 ein visuell falsches Ergebnis durchgewunken.
- [ ] 10.2 Mit einem Konto **ohne** und einem **mit** vorbelegten Feldern. Demo-Logins stehen in der Übergabe.
- [ ] 10.3 **375 px** und Schreibtisch. Am Inhaltsbedarf messen, nicht an `scrollWidth` — der meldete in AGE-540 „passt" bei 339 px echtem Bedarf.
- [ ] 10.4 Beide Themes (`hell` und `navy`, Schalter in `/einstellungen`).
- [ ] 10.5 Vertagen, abmelden, neu anmelden → die Strecke kommt wieder und beginnt beim ersten leeren Feld.
- [ ] 10.6 Überspringen, abmelden, **in einem anderen Browser** anmelden → die Strecke kommt nicht wieder. Das ist der Test, den `localStorage` nicht bestünde.
- [ ] 10.7 Den Hinweis vor dem Überspringen lesen und beurteilen, ob er einlädt statt zu drohen. Das entscheidet kein Test.

## 11. Abschluss

- [ ] 11.1 Code-Review auf den **Diff** (Schritt 4), unabhängig vom Plan-Review.
- [ ] 11.2 `pnpm test`, `tsc`, Lint. `pnpm format:check` meldet 111 vorbestehende Dateien — nicht als Befund melden und **nie** `pnpm format`.
- [ ] 11.3 `openspec validate --all` grün, dann archivieren — **vor** dem PR.
- [ ] 11.4 Branch `donald/age-538-…`, PR, CI auf der **HEAD-SHA** prüfen (nicht `gh run list`), Merge über `gh pr view --json state` verifizieren.
- [ ] 11.5 Migration anwenden ist ein **eigener** Schritt: der Merge wendet sie nicht an. Danach greift das `drift-gate` — den Deploy per `gh run rerun --failed` nachziehen.
- [ ] 11.6 Live-Beleg an einer Zeichenkette aus dem Diff, nicht an der Bundle-Größe.
- [ ] 11.7 Linear: Kommentar mit den Prämissen-Korrekturen (Einstieg beim Aufruf von `/` statt nach dem Passwortsetzen · `profile_completion` steigt durch Schritt 2 nicht · zwei Auswege statt einem), damit die Abnahmeliste des Issues nicht gegen unerfüllbare Punkte gehalten wird.
