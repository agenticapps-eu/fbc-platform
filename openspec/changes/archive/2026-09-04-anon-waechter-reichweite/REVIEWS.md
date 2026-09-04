---
reviewers: [gemini, codex]
models: [gemini-cli-0.28.2-default, gpt-5.6-sol]
verdicts: [APPROVE, REQUEST-CHANGES]
reviewed_artifacts_sha: b76ffe7a2aa970caa5fabf2bec87dd752bbcac71e66c5d9c78fabb4932157ab8
---

# Change review — anon-waechter-reichweite

Zwei Anbieter, beide **nicht** der umsetzende Host (`claude`). Gelaufen über
`~/.agenticapps/bin/reviewer-cli.sh` mit `REVIEWER_TIMEOUT=900`, je Exit 0. Der
`reviewed_artifacts_sha` ist die Prüfsumme des zusammengesetzten Prompts, also
der Fassung der Artefakte, die den Reviewern vorlag — die Fassung **vor** den
Einarbeitungen unten.

## Reviewer: gemini

Modell: nicht angepinnt — der `gemini`-Arm des Wrappers gibt kein `-m` mit, und
die CLI (0.28.2) nennt das aufgelöste Modell im Lauf nicht. Damit ist Regel 4
des Skills (*das aufgelöste Modell festhalten*) hier **nicht erfüllt**; das ist
eine Lücke im Wrapper, keine im Lauf. Als eigener Anbieter zählt der Arm
unabhängig davon.

VERDICT: APPROVE

[MEDIUM] design.md D3 / tasks — Die Randprüfung erkennt Wachen an drei fest
verdrahteten Namen. Ein neues Gate mit anderem Namen (`ModeratorGate`) würde als
„unbewacht" gemeldet — Fehlalarm. Vorschlag: Namenskonvention `Require…` oder
eine statische Markierung an den Gate-Bauteilen.

[LOW] design.md D4 / tasks — Die Client-Liste der Funktionen ist eine von Hand
gepflegte Teilmenge der maßgeblichen Liste in `grants_test.sql`. Wird ein Grant
entzogen, ohne die Client-Liste zu bewegen, bleibt der Test grün, während der
Aufruf in Produktion scheitert. Vorschlag: ein Abgleich der beiden Listen.

Unausgesprochene Annahmen: alle anon-Routen stammen aus `navItems` oder
`App.tsx` (verschachtelte Router anderswo nicht ausgeschlossen); `enabled: !!uid`
bzw. `if (!uid) return` seien die einzigen verwendeten Muster;
`MembershipGate` sei das einzige Bauteil, das `children` für Ausgeloggte
vollständig unterbindet.

## Reviewer: codex

Modell: `gpt-5.6-sol` (aus dem Lauf-Kopf, `provider: openai`).

VERDICT: REQUEST-CHANGES

[HIGH] design.md „Gemessener Bestand" / proposal.md Impact — Die Behauptung, die
Abfragen der Hülle seien bedingt, ist falsch. `FeedbackButton` montiert
ausgeloggt in `AppShell` und startet `fetchFeedbackThemen` **vor** seinem
`if (!user) return null`; das liest `feedback_themes`, das laut
`grants_test.sql` nur `authenticated` gehört. Der geplante Test kommt damit rot
an und der Zuschnitt „kein Produktivcode" ist nicht haltbar — Fix aufnehmen,
vorlagern oder ausdrücklich annehmen. `feedback_themes` **nicht** in die
anon-Liste aufnehmen.

[HIGH] Spec-Delta (PROD-Katalog) vs. tasks.md — Das Delta verlangt eine Messung
am Produktionskatalog samt Ergebnis, keine Aufgabe führt sie aus; zugleich stützt
sich der Vorschlag für „die DB-Hälfte ist zu" allein auf den lokalen Test — Messung
nachholen oder die Zusage zurücknehmen.

[HIGH] design.md D1/D3, tasks 3.2/4 — Die Fläche ist nicht wirklich abgeleitet.
Die Rechtsseiten entstehen aus `rechtsseiten.map(…)`; ein fünfter Eintrag ändert
den ausgelieferten Routentisch, ohne `App.tsx`, `navItems` oder die Handliste zu
berühren. Die Randprüfung bliebe grün, die Route ungeprüft — Registries als
ausdrückliche Quelle einlesen, plus eine Kontrolle, die das belegt.

