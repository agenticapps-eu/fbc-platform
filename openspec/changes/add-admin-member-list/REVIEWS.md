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
