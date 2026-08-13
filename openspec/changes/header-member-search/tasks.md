## 1. Plan-Review — erledigt, steht vor allem anderen

- [x] 1.1 Ausgangslinie **744 Fälle in 103 Dateien**; nach diesem Change **787 in 104** (+43 neue, keine geänderte Zusicherung).
- [x] 1.2 Plan-Review (Schritt 2b): zwei Reviewer anderer Anbieter, Ergebnis in `REVIEWS.md`. Beide REQUEST-CHANGES, fünf HIGH.
- [x] 1.3 Alle Befunde angenommen und in Proposal, Design und Delta eingearbeitet. Fünf Tatsachenbehauptungen der Reviewer wurden vorher an der Platte nachgeprüft und bestätigt (React 19.2.8 · `useOverlay` ohne Escape/Anfangsfokus · ein globaler `QueryClient` ohne `clear()` · `directoryQueryKey` ohne Nutzerkennung · `/mitglieder` hinter `MembershipGate min="discover"`).

## 2. Begriffsübernahme ans Verzeichnis (zuerst, weil riskantester Teil)

- [x] 2.1 **RED:** Test, der `MemberDirectory` mit **gesetztem** Suchparameter aufbaut und die RPC-Aufrufe aufzeichnet — es SOLL **keine** Abfrage ohne Suchbegriff laufen, und die erste Abfrage SOLL den Begriff tragen. Muss rot werden.
- [x] 2.2 **RED:** Test, der die Komponente mit leerem Parameter aufbaut und den Parameter **danach** ändert; Suchfeld und Trefferabfrage ziehen nach. Ein Test, der den Parameter vorbelegt, wäre vorher wie nachher grün.
- [x] 2.3 **RED:** Test, der denselben Begriff erneut abschickt, **nachdem** im Verzeichnis lokal weitergetippt wurde — die Suche springt auf den abgeschickten Begriff zurück. Belegt, dass die Übernahme am Navigationsereignis hängt und nicht am Wert.
- [x] 2.4 **GREEN:** `MemberDirectory` bezieht Suchtext und Filterzustand beim Aufbau **synchron** aus der Adresszeile; ein Effekt zieht bei **späteren** Navigationsereignissen **nur** den Suchtext nach, und die vorhandene Entprellung bleibt der einzige Weg zu `filters.query`. Das Verzeichnis schreibt beim Tippen **nicht** in die Adresszeile zurück.
- [x] 2.5 Test: ein Wechsel des Suchbegriffs wirft die übrigen Filter (Branche, Region, Kompass-Kategorien) **nicht** weg.
- [x] 2.6 Test: der Zurück-Weg führt zur vorigen Suche (Push, nicht Replace).

## 3. HeaderSearch — Suchen und Anzeigen

- [x] 3.1 **RED:** `HeaderSearch.test.tsx` mit falschen Zeitgebern — ein getrimmtes Zeichen fragt nicht ab; zwei fragen nach 300 ms genau einmal ab; schnelles Tippen ergibt eine Abfrage mit dem letzten Text; höchstens fünf Treffer.
- [x] 3.2 **RED:** Weitertippen bei angezeigter Liste blendet die Treffer **und die Hervorhebung** des vorigen Begriffs aus; unter zwei getrimmten Zeichen leert die Liste sofort. Ohne diesen Test öffnet Enter im Zweifel ein Mitglied, das nicht mehr zur Eingabe passt.
- [x] 3.3 **GREEN:** `src/components/search/HeaderSearch.tsx` — Eingabe, Entprellung, Abfrage über das bestehende `searchDirectory`. Die Trefferzeile bildet ihre Einordnung aus `company`/`roles`/`branche`/`short_bio`; **kein** Feld „Berufsbezeichnung" erfinden, der Rückgabetyp hat keins.
- [x] 3.4 **RED → GREEN:** Auswahl eines Treffers öffnet dessen Profil. Enter ohne Hervorhebung führt ab `discover` auf `/mitglieder` mit dem Begriff in der Adresszeile — **und darunter auf `/mitgliedschaft`**, weil `/mitglieder` hinter dem Stufen-Gate liegt und den Begriff sonst verschluckt. Eigener Test je Weg, „alle Ergebnisse" eingeschlossen.
- [x] 3.5 Nur der Rand zur Datenbank wird gemockt. Kein `vi.mock` auf eigene Komponenten.

