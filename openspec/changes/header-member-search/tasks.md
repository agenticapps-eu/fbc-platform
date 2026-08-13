## 1. Vorlauf

- [ ] 1.1 `pnpm test` einmal vollständig laufen lassen und die Zahl bestandener Fälle notieren — die Ausgangslinie, gegen die am Ende gemessen wird.
- [ ] 1.2 Plan-Review (Schritt 2b): ≥2 Reviewer **anderer Anbieter** über proposal + design + Delta, Ergebnis in `REVIEWS.md`. Ausdrücklich ansetzen auf: (a) die Begriffsübernahme an ein bereits gemountetes `MemberDirectory`, (b) ob der Aufstiegs-Hinweis irgendwo als Zugriffskontrolle missverstanden werden kann, (c) ob „ausgeloggt kein Feld" eine Fläche übersieht. Reviewer-Zeitgrenze großzügig setzen — 300 s reichen hier fast nie.
- [ ] 1.3 Befunde einarbeiten oder je Befund begründen, warum nicht.

## 2. Begriffsübernahme ans Verzeichnis (zuerst, weil riskantester Teil)

- [ ] 2.1 **RED:** Test in `MemberDirectory.test.tsx`, der die Komponente mit leerem Suchparameter mountet, den Parameter **danach** auf einen Begriff ändert und erwartet, dass Suchfeld und Trefferabfrage nachziehen. Muss rot werden — ein Test, der den Parameter vorbelegt, wäre vorher wie nachher grün.
- [ ] 2.2 **GREEN:** `MemberDirectory` liest den Suchbegriff aus der Adresszeile als fortlaufende Quelle (Effekt auf den Parameter), nicht als Anfangswert von `useState`. Entprellung und übrige Filter bleiben unangetastet.
- [ ] 2.3 Test nachschieben: ein Wechsel des Parameters wirft die übrigen Filter (Branche, Region, Kompass-Kategorien) **nicht** weg.

## 3. HeaderSearch — Suchen und Anzeigen

- [ ] 3.1 **RED:** Testdatei `HeaderSearch.test.tsx` mit falschen Zeitgebern — ein Zeichen fragt nicht ab; zwei Zeichen fragen nach 300 ms genau einmal ab; schnelles Tippen ergibt eine Abfrage mit dem letzten Text; höchstens fünf Treffer erscheinen mit Avatarbild, Name und Berufsbezeichnung.
- [ ] 3.2 **GREEN:** `src/components/search/HeaderSearch.tsx` — Eingabe, Entprellung, Abfrage über das bestehende `searchDirectory`. Keine neue RPC, kein neuer Lib-Umbau über eine dünne „erste N Treffer"-Funktion hinaus.
- [ ] 3.3 **RED → GREEN:** Auswahl eines Treffers öffnet dessen Profil; Enter ohne Hervorhebung führt auf `/mitglieder` mit dem Begriff in der Adresszeile.
- [ ] 3.4 Nur der Rand zur Datenbank wird gemockt. Kein `vi.mock` auf eigene Komponenten — ein Test, der `HeaderSearch` mockt, prüft den Mock.

## 4. Die vier Zustände

- [ ] 4.1 **RED → GREEN:** Treffer vorhanden — Liste erscheint.
- [ ] 4.2 **RED → GREEN:** echter Nulltreffer ab `discover` — benannte Meldung samt Weg ins Verzeichnis, keine leere Liste.
- [ ] 4.3 **RED → GREEN:** Konto unterhalb `discover` — Aufstiegs-Hinweis mit Nennung der nötigen Stufe und Link auf `/mitgliedschaft`; **keine** „nichts gefunden"-Meldung. Die Abfrage läuft trotzdem, und ein zurückkommendes eigenes Profil wird gezeigt: der Rang formuliert nur den leeren Fall, er sperrt nichts.
- [ ] 4.4 **RED → GREEN:** ausgeloggt — weder Suchfeld noch Lupensymbol im Rahmen, in beiden Breitenbereichen.

## 5. Tastatur und Auszeichnung

