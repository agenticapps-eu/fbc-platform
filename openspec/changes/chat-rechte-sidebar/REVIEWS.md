---
reviewers: [codex, opencode]
models: [gpt-5.2-codex, unbekannt — siehe Notiz]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: dbf00c7f5d0142f6
---

# Change review — chat-rechte-sidebar (AGE-627)

Zwei Anbieter, beide **REQUEST-CHANGES**, und sie treffen unabhängig voneinander
dieselben vier Stellen. Diese Konvergenz ist der eigentliche Befund: es sind
keine Geschmacksfragen, sondern Lücken im Entwurf.

> **Notiz zum Modell (Regel 4).** Für `codex` steht `gpt-5.2-codex` im Lauf. Für
> `opencode` gibt die Ausgabe kein aufgelöstes Modell her. Das ist eine bekannte
> Schwäche dieser Kombination — codex delegiert Reviews an Unter-Reviewer und
> liefert fremde `MODEL:`-Zeilen zurück. Beide Läufe sind inhaltlich klar
> verschieden (opencode fand fünf Dinge, die codex nicht hat, und umgekehrt),
> also sind es zwei Meinungen; die Herkunft der zweiten ist aber nicht
> beweisbar dokumentiert.

## Reviewer: codex (gpt-5.2-codex)

VERDICT: **REQUEST-CHANGES** — 6 HIGH, 7 MEDIUM, 2 LOW

[HIGH] proposal Impact / tasks §1 — Serverseitiges Paging ist mit dem heutigen
Schema nicht umsetzbar. `message_threads` trägt nur `created_at`; die letzte
Aktivität wird clientseitig aus allen `messages` berechnet. „Keine Migration,
kein Server" widerspricht damit der eigenen Kernanforderung.

[HIGH] tasks §1 — Der angebliche RED-Test wäre heute **grün**. Ein Test, der
belegt „die Abfrage hat kein Limit", besteht vor der Änderung. Das ist kein RED.

[HIGH] design-system-Delta / tasks §3 — Der rechte Drawer hat **keinen
Auslöser**. Der Rail ist `hidden lg:flex`; unter `lg` gibt es kein Bedienelement,
das ihn öffnet.

[HIGH] messaging-Delta / tasks — `offset` steht nur auf API-Ebene. Es gibt kein
„Mehr laden" in irgendeiner Fläche; der Rest bleibt dauerhaft unsichtbar und
verletzt das eigene Szenario.

[HIGH] messaging-Delta — „dieselben Threads wie `/chat`" + „bounded page" +
„`/chat` unverändert" sind drei nicht gleichzeitig erfüllbare Zusagen.

[HIGH] tasks §4 / `AppShell.tsx:386` — „an `subscribeToAllMessages` hängen" ist
keine Strategie. Das einzige globale Abo gehört `useUngelesenLive` und
invalidiert nur den Ungelesen-Query; ein zweiter Aufruf macht einen zweiten
Kanal auf.

[MEDIUM] `threadsQueryKey` kennt keinen Paging-Parameter — Panel und `/chat`
teilen einen Cache-Eintrag. · [MEDIUM] Offset-Paging ist auf einer live
sortierten Liste instabil (Cursor statt Offset). · [MEDIUM] „keine
Mitgliedsstufe" gilt nicht für die gelesenen Partnerzeilen —
`profiles_select_self_or_discover` gibt fremde Profile erst ab `discover` frei.
· [MEDIUM] Der Rail lädt eine Thread-Seite, obwohl er nur den Zähler braucht;
und `AppShell` bleibt beim Routenwechsel montiert, die Kosten fallen also nicht
„auf jeder Seite" an. · [MEDIUM] Lade- und Fehlerzustände fehlen — `data ?? []`
zeigt einen RLS-Fehler als „keine Kontakte". · [MEDIUM] 1280 px ist nicht der
engste Fall; 1024 px ist es. · [MEDIUM] „keine akzeptierten Kontakte" ≠ „keine
Threads" — Threads überleben den Statuswechsel.

[LOW] Escape/Fokus/Backdrop nur in der Sichtprüfung, nicht als Testaufgabe. ·
[LOW] Kein `design.md` für die Datenzugriffs- und Cache-Entscheidung.

