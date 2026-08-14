## 1. Plan-Review — erledigt, steht vor allem anderen

- [x] 1.1 Plan-Review (Schritt 2b): zwei Reviewer anderer Anbieter (gemini, codex), Ergebnis in `REVIEWS.md`. Beide REQUEST-CHANGES, 4 HIGH und 7 MEDIUM.
- [x] 1.2 Fünf Tatsachenbehauptungen vor der Übernahme an der Platte nachgeprüft: `saveProfile` schreibt alles (**bestätigt**) · `profiles_select_self_or_discover` = `has_level(3)` (**bestätigt**) · `region` ist Freitext (**bestätigt**) · `NARROW_ROUTES` wirkt nur in der Shell (**bestätigt**) · Index gegen Full Table Scan (**widerlegt**, der Zugriff ist ein Primärschlüsseltreffer).
- [x] 1.3 Befunde eingearbeitet; die Produktfrage (ein Ausweg oder zwei) an Donald entschieden — zwei Auswege plus Nutzenerklärung.
- [x] 1.4 Ausgangslinie festgehalten, gemessen am 2026-08-14 auf `deb6b7e`: **795 Tests in 104 Dateien, alle grün** (`pnpm test`, 7,96 s). Am Ende ist „+n neue Tests" gegen diese Zahl zu belegen.

## 2. Der Merker in `member_settings`

- [x] 2.1 Migration: `alter table public.member_settings add column onboarded_at timestamptz;` mit Entscheidungskopf — warum **nicht** in `profiles` (`profiles_select_self_or_discover` gibt ab `discover` fremde Vollzeilen frei), warum Spalte statt `localStorage`, warum ein Merker für „beendet" und keiner für „vertagt".
- [x] 2.2 **Kein** neuer Grant und **keine** neue Policy — und das gehört in den Kopf, nicht ins Schweigen. `member_settings` trägt `grant select, insert, update` auf Tabellenebene (`20260630130000:17`) und `member_settings_own` (`for all`). Muster: `20260804120000_member_settings_theme.sql`.
- [x] 2.3 Gegenprobe gelaufen (`npx supabase test db` mit den drei pgTAP-Dateien, ohne die elf `probe_*.sql`): `grants_test.sql` **ok**, vor und nach der Migration. Die Annahme aus 2.2 hält — Tabellen-Grant, kein Snapshot-Bruch.
- [x] 2.4 **RED → GREEN** in pgTAP: Ein Konto setzt den Merker auf der **eigenen** Zeile (gelingt). Ein Konto setzt ihn auf einer **fremden** — erwartet wird **`OK` mit null geänderten Zeilen**, **nicht** `42501`: `member_settings_own` filtert die fremde Zeile über `USING` heraus, und PostgreSQL führt das Statement erfolgreich aus. Anschließend den unveränderten Fremdwert nachlesen — ohne diese Nachlese belegt „null Zeilen" nichts. `42501` nur für `anon` erwarten, wo das Recht fehlt.
- [x] 2.5 **RED → GREEN:** Ein Konto **ohne** Einstellungszeile beendet die Strecke → die Zeile existiert danach und trägt den Merker. Der Schreibweg ist ein `upsert`; ein `update` änderte null Zeilen und meldete dabei keinen Fehler.
- [x] 2.6 `database.types.ts` — **die Aufgabe stand auf einer falschen Annahme.** Eine Neugenerierung bringt nicht „nur die eine Spalte": `npx supabase gen types --local` schreibt die Datei still um (Semikolons weg) und markiert rund fünfzig Spalten als non-null, die legitim `null` tragen (`avatar_url`, `region`, `short_bio`, `member_a_name` …). Die Datei sagt das in ihren eigenen Kommentaren und ist **von Hand gepflegt**. Gemessen statt geraten: generiert und gegen den eingecheckten Stand diffed, inhaltlich einziger Schemaunterschied ist `onboarded_at`. Die drei Zeilen (Row/Insert/Update) sind deshalb von Hand ergänzt, der Werkzeug-Drift bleibt draußen.
- [x] 2.7 pgTAP-Fallen: `alike()` statt `like()`; `try_as()` meldet jeden Fehler als DENIED — bei einer Überraschung den echten Fehler suchen, nicht die Zusicherung anpassen.

