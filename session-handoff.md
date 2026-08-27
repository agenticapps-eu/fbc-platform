# Session Handoff — 2026-08-27 (vierzigste Sitzung)

> Liegt im **neuen** Worktree `../fbc-platform.donald-age-627-chat-rechte-sidebar`,
> Branch `donald/age-627-chat-rechte-sidebar`. Der alte 583er-Worktree ist
> verlassen; sein Branch `donald/handoff-27-08` trägt einen Commit, den `main`
> nie bekommen hat (`3b22dca`, nur `session-handoff.md`) — **überholt durch
> diese Datei, nicht nachziehen.**

Angefangen mit „weiter" nach dem Handoff der 39. Sitzung, dann zwei Zurufe, die
den Zuschnitt umgeworfen haben. **Ein Plan fertig und committet, kein Code, zwei
neue Vorgänge, zwei eigene Fehler korrigiert.**

| Vorgang | Stand |
| --- | --- |
| **AGE-627** Chat als rechte Leiste | 📐 **Plan fertig, Gate offen, hier weitermachen** |
| **AGE-629** Suche als Inhaltsspalte (Mitglieder/Events/Academy) | 📋 neu angelegt |
| **AGE-630** Event-Vorlagen + Wiederholungen | 📋 neu angelegt |

## Accomplished

**Drei Vorgänge aus zwei Sätzen getrennt.** Donalds Zuruf mischte drei Dinge.
Seine Präzisierung entschied es: „Die Chat Sidebar ist komplett getrennt, die
anderen Sidebars sind wie bei Aktivität unter dem Header noch, rechte Chat
Sidebar ist komplett wie die linke Sidebar." Also: AGE-627 = Viewport-Kante,
AGE-629 = Inhaltsspalte, AGE-630 = Datenmodell. Beide neuen Issues tragen
gemessene Ausgangszustände, keine Vermutungen.

**AGE-627 geplant, von zwei Reviewern zerlegt, umgebaut.** codex und opencode,
beide REQUEST-CHANGES, dieselben vier Stellen unabhängig voneinander. Der Kern:
**PostgREST kann nicht nach einer Aggregatfunktion über eine to-many-Relation
sortieren**, und `message_threads` trägt nur `created_at` — „serverseitig
sortierte, begrenzte Seite" UND „keine Migration" war nie beides zu haben.
Weiter: der Drawer unter `lg` hatte gar keinen Öffner; mein „RED-Test" wäre
grün gewesen; „dieselben Threads wie /chat" und „begrenzte Seite" schlossen
einander aus. Alles in `REVIEWS.md` befundweise aufgelöst.

**Vier Reviewer-Behauptungen selbst nachgemessen**, alle vier hielten. Der
schärfste Fund war einer, den kein Reviewer hatte: `grants_test.sql:130–146`
hält fest, dass AGE-583 schon einmal zwei Spalten auf `message_threads`
vorschlug — abgelehnt, weil sie eine Lesebestätigung gewesen wären. Die drei
neuen Spalten sind es nicht (`threads_select` und `messages_select` reichen
exakt gleich weit, `20260806080100:214–231`), aber das ist jetzt bewiesen statt
behauptet.

## Decisions

- **Migration statt Ausrede** (Donald). `message_threads` bekommt
  `last_message_at`, `last_message_body`, `last_message_sender_id` per
  `security definer`-Trigger. Warum: die Alternative wäre gewesen, die
  Paging-Zusage abzuschwächen — und ohne Sortierschlüssel ist ein `limit`
  wertlos. Verworfen: DEFINER-RPC, weil sie das Sichtbarkeitsprädikat neben die
  RLS legt (die `profiles_public`-Falle).