## Reviewer: opencode (Modell nicht aufgelöst)

VERDICT: **REQUEST-CHANGES** — 4 HIGH, 5 MEDIUM, 3 LOW

[HIGH] — **Der Kern, präziser als codex:** PostgREST kann **nicht nach einer
Aggregatfunktion über eine to-many-Relation sortieren**. `max(messages.created_at)`
je Thread als Top-Level-Sortierschlüssel ist nicht ausdrückbar; nach Kindspalten
sortieren geht nur für to-one. Bleibt: alles laden und im Client sortieren
(genau das, was der Change abschaffen will) oder ein Server-Artefakt.

[HIGH] — Spec-interner Widerspruch „same threads" vs. „bounded page" (deckungs-
gleich mit codex).

[HIGH] — Drawer ohne Öffner (deckungsgleich). **Zusatz:** die einzige Alternative
wäre, die Sprechblase unter `lg` vom Link zum Umschalter zu machen — und das
kollidiert mit einem ausdrücklich begründeten Grundsatz im Quelltext,
`AppShell.tsx:68`: „Ein Link, kein Knopf — er führt an einen Ort."

[HIGH] — Szenario „The remaining threads stay reachable" hat keinen
implementierenden Task (deckungsgleich).

[MEDIUM] `threadsQueryKey`-Kollision, mit dem Zusatz, dass `ChatPage.tsx:88,123`
unter diesem Schlüssel invalidiert. · [MEDIUM] Die **Liste** wird nicht live:
`useUngelesenLive` invalidiert nur den Zähler, Vorschautext und Reihenfolge
veralten sichtbar, während der Marker erscheint. · [MEDIUM] **Das Panel auf
`/chat` selbst ist unbestimmt** — dort stünde die Liste zweimal auf einem
Bildschirm, und das `18rem + 1fr`-Raster der ChatPage ließe ~330 px für die
Konversation. · [MEDIUM] **Gäste-Zustand fehlt.** Die Hülle rendert auch
ausgeloggt (`AppShell.tsx:578–587`); ohne eine Zeile im Delta bekäme ein Gast
einen Rail mit Sprechblase — „ein Versprechen ins Leere". · [MEDIUM] Thread-Wahl
im Drawer schließt ihn nicht; links tut `onNavigate` das (`AppShell.tsx:631`).

[LOW] Rail und Topbar zeigen dieselbe Sprechblase mit derselben Zahl, mit zwei
verschiedenen Zielen. · [LOW] `.fbc-shell-offset` transitioniert nur
`padding-left` (`index.css:264–269`) — das `padding-right` braucht die Transition
mit, sonst ruckt es. · [LOW] Messliste unvollständig: `/chat` selbst und die
`NARROW_ROUTES` mit ihrem 760-px-Deckel fehlen.

## Selbst nachgeprüft (nicht übernommen)

Reviewer-Befunde sind Behauptungen, bis sie gemessen sind. Vier davon habe ich
gegen den Quelltext gehalten:

| Behauptung | Messung | Ergebnis |
| --- | --- | --- |
| `message_threads` hat keine Aktivitätsspalte | `20260612065636_matching.sql:64–70`; kein `alter table` in irgendeiner späteren Migration | **bestätigt** |
| Das globale Abo gehört `useUngelesenLive` und invalidiert nur den Zähler | `use-ungelesen.ts:79–92`, `AppShell.tsx:386` | **bestätigt** |
| „Ein Link, kein Knopf" steht wirklich im Quelltext | `AppShell.tsx:68` | **bestätigt** |
| Die Hülle rendert für Ausgeloggte | `AppShell.tsx:578–587`, „Anmelden"-Zweig | **bestätigt** |

## Resolution

**Der Entwurf war an seiner tragenden Stelle falsch, und zwar so, dass Umbauen
billiger ist als Nachbessern.** Genau dafür läuft dieser Schritt vor dem Code.
Der Change ist überarbeitet; `design.md` ist neu und beantwortet die Datenfrage,
die vorher offen unter dem Teppich lag.

