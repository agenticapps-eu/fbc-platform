---
reviewers: [gemini, codex, opencode]
models: [gemini-pro, GPT-5, kimi-k3]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 30eabe20174cf508d8a2d03daa845072dba8606eb20eb5a0607d76d80db6f57d
---

# Change review — anforderung-eingang

Geprüft wurde der Stand vom 22.09. (Proposal, Design, Tasks und Spec-Delta,
dazu Teil 4 von `docs/custom-gpt-anforderungen.md`). Der SHA oben gilt dem
zusammengesetzten Prompt, nicht den heutigen Artefakten: die Auflösung unten hat
alle Dateien danach geändert. Die Ausgaben lagen in `.gstack/review-*.txt`
(gitignoriert). Unten stehen sie gekürzt, jeder Befund mit Schwere und Kern.

## Reviewer: gemini

VERDICT: REQUEST-CHANGES

Modell laut Antwort: gemini-pro. Aufruf über `reviewer-cli.sh`, exit 0.

- [HIGH] Entscheidung 5: Zählen vor den Downloads lässt einen Schlüsselinhaber
  mit absichtlich langsamen Links die Quote verbrauchen, ohne dass ein Issue
  entsteht. Zählen erst nach dem Anlegen.
- [MEDIUM] Spec Dateien: Ein String-Eintrag hat keinen Namen, und der Vermerk
  bleibt leer. Den String selbst nennen.
- [LOW] Vertrag: Die Beschreibung von `beschreibung` im Schema zwingt die
  Gliederung zu starr auf.
- [LOW] Tests: Der Golden-Snapshot in `grants_test` ist brüchig.

## Reviewer: codex

VERDICT: REQUEST-CHANGES

Modell laut Antwort: GPT-5. Aufruf über `reviewer-cli.sh` mit
`REVIEWER_TIMEOUT=1500`, exit 0.

- [HIGH] Drossel: „räumen, einfügen, zählen" ist bei Nebenläufigkeit keine
  harte Grenze, und gedrosselte Aufrufe verlängern die Sperre.
- [HIGH] Keine Idempotenz: Ein Abbruch auf dem Rückweg führt zu doppelten
  Issues.
- [HIGH] SSRF als klein eingestuft: Weiterleitungen und interne Ziele sind nicht
  ausgeschlossen. Hostliste und keine Weiterleitungen.
- [HIGH] Datenschutz: Der Probelauf loggt die ganze Beschreibung.
- [HIGH] Der Vertrag erklärt `array<string>`, die Function braucht Objekte.
- [HIGH] Die Gesamtfrist ist ohne `AbortSignal` wirkungslos.
- [MEDIUM] Probelauf mit 201 und Scheinnummer widerspricht „angelegt".
- [MEDIUM] Kein `{ fehler }` für 401 und 429, 500 und 502 fehlen im Schema.
- [MEDIUM] Die MIME-Begründung ist falsch, denn Bilder werden in Linear angezeigt.
  Den Inhalt prüfen.
- [MEDIUM] Dateinamen sind unbegrenzt und können Markdown einschleusen.
- [MEDIUM] Das Hashen hängt von der Headerlänge ab, und die Behauptung ist zu
  stark.
- [MEDIUM] Eine langsame erste Datei frisst das ganze Budget. Frist je Datei.
- [MEDIUM] Ein Transportfehler bei `issueCreate` ist ein unbekannter Ausgang,
  „nicht angekommen" kann falsch sein.
- [MEDIUM] Zählsemantik: Linear-Ausfall und Probeläufe verbrauchen die Quote.
- [MEDIUM] Header-Kollision beim `PUT` ist ungeregelt.
- [MEDIUM] Die Testliste deckt die großen Risiken nicht ab.
- [MEDIUM] Die ChatGPT-Frist ist unbekannt, die 30 s sind willkürlich.
- [LOW] „Zeichen" ist nicht definiert.
- [LOW] Das Datumsformat ist nicht festgelegt.
- [LOW] Die IDs sind nicht dokumentiert und nicht geprüft.

## Reviewer: opencode

VERDICT: REQUEST-CHANGES

Modell laut Antwort: kimi-k3 (`hf:moonshotai/Kimi-K3`). Aufruf über
`reviewer-cli.sh` mit `REVIEWER_TIMEOUT=1200`, exit 0.

- [HIGH] Kein Task beschafft die Linear-IDs und legt fehlende Labels an.
- [HIGH] Drossel: 502 und 429 verbrauchen Quote, und Nebenläufigkeit ist offen.
- [HIGH] Nacheinander plus 30 s macht „10 × 25 MB" unerreichbar.
- [MEDIUM] Name, Einreicher und Titel landen unmaskiert im Markdown.
- [MEDIUM] Kaputtes JSON ist nicht spezifiziert.
- [MEDIUM] Die Speicherrechnung hat keinen Spielraum.
- [MEDIUM] Im Vertrag fehlen 500, 502 und ein Rumpf für 429.
- [MEDIUM] Eine langsame erste Datei blockiert alle folgenden.
- [MEDIUM] Die Hostbeschränkung hängt an einer nicht blockierenden Messung.
- [LOW] Der Probelauf verbraucht die Quote auf DEV.
- [LOW] `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` sind nicht vermerkt.

## Not counted

- claude: eigener Anbieter, nicht angesetzt.

## Resolution

Zwei offene Fragen ließen sich nach der Review aus der OpenAI-Doku beantworten
statt messen. ChatGPT bricht eine Action nach **45 s** ab (actions/production).
Der Download-Host ist **`files.oaiusercontent.com`**, und die Objektform trotz
`string` im Schema ist ausdrücklich dokumentiert (actions/sending-files).

**Übernommen:**

