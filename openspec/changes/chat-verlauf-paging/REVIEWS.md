---
reviewers: [gemini, opencode]
models: [nicht ausgewiesen, hf:moonshotai/Kimi-K3]
verdicts: [APPROVE, REQUEST-CHANGES]
reviewed_artifacts_sha: 2f26af9832146f3286f4a71f72920cc28b08e8364b6e6774ed095b146fbc8258
---

# Change review — chat-verlauf-paging

Zwei Anbieter, beide **nicht** der Anbieter, der den Change geschrieben hat.
`REVIEWER_TIMEOUT=900`, beide über `~/.agenticapps/bin/reviewer-cli.sh`, beide
Exit 0 — und, weil ein Exit-Code bei diesen Werkzeugen nichts trägt, beide auch
am **Inhalt** geprüft: beide haben eine echte Befundliste zum Diff geliefert,
keiner hat über Skills seiner eigenen Umgebung geredet.

Der Prompt trug neben den vier Artefakten Auszüge des bestehenden Codes, damit
die Reviewer die Behauptungen nachmessen können statt sie zu glauben. opencode
hat das getan — im Protokoll stehen Lesevorgänge auf `chat.ts`, `use-gespraech.ts`,
`Conversation.tsx`, `use-ungelesen.ts`, `ChatPage.tsx`, `main.tsx` und den
Migrationen.

## Reviewer: gemini (Modell nicht ausgewiesen)

VERDICT: APPROVE

- [MEDIUM] design.md, Entscheidung 3 — Die Neuabfrage von
  `max(VERLAUF_SEITE, geladen)` Zeilen skaliert mit der Sitzung: wer 10 Seiten
  nachlädt, holt bei jedem Fokuswechsel 500 Zeilen. — Vorschlag: nur die neueste
  Seite holen und im Client verschmelzen; die einfachere Lösung darf bleiben,
  aber die Kosten gehören bewusst akzeptiert.
- [LOW] design.md, Entscheidung 5 — Wird die letzte Nachricht **ersetzt** statt
  angehängt, feuert der Scroll-Effect trotzdem. — Vorschlag: benennen.

Unausgesprochene Annahmen, die gemini benannt hat: dass die Refetch-Kosten
akzeptabel sind; dass Mikrosekunden-Auflösung als Cursor reicht; **und dass die
drei anderen Cache-Schreiber nur anhängen oder ersetzen, nie voranstellen.**

## Reviewer: opencode (hf:moonshotai/Kimi-K3)

VERDICT: REQUEST-CHANGES

- [HIGH 1] design.md, Entscheidung 3 / tasks 2 — **Die Neuabfrage verliert
  nachgeladene Seiten im Wettlauf.** react-query **ersetzt** die Daten beim
  Auflösen der `queryFn`. Eine Abfrage, die vor dem Nachladen mit 50 losläuft und
  danach antwortet, überschreibt die inzwischen 100 Zeilen mit 50. — Fix:
  mischen statt ersetzen, plus ein RED-Test für genau diesen Wettlauf.
- [HIGH 2] design.md, Entscheidungen 2+3 / tasks 2.2 — **`erschoepft` driftet.**
  Ein vollständig geladener Thread mit 120 Zeilen: die Neuabfrage fragt
  `max(50,120)=120` an, bekommt 120, und `120 < 120` ist falsch — der Knopf
  taucht wieder auf. — Fix: Sperrklinke je `threadId`, oder `limit + 1`.
- [MEDIUM] design.md, Entscheidung 4 — **Doppelklick erzeugt echte Duplikate.**
  Zwei Aufrufe lesen dasselbe `before` und setzen dieselbe Seite zweimal davor.
  Gleiche `id`, gleiche React-Keys. — Fix: sperren **und** über `id` vereinigen.
- [MEDIUM] tasks 2.5 — **Der Test misst das Falsche.** „Die `queryFn` fragt 120
  an" prüft die Anfragegrösse; die Spec-Zusage hängt am Ergebnis. — Fix: Zusage
  auf den Cache-Inhalt nach der Neuabfrage.
- [LOW] design.md, Entscheidung 2 — `erschoepft = length < limit` ohne `+1`:
  bei genau `limit` verbleibenden Zeilen steht der Knopf einmal zu oft. — Fix:
  `limit + 1` anfragen.
- [LOW] tasks 3.4 / Entscheidung 5 — `messages.at(-1)?.id` feuert beim Abgleich
  der optimistischen Blase. — Fix: benennen. *(Deckungsgleich mit gemini LOW.)*
- [LOW] Spec-Delta — Der Szenario-Titel „Der Tagesmarker behauptet keinen
  vollständigen Tag" sagt etwas anderes als sein GIVEN/WHEN/THEN. — Fix: Titel
  angleichen.
- [LOW] design.md, Kontext — Der vorhandene Index deckt nur `thread_id`
  (`20260612065636_matching.sql:95`), nicht `(thread_id, created_at)`. Die
  Sortierlast bleibt. — Fix: im Entwurf benennen.