**Zwei Entscheidungen hat Donald getroffen** (27.08.), weil sie den Zuschnitt
ändern und nicht aus dem Quelltext folgen:

1. **Migration statt Ausrede.** `message_threads` bekommt `last_message_at`,
   `last_message_body` und `last_message_sender_id`, gepflegt von einem
   `security definer`-Trigger. AGE-627 ist damit kein reiner Frontend-Change
   mehr, und „keine Migration" ist aus dem Impact verschwunden.
2. **Eigener Öffner in der Topbar**, gespiegelt zum Hamburger. Der Grundsatz
   „Ein Link, kein Knopf" (`AppShell.tsx:68`) bleibt damit unangetastet — die
   Sprechblase führt weiter an einen Ort.

### Befund für Befund

| Befund | Auflösung |
| --- | --- |
| **[HIGH]** Paging ohne Serverartefakt unmöglich (beide) | Migration, `design.md`. „Keine Migration" gestrichen. |
| **[HIGH]** PostgREST kann nicht nach to-many-Aggregat sortieren (opencode) | Ursache benannt und in `design.md` als Grund der Denormalisierung dokumentiert. |
| **[HIGH]** RED-Test wäre grün gewesen (codex) | Gestrichen. Ersetzt durch einen Vertragstest gegen die **neue** Abfrageform, der vorher zwangsläufig fehlschlägt. |
| **[HIGH]** Drawer ohne Öffner (beide) | Eigener `lg:hidden`-Knopf; als Anforderung **und** Szenario im design-system-Delta. |
| **[HIGH]** „same threads" + „bounded" + „/chat unverändert" (beide) | Aufgelöst: **eine** Datenquelle, **ein** Umfang. `/chat` lädt jetzt ebenfalls eine Seite; die Behauptung „unverändert" ist zurückgezogen. |
| **[HIGH]** „remaining threads" ohne Task (beide) | „Mehr laden" auf beiden Flächen, als Task und als Szenario. |
| **[HIGH]** Realtime-Abo gehört `useUngelesenLive` (codex) | Kein zweites Abo. Der bestehende Hook invalidiert künftig auch die Threads-Seite; „genau eine Subscription" ist ein eigener Test. |
| **[MED]** `threadsQueryKey` ohne Paging-Parameter (beide) | Seitenparameter in den Schlüssel, alle Invalidierungen nachgezogen (`ChatPage.tsx:88,123`). |
| **[MED]** Offset-Paging instabil (codex) | **Bewusst Offset**, mit Begründung und Umschlagpunkt in `design.md`. Der Trigger legt schon den Schlüssel an, den ein Cursor bräuchte. |
| **[MED]** Partnernamen erst ab `discover` (codex) | **Nicht behoben, aber benannt.** Der Rückfalltext ist heutiger Zustand; ihn zu reparieren ist ein eigener Vorgang. Die Glattrede „keine Mitgliedsstufe" ist raus. |
| **[MED]** Rail lädt Threads, obwohl er nur den Zähler braucht (codex) | Anforderung: eingeklappt **kein** Listenabruf. Plus Korrektur der Begründung — `AppShell` bleibt beim Routenwechsel montiert, die Kosten fallen nicht „auf jeder Seite" an. |
| **[MED]** Lade-/Fehlerzustände fehlen (codex) | Drei Zustände als Anforderung und Szenario. |
| **[MED]** 1024 px ist der engste Fall (codex) | Messliste auf 1024–1280 px erweitert, `NARROW_ROUTES` und `/chat` ergänzt. |
| **[MED]** „keine Kontakte" ≠ „keine Threads" (codex) | Szenario auf **Threads** umgestellt. |
| **[MED]** Panel auf `/chat` unbestimmt (opencode) | Panel blendet auf Chatrouten aus — Anforderung, Szenario, Task. |
| **[MED]** Gäste-Zustand fehlt (opencode) | „only for signed-in members" als Anforderung, mit Szenario in beiden Deltas. |
| **[MED]** Drawer bleibt beim Navigieren offen (opencode) | Anforderung, Szenario und Task. |
| **[LOW]** Sprechblase doppelt unter `lg` (opencode) | **Bewusst in Kauf genommen**, als Punkt für die Sichtprobe notiert. Zwei Bedienelemente mit zwei Zielen; wenn es live zu eng wirkt, fällt eins. |
| **[LOW]** Transition nur auf `padding-left` (opencode) | Als Task ausformuliert („in derselben Regel, **mit Transition**"). |
| **[LOW]** Escape/Fokus nur in der Sichtprobe (codex) | Als automatisierte Tests in Band 5. |
| **[LOW]** Kein `design.md` (codex) | Geschrieben. |
| **[LOW]** Messliste unvollständig (opencode) | Ergänzt. |

### Angenommen, aber nicht gesagt — jetzt gesagt

opencode hat vier stille Annahmen benannt. Drei stehen nun im Text: die
PostgREST-Grenze, die Rail-Breite (identisch zur linken), und dass die
Sprechblase funktional unverändert bleibt. Die vierte — **dass die
Thread-Anzahl überhaupt pagingswürdig wird** — bleibt unbelegt und ist es auch:
bei der heutigen Clubgröße hat niemand mehr als eine Seite. Die Anforderung
steht trotzdem, weil sie generell gilt (Donald: „Listen immer mit Paging") und
weil der teure Teil ohnehin die *Nachrichten*menge war, die der Trigger jetzt
komplett aus der Abfrage nimmt.

---

## Diff-Review nach der Umsetzung (27.08.) — NICHT ZUSTANDE GEKOMMEN

Der Ablauf verlangt an dieser Stelle eine Diff-Review durch einen fremden
Anbieter. **Alle drei am 27.08. verfügbaren Arme haben versagt**, und zwar auf
drei verschiedene Weisen. Das steht hier, weil ein fehlender Beleg leicht wie
ein erbrachter aussieht, sobald niemand mehr danach fragt.

| Arm | Ergebnis |
| --- | --- |
| `opencode run` | Antwortet mit **gar nichts**. Der Lauf über den ganzen Diff las die Datei in vier Stücken und endete dann still (Exit 0, sechs Zeilen Ausgabe, keine Befunde). Ein zweiter, auf zwei Dateien verengter Lauf gab nur noch die Kopfzeile `> build · hf:moonshotai/Kimi-K3` aus. |
| `codex exec` | Lud die **gstack-Skill-Sammlung** in seine Antwort statt zu prüfen: 4354 Zeilen Ausgabe, darin die Anweisungstexte von `/plan-tune`, `gstack-team-init` und der Review-Gates — und kein einziger Befund zum Diff. |
| `cursor-agent -p` | `Authentication required. Please run 'agent login' first`. Bekannt, siehe Memory. |

**Was stattdessen als Beleg dasteht.** Kein Ersatz für eine fremde Sicht, aber
auch nicht nichts:

* **Zehn Gegenproben**, je eine Mutation an genau einer Stelle, und jedes Mal
  fiel genau der gemeinte Test — nicht mehr und nicht weniger:
  BEFORE-INSERT-Trigger entfernt · Vorwärts-Bedingung entfernt · Routenprüfung
  entfernt · Anmeldeprüfung entfernt · `istBreit` aus der Montage entfernt ·
  Ausschluss am Chat-Öffner entfernt · Ausschluss am Hamburger entfernt ·
  `xl`-Sprung schliesst nicht · Fehlerzustand entfernt · Umbruchpunkt zurück
  auf `lg`.
* **Die Sichtprobe am laufenden Bild** hat zwei Planentscheidungen umgeworfen
  (Umbruchpunkt und Flächentrennung) — beides Dinge, die eine Diff-Review am
  Text kaum gefunden hätte.
* **Ein echter Fehler ist beim Umbau durch einen Test aufgefallen**, nicht durch
  Nachdenken: der Startwert von `istBreit` las noch `lg`, während der Effect
  schon `xl` prüfte.

**Offen bleibt**, was nur eine fremde Sicht liefert: eine unabhängige Prüfung
der Trigger-Korrektheit unter Nebenläufigkeit und der Frage, ob die drei neuen
Spalten irgendwo weiter reichen als die Nachrichten, die sie zusammenfassen.
Beides ist hier argumentiert und in pgTAP gemessen, aber von derselben Hand.
