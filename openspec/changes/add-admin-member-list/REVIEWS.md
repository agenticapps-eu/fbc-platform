---
reviewers: [gemini, codex]
models: [gemini-3-pro, gpt-5.2-codex]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 1643d19345c317b7792adb255b870effa70a5e3f50354e86de49d7fb89296c20
---

# Change review — add-admin-member-list (AGE-566)

Plan-Review nach Schritt 2b, **vor** der ersten Codezeile. Prüfer sind zwei
fremde Hersteller; der eigene ist ausgeschlossen. Ausgabe beider CLIs von
Banner- und Hook-Zeilen bereinigt (gemini hängt SessionEnd-Hooklogs an die
Antwort — die Zeilen 17–25 seiner Rohausgabe sind keine Befunde).

Beide Verdikte lauten REQUEST-CHANGES. Das blockiert nichts — der Gate prüft nur,
ob der Delta parst. Der Wert steckt in der Auflösung unten.

## Reviewer: gemini (gemini-3-pro)

VERDICT: REQUEST-CHANGES

- **[HIGH] Paritätstest prüft Spalten, nicht Logik** — läuft `search_directory`
  später ein Filter zu (etwa „gesperrte Mitglieder ausblenden"), übernimmt die
  Admin-Liste ihn still nicht und zeigt ein Bild, das Mitglieder so nicht sehen.
  → Parität als **Verhalten** fordern und datengetrieben prüfen, nicht nur die
  Spaltennamen vergleichen.
- **[MEDIUM] Keine Spur beim direkten Aktivieren** — wer hat wann wen sichtbar
  gemacht? → Protokollieren.
- **[LOW] Sortierung offen gelassen** — macht den Paging-Test schwächer.

## Reviewer: codex (gpt-5.2-codex)

VERDICT: REQUEST-CHANGES

- **[HIGH] Aufgabe 1.1 löscht die falsche Delta-Operation.** Dieser Change
  benutzt `MODIFIED`; die Anforderung besteht danach unter demselben Titel
  weiter. Nähme `add-admin-console` sein `REMOVED` heraus, verböte die dauerhafte
  Wahrheit weiterhin genau die Massen-Mail, die jener Change baut. → `REMOVED`
  dort **behalten**, die Reihenfolge der Archivierung festschreiben, und nur die
  doppelte Mitgliederlisten-Anforderung samt ihrer Aufgaben entfernen.
- **[HIGH] Verstoß gegen eine bestehende Anforderung.**
  `openspec/specs/admin/spec.md:360` — „Privilegierte Änderungen hinterlassen
  eine Spur" — verlangt für **jede** Admin-Änderung an einem fremden Konto eine
  Zeile in `public.admin_audit`, ausdrücklich „mit der Fähigkeit zusammen" und
  „SHALL NOT nachgereicht werden". Weder Delta noch Aufgaben sahen das vor.
  → Aktivierung und Protokolleintrag in **einer** Transaktion.
- **[HIGH] Die Hauptfunktion ist nicht spezifiziert.** `p_status` hat keine
  erlaubten Werte und keine Bedeutung; `p_query` wird nur mit `%` geprüft. Eine
  Umsetzung dürfte beide Parameter ignorieren und erfüllte jedes Szenario.
  → `alle|aktiviert|offen` definieren, Verhalten bei `null`/ungültig festlegen,
  Suchfelder benennen, positive Tests ergänzen.
- **[HIGH] Ein Klick, unumkehrbar, ohne Rückfrage.** Es gibt keinen Weg zurück:
  `mark_activated` schreibt `coalesce(activated_at, now())`, eine Rücksetz-RPC
  existiert nicht. „Optisch getrennt" schützt nicht vor einem Fehlklick.
  → Rückfrage, die das Mitglied **namentlich** nennt und die Folge benennt; die
  Handlung nur auf unbestätigten Zeilen anbieten.
- **[MEDIUM] Die Szenarien rufen `admin_list_members()` ohne Argumente**, die
  geplante Signatur setzt aber nur für `p_limit`/`p_offset` Vorgabewerte →
  Postgres meldet „function does not exist" statt der versprochenen `42501`.
  → Alle vier Parameter mit `DEFAULT`.
- **[MEDIUM] „`send-activation` antwortet immer mit 202" ist falsch.** Der
  Handler liefert auch 405, 400, 500 und 502. Die Fläche könnte bei einem
  Betriebsfehler „angefordert" melden. → 202 als den
  adressununterscheidbaren Pfad qualifizieren und Nicht-2xx testen.
- **[MEDIUM] Sortierung.** „Stabil" genügt nicht: nach Namen allein ist bei
  Dubletten und `null` nicht deterministisch, und nach Aktivierungszustand
  wandern Zeilen unmittelbar nach dem Aktivieren zwischen den Seiten.
  → Vor dem Bauen entscheiden, `id` als Stichentscheid.
- **[MEDIUM] Die „vorhandene Verzeichniskarte" ist privat.**
  `MemberDirectory.tsx:360` — `MemberCard` ist nicht exportiert und verdrahtet
  `` to={`/p/${member.id}`} `` fest. Wiederverwendung heißt also **doch**,
  mitgliedersichtbaren Code zu ändern. → Karte mit Ziel-Prop exportieren und
  einen Regressionstest, dass das normale Verzeichnis weiter auf `/p/:id` zeigt.
- **[LOW] `search_directory` liefert vierzehn Spalten, nicht dreizehn.**
- **[LOW] Zwei als RED ausgewiesene Tests können nicht rot sein** (4.2 und 5.8
  beschreiben bestehendes Verhalten). → Als Regressionstests kennzeichnen.

## Nicht gezählt

Keiner. Beide Prüfer liefen mit Ausgang 0 und lieferten Inhalt. `REVIEWER_TIMEOUT`
war von vornherein auf 900 s gesetzt — mit den voreingestellten 300 s hat codex
in diesem Projekt bisher regelmäßig als Ausgang 4 geendet und wäre nicht
gezählt worden.

## Auflösung

**Nachgeprüft statt geglaubt.** Fünf Befunde behaupten etwas über den Bestand;
alle fünf wurden gegen die Dateien gehalten und **alle fünf treffen zu**:
`admin_audit` und die Anforderung auf Zeile 360 existieren · `send-activation`
liefert 405/400/500/502 · `MemberCard:360` ist privat mit festem `/p/:id` ·
`search_directory` hat 14 Spalten · es gibt keine Rücksetz-RPC.

| Befund | Was daraus wurde |
|---|---|
| codex HIGH-1 (falsche Delta-Operation) | **Übernommen.** Aufgabe 1 neu gefasst: `REMOVED` in `add-admin-console` bleibt, nur die doppelte Listen-Anforderung geht; Archivierungsreihenfolge festgeschrieben. |
| codex HIGH-2 + gemini MEDIUM (Spur) | **Übernommen, und es war ein Verstoß, keine Lücke.** `admin_activate_member` schreibt `admin_audit` in derselben Transaktion; eigene Anforderung, eigene Szenarien, eigene Aufgabe. |
| codex HIGH-3 (`p_status` unspezifiziert) | **Übernommen.** Werte, `null`-Verhalten und Suchfelder in der Anforderung; positive Tests statt nur der Jokerzeichen-Gegenprobe. |
| codex HIGH-4 (Rückfrage) | **Übernommen.** Namentliche Rückfrage mit Folgenhinweis, Handlung nur auf unbestätigten Zeilen. |
| gemini HIGH (Logik- statt Spaltenparität) | **Teilweise übernommen.** Die datengetriebene Probe kommt dazu: für ein **bestätigtes** Mitglied müssen beide Funktionen dieselbe Zeile liefern. Nicht übernommen wird „logische Parität" als Dauerzusage — die Funktionen sollen sich in genau einem Punkt unterscheiden, und eine Zusage, die dieses Delta beschreiben müsste, wäre beim nächsten Filter wieder falsch. Die Probe fängt den Fall, die Zusage hätte ihn nur benannt. |
| codex MEDIUM-1 (fehlende `DEFAULT`) | **Übernommen.** Alle vier Parameter mit Vorgabewert. |
| codex MEDIUM-2 (202 ist nicht immer) | **Übernommen.** Die Behauptung stand so in Design **und** Delta und war schlicht falsch. |
| codex MEDIUM-3 + gemini LOW (Sortierung) | **Übernommen.** Entschieden statt vertagt: unbestätigte zuerst, dann Name, `id` als Stichentscheid. Die offene Frage entfällt. |
| codex MEDIUM-4 (Karte ist privat) | **Übernommen — es widerlegt eine Zusage des Entwurfs.** „Kein mitgliedersichtbarer Code wird angefasst" war falsch. Jetzt benannt, mit Regressionstest auf das öffentliche Verzeichnis. |
| codex LOW-1 (14 statt 13) | **Übernommen.** Die Zahl fliegt raus; der Katalogvergleich bestimmt die Projektion. |
| codex LOW-2 (unmögliches RED) | **Übernommen.** Beide als Regressionstests gekennzeichnet. |

Nicht übernommen wurde ausschließlich der Dauerzusage-Teil von geminis HIGH,
begründet oben. Alles andere ist eingearbeitet — der Change wurde nach diesem
Review überarbeitet, nicht nur kommentiert.

---

# Review auf dem Diff (Aufgabe 6.4)

Nach der Umsetzung, vor dem PR. Prompt: der vollständige Diff gegen `main` über
`src/` und `supabase/` (90 kB), plus die Invarianten des Projekts und die
Aufforderung, Befunde zu benennen statt zu erfinden. Wieder beide fremde
Anbieter, `REVIEWER_TIMEOUT=900` **von vornherein** — mit den voreingestellten
300 s endet codex hier regelmässig als Ausgang 4 und zählt dann nicht. Beide
Läufe endeten mit 0. Geminis Ausgabe ist um die angehängten SessionEnd-Hookzeilen
bereinigt; sie sind keine Befunde.

## Reviewer: gemini (gemini-3-pro)

VERDICT: APPROVE

Kein Befund. Hervorgehoben werden die Rollenprüfung in den DEFINER-Funktionen,
die ausgesprochenen Grants, die transaktionale Spur, der Paritätstest und der
Wächter gegen ein admin-gesetztes Passwort.

**Bemerkenswert und der Grund, warum ein Freispruch kein Befund ist:** dieselbe
Antwort nennt ausdrücklich „die Sortierung ist durch den `id`-Stichentscheid
stabil, was Paging-Fehler verhindert" und „die Funktionen sind gegen fehlerhafte
Eingaben gehärtet". Genau an diesen zwei Stellen — Blätterung und Eingaben — hat
der zweite Prüfer dann etwas gefunden. Ein APPROVE misst die Aufmerksamkeit des
Prüfers, nicht die Fehlerfreiheit des Codes.

## Reviewer: codex (gpt-5.2-codex)

VERDICT: REQUEST-CHANGES

- **[HIGH] Wettlauf in `admin_activate_member`** (`…120000:224`) — der
  `select activated_at` läuft ohne Zeilensperre. Zwei gleichzeitige Aufrufe
  lesen beide `null`, kommen beide an der 22023-Prüfung vorbei und schreiben
  BEIDE eine Auditzeile für EINE Änderung. Bei gleichzeitiger Selbstaktivierung
  steht ein Admin als Akteur einer fremden Handlung. → `for update`.
- **[MEDIUM] `limit p_limit` bei explizitem `null`** (`…120000:156`) — ein
  Vorgabewert greift nur bei fehlendem Argument; `limit null` heißt „ohne
  Grenze", und `database.types.ts` erlaubt `p_limit: number | null`.
  → `coalesce`.
- **[MEDIUM] Leere Folgeseite ist eine Sackgasse** (`AdminMitgliederPage:178`) —
  die Blätterung rendert nur neben Treffern; wird auf der letzten Seite die
  letzte Zeile aktiviert, verschwindet mit den Treffern der „Zurück"-Knopf.
- **[LOW] Beide Sidebar-Einträge aktiv** (`SidebarNav`) — `NavLink` matcht ohne
  `end` als Präfix, `/admin` also auch auf `/admin/mitglieder`.

Ohne Befund: Rollenprüfung, leerer `search_path`, Grants (`anon` nein,
`authenticated` ja), maskierte Jokerzeichen, stabile Sortierung.

## Nachgeprüft statt geglaubt

**Vier Befunde, vier Nachprüfungen, vier Treffer** — zwei davon gemessen, nicht
gelesen:

| Befund | Womit nachgeprüft | Ergebnis |
|---|---|---|
| HIGH Wettlauf | zwei Verbindungen, beide lesen vor dem Schreiben, `Promise.all` | **bestätigt**: A `OK`, B `OK`, `activated_at` einmal gesetzt, **zwei** Auditzeilen. Der erste Messversuch mit sequenziellen Aufrufen hing an der Zeilensperre des UPDATE — das war schon der halbe Beleg. |
| MEDIUM `limit null` | derselbe Aufruf zweimal am lokalen Bestand (74 Profile) | **bestätigt**: ohne Argumente 50 Zeilen, mit vier `null`-Argumenten **74**. Beim OFFSET liegt dagegen KEIN Befund: `offset null` verhält sich wie `offset 0` (ebenfalls gemessen). |
| MEDIUM leere Folgeseite | Quelltext: `<Blaetterung>` steht innerhalb von `members.length > 0` | **bestätigt**, und kein Test deckte `seite > 0` mit leerem Ergebnis ab. Unabhängig auch beim eigenen Lesen gefunden. |
| LOW Sidebar | `SidebarNav.tsx:57` — `end={item.path === "/"}` | **bestätigt**. Im Browser gegengeprüft: vor der Korrektur zwei aktive Einträge, danach einer. |

## Zwei Befunde, die kein Prüfer hatte

- **Das Suchfeld entprellte nicht.** Es schrieb direkt in den Query-Key, also war
  jeder Tastendruck eine RPC — und diese verbindet `profiles` mit `auth.users`
  und zählt zu jedem Treffer Angebote und Bedarfe. Der Nachbar
  `MemberDirectory.tsx:56` hält dafür seit jeher 300 ms und schreibt den Grund
  daneben. **Im Browser gemessen:** vier Tastendrücke, vier Anfragen; nach der
  Korrektur vier Tastendrücke, **eine**.
- **`admin_member_list_test.sql` stand nicht in der CI-Liste.** Die 45
  Assertions dieses Changes — die gesamte datenbankseitige Absicherung — sind in
  CI noch nie gelaufen. Der Kommentar zwei Zeilen darüber in `ci.yml` warnt
  wörtlich davor: „Wer hier einen Test ergänzt, muss ihn auch in diese Zeile
  eintragen, sonst läuft er nie." Der schwerste Befund der Runde, und er kam aus
  dem Ausführen des Prüfbefehls, nicht aus dem Lesen des Diffs.

## Auflösung

**Alle sechs übernommen**, keiner abgelehnt. Zwei Entscheidungen dabei:

1. **Eine zweite Migration statt einer Korrektur in der ersten.**
   20260817120000 liegt bereits auf DEV und PROD. Eine Änderung IN der Datei
   erreichte keine der beiden Datenbanken, und der Quelltext behauptete etwas,
   das nirgends läuft. → `20260817140000_admin_member_list_fixes.sql`,
   forward-only, mit `create or replace`. **Folge: der PROD-Push muss ein
   zweites Mal von Hand laufen.**
2. **Die Sidebar-Regel wird ABGELEITET, nicht als Flagge gesetzt.** Der
   naheliegende Weg wäre ein `end`-Prop am Eintrag gewesen — aber dann prüfte
   der Test nur seine eigene Fixture und bliebe grün, während der Aufrufer die
   Flagge beim nächsten Unterpfad vergisst. Der Abschnitt kennt seine Einträge
   und beantwortet die Frage selbst.

**Rot vor grün, für jede Korrektur:**

- pgTAP auf der ersten Fassung: **2 von 45 rot** (`p_limit = null` liefert 51
  statt 50; der `for update`-Wächter greift ins Leere). Nach der Migration
  45/45 grün.
- Vitest auf dem Stand von `HEAD`: **genau die 3 neuen Prüfungen rot**, die 18
  übrigen grün. Mit den Korrekturen 21/21.
- Der Wettlauf: **zwei Auditzeilen vorher, eine nachher**, und der zweite
  Aufruf bekommt jetzt die zugesagte 22023 statt eines stillen `OK`.

**Der Wettlauf-Test ist ausdrücklich ein WÄCHTER, kein Verhaltenstest.** pgTAP
läuft in einer Transaktion und kann zwei nebenläufige Sitzungen nicht
herstellen; die Assertion prüft, dass `for update` nicht wieder aus dem Rumpf
verschwindet, und sagt das auch. Der Beleg ist die Messung oben — hier
festgehalten, weil sie sonst nirgends steht.

**Vollständiger Lauf nach den Korrekturen:** 860 Vitest-Tests grün (108
Dateien), 485 pgTAP-Assertions über die vier echten pgTAP-Dateien grün,
typecheck und lint ohne Fehler. `format:check` meldet 129 Dateien — davon war
eine meine, sie ist formatiert; die übrigen 128 sind bestehende Drift und
bleiben unangetastet.

**Was NICHT geprüft ist:** die leere Folgeseite im echten Browser. Der Zustand
verlangt, dass die Treffermenge schrumpft, während man auf der letzten Seite
steht; das hätte im lokalen Bestand eine echte Aktivierung gekostet. Er ist
durch die Vitest-Prüfung abgedeckt (rot vor der Korrektur) — aber in diesem
Projekt hat der Browser schon mehrfach etwas gezeigt, das jsdom grün meldete.
