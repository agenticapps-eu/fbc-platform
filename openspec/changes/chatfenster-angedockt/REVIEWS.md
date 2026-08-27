---
reviewers: [gemini, opencode]
models: [gemini-3-pro, hf:moonshotai/Kimi-K3]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: a70f2485b46169ae5ff7128082ec81dbc6e858e031cda35249d1626e98045dc2
---

# Change review — chatfenster-angedockt (AGE-639)

Zwei Reviewer, zwei fremde Anbieter, beide **vor der ersten Codezeile**.
`claude` ist als eigener Anbieter ausgeschlossen. Beide Urteile:
**REQUEST-CHANGES** — und beide haben unabhängig voneinander denselben Fehler
im Fundament gefunden.

## Reviewer: gemini (gemini-3-pro)

VERDICT: REQUEST-CHANGES

- **[HIGH]** design.md / „Gerätelokal gespeichert" — `fbc.chatFenster` ist nicht
  nach Konto getrennt. Meldet A sich ab und B am selben Browser an, versucht B,
  **As Fenster** wiederherzustellen: fehlschlagende Abfragen, und die blosse
  Anzahl von As Gesprächen wird sichtbar. — Schlüssel um die Kennung ergänzen.
- **[MEDIUM]** design.md / „Die Geometrie" — Die Rechnung ist inkonsistent; bei
  1280 px mit aufgeklappten Leisten bleiben nicht 60 rem. Die Schlussfolgerung
  mag stimmen, der Beleg dafür ist falsch. — Vollständig nachrechnen.
- **[LOW]** design.md / „Der Zustand" — Die Verdrängungsregel nennt nicht, dass
  **Senden** als „berühren" zählt. Ein Fenster, in dem gerade geschrieben wird,
  kann als „am längsten unberührt" geräumt werden.
- **[LOW]** tasks.md / Abschnitt 3 — Der Umbau der ausgelieferten `ChatPage`
  wird als risikofrei dargestellt, sofern die Tests grün bleiben. Tests fangen
  Lebenszyklus- und Nebenläufigkeitsnuancen selten. — Eine ausdrückliche
  Sichtprobe der Vollansicht ergänzen.

## Reviewer: opencode (hf:moonshotai/Kimi-K3)

VERDICT: REQUEST-CHANGES

- **[HIGH]** design.md „Die Geometrie" + design-system-Delta — Die Rechnung
  lässt die **linke Navigationsleiste** weg (16 rem offen). Bei 1280 px mit
  beiden Leisten offen bleiben ~44 rem, nicht 60. Das Spec-Requirement verspricht
  wörtlich „bounded so that the row **fits**" — das ist dann falsch. Und: „ein
  geclipptes Fenster ist halbiert mitten in der Sendezeile — ‚clipped rather than
  scrolled' löst das Platzproblem nicht, es versteckt es."
- **[HIGH]** `useChatfenster` / Spec „longest without being touched" — „berührt"
  ist undefiniert; Senden, Tippen und Fokussieren zählen nicht. Das Spec-Wort
  verspricht etwas, das die Umsetzung nicht liefert, und der **Entwurf im
  Fenster geht verloren**.
- **[MEDIUM]** design-system-Delta (MODIFIED) — Der Block stellt das Requirement
  vollständig neu aus **und republiziert dabei unverändert** die Zeile „Below
  `lg` the right bar SHALL likewise open as an off-canvas drawer", die die Tasks
  selbst als falsch belegen (gebaut ist `xl`). „Wer ein Requirement ohnehin neu
  ausstellt … schützt sich selbst, nicht die Spec."
- **[MEDIUM]** design.md „Realtime" — `setQueryData<ChatMessage[]>` setzt einen
  **flachen** Cache voraus; das ist eine stillschweigende Annahme über
  `chat.ts`. Dazu das Wettrennen: trifft eine Nachricht vor dem ersten Fetch
  ein, verwirft `prev ? … : prev` sie.
- **[MEDIUM]** Fokus — Wird ein Fenster geschlossen, während der Fokus darin
  steht, fällt er auf `document.body`. Nirgends steht, wohin er stattdessen soll.
- **[LOW]** Spec-Lücke — Das erneute Anklicken eines bereits offenen Gesprächs
  steht in den Tasks, aber in keiner Anforderung und keinem Szenario.
