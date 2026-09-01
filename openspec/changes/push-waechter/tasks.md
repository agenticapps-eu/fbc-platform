# Aufgaben

Reihenfolge ist Absicht: die reine Logik zuerst, weil sie das einzige Stück ist,
das ohne Instanz beweisbar ist. Alles danach ist Verdrahtung und braucht einen
Beleg an der laufenden Anlage.

> Fassung 2, nach der Plan-Review. Neu sind 2.4, 3.5, 4.2, 4.3 und 4.6 — vier
> davon schließen Lücken, die beide Reviewer unabhängig gefunden haben.

## 1 · Die Entscheidung als reine Funktion

- [x] **1.1 RED** — `scripts/push-waechter.test.ts`, 23 Zusagen. Erster Lauf
      rot am fehlenden Modul (`Failed to resolve import
      "./push-waechter.logic"`). Namensform wie im Haus: `db-drift-scan.ts` +
      `db-drift-scan.logic.ts` werden von `db-drift-scan.test.ts` geprüft.
- [x] **1.2 GREEN** — `scripts/push-waechter.logic.ts`: nimmt die gemessenen
      Zahlen entgegen, gibt Befunde zurück. Keine Datenbank, kein `process.exit`,
      kein `console.log` — dieselbe Bauart wie `db-drift-scan.logic.ts`.
      23/23 grün.
- [x] **1.3 Jede Zusage durch eine Mutation belegt.** 17 Mutationen, und der
      erste Satz von 13 hat die Lücke selbst gezeigt: **vier Zusagen rötete
      keine einzige** — die Abfragen-Prüfung war nur für `aufgegeben` belegt,
      für `antworten`, `laeufe`, `zeitplan` und `ttl` nicht. M14–M17 haben sie
      geschlossen. Jetzt gilt: jede der 23 Zusagen wird von mindestens einer
      Mutation gerötet.

      | Mutation | rötet |
      | --- | --- |
      | M01 Antwort-Befund nie melden | 5 |
      | M02 Befund behauptet „Push ist kaputt" | 1 |
      | M03 Alter des jüngsten Laufs ignorieren | 2 |
      | M04 Mindestmenge ignorieren | 1 |
      | M05 Mindestmenge auf volle Erwartung | 1 |
      | M06 Aufgabe erst ab zwei | 1 |
      | M07 Messausfall als Stillstand melden | 2 |
      | M08 Erwartungswert 0 durchlassen | 1 |
      | M09 TTL nie prüfen | 1 |
      | M10 nur den ersten Befund melden | 1 |
      | M11–M17 je eine verbotene Spalte je Abfrage, Verbotsliste aushöhlen | je 1 |
      | M13 einen Befund erfinden | 8 (alle Grünfälle) |
      | M18 `>=` zurück auf `>` (flakiger Abnahmebeleg) | 1 |
      | M19–M22 Stummheit, ihre Schwelle, ihr Wächter, die Stern-Auswahl | je 1–2 |
      | M23–M25 Teilstring statt Volltext, Normalisierung, unbekannte Jobs | je 1 |

      **Und die Probe war beim zweiten Mal wieder zuerst stumpf.** M21 rötete
      die falsche Zusage (die geprüfte Lage hing an der Arithmetik, nicht am
      Wächter), M23 modellierte den behobenen Fehler ungenau und rötete
      deshalb *alles*. Beides ist geschärft — Einzelheiten in
      `REVIEWS-DIFF.md`.

      **M13 ist der Grund, warum die Grünfälle etwas belegen.** Ohne eine
      Mutation, die einen Befund *hinzufügt*, wäre „meldet nichts" von „prüft
      nichts" nicht zu unterscheiden.
- [x] **1.4 Die Ausgabe trägt keine Mitgliederdaten.** Geprüft wird die
      **Abfrage**, nicht der erzeugte Text: die Logik bekommt nie etwas
      Verbotenes zu sehen, eine Zusage auf ihre Ausgabe wäre also leer. Was
      schiefgehen kann, ist eine Abfrage, die eine Spalte zu viel liest —
      deshalb stehen `ABFRAGEN` und `VERBOTENE_SPALTEN` im Logikmodul. Dazu
      eine Gegenprobe auf die Verbotsliste selbst: wäre sie leer, wäre die
      Zusage grün, ohne etwas auszuschließen (M12).