[MEDIUM] design.md D4 / Delta — `ANON_DARF_AUSFUEHREN` heißt „Abschrift der
Grants", enthält aber drei von sechs. Es ist eine Client-Teilmenge, keine Kopie —
umbenennen und als Teilmenge spezifizieren, mit der Forderung, dass jedes Element
in der maßgeblichen Liste vorkommt.

[MEDIUM] tasks 2.1/3.3 — Die Rüstung kann die echte Anwendung nicht montieren.
`AuthProvider` braucht mindestens `auth.getSession()` und
`auth.onAuthStateChange()`, `AppShell` zusätzlich `ToastProvider`; `App.test.tsx`
schreibt das bereits auf — den ausgeloggten Auth-Stub vollständig angeben und die
Provider-Reihenfolge der Produktion spiegeln.

[MEDIUM] design.md D3 — `ts.createSourceFile` liefert Syntax, keine Auflösung.
`path={item.path}` und ``path={`/${seite.slug}`}`` stehen bereits da; Konstanten,
Aliase, Spreads oder eingebundene Fragmente können still unauflösbar werden —
akzeptierte Formen aufzählen und bei jeder unbekannten `<Route>` mit Fundstelle
scheitern; dynamische Ausdrücke mitprüfen, nicht nur eine erfundene Literalzeile.

[MEDIUM] tasks 1.1–1.2 / 6.1–6.2 — Die Abnahme-Eingriffe können aus dem falschen
Grund rot werden. Hängt Eingriff A an einer neuen Route, schlägt die Randzusage
zuerst an und belegt nur die Inventarprüfung — A in einen öffentlichen `navItem`
legen, B auf eine bereits abgedeckte Route, C ausschließlich für den Rand.

[MEDIUM] tasks 3.3–3.7 — Isolation und Abbruchbedingung sind unbestimmt. Ein
wiederverwendeter `QueryClient` unterdrückt spätere Abfragen, ein nicht
zurückgesetzter Rekorder schreibt Aufrufe der falschen Route zu, und ein
gefundenes `lazy()`-Element belegt keinen gelaufenen Effekt — frischer
Query-Client ohne Wiederholungen und Rekorder-Reset je Fall, `unmount`, echtes
Abwarten, dauerhafte Positivkontrollen für Relation und Funktion.

[LOW] Spec-Delta / Einordnung — Die Anforderung regelt jetzt Feed, Events,
Anmeldung, Hülle, RPC-Ausführung und Produktionsrechte, steht aber weiter unter
`directory-search` — nach `access-control` verschieben.

Unausgesprochene Annahmen: Routen entstehen nur aus `navItems`, Literalen in
`App.tsx` und den vier heutigen Rechtsseiten; kein eingebundenes Bauteil
registriert Routen; `requiresAuth`/`minTier` behalten ihre Bedeutung; aller
Datenverkehr läuft über das eine gemockte Modul; die ausgeloggte Sitzung löst
deterministisch vor den Zusagen auf; Modul- und Query-Caches lecken nicht über
`it.each` hinweg; der lokale Katalog gleicht dem von PROD; `/styleguide`
auszunehmen ist zulässig.

## Nicht gezählt

Keiner. Beide Anbieter liefen mit Exit 0.

## Resolution

