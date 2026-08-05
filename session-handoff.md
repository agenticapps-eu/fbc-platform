# Session Handoff — 2026-08-05 (9. Session)

## Stand in einem Satz

**C3 ist bewusst NICHT gestartet.** Diese Session hat die Nachläufe aus dem
8.-Session-Handoff abgearbeitet (AGE-501) und dabei zwei Dinge gefunden, die
dort nicht standen — beide betreffen Kontrollen, die aussahen, als liefen sie.

## Die zwei Funde, die diese Session ausmachen

**1. 33 Deno-Tests liefen nie in CI.** `.github/workflows/` enthielt keinen
einzigen Deno-Schritt, und `pnpm test` sieht die Edge Functions nicht — sie sind
Deno, nicht Node. Ungeprüft lagen damit genau die Grenzen, an denen Fremdverkehr
ankommt: **Stripe-Signaturprüfung** (manipulierter Body, falsches Secret,
veralteter Zeitstempel), **Open-Redirect-Schutz** in `resolveReturnBase`,
**HTML-Escaping** der Mail-Templates, **Fail-Closed** ohne `old_record`.
Job `edge-functions` ergänzt, `deno.lock` per `--frozen` verankert. Alle 33 grün
— sie waren nie kaputt, nur nie gefragt.

**2. Das Verifikations-Rezept des Workflow-Skills lieferte stillschweigend
Müll** (AGE-502). Der 8.-Session-Handoff notierte hier eine Prozesslücke; die
echte ist schlimmer und eine andere. `CH=$(ls -d …)` bricht an jedem `ls`-Alias
— hier `eza -lao` — und fängt die ganze Langformat-Zeile statt des Pfads. Jede
`$CH`-Prüfung greppt daraufhin ins Leere und meldet das als **Warnung**:

| an C4 gemessen | vorher   | nachher |
| -------------- | -------- | ------- |
| Reviewer-Zahl  | _(leer)_ | **3**   |
| offene Tasks   | _(leer)_ | 0       |

Das Rezept sah aus, als hätte es geprüft und nichts gefunden — bei einem Change,
dessen `REVIEWS.md` mit drei Reviewern die ganze Zeit dalag. Dazu: `$BASE` war
nie definiert, und der Branch-Kontext fehlte. Projektkopie korrigiert und einmal
durchlaufen; **der dauerhafte Fix liegt upstream im `claude-workflow`-Snapshot**
und betrifft alle sieben Projekte.

## Erledigt (AGE-501)

- **Flaky Test** `ThemeServerSync.test.tsx:121` — mit einem `MutationObserver`
  gemessen: wenn das DOM `navy` zeigt, steht im `localStorage` noch `hell`.
  Render-Wert vs. Effect-Wert. Beide Zusicherungen jetzt im selben `waitFor`,
  10/10 grün.
- **`NUR_REDIRECT` abgeleitet** statt handgepflegt. Belegt: eine achte
  Redirect-Route samt totem Link ließ der alte Test grün durch.
- **Roher `23505`** in `ProfilPage` übersetzt, mit `invalidateQueries` statt
  „nochmal versuchen". Rot → grün belegt.
- **„Meine Communities" ersatzlos entfernt** (Entscheidung Donald, 05.08.) —
  derselbe Fall wie „Aktivität & Portfolio" in AGE-494 7.6. Grid auf eine Spalte.
- **Arbeitsbaum**: `.planning/skill-observations/` und `*.pre-NNNN` ignoriert,
  zwei redundante Sicherungskopien gelöscht.

**Bewusst nicht gemacht:** `ChipGroup`/`ChipFilterGroup` bleiben doppelt. Sie
unterscheiden sich nur in zwei Utility-Klassen; eine gemeinsame Komponente
bräuchte eine `size`-Prop — die Abstraktion, die CLAUDE.md §2 untersagt und die
das AGE-494-Review schon zurückgewiesen hatte. Bei einer dritten Chip-Gruppe neu
bewerten.

