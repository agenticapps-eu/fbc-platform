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