- **Drossel** (alle drei): Prüfen und Vermerken sind getrennt. Gezählt wird nur
  ein Issue, das Linear bestätigt hat. 400, 401, 429, 502 und Probeläufe zählen
  nicht, und gedrosselte Aufrufe schreiben nichts (design.md, Entscheidung 5, und
  Spec).
- **Fristen** (codex, opencode): 12 s je Datei, 25 s gesamt, 8 s für
  `issueCreate`, über `AbortSignal`. Abgeleitet aus den dokumentierten 45 s und
  mit Tests für hängenden GET, `PUT` und `issueCreate`.
- **SSRF** (codex, opencode): nur `https`, Host genau `files.oaiusercontent.com`,
  `redirect: "manual"`, und eine Weiterleitung wird mit Zielhost vermerkt statt
  verfolgt. Ob OpenAI weiterleitet, zeigt der Probelauf (Task 7.2).
- **Log und Datenschutz** (codex): eine eigene Anforderung „Das Log trägt keine
  Inhalte", und der Probelauf loggt nur Typ, Größe, Host und Ergebnis. Die
  Datenschutzentscheidung selbst bleibt in AGE-830, ist aber jetzt eine Bedingung
  **vor der Übergabe an Detlev** (Task 7.4).
- **Probelauf** (codex): 200 mit `{ probelauf: true, hinweis }`, ohne `nummer`.
- **`{ fehler }` für jede Ablehnung** (codex, opencode): eigene Anforderung,
  einschließlich kaputtem JSON, 401, 405, 429, 500 und 502. Der Vertrag wird
  nachgezogen (Task 5.3).
- **Signatur statt MIME-Vertrauen** (codex): Die Begründung war falsch und ist
  gestrichen. Die ersten Bytes müssen zum erklärten Typ passen.
- **Markdown-Maskierung** (codex, opencode): Name, Einreicher und Route werden
  bereinigt, auf 100 Zeichen gekürzt und maskiert. Der Titel geht als Titel an
  Linear und nicht in Markdown.
- **String-Eintrag** (gemini): Er wird unter seinem eigenen Wert vermerkt.
- **Konstantzeit** (codex): Header über 512 Zeichen werden vor dem Hashen
  abgelehnt, und die Behauptung ist auf den Vergleich der Digests eingeengt.
- **502-Satz** (codex): „nicht bestätigt" statt „nicht angekommen".
- **Header-Kollision** (codex): Linears signierte Werte gewinnen, mit Test.
- **IDs** (opencode, codex LOW): Alle acht wurden per Linear-MCP gegen Linear
  geprüft. Die Labels `von-detlev` und `Idee` hat Donald am 22.09. schon angelegt.
  Tabelle in design.md, Entscheidung 8.
- **„Zeichen" und Datum** (codex LOW): Codepoints, `TT.MM.JJJJ, HH:MM`.
- **Auto-injizierte Secrets** (opencode LOW): Task 5.1.
- **Realistisches Versprechen** (opencode): Das Design sagt jetzt ausdrücklich,
  dass „zehn Dateien zu 25 MB" nur gilt, soweit sie in die Frist passen.

**Begründet nicht übernommen:**

- **Idempotenz** (codex HIGH, opencode Annahme 9): ChatGPT liefert keinen
  Schlüssel je Aufruf. Eine Erkennung über den Inhalt fängt gerade den
  gefährlichen Fall nicht ab, dass der erste Aufruf noch läuft, während der
  zweite eintrifft. Die Fristen liegen jetzt mit Abstand unter den
  dokumentierten 45 s, damit wird der Auslöser selten. Doppelte führt Donald in
  der Triage zusammen, das hat er am 22.09. mit den Risiken so angenommen.
- **Harte Grenze bei Nebenläufigkeit** (codex HIGH, opencode): Sie ist
  ausdrücklich hingenommen und in der Spec benannt. Einen einzigen Einreicher,
  der einzeln bestätigt, betrifft sie nicht. Eine Reservierung mit Sperre und
  Rücknahme wäre viel Bau für eine Grenze, die Missbrauch nur begrenzen soll.
- **Zählen erst nach dem Anlegen, damit keine Quote verbrannt wird** (gemini
  HIGH): Das ist übernommen. Der dort gezeichnete Angriff setzt aber einen
  gültigen Schlüssel voraus, und mit dem ließen sich ohnehin 20 echte Issues
  anlegen.
- **Vertrag auf Objekte umstellen** (codex HIGH): OpenAI dokumentiert genau diese
  Abweichung, und die Doku verlangt `string`. Ein Umstellen riskiert die
  Transformation, von der die Dateien abhängen. Die Fixture in
  `dateien.test.ts` hält die Objektform fest.
- **Grenze auf 20 MB senken** (opencode MEDIUM): 25 MB hat Donald entschieden.
  Die fehlende Reserve bei drei gleichzeitigen Aufrufen ist als Risiko benannt,
  und bei einem einzigen Einreicher ist der Fall nicht zu erwarten.
- **Parallelität der Drossel mit echten DB-Verbindungen testen** (codex): Sie
  wird nicht zugesagt, also gibt es nichts zu belegen.
- **Gliederung im Schema lockern** (gemini LOW): Die Gliederung kommt aus den
  Instructions und ist gewollt. Die Function prüft sie nicht.
- **`grants_test` robuster machen** (gemini LOW): Das liegt außerhalb dieses
  Change. Abschnitt 6 bleibt hier unverändert.

<!-- openspec-review-trailer v1
implementing-host: claude
digest: sha256:372389ac1d46e4bc0de401ba5199f941c7b6e7c0da7a72896fde2a71e66d9975
producer-version: 1.2.0
tasks-digest: sha256:f5dcda7a47458910f25dd98c053de7bb47ab60ba24bb684a798ed6f338419b28
-->
