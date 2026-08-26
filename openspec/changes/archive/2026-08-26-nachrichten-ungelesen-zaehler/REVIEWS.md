---
reviewers: [gemini, opencode]
models: [gemini (CLI meldet die Modellversion nicht), "hf:moonshotai/Kimi-K3"]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 78596de496080d96c412922fcd254e1447d4a92a17d2ef92a7849ab5509f7f2e
---

# Change review — nachrichten-ungelesen-zaehler

Geprüft wurde die **erste** Fassung von `proposal.md`, `tasks.md` und dem
Spec-Delta (SHA oben). Proposal, Tasks und Delta sind danach überarbeitet; was
sich geändert hat, steht unter „Resolution".

## Reviewer: gemini

VERDICT: REQUEST-CHANGES

- [HIGH] Impact / `database.types.ts` — Handpflege erzeugt dauerhafte Drift
  zwischen Schema und Client-Typen. — Ursache beheben statt umgehen:
  Generator-Ausgabe formatieren und die Fixtures an den echten Rückgabevertrag
  anpassen.
- [MEDIUM] Migration / 2.8 — `messages_thread_id_idx` liegt nur auf
  `(thread_id)`; die Zählabfrage filtert zusätzlich auf `created_at` und müsste
  je Thread alle Nachrichten durchgehen. — Zusammengesetzten Index
  `(thread_id, created_at DESC)` anlegen.
- [MEDIUM] UI / 7.3 — Verhalten bei einer Nachricht im **offenen** Gespräch ist
  nicht festgelegt; der Zähler kann von 0 auf 1 und zurück zucken. — Beim
  Eintreffen prüfen, ob der Thread offen ist, und dann sofort den Lesestand
  vorrücken.
- [LOW] Realtime / 4 — Ein Aufruf je eingehender Nachricht ist redundant. —
  Entprellen.

Unausgesprochene Annahmen: `is_activated()` sei das einzige relevante Gate
(kein gesperrtes Konto); Realtime-Ereignis und Sichtbarkeit für die Funktion
seien immer synchron; der thread-genaue Lesestand sei fachlich akzeptiert.

## Reviewer: opencode (hf:moonshotai/Kimi-K3)

VERDICT: REQUEST-CHANGES

- [HIGH] proposal „Keine Lesebestätigungen" + Spec-Delta — **Der Change liefert
  genau die Lesebestätigung, die er zu verhindern behauptet.** `message_threads`
  trägt `SELECT` für Teilnehmer; zwei Zeitstempel-Spalten dort sind für den
  Gegenüber per gewöhnlicher Abfrage lesbar. Spalten-Grants helfen nicht: „welche
  Spalte ist meine" ist zeilenabhängig, ein Spalten-Grant ist es nicht. — Entweder
  die Zusage streichen oder sie erzwingen; der Text darf beides nicht behaupten.
- [MEDIUM] tasks 7.5 vs. Delta — Ungelesen-Markierung je Zeile in `ThreadList`
  hat keine Anforderung. — Anforderung ergänzen oder Aufgabe streichen.
- [MEDIUM] Spec / `unread_message_counts()` — unklar, ob Threads ohne
  Ungelesenes als Zeile mit 0 oder gar nicht kommen. Die pgTAP-Tests würden
  irgendein Verhalten festnageln, das die Spec nicht nennt. — Festlegen.
- [LOW] Rückgabetyp — `count(*)` ist `bigint`, nicht `integer`.
- [LOW] tasks 2.3 — Kein Test dafür, dass die Funktion bei vergiftetem
  `search_path` trägt.
- [LOW] proposal — Gleichstand der Zeitstempel: eine in derselben Mikrosekunde
  festgeschriebene Nachricht gilt bei `>` als gelesen.

Unausgesprochene Annahmen: die RLS-Filterung im Realtime-Kanal sei eine Tatsache
dieses Repositorys (ist eine Plattformzusage); `messages.sender_id` und
`auth.uid()` seien derselbe Schlüsselraum; der Dauerkanal je Sitzung sei
kostenlos; der Index reiche; die Zahl der Threads je Mitglied sei beschränkt;
genau zwei Teilnehmer für immer; die **neuen** Tests stünden in der
`supabase test db`-Dateiliste.

