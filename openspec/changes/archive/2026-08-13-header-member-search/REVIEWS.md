---
reviewers: [gemini, codex]
models: [gemini-cli-0.28.2, gpt-5.6-sol]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: cf071376052b1138429fbc4788b3f84976e45376638dd49d7faa5a59ae4f3e81
---

# Change review — header-member-search (AGE-540)

Zwei Anbieter, beide **nicht** der Anbieter des Autors. Zeitgrenze 900 s; beide
Läufe endeten mit Exit 0.

Zur Modellangabe gilt dasselbe wie in `resolve-anon-name-masking/REVIEWS.md`:
`codex` ist aus `~/.codex/config.toml` belegt, für `gemini` ist die
CLI-Version festgehalten, weil die Selbstauskunft (`gemini-1.5-pro` bei CLI
0.28.2) kein Beleg ist.

**Fehler im Prompt, der hier hingehört:** Der Kontextsatz nannte „React 18".
Installiert sind **React 19.2.8** und **react-router-dom 7.18.2**. Der Fehler lag
im Prompt, nicht im Proposal — codex hat ihn trotzdem gefunden (LOW), und die
Annahmen über Effekt-Reihenfolge und Router-Verhalten sind gegen die
**installierten** Versionen zu prüfen, nicht gegen die genannten.

## Reviewer: gemini (CLI 0.28.2)

VERDICT: REQUEST-CHANGES

- [HIGH] tasks.md 7.1 — „Das tote `<input>` durch `HeaderSearch` ersetzen" ist
  mehrdeutig und riskiert, die Komponente **außerhalb** des Zweigs für
  angemeldete Nutzer zu platzieren. Das tote Feld steht heute genau dort — für
  alle sichtbar. Wörtlich befolgt verletzt die Aufgabe die eigene Anforderung
  4.4 desselben Changes. — Aufgabe umformulieren: `HeaderSearch` gehört
  **innerhalb** des `user ? … :`-Zweigs.
- [MEDIUM] design.md §3 / tasks.md 2.2 — Der Effekt aus der Adresszeile soll
  `queryInput` **und** `filters.query` setzen. `MemberDirectory` hat aber bereits
  einen entprellten Effekt, der `filters.query` aus `queryInput` speist — zwei
  Wege zu demselben Zustand, die einander umgehen können. — Der Effekt setzt
  **nur** `queryInput`; die bestehende Entprellung bleibt der einzige Weg zu
  `filters.query`.

Genannte Annahmen: dass `useAuth()` reaktiv ist und ein Abmelden die Kopfzeile
sofort neu rendert; dass `search_directory` schnell genug für eine
Tipp-Vorschau ist; dass der Zurück-Knopf mit dem Suchparameter erwartungsgemäß
arbeitet.

## Reviewer: codex (gpt-5.6-sol, reasoning effort high)

VERDICT: REQUEST-CHANGES

- [HIGH] design.md §3 / tasks.md 2.1-2.2 — Beim Mounten mit gesetztem Parameter
  rendert `MemberDirectory` **zuerst mit leerer Suche**. React Query startet
  damit eine ungefilterte `search_directory({})`-Abfrage, bevor der Effekt den
  Parameter kopiert: zwei Abfragen, und das ganze Verzeichnis blitzt auf und
  landet im Cache. — `queryInput` **und** `filters.query` synchron aus der
  Adresszeile initialisieren, den Effekt nur für spätere Navigationswechsel.
  Test, der beim Mounten mit Parameter belegt, dass **keine** ungefilterte RPC
  läuft.
- [HIGH] design.md §3 / Anforderung „Der Suchbegriff geht an das Verzeichnis
  über" — „Fortlaufende Quelle" ist **kein vollständiges Zustandsmodell**.
  Schreibt das Verzeichnis beim Tippen nicht in die Adresszeile, veraltet diese,
  und dasselbe Wort erneut abzuschicken erzeugt keinen Parameterwechsel — die
  lokal geänderte Suche bliebe stehen. Schreibt es hinein, fehlen
  `push`-gegen-`replace`, wem die Entprellung gehört, und wie das Zurückschreiben
  nicht ins Feld zurückhallt. — Einen Eigentümer festlegen, dazu Parametername,
  Normalisierung, Verlaufsverhalten und das erneute Abschicken desselben Worts.
  Testen: Mounten, spätere Navigation, Vor/Zurück, lokales Tippen, Resubmit.
- [HIGH] tasks.md 4.4 / Lebenszyklus der Anmeldung — Nur den ausgeloggten
  Erstzustand zu testen übersieht **Abmelden oder Sitzungsablauf, während das
  Dropdown offen ist**, während die Entprellung läuft oder eine Abfrage
  unterwegs ist. Und: es gibt **einen globalen `QueryClient`**, dessen
  Verzeichnis-Schlüssel **keine Nutzerkennung** tragen — als `discover` geholte
  Treffer können einem später angemeldeten `basic`-Konto aus dem Cache gezeigt
  werden. Das Feld auszublenden genügt nicht. — Schlüssel nach `user.id`
  trennen, `enabled` defensiv setzen, laufende Suchen beim Identitätswechsel
  abbrechen und entfernen; Übergangstests dafür.
