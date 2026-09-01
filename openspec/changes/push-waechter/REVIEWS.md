---
reviewers: [gemini, opencode, codex]
models: [gemini (Vorgabemodell), "opencode hf:moonshotai/Kimi-K3", "codex gpt-5.6-sol"]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 55f1ca15be41077149e8438b5f930b12683e4dd46015d4d55d167d1ded6019e9
---

# Change review — push-waechter

Drei Anbieter, drei Mal REQUEST-CHANGES, 26 Befunde. Der Review lief am 01.09.
gegen Fassung 1 der Artefakte (Digest oben). Alles unten ist in Fassung 2
eingearbeitet oder mit Grund abgelehnt.

**Der teuerste Befund kam zweimal unabhängig:** das Stillstand-Signal war
strukturell blind. Es hätte den Fall, für den es diesen Wächter gibt, nicht
gesehen.

## Reviewer: gemini

VERDICT: REQUEST-CHANGES

- [HIGH] `design.md` — Der Wächter meldet sich mit `postgres` an. Ein eigener
  Lese-Benutzer mit `select` auf die drei Tabellen wäre das geringere Recht.
- [MEDIUM] `design.md` — Bis zu 90 Minuten bis zur Erkennung ist zu lang; Takt
  15 min, Fenster 30 min.
- [MEDIUM] `tasks.md 4.1` — Zwei Workflow-Dateien statt zwei Jobs, damit
  DEV- und PROD-Mails unterscheidbar sind.
- [LOW] `tasks.md 3.2` — Die cron-Erwartungen gehören in eine
  Konfigurationsdatei statt in den Code.

Annahmen, die es benannt hat: die Zuverlässigkeit von `schedule:`; dass jemand
auf die Mails reagiert; dass `pg_cron` der häufigste `net.http_post`-Aufrufer
ist.

## Reviewer: opencode (hf:moonshotai/Kimi-K3)

VERDICT: REQUEST-CHANGES — 11 Befunde, 3 HIGH.

- [HIGH] `proposal.md` gegen `design.md` — direkter Widerspruch: das Proposal
  legte den Drift-Scan in `migrate-dev`, das Design verwarf genau das.
- [HIGH] Stillstand aus `net._http_response` ist nicht zurechenbar — eine
  einzige Kontaktanfrage im Fenster macht das Signal grün, während der
  Minutentakt tot ist. „Der Entwurf feiert die URL-Losigkeit als Bonusabdeckung
  und übersieht, dass sie das Stille-Signal entwertet."
- [HIGH] Das Szenario verlangt „erreicht im Fenster den Zustand `aufgegeben`",
  geprüft wird `created_at` — ohne Beleg, dass die Staffelung immer kürzer als
  das Fenster ist.
- [MEDIUM] Keine Aufgabe verdrahtet den Drift-Scan in den neuen Workflow.
- [MEDIUM] `workflow_dispatch` belegt den falschen Meldeweg.
- [MEDIUM] 90/60 trägt nur 30 Minuten Verspätung; die Zusage „keine Lücke" hält
  nicht.
- [MEDIUM] Ein andauernder Ausfall erzeugt stündlich Mails ohne Entprellung.
- [MEDIUM] Der erweiterte Scan blockiere künftig den Frontend-Deploy.
- [LOW] Laufzeitumgebung des Workflows unspezifiziert.
- [LOW] Der Selbstausfall des Wächters ist kein Befund.
- [LOW] `pg_net.ttl` wird einmal gemessen, nie überwacht.
- [LOW] 360 statt 720 Zeilen ist unerklärt.

## Reviewer: codex (gpt-5.6-sol)

VERDICT: REQUEST-CHANGES — 11 Befunde, 5 HIGH. Drei davon hat kein anderer Arm
gesehen.

- [HIGH] Stillstand nicht zurechenbar — wie opencode, plus die Gegenrichtung:
  ein Mail-Fehler rötet den *Push*-Wächter.
- [HIGH] `created_at` ist nicht der Übergangszeitpunkt — **und** ein weiterhin
  ungelöster Ausfall wird nach Ablauf des Fensters wieder grün.
- [HIGH] Aus `schedule: stündlich` folgt kein Takt; die SHALL-Aussage „keine
  Lücke" ist nicht erfüllbar. Vorschlag: fortgeschriebener Merkpunkt.
- [HIGH] Der cron-Teil des Scans prüft nur Name, Zeitplan, `active` — ein
  Eintrag mit richtigem Namen und leerem Befehl bliebe grün, ein
  abgeschalteter Trigger (`tgenabled`) ebenso. Das widerspricht „ein
  **verändertes** Objekt SHALL auffallen".
- [HIGH] Die Spec erlaubt nur Aggregate und verlangt im selben Atemzug
  `letzter_fehler` — der ist Freitext aus `e.message` und kann eine APNs-URL
  mit Gerätetoken tragen.