## 4. Die fünf Zustände

- [x] 4.1 **RED → GREEN:** Treffer vorhanden — Liste erscheint.
- [x] 4.2 **RED → GREEN:** **Fehler** (Netz, abgelaufene Sitzung, `42501`) — eigener Fehlerzustand, **weder** „nichts gefunden" **noch** Aufstiegs-Hinweis.
- [x] 4.3 **RED → GREEN:** echter Nulltreffer ab `discover` — benannte Meldung samt Weg ins Verzeichnis, keine leere Liste.
- [x] 4.4 **RED → GREEN:** unterhalb `discover` **und** erfolgreich leer — Aufstiegs-Hinweis mit Nennung der Stufe und Link auf `/mitgliedschaft`. Die Unterscheidung fällt erst **nach** einer erfolgreichen Antwort.
- [x] 4.5 **RED → GREEN:** unterhalb `discover`, aber die Abfrage liefert die **eigene** Zeile — dieser Treffer wird normal gezeigt. Belegt, dass der Rang nur den leeren Fall formuliert und keine zweite Zugriffskontrolle ist.
- [x] 4.6 **RED → GREEN:** ausgeloggt — weder Suchfeld noch Lupensymbol, in beiden Breitenbereichen. `HeaderSearch` steht **innerhalb** des `user ? … :`-Zweigs.

## 5. Identität und Zwischenspeicher

- [x] 5.1 **RED:** Test, der als Konto A sucht, abmeldet, als Konto B anmeldet und dasselbe Wort sucht — es erscheinen **keine** Treffer aus dem Zwischenspeicher von A.
- [x] 5.2 **RED:** Test, der abmeldet, **während** eine Abfrage unterwegs ist bzw. die Entprellung noch läuft — Einstieg und Liste verschwinden, kein Ergebnis dieser Abfrage erscheint noch.
- [x] 5.3 **GREEN:** eigener Zwischenspeicher-Schlüssel für die Kopfzeilen-Suche, mit `user.id`; `enabled` defensiv; laufende Suchen beim Identitätswechsel verwerfen und entfernen. Das gekürzte Ergebnis **nie** unter `directoryQueryKey` ablegen.
- [x] 5.4 Im Code benennen, dass dies die Lücke nur für diesen Einstieg schließt und die allgemeine Fassung AGE-258 in `finish-ui-polish` ist. Sonst liest der Nächste die Trennung als erledigt.

## 6. Tastatur, Auszeichnung, Schließen

- [x] 6.1 **RED → GREEN:** ↓ hebt hervor, Enter öffnet den hervorgehobenen Treffer; ↑ wandert zurück.
- [x] 6.2 **RED → GREEN:** Escape schließt die Liste, der Fokus bleibt im Feld.
- [x] 6.3 **RED → GREEN:** Feld und Liste sind als zusammengehörige Auswahl ausgezeichnet, der hervorgehobene Treffer ist als der aktive benannt.
- [x] 6.4 **RED → GREEN:** die Liste schließt bei Auswahl, beim Weg ins Verzeichnis, bei Klick außerhalb und bei jedem Routenwechsel. `AppShell` wird beim Navigieren nicht neu aufgebaut — ohne diese Regel steht die Liste über der Zielseite. Auf die Reihenfolge achten: die Auswahl muss ankommen, bevor das Schließen greift.

## 7. Telefon-Fassung