- [HIGH] spec delta / Anforderung „Der Suchbegriff geht an das Verzeichnis über"
  — Das bedingungslose Versprechen, Enter öffne ein Verzeichnis mit gefülltem
  Feld und passender Liste, ist für `basic`/`connect` **unmöglich**:
  `/mitglieder` liegt hinter `MembershipGate min="discover"`, `MemberDirectory`
  mountet dort nie. — Szenario auf `discover` und darüber einschränken oder das
  Verhalten darunter ausdrücklich festlegen (etwa: auf die Aufstiegsseite).
- [MEDIUM] spec delta / Szenario „Unterhalb von discover erscheint der
  Aufstiegs-Hinweis" — Das Szenario sagt, **jede** Suche unterhalb der Stufe
  zeige den Hinweis; Design und Aufgabe 4.3 sagen, der Rang formuliere nur den
  leeren Fall und ein zurückkommendes eigenes Profil werde gezeigt. Zwei
  verschiedene Verträge — und die Einladung, `levelRank` doch zum Client-Gate zu
  machen. — „**AND** die RPC liefert keine Zeile" ergänzen und ein eigenes
  Szenario, das die gezeigte eigene Zeile belegt.
- [MEDIUM] design.md §2 / tasks.md §4 — **Kein Lade- und kein Fehlerzustand.**
  Ein Netzfehler, ein abgelaufenes Token oder ein `42501` würde damit als
  „nichts gefunden" oder „Aufstieg nötig" erscheinen — ein Betriebs- oder
  Anmeldefehler als Such- oder Stufenaussage verkleidet. — Eigenen Fehlerzustand
  festlegen und testen; die stufenabhängige Formulierung erst **nach** einer
  erfolgreichen leeren Antwort.
- [MEDIUM] design.md / `lib/directory.ts` / tasks.md 3.2 — Der Cache-Vertrag der
  „erste N Treffer"-Funktion ist undefiniert. Unter `directoryQueryKey(filters)`
  abgelegt vergiftet ein auf fünf gekürztes Ergebnis den Cache des vollen
  Verzeichnisses. — Eigener, nach Identität getrennter Schlüssel; gekürzte
  Ergebnisse nie unter dem Verzeichnis-Schlüssel ablegen.
- [MEDIUM] Entprellung / tasks.md 3.1 und 5.1 — Während der 300 ms bleiben
  Treffer **und Hervorhebung** des vorigen Worts unter dem neu getippten stehen.
  Enter öffnet dann ein Mitglied, das zur aktuellen Eingabe nicht passt. —
  Veraltete Treffer verbergen, sobald Rohtext und entprellter Text
  auseinanderlaufen; unterhalb der Zwei-Zeichen-Schwelle sofort leeren; die
  Hervorhebung bei jedem Wechsel zurücksetzen.
- [MEDIUM] design.md §5 / tasks.md §6 — `useOverlay` sperrt nur den Scroll und
  fängt `Tab`. Es setzt **weder den Anfangsfokus noch schließt es auf Escape**.
  Dazu die bekannte Gefahr: von unter `sm` nach `sm` zu wechseln, während offen,
  versteckt die Telefon-Fassung per CSS und lässt den Body gesperrt. — Fokus,
  Schließen (Knopf/Hintergrund/Escape), Fokusrückgabe und automatisches
  Schließen an der Umbruchbreite festlegen; Test für Größenänderung im offenen
  Zustand.
- [MEDIUM] tasks.md 3.3, 4.2, 7.1 — Navigation hängt `AppShell` nicht ab. Nichts
  verlangt, dass das Dropdown nach Auswahl, Enter, „Alle Ergebnisse" oder einem
  Routenwechsel schließt — es kann über der Zielseite stehen bleiben. Und „Alle
  Ergebnisse" hat keinen eigenen Navigationstest. — Schließverhalten und Tests
  für jeden Navigationsweg plus Klick nach außen.
- [LOW] Proposal-Kontext — React 19.2.8 / react-router-dom 7.18.2, nicht
  React 18.

Nicht ausgesprochene Annahmen, die codex zusätzlich benennt: Parametername,
Kodierung, Leerraum-Normalisierung und ob die Zwei-Zeichen-Schwelle auf rohen
oder getrimmten Text zählt · dass `roles` die Quelle der „Berufsbezeichnung" ist
(**die RPC hat kein Feld für eine Berufsbezeichnung**) · dass alphabetische
Sortierung (`ORDER BY name`) „die ersten fünf" bedeuten darf, ohne Relevanz und
**ohne serverseitiges Limit** · dass alle Treffer geladen und clientseitig
gekürzt werden dürfen · dass zwischengespeicherte RLS-gefilterte Daten über
einen Kontenwechsel hinweg unbedenklich sind · dass ein Klick auf einen Treffer
noch ankommt, wenn Blur/Klick-nach-außen die Liste zuerst schließt.