- [x] **1.5 Messausfall ist nicht Stillstand.** Zwei Zusagen, gerötet von M07
      und M08. Vorbild: `db-drift-scan.logic.ts:104` wirft bei leerem Bestand.

## 2 · Der Läufer

- [x] **2.1** `scripts/push-waechter.ts`: verlangt `dev|prod` als
      Pflichtangabe, verbindet über das passende Secret, TLS über
      `scripts/supabase-root-2021-ca.crt` wie `db-drift-scan.ts`, Zielkontrolle
      über `evaluateStage1` am Projekt-Ref **in der URL** (hinter dem Pooler
      heißt `current_user` auf beiden Seiten `postgres`). Belegt:

      | Aufruf | Ergebnis |
      | --- | --- |
      | ohne Seite | Exit **2**, „die Seite ist Pflicht" — kein Rückfall auf PROD |
      | `prod` im DEV-Kontext | Exit **2**, „`SUPABASE_DB_URL_PROD` nicht gesetzt" |
- [x] **2.2 Positivkontrolle gegen beide Seiten** — grün, und die Zahlen decken
      sich mit der Handmessung: DEV `120 von 120` Läufen, `200×120` Antworten,
      `pg_net.ttl 21600 s`, Zeitplan `* * * * *, aktiv=true`; PROD dieselben
      Werte. Ohne diese Kontrolle wäre ein grüner Lauf nicht von „hat gar nichts
      gemessen" zu unterscheiden.

      Nebenbei belegt der PROD-Lauf die dokumentierte Flankensteuerung: die
      `aufgegeben`-Zeile vom 29.08. steht noch da, liegt aber außerhalb des
      Fensters — gemeldet wird `0`. Genau wie im Entwurf beschrieben, und genau
      die Grenze, auf die beide Reviewer gezeigt haben.
- [x] **2.3 Echt rot gegen DEV, deterministisch.** Über `Höchstpause 0`, nicht
      über ein winziges Fenster. **Und das war zuerst flakig:** mit `>` wäre ein
      Lauf, der in derselben Sekunde lag, grün geblieben (`extract(epoch)::int`
      schneidet auf 0 ab). Der Vergleich steht jetzt auf `>=`, eine Zusage hält
      das fest, und Mutation M18 (zurück auf `>`) rötet sie. Drei Läufe
      hintereinander: `15 s`, `31 s`, `32 s` — jedes Mal Exit 1, jedes Mal
      Befund `stillstand`, nie ein Fehler des Läufers.
- [x] **2.4 Die TTL wird bei jedem Lauf gemessen**, nicht angenommen.
      Gegenprobe mit `Fenster 400 min` gegen die gemessenen 360 min TTL: Exit 1,
      Befund `voraussetzung`.