- **Eigener Drawer-Öffner in der Topbar** (Donald), gespiegelt zum Hamburger.
  Warum: die Sprechblase zum Umschalter zu machen bräche den begründeten
  Grundsatz `AppShell.tsx:68` („Ein Link, kein Knopf").
- **Offset statt Cursor**, bewusst. Warum: der Instabilitätsfehler braucht mehr
  als zwanzig laufende Unterhaltungen — die hat heute niemand. Der Trigger legt
  schon den Schlüssel an, den ein Cursor bräuchte.
- **`/chat` ist NICHT mehr unverändert.** Eine Datenquelle, ein Umfang; beide
  Flächen laden dieselbe Seite. Die frühere Zusage war mit „begrenzte Seite"
  unerfüllbar.
- **Zwei Nachrichten-Bedienelemente unter `lg`** (Sprechblase + Öffner) in Kauf
  genommen, als Punkt auf der Sichtprobe notiert.
- **Partnername unterhalb `discover`** fällt auf den Rückfalltext zurück —
  heutiger Zustand, benannt statt repariert.

## Files modified

- `openspec/changes/chat-rechte-sidebar/` (neu, committet als `39776f2`):
  `proposal.md` · `design.md` (Datenentscheidung + verworfene Alternative) ·
  `tasks.md` (8 Bänder) · `REVIEWS.md` · Deltas für `design-system` und
  `messaging`
- `session-handoff.md` — diese Datei
- Kein Quellcode angefasst.

## Next session: start here

**Nichts hängt.** `openspec validate --all` ist grün (29/29), der Plan ist
committet, das Gate ist offen.

**Erster Griff: Band 1 aus `tasks.md` — die Migration.** pgTAP zuerst: drei
Spalten, Trigger setzt sie bei Insert, `authenticated` hat **kein** UPDATE-Recht
(auch kein spaltenweises), ein Dritter sieht die Spalten nicht. Dann die
Migration mit Entscheidungskopf, Index auf `(last_message_at desc)`, Rückfüllung
für bestehende Threads. **Gegenprobe nicht vergessen:** der Golden-Snapshot in
`grants_test.sql` muss **unverändert** bleiben — ändert er sich, ist versehentlich
ein Recht entstanden.

Vorher lohnt ein Blick in `design.md`: dort steht, warum die Spalten und nicht
eine RPC, und warum sie keine Lesebestätigung sind.

## Open questions

- **`wt switch --create` zweigt von der LOKALEN `main` ab.** Der Worktree dieser
  Sitzung war 11 Commits alt und lieferte stumm falsche Messwerte — ein
  Negativbefund daraus landete als falsche Behauptung in AGE-629 (korrigiert).
  Nach jedem `wt switch --create`: `git log HEAD..origin/main | wc -l` prüfen.
  Als Memory abgelegt.
- **`AGE-629` hat drei offene Produktfragen**, bevor daraus ein Change wird:
  ersetzt oder ergänzt die Spalte die heutige Suche auf `/mitglieder`? Wonach
  soll auf Events und Academy gefiltert werden (dort gibt es heute **kein**
  Suchfeld)? Was passiert unter `lg`?
- **`AGE-630` hängt an einer Entscheidung:** Serientermine materialisieren oder
  zur Laufzeit berechnen? Daraus folgt alles andere. Plus die drei Schemafallen
  im Issue (`events_cover_path_key` ist UNIQUE — eine Serie kann sich das Cover
  nicht teilen).
- **`AGE-628`** braucht weiter Donalds Produktentscheidung: anonymes Feedback
  UND Anchatten des Verfassers geht nicht beides.
- Unverändert offen: AGE-604-Restbefund · AGE-610 (Detlev/Anwalt) · AGE-512
  (Stripe-/Resend-Secrets ungetrennt) · Aktivierungsversand 69 von 72 ·
  Rotation des PROD-DB-Passworts · AGE-598 · AGE-256 · AGE-606 (Prettier).

## Lokal ansehen

`pnpm dev` geht aus einer Agenten-Sitzung nicht (Infisical braucht ein TTY):

```
VITE_SUPABASE_URL=http://127.0.0.1:54321 \
VITE_SUPABASE_ANON_KEY=<ANON_KEY aus `supabase status`> \
VITE_ENVIRONMENT=local \
npx vite --port 5201 --strictPort
```

**`--strictPort` ist wichtig** — ohne ihn weicht Vite still auf einen Port aus,
auf dem ein Zombie-Server aus einer früheren Sitzung eine leere Seite liefert.

Diese Sitzung brauchte einmal `/add-dir` auf den Worktree-Pfad, weil
`EnterWorktree` nur `.claude/worktrees/` kennt und `wt` nach `../repo.branch`
legt. Beim nächsten Start im 627er-Worktree entfällt das.
