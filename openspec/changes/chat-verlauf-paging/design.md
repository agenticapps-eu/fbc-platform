## Context

`fetchMessages` (`src/lib/chat.ts:320`) lädt jede Nachricht eines Threads. Es
hat **genau einen echten Aufrufer**: `use-gespraech.ts:73`, den sich beide
Chat-Flächen teilen — die Vollansicht `/chat/:threadId` und das angedockte
Fenster aus AGE-639.

Der Cache-Eintrag `messagesQueryKey(threadId)` ist ein flaches `ChatMessage[]`.
**Vier Stellen schreiben hinein:**

| Stelle | Was |
| --- | --- |
| `use-gespraech.ts:71` | die `queryFn` selbst |
| `use-gespraech.ts:137,146,151` | optimistische Blase, Abgleich mit der echten Zeile, Rücknahme |
| `use-ungelesen.ts:129` | das **globale** Realtime-Abo der Hülle |
| `ChatPage.tsx:72` | das **eigene** Thread-Abo der Vollansicht |

Die Anzeige gruppiert nach Kalendertagen (`Conversation.tsx:79`, memoisiert seit
AGE-645) und scrollt ans Ende (`Conversation.tsx:112`).

> **Dieser Entwurf ist nach der Plan-Review überarbeitet.** Die erste Fassung
> hielt den Seitenzustand im Komponentenzustand und liess die `queryFn` den
> Cache **ersetzen**. opencode hat gezeigt, dass damit die zentrale Zusage des
> Changes — „Nachgeladenes bleibt" — gerade im Wettlauf bricht. Die betroffenen
> Entscheidungen tragen unten den alten Stand mit, damit die Korrektur lesbar
> bleibt und nicht als schon immer so dagewesen erscheint.

## Goals / Non-Goals

**Goals:**

- Die Abfrage trägt eine Grenze, und die Ordnung entsteht in der Datenbank davor.
- Ältere Nachrichten bleiben über ein Bedienelement erreichbar.
- Die Cache-Form bleibt `ChatMessage[]`, damit die drei anderen Schreiber
  unverändert weiterlaufen.
- Nachgeladenes bleibt sichtbar — auch bei einer Neuabfrage, die **vor** dem
  Nachladen losgelaufen ist.

**Non-Goals:**

- Kein `useInfiniteQuery`. Es ersetzte `ChatMessage[]` durch `{pages, pageParams}`
  und bräche alle drei fremden Schreiber auf einmal.
- Kein automatisches Nachladen beim Hochscrollen (Donalds Entscheidung: Knopf).
- Kein Sprung zu einer bestimmten älteren Nachricht. Das ist AGE-646.
- Keine Migration, keine Policy, kein Grant. `messages_select` bleibt unberührt.

## Decisions

### 1. Cursor auf `created_at`, nicht `offset` — abweichend vom Issue-Text

Das Issue schlägt „`limit`/`offset` in der Signatur, `nextOffset` zurückgeben"
vor, nach dem Vorbild von `fetchThreads`. **Für den Verlauf ist das falsch**, und
zwar aus einem Grund, den die Threadliste nicht hat: hier kommen laufend neue
Zeilen am geladenen Ende hinzu. Ein `offset`, der ab dem jüngsten Ende zählt,
verschiebt sich mit jeder eintreffenden Nachricht — die nächste Seite überspränge
dann eine Zeile oder lieferte eine doppelt.

Deshalb: `before` = `created_at` der ältesten geladenen Nachricht, Abfrage mit
`.lt("created_at", before).order("created_at", {ascending: false}).limit(n)`,
Ergebnis im Client umgedreht.

**Restrisiko Gleichstand:** zwei Nachrichten mit identischem `created_at` fielen
an der Seitengrenze auseinander. `timestamptz` löst auf Mikrosekunden auf, ein
Gleichstand verlangt also zwei Inserts in derselben Mikrosekunde. Ein Duplikat
kann dabei nicht entstehen — jedes Zusammenführen läuft über die `id`
(Entscheidung 4) —, eine übersprungene Zeile bliebe theoretisch möglich. Die
Alternative wäre ein zusammengesetzter Cursor `(created_at, id)`, den PostgREST
nur über eine `or`-Verschachtelung ausdrückt; der Preis dafür ist höher als das
Risiko.