## 3. Die Weiche in `HomeRedirect` (die riskanteste Stelle)

- [x] 3.1 **RED:** Über `<App />` an `/`, angemeldet, aktiviert, Merker `null` → die Strecke erscheint. Muss gegen den heutigen Stand rot werden (`HomeRedirect` rendert heute unbedingt `HomePage`).
- [x] 3.2 **RED:** derselbe Aufbau mit gesetztem Merker → Startseite, **keine** Umleitung.
- [x] 3.3 **RED:** **ausgeloggt** an `/` → öffentliche Startseite. Ohne diesen Test schlägt die Falle aus `ActivationRedeemPage.tsx:129-135` erneut zu: für einen Ausgeloggten meldet das System „aktiviert".
- [x] 3.4 **RED:** angemeldet, **nicht** aktiviert → Aktivierungsbildschirm. Belegt, dass die Weiche das Gate nicht unterläuft.
- [x] 3.5 **RED:** angemeldet, Merker `null`, Aufruf von `/mitglieder` → das Verzeichnis. Belegt, dass die Weiche **keine** Wand ist.
- [x] 3.6 **RED:** Merker **lädt noch** → weder Strecke noch Inhalt der Startseite. Ein Test, der den Merker vorbelegt, wäre vorher wie nachher grün und prüfte diesen Zustand nie.
- [x] 3.7 **RED:** Lesen des Merkers **schlägt fehl** → Startseite, **keine** Umleitung. Ein Netzfehler darf niemanden in die Strecke werfen.
- [x] 3.8 **RED:** Merker gerade gesetzt, Navigation auf `/` → **keine** Rückkehr in die Strecke. Der gelesene Zustand muss vor der Navigation nachziehen.
- [x] 3.9 **GREEN:** `HomeRedirect` entscheidet wieder — drei Zustände (lädt / Fehler / fertig), `isActivated === true` ausdrücklich.
- [x] 3.10 Der Kommentarkopf von `HomeRedirect.tsx` sagt heute „entscheidet endgültig nichts mehr". Er wird Teil des Diffs und muss die neue Wahrheit sagen.

## 4. Die Strecke — Gerüst, Nutzenerklärung, zwei Auswege

- [x] 4.1 Route `/willkommen` in `App.tsx`, außerhalb der `AppShell`, hinter `RequireAuth` + `ActivationGate` — wie `/onboarding` (`App.tsx:176-190`). **Kein** Eintrag in `NARROW_ROUTES`: die Liste wird in `AppShell.tsx:268` *innerhalb* der Shell gelesen und wäre hier wirkungslos.
- [x] 4.2 **RED → GREEN:** Vor dem ersten Schritt steht die Nutzenerklärung, und sie spricht vom Mitglied, nicht von der Plattform.
- [x] 4.3 **RED → GREEN:** **Vertagen** auf **jedem** Schritt → Startseite, Merker **nicht** gesetzt, Strecke erscheint beim nächsten Aufruf von `/` wieder. Je Schritt ein Fall, nicht nur der erste.
- [x] 4.4 **RED → GREEN:** **Überspringen** auf **jedem** Schritt → Hinweis erscheint zuerst, danach Startseite und Merker gesetzt.
- [x] 4.5 **RED → GREEN:** Der Hinweis benennt den Kompass-Filter als das, was ohne Kategorien fehlt. Kein Drohton — die Zusicherung prüft den Text, nicht nur seine Existenz.
- [x] 4.6 **RED → GREEN:** Abschluss des letzten Schritts setzt den Merker.
- [x] 4.7 **RED:** Konto mit gesetztem Profilbild **und** Standort — der Fortschritt nennt **zwei** Schritte, nicht drei, und die Strecke endet nach dem zweiten. Ein Test gegen eine feste Drei wäre vorher wie nachher grün.
- [x] 4.8 **RED → GREEN:** Wiederkehr beginnt beim **ersten leeren Feld**, nicht wieder beim ersten Schritt.
- [x] 4.9 Kein `useOverlay`, kein Portal, kein Scroll-Lock — eine Seite, keine Schicht.

