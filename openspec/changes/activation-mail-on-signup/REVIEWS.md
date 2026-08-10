---
reviewers: [gemini, opencode]
models: [gemini-3-pro-preview, "hf:moonshotai/Kimi-K3"]
verdicts: [APPROVE, REQUEST-CHANGES]
reviewed_artifacts_sha: f853145be2595dcd
---

# Change review — activation-mail-on-signup (AGE-526)

Gelaufen am 2026-08-10, **vor** der ersten Codezeile. Eigener Hersteller
(claude) ausgeschlossen.

## Reviewer: gemini (gemini-3-pro-preview)

VERDICT: APPROVE

- [LOW] `supabase/migrations/` — Die Zählung `count(*) from activation_tokens`
  ist ein Wettlauf: Zwei gleichzeitige Anforderungen lesen beide 99 und geben
  beide aus, die Grenze wird leicht überschritten. — Vorschlag: im
  Migrationskopf benennen; strengeres Sperren sei für das Bedrohungsmodell
  übertrieben.

Angenommene Voraussetzungen, die der Vorschlag nicht ausspricht: synchrone
Systemuhren; ein Angreifer, der mit hundert Wegwerfkonten das Kontingent
erschöpft, sei hinnehmbar; Resends Kontingent trage 100 Mails/Stunde.

## Reviewer: opencode (hf:moonshotai/Kimi-K3)

VERDICT: REQUEST-CHANGES

Dieser Reviewer hat den echten Quelltext gelesen — RPC, Edge Function,
`ActivationGate`, `AuthProvider` — und entsprechend konkret geantwortet.

- [HIGH] H1 — Die zugesagte harte Obergrenze ist als `count(*)` vor `insert`
  gebaut, gesichert nur durch die Sperre auf der **eigenen** Profilzeile. Zehn
  gleichzeitige frische Profile lesen alle 99 und schreiben alle. Die Grenze ist
  genau in dem Fall ungefähr, für den sie existiert.
- [HIGH] H2 — Gezählt werden Token-Zeilen, nicht gesendete Mails, und die RPC
  ist für jedes `authenticated`-Konto direkt aufrufbar. Rund zwanzig Konten
  füllen das Kontingent ohne eine einzige Mail und sperren damit alle frischen
  Profile — ein neuer Sperr-Weg, den erst dieser Change schafft.
- [HIGH] H3 — Das Delta sagt „plattformweit" zu, baut die Schranke aber nur in
  `request_own_activation_token`. `issue_activation_token` gibt weiter aus. Die
  Zusage ist größer als der Bau.
- [HIGH] H4 — Das Szenario verlangt die „verbleibende Wartezeit", aber Function
  und RPC liefern nur einen Status. Nach einem Neuladen hat der Client keinen
  Serverwert; `SPERRE = 60` ist geraten.
- [HIGH] H5 — Es gibt keinen beschriebenen Weg, auf dem `ActivationScreen` vom
  Ergebnis des automatischen Versands erfährt. Er wird von `ActivationGate` nach
  dem Routenwechsel gerendert, und `signUp` gibt nur `{ error }` zurück.
- [HIGH] H6 — Die 10-Minuten-Ausnahme schützt ältere Mitglieder, lässt aber
  genau die Zielgruppe ungeschützt: Bei einem echten Ansturm bekommt Nutzer 101
  weder Mail noch Knopf.
- [MEDIUM] M1 — Die Statusliste unterschlägt die echten Ausgänge der Function:
  502 `{"status":"send_failed"}`, `issue_failed`, Transportfehler.
