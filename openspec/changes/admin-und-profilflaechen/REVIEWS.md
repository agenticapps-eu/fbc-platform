---
reviewers: [codex, gemini]
models: [gpt-5.2-codex, gemini-3-pro]
verdicts: [DONE-WITH-CONCERNS, REQUEST-CHANGES]
reviewed_artifacts_sha: 722f5ada6a91f241a7e9a1af16caee43ea6f9c97b86a38cede7f6896fbae1241
---

# Change review — admin-und-profilflaechen

Zwei Vendoren, beide fremd (das Delta stammt von Claude). Dreizehn Befunde,
**zwölf angenommen, einer widerlegt.** Jeder ist nachgeprüft worden, bevor er
angenommen wurde — und einer der Reviewer hat den Plan nicht nur kritisiert,
sondern korrigiert.

## Reviewer: codex (gpt-5.2-codex)

VERDICT: DONE-WITH-CONCERNS

### [HIGH] Die Fünf-Seiten-Grenze widersprach der eigenen Zusage — ANGENOMMEN

Das Spec-Delta sagte „sucht weiter, bis der Beitrag da ist oder der Bestand
erschöpft ist", der Entwurf kappte bei fünf Seiten. Ein **sichtbarer** Beitrag
auf Seite 6 verletzte damit zwei SHALL-Szenarien — durch korrekten Code.

**Nicht die Zusage wurde aufgeweicht, sondern der Entwurf ersetzt.** Der Beitrag
wird jetzt direkt geholt (`posts?id=eq.<id>` unter der RLS) und dem Feed
vorangestellt, statt ihn zu suchen. Das erreicht **jeden** sichtbaren Beitrag,
kostet eine Anfrage statt fünf, und die Ununterscheidbarkeit wird trivial: beide
Fälle liefern null Zeilen. Die Obergrenze entfällt ersatzlos. Siehe D2, neu.

### [MEDIUM] Die Sichtbarkeits-Zusage bewies die starke Eigenschaft nicht — ANGENOMMEN

7.6 verglich nur die sichtbare Antwort, 7.7 nur den Abfrage-Schlüssel. Eine
spätere Fassung könnte eine ziel-spezifische Anfrage ergänzen, deren
verschiedene Fehler abfangen und denselben Text rendern — beide Zusagen blieben
grün, während Netzwerkspur oder Fehlercode ein Orakel bilden.

Mit dem neuen Entwurf **gibt es** eine ziel-spezifische Anfrage. Die Zusage
lautet deshalb nicht mehr „die Kennung kommt in keiner Anfrage vor", sondern:
beide Fälle erzeugen **dieselbe Anfrage mit demselben Ergebnis** (null Zeilen)
und **dieselbe** Fläche. Verglichen werden die zwei Läufe miteinander, nicht
gegen ein Muster.

### [MEDIUM] Der Zähler widerspricht bei aktiver Suche der Spec — ANGENOMMEN

Die Zähl-RPC kennt keinen Suchbegriff, `admin_list_members` schon. Sucht der
Admin nach „Anna", zeigt der Reiter 70 und die Liste zwei — während das Szenario
„exakt N Zeilen" zusicherte.

Die Zahl bleibt **absichtlich global**: der Reiter sagt, wie viele es in diesem
Zustand *gibt*, nicht wie viele auf die Suche passen. Das Szenario ist auf die
leere Suche eingegrenzt und die Globalität ausdrücklich zugesichert, statt sie
zu unterschlagen.

### [MEDIUM] Die Kreuz-Zusage war nicht scharf genug — ANGENOMMEN, und überholt

Drei Einwände, alle richtig: `mitgliedschaft` ist gar kein gültiger `p_status`
(würfe `22023`); der Vergleich braucht `p_query => null`, `p_offset => 0` und ein
Limit über dem ganzen Fixture-Bestand; und **gleiche Kardinalität kann bei
ausgewogenen Fixtures trotz falschem Zweig grün bleiben**.

Der dritte Einwand ist der, der zählt, und er trifft die Bauart, nicht die
Zusage. Zusammen mit geminis MEDIUM (unten) ist die Kopie deshalb ganz entfallen
— siehe D3, neu.

### [MEDIUM] Zähler veralten nach Mitgliedsaktionen — ANGENOMMEN

Die Lebenszyklus-Aktionen invalidieren den Präfix `["admin-members"]`. Ein
eigener Schlüssel `["admin-member-counts"]` läge daneben: nach einer
Deaktivierung wandert die Zeile in der Liste, während „Alle" und „Deaktiviert"
ihre alten Zahlen behalten. **Jeder Test auf das erste Rendern bliebe grün.**
Der Zähler-Schlüssel liegt jetzt unter demselben Präfix, plus eine Zusage
Mutation → Nachladen.

### [MEDIUM] Fünf der sieben Zusagen dürfen NICHT umgeschrieben werden — ANGENOMMEN

**Der Befund, der den Plan verbessert hat, statt ihn nur zu bemängeln.** Weil die
neue Funktion Vorgabewerte trägt, bleibt `admin_list_feedback()` als
argumentloser Aufruf gültig — die fünf SQL-Aufrufe in `rls_test.sql` sind damit
**Wächter über genau diese Vorgabewerte**. Nur die zwei
`has_function_privilege`-Zeichenketten benennen die alte Funktionsidentität.

Hätte der ursprüngliche Plan alle sieben angefasst, hätte er fünf Wächter
stillgelegt — und die Migration hätte die Vorgabewerte vergessen dürfen, ohne
dass es auffiele. Abschnitt 2 ist entsprechend umgeschrieben.

### [MEDIUM] Offset-Paging ohne stabile Ordnung — ANGENOMMEN

