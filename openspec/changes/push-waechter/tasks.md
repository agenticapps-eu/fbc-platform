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

- [ ] **2.1** `scripts/push-waechter.ts`: verlangt `dev|prod` als
      Pflichtangabe, verbindet über das passende Secret, TLS über
      `scripts/supabase-root-2021-ca.crt` wie `db-drift-scan.ts`, Zielkontrolle
      über den Projekt-Ref **in der URL** (hinter dem Pooler heißt
      `current_user` auf beiden Seiten `postgres`).
- [ ] **2.2 Positivkontrolle gegen DEV** — der Läufer wird grün, und die
      ausgegebenen Zahlen stimmen mit einer Handmessung überein (Stand 01.09.:
      jüngster Lauf 46 s alt, 120 Läufe in 120 min, 360 Antwortzeilen, alle
      `200`). Ohne diese Kontrolle ist ein grüner Lauf nicht von „hat gar nichts
      gemessen" zu unterscheiden.
- [ ] **2.3 Echt rot gegen DEV, deterministisch.** Mit der Höchstpause `0` ist
      der Stillstand-Befund mit Sicherheit wahr — ein „winziges Fenster" wäre
      es nicht, weil der Minutentakt während der Abfrage eine frische Zeile
      schreiben kann. Exit-Code ≠ 0, und der Befund nennt Stillstand, nicht
      einen Fehler des Läufers.
- [ ] **2.4 Die TTL wird bei jedem Lauf gemessen**, nicht angenommen. Der Läufer
      liest `pg_net.ttl` und schlägt fehl, wenn sie das Fenster nicht mehr
      übersteigt. Gegenprobe: mit einem Fenster größer als 6 h wird der Lauf rot.

## 3 · Der Drift-Scan sieht die Zeitplanung — und was sich verändert hat

- [ ] **3.1 RED** — Zusagen in `scripts/db-drift-scan.logic.test.ts`: eine
      fehlende Zeitplanung, eine inaktive Zeitplanung, eine mit verändertem
      Befehl, und ein abgeschalteter Trigger sind je ein Befund.
- [ ] **3.2 GREEN** — `db-drift-scan.ts` fragt `cron.job` und `tgenabled` ab,
      `db-drift-scan.logic.ts` kennt die erwarteten Einträge
      (`push-wiederholung`, `beitrag-ankuendigen`, je `* * * * *`, aktiv,
      Befehl ruft die jeweilige Funktion). Der Befehl darf verglichen und
      genannt werden — gemessen trägt er weder Bearer noch URL (33 und 35
      Zeichen). Für die Webhook-Funktionen gilt das **nicht**; dort bleibt es
      beim Namen.
- [ ] **3.3** Gegen **beide** Instanzen laufen lassen: der erweiterte Scan ist
      auf DEV und PROD grün. Ist-Stand am 01.09. gemessen — beide Zeitpläne
      aktiv, alle zwölf Trigger auf `O`. Wird er rot, ist das ein Befund und
      kein Grund, die Erwartung anzupassen.
- [ ] **3.4 Der Pflicht-Parameter.** `db-drift-scan.ts:26` fällt heute ohne
      Argument auf `SUPABASE_DB_URL_PROD` zurück — ein Wächter mit einem Job je
      Seite, der das Argument vergisst, prüfte PROD zweimal und DEV nie, beide
      Male grün. Der Scan verlangt künftig `dev|prod` und nennt den gemessenen
      Projekt-Ref. Der Aufruf in `migrate-prod.yml:152` wird mitgezogen.
- [ ] **3.5 Entschieden, nicht geprüft:** cron- und Trigger-Befunde dürfen einen
      `migrate-prod`-Lauf röten. Sie blockieren den Frontend-Deploy nicht —
      `deploy.yml:228` fährt `migration-drift-gate.ts`, der Objekt-Scan steht
      allein in `migrate-prod.yml`. Der Scan läuft dort **nach** dem `db push`;
      ein Befund stoppt also keine Migration, er macht sie sichtbar.

## 4 · Der Workflow

- [ ] **4.1** `.github/workflows/push-waechter.yml`: `schedule:` stündlich, dazu
      `workflow_dispatch` mit Eingabewerten für Fenster und Höchstpause. Ein Job
      je Seite mit **nur** dem Secret dieser Seite, damit ein Fehler nicht
      unbemerkt die andere misst. Laufzeit wie in `deploy.yml`:
      `pnpm/action-setup`, `setup-node` (Node 22), `pnpm install
      --frozen-lockfile`, dann `pnpm tsx`.
- [ ] **4.2 Der Drift-Scan läuft im selben Job** — je Seite, mit dem
      Pflicht-Parameter aus 3.4. Ohne diesen Schritt hätte DEV weiterhin keinen
      Lauf, und die geänderte Anforderung „regelmäßig gegen beide Projekte"
      hätte keine umsetzende Aufgabe. Beide Reviewer haben die Lücke gefunden.
- [ ] **4.3 Der Meldeweg wird ausgelöst — und der Beleg wird nicht überdehnt.**
      Ein `workflow_dispatch` mit Höchstpause `0` macht den Lauf **echt rot**;
      Lauf-ID festhalten. Das belegt, dass der Wächter rot wird. Es belegt
      **nicht**, dass die stündliche Mail ankommt: ein Dispatch-Fehlschlag mailt
      an den Auslöser, ein `schedule`-Fehlschlag folgt den
      Benachrichtigungseinstellungen des Repositories. Beides getrennt festhalten.
- [ ] **4.4** Danach ein regulärer Lauf, der grün ist — die Gegenprobe zu 4.3.
- [ ] **4.5** Nachsehen, ob der neue Workflow von den bestehenden Wächtern
      erfasst wird. `tsconfig.json:22` schließt `scripts` ein und `lint` ist
      `eslint .` — beide greifen also; das ist geprüft, nicht angenommen.
- [ ] **4.6 Den ersten geplanten Lauf abwarten und nachsehen**, ob er zur
      erwarteten Zeit kam und wie spät er war. Die Verspätung ist die Größe, an
      der das 120-Minuten-Fenster hängt; sie steht bisher als Annahme da.

## 5 · Die Dokumentation sagt die Wahrheit

- [ ] **5.1** `docs/supabase-environments.md:363` sagt „**Genau eines**" und
      nennt nur den Contact-Webhook. Tatsächlich sind es **fünf Namen in
      `ERWARTET_OHNE_MIGRATION`** (zwei Webhook-Paare plus `push_wiederholung`)
      und dazu **zwei Zeitplanungen**, die dort noch gar nicht stehen. Die Liste
      nachziehen, mit Begründung je Objekt.
- [ ] **5.2** Den Wächter in `docs/secrets.md` eintragen, im Abschnitt zu
      `send-push`: was jeder der vier Befunde bedeutet und was als Erstes zu
      prüfen ist. **Nicht** in `docs/runbook.md` — die Datei existiert nicht
      (AGE-179 ist dafür offen).

## 6 · Abnahme

- [ ] **6.1** `openspec validate --all` grün.
- [ ] **6.2** Die fünf Abnahmepunkte aus AGE-679 sind je durch ein Artefakt
      belegt, nicht durch eine Behauptung: Testlauf, Lauf-ID, Messwert.
- [ ] **6.3** Der vierte Punkt der Reviewer-Liste (`net._http_response` wächst)
      ist mit Zahlen widerlegt und in `push-fundament/tasks.md` als erledigt
      markiert — mit dem Messwert, nicht mit einem Haken.

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