- [x] **2.5 Der Messausfall geht durch dieselbe Bewertung.** Mit einer
      unerreichbaren URL: Exit 1, Befund **`messausfall`** („connect
      ECONNREFUSED"), nicht `stillstand`. Der Läufer hat dafür bewusst keinen
      zweiten Ausgang — sonst wäre einer der beiden Wege ungeprüft.

## 3 · Der Drift-Scan sieht die Zeitplanung — und was sich verändert hat

- [x] **3.1 RED** — 7 neue Zusagen in `scripts/db-drift-scan.test.ts` (so
      heißt die Datei; es gibt kein `.logic.test.ts`): fehlende Zeitplanung,
      inaktive Zeitplanung, veränderter Zeitplan, ausgehöhlter Befehl,
      abgeschalteter Trigger, der Grünfall und die Positivkontrolle auf die
      Erwartungsliste. Lauf: **7 rot, 13 bestehende grün** — die Erweiterung
      hat nichts Bestehendes gebrochen.
- [x] **3.2 GREEN** — `db-drift-scan.ts` fragt `cron.job` und `tgenabled` ab,
      `db-drift-scan.logic.ts` kennt die erwarteten Einträge
      (`push-wiederholung`, `beitrag-ankuendigen`, je `* * * * *`, aktiv,
      Befehl ruft die jeweilige Funktion). Der Befehl darf verglichen und
      genannt werden — gemessen trägt er weder Bearer noch URL (33 und 35
      Zeichen). Für die Webhook-Funktionen gilt das **nicht**; dort bleibt es
      beim Namen. `ruft` ist ein Teilstring, kein Volltextvergleich: er fängt
      den ausgehöhlten Eintrag und verträgt Leerraum.
- [x] **3.3** Gegen **beide** Instanzen gelaufen, beide grün und mit
      identischem Bestand: *89 Funktionen, 23 Trigger, 42 Tabellen, 1 View,
      65 Policies, 2 Zeitplanungen, 0 abgeschaltete Trigger.* Der erweiterte
      Scan startet damit grün — er blockiert nichts, was heute schon so ist.
- [x] **3.4 Der Pflicht-Parameter.** `db-drift-scan.ts` las
      `process.argv[2] || process.env.SUPABASE_DB_URL_PROD` und maß ohne
      Argument immer PROD. Jetzt `dev|prod` als Pflicht, mit Zielkontrolle über
      `evaluateStage1` und dem gemessenen Ref im Log. `migrate-prod.yml:152`
      ruft ihn mit `prod` auf; das ist der einzige Aufrufer (geprüft).
- [x] **3.5 Entschieden, nicht geprüft:** cron- und Trigger-Befunde dürfen einen
      `migrate-prod`-Lauf röten. Sie blockieren den Frontend-Deploy nicht —
      `deploy.yml:228` fährt `migration-drift-gate.ts`, der Objekt-Scan steht
      allein in `migrate-prod.yml`. Der Scan läuft dort **nach** dem `db push`;
      ein Befund stoppt also keine Migration, er macht sie sichtbar.

## 4 · Der Workflow

- [x] **4.1** `.github/workflows/push-waechter.yml`: `schedule: 17 * * * *`
      (nicht zur vollen Stunde — dort drängen sich die geplanten Läufe von
      GitHub und die Verspätung wächst), dazu `workflow_dispatch` mit
      Eingabewerten für Fenster und Höchstpause. Ein Job je Seite mit **nur**
      dem Secret dieser Seite. Laufzeit wie in `deploy.yml`: gepinnte
      `pnpm/action-setup` und `setup-node` (Node 22), `pnpm install
      --frozen-lockfile`, dann `pnpm tsx`. YAML gegengelesen: 2 Jobs, je 6
      Schritte, `on` = schedule + workflow_dispatch.

      Die Eingabewerte gehen in `env:`, nicht in `run:` — die sichere Form. Der
      Läufer prüft sie zusätzlich (`zahlAusUmgebung` bricht bei allem ab, was
      keine Zahl ≥ 0 ist).
- [x] **4.2 Der Drift-Scan läuft im selben Job** — je Seite, mit dem
      Pflicht-Parameter aus 3.4, und mit `if: always()`, damit ein roter
      Wächter den Drift-Befund nicht verdeckt. Ohne diesen Schritt hätte DEV
      weiterhin keinen Lauf, und die geänderte Anforderung „regelmäßig gegen
      beide Projekte" hätte keine umsetzende Aufgabe. Beide Reviewer haben die
      Lücke gefunden.
- [ ] **4.3 Der Meldeweg wird ausgelöst — und der Beleg wird nicht überdehnt.**
      Ein `workflow_dispatch` mit Höchstpause `0` macht den Lauf **echt rot**;
      Lauf-ID festhalten. Das belegt, dass der Wächter rot wird. Es belegt
      **nicht**, dass die stündliche Mail ankommt: ein Dispatch-Fehlschlag mailt
      an den Auslöser, ein `schedule`-Fehlschlag folgt den
      Benachrichtigungseinstellungen des Repositories. Beides getrennt festhalten.
- [ ] **4.4** Danach ein regulärer Lauf, der grün ist — die Gegenprobe zu 4.3.
- [x] **4.5 Die bestehenden Wächter greifen — geprüft, nicht angenommen.**
      `tsconfig.json:22` schließt `scripts` ein, `lint` ist `eslint .`. Und der
      Beleg dafür ist kein Vakuum: `typecheck` hat beim Bauen des Läufers
      **einen echten Fehler gefangen** (die Verengung von `evaluateStage1` gilt
      nicht in die Closure hinein). Für Workflow-Dateien gibt es **keinen**
      Wächter im Repo — kein actionlint, kein YAML-Schema; die Datei ist von
      Hand gegengelesen und geparst.
- [ ] **4.6 Den ersten geplanten Lauf abwarten und nachsehen**, ob er zur
      erwarteten Zeit kam und wie spät er war. Die Verspätung ist die Größe, an
      der das 120-Minuten-Fenster hängt; sie steht bisher als Annahme da.

> **4.3, 4.4 und 4.6 gehen erst nach dem Merge.** GitHub führt `schedule:` nur
> auf dem Vorgabe-Branch aus, und ein `workflow_dispatch` verlangt, dass der
> Workflow dort liegt. Auf diesem Branch ist der Wächter also weder auslösbar
> noch geplant. Das ist keine Nachlässigkeit, sondern die Reihenfolge, die
> GitHub vorgibt — und es heißt, dass der Change **mit drei offenen
> Abnahmepunkten gemergt wird**, die unmittelbar danach abzuarbeiten sind.

## 5 · Die Dokumentation sagt die Wahrheit

- [x] **5.1** `docs/supabase-environments.md` sagte „**Genau eines**" und nannte
      nur den Contact-Webhook. Jetzt: **vier Objekte mit fünf Namen** in
      `public` plus **zwei Zeitplanungen**, je mit Begründung, dazu die zwei
      neuen Zeilen in „Was `db push` nicht mitnimmt". Der Satz war seit dem
      28.08. falsch; die maßgebliche Liste stand derweil im Code.

      Zwei weitere Fehler in denselben Abschnitten mitgenommen, weil sie
      unmittelbar neben der Korrektur standen: der Scan hiess dort
      `db-drift-scan.**sh**` (die Datei hat es nie gegeben), und
      `docs/secrets.md:353` behauptete, ein roter Objekt-Scan lasse den
      Frontend-Deploy stumm ausfallen — **dieselbe** Gate-Verwechslung, die
      130 Zeilen weiter unten schon als korrigiert markiert ist.
- [x] **5.2** Der Wächter steht in `docs/secrets.md` im Abschnitt zu
      `send-push`: eine Zeile je Befund mit Bedeutung und erstem Handgriff,
      warum `letzter_fehler` nicht ins Protokoll geht, die zwei benannten
      Grenzen, und wie man ihn von Hand rot fährt. **Nicht** in
      `docs/runbook.md` — die Datei existiert nicht (AGE-179 ist dafür offen).
      Dazu die inzwischen falsche Zusage bei `:504` ersetzt, eine abbestellte
      Zeitplanung falle dem Scan nicht auf.

## 6 · Abnahme

- [x] **6.1** `openspec validate --all` grün, 31/31.
- [ ] **6.2** Die Abnahmepunkte aus AGE-679, je mit Artefakt statt Behauptung:

      | Abnahmepunkt | Beleg |
      | --- | --- |
      | Wächter meldet aufgegebene Zustellungen, durch Mutation belegt | M06 rötet die Zusage; Anzahl statt `letzter_fehler`, geprüft an den **Abfragen** (M11, M14–M17) |
      | Wächter schlägt an, wenn der Wiederholungslauf steht | Quelle ist `cron.job_run_details`; M03/M04 röten beide Bedingungen; echter roter Lauf gegen DEV, dreimal |
      | Wächter meldet seinen eigenen Messausfall als eigenen Befund | M07/M08; echter Lauf gegen eine unerreichbare URL → `messausfall`, nicht `stillstand` |
      | DEV hat einen Wächter über die nicht-migrierten Objekte | Drift-Scan je Seite im stündlichen Workflow; gegen beide Instanzen grün gelaufen |
      | **Der Meldeweg ist einmal ausgelöst** | **offen** — geht erst nach dem Merge, siehe 4.3 |
- [x] **6.3** Der vierte Punkt der Reviewer-Liste (`net._http_response` wächst)
      ist in `push-fundament/tasks.md` mit dem **Messwert** durchgestrichen, und
      die drei übrigen tragen dort jetzt eine Zuordnung auf diesen Change.

## Nicht in diesem Change — bewusst

- Sentry in den Edge Functions, Axiom, neue Beobachtungs-Infrastruktur.
- Eine Aufräum-Regel für `net._http_response` (widerlegt, siehe 6.3).
- Eine Zeitspalte in `push_zustellungen`.
- Ein fortgeschriebener Merkpunkt statt des festen Fensters, und ein „offener
  Vorfall bis zur Quittierung". Beide brauchen einen Zustand, den dieser
  Wächter nicht hat; beide stehen als benannte Grenze in `design.md`.
- Ein eigener Lese-Benutzer statt `postgres` — auf `net._http_response` nicht
  gewährbar, gemessen.
- Ein Wächter über den Mail- oder Aktivierungsweg als eigenes Signal. Das
  Antwort-Signal deckt sie heute schon mit ab, ohne sie zu unterscheiden.