`order by created_at desc` ist bei gleichen Zeitstempeln **keine Gesamtordnung**,
und die Feedback-Fixtures entstehen alle in derselben Transaktion mit demselben
`now()`. Zwei Zeilen können zwischen Seite 1 und 2 wechseln, während der
pgTAP-Vergleich dauerhaft grün aussieht.

Dieselbe Lehre, die der Feed-Cursor schon bezahlt hat. Neu: `created_at desc,
id desc`, und das Szenario ist ausdrücklich auf unveränderten Bestand begrenzt —
gegen gleichzeitige Zugänge hilft Offset grundsätzlich nicht.

### [MEDIUM] Deeplinks nur auf dem öffentlichen Profil — ANGENOMMEN

Das Spec-Delta sagt „auf jedem Profil", die Aufgabenliste machte nur
`PublicProfilePage` klickbar; `profil-widgets.tsx` bekam nur den Ersatztext. Ein
Widerspruch zwischen Zusage und Bau, bei dem beide Seiten grün gewesen wären.
Beide Flächen werden jetzt verlinkt.

### [MEDIUM] „Beitrag mit Bild" ist keine gültige Invariante — ANGENOMMEN

`canSubmit` schützt nur den Composer. `create_post_with_media` nimmt leeren Text
UND ein leeres Medienarray an, und das Spalten-UPDATE-Recht auf `body` lässt ein
Mitglied den eigenen Text nachträglich leeren. Ein textloser Beitrag ohne Bild
ist also möglich — die Karte behauptete dann etwas Falsches.

**Donald hat entschieden (25.08.): „Beitrag ohne Text".** Immer wahr, kostet
keine zusätzliche Abfrage, kann nicht kippen. D6 ist entsprechend neu.

### [LOW] EXECUTE-Rechte der Zähl-RPC nicht zugesichert — ANGENOMMEN

Neue Funktionen tragen in PostgreSQL EXECUTE für `PUBLIC`, solange es niemand
entzieht — dieselbe Klasse wie AGE-312. Der Migrationsplan nannte Revoke/Grant
nur bei der Feedback-Funktion. Jetzt für beide, und die Zusage prüft `anon`,
`authenticated` **und** das fehlende PUBLIC-ACL.

### [LOW] Zwei UI-Szenarien ohne negative Verifikation — ANGENOMMEN

`/admin/feedback` ohne `RequireAdmin` eingehängt, oder `/admin/mitglied/:id`
versehentlich im Menü — beides bliebe grün. Zwei Negativzusagen ergänzt.

## Reviewer: gemini (gemini-3-pro)

VERDICT: REQUEST-CHANGES

### [HIGH] Seitenkanal über die Zahl der Anfragen — WIDERLEGT

Die Behauptung: der Angreifer unterscheide unsichtbar von nicht vorhanden an der
Zahl der Anfragen.

**Das eigene Szenario widerlegt es.** Dort erzeugen unsichtbar *und* nicht
vorhanden je fünf Anfragen — die zwei Fälle, um die die Zusage geht, sind
identisch. Verschieden ist der **sichtbare** Beitrag auf Seite 1 (eine Anfrage);
daraus erfährt der Angreifer nur, dass ein Beitrag, den er ohnehin sehen darf,
weit vorne steht. Die Zusage lautet nicht „alle Deeplinks sehen gleich aus".

Codex hat dieselbe Frage unabhängig geprüft und kommt zum selben Ergebnis: „keine
zielabhängigen PostgREST-Fehler und kein Unterschied in der Anfragezahl zwischen
unsichtbar und nicht vorhanden."

Der Befund ist trotzdem nicht folgenlos: er hat die Frage gestellt, deren
Beantwortung den Entwurf auf den direkten Zugriff gebracht hat — und dort ist die
Gleichheit nicht mehr argumentiert, sondern gebaut.

### [MEDIUM] Die abgeschriebene Zustandsbedingung — ANGENOMMEN, in schärferer Form

Die Begründung trägt nicht (pgTAP läuft gegen eine Handvoll Fixture-Zeilen, nicht
gegen Tausende; die Sorge um die Testlaufzeit ist gegenstandslos). **Der Kern
trägt sehr wohl**, und dieses Repo hat ihn erst am Vortag aufgeschrieben: die
Sidebar-Migration aus AGE-582 begründet ausdrücklich, dass eine Zahl richtig sein
soll, *weil die Regel wirkt — nicht, weil eine Abschrift sie nachspricht.* D3 tat
das Gegenteil.

Und die vorgeschlagene Alternative bricht die Wächter **nicht**: sie schützen
Signatur und Spaltensatz von `admin_list_members`, nicht ihren Rumpf. Die
Bedingung wandert deshalb in eine gemeinsame Funktion, die beide aufrufen. Keine
Kopie, keine Kreuz-Zusage nötig — siehe D3, neu.

### [LOW] Tastaturbedienbarkeit nur manuell geprüft — ANGENOMMEN

Ein `div` mit `onClick` bestünde `fireEvent.click`. Die Zusage prüft jetzt, dass
das Element ein echtes `<a href>` ist — **das sieht jsdom sehr wohl**, im
Gegensatz zur Fokusreihenfolge. Die Sichtprobe bleibt daneben stehen, aber sie
ist nicht mehr die einzige Prüfung.

## Was der Durchgang gekostet und gebracht hat

Zwei Befunde haben die Bauart geändert (HIGH von codex, MEDIUM von gemini), einer
hat den Plan verbessert statt ihn zu bemängeln (die fünf Wächter), einer ist
widerlegt worden. Alle dreizehn wurden gefunden, **bevor eine Zeile Code
existierte** — der billigste Moment.
