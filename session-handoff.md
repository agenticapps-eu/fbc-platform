# Session Handoff — 2026-08-28 (Nachmittag, AGE-641 Phase A abgeschlossen)

**Worktree:** `fbc-platform.donald-age-641-push-fundament`, Branch
`donald/age-641-push-fundament`. **PR #268 ist gemergt** (`c303acf`), der Lauf
auf `main` ist vollständig grün — `drift-gate`, `deploy` und `functions` alle
`success`, kein übersprungener Job. **Phase A von AGE-641 ist vollständig**: der
letzte offene Punkt (A5b, `pg_cron`) ist gebaut und auf DEV **und** PROD
gemessen. `migrate-prod` war nicht nötig, dieser PR trug keine Migration.

**Linear korrigiert:** die Automation schob AGE-641 beim Merge auf *Done* —
zum vierten Mal an diesem Tag und wieder verfrüht, weil das Issue Phase A
**und** Phase B trägt. Zurück auf *In Progress*, mit Begründung als Kommentar.

## Accomplished

**Der Wiederholungslauf stösst sich selbst an.** Von Hand in beiden Datenbanken,
weil der Bearer nicht ins öffentliche Repo gehört (Vorlage: `docs/secrets.md`):
`create extension pg_cron` (1.6.4), `public.push_wiederholung()` als
`security definer` mit leerem `search_path`, `revoke execute` von den
Client-Rollen, cron-Eintrag `push-wiederholung`.

`net.http_post` ist **asynchron** — ein `succeeded` im cron-Protokoll sagt nur,
dass das SQL lief. Deshalb zwei getrennte Belege je Seite:

| | DEV | PROD |
| --- | --- | --- |
| Extension, Funktion, `revoke` | ✅ | ✅ |
| **Rumpf** — neue `net._http_response`-Zeile gegen vorher festgehaltene `max(id)` | 10 > 9 | 36 > 35 |
| **Takt** — zwei aufeinanderfolgende Minuten | 11:40:00 + 11:41:00 | 11:40:00 + 11:41:00 |
| Objekt-Drift-Scan | grün | grün |

Ohne die Grundlinie hätte die `200`-Zeile der Webhook-Probe **vom selben
Vormittag** als Beleg getaugt, ohne einer zu sein.

**Dem Spec-Delta fehlte die Anforderung.** Er verlangte, dass ein beanspruchter
Auftrag eine Frist trägt, und setzte „den Wiederholungslauf" in einem Szenario
*voraus* — dass ihn jemand **wiederkehrend anstösst**, stand nirgends. Genau die
Lücke, durch die A5b abhakbar gewesen wäre, ohne dass etwas läuft.

**Vier Korrekturen aus der Code-Review** (opencode, FREIGABE MIT AUFLAGEN, kein
Code-Fehler) — alle als Korrektur sichtbar gemacht, nicht still ersetzt:

1. **Der Takt war falsch begründet und deshalb falsch gewählt.** Zwei Fristen
   verwechselt: **Rückstellung** nach Fehlschlag ist `now() + 1 min · 2^versuche`
   (`20260827240000:312`, also 1-2-4-8-16), die **Anspruchsfrist** ist
   `now() + 5 min` (`20260828100000:110,179`). `*/5` hätte die ersten zwei Stufen
   verschluckt. Jetzt `* * * * *`.
2. **„Ein roter Objekt-Drift-Scan lässt den Deploy stumm ausfallen" ist falsch**
   — und stand schon länger in `db-drift-scan.test.ts`. `db-drift-scan.ts` läuft
   nur in `migrate-prod.yml` (`workflow_dispatch`); `deploy.yml` fährt
   `migration-drift-gate.ts`, ein anderes Gate.
3. Zurückgestellt wird von `push_zustellung_quittieren`, nicht von der Tabelle.
4. Der Scan prüft auch **Views**; Zeilenverweis `61-90`.