Lauf: **lint 0 Fehler** (3 vorbestehende `react-refresh`-Warnungen) · typecheck
sauber · **397 Vitest in 64 Dateien** · **33 Deno-Tests** · Build ✓ ·
`openspec validate --all` 26/26.

## Next session: start here

**Zwei Dinge stehen offen, bevor irgendetwas Neues anfängt:**

1. **Stage-2-Code-Review für AGE-501 ist NICHT gelaufen.** Ein unabhängiges
   Review braucht einen Subagenten, und diese Session durfte keinen starten.
   `/code-review` oder `/pr-review-toolkit:review-pr` auf den PR ansetzen, bevor
   gemerged wird. `openspec validate` ersetzt das nicht.
2. **Der Dev-Server lief auf `localhost:5173`** für die Sichtprüfung von
   `/kontakte` nach dem Entfernen von „Meine Communities". Ein eingeloggter
   Screenshot war ohne Zugangsdaten nicht möglich — **die Sichtprüfung steht
   noch aus.**

Danach ist **C3 (AGE-495)** der nächste Change. Vorarbeit dieser Session: drei
seiner Abnahmepunkte sind durch C4 bereits erfüllt (`minimum_password_length`
= 10, `site_url` gesetzt, Redirect-Allow-List gezogen) — die Issue-Beschreibung
ist an diesen Stellen veraltet. Im Code ist C3 **grüne Wiese**: weder
`profiles.activated_at` noch `activation_tokens` noch `send-activation`
existieren. Linear führt AGE-495 als blockiert durch **AGE-256** (DNS-Zugang für
SPF/DKIM auf `fairbusinessclub.de`) — das blockiert aber nur die
Zustell-Abnahme, nicht den Sicherheitskern (RLS-Gate, Token, Aktivierungsschirm).

## Offene Nachläufe

- **Supabase-CA** → `DB_SCAN_CA_CERT` setzen, `DB_SCAN_TLS_INSECURE` entfernen.
  Braucht Dashboard-Zugang. **Falle:** `db-drift-scan.ts:56` erwartet einen
  **Dateipfad** (`readFileSync`), GitHub-Secrets sind Strings.
- **Beleglücke:** `grep -rl "Stage 2"` liefert im archivierten C4-Verzeichnis 0,
  obwohl das Review lief. Marker oder Vorlage — eines von beidem fehlt (AGE-502).
- **AGE-502 upstream fixen**, sonst überschreibt der nächste
  `/update-agenticapps-workflow` die Korrektur der Projektkopie.
- Go-Live-Woche: zwei `VITE_*`-Werte umstellen · Echt-Link-Probe ·
  **Stripe-Live-Keys nur auf PROD** (12 von 15 Function-Secrets sind identisch).
- Reviewer-Regel auf `production`, sobald ein Zweiter Schreibrechte hat.
- Preview-Abnahme durch Detlev.

## Fallen, die weiter gelten

- **`git add -A` ist verboten** — dauerhaft untracked Dateien mit 0600, Repo ist
  öffentlich.
- **`ls` ist ein Alias auf `eza -lao`.** `$(ls …)` in einem Skript liefert
  Langformat-Zeilen, nicht Pfade. Globs oder `command ls` benutzen. Das ist die
  Ursache von AGE-502 und wird die nächste Kontrolle genauso still zerlegen.
- **`psql` gibt es nicht.** DB-Zugriff über `pg` + `SUPABASE_DB_URL_*`.
- **`supabase test db` ohne Dateiliste meldet FAIL, obwohl grün.**
- **`@testing-library/user-event` ist nicht installiert** — hier wird
  `fireEvent` benutzt.
- **Der Pooler-Host ist pro Projekt verschieden** (alt `aws-1`, neu `aws-0`), und
  `db.<ref>.supabase.co` löst nur auf IPv6 auf — aus CI nicht erreichbar.
- **Merge immer gegenprüfen** (`state=closed merged=true`).
