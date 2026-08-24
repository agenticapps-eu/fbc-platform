---
reviewers: [gemini, codex]
models: [gemini-3-pro, gpt-5.2-codex]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 04d78257c6f91ea252bd254302125522d93ee216563df87758ffa64faa69dcf5
---

# Change review — activity-concept-level

Zwei Vendoren, beide fremd (das Delta stammt von Claude). Beide
REQUEST-CHANGES. Jeder Befund unten ist **nachgeprüft**, bevor er angenommen
wurde; einer hielt der Prüfung nicht stand und ist als widerlegt vermerkt.

## Reviewer: codex (gpt-5.2-codex)

VERDICT: REQUEST-CHANGES

[HIGH] design-system-Delta — Die bestehende Spec verbietet eine zweite
Akzentfamilie ausdrücklich, und der Kanon führt genau eine ein. Zudem verlangt
sie identische Inhaltsfarben in beiden Themes, während das Delta zwei Werte je
Token fordert — **BESTÄTIGT**, siehe Auflösung 1.

[HIGH] community-feed-Delta „Reiter"/„Sidebar" — `/aktivitaet` ist ohne Sitzung
erreichbar; das Delta schweigt zum anonymen Fall — **BESTÄTIGT**: `nav.ts:80`
trägt weder `requiresAuth` noch `minTier`, und `ActivationGate` gibt bei
`!user` durch. Siehe Auflösung 2.

[HIGH] tasks 3.2 / `post_likes` — `authenticated` hält UPDATE auf `post_likes`,
und `likes_write_own` ist `for all`. Ein Trigger nur auf INSERT/DELETE lässt
den Zähler verschieben — **BESTÄTIGT und schlimmer als beschrieben**, siehe
Auflösung 3.

[HIGH] design Entscheidung 6 — Die zwei Aggregat-RPCs brauchen kein
`security definer`; unter RLS aggregieren gibt dasselbe Ergebnis ohne zwei
weitere Prädikat-Kopien — **BESTÄTIGT**, siehe Auflösung 4.

[HIGH] design-system-Delta „Ein einziger Icon-Satz" / tasks 1.6 — Die Zusage
„kein `<svg>` außerhalb des Satzes" passt nicht zum Baum: SVGs liegen in **14**
Dateien außerhalb `src/vision`, darunter Markenlogo und ein Diagramm, die dem
24er-Glyphstil nicht entsprechen können — **BESTÄTIGT** (gemessen: 14, codex
sagte 13), siehe Auflösung 5.

[HIGH] Migration Plan / Rücknahme — Das vorgeschlagene `grant insert, update`
öffnet bei bestehender Zählerspalte genau die Lücke wieder — **BESTÄTIGT**,
siehe Auflösung 6.

[MEDIUM] tasks 2.2 — `post_saves`-Policies ohne `is_activated()`, während jede
andere Feed-Interaktion gegatet ist — **BESTÄTIGT** (`likes_write_own`,
`posts_write_own`, `post_media_insert_own` tragen es alle).

[MEDIUM] tasks 3.2 — Der Triggerfunktion fehlen `set search_path` und der
EXECUTE-Entzug — **BESTÄTIGT**.

[MEDIUM] tasks 3.2/5.3 — Kein Index für `(like_count, created_at, id)` —
**BESTÄTIGT**.

[MEDIUM] tasks 4.1 — `feed_tag_counts` ist nicht auf aktive Zeilen aus
`public.tags` festgelegt; über `unnest(hashtags)` erschienen freie Tags —
**BESTÄTIGT**.

[MEDIUM] tasks 5/6.8 — Der **Lesepfad** für den Zustand des Speicherknopfs
fehlt (`savedByMe`) — **BESTÄTIGT**.

[MEDIUM] Query Keys — Reiter, Ordnung, Tagmenge und Typ fehlen im
React-Query-Schlüssel; alte Seiten könnten unter neuer Auswahl weiterleben —
**BESTÄTIGT**.

[MEDIUM] Spec „Composer steht über der Feed-Spalte" — Die Behauptung, auf dem
Telefon bleibe die Reihenfolge erhalten, ist **falsch**: heute steht der
Filter im Markup VOR dem Feed und liegt auf schmalen Schirmen über ihm —
**BESTÄTIGT**, der Kommentar in `CommunityFeed.tsx:157` sagt es selbst.

[MEDIUM] tasks 5.8 — Anti-Join für „Text" und Inner-Join für „Bild" sind noch
keine nachgewiesene PostgREST-Abfrage — **BESTÄTIGT als offen**.

[MEDIUM] Open Questions — Autorenzahl und Definition von „aktiv" gehören in den
Funktionsvertrag, nicht ans Ende — **BESTÄTIGT**.

[MEDIUM] Impact — `src/lib/database.types.ts` fehlt vollständig; es gibt kein
Generierungsskript in `package.json` — **BESTÄTIGT**.

[LOW] proposal.md nennt AGE-582 nicht als Issue — **BESTÄTIGT**.

## Reviewer: gemini (gemini-3-pro)

VERDICT: REQUEST-CHANGES

[MEDIUM] tasks 1.6 — Die Zusage ist eine Absicht, kein Mechanismus; ohne
erzwingenden Test kehrt die Streuung zurück — **BESTÄTIGT**, deckt sich mit
codex' HIGH zum selben Task.

[LOW] Open Questions — gehören vor den Bau, nicht ans Ende — **BESTÄTIGT**,
deckt sich mit codex.