## 5. Schritt 1 — Berufsbezeichnung (feldbezogen schreiben)

- [x] 5.1 **RED → GREEN:** vorhandene `headline` erscheint als vorbelegter Wert; der Text des Schritts ist bestätigend statt fragend. Leere `headline` → fragender Text, leeres Feld.
- [x] 5.2 **RED:** Ein Konto mit hinterlegten Interessen **und** gefüllter Kontaktzeile schließt den Schritt ab — Interessen und Kontaktzeile sind danach **unverändert**. Der Test muss gegen einen `saveProfile`-Aufruf **rot** werden: `profile.ts:303` schreibt alle Profilspalten, upsertet `profile_contacts` bedingungslos und ersetzt `profile_interests` und `profile_goals` vollständig.
- [x] 5.3 **GREEN:** feldbezogenes `update({ headline })` auf `id = auth.uid()`. Aus `profile.ts` wird **nur** der Bild-Upload wiederverwendet.
- [x] 5.4 **RED → GREEN:** Abbruch **nach** dem Weitergehen lässt den Wert stehen.

## 6. Schritt 2 — Kompass-Kategorien (der eigentliche Zweck)

- [x] 6.1 **RED → GREEN:** Die Chips kommen aus `categoryOptionsForSide` für beide Seiten. Keine zweite Kategorienliste, kein kopiertes Vokabular — `config/compass.ts` ist die einzige Quelle. **Keine** feste Gesamtzahl zusichern: sechs je Seite, elf verschiedene Werte, `immobilien` auf beiden.
- [x] 6.2 **RED:** Eine bereits gesetzte Kategorie ist **nicht bedienbar**. Der Test klickt sie an und erwartet, dass nichts gelöscht wird. Muss gegen eine normal abwählbare Chip-Reihe rot werden.
- [x] 6.3 **RED:** Ein Konto mit einem vorhandenen Eintrag `source = 'editor'` samt Beschreibung, Tags und Volumenband durchläuft den Schritt; alle drei stehen danach **unverändert**. Das ist die Falle aus dem Kopf von `profile-categories.ts`.
- [x] 6.4 **GREEN:** Schreiben ausschließlich über `saveCategorySelection`, rein additiv. Kein eigener Schreibpfad, keine Kopie der Abgleichsregeln. `ConfirmationRequiredError` kann damit nicht entstehen — nicht aus Gewohnheit, sondern weil die Oberfläche das Abwählen nicht anbietet.
- [ ] 6.5 **Teilweise.** Der Vitest belegt, dass die gewählte Kategorie über `saveCategorySelection` **geschrieben** wird — mehr kann er nicht: der Kategorienfilter des Verzeichnisses ist eine Datenbankabfrage. Die eigentliche Abnahme steht deshalb offen und gehört in die Sichtprobe (10.x) bzw. an die Sonde. `profile_completion` ist die Abnahme ausdrücklich **nicht** (proposal.md, Befund 2).
- [x] 6.6 Freitext: eigener Lesepfad für `offers.description` / `needs.description` — `fetchCategorySelection` lädt **keine** Beschreibungen. Festlegen und testen: je Seite, Zeilen **ohne** Kategorie eingeschlossen, mehrere Zeilen als Liste. Ein Test je Fall, plus einer für „kein Freitext → kein Platzhalter".

## 7. Schritt 3 — Profilbild und Standort