- [MEDIUM] M2 — Task 4.6 („Hinweistext prüfen") ist ein Prüfhaken, kein Umbau;
  der Text ist nach diesem Change sicher falsch.
- [MEDIUM] M3 — Den Tests fehlen die Randwerte (exakt 60 Minuten, exakt 10
  Minuten) und der Gleichzeitigkeitsfall.
- [LOW] L1 — Für `rate_limited_global` ist nicht ausgesprochen, dass der zuletzt
  ausgegebene Link gültig bleibt.

## Not counted

- **codex — exit 4, Zeitüberschreitung bei 300 s.** Nicht gewertet. Ersetzt
  durch `opencode`, das auf ein Modell eines dritten Herstellers auflöst
  (Moonshot Kimi-K3) und damit die Zwei-Hersteller-Regel unabhängig erfüllt.

## Resolution

**Angenommen und eingearbeitet — alle HIGH und MEDIUM:**

- **H1 + gemini-LOW** → `pg_advisory_xact_lock` vor der Zählung (design D3). Die
  beiden Reviewer bewerten denselben Fund verschieden; ich folge dem strengeren,
  weil die Nachbaranforderung „Die Grenzen gelten auch gegen gleichzeitige
  Anforderungen" für Sperrfrist und Tageskontingent bereits eine Sperre
  verlangt. Eine Grenze, die als einzige ungefähr ist, wäre ein Sonderfall ohne
  Grund. Neue Tests 2.5 und die Zusage der Atomarität im Delta.
- **H2 + H6** → Das ist der wahre Preis des Entwurfs, und er stand nirgends. Er
  steht jetzt **in der Anforderung**, nicht nur im Risikoabschnitt: Ist das
  Kontingent erschöpft, bekommt ein frisches Konto keine automatische Mail; die
  Sperre löst sich nach zehn Minuten von selbst, danach trägt der Knopf. Der Weg
  ist verzögert, nicht verschlossen — dauerhaft aussperren kann niemand. Neues
  Szenario „Das gesperrte frische Konto kommt nach zehn Minuten durch",
  Test 2.6. Eine Reservierung auf der Sendeseite (opencodes Vorschlag) ist
  abgelehnt: Sie führte einen zweiten Zustand ein, um eine Zusage zu retten, die
  wir nach H3 gar nicht mehr geben.
- **H3** → Durch Verengung aufgelöst, nicht durch mehr Bau. Das Delta sagt jetzt
  „auf dem sitzungsgebundenen Ausgabeweg" und spricht aus, dass der Admin-Weg in
  das Kontingent **hineinzählt**, aber nicht von ihm gebremst wird (design D3a).
- **H4** → Szenario abgeschwächt statt Vertrag erweitert: Der Bildschirm meldet,
  dass der Link unterwegs ist und ein erneuter Versuch kurz warten muss — keine
  Sekundenzahl, die der Server nicht mitgeliefert hat. Ein
  `retry_after_seconds` wäre neue Fläche für eine Anzeige, die niemand verlangt
  hat.
- **H5** → Die Naht war tatsächlich nicht beschrieben. `AuthProvider` hält das
  Ergebnis und reicht es über den Auth-Kontext, wie `isActivated` schon geht
  (design D6). Nach einem Neuladen zeigt der Bildschirm wieder den Knopf — das
  ist gewollt, die Alternative wäre eine ungeprüfte Behauptung aus
  `sessionStorage`. Test 4.5.
- **M1** → `send_failed` und `error` sind Teil des Rückgabetyps (design D7),
  neues Szenario „Der Versand wird abgelehnt", Test 3.2.
- **M2** → Aus dem Prüfhaken ist ein Umbau mit rotem Test geworden (Task 4.7).
- **M3** → Randwerte und Gleichzeitigkeit sind jetzt eigene Tests (2.4, 2.5).
- **L1** → Ein Satz im Delta: Auch an dieser Grenze bleibt der zuletzt
  ausgegebene Link gültig; zusätzlich im Szenario.

**Nicht übernommen:**

- opencodes Vorschlag, die Ausgabe per RPC für frische Konten ganz zu
  unterbinden oder gesondert zu begrenzen. Der Missbrauchsweg über direkte
  RPC-Aufrufe ist AGE-517 und älter als dieser Change; ihn hier zu schließen
  hieße, ein zweites Thema in einen Fehlerbehebungs-Change zu ziehen. Was dieser
  Change dazu tut und was er offen lässt, steht im Proposal.
- gemini nennt synchrone Systemuhren als Voraussetzung. Alle Zeiten kommen aus
  `now()` **einer** Datenbank; es gibt keine zweite Uhr. Kein Handlungsbedarf.

---

# Code-Review über den Diff (Schritt 4)

Gelaufen am 2026-08-10, nach der Umsetzung, über `git diff main...HEAD`. Beide
Reviewer bekamen zusätzlich eine Sicherheitsbrille (`cso`-Gate): Kann jemand die
Grenze umgehen, ein Mitglied aussperren, Adressen aufzählen oder die Plattform
zum Mailverteiler machen?

## Reviewer: gemini (gemini-3-pro-preview)

VERDICT: APPROVE — ohne Befund.

## Reviewer: opencode (hf:moonshotai/Kimi-K3)

VERDICT: REQUEST-CHANGES. Hat den Diff gegen das echte Repo gelesen (Edge
Function, Migration, Gate, Provider) und den Serverteil ausdrücklich für
tragfähig erklärt — die drei Treffer liegen alle auf der Client-Seite.

- [HIGH] `activationMailStatus` wird nie geräumt. Auf einem geteilten Gerät sieht
  der nächste Nutzer „Der Link ist unterwegs. Er gilt 72 Stunden" über eine Mail,
  die an jemand anderen ging — und weil der Wert sich nicht ändert, startet nicht
  einmal die Sperrfrist neu.
- [HIGH] Nach einem `send_failed` liefert der nächste Klick innerhalb von 60 s
  `rate_limited`, weil `max(created_at)` auch entwertete Zeilen sieht. Die
  Oberfläche sagte dann „Der Link ist bereits unterwegs … schau ins Postfach"
  über eine Mail, die es nie gab.
- [MEDIUM] Der Hinweis auf `LoginPage` ist unerreichbar: `signUp` meldet die
  Sitzung an den Auth-Zuhörer, bevor es auflöst, der Navigate-Guard räumt die
  Seite ab. Der Test dazu bestand nur, weil die Attrappe keine Sitzung herstellt.
- [LOW] `already_activated` wird als Fehler eingefärbt; unbekannte Status fallen
  in eine Lücke (`MELDUNGEN[lage] === undefined`).
- [LOW] Das Stundenkontingent zählt auch nie versendete Zeilen — bei einer
  Resend-Störung brennt es ab, ohne dass ein Link ankommt.

**Ausdrücklich geprüft und für richtig befunden:** `plan(202)` = 195 + 7, die
`>`-Randwerte bei 10 min und 1 h, „Abweisung schreibt kein Token", die
Sperr-Reihenfolge (eigene Profilzeile → Riegel) als deadlockfrei, die
`strpos`-Assertion überlebt das Kommentar-Strippen, und die ehrlichen
200-Antworten verraten nichts, weil das Subjekt immer die eigene Sitzung ist.

## Resolution

- **HIGH 1** → Behoben, aber anders als vorgeschlagen. Statt den Status zu
  *räumen*, trägt er jetzt die `userId`, zu der er gehört, und wird abgeleitet —
  dieselbe Bauart, die `profile` in derselben Datei schon hat. Ein Räumen per
  Effect hätte einen Moment gelassen, in dem der alte Wert noch sichtbar ist, und
  `react-hooks/set-state-in-effect` zu Recht angeschlagen. Die Kennung kommt aus
  der **Antwort** von `signUp`, nicht aus dem Render: Beim Aufruf steht die
  Sitzung noch nicht. Test in `AuthProvider.test.tsx`, gegengeprüft — ohne den
  Fix fällt er.
- **HIGH 2** → Behoben über den Text, nicht über die Drossel. Die Meldung lautet
  jetzt „Gerade eben wurde schon ein Link angefordert" und verspricht **kein**
  Postfach. Das Szenario im Delta ist entsprechend geschärft. Die Drossel selbst
  bleibt unangetastet: Sie hängt am Zeitpunkt der Anforderung, nicht am
  Versandergebnis, und das ist richtig so — sie schützt das Kontingent, das ein
  Fehlversand ebenso verbraucht. Entwertete Zeilen aus `max(created_at)`
  auszunehmen wäre ein Eingriff in eine Grenze aus AGE-495 und gehört nicht in
  einen Fehlerbehebungs-Change.
- **MEDIUM** → Hinweis und Test **gelöscht**, samt der `info`-Zustandsvariable,
  die danach niemand mehr setzte. Der Reviewer hat recht, und der eigentliche
  Schaden war nicht der Text, sondern ein Test, der einen unerreichbaren Zustand
  bestätigte. Die Fortsetzung ist der Aktivierungsbildschirm.
- **LOW (unbekannte Status)** → Fallback auf `error` statt `undefined`.
- **LOW (Kontingent zählt Ungesendetes)** → Als Entscheidung in den
  Migrationskopf geschrieben, mit der Begründung, warum die Alternative schlechter
  ist: Ausgerechnet der Angriffsweg braucht keine Zustellung.
- **LOW (`already_activated` rot eingefärbt)** → **Nicht geändert.** Der
  Bildschirm erscheint nur, wenn `isActivated === false` ist; dieser Status ist
  von dort aus nur über ein Wettrennen mit einem zweiten Tab erreichbar. Eine
  eigene Einfärbung samt Handlungsangebot für einen Zustand, den der Weg dorthin
  fast ausschließt, wäre mehr Fläche als Nutzen. Notiert, nicht gebaut.