### 2. `limit + 1` als Sonde — korrigiert

> **Erste Fassung:** `erschoepft = messages.length < limit`.
> **Befund (opencode, LOW):** sind genau `limit` ältere Zeilen übrig, liefert die
> Seite `limit` Zeilen, `erschoepft` bleibt falsch — und der Knopf steht einmal
> zu oft da, für eine leere Seite.

```ts
fetchMessages(threadId, { limit = VERLAUF_SEITE, before }?)
  → { messages: ChatMessage[]; erschoepft: boolean }
```

Die Abfrage holt `limit + 1` Zeilen, gibt höchstens `limit` zurück und setzt
`erschoepft = geholt <= limit`. Das kostet eine Zeile und beantwortet die Frage
ohne Raten. Gemessen wird an der **Antwort**, nie an der Länge der Anzeige.

`VERLAUF_SEITE` = 50, neben `THREADS_SEITE = 20` (`chat.ts:236`). Grösser als die
Threadseite, weil eine Nachricht viel weniger kostet als ein Thread mit
angereichertem Partner — und weil ein Verlauf, der beim Öffnen sofort einen Knopf
zeigt, sich falsch anfühlt.

### 3. Die `queryFn` **mischt**, sie ersetzt nicht — korrigiert

> **Erste Fassung:** die `queryFn` fragt `max(VERLAUF_SEITE, bereits geladen)` an
> und schreibt das Ergebnis in den Cache.
> **Befund (opencode, HIGH):** react-query **ersetzt** die Daten, wenn die
> `queryFn` auflöst. Eine Neuabfrage, die **vor** dem Nachladen mit 50 losgelaufen
> ist und **danach** auflöst, überschreibt die inzwischen 100 geladenen Zeilen mit
> 50. Genau die Zusage, die der Change verkauft, bricht damit im Wettlauf — und
> zwar bevorzugt beim Eintreffen einer Nachricht, also im Szenario, das sie
> sichern soll.

Der Anlass ist real: `new QueryClient()` (`src/main.tsx:14`) läuft auf den
Vorgaben, also `refetchOnWindowFocus: true` und `staleTime: 0`; dazu invalidiert
`use-ungelesen.ts:134`, und React StrictMode montiert doppelt.

Die `queryFn` liest deshalb den aktuellen Cache-Stand und gibt die **Vereinigung
über die `id`** zurück, chronologisch sortiert — statt ihn zu ersetzen. Damit
ist die Auflösungsreihenfolge gleichgültig: eine veraltete Antwort kann nur
bestätigen, was schon da ist, nie etwas wegnehmen.

Sie fragt weiterhin `max(VERLAUF_SEITE, bereits geladen)` an. Das ist nicht mehr
nötig, um Verlust zu verhindern (das erledigt die Vereinigung), sondern damit
eine Neuabfrage einen Verlauf, in dem viele Zeilen offen sind, auch wirklich
auffrischt.

Preis, den gemini (MEDIUM) benannt hat und der bestehen bleibt: wer zehn Seiten
nachlädt, holt bei jedem Fokuswechsel 500 Zeilen. Beschränkt auf das ausdrücklich
Angeforderte, aber es wächst mit der Sitzung. Verworfene Alternative:
`staleTime: Infinity` + `refetchOnWindowFocus: false` — das nähme die Neuabfrage
als Sicherheitsnetz weg, das heute einen Verlauf nach abgerissenem Realtime-Kanal
wieder richtig macht. **Diese Vorgaben gehören ohnehin auf den Tisch**, sobald die
App in einer WebView läuft; das ist eine Produktentscheidung und ein eigener
Vorgang, nicht Teil dieses Changes.

### 3b. Der Seitenzustand liegt im Cache, nicht in der Komponente — neu

