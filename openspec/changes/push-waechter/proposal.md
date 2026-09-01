# Push-Betrieb: ein Wächter, der nicht auf der überwachten Anlage läuft

Linear: **AGE-679**

## Why

Am 31.08. haben Donald und Detlev am iPhone getestet. Die Nachricht kam in der
App an, ein Push kam nicht. Die Ursache — auf PROD trug weder Infisical `prod`
noch der Function-Secret-Store ein einziges `APNS_*` — ist am 01.09. behoben
(AGE-641, PR #301).

**Der Ausfall ist nicht das Thema dieser Änderung. Seine Unsichtbarkeit ist es.**

Drei Zeilen standen drei Tage lang in `push_zustellungen`, jede mit
`letzter_fehler = apns_nicht_konfiguriert`, je fünf Versuchen, Zustand
`aufgegeben`. Mit dem richtigen Grund, an der richtigen Stelle. Es hat nur
niemand hingesehen. Gemerkt hat es ein Mensch, der zufällig ein Telefon in der
Hand hatte. Eine davon steht heute noch da (PROD, 29.08. 11:18).

Die vier Punkte hat der Reviewer am 28.08. benannt
(`push-fundament/tasks.md:537-551`). Sie waren damals kein Merge-Blocker.
Inzwischen hat einer davon zugeschlagen.

### Warum nicht Sentry

Die Frage ist schon beantwortet, und die Antwort ist Nein.

Der Fehler wird in `send-push/index.ts:202-209` **gefangen**, als
`zustellung_warf` protokolliert, als `vorlaeufig` verbucht — die Funktion gibt
**200** zurück. Es fliegt nichts, was ein Fehler-Melder fangen könnte. Dazu ist
Sentry hier heute browser-only (`@sentry/react`, `src/instrument.ts`); in
`supabase/functions/` steht keine einzige Sentry-Zeile.

Sentry in die Function zu holen hülfe also nur mit einem ausdrücklichen
`captureMessage`. Dann ist es kein Fehler-Melder mehr, sondern ein Wächter — und
den kann man billiger dort haben, wo die Antwort ohnehin schon steht.
**Axiom ist raus** (Donald, 01.09.).

## Die Messung, die diesen Change zuschneidet

Alles unten am 01.09. gegen **beide** Instanzen gemessen (`dev =
foelowldexkcqzewvrcf`, `prod = viwntbodrtqxgmqyxluh`), nicht aus dem Code
geschlossen.

| Behauptung aus `tasks.md` | Messung | Folge |
| --- | --- | --- |
| Drift-Scan misst nur PROD, läuft nur von Hand | **trifft zu** — `migrate-prod.yml:152` ist der einzige Aufruf, der Workflow hat nur `workflow_dispatch` | bleibt |
| DEV hat gar keinen Wächter | **trifft zu** — `deploy.yml:35` fährt `migrate-dev` bei jedem Merge auf `main`, ohne Drift-Scan | bleibt |
| „drei Objekte" | **fünf Namen und zwei Zeitplanungen** — `ERWARTET_OHNE_MIGRATION` führt zwei Webhook-Paare plus `push_wiederholung`; dazu kommen `push-wiederholung` und `beitrag-ankuendigen` im Schema `cron`, das der Scan gar nicht abfragt (`db-drift-scan.logic.ts:74-77` sagt es selbst) | bleibt, erweitert |
| Ein dauerhafter Zustellausfall ist unsichtbar | **die Daten sind da, der Leser fehlt** — siehe unten | bleibt, anders gelöst |
| Gesundheitssignal `{"skipped":true}` verfällt | **ist schon heute kein Wächter** — ein curl von Hand in `docs/secrets.md:398-522`; im Repo steht **kein einziger** `schedule:`-Trigger | geht im Wächter auf |
| `net._http_response` wächst, pg_net räumt nicht auf | **widerlegt** | **entfällt** |

### `net._http_response` wächst nicht — gemessen, nicht vermutet

| | DEV | PROD |
| --- | --- | --- |
| pg_net | 0.20.3 | 0.20.4 |
| `pg_net.ttl` | 6 hours | 6 hours |
| `pg_net.batch_size` | 200 | 200 |
| Zeilen | **360** | **360** |
| Alter der ältesten | 5 h 59 min 51 s | 5 h 59 min 05 s |

360 Zeilen sind 6 Stunden × 60 Minuten: ein Fließgleichgewicht genau an der
TTL-Kante, auf beiden Seiten, auf die Zeile gleich. `worker.c` ruft
`delete_expired_responses(guc_ttl, guc_batch_size)` als **erste** Handlung jedes
Schleifendurchlaufs. Der vierte Punkt ist damit erledigt, ohne dass eine Zeile
Code geschrieben wurde.

### Und der Ausfall aus Punkt 2 ist längst aufgezeichnet

Die Aufgabenliste sagt, `net.http_post` sei Fire-and-Forget und ein `401` bleibe
deshalb unsichtbar. Der erste Halbsatz stimmt, der zweite nicht.
`net._http_response` trägt `status_code`, `timed_out`, `error_msg` und `created`
— alle drei Ausfallgestalten also. Gemessen auf DEV:

- Statusverteilung der letzten 6 h: **360 × `200`**, null Zeilen mit `error_msg`.
- Rumpf: **360 × `{"skipped":true}`** — der Minutenschlag des
  Wiederholungslaufs.
- Letzte 5 Minuten: **5 Zeilen**, jüngste 57 s alt.

Warum 360 und nicht 720, obwohl zwei Zeitpläne im Minutentakt laufen:
`beitrag-ankuendigen` „ruft kein `net.http_post`", steht wörtlich im Kopf von
`20260829090000_geplante_beitraege.sql:317`. Die Zeilen stammen also **allein**
vom Wiederholungslauf.

Damit ist die eine Frage minutengenau beantwortbar, sechs Stunden weit zurück:
*antwortet `send-push` noch mit 200?*

**Die zweite Frage — kommt überhaupt noch etwas an? — ist es nicht**, und das
ist der Befund, an dem der erste Entwurf gescheitert wäre. `net._http_response`
trägt **keine Ziel-URL**. Eine einzige Kontaktanfrage im Fenster erzeugt dort
eine Zeile, und „keine Zeile" wäre falsch, obwohl der Minutentakt tot ist. Die
Lebendigkeit des Wiederholungslaufs muss deshalb aus einer Quelle kommen, die
ihn benennt: **`cron.job_run_details`**, verbunden über `cron.job.jobname`.
Gemessen: 2880 Läufe in 24 h, alle `succeeded`, auf beiden Seiten.

Der Preis für die erste Frage bleibt eine Frist: **der Wächter muss öfter als
alle sechs Stunden laufen**, sonst misst er ein Fenster, das pg_net schon
geleert hat.

### Warum der Wächter nicht in der Datenbank läuft

Ein zweiter `pg_cron`-Lauf, der zählt und über die bestehende Resend-Strecke
meldet, liegt nahe. Er ist aus zwei Gründen falsch, und beide sind gemessen:

1. **Er meldet über denselben `net.http_post`-Weg, dessen Blindheit das Problem
   ist.** Fällt der Weg aus, fällt die Meldung darüber mit aus.
2. **Ein `supabase db reset` auf DEV nimmt ihn mit** — das ist Punkt 1.

Der Wächter läuft deshalb als **GitHub-Actions-`schedule:`**, außerhalb von
Supabase, und wird rot; die Meldung ist die GitHub-Mail (Donald, 01.09.).
Nebenbei löst das ein Rechteproblem: auf `net._http_response` liegt **kein
einziger Grant** — weder `anon` noch `authenticated` sehen die Tabelle. Ein
Leser braucht die `postgres`-Verbindung, und die liegt als Actions-Secret
bereits vor.

## What Changes

**1 · Der Drift-Scan misst auch DEV, und er sieht die Zeitplanung**

Der Scan läuft künftig **je Seite im stündlichen Wächter** — nicht als Schritt
in `deploy.yml`s `migrate-dev`. Die Begründung steht in `design.md`; kurz: ein
Befund über die Datenbank soll keinen Frontend-Deploy aufhalten, und stündlich
ist schneller als „beim nächsten Merge". In `migrate-prod` bleibt er, wo er ist.

Dazu bekommt der Scan die Abfrage auf `cron.job`, die ihm heute fehlt. Ist-Stand
beider Seiten: `push-wiederholung` und `beitrag-ankuendigen`, je `* * * * *`,
beide `active`, 2880 Läufe in 24 h, alle `succeeded`. Der Scan startet also
grün — er blockiert nichts, was heute schon kaputt wäre.

**2 · Ein Wächter liest, was die Instanz längst aufschreibt**

Ein neuer Workflow mit `schedule:` fragt beide Projekte und wird rot bei

- **Antwort** — eine Zeile mit `status_code <> 200`, `timed_out` oder
  `error_msg` im Beobachtungsfenster,
- **Stillstand** — kein `succeeded`-Lauf von `push-wiederholung` in
  `cron.job_run_details` im Fenster; das ist die Quelle, die den Takt benennt,
- **Aufgabe** — eine `push_zustellungen`-Zeile, die im Fenster entstanden ist
  und `aufgegeben` erreicht hat,
- **Messausfall** — der Wächter selbst kommt nicht an die Zahlen. Er meldet das
  als eigenen Befund und nie als Stillstand; ein leeres Messergebnis ist ein
  Fehler, keine Feststellung. Dieselbe Regel führt `db-drift-scan.logic.ts:104`
  schon heute.

Die Fristen legt `design.md` fest, gebunden an die gemessene TTL und an die
gerechnete Dauer der Zustellversuche.

**3 · Der Meldeweg wird einmal ausgelöst, bevor er als fertig gilt**

Eine Meldung, die niemand sieht, ist derselbe Fehler noch einmal. Der Beleg ist
ein rot gelaufener Workflow, nicht die Behauptung, er würde rot laufen.

## Was ausdrücklich NICHT dazugehört

- **Sentry in den Edge Functions**, Axiom, oder neue Beobachtungs-Infrastruktur.
  Begründet oben.
- **Eine Aufräum-Regel für `net._http_response`.** Widerlegt, mit Zahlen. Käme
  sie doch, wäre sie ein eigener Vorgang mit eigenem Beleg.
- **Eine Zeitspalte in `push_zustellungen`.** Die Tabelle trägt nur `created_at`
  (`20260827240000_push_zustellung.sql:90-99`), und der erste Entwurf wollte
  deshalb eine Zustandszeit ergänzen. Die Messung hat das erledigt: die
  Lebendigkeit steht in `net._http_response`, nicht im Zustellbuch. Keine
  Migration an einer Tabelle, die schon läuft.
- **Zuordnung der Fehlerzeile zum Aufrufer.** `net._http_response` trägt keine
  Ziel-URL; das Antwort-Signal meldet „ein Fire-and-Forget-Aufruf ist
  gescheitert", nicht welcher. Das deckt nebenbei den Mail-Webhook der
  Kontaktanfragen mit ab. Für den **Stillstand** taugt dieselbe Tabelle
  deshalb nicht — dafür ist `cron.job_run_details` da, siehe oben. Der erste
  Entwurf hat das verwechselt; gefunden hat es die Plan-Review.
- **Die vier ausstehenden Gerätebelege** und **`APNS_SANDBOX` aus `prod`
  nehmen**. Beides hängt am Gerät, nicht am Betrieb.
