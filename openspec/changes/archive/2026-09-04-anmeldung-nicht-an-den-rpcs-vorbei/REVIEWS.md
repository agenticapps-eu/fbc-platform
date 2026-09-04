---
reviewers: [gemini, codex]
models: [gemini-cli-default-nicht-angepinnt, gpt-5.6-sol]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 4884284b7bfd1a8812aa935648932290de4961d773bef87034334971a999bd46
---

# Change review — anmeldung-nicht-an-den-rpcs-vorbei

Zwei Anbieter, beide **nicht** der umsetzende Host (`claude`). Gelaufen über
`~/.agenticapps/bin/reviewer-cli.sh` mit `REVIEWER_TIMEOUT=900`, je Exit 0. Der
`reviewed_artifacts_sha` ist die Prüfsumme des zusammengesetzten Prompts, also
der Fassung der Artefakte, die den Reviewern vorlag — **vor** den Einarbeitungen
unten.

**Beide Verdikte: REQUEST-CHANGES.** Drei HIGH-Befunde, alle am Quelltext
nachgeprüft, alle zutreffend. Zwei davon hätten den Change als Ganzes falsch
gemacht; einer hätte einen produktiven Weg gebrochen, während meine eigenen
Positivkontrollen grün geblieben wären.

## Reviewer: gemini

Modell nicht angepinnt — der `gemini`-Arm des Wrappers gibt kein `-m` mit und die
CLI nennt das aufgelöste Modell im Lauf nicht. Regel 4 des Skills (*das
aufgelöste Modell festhalten*) ist damit hier **nicht erfüllt**; festgehalten
statt stillschweigend übergangen.

**VERDICT: REQUEST-CHANGES**

- **[MEDIUM] D3 / Aufgabe 4.3 — der Trigger ist fail-OPEN, nicht fail-closed.**
  Die Bedingung `current_user = 'authenticated'` greift nur für genau diese
  Rolle; eine neue Rolle mit ähnlichen Rechten liefe daran vorbei. Fix: umdrehen
  — blockieren für jeden, der nicht der Eigentümer ist.
- **[LOW] Open Questions — `→ waitlist` direkt zu erlauben** etabliert einen
  zweiten, manuellen Weg auf die Warteliste, der die Geschäftslogik der RPC nicht
  durchläuft.