- [MEDIUM] Eine beliebige Antwort im Fenster genügte für Grün; und die
  Begründung gegen eine Mindestmenge war falsch, weil die Abfrage an die
  Datenbankzeit gebunden ist, nicht an den vorherigen Actions-Lauf.
- [MEDIUM] Der Proposal/Design-Widerspruch (wie opencode).
- [MEDIUM] `pg_net.ttl` ungeprüft (wie opencode).
- [MEDIUM] `db-drift-scan.ts` fällt ohne Argument auf PROD zurück — ein Job je
  Seite könnte PROD zweimal prüfen und DEV nie, beide Male grün.
- [MEDIUM] Ein „winziges Fenster" erzeugt Stille nicht deterministisch.
- [LOW] Die Objektzählung stimmt nicht: `ERWARTET_OHNE_MIGRATION` hat fünf
  Namen, und `beitrag-ankuendigen` wird erwartet, aber nicht spezifiziert.

## Nicht gezählt

Keiner. Alle drei Arme haben eine Befundliste geliefert. `claude` wurde nicht
gefragt — es ist der Anbieter, der die Artefakte geschrieben hat.

## Auflösung

### Übernommen

| Befund | Was sich geändert hat |
| --- | --- |
| Stillstand nicht zurechenbar (opencode + codex, HIGH) | Das Signal liest jetzt `cron.job_run_details` ⋈ `cron.job`, benennt also den Lauf. `net._http_response` trägt nur noch das Antwort-Signal, und dessen Befund heißt „ein `net.http_post` hat nicht 200 geantwortet", nicht „Push ist kaputt" |
| Proposal/Design-Widerspruch (beide, HIGH/MEDIUM) | Proposal §1 sagt jetzt dasselbe wie Design: der Scan läuft im Wächter, `migrate-dev` bleibt unangetastet |
| `letzter_fehler` in der Ausgabe (codex, HIGH) | Gestrichen. Gemeldet wird die **Anzahl** aufgegebener Zustellungen. Zusage 1.4 prüft es mit |
| cron-Befehl und `tgenabled` ungeprüft (codex, HIGH) | Der Scan vergleicht Name, Zeitplan, Aktivzustand **und** Befehl, und prüft `tgenabled` bei Triggern. Gemessen: die Befehle tragen weder Bearer noch URL, dürfen also verglichen werden |
| „keine Lücke" ist nicht haltbar (beide, HIGH/MEDIUM) | Die Zusage ist ersetzt: 120-Minuten-Fenster bei stündlichem Takt trägt **60 Minuten** Verzug — eine benannte Toleranz, keine Garantie. Der Merkpunkt steht als offene Grenze |
| `created_at` als Ersatz für die Zustandszeit (beide, HIGH) | Die Staffelung ist jetzt **gerechnet** und steht im Entwurf: 1+2+4+8 = 15 min plus Minutenraster, aus `20260827240000:309-313`. Das Fenster muss diese Dauer übersteigen — als SHALL in der Spec |
| Drift-Scan nirgends verdrahtet (opencode, MEDIUM) | Neue Aufgabe 4.2 |
| PROD-Rückfall ohne Argument (codex, MEDIUM) | Pflicht-Parameter `dev\|prod`, Zielkontrolle im Log, Aufruf in `migrate-prod.yml` mitgezogen. Aufgabe 3.4 |
| `pg_net.ttl` ungeprüft (beide) | Der Läufer misst sie bei jedem Lauf und schlägt fehl, wenn sie das Fenster nicht übersteigt. Aufgabe 2.4 |
| Selbstausfall ist kein Befund (opencode, LOW) | Vierter Befund „Messausfall", ausdrücklich getrennt vom Stillstand. Zusagen 1.1 und 1.5 |
| Mindestmenge fälschlich verworfen (codex, MEDIUM) | Der Stillstand hat jetzt **zwei** Bedingungen: Alter des jüngsten Laufs (> 15 min) und Mindestmenge (< Hälfte der erwarteten). Meine Begründung dagegen war falsch, und codex hat gesagt warum |
| „winziges Fenster" nicht deterministisch (codex, MEDIUM) | Der rote Beleg läuft über Höchstpause `0`, nicht über ein kleines Fenster. Aufgabe 2.3 |
| Falscher Meldeweg belegt (opencode, MEDIUM) | Aufgabe 4.3 trennt beides und sagt, was der Dispatch-Lauf **nicht** belegt |
| Laufzeit unspezifiziert (opencode, LOW) | `pnpm/action-setup`, Node 22, `pnpm install --frozen-lockfile` — wie in `deploy.yml`. Aufgabe 4.1 |
| 360 statt 720 unerklärt (opencode, LOW) | `beitrag-ankuendigen` „ruft kein `net.http_post`" — wörtlich in `20260829090000:317`. Steht jetzt im Proposal |
| Objektzählung falsch (codex, LOW) | Korrigiert: fünf Namen plus zwei Zeitplanungen. Beide Zeitpläne stehen jetzt im Spec-Delta |
| Erkennungszeit (gemini, MEDIUM) | Teilweise: das Fenster wächst auf 120 min und die Erkennung hängt jetzt am Alter des jüngsten Laufs (> 15 min), nicht mehr am ganzen Fenster. Der Takt bleibt stündlich, siehe unten |