> **Befund (opencode, HIGH 2 und eine unausgesprochene Annahme):** `erschoepft`
> aus „der letzten Antwort" springt zurück. Ist ein Thread mit 120 Zeilen
> vollständig geladen, fragt die Neuabfrage `max(50, 120) = 120` an, bekommt 120,
> und `120 < 120` ist falsch — der Knopf taucht wieder auf, obwohl es nichts
> Älteres gibt. Und: Seite und Fenster können denselben Thread **gleichzeitig**
> offen haben. Zwei Hook-Instanzen mit eigenem Zustand über **einem**
> Cache-Eintrag laufen auseinander.

Beides hat dieselbe Ursache und dieselbe Antwort: der Seitenzustand gehört
dorthin, wo auch die Nachrichten liegen.

```ts
verlaufSeitenQueryKey(threadId) → { erschoepft: boolean; laeuft: boolean }
```

- **`erschoepft` ist eine Sperrklinke.** Einmal wahr, bleibt es wahr, solange der
  Eintrag lebt. Setzen darf es nur eine Antwort, deren Sonde (`limit + 1`) leer
  blieb; eine Neuabfrage darf es **nie** zurückdrehen. Nachträglich kann nichts
  Älteres entstehen — Nachrichten werden in diesem Produkt nicht gelöscht und
  nicht rückdatiert.
- **`laeuft`** sperrt den Knopf, solange ein Nachladen offen ist.

Beide Flächen lesen denselben Eintrag und sehen damit denselben Knopf-Zustand.

### 4. Nachladen ist eine Vereinigung, kein Voranstellen — korrigiert

> **Erste Fassung:** „setzt das Ergebnis **vor** die bestehende Liste".
> **Befund (opencode, MEDIUM):** zwei Klicks kurz hintereinander lesen beide
> dasselbe `before`, holen dieselbe Seite und setzen sie zweimal davor. Gleiche
> `id`, gleiche React-Keys, echte Duplikate. Das Duplikat-Argument aus
> Entscheidung 1 trägt hier nicht — es gilt für den Gleichstand an der
> Seitengrenze, nicht für einen doppelten Aufruf.

„Ältere laden" ruft `fetchMessages` direkt und schreibt das Ergebnis per
`setQueryData` als **Vereinigung über die `id`** in denselben Eintrag —
dieselbe Operation wie in Entscheidung 3, nicht ein zweiter Weg daneben. Es ist
keine zweite Query und kein zweiter Cache-Eintrag; sonst schrieben Realtime und
optimistisches Senden in den einen Eintrag, während die Anzeige aus zweien läse.

Die Sperre aus 3b (`laeuft`) verhindert den Doppelklick zusätzlich. Beides, nicht
eines von beidem: die Sperre ist die Bedienung, die Vereinigung die Zusage.

### 5. Der Sprung ans Ende darf beim Vorsetzen nicht feuern — mit Korrektur

```ts
// Conversation.tsx:112 — heute
useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); },
          [messages.length, thread.id]);
```

`messages.length` ändert sich beim Vorsetzen älterer Nachrichten **genauso** wie
beim Eintreffen einer neuen. Unverändert risse dieser Effect das Mitglied nach
jedem „Ältere laden" ans untere Ende — also weg von genau der Stelle, für die es
den Knopf gedrückt hat.

Die Abhängigkeit wird deshalb von der **Länge** auf die **Identität der letzten
Nachricht** umgestellt (`messages.at(-1)?.id`). Vorsetzen ändert sie nicht,
Anhängen schon.

> **Korrektur.** Die erste Fassung schrieb, das sei „zugleich die schärfere
> Zusage: eine Nachricht, die mitten in der Liste ersetzt wird, löst dann
> ebenfalls keinen Sprung mehr aus." **Das ist falsch**, und beide Reviewer haben
> es gefunden. `mergeMessage` (`chat.ts:102`) ersetzt die optimistische Blase —
> und die ist das **letzte** Element, nicht ein mittleres. Ihre `id` wechselt beim
> Abgleich von `optimistic-…` auf die echte, die Abhängigkeit ändert sich, der
> Effect feuert. Heute feuert er dort **nicht**, weil sich die Länge nicht ändert.
> Die Umstellung fügt also einen Sprung hinzu, wo keiner war. Er ist harmlos —
> man hat gerade selbst gesendet und steht ohnehin unten —, aber er ist eine
> Verhaltensänderung und wird als solche benannt statt weggeredet.