- [x] 7.1 **RED → GREEN:** Nur das **leere** Feld erscheint; ist eines gesetzt, fehlt es im Schritt.
- [x] 7.2 Bild-Upload über den vorhandenen Weg aus `profile.ts`. In privaten Buckets **`upsert: false`** — `upsert: true` scheitert an der SELECT-Policy, und der Fehler zeigt fälschlich auf die RLS.
- [x] 7.3 `region` ist ein **Freitextfeld** (`ProfileFieldsets.tsx:46`, `<Input {...register("region")}>`). **Keine** Auswahlliste erfinden — es gibt keine abgenommene Liste der FBC-Standorte. In der Strecke **ohne** die `min(1)`-Pflicht aus `profile.ts:38`: hier wird ergänzt, nicht validiert.
- [x] 7.4 **RED → GREEN:** feldbezogenes Schreiben wie in 5.3, mit derselben Gegenprobe auf unberührte Kindtabellen.

## 8. Tests, die nichts prüfen — Gegenprobe

- [x] 8.1 Kein `vi.mock` auf eigene Komponenten. Gemockt sind ausschließlich `lib/member-onboarding`, `lib/member-settings`, `lib/profile-categories`, `lib/profile` und `lib/dashboard` — allesamt der Rand zur Datenbank. Gerendert wird über `<App />`, nicht die Seite isoliert.
- [x] 8.2 **Gemessen, nicht behauptet.** Der „alte Stand" trägt hier nicht: gegen ihn ist nur 3.1 rot, weil `HomeRedirect` unbedingt `HomePage` rendert und alle übrigen Zusagen Abwesenheiten prüfen, die vorher trivial gelten. Belegt wurde deshalb das, worauf es ankommt — jede Zusage einzeln verbogen und die Suite gemessen (Basis 24 bzw. 10 grün):

      | Verbiegung | Ergebnis |
      |---|---|
      | Chip einer gesetzten Kategorie abwählbar machen | 1 rot |
      | Schrittzahl fest auf drei | 1 rot |
      | Merker erst NACH der Navigation nachziehen (`invalidateQueries` statt `setQueryData`) | 5 rot |
      | Einstieg immer bei Schritt 1 | 1 rot |
      | Überspringen ohne Hinweis | 4 rot |
      | Kategorien ersetzend statt additiv | 1 rot |
      | `saveProfile` statt feldbezogenem `update` | 2 rot |
      | Ladezustand dem Startseiten-Zweig zuschlagen | 1 rot |
      | Lesefehler wie fehlenden Merker behandeln | 1 rot |
      | Ausgeloggte nicht ausnehmen | 1 rot |

      Zwei Verbiegungen blieben zunächst **grün**, und beide waren ein echter Befund: die eine war eine wirkungslose Mutation (`data === null` trifft `undefined` nicht), die andere ein **rennender Test** — 3.6 prüfte die Abwesenheit einer Fehlermeldung, die ohnehin erst einen Tick später erscheint. Er prüft jetzt, dass die Dashboard-Abfrage gar nicht erst startet: synchron, also wahr oder falsch statt schnell oder langsam.
- [x] 8.3 Kein Test, der einen Zustand **vorbelegt**, wo die App ihn erst nach dem Mount bekommt. Baulich abgesichert statt nur geprüft: `WillkommenPage` montiert die Strecke erst, wenn Profil, Kategorien und Freitext gelesen sind — `useState(wert)` nähme einen später eintreffenden Wert nie an. Für 3.6 siehe 8.2.

## 9. Datenbank-Sonde (Nachweis statt Zusage)

- [x] 9.1 `scripts/probe-…-onboarding-merker.ts` nach dem Muster von `probe-9-kopfzeilensuche-rls.ts`: Wegwerf-Konten in einer **zurückgerollten** Transaktion, gegen den **lokalen** Stack. Belegt: eigene Zeile schreibbar; fremde Zeile → **null geänderte Zeilen und der Fremdwert unverändert**; `anon` → `42501`.
- [x] 9.2 Belegt zusätzlich, dass ein Mitglied ab `discover` beim Lesen eines fremden Kontos den Merker **nicht** sieht. Das ist der Grund für `member_settings` statt `profiles` und gehört nachgewiesen, nicht behauptet.
- [x] 9.3 Jede Null zurechenbar machen — dasselbe Konto, ein Zustand geändert, anderes Ergebnis.

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