- [x] 7.1 **RED → GREEN:** unterhalb der Umbruchbreite öffnet ein Lupensymbol die Suche; sie ist beschreibbar und liefert dieselben Treffer.
- [x] 7.2 **GREEN:** die Fassung nutzt `useOverlay` für Sperre und Tab-Falle und regelt **selbst**, was der Hook nicht mitbringt: Anfangsfokus ins Feld, Escape, Schließen über den Hintergrund, Fokusrückgabe ans Lupensymbol.
- [x] 7.3 **RED → GREEN:** Überschreiten der Umbruchbreite nach oben schließt die Fassung. Ohne das versteckt CSS sie und die Scroll-Sperre bleibt stehen — eine Seite, die sich nicht mehr scrollen lässt.
- [x] 7.4 Die Trefferliste wird absolut zum Feld positioniert, nicht fix zum Fenster.

## 8. Einbau in den Rahmen

- [x] 8.1 Das tote `<input>` in `AppShell.tsx:407-419` entfällt; `HeaderSearch` entsteht **innerhalb** des `user ? … :`-Zweigs — **nicht** an der Stelle des toten Feldes, die außerhalb liegt. Ein wörtliches „ersetzen" verletzte Aufgabe 4.6. Nichts daneben anfassen.
- [x] 8.2 `pnpm test` vollständig; Zahl gegen 1.1 halten. `pnpm lint`, `pnpm format:check` — **nie** `pnpm format`.

## 9. Nachweis an der Datenbank

- [ ] 9.1 Ein nicht aktiviertes Konto ruft `search_directory` mit einem Begriff auf, der auf mehrere Profile passt, und bekommt keine fremde Zeile. Gegen die Datenbank belegen (pgTAP oder roher Client), **nicht** in jsdom. Eigener Nachweis dieses Changes — `anon-anreicherung.test.ts` trägt ihn nicht (dessen Positivliste erfasst weder neue Dateien noch Funktionsaufrufe).
- [ ] 9.2 Gegenprobe im selben Lauf: ein aktiviertes Konto ab `discover` bekommt mit demselben Begriff Treffer. Ohne sie belegt 9.1 nur, dass die Abfrage nichts liefert.
- [ ] 9.3 Ausgeloggt belegen, dass `search_directory` mit `42501` abweist — die Tatsache, auf der „ausgeloggt kein Feld" beruht.

## 10. Sichtprobe im Browser

- [ ] 10.1 Angemeldet suchen: Treffer erscheinen, Auswahl öffnet das Profil, Enter landet auf `/mitglieder` mit gefüllter Suche.
- [ ] 10.2 Auf `/mitglieder` stehend **zweimal hintereinander verschieden** aus der Kopfzeile suchen, danach **denselben** Begriff nach lokalem Tippen erneut — die Fälle, die jsdom nicht sieht und die hier schon einmal grün und kaputt waren.
- [ ] 10.3 Breiten 320 px, 375 px, 640 px und Desktop über die Geräte-Emulation prüfen (macOS kann kein Fenster unter 500 px): Lupensymbol erscheint, Kopfzeile bricht nicht um, die Liste ist nicht abgeschnitten.
- [ ] 10.4 Telefon-Fassung öffnen und das Fenster **verbreitern** — sie schließt, die Seite scrollt wieder.
- [ ] 10.5 Ausgeloggt gegenprüfen: kein Feld, kein Lupensymbol, in allen geprüften Breiten.
- [ ] 10.6 Mit einem Konto unterhalb `discover` gegenprüfen: Aufstiegs-Hinweis im Dropdown, Enter führt auf `/mitgliedschaft`.

## 11. Abschluss