## Nicht gezählt

- **codex — hat nicht selbst geprüft.** Der Arm hat die Datei
  `~/.claude/skills/openspec-change-review/SKILL.md` gelesen und daraufhin
  **selbst Unter-Reviewer gestartet**: `reviewer-cli.sh gemini` (zurück kam
  `MODEL: gemini-pro`) und anschließend `reviewer-cli.sh claude`. Exit-Code 0,
  aber der Inhalt ist eine **gemini**-Bewertung — dieselbe Stimme wie Reviewer 1
  unter anderem Namen. Nach Regel 4 ist das eine Meinung, nicht zwei.
  Bemerkenswert ist der zweite Aufruf: `claude` ist der eigene Anbieter dieses
  Hosts, und Regel 2 schließt ihn aus. Die Ausschlussregel hat hier nur
  gehalten, weil sie beim Zählen von Hand angewandt wurde.

  Die Befunde jenes Laufs decken sich inhaltlich mit gemini (Index, Handpflege
  der Typen) und sind deshalb nicht doppelt aufgeführt. Zwei eigene Punkte
  daraus sind trotzdem übernommen: eine Leistungsprüfung mit vielen Threads und
  die Frage, was bei einer Nachricht im sichtbaren Gespräch geschehen soll.

## Resolution

**HIGH (opencode) — Lesebestätigung: übernommen, und zwar als Neuentwurf.**
Donald hat am 26.08. die dritte Variante gewählt: der Lesestand kommt in eine
**eigene Tabelle** `public.thread_read_positions(thread_id, profile_id,
last_read_at)` mit gewöhnlicher eigentümerprivater RLS. Das schlägt beide vom
Reviewer angebotenen Wege, weil es den Change **kleiner** macht statt größer:
`message_threads` wird gar nicht angefasst, und die `SECURITY DEFINER`-Funktion
`mark_thread_read` entfällt ersatzlos — auf einer eigenen Tabelle kann eine
Zeilen-Policy ausdrücken, was auf `message_threads` keine ausdrücken konnte.
Preis: eine Zeile mehr in der Grant-Matrix (Aufgabe 2.9).

**HIGH (gemini) — `database.types.ts` von Hand: nicht geändert, mit Begründung.**
Das ist keine Nachlässigkeit dieses Changes, sondern eine gemessene Entscheidung
des Repositorys: ein Lauf von `supabase gen types` erzeugt ~817 Diffzeilen,
davon eine sachliche, und macht RPC-Rückgabespalten non-null, was rund 20
Fixtures bricht. Der Reviewer kennt diese Messung nicht — er sieht die Regel und
schließt zu Recht auf Driftgefahr. Der Vorschlag „Fixtures an den echten
Vertrag anpassen" ist richtig und ist ein eigener Vorgang, kein Nebenprodukt
eines Zählers. **Der Befund bleibt gültig und unerledigt.**

**MEDIUM (gemini + codex-Lauf, unabhängig) — Index: gemessen und WIDERLEGT, aber
der Befund darunter war echt.** Die Aufgabe verlangte den `EXPLAIN`-Beleg, statt
den Index für ausreichend zu erklären — und der Beleg fiel gegen die Reviewer
aus. `messages (thread_id, created_at)` wird **nie** gewählt: 1,1 ms mit ihm,
1,4 ms ohne. Verglichen wird gegen `p.last_read_at` aus der verbundenen Tabelle,
daneben steht ein `or … is null`; eine Disjunktion über eine Join-Spalte ist
keine Index-Bedingung. Beide Reviewer haben über die Form
`created_at > konstante` geurteilt, die diese Abfrage nicht hat. Der Index steht
deshalb **nicht** in der Migration.