- **[LOW]** Minimiertes Fenster — Die Begründung fürs Verlaufsladen („der Zähler
  hätte nichts, worauf er sich bezieht") ist die schwächere von zweien; tragend
  ist der Merge-Pfad. Dazu: woher kommt der Zähler, und was, wenn der Thread
  ausserhalb des geladenen Umfangs liegt?
- **[LOW]** `useGespraech` — Das Teilen ist **kein** Scope-Creep und der Guard um
  `subscribeToThread` ist richtig. Aber „die Zahl der Schreibvorgänge bleibt
  dieselbe" ist eine Behauptung ohne Messpunkt, und `aktiv` könnte in `ChatPage`
  toter Code sein.
- **[LOW]** `--fbc-fenster-h` — Wer setzt sie zurück, wenn die Reihe abgebaut
  wird? Bleibt sie auf 26 rem stehen, schweben die Toasts grundlos.

Ausgesprochen wurden ausserdem acht unausgesprochene Annahmen; die drei, die
etwas kosten, stehen jetzt im Design (zwei Tabs, Schrumpfen unter `xl`,
Umfangsgrenze des Zählers).

## Nicht gezählt

Keiner. Beide Reviewer haben mit Exit 0 geantwortet.

## Resolution

**Beide HIGH-Befunde zur Geometrie treffen zu, und sie waren derselbe.** Zwei
Anbieter, unabhängig, dieselbe Zeile — das ist genau der Wert dieses Schritts.
Die Tabelle zog nur die rechte Leiste ab. Nachgerechnet stehen bei 1280 px mit
beiden Leisten offen **44 rem** statt der behaupteten 60. Drei Fenster à 19 rem
(58 rem) passten damit **nicht einmal im Startzustand** (57,5 rem).

Geändert:

| Befund | Was jetzt gilt |
| --- | --- |
| Geometrie (beide, HIGH) | Tabelle über **vier** Konfigurationen, beide Leisten eingerechnet. Fensterbreite 18 statt 19 rem. Die Entscheidung „höchstens drei" überlebt; ihre Begründung war falsch und ist ersetzt. |
| Angeschnittenes Fenster (opencode) | **Verworfen.** Statt Abschneiden teilen sich die Fenster den Platz: `flex 1 1 18rem`, `max 18rem`, `min 12rem`. Bei 44 rem sind es 14,3 rem je Fenster — drei **ganze** Fenster. Die ZAHL bleibt fest bei drei, nur die Breite gibt nach; Donalds Absage galt der variablen Zahl, nicht der Breite. |
| Speicher je Konto (gemini, HIGH) | Schlüssel ist `fbc.chatFenster.<uid>`. Eigener Test mit zwei Kennungen. |
| „Berührt" (opencode HIGH, gemini LOW) | In Anforderung, Szenario und Tasks: Öffnen, Aufziehen, **Senden**, Zeiger-/Fokuskontakt. |
| Falsche `lg`-Zeile republiziert (opencode) | **Wird mitkorrigiert.** Das Argument sticht: der `MODIFIED`-Block stellt das Requirement ohnehin vollständig neu aus. Rechte Leiste dockt an `xl`; Schliessbedingung hängt an der **eigenen** Schwelle der jeweiligen Leiste; drei Szenarien nachgezogen; ein neues Szenario für das Band zwischen `lg` und `xl`. Der bestehende Test bei 1152 px belegt, dass der Code schon `xl` war. |
| Flacher Cache (opencode) | Belegt statt angenommen: `ChatPage.tsx:62` ist ein `useQuery` auf `fetchMessages` (`chat.ts:320` → `ChatMessage[]`), und `ChatPage.tsx:86` macht **denselben** `setQueryData`-Aufruf schon heute. |
| Wettrennen vor dem ersten Fetch (opencode) | Als **bestehende** Lücke benannt — wortgleich `ChatPage.tsx:81` seit AGE-248. Dieser Change macht sie nicht grösser; sie zu schliessen ist ein Folgevorgang. |
| Fokus beim Schliessen (opencode) | Geregelt: auf den Minimieren-Schalter des rechtesten verbliebenen Fensters, sonst auf den Pill der Leiste. Anforderung, Szenario, Task. Verdrängung braucht keine Regel — der auslösende Klick liegt in der Leiste. |
| Erneutes Anklicken (opencode) | Anforderung + Szenario ergänzt. |
| Zähler / Verlaufsladen (opencode) | Schwache Begründung ersetzt. Der Zähler kommt aus `unread_message_counts()`, und die ist **ungeseitet** (`chat.ts:156`) — die Umfangssorge trifft nicht zu. Tragend ist der Merge-Pfad. |
| Schreibvorgänge zählen (opencode) | Abnahmepunkt in Task 3. `aktiv` ist in `ChatPage` `Boolean(activeId)`, also nicht tot. |
| `--fbc-fenster-h` zurücksetzen (opencode) | Aufräumen im `return` des Effects + Test auf den Übergang. Variable liegt an `document.documentElement`, weil der `ToastProvider` in `main.tsx:30` oberhalb von `App` steht. |
| Sichtprobe `ChatPage` (gemini) | Als eigener Punkt in Task 3. |

**Nicht geändert, mit Begründung:**

- **Die harte Grenze von drei bleibt.** Beide Reviewer haben sie nicht
  angegriffen — nur ihre Rechnung. Donald hat sie am 27.08. mit der
  Verdrängungsregel ausdrücklich gewählt.
- **`subscribeToThread` in `ChatPage` bleibt unangetastet.** opencode nennt den
  Guard ausdrücklich richtig.
- **Keine Tab-Synchronisierung.** Als Annahme benannt statt behoben: das Projekt
  hat sie nirgends, und sie hier einzuführen wäre ein Mechanismus für einen
  Vorgang, der ihn nicht braucht.