- [ ] 11.1 Code-Review auf dem **Diff** durch einen unabhängigen Leser (Schritt 4).
- [ ] 11.2 `openspec validate --all` grün; jede Aufgabe abgehakt mit einem Diff, der sie erfüllt.
- [ ] 11.3 **Vor** dem PR archivieren (`openspec archive header-member-search`), damit die gefaltete `openspec/specs/directory-search/spec.md` im geprüften Diff liegt.
- [ ] 11.4 Commit(s) auf dem Feature-Branch, Conventional Commit mit `(AGE-540)`; PR mit den Belegen aus 9.x und 10.x, nicht als Behauptung.
- [ ] 11.5 CI grün auf der HEAD-SHA prüfen (`check-runs`, nicht `run list`), mergen, Merge mit `gh pr view --json state` bestätigen.
- [ ] 11.6 Live belegen: Bundle-Name und Größe, plus eine Zeichenkette aus diesem Diff im ausgelieferten Bundle — Größe allein unterscheidet die Vorversion nicht.
- [ ] 11.7 AGE-540 in Linear: erst `get_issue` lesen, dann die widerlegten Annahmen als Kommentar hinterlassen — das Feld drängt auf dem Telefon nicht (es fehlt dort), „nur öffentliche Profile durchsuchen" ist kein vorhandener Weg, ausgeloggt ist nicht der einzige Leerfall, und Enter unterhalb `discover` kann nicht ins Verzeichnis führen.


## Belege zu den Gruppen 2-8

**Gruppe 2 (Begriffsübernahme).** Fünf Tests, alle zuerst rot:
`expected [ undefined ] to not include undefined` (ungefilterte Erstabfrage),
`expected '' to be 'beispiel'` (Nachziehen nach dem Aufbau), dreimal
`expected undefined to be …`. Danach grün. Der Facetten-Baseline-Aufruf ist
dabei **legitim** ungefiltert — die Tests unterscheiden ihn an der Form der
Argumente, nicht an der Zahl der Aufrufe.

**Gruppe 3-6 (HeaderSearch).** 31 Tests. Der erste Lauf war grün, und weil ein
„Modul nicht gefunden"-Rot ein schwacher Beleg ist, wurden zwei Schutzmaßnahmen
probeweise entfernt:

| Eingriff | Erwartet | Gemessen |
|---|---|---|
| Stufen-Weiche bei Enter aushebeln | rot | 🔴 `expected '/mitglieder?q=anna' to be '/mitgliedschaft'` |
| veraltete Treffer stehen lassen | rot | 🟢 **grün — der Test prüfte das Falsche** |

Der zweite Befund ist der Ertrag dieser Probe: `offen` verbirgt die Liste
ohnehin, aber **Enter wirkt auch bei geschlossener Liste**, und `aktiv`
indiziert weiter in `liste`. Der nachgezogene Test „öffnet mit Enter nach dem
Weitertippen NICHT den alten Treffer" schlägt jetzt an —
`expected '/p/id-anna-beispiel' to be '/mitglieder?q=annab'`.

**Gruppe 5 (Identität).** Dieselbe Probe an der Kontenkennung im Schlüssel: alle
Komponententests blieben **grün**, weil `removeQueries` beim Identitätswechsel
sie verdeckt. Die Eigenschaft wird deshalb dort geprüft, wo sie entsteht —
`directory.test.ts`, und dort schlägt sie an
(`expected [ Array(3) ] to not deeply equal [ Array(3) ]`).

**Gruppe 8 (Einbau).** Drei Lint-Fehler aus eigenem Code behoben, und zwar
durch **Ableiten statt Effekten**: die Offen-Zustände tragen jetzt den
Location-Schlüssel, bei dem sie geöffnet wurden, und die Hervorhebung wird aus
der Länge der Trefferliste abgeleitet. Damit entfallen drei `useEffect` mit
synchronem `setState` — und das Schließen beim Navigieren ist keine Reaktion
mehr, sondern eine Eigenschaft. Das verwaiste `SearchIcon` in `AppShell` wurde
entfernt (Orphan dieses Changes).

`pnpm format` wurde **nicht** ausgeführt; formatiert wurden gezielt die sieben
Dateien dieses Changes, nachdem geprüft war, dass sie vorher sauber waren.