## Nicht gezählt

Keiner. Beide Läufe endeten mit Exit 0 innerhalb der Zeitgrenze. `claude` wurde
nicht aufgerufen — es ist der Anbieter des Autors.

## Resolution

### Nachgeprüft, bevor gehandelt wurde

| Befund | Prüfung | Ergebnis |
|---|---|---|
| React 19, nicht 18 | `package.json:33,36` | **bestätigt** (19.2.8 / 7.18.2) |
| `useOverlay` kennt kein Escape, keinen Anfangsfokus | `useOverlay.ts:113` behandelt nur `Tab` | **bestätigt** |
| Ein globaler `QueryClient`, nie geleert | `main.tsx:14`, kein `clear()` im Repo | **bestätigt** |
| Verzeichnis-Schlüssel ohne Nutzerkennung | `directory.ts` — `["directory","search",f]` | **bestätigt** |
| `/mitglieder` hinter `MembershipGate min="discover"` | `nav.ts:78`, `App.tsx:31` | **bestätigt** |

### Angenommen und einzuarbeiten — alle HIGH

- **gemini HIGH:** Aufgabe 7.1 wird umformuliert. `HeaderSearch` steht innerhalb
  des `user ? … :`-Zweigs; „ersetzen" allein war die Einladung zum Widerspruch
  mit der eigenen Anforderung 4.4.
- **codex HIGH 1 + gemini MEDIUM** widersprechen sich scheinbar und lösen sich
  zusammen auf: `queryInput` **und** `filters.query` werden aus der Adresszeile
  **synchron initialisiert** (codex — verhindert die ungefilterte Erstabfrage),
  und der Effekt für **spätere** Wechsel setzt **nur** `queryInput` (gemini —
  ein Weg zu `filters.query`, die bestehende Entprellung). Kein Widerspruch,
  zwei verschiedene Zeitpunkte.
- **codex HIGH 2:** Das Zustandsmodell wird ausgeschrieben, mit einem
  Eigentümer. Das ist die größte Erweiterung des Designs und die Stelle, an der
  „rudimentär" am ehesten kippt — sie wird deshalb **eng** gefasst: das
  Verzeichnis schreibt beim Tippen **nicht** in die Adresszeile, die Kopfzeile
  ist der einzige Schreiber, und die Übernahme hängt am Navigationsereignis,
  nicht am bloßen Wert — sonst bliebe genau der von codex genannte Resubmit-Fall
  offen.
- **codex HIGH 3:** Der Cache-Befund ist der schwerste und reicht **über diesen
  Change hinaus** — er ist AGE-258 (`finish-ui-polish`, Aufgabe 2.1: den Cache
  beim Abmelden **leeren**, nicht nur entwerten). Innerhalb dieses Changes:
  Schlüssel nach `user.id`, `enabled` defensiv, Abbruch beim Identitätswechsel.
  Dass die Lücke damit nur für die Kopfzeilen-Suche geschlossen ist und für das
  Verzeichnis offen bleibt, wird benannt statt stillschweigend mitgenommen.
- **codex HIGH 4:** Das Enter-Szenario wird auf `discover` und darüber
  eingeschränkt. Darunter führt Enter auf `/mitgliedschaft` statt auf eine Wand,
  die den Suchbegriff verschluckt — sonst verspricht der Spec etwas, das die
  Route baulich nicht halten kann.

### Angenommen — alle MEDIUM und LOW

Fehler- und Ladezustand als eigene Zustände (und die stufenabhängige
Formulierung erst nach einer **erfolgreichen** leeren Antwort) · „AND die RPC
liefert keine Zeile" im Hinweis-Szenario plus Gegenszenario für das eigene
Profil · eigener Cache-Schlüssel für die Kopfzeilen-Suche · veraltete Treffer
und Hervorhebung während der Entprellung verbergen · Escape, Anfangsfokus,
Fokusrückgabe und Schließen an der Umbruchbreite ausdrücklich festlegen, weil
`useOverlay` sie **nicht** mitbringt · Schließen bei jedem Navigationsweg und
bei Klick nach außen · Versionsangabe korrigiert.

### Zwei Annahmen, die in den Spec gehören statt in eine Fußnote

- **„Berufsbezeichnung" gibt es nicht.** `search_directory` liefert `roles`,
  `company`, `short_bio` — kein Feld für einen Berufstitel. Der Spec muss
  benennen, was in der Trefferzeile steht, statt ein Feld zu erfinden.
- **Es gibt kein serverseitiges Limit.** „Die ersten fünf" heißt heute: alle
  Treffer laden, alphabetisch nach `name`, clientseitig kürzen. Bei 70
  Mitgliedern tragbar — aber es ist eine Aussage über Menge und Reihenfolge, und
  sie gehört hingeschrieben, nicht angenommen.

### Nicht angenommen

Nichts. Beide Reviews sind vollständig übernommen.