**[HIGH · codex · FeedbackButton] — angenommen und behoben.** Nachgemessen, die
Kette ist geschlossen und steht mit sieben Belegzeilen in `design.md`
(„Der Bestandsfehler, den die Planungs-Review fand"). Donald hat entschieden,
den Einzeiler in diesen Change zu nehmen: `enabled: Boolean(user)` an
`FeedbackButton.tsx:87`, Aufgabengruppe 6. Das Recht auf `feedback_themes` bleibt
unverändert. Der Vorschlag sagt jetzt „ein Eingriff in Produktivcode, und zwar
genau einer" statt „kein Eingriff", und trägt einen ausdrücklichen Nachtrag
darüber, **warum** meine erste Messung den Fall nicht fand: ich hatte die Hooks
aus der Importliste gezählt, nicht die Rümpfe der Bauteile.

**[HIGH · codex · PROD-Katalog] — angenommen und erledigt.** Rein lesend gemessen
am 2026-09-03, 05:39 UTC (`.gstack/prod-anon-katalog.mts`, nur `pg_proc` und
`information_schema`). Ergebnis in `design.md`: 6 anon-ausführbare Funktionen
(Zeichen für Zeichen die Liste aus `grants_test.sql` §6), 7 anon-lesbare
Relationen (genau `ANON_DARF_LESEN`, ohne `feedback_themes`), und die drei vom
Client gerufenen Funktionen halten ihr Recht **rollen-eigen** (`anon=X/postgres`),
nicht bloß über `PUBLIC` — die Unterscheidung aus AGE-602. Als Aufgabe 1.1
geführt und abgehakt.

**[HIGH · codex · Registries] — angenommen.** Der schwerwiegendste der drei, weil
er die Kernzusage des Changes traf: eine Fläche, die sich „abgeleitet" nennt und
eine Registry abschreibt, ist nicht abgeleitet. `rechtsseiten` wird jetzt
importiert (Aufgabe 4.2), das Delta trägt dafür einen eigenen Absatz und ein
eigenes Szenario, und Aufgabe 5.6 belegt es mit einer Kontrolle. Gemessen und
mit aufgenommen: `<Routes>` kommt im Produktivcode genau einmal vor, es gibt also
keine zweite Registry dieser Art — das schließt zugleich eine offene Annahme von
gemini.

**[MEDIUM · codex · Benennung] — angenommen.** Die Liste heißt jetzt
`ANON_RUFT_AUF`. Der alte Name behauptete Gleichheit, wo eine Teilmenge steht.
Der Kommentar sagt beide Richtungen: jeder Name hier muss in der Sechserliste
stehen, nicht jeder dort muss hier stehen.

**[MEDIUM · codex · Rüstung] — angenommen.** D6 fordert jetzt `auth.getSession()`
und ein abbestellbares `auth.onAuthStateChange()`; neu ist D7, der die Rüstung
ausdrücklich **aus `App.test.tsx` übernimmt** statt sie neu zu erfinden — eine
zweite, abweichende Rüstung wäre eine zweite Wahrheit über den Aufbau der
Anwendung. Aufgaben 3.2 und 4.4.

**[MEDIUM · codex · AST fällt offen aus] und [MEDIUM · gemini · Wächternamen] —
beide angenommen, mit einer Antwort.** Sie treffen denselben Punkt aus zwei
Richtungen. D3 verlangt jetzt: die akzeptierten Pfad- und Wächterformen sind
aufgezählt, jede andere macht rot mit Datei und Zeile. Das Delta hat dafür einen
eigenen Absatz und ein eigenes Szenario, Aufgabe 5.5 die Kontrolle.

*Nicht* übernommen wurde gemini's konkreter Vorschlag, die Wachen an einer
Namenskonvention (`Require…`) zu erkennen: eine Konvention, die nur ein Test
kennt, ist ein ungeschriebener Vertrag, und `MembershipGate` wäre ihr erster
Verstoß. Das geschlossene Ausfallen deckt denselben Fall, ohne etwas zu
verlangen, woran sich niemand erinnern muss. Steht so in D3.

**[MEDIUM · codex · Eingriffe mehrdeutig] — angenommen.** Aufgabengruppe 2 ist
neu geschnitten: A (Relation) und B (Funktion) hängen an `/aktivitaet`, einer
bereits abgedeckten Route; C (Rand) ist die einzige, die eine neue Route anlegt.
Die Begründung steht als Satz in der Gruppe, damit sie beim nächsten Umbau nicht
verlorengeht.

**[MEDIUM · codex · Isolation] — angenommen.** D7 und die Aufgaben 4.5, 4.6 und
4.10: frischer `QueryClient` ohne Wiederholungen je Fall, Rekorder-Reset,
`unmount`, Warten auf die Abfragen statt auf das Element, und zwei **dauerhafte**
Positivkontrollen.

**[LOW · gemini · Listen laufen auseinander] — angenommen, aber anders gelöst.**
Ein Abgleichskript wurde erwogen und verworfen: es schriebe die Grants ein
drittes Mal ab und verschöbe das Auseinanderlaufen nur um eine Datei. Was die
Aussage trägt, sind `grants_test.sql` §6 und die PROD-Messung; beide sind jetzt
im Kommentar über der Liste namentlich genannt. Steht in D4.

**[LOW · codex · Einordnung nach `access-control`] — verstanden, nicht in diesem
Change.** Der Einwand ist inhaltlich richtig: die Anforderung ist zu einer
anwendungsweiten Invariante geworden. Der Umzug ist aber ein `REMOVED` plus
`ADDED` über zwei Capabilities — genau die Archiv-Mechanik, an der AGE-598 Zeit
verloren hat — und er vermischte eine reine Umsortierung mit einer inhaltlichen
Änderung in einem Diff. Als offene Frage in `design.md` festgehalten, für einen
eigenen, rein ordnenden Vorgang.

**[Annahmen · gemini · verschachtelte Router] — gemessen und geschlossen.**
`<Routes>` kommt im Produktivcode genau einmal vor (`App.tsx:93`). Steht in D1.

**[Annahmen · beide · `/styleguide`] — ausgesprochen.** Die Route existiert nur
unter `import.meta.env.DEV` und ist im Produktionsbündel nicht vorhanden; sie
bleibt draußen, jetzt mit Begründung statt stillschweigend (Aufgabe 4.3, offene
Frage in `design.md`).

**Nicht behandelt, weil sie den Prüfstand nicht betreffen:** die Annahme, dass
`requiresAuth`/`minTier` ihre Bedeutung behalten (sie ist genau das, was der
Prüfstand künftig festhält), und dass aller Datenverkehr über das eine gemockte
Modul läuft — Edge Functions sind im Delta ausdrücklich als nicht erfasste
Grenze benannt.

## Stufe 2 — Review auf dem DIFF (2026-09-04)

Der Review oben gilt dem PLAN. Dieser hier gilt dem gebauten Diff (2531 Zeilen
über `src/`), gelaufen über `~/.agenticapps/bin/reviewer-cli.sh gemini` mit
`REVIEWER_TIMEOUT=900`, Exit 0. Vorgelegt wurden ausdrücklich die vier Fragen,
bei denen ich den Prüfstand für am angreifbarsten hielt: kann er still grün sein,
ist die AST-Klassifikation geschlossen, verdeckt der Proxy-Stub Verhalten, ist
die eine Produktivzeile vollständig.

**Verdikt: APPROVE.** Keine HIGH-Befunde. Zu den vier Fragen: still grün sei
durch die Kombination aus `allesGelaufen` und der dauerhaften Positivkontrolle
gebannt; die AST-Klassifikation für `App.tsx` geschlossen; der Stub sei ein
Rekorder und kein Emulator und verdecke deshalb eher nichts, sondern melde im
Zweifel MEHR Verstösse; `enabled: Boolean(user)` sei korrekt und ohne
unbewachte Geschwister-Abfrage in derselben Komponente.

Drei Befunde, alle eingearbeitet:

| Grad | Befund | Was daraus wurde |
|---|---|---|
| MEDIUM | `waitFor`-Timeout von 15 s zu grosszügig — bei einem roten Lauf zahlt es jeder der über zwanzig Fälle einzeln | auf **5 s** gesenkt (gemessen braucht eine Montage ~800 ms), mit Begründung im Code |
| LOW | **`release-entries.generated.ts` lag im Diff** und erhöht das Rauschen in einem sicherheitsrelevanten Change | zurückgenommen — die Datei war von `pnpm build` unformatiert überschrieben worden, nicht von diesem Change |
| LOW | Kommentar über der Symbol-Behandlung im Proxy sprachlich unklar | umformuliert, im Wesentlichen nach dem Vorschlag des Reviewers |

**Der zweite Befund ist der wertvollste und war kein Stilpunkt.** `pnpm build`
schreibt `src/content/release-entries.generated.ts` bei jedem Lauf um; die Datei
wäre ohne diesen Review mit in den Commit gewandert und hätte einen Diff, der
Rechte betrifft, um fremde Formatierungsänderungen verunreinigt.

<!-- openspec-review-trailer v1
implementing-host: claude
digest: sha256:82116717eaa29f7a78e7b21f2e2a2c0380c6760ff7fdd84c9bab8c5798b2e1ed
producer-version: 1.2.0
tasks-digest: sha256:ca8ecfc72db5524003629502f260e03ed690239982073a92c4e15d4f1436d3a1
-->