- **[LOW] D4 / Aufgabe 4.1 —** `for update` ist die richtige Wirkung, aber der
  Grund („UPDATE erlauben, INSERT und DELETE verbieten") steht nicht ausdrücklich
  da.

## Reviewer: codex (gpt-5.6-sol)

**VERDICT: REQUEST-CHANGES**

- **[HIGH] D3 —** `current_user` bezeichnet den Benutzer, nicht den Pfad. Jede
  andere `postgres`-eigene Definer-Funktion dürfte den Trigger ebenfalls
  umgehen; ein Eigentümerwechsel oder `SECURITY INVOKER` sperrte umgekehrt den
  legitimen RPC. Und „greift nur bei `authenticated`" widerspricht „alle anderen
  fallen geschlossen aus". Fix: die **Kapazitätsinvariante rollenunabhängig** im
  Trigger prüfen; `current_user` höchstens zusätzlich.
- **[HIGH] proposal.md / What Changes — die Zusage bleibt falsch.** Ein Host kann
  `events.capacity` unter die bestehende Belegung senken; das Feld wird von
  `updateEvent` regulär geschrieben. **Nachgeprüft: zutrifft** —
  `src/lib/events.ts:601` schreibt den Patch aus `eventPatch(input)`, und der
  enthält `capacity`. Fix: entweder Kapazitätsänderungen absichern, oder die
  Zusage ausdrücklich auf „neue Anmeldungen erzeugen keine Überbuchung"
  begrenzen.
- **[HIGH] tasks.md / 6.1–6.2 — die Positivkontrollen prüfen nur den
  INSERT-Zweig.** `register_for_event` endet auf
  `insert … on conflict (event_id, profile_id) do update set status = excluded.status`
  — eine Wiederanmeldung nach dem Absagen läuft also über UPDATE, genau dort, wo
  der neue Trigger feuert. **Nachgeprüft: zutrifft, wörtlich** im Rumpf der
  Funktion (`20260806080100:612-615`). Der Change hätte die legitime
  Wiederanmeldung sperren können, während 6.1 und 6.2 grün bleiben. Fix: je eine
  bestehende `cancelled`- und `waitlist`-Zeile über den RPC nach `registered`
  bringen und den Endzustand prüfen.
- **[MEDIUM] Ein VIERTER Bypass:** eine eigene `registered`-Zeile lässt sich auf
  ein anderes, volles `event_id` verschieben — `registered → registered`, der
  Übergangstrigger sieht nichts. Die Spaltenliste sperrt es nebenbei, aber nichts
  prüft es. Auch `cancelled → registered` ist ungetestet.
- **[MEDIUM] D1 / proposal.md — `revoke update (checked_in)` ist wirkungslos**,
  solange das Tabellenrecht besteht. `design.md` hat die richtige Form
  (Tabellenrecht entziehen, dann Spalten zurückgeben), der **Vorschlag** nannte
  die falsche. Ausserdem: die `grep`-Suche über `src/` beweist die Abwesenheit
  anderer Verbraucher nicht.
- **[MEDIUM] D4 —** `authenticated` behält INSERT und DELETE als *Tabellenrecht*;
  nur die Policy hält sie ab. Das widerspricht der Begründung, mit der bei
  `checked_in` ausdrücklich ein Recht statt einer Bedingung gewählt wurde.
- **[MEDIUM] Aufgabe 2.1 — der PROD-Check kann Selbst-Check-ins nicht
  erkennen.** `checked_in = true` an der Zeile eines Nicht-Hosts ist der
  Normalzustand nach einem legitimen Host-Check-in; die Zeile speichert den
  Handelnden nicht.
- **[MEDIUM] Aufgabe 4.3 — der `revoke execute` auf der neuen Triggerfunktion
  fehlt.** Neue Funktionen bekommen EXECUTE über `PUBLIC`; die geschlossene
  Funktionsliste in `grants_test.sql` wird dadurch rot.
- **[MEDIUM] Spec-Delta —** das Szenario verspricht Abmelden und Bewerten jedem
  aktivierten Mitglied. Die Policy verlangt aber `has_level(4)`, während der RPC
  öffentliche Events schon ab `basic` und Mitglieder-Events ab `has_level(3)`
  zulässt. Diese Mitglieder können sich anmelden, aber nicht direkt absagen.
- **[LOW] tasks.md / Gruppe 3 — das ist keine RED-Gruppe**, sondern eine
  Zustandsmessung mit später umgedrehter Erwartung.

## Resolution

| Befund | Was daraus wurde |
|---|---|
| HIGH — Trigger fail-open (beide Reviewer) | **Übernommen und umgedreht.** Der Trigger prüft die Kapazitätsinvariante **rollenunabhängig**; `current_user` wird gar nicht mehr als Weg-Unterscheidung benutzt. Damit fällt D3 in seiner alten Form weg. |
| HIGH — Host senkt `capacity` | **Zusage wird eingegrenzt**, nicht der Change vergrössert. Kapazitätsänderungen durch den Host sind ein anderer Vorgang mit einem anderen Handelnden; hier gilt künftig „**neue Anmeldungen und Statuswechsel** erzeugen keine Überbuchung". Als eigener Befund für Donald notiert. |
| HIGH — Upsert im RPC bricht bei Wiederanmeldung | **Übernommen.** Die Positivkontrollen decken jetzt ausdrücklich `cancelled → registered` und `waitlist → registered` **über den RPC**. Das war der Fall, den meine Fassung nicht gesehen hätte. |
| MEDIUM — vierter Bypass (`event_id` wechseln) | **Übernommen.** `event_id`, `profile_id`, `id`, `created_at` werden ausdrücklich als nicht aktualisierbar geführt und geprüft. |
| MEDIUM — `revoke update (checked_in)` wirkungslos | **Übernommen**, der Vorschlag wird auf die Form aus `design.md` korrigiert. |
| MEDIUM — INSERT/DELETE nur per Policy | **Übernommen**, beide werden auch auf Grant-Ebene entzogen. |
| MEDIUM — PROD-Check auf Selbst-Check-ins unmöglich | **Übernommen.** Gemessen wird nur noch Überbuchung; die Nicht-Messbarkeit der Check-ins wird benannt statt behauptet. |
| MEDIUM — `revoke execute` auf der Triggerfunktion | **Übernommen** als eigene Aufgabe und eigene Zusage. |
| MEDIUM — `has_level(4)` vs. RPC-Schwelle | **Übernommen**, aber nur als **Benennung**: das Szenario wird auf `exchange` und höher begrenzt. Die Schwellen anzugleichen wäre eine Rechteänderung und gehört nicht in diesen Change. Als Befund für Donald notiert. |
| LOW — Gruppe 3 ist keine RED-Gruppe | **Übernommen**, sie heisst jetzt, was sie ist: Ausgangsmessung. Die dauerhaften Zusagen werden mit der Enderwartung geschrieben und vor der Migration rot nachgewiesen. |
| LOW — `→ waitlist` | **Übernommen**, auch dieser Übergang wird gesperrt. |
| LOW — `for update` unbegründet | **Übernommen**, steht jetzt ausdrücklich da. |

**Zwei Befunde gehören Donald und sind keine reine Textänderung:** dass ein Host
die Kapazität unter die Belegung senken kann, und dass Mitglieder unterhalb von
`exchange` sich anmelden, aber nicht direkt absagen können. Beide sind Bestand,
nicht durch diesen Change entstanden.

---

# Diff-Review (2026-09-04, Aufgabe 9.5)

Zwei fremde Anbieter auf dem fertigen Diff (909 Zeilen), nach dem Umbau auf zwei
Trigger. **Beide APPROVE.**

| Arm | Modell | Ergebnis |
|---|---|---|
| `opencode` | `hf:moonshotai/Kimi-K3` | APPROVE, 3 × NIEDRIG — hat die Trigger in einer eigenen Miniaturtabelle **nachgebaut und gemessen**, statt den Diff nur zu lesen |
| `gemini` | Standardmodell (ohne `-m`) | APPROVE, 1 × NIEDRIG |

Kein Befund über NIEDRIG, und keiner der vier Wege wurde als offen gemeldet.

## Befunde und was daraus wurde

| Befund | Arm | Was daraus wurde |
|---|---|---|
| **NIEDRIG — Schicht 1 zählt ohne Sperre.** Unter READ COMMITTED können zwei gleichzeitige Schreiber bei `belegt = capacity - 1` beide durchgehen; die Zusage „Schicht 1 hält allein" wäre dann überzeichnet. | opencode | **Übernommen, und zwar durch die Sperre statt durch eine schwächere Zusage.** Schicht 1 liest die `events`-Zeile jetzt `for update`. Auf dem RPC-Weg kostet das nichts — `register_for_event` hält dieselbe Sperre bereits. **Nachgemessen mit zwei Sitzungen:** B läuft an genau dieser Zeile in den `lock_timeout` (`while locking tuple … in relation "events"`), statt zu überbuchen. |
| **NIEDRIG — `tasks.md` 8.1 erwartet „eine Funktion kommt dazu" im Golden-Snapshot**, der Diff ändert dort aber nur die Tabellenrechte. | opencode | **Übernommen — die Erwartung war falsch.** Abschnitt 6 von `grants_test.sql` führt die Funktionen, die **`anon` ausführen darf**; die beiden neuen bekommen den `revoke execute` und erscheinen deshalb zu Recht nicht. Am vollständigen Testkopf nachgesehen und `tasks.md` 8.1 korrigiert. Rot wurde genau eine Zeile. |
| **NIEDRIG — Blindspot des Diffs:** die tragende `if`-Bedingung von `…_exklusiv` und der NULL-`capacity`-Zweig stehen teils in unverändertem Kontext und sind aus dem Diff allein nicht verifizierbar. | opencode | **Kein Defekt, aber richtig beobachtet.** opencode hat es durch den Nachbau kompensiert; im Repo decken es die Zusagen ab (Weg B für die Bedingung, die Positivkontrollen für den NULL-Zweig). Hier festgehalten, weil es eine Aussage über die Review-METHODE ist, nicht über den Code. |
| **NIEDRIG — die Trigger-Reihenfolge hängt an der alphabetischen Sortierung der Namen** und ist damit implizit statt deklariert. | gemini | **Kein Änderungsbedarf, und gemini sagt das selbst:** „Das Verhalten wird in der Dokumentation explizit gemacht und eine Testzusage pinnt die resultierende Fehlermeldung fest … Die Konstruktion ist daher als tragfähig zu bewerten." Postgres garantiert die Reihenfolge; Migrationskopf, `design.md` und Spec-Delta benennen sie, und Zusage 2 wird bei einer Umbenennung rot. |

## Was der Diff-Review NICHT geleistet hat

**Den teuersten Fehler dieses Changes hat kein Reviewer gefunden — er war beim
Diff schon behoben.** Dass Schicht 1 als `SECURITY INVOKER` unter der RLS des
Schreibenden zählte und damit fail-OPEN war, kam aus dem **Lauf gegen die
Datenbank**, nicht aus einer Review. Die Planungs-Review konnte ihn nicht sehen
(sie prüfte einen Entwurf ohne RLS-Kontext), und der Diff-Review sah bereits die
Korrektur.

Das ist die Lehre dieses Changes: **eine Migration, die nie gegen eine Datenbank
gelaufen ist, ist ungeprüft** — auch wenn zwei fremde Anbieter ihren Plan
abgesegnet haben.

<!-- Kein signierter Gate-Trailer: dieser Abschnitt ist von Hand geschrieben,
     die Reviewer wurden direkt per Bash gerufen. Das Gate meldet die Datei als
     `trailer-absent`; es blockt nichts, aber sie zaehlt dort nicht als
     verifizierbar. Gilt fuer JEDE REVIEWS.md dieses Repos. -->