**Ihr Bauchgefühl war trotzdem richtig — die Abfrage war teuer, nur an anderer
Stelle.** Der `EXPLAIN` zeigte die RLS-Prüfung von `messages_select` als
korreliertes `EXISTS` mit **20 000 Durchläufen**. Die Umstellung auf eine
laterale Zählung je Thread bringt 213 ms → 1,2 ms und 120 252 → 350 Puffer, bei
gleichem Ergebnis. **Der wertvollste Beitrag der Review war hier nicht die
vorgeschlagene Lösung, sondern dass sie überhaupt auf die Abfrage zeigte.**

**MEDIUM (gemini) — Zucken im offenen Gespräch: übernommen.** Als Anforderung im
Delta („A message in the open conversation does not flicker the total") und als
Aufgabe 7.3.

**MEDIUM (opencode) — 7.5 ohne Anforderung: übernommen.** Die Markierung je
Zeile steht jetzt als Anforderung samt Null-Verhalten im Delta; Aufgaben 6.4/6.5.

**MEDIUM (opencode) — Vertrag bei 0: übernommen.** Threads ohne Ungelesenes
liefert die Funktion **gar nicht**. Als Anforderung und als Test 3.8.

**LOW (opencode) — `bigint`: übernommen.**

**LOW (opencode) — vergifteter `search_path`: übernommen** als Test 3.9 und als
Szenario im Delta.

**LOW (opencode) — Gleichstand der Zeitstempel: übernommen.** Der Lesestand wird
mit `clock_timestamp()` geschrieben statt `now()`; als Anforderung im Delta
festgehalten.

**LOW (gemini) — Entprellen: übernommen** als Aufgabe 4.5.

**Annahme (opencode) — RLS im Realtime-Kanal: übernommen.** Aufgabe 8.6 prüft den
**Fehlschlag**, nicht den Glücksfall: ein unbeteiligtes Konto darf kein Ereignis
bekommen. Der Reviewer hat richtig gesehen, dass 8.1 und 8.5 das nicht abdecken.

**Annahme (opencode) — Schlüsselraum `sender_id` / `auth.uid()`: geprüft**, sie
sind identisch (die Policies vergleichen direkt). Als Aufgabe 1.6 festgehalten,
damit die Prüfung im Artefakt steht und nicht nur im Kopf.

**Annahme (opencode/gemini) — Dauerkanal, Threadzahl, zwei Teilnehmer:
aufgenommen** unter „Was bleibt offen, wissentlich". Nicht gelöst, benannt.

**MEDIUM (codex-Lauf) — Leistungstest mit 500+ Threads: nicht als Test
übernommen.** Auf PROD sind 2 von 71 Profilen aktiviert; ein pgTAP-Lauf, der
500 Threads erzeugt, prüft eine Größenordnung, die dieses System vor dem
nächsten Change nicht erreicht, und kostet in jedem CI-Lauf Zeit. Übernommen ist
stattdessen der Index samt `EXPLAIN`-Beleg und die Beschränkung auf Threads mit
Ungelesenem. **Wenn die Mitgliederzahl steigt, ist das erneut zu messen.**

---

# Diff-Review (Schritt 4) — 2026-08-26

Geprüft wurde der vollständige Diff (22 Dateien, +2316/−8), inklusive der neuen
Dateien — `git diff` allein zeigt sie nicht.

reviewers: [gemini, opencode] · models: [gemini (Modellversion nicht gemeldet),
"hf:moonshotai/Kimi-K3"] · verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]

## Beide fanden unabhängig denselben HIGH

**Der Kommentar behauptete das Gegenteil des Codes.** `markThreadRead` schickte
`last_read_at: new Date().toISOString()` — die **Client-Uhr** — während der
Docblock direkt darüber schrieb, genau das geschehe nicht.

Warum das mehr als Kosmetik ist: verglichen wird gegen `messages.created_at`,
die Serveruhr. Zwei Uhren im selben Vergleich heißen bei einer vorgehenden
Client-Uhr, dass Nachrichten als gelesen gelten, **bevor es sie gibt** — sie
tauchen im Zähler nie auf, und niemand merkt es.