**Das ist in jsdom nur halb messbar.** `scrollIntoView` existiert dort als
Attrappe; ein Test kann belegen, dass sie beim Vorsetzen **nicht** gerufen wird
und beim Anhängen schon — dass die gelesene Zeile danach optisch stehenbleibt,
belegt nur die Sichtprobe im Browser. Beides gehört in die Aufgabenliste, das
eine ersetzt das andere nicht.

### 6. Der Tagesmarker der obersten Gruppe

`gruppiereNachTag` gruppiert, was geladen ist. Nach dem Vorsetzen älterer
Nachrichten desselben Kalendertages rutscht der Marker automatisch an die neue
älteste Zeile dieses Tages — die Gruppierung wird ja neu über die ganze Liste
gerechnet. Es ist **keine** Sonderbehandlung nötig; die Spec verlangt trotzdem
ein Szenario dafür, weil genau das leicht kaputtgeht, wenn jemand später die
Gruppierung inkrementell macht.

### 7. Kein zusammengesetzter Index — als Grenze benannt, nicht wegerklärt

> **Befund (opencode, LOW):** der vorhandene Index ist
> `messages_thread_id_idx on public.messages (thread_id)`
> (`20260612065636_matching.sql:95`) — **ohne** `created_at`.

Die Seitenabfrage ist damit korrekt, aber nicht billig: Postgres findet über den
Index die Zeilen des Threads und **sortiert sie dann**, um `limit` davon
zurückzugeben. Die Sortierlast wächst also weiter mit der Länge des Gesprächs.

Was dieser Change trotzdem einlöst: die übertragene Menge, das Parsen im Client,
die Zahl der React-Knoten und die Tagesgruppierung sind ab hier gebunden — und
das sind die Kosten, die auf dem Gerät des Mitglieds anfallen. Die Sortierlast in
der Datenbank ist auf **einen** Thread beschränkt, nicht auf die Tabelle.

Ein Index `(thread_id, created_at desc)` ist die richtige Antwort darauf. Er ist
eine Migration und damit ausdrücklich ausserhalb dieses Changes — er kommt als
eigener Vorgang, nicht als stiller Zusatz. **Nicht** behaupten, er sei unnötig;
er ist verschoben.

## Risks / Trade-offs

| Risiko | Umgang |
| --- | --- |
| Gleichstand auf `created_at` an der Seitengrenze | Entscheidung 1; Duplikat unmöglich (Vereinigung über `id`), Auslassung theoretisch möglich |
| Fokuswechsel holt viel nach, wenn viel nachgeladen wurde | bewusst (gemini MEDIUM); beschränkt auf das ausdrücklich Angeforderte |
| Die `queryFn` mischt statt zu ersetzen — eine serverseitig entfernte Zeile verschwände nicht | in diesem Produkt gibt es kein Löschen von Nachrichten; fällt das, fällt auch die Sperrklinke aus 3b |
| Der Scroll-Sprung ist nur im Browser wirklich prüfbar | jsdom-Zusage **plus** Sichtprobe, beide als Aufgaben |
| Ein zusätzlicher Sprung nach dem Senden | Entscheidung 5, benannt statt versteckt |
| Der Knopf im 14-rem-Fenster (AGE-639) | Sichtprobe in **beiden** Varianten |
| Sortierlast bleibt ohne zusammengesetzten Index | Entscheidung 7; eigener Vorgang |
| AGE-646 nimmt an, der ganze Thread sei geladen | im Proposal benannt; dieser Change macht die Annahme falsch, bevor sie gebaut wird |
| Ein Kommentar in `Conversation.tsx:69` behauptet die Unbegrenztheit | wird falsch und gehört korrigiert — ein Waise, den dieser Change selbst erzeugt |
