---
reviewers: [codex, gemini, opencode]
models: ["codex gpt-5.6-sol", "gemini (Vorgabemodell)", "opencode hf:moonshotai/Kimi-K3"]
verdicts: [REQUEST-CHANGES, APPROVE, NICHT-GEZAEHLT]
gegenstand: git diff main...HEAD, 2677 Zeilen, Stand 6f6e37f
---

# Diff-Review — push-waechter

Schritt 4 des Ablaufs: ein unabhängiger Leser prüft den **Diff**, nicht den
Plan. Der Plan-Review liegt daneben in `REVIEWS.md`.

**Die zwei Verdikte gehen auseinander, und codex hat recht.** gemini hat mit
APPROVE und einem LOW geantwortet; codex mit REQUEST-CHANGES und neun Befunden,
von denen acht behoben sind. Einer davon war ein Fehler, den **die Plan-Review
selbst erzeugt hat** — siehe unten.

## Reviewer: codex (gpt-5.6-sol)

VERDICT: REQUEST-CHANGES — 4 HIGH, 5 MEDIUM.

| | Befund |
| --- | --- |
| HIGH | `push-waechter.logic.ts` — eine leere Antwortmenge gilt als gesund. Steht der pg_net-Arbeiter, bleiben die cron-Läufe `succeeded`, es entsteht keine Fehlerantwort, und der Wächter bleibt dauerhaft grün. |
| HIGH | Das Aufgabe-Signal zählt nur vorhandene Zeilen. `push_zustellungen` hängt an zwei `on delete cascade`; eine aufgegebene Zustellung kann vor dem nächsten Lauf spurlos verschwinden. |
| HIGH | `push-waechter.ts` — weder `connectionTimeoutMillis` noch `query_timeout`. node-postgres wartet unbegrenzt; bei einem schwarzen Loch wird der `messausfall`-Zweig nie erreicht, und `cancel-in-progress: false` blockiert jeden folgenden Lauf. |
| HIGH | `db-drift-scan.logic.ts` — der Teilstringvergleich akzeptiert `select 1 /* public.push_wiederholung( */`. Genau die ausgehöhlte Zeitplanung bliebe grün. |
| MEDIUM | Die Zeitplan-Prüfung läuft nur über die *erwarteten* Namen; ein unbekannter cron-Job erzeugt keinen Befund. |
| MEDIUM | `tgenabled <> 'O'` meldet auch `A` („always") als abgeschaltet — falscher Befund. |
| MEDIUM | Die rohe Fehlermeldung geht unverändert in ein öffentliches Protokoll; „ausschließlich Aggregate" ist damit nicht durchgesetzt. |
| MEDIUM | Die Datenschutz-Zusage ist teilweise vakuum-grün: `select *` passiert eine Verbotsliste von Spaltennamen, und eine Zusage prüfte nur das selbst gebaute Testobjekt. |
| MEDIUM | Die TLS-Ausnahme sucht `localhost` in der **ganzen** Verbindungs-URL; ein Passwort mit dieser Zeichenfolge schaltete die Serverprüfung gegen den echten Host ab. |

## Reviewer: gemini

VERDICT: APPROVE

- [LOW] `push-waechter.ts` — uneinheitliche Exit-Codes: `2` bei
  Konfigurationsfehlern, `1` bei Befunden; `db-drift-scan.ts` nimmt durchgehend
  `1`.

Genannte Annahmen: die Zuverlässigkeit von `schedule:`; dass `postgres` seine
Leserechte behält; dass cron-Befehle nie ein Geheimnis tragen; dass die
Projekt-Ref-Dateien gepflegt bleiben. Alle vier stehen im Entwurf.

## Nicht gezählt

- **opencode** — Exit 0, aber nur 43 Byte Ausgabe (die Baumeldung
  `> build · hf:moonshotai/Kimi-K3`), keine Befundliste. Dasselbe Bild wie im
  Plan-Review. Ein Reviewer, der nichts sagt, ist keine Freigabe.

## Auflösung

### Behoben — acht von neun

| Befund | Was sich geändert hat | Beleg |
| --- | --- | --- |
| Leere Antwortmenge gilt als gesund (HIGH) | Neuer Befund **`stumm`**: läuft der Takt, kommen aber weniger als halb so viele Antworten zurück wie Läufe, ist das ein Befund. Vier Zusagen, darunter die Abgrenzung gegen `stillstand` | 33 Zusagen grün |
| Keine Zeitgrenzen (HIGH) | `connectionTimeoutMillis: 15 s`, `query_timeout: 30 s` am Client, `timeout-minutes: 10` je Job | — |
| Teilstringvergleich (HIGH) | Vollständiger Vergleich des **normalisierten** Befehls (Kleinschreibung, Leerraum weg, Semikolon weg). Zwei Zusagen: der Kommentar-Fall rötet, Leerraum und Semikolon tun es nicht | gegen beide Instanzen grün nachgefahren |
| Unbekannte cron-Jobs (MEDIUM) | Symmetrischer Vergleich; ein Job ohne Erwartung ist `unbekannt` | — |
| `tgenabled = 'A'` (MEDIUM) | Nur noch `D` und `R` gelten als tot. `A` feuert **auch** als Replikat, ist also aktiver als der Normalfall — und dieses Projekt legt Trigger bewusst über `session_replication_role` still, der Wert kommt hier vor | — |
| Rohtext im Protokoll (MEDIUM) | `fehlerkennung()` nimmt den **Fehlercode** (`ECONNREFUSED`, `28P01`), nie den Meldungstext. Gegenprobe gefahren: die Ausgabe lautet jetzt `ECONNREFUSED` statt `connect ECONNREFUSED 127.0.0.1:1` | echter Lauf |
| Vakuum-grüne Datenschutz-Zusage (MEDIUM) | Zusätzliche Zusage je Abfrage gegen eine Stern-Auswahl (`select *`, `r.*`, `, *`) — `count(*)` und die Multiplikation bleiben erlaubt. `token_id` in der Verbotsliste durch `token` ersetzt (fängt beides). Die vakuum-grüne Zeile ist **entfernt**, mit Begründung an Ort und Stelle | — |
| TLS-Ausnahme (MEDIUM) | Entscheidung am `URL.hostname` statt an der ganzen Zeichenkette | — |

### Die Gegenprobe zu den neuen Zusagen — und was sie wieder gefunden hat

Sieben weitere Mutationen (M19–M25), je eine je neuer Zusage. Und wie beim
ersten Mal war **die Probe selbst zuerst stumpf**:

- **M21** rötete zunächst die falsche Zusage. „Keine Stummheit ohne Takt" stand
  auf `laeufeImFenster: 0` — dort greift schon die Arithmetik (`0 < 0`), nicht
  der Wächter davor. Die Zusage hätte auch bei entferntem Wächter gehalten.
  Sie steht jetzt auf `laeufeImFenster: 10` bei 120 erwarteten: Stillstand ja,
  Stummheit wäre für sich genommen ebenfalls wahr — nur der Wächter verhindert
  die zweite Meldung.
- **M23** modellierte den behobenen Fehler falsch. Der alte Vergleich war
  `includes("public.push_wiederholung(")`, also `command.slice(7, -1)`. Mit
  einem beliebigen anderen Teilstück rötete die Mutation *alles* und belegte
  damit nichts Bestimmtes. Mit dem richtigen rötet sie **genau** die
  Kommentar-Zusage.

Ergebnis: jede der sieben neuen Zusagen wird von einer Mutation gerötet, und
jede Mutation rötet, was sie treffen soll.

Nebenbefund aus dem Bauen: die erste Fassung der Stern-Zusage war **selbst
falsch** — sie schlug an `$1 * interval '1 minute'` an, also an einer
Multiplikation. Ein Zusagefehler, kein Codefehler; die Zusage prüft jetzt den
Stern nur in der Auswahlliste.

### Nicht behoben, mit Grund

**[HIGH] Kaskadierendes Löschen kann eine aufgegebene Zustellung verschwinden
lassen.** Der Befund stimmt: `push_zustellungen` hängt über
`on delete cascade` an `notifications` und `push_tokens`, und
`push_zustellung_quittieren` löscht bei `dauerhaft` das Token — die Zeilen
gehen mit. Zwischen Aufgabe und stündlichem Lauf kann eine Meldung damit
verlorengehen.

Die vorgeschlagene Behebung ist ein nicht kaskadiertes Ereignis mit
`aufgegeben_at`, also **eine Migration und eine neue Tabelle**. Dieser Change
schließt Migrationen ausdrücklich aus, und die Lücke gehört zur selben Familie
wie die schon benannte Flankensteuerung: beide verlangen einen Zustand, den
dieser Wächter nicht hat, und beide wären von derselben Ergänzung erschlagen.

Sie steht deshalb als **benannte Grenze** in `design.md` und `docs/secrets.md`,
nicht als stiller Rest. Ein Wächter, der 90 % der Ausfälle meldet und dessen
letzte 10 % aufgeschrieben sind, ist besser als der Zustand vom 28.–31.08., wo
100 % unsichtbar waren.

**[LOW, gemini] Uneinheitliche Exit-Codes.** Absicht, und sie bleibt: `2` heißt
„der Wächter wurde falsch aufgerufen", `1` heißt „der Wächter hat etwas
gefunden". Die beiden zu vermischen kostet genau die Unterscheidung, die ein
Betrachter zuerst braucht. Vermerkt ist es jetzt am `abbruch`.