[LOW] design Entscheidung 7 — Die Umstellung UND → ODER sei nicht als
Produktentscheidung belegt — **WIDERLEGT**: sie steht als Donalds Entscheidung
vom 24.08. im Proposal und seit heute als Kommentar am Linear-Issue. Der
Reviewer hat den Issue-Kontext nicht gesehen; keine Änderung.

Annahmen (gemini): Performance der Aggregate ohne Index-Strategie (GIN auf
`hashtags`) — **übernommen**, siehe Auflösung 4. Akzeptanz der instabilen
Beliebtheitsordnung — bewusst so entschieden. Kein zweiter Schreibweg auf
`posts` — **übernommen als Prüfauftrag**, siehe Auflösung 6.

## Not counted

Keiner. Beide Reviewer liefen mit `REVIEWER_TIMEOUT=900` und endeten mit
Exit 0. `gemini` mischt Hook-Zeilen unter stdout (ab Zeile 18); die
Bewertung steht in den Zeilen davor und wurde daraus entnommen.

## Resolution

**1. Bereichsfarben gegen „Blue is the only accent family" — offen, Donalds
Entscheidung.** Der Befund ist echt: das Delta hätte eine Anforderung
gebrochen, die dieselbe Datei aufstellt, samt eines Szenarios, das darauf
prüft (`no gold, --accent2 or --color-fmt-* token exists`). Das lässt sich
nicht durch Umformulieren auflösen — entweder wird die bestehende Anforderung
ausdrücklich **modifiziert** (Bereichsfarben als *Identifikator*, abgegrenzt
vom *interaktiven* Akzent), oder der Kanon trägt **nur Icons**. Beides ist eine
Produktentscheidung, keine technische. Vorgelegt, nicht selbst entschieden.
Nebenbefund angenommen: Bereichsfarben gehören als Inhaltsschicht **einmal**
definiert, nicht je Theme — die navy-Fassung überschreibt absichtlich nur
Chrome. Die Formulierung „im dunklen Block zufällig richtig" war falsch und
fällt weg.

**2. Der anonyme Fall wird ausgeschrieben.** Ohne Sitzung: nur „Alle Beiträge",
kein Speichern-Knopf, keine Mitgliedernamen. `profiles_public` hält für `anon`
ohnehin kein Recht, ein Aufruf liefe in 401. Für die Tag-Zähler wird der
anonyme Pfad entweder als öffentlich-nur belegt oder für `anon` ausgenommen —
und „Beiträge von mir" ohne ID darf **nicht** zu „alle Beiträge" entarten.
Neue Anforderung plus Szenarien.

**3. `post_likes` verliert UPDATE.** Nachgeprüft und schlimmer als gemeldet:
das `with check` verlangt nur, dass der Zielbeitrag **existiert**, nicht dass
er sichtbar ist. Der Zähler ließe sich am Ursprungsbeitrag aufblasen **und** am
Zielbeitrag ins Negative treiben. Der Client schreibt `post_likes` nur per
`upsert` und `delete` — UPDATE ist unbenutzt und wird entzogen, mit
Golden-Snapshot-Nachtrag und dem Angriffsablauf als pgTAP-Test.

**4. Die Aggregate werden `security invoker`.** Der Befund ist richtig und
macht den Change kleiner: unter der RLS des Aufrufers zu aggregieren liefert
dasselbe Ergebnis, ohne zwei weitere Kopien des Prädikats — und die Absicht
„dieselbe Regel" ist dann keine Behauptung mehr, sondern Mechanik.
Entscheidung 6 wird umgeschrieben, die pgTAP-Zusagen auf die Kopien entfallen,
die Zusagen auf das *Ergebnis* bleiben. Dazu aufgenommen: `tags.active`-Bindung,
deterministischer Tie-Break und eine Index-Betrachtung (GIN auf `hashtags`)
mit gemessenem `EXPLAIN`.

**5. Der Icon-Satz wird auf wiederverwendbare UI-Glyphen begrenzt.**
Markenlogo, `CompassMark`, Avatar-Platzhalter und Diagramm-SVGs sind
ausdrücklich **ausgenommen** — das Markenlogo hat eine eigene, bestehende
Anforderung, gegen die die meine gelaufen wäre. Die Zusage in 1.6 prüft künftig
eine benannte Menge, nicht „kein `<svg>` irgendwo", und wird als Mechanismus
gebaut (gemini), nicht als Absicht formuliert.

**6. Die Rücknahme wird forward-only.** Kein `grant insert, update` zurück,
solange Zähler und Sortierung stehen; `post_saves` wird nicht gelöscht (das
wären Nutzerdaten). Dazu der Prüfauftrag aus gemini: **alle** Schreibwege auf
`posts` suchen, nicht nur `src/` — Edge Functions eingeschlossen (dort steht
heute keiner, geprüft).

**Übernommen ohne weitere Aussprache:** `is_activated()` in den
`post_saves`-Policies · `set search_path` und EXECUTE-Entzug an der
Triggerfunktion · Index für die neue Ordnung · `savedByMe` als Lesepfad ·
vollständiger React-Query-Schlüssel · die Korrektur des Mobil-Szenarios ·
Integrationstests statt Query-Builder-Mocks für die Typfilter ·
`database.types.ts` als eigene Aufgabe · AGE-582 im Proposal.

**Die drei offenen Fragen werden vor dem Bau entschieden**, nicht währenddessen
(beide Reviewer, unabhängig). Sie liegen Donald zusammen mit Punkt 1 vor.