opencode nannte zusätzlich die Falle im naheliegenden Fix, und sie war echt:
PostgREST baut aus einem Upsert ein `on conflict do update set <nur die
gesendeten Spalten>`. Die Spalte einfach wegzulassen hätte das Markieren **ab
dem zweiten Mal lautlos wirkungslos** gemacht.

**Behoben** mit einem `before insert or update`-Trigger, der `clock_timestamp()`
erzwingt. Der Client schickt einen Platzhalter (`1970-01-01`, absichtlich
absurd, damit ein entfernter Trigger auffällt statt plausibel auszusehen), der
Server überschreibt ihn. Belegt dreifach:

- pgTAP Test 16, **mit Gegenprobe**: ohne Trigger überlebt die 1970 und der Test
  wird rot, unter Nennung beider Werte.
- Über den echten Client-Pfad im Browser (PostgREST + Trigger + RLS): der
  gespeicherte Wert trägt Mikrosekunden-Serverzeit, der **zweite** Aufruf rückt
  ihn an, und es bleibt bei einer Zeile.

**Nebenwirkung, die der Golden-Snapshot fing:** die neue Trigger-Funktion war für
`anon` ausführbar. `alter default privileges … revoke` wirkt bei **Funktionen**
nicht (bei Tabellen schon) — `grants_test.sql` Test 7 meldete sieben statt sechs.
Namentlich entzogen.

## Weitere übernommene Befunde

- **[MEDIUM, opencode] `last_read_at` war frei setzbar.** Ein Mitglied hätte
  seinen Lesestand auf `2999` setzen und den Zähler dauerhaft stumm schalten
  können — die Zeile gehört ihm. **Derselbe Trigger erledigt das mit**, ohne eine
  zweite Regel.
- **[MEDIUM, opencode] Wettlauf beim Zucken.** Dieselbe Nachricht löst das
  Kopfzeilen-Abo (entprellt, 400 ms) UND das Vorrücken in `ChatPage` aus.
  Braucht der Schreibvorgang länger als die Entprellung, landet die Neuabfrage
  zuerst — die Blase springt auf 1 und weg. Die Anforderung schließt genau das
  aus, und nichts erzwang die Reihenfolge. **Behoben ohne geteilten Zustand:**
  welches Gespräch offen ist, steht in der Adresse. `useUngelesenLive` bekommt
  den Pfad und überspringt die Neuabfrage für Nachrichten des offenen Threads.
- **[MEDIUM, opencode] pgTAP-Test 9 war ein Vakuumtest.** Er prüfte
  `try_as(...) = 'OK'`, also die Abwesenheit einer Ausnahme — und ein
  RLS-geblocktes UPDATE wirft keine. Der Test wäre auch ganz ohne Policy grün
  gewesen. Ersetzt durch eine Messung der **getroffenen Zeilen** (`get
diagnostics`) samt Positivkontrolle auf der eigenen Zeile.
- **[LOW, opencode] Tote Zeile in `ThreadList.test.tsx`.**
  `queryByText(/ungelesen/i)` kann nie fehlschlagen: das Wort steht nur im
  `aria-label`. Ersetzt durch die Abwesenheit der Blase und der Ziffer.

## Nicht übernommen, mit Begründung

- **[LOW, opencode] Kachelraster unter `sm`.** Mit drei Kacheln in zwei Spalten
  rutscht „Nachrichten" allein in die zweite Reihe. Das ist richtig beobachtet
  und bleibt so: die Alternative wäre `grid-cols-3` auch auf dem Telefon, und
  drei Kacheln nebeneinander bei 320 px sind unlesbar. Bei 375 px angesehen.
- **[LOW, opencode] Kein Unit-Test auf den Upsert-Rumpf.** Richtig, dass der
  Fehler deshalb überlebte. Die Zusage sitzt jetzt aber serverseitig, und ein
  Test auf den Rumpf würde das Gegenteil zementieren — der Rumpf MUSS die Spalte
  tragen. Geprüft wird stattdessen, was zählt: was am Ende in der Zeile steht
  (pgTAP 16 plus die Browser-Gegenprobe).