- [ ] 5.1 **RED → GREEN:** ↓ hebt hervor, Enter öffnet den hervorgehobenen Treffer; ↑ wandert zurück.
- [ ] 5.2 **RED → GREEN:** Escape schließt die Liste, der Fokus bleibt im Feld.
- [ ] 5.3 **RED → GREEN:** Feld und Liste sind als zusammengehörige Auswahl ausgezeichnet, der hervorgehobene Treffer ist als der aktive benannt.

## 6. Telefon-Fassung

- [ ] 6.1 **RED → GREEN:** unterhalb der Umbruchbreite öffnet ein Lupensymbol die Suche; sie ist beschreibbar und liefert dieselben Treffer.
- [ ] 6.2 Die geöffnete Fassung benutzt `useOverlay` (AGE-529) statt einer eigenen Sperre. Die Trefferliste wird absolut zum Feld positioniert, nicht fix zum Fenster.

## 7. Einbau in den Rahmen

- [ ] 7.1 Das tote `<input>` in `AppShell.tsx:407-419` durch `HeaderSearch` ersetzen. Nichts daneben anfassen — Logo, Glocke, Nutzermenü und der Anmelde-Knopf bleiben, wie sie sind.
- [ ] 7.2 `pnpm test` vollständig; Zahl gegen 1.1 halten. `pnpm lint` und `pnpm format:check` — **nie** `pnpm format`.

## 8. Nachweis an der Datenbank

- [ ] 8.1 Ein nicht aktiviertes Konto ruft `search_directory` mit einem Begriff auf, der auf mehrere Profile passt, und bekommt keine fremde Zeile. Gegen die Datenbank belegen (pgTAP oder roher Client), **nicht** in jsdom. Ausgabe in die PR-Beschreibung.
- [ ] 8.2 Gegenprobe im selben Lauf: ein aktiviertes Konto ab `discover` bekommt mit demselben Begriff Treffer. Ohne sie belegt 8.1 nur, dass die Abfrage nichts liefert.

## 9. Sichtprobe im Browser

- [ ] 9.1 Lokal anmelden und suchen: Treffer erscheinen, Auswahl öffnet das Profil, Enter landet auf `/mitglieder` mit gefüllter Suche.
- [ ] 9.2 Auf `/mitglieder` stehend **zweimal hintereinander verschieden** aus der Kopfzeile suchen — das ist der Fall, den jsdom nicht sieht und der in diesem Repo schon einmal grün und kaputt war.
- [ ] 9.3 Breiten 320 px, 375 px, 640 px und Desktop über die Geräte-Emulation prüfen (macOS kann kein Fenster unter 500 px): Lupensymbol erscheint, Kopfzeile bricht nicht um, die Liste ist nicht abgeschnitten.
- [ ] 9.4 Ausgeloggt gegenprüfen: kein Feld, kein Lupensymbol, in allen geprüften Breiten.
- [ ] 9.5 Mit einem Konto unterhalb `discover` gegenprüfen, dass der Aufstiegs-Hinweis erscheint.

## 10. Abschluss

- [ ] 10.1 Code-Review auf dem **Diff** durch einen unabhängigen Leser (Schritt 4).
- [ ] 10.2 `openspec validate --all` grün; jede Aufgabe hier abgehakt mit einem Diff, der sie erfüllt.
- [ ] 10.3 Commit(s) auf dem Feature-Branch, Conventional Commit mit `(AGE-540)`; PR mit den Belegen aus 8.x und 9.x, nicht als Behauptung.
- [ ] 10.4 CI grün auf der HEAD-SHA prüfen (`check-runs`, nicht `run list`), mergen, Merge mit `gh pr view --json state` bestätigen.
- [ ] 10.5 Live belegen: Bundle-Name und Größe, plus eine Zeichenkette aus diesem Diff im ausgelieferten Bundle — Größe allein unterscheidet die Vorversion nicht.
- [ ] 10.6 `openspec archive header-member-search`; danach prüfen, dass die vier Anforderungen in `openspec/specs/directory-search/spec.md` stehen.
- [ ] 10.7 AGE-540 in Linear: erst `get_issue` lesen (der Status setzt sich über die GitHub-Automation selbst), dann die drei widerlegten Annahmen als Kommentar hinterlassen — Feld drängt auf dem Telefon nicht (es fehlt dort), „nur öffentliche Profile durchsuchen" ist kein vorhandener Weg, und ausgeloggt ist nicht der einzige Leerfall.