Unausgesprochene Annahmen, die opencode benannt hat: dass Seite und Fenster
denselben Thread nie gleichzeitig offen haben (**nicht nachgewiesen**); dass ein
minimiertes Fenster seinen Knopf nicht rendern muss; dass `mapMessageRow` und die
Spaltenliste unverändert bleiben dürfen; dass „`messages_select` bleibt
unberührt" belegt statt behauptet ist.

## Not counted

Keiner. Beide Arme haben geantwortet.

`codex` wurde nicht gerufen — zwei Anbieter reichen nach der Regel, und dieser
Arm hat in diesem Repo zuletzt zweimal die Review an Unter-Reviewer delegiert,
statt selbst zu prüfen. `claude` ist ausgeschlossen: es ist der Anbieter, der den
Change geschrieben hat.

## Resolution

**Beide HIGH-Befunde sind berechtigt und beide sind eingearbeitet.** Sie haben
denselben Kern: der Entwurf hatte den Seitenzustand und die Nachrichtenliste an
zwei verschiedenen Orten mit zwei verschiedenen Lebensdauern.

| Befund | Auflösung |
| --- | --- |
| HIGH 1 Wettlauf | Entscheidung 3 umgeschrieben: die `queryFn` liest den Cache und gibt die **Vereinigung über die `id`** zurück, statt zu ersetzen. Die Auflösungsreihenfolge ist damit gleichgültig. Neuer RED-Test 2.5, der mit einer ersetzenden `queryFn` fehlschlagen **muss**. |
| HIGH 2 `erschoepft` driftet | Neue Entscheidung 3b: der Seitenzustand liegt als eigener Cache-Eintrag `verlaufSeitenQueryKey(threadId)`, und `erschoepft` ist eine **Sperrklinke**, die eine Neuabfrage nicht zurückdreht. Neuer RED-Test 2.6, neues Spec-Szenario „Ein erschöpfter Verlauf bleibt erschöpft". |
| MEDIUM Doppelklick | Entscheidung 4 umgeschrieben: Vereinigung über `id` **und** eine `laeuft`-Sperre. Neuer RED-Test 2.7, neue Aufgabe 3.7 für den gesperrten Knopf. |
| MEDIUM Test misst das Falsche | Die alte Aufgabe 2.5 ist **ersetzt**, nicht ergänzt. Die neue misst den Cache-Inhalt. |
| LOW `limit + 1` | Entscheidung 2 umgeschrieben, Aufgabe 1.4 prüft beide Richtungen. |
| LOW Scroll beim Abgleich | Entscheidung 5 trägt jetzt eine ausdrückliche **Korrektur**: die erste Fassung behauptete das Gegenteil und war falsch. Die Umstellung **fügt** dort einen Sprung hinzu, wo heute keiner ist. |
| LOW Szenario-Titel | Angeglichen: „Der Tagesmarker wandert zur ältesten Zeile seines Tages". |
| LOW Index | Neue Entscheidung 7 — als **Grenze benannt**, nicht wegerklärt, mit Folgevorgang 6.1. |
| gemini MEDIUM Refetch-Kosten | **Nicht geändert**, ausdrücklich akzeptiert und im Entwurf beziffert. Die vorgeschlagene Alternative (nur die neueste Seite holen und verschmelzen) ist durch die Vereinigung aus HIGH 1 ohnehin sicher — sie bliebe eine reine Kostenoptimierung und kostete die Auffrischung eines langen offenen Verlaufs. |
| Annahme „nie gleichzeitig offen" | **Widerlegt statt angenommen.** Seite und Fenster können denselben Thread gleichzeitig führen; genau deshalb liegt der Seitenzustand jetzt im Cache. Neuer RED-Test 2.2 mit zwei montierten Instanzen. |
| Annahme „minimiertes Fenster" | Offen und bewusst offen: ein minimiertes Fenster rendert seinen Verlauf gar nicht, also auch keinen Knopf. Es lädt weiter (das ist der Merge-Pfad des globalen Abos, `use-gespraech.ts:50-61`), aber es zeigt nichts. |
| Annahme „`messages_select` unberührt" | Bleibt eine Behauptung, und zwar eine belegbare: dieser Change fügt der Abfrage nur `limit`, `order` und `lt` hinzu. Keine Policy und keine Hilfsfunktion wird angefasst — das ist am Diff prüfbar, und zwar in der Diff-Review, nicht hier. |

**Was gemini gefunden hat und opencode nicht**, und umgekehrt: gemini hat den
Scroll-Fall beim Ersetzen der letzten Zeile als erstes benannt; opencode hat die
beiden HIGH-Befunde und die Zwei-Instanzen-Annahme geliefert, die den Entwurf
tatsächlich umgeworfen haben. Ein Anbieter allein hätte hier nicht gereicht —
gemini hat mit APPROVE geurteilt, wo die zentrale Zusage nicht eingelöst war.