**Sicherheitsbefund für alle drei Funktionen dieser Sorte:** `anon` und
`authenticated` lesen den Rumpf per `pg_get_functiondef()` samt Bearer —
`revoke execute` schützt das Ausführen, nicht das Lesen. Über die Client-Fläche
nicht erreichbar (`404 PGRST202`), Positivkontrolle daneben:
`POST /rpc/push_wiederholung` → `401 42501 permission denied`.

**Der Worktree wurde mitten in der Sitzung von aussen gelöscht** (Aufräum-Sitzung
`fbc-platform-f4`, 13:17). Über `wt switch` zurückgeholt; zwei ungesicherte
Dateien neu geschrieben und gegen die Sicherung der anderen Sitzung gediffed —
inhaltlich deckungsgleich.

## Decisions

- **Takt `* * * * *`, von Donald ausdrücklich so entschieden** gegen die zwei
  Alternativen (Drosseln auf `*/5`, Job abschalten). Grund: die entworfene
  Staffelung 1-2-4-8-16 soll wirklich greifen. Preis: ~1440 Aufrufe je Tag und
  Projekt, alle `{"skipped":true}`, solange `push_tokens` leer ist.
- **`push_wiederholung` als benannte Funktion statt `net.http_post` inline im
  cron-Kommando.** Spiegelt das Webhook-Paar, hält den Bearer aus `cron.job`
  heraus und gibt dem Drift-Scan einen Griff auf wenigstens die Funktions-Hälfte.
- **Nicht als Migration.** `create extension` ist ein Eingriff in die Instanz,
  den der lokale Stack nicht validieren kann; ein Fehlschlag in einer Migration
  bräche `migrate-prod`.
- **Nicht archiviert.** Der Change trägt auch Phase B (AGE-642).
- **Die Wegwerf-Skripte sind gelöscht** (`wire-`, `mess-`, `reschedule`,
  `rumpf-lesbar`). Durable ist nur `scripts/probe-age641-pg-cron.ts`; die
  Wiederherstellungs-Vorlage steht in `docs/secrets.md`, wie beim Webhook.

## Files modified

- `scripts/probe-age641-pg-cron.ts` — **neu**, lesende Probe je Seite; sieht die
  cron-Hälfte, die der Drift-Scan nicht sieht
- `scripts/db-drift-scan.logic.ts` — `push_wiederholung` in
  `ERWARTET_OHNE_MIGRATION`; „in der Konsole" → „per SQL" richtiggestellt
- `scripts/db-drift-scan.test.ts` — Zusage auf den neuen Namen (RED gemessen,
  Positivkontrolle schlug an); die falsche deploy.yml-Kopplung korrigiert
- `docs/secrets.md` — Vorlage, zwei-Fristen-Tabelle, Gate-Abgrenzung, der
  Befund zur Lesbarkeit des Funktionsrumpfs
- `openspec/changes/push-fundament/specs/notifications/spec.md` — neue
  SHALL-Klausel + Szenario, samt Abgrenzung gegen „SHALL NOT abfragen"
- `openspec/changes/push-fundament/tasks.md` — A5b abgeschlossen, Kopf
  neu gefasst, vier Betriebsrisiken als eigene Vorgänge notiert

## Next session: start here

**An AGE-641 ist nichts nachzuholen.** #268 ist gemergt, `main` deployt normal,
Linear ist korrigiert. Dieser Worktree kann bleiben (der Change ist wegen Phase
B nicht archiviert) oder abgeräumt werden — er trägt nichts Ungesichertes.

**Der nächste Schritt ist AGE-642, und zwar im Worktree
`fbc-platform.donald-age-642-capacitor-huelle`.**

⚠️ **„Phase B" heisst in den beiden Changes etwas Verschiedenes** — das ist die
Verwechslung, die hier am leichtesten passiert:

| | gemeint ist | Stand |
| --- | --- | --- |
| `push-fundament` **Phase B** | Token-Registrierung in der App, Sichtprobe am Gerät | **blockiert**, beginnt laut Plan erst *nach dem Merge* von AGE-642 |
| `capacitor-huelle` **Phase B** | B1 Capacitor + `ios/`/`android/`, B2 Geheimnis-Wächter, B3 Signaturmaterial | das ist der nächste Schritt |

**Stand von AGE-642, gemessen am 28.08. — Linear behauptet etwas anderes:**

- Linear sagt **Backlog**, `startedAt: null`. Falsch: dort liegen **4 Commits**
  und ein durchgeplanter Change `capacitor-huelle` (proposal, design,
  `REVIEWS.md`, tasks), **15 von 73 Haken gesetzt**. Der Status steht nur
  deshalb auf Backlog, weil nie ein PR aufging und die Automation nie feuerte.
- **Dessen Phase A ist fertig** und war der riskante Teil: der Sitzungsspeicher
  ist aus dem `localStorage` heraus (`ea79040`, im Browser belegt — eine
  bestehende Web-Sitzung überlebt den Umbau) und die Routen sind geteilt
  (`7e7802a`).
- **`ios/`, `android/` und `capacitor.config.ts` gibt es noch nicht.** B1 ist
  der nächste Haken — und er **braucht Xcode und Android Studio**, also eine
  Sitzung an diesem Rechner, nicht nur eine Kommandozeile.
- **Der Branch ist 39 Commits hinter `main`.** Vor der ersten Messung dort
  `git fetch` + rebase/merge, sonst misst man gegen einen alten Stand — siehe
  die Erfahrung aus AGE-641, wo ein frischer Worktree 11 Commits alt war.

**Erste Aktion dort:** `git log --oneline HEAD..origin/main | wc -l` gegen null
bringen, dann `openspec/changes/capacitor-huelle/tasks.md` ab Abschnitt **B1**
lesen. Nicht bei null anfangen — der Plan steht und ist zweimal gegengelesen.

**Danach ist Phase B dran, und die gehört AGE-642** (Capacitor-Hülle,
Worktree `fbc-platform.donald-age-642-capacitor-huelle`). Ohne sie gibt es kein
Gerätetoken, und ohne Gerätetoken bleibt `push_tokens` leer.

## Open questions

- **Die App-ID `com.effbeezee.app` ist unbestätigt.** APNs prüft das Gerätetoken
  **vor** dem Topic; zeigt sich erst am echten Gerät (AGE-642 B1).
- **Die Anbieter-Secrets in `prod` sind bewusst leer.** Mit dem ersten echten
  Gerätetoken müssen sie stehen.
- **Vier Betriebsrisiken aus der Review**, in `tasks.md` notiert: ein
  `db reset` tilgt den Lauf lautlos (DEV hat gar keinen Wächter) · ein
  dauerhafter 401/502 bleibt unsichtbar, weil cron `succeeded` meldet ·
  `net._http_response` wächst ungeräumt (~1440 Zeilen/Tag/Projekt) · das
  Gesundheitssignal `{"skipped":true}` verfällt mit Phase B.
- **`display_name_test.sql` steht in keiner CI-Dateiliste** (20 auf der Platte,
  19 in `ci.yml`). Eine Zeile, eigener Vorgang.
- **Ein Glocken-Hinweis je GESPRÄCH, nicht je Nachricht** — Entscheidung vom
  27.08., Bestätigung offen.
- **Abschnitt 4 des Issues ist mit Detlev nicht abgestimmt.**
- Von der Nachbarsitzung gemeldet: **AGE-655** (`fetchMessages`,
  `src/lib/chat.ts:320`, lädt ohne `limit`/`range`), **AGE-653**
  (`deno.json` nach `supabase/functions/`).
- Unverändert offen: AGE-610 · AGE-512 · Aktivierungsversand 69/72 · Rotation
  des PROD-DB-Passworts · AGE-598 · AGE-256 · AGE-606 · AGE-628/629/630.
