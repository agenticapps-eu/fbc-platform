---
reviewers: [gemini, codex]
models: [gemini-cli-default-nicht-ermittelbar, gpt-5.6-sol]
verdicts: [APPROVE, REQUEST-CHANGES]
reviewed_artifacts_sha: 261d21b83f351d4e9ce25ff48d49cf6a613669c41a043b0f9b6d5d3941a637b2
---

# Change review — fix-frontend-routing-zwei-werte

Beide Reviewer sind fremder Anbieter; der eigene (claude) ist ausgeschlossen und
wurde nicht aufgerufen. Zeitlimit 900 s statt der voreingestellten 300 s — codex
brauchte deutlich mehr als 300 s und wäre sonst als exit 4 ungezählt geblieben.

**Zum Modellnamen von gemini:** der Wrapper pinnt kein Modell, und weder die
Ausgabe noch `~/.gemini/settings.json` nennen das aufgelöste. Hier steht deshalb
„nicht ermittelbar" statt einer plausibel klingenden Versionsnummer. Die Regel
verlangt das aufgelöste Modell; wo es nicht zu ermitteln ist, ist das die
ehrliche Eintragung.

## Reviewer: gemini (Modell nicht ermittelbar)

VERDICT: APPROVE — keine Befunde.

Drei ausdrücklich benannte Annahmen, alle drei nachgemessen statt übernommen:

1. Die greps nach `SUPABASE_DB_PASSWORD` seien vollständig. → gehalten.
2. Vite backe nur `VITE_`-präfigierte Werte ein. → am Bundle belegt (Abschnitt 5
   des Belegs), nicht nur an der Dokumentation.
3. Das Frontend-Routing sei vollständig in `src/lib/supabase.ts` enthalten. →
   nachgeprüft: genau ein `createClient` im Frontend, kein `supabase.co`-Literal
   in `src/`. Steht als Abschnitt 4 im Beleg.

## Reviewer: codex (gpt-5.6-sol)

VERDICT: REQUEST-CHANGES — sechs Befunde.

- **[HIGH] Hauptspec / „Das Aufsetzen von PROD lenkt keinen Verkehr um"** — eine
  zweite normative Stelle verlangt weiterhin „die drei Frontend-Werte"; nach dem
  Archivieren widerspräche der Hauptspec sich weiter selbst.
- **[MEDIUM] `docs/supabase-environments.md`** — Zeile „Umzug der drei
  prod-Werte" widerspricht der Anleitung darüber; die Proposal-Behauptung, das
  Runbook sei durchgehend richtig, ist falsch.
- **[MEDIUM] `tasks.md` 3.1** — `grep -rn "drei Werte"` findet weder „drei
  Frontend-Werte" noch „drei prod-Werte" und hat genau die zwei verbliebenen
  Fehler übersehen.
- **[MEDIUM] Spec-Delta / abschließende Aufzählung** — „`SUPABASE_DB_URL_PROD`
  bestimmt die Datenbankverbindung" ist zu allgemein (DEV nutzt
  `SUPABASE_DB_URL_DEV`), und das fehlende `VITE_`-Präfix garantiert für sich
  keine dauerhafte Nichtaufnahme.
- **[MEDIUM] Spec-Delta / neues Szenario** — „WHEN geprüft wird" ist keine
  überprüfbare Situation; das Szenario wiederholte nur die Behauptung.
- **[LOW] `tasks.md` / Abschluss** — keine Kontrolle nach dem Archivieren, und
  Commit-Konvention samt Linear-Status fehlen.

## Nicht gezählt

Keiner. Beide Reviewer liefen mit exit 0.

## Resolution

**Alle sechs übernommen — aber keiner ungeprüft.** Jeder wurde erst am Quelltext
nachgemessen, wie beim vorigen Change (AGE-576), wo von zehn codex-Befunden vier
trugen und sechs nicht.

| Befund | Nachgemessen | Folge |
|---|---|---|
| HIGH, zweite Stelle | **bestätigt**, `spec.md:71-72` | zweite Anforderung als MODIFIED aufgenommen, Szenariotitel unverändert |
| MEDIUM, Runbook | **bestätigt**, `supabase-environments.md:578` | Zeile korrigiert; die falsche Behauptung im Proposal zurückgenommen |
| MEDIUM, grep zu eng | **bestätigt** — und Ursache der ersten beiden | 3.1 sucht jetzt mehrzeilig nach Varianten |
| MEDIUM, zu allgemein | **bestätigt**, `SUPABASE_DB_URL_DEV` existiert | Mechanismus-Begründung raus; die Anforderung fordert jetzt, statt zu erklären |
| MEDIUM, nicht prüfbar | **berechtigt** | Szenario am Bundle formuliert **und** einmal wirklich gemessen |
| LOW, Abschluss | **berechtigt** | 5.3 (validate nach dem Archivieren), 5.4 (Commit), 5.5 (Linear) ergänzt |

**Der HIGH-Befund ist der Wert dieses Reviews.** Ohne ihn wäre eine Change
gemergt worden, die einen Selbstwiderspruch behebt und einen zweiten,
gleichlautenden stehen lässt — und deren eigene Gegenprobe bestätigt hätte, es
sei keiner mehr da. Die Ursache ist übertragbar und steht darum im Proposal:
**eine zeilenweise Suche über hart umbrochenen Fließtext ist keine
Vollständigkeitsprüfung.**

## Was nach dem Review am Prüfstand steht

Die Artefakte wurden nach diesen Befunden geändert; der oben eingetragene
`reviewed_artifacts_sha` beschreibt den Stand **vor** den Korrekturen. Er wird
bewusst nicht nachgezogen — er soll sagen, was die Reviewer gesehen haben, nicht
was daraus wurde.

Zwei von codex' unausgesprochenen Annahmen bleiben ausdrücklich **offen**, weil
sie außerhalb des Repositories liegen und dieser Diff sie nicht schließen kann:

- Ob `SUPABASE_DB_PASSWORD` in Infisical `prod` wirklich noch zum alten Projekt
  gehört. Das Runbook sagt es; nachgemessen ist es hier nicht.
- Ob der Demo-Seed dauerhaft auf `dev` beschränkt bleibt — die Bibliothek
  erzwingt es nicht, nur die `package.json`-Skripte tun es.

Beides betrifft die Secret-Verwaltung, nicht die korrigierte Anforderung.