### Abgelehnt, mit Grund

**[gemini HIGH] Eigener Lese-Benutzer statt `postgres`.** Auf dieser Plattform
nicht umsetzbar, gemessen auf DEV: `net._http_response` gehört `supabase_admin`,
`postgres` darf lesen, aber **nicht weitergeben** (`SELECT WITH GRANT OPTION` =
false) und ist nicht Mitglied von `supabase_admin`. Ein eigener Benutzer bekäme
auf die entscheidende Tabelle kein Recht und deckte eins von vier Signalen ab —
für einen vierten Zugangsschlüssel in zwei Verwaltungen. Die Sorge bleibt
trotzdem wahr und steht unter „Was offen bleibt".

**[gemini MEDIUM] Takt 15 Minuten.** Vervierfacht die roten Läufe eines
andauernden Ausfalls: der Vorfall vom 28.–31.08. hätte stündlich rund 72 rote
Läufe erzeugt, im 15-Minuten-Takt rund 288. Die Vergleichsgröße ist nicht
„90 Minuten gegen 30", sondern **zwei Stunden gegen drei Tage**. Der Teil der
Sorge, der trägt — wie alt darf das jüngste Lebenszeichen sein — ist über die
15-Minuten-Höchstpause übernommen.

**[gemini MEDIUM] Zwei Workflow-Dateien.** Verdoppelt die YAML für einen
Unterschied, den die Lauf-Seite ohnehin zeigt. Ein Job je Seite trennt die
Befunde bereits; erweist sich die Mail als zu grob, ist das Aufteilen ein
Einzeiler.

**[gemini LOW] cron-Erwartungen in eine Konfigurationsdatei.** Eine Datei für
einen Verbraucher ist genau die Abstraktion, die `CLAUDE.md` verbietet. Die
Liste steht neben `ERWARTET_OHNE_MIGRATION`, wo die gleichartige schon steht.

**[opencode MEDIUM] Der erweiterte Scan blockiert den Frontend-Deploy.** Am
Mechanismus nachgemessen und nicht zutreffend: `deploy.yml:228` fährt
`migration-drift-gate.ts` (Migrationshistorie), der Objekt-Scan steht allein in
`migrate-prod.yml:152`, einem eigenen Workflow ohne `deploy`-Kopplung. Die
**Entscheidung**, die der Befund einfordert, ist trotzdem getroffen und steht
als Aufgabe 3.5.

**[opencode MEDIUM / codex HIGH] Entprellung, und „nach 90 Minuten wieder
grün".** Beide verlangen Zustand — einen Merkpunkt oder eine Quittierung. Der
Wächter hat bewusst keinen, und ein Ablageort, den ein `db reset` nicht
mitnimmt, wäre ein eigener Entwurf. Wiederholte Meldungen zu einem *echten*
offenen Ausfall sind außerdem nicht die Alarm-Müdigkeit, vor der beide warnen;
die entsteht aus Meldungen ohne Befund. **Die Flankensteuerung bleibt damit
eine echte, benannte Grenze** und steht unter „Was offen bleibt" — nicht
weggeschrieben.

**[codex HIGH, Teil] Funktionsrümpfe vergleichen.** Der Scan bleibt eine
Namens-Heuristik; seine fünf blinden Flecken stehen seit dem 05.08. in seinem
eigenen Kopf. Statt sie zu schließen, ist die geänderte Anforderung jetzt
**genau auf das begrenzt, was der Scan wirklich prüft** — mit dem Satz, was er
nicht leistet.

## Was der Review nicht ersetzt

Zwei der drei Arme haben Behauptungen aufgestellt, die erst eine Messung
entschieden hat: geminis HIGH (widerlegt) und opencodes MEDIUM zum Deploy
(widerlegt). Umgekehrt hat codex zwei Dinge gefunden, die keine Messung gezeigt
hätte, weil sie im Text standen — der Spec-Widerspruch um `letzter_fehler` und
der PROD-Rückfall. Beides zusammen ist der Grund, warum dieser Schritt vor der
ersten Codezeile steht.

Der Gate-Trailer fehlt, wie in jedem `REVIEWS.md` dieses Repositories. Er würde
den Review per Digest an Artefakte binden, die dieser Review gerade geändert
hat; von Hand nachgetragen behauptete er eine Bindung, die es nie gab.
