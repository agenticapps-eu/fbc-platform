# Nachrichten sichtbar machen: Zugang und Ungelesen-Zähler

## Why

Linear: **AGE-583**. Anlass war Detlevs Dashboard-Mockup mit „Neue Nachrichten 3"
und Donalds Satz vom 22.08.: „Was mir komplett fehlt, sind Nachrichten zwischen
Mitgliedern."

Der Kernbefund des Vorgangs stimmt und ist am 26.08. nachgemessen: **die
Funktion existiert seit Juni, der Weg dorthin fehlt.** `message_threads`,
`messages`, die RLS „erst vernetzen, dann schreiben", der Thread-Trigger beim
Annehmen einer Kontaktanfrage, die Realtime-Publikation und `/chat` mit
`ThreadList` und `Conversation` sind gebaut und laufen. `src/config/nav.ts:155`
führt `/chat` als `section: "sub"` — geroutet, ohne Menüeintrag. Wer die Adresse
nicht kennt, findet Nachrichten nicht.

### Drei Behauptungen des Vorgangs halten der Messung nicht stand

Reviewer prüfen den vorgelegten Text, nicht die Welt. Deshalb steht hier, was
**vor** dem ersten Reviewer gemessen wurde:

| Behauptung im Vorgang                | Gemessen am 26.08.                                                                                                                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| „Der leere Zustand fehlt"            | **Falsch.** `ChatPage.tsx:126-141` trägt seit AGE-494 genau den geforderten `EmptyState`, samt Knopf auf `/mitglieder`. Der Vorgang formuliert einen Text, den es fast wörtlich schon gibt   |
| „Dashboard-Kachel"                   | **Es gibt kein Dashboard.** `/` ist `HomeRedirect` und zeigt die öffentliche `HomePage`. Der persönliche Bereich ist `/profil` (`ProfilAnsichtPage`) mit den Kacheln „Netzwerk" und „Events" |
| „zwei Spalten auf `message_threads`" | **Widerspricht der eigenen Zusage des Vorgangs** — siehe den nächsten Abschnitt. Der Vorschlag wird nicht umgesetzt                                                                          |

Der leere Zustand ist damit **kein Arbeitspunkt**, sondern ein Haken, den
AGE-494 bereits gesetzt hat.

### Der Schemavorschlag des Vorgangs liefert genau die Lesebestätigung, die der Vorgang verbietet

**Befund der Plan-Review (opencode, HIGH). Er ist richtig, und er war in der
ersten Fassung dieses Proposals nicht gesehen.**

Der Vorgang will ausdrücklich keine Lesebestätigungen, mit sozialer Begründung:
„Wer sieht, dass gelesen und nicht geantwortet wurde, fühlt sich übergangen. In
einem Club, in dem man sich auf Events wiedertrifft, ist das keine Kleinigkeit."
Und er schlägt im selben Atemzug `a_last_read_at` / `b_last_read_at` **auf
`message_threads`** vor.

`threads_select` gibt jedem Teilnehmer die **ganze Zeile**. Zwei Spalten dort
heißen deshalb: A liest per gewöhnlicher Abfrage, wann B das Gespräch zuletzt
geöffnet hat. Das ist eine Lesebestätigung auf Thread-Ebene — mit Uhrzeit.

Ein Spalten-Grant repariert das nicht. Er könnte sagen „nur diese zwei Spalten
sind schreibbar", aber nicht „A sieht `a_last_read_at` und nicht
`b_last_read_at`": welche der beiden meine ist, hängt davon ab, auf welcher
Seite des Paares ich stehe — die Einschränkung ist **zeilenabhängig**, ein
Spalten-Grant ist es nicht.

### Die Auflösung macht den Change kleiner, nicht größer

Der Lesestand kommt in eine **eigene Tabelle**
`public.thread_read_positions(thread_id, profile_id, last_read_at)`, Primärschlüssel
über das Paar. Damit ist „mein Lesestand" eine **Zeile**, und Zeilen sind genau
das, was RLS ausdrücken kann:

```sql
using ( public.is_activated() and profile_id = (select auth.uid()) )
```

Was daraus folgt, ist der eigentliche Gewinn:

- **Die `SECURITY DEFINER`-Funktion entfällt ersatzlos.** Die erste Fassung
  brauchte sie, weil `message_threads` kein UPDATE-Recht trägt und eine Policy
  „nur mein Ende" nicht formulieren kann. Auf einer eigenen Tabelle schreibt das
  Mitglied schlicht seine eigene Zeile. Jede `DEFINER`-Funktion umgeht die RLS
  und muss ihr Gate selbst mitbringen — eine weniger davon ist eine Stelle
  weniger, an der ein fehlendes Gate unbemerkt bleibt.
- **`message_threads` wird gar nicht angefasst.** Keine neue Spalte, kein neues
  Recht, kein geändertes Verhalten an einer Tabelle, auf der Realtime und vier
  Policies liegen.
- **Die Zusage ist strukturell statt erklärt.** Der Wert des Gegenübers ist
  nicht „wird nicht angezeigt", sondern nicht lesbar.

Der Preis ist eine neue Tabelle und damit eine Zeile mehr in der Grant-Matrix
von `supabase/tests/grants_test.sql`. Das ist ein bekannter Stolperstein: jede
neue Tabelle mit Table-Grant bricht dort den Gesamtvergleich, auch ohne dass ihr
Name im Test steht.

### Und warum der Zähler NICHT `SECURITY DEFINER` ist

`threads_select` und `messages_select` verlangen beide bereits
`public.is_activated()` und Teilnahme; die neue Policy auf
`thread_read_positions` verlangt Eigentümerschaft. Eine `SECURITY INVOKER`-Funktion
erbt alle drei. Ein nicht aktiviertes Konto bekommt **null Zeilen, ohne dass
diese Funktion das Wort „aktiviert" enthält** — die Zusage aus der Abnahmeliste
wird strukturell erfüllt statt ein zweites Mal ausgesprochen.

## What Changes

### 1 · Eine Tabelle und eine Funktion

`public.thread_read_positions(thread_id, profile_id, last_read_at)`,
Primärschlüssel `(thread_id, profile_id)`, RLS eigentümerprivat, und beim
Schreiben zusätzlich der Nachweis, dass der Schreibende an diesem Thread
teilnimmt. `select, insert, update` für `authenticated` — **kein `delete`**:
„wieder auf ungelesen setzen" ist keine Anforderung, und ein Recht ohne
Anforderung ist totes Gewicht.

`public.unread_message_counts()` — `SECURITY INVOKER`, `stable`, liefert
`(thread_id uuid, unread_count bigint)`. Kopfzeile und Kachel summieren, die
Thread-Liste bildet ab. **Eine** Quelle für drei Flächen.

Ungelesen ist eine Nachricht, die **echt neuer** ist als mein Lesestand und
**nicht von mir** stammt. Ohne Lesestand zählt alles Fremde. Threads ohne
Ungelesenes liefert die Funktion **gar nicht** — sonst wären „keine Zeile" und
„Zahl 0" zwei Wege, dasselbe zu sagen, und die Oberfläche müsste beide kennen.

Der Rückgabetyp ist `bigint`, weil `count(*)` das liefert (Review, LOW). Ein
`integer` wäre ein Cast, der nur so lange gutgeht, wie ihn niemand prüft.

### 2 · Der Lesestand wird mit `clock_timestamp()` geschrieben

**Aus der Review (LOW), und die Begründung trägt weiter als der Anlass.**
`now()` ist der Transaktionsbeginn. Eine Nachricht, die währenddessen
festgeschrieben wird, wäre bei `created_at > last_read_at` für immer gelesen,
ohne je gesehen worden zu sein. `clock_timestamp()` rückt vor.

### 3 · Der Index, den beide Reviewer forderten, hilft nicht — gemessen

**Zwei Reviewer verlangten unabhängig `messages (thread_id, created_at)`**
(MEDIUM). Die Begründung klang zwingend, und die erste Fassung dieses Proposals
hat sie übernommen. Der `EXPLAIN` gegen 20 000 Nachrichten widerlegt sie: der
Index wird **nie** gewählt, mit ihm 1,1 ms, ohne ihn 1,4 ms — Rauschen.

Der Grund steht in der Abfrage: verglichen wird gegen `p.last_read_at`, einen
Wert aus der **verbundenen** Tabelle, und daneben steht ein
`or p.last_read_at is null`. Eine Disjunktion über eine Join-Spalte ist keine
Index-Bedingung. Beide Reviewer haben über eine Form geurteilt
(`created_at > konstante`), die diese Abfrage nicht hat.

Er kommt deshalb **nicht** in die Migration. Ein Index, den der Planer nie
wählt, ist nicht neutral — er kostet bei jedem Nachrichten-Insert.

**Geholfen hat etwas anderes, und das hat erst der `EXPLAIN` gezeigt.** In der
naheliegenden Fassung läuft die RLS-Prüfung von `messages_select` — ein
korreliertes `EXISTS` auf `message_threads` — **einmal je Nachricht**. Treibt man
stattdessen von `message_threads` aus und zählt je Thread in einer **lateralen**
Unterabfrage, greifen erst die billigen Bedingungen, und die teure Prüfung läuft
nur noch für die verbleibenden Zeilen:

|             | Zeit       | Puffer  | RLS-Durchläufe |
| ----------- | ---------- | ------- | -------------- |
| naheliegend | 213 ms     | 120 252 | 20 000         |
| lateral     | **1,2 ms** | **350** | **29**         |

Gleiches Ergebnis, gegengeprüft. Das ist der Grund für die ungewöhnliche Form
der Abfrage — sie ist nicht so geschrieben, weil es hübscher ist.

### 4 · Zwei Zugänge — Kopfzeile und `/profil`

**Kopfzeile:** ein Kuvert mit Zähler, führt auf `/chat`. Nachrichten gehören
nicht zum Stöbern, sondern zum Reagieren — sie brauchen keinen Platz im
Hauptmenü, sondern Sichtbarkeit im Moment des Eintreffens. `/chat` bleibt
`section: "sub"`; nur das Label wechselt von „Chat" auf „Nachrichten".

**`/profil`:** eine dritte Kachel neben „Netzwerk" und „Events" (Entscheidung
Donald, 26.08., nachdem die Messung ergab, dass es kein Dashboard gibt).

**Die Thread-Liste markiert, welches Gespräch gemeint ist** — sonst führt der
Zähler an einen Ort, an dem man wieder suchen muss.

Bei 0 wird **nichts** gezeigt: keine Blase, keine Null, keine Markierung. Am
Go-Live steht der Zähler bei allen auf 0 — auf PROD sind 2 von 71 Profilen
aktiviert, und Nachrichten setzen eine angenommene Kontaktanfrage voraus.

### 5 · Der Zähler bewegt sich ohne Neuladen — und das wird gegengeprüft

`messages` liegt bereits in der `supabase_realtime`-Publikation
(`20260614140000`). Der Zähler abonniert INSERTs auf `messages` **ohne
Thread-Filter** und verlässt sich auf die RLS. **Keine Migration an der
Publikation, keine neue Policy.**

**Dass die RLS im Realtime-Kanal wirklich greift, ist eine Zusage der Plattform,
keine dieses Repositorys** (Review, unausgesprochene Annahme). Der Glücksfall
belegt sie nicht: ein Kanal, der zu viel liefert, sieht im Normalbetrieb genauso
aus wie einer, der richtig filtert. Deshalb wird der **Fehlschlag** geprüft — ein
unbeteiligtes Konto darf kein Ereignis bekommen.

Trifft eine Nachricht im **offenen** Gespräch ein, rückt der Lesestand sofort
vor. Ohne das stiege der Zähler auf 1 und fiele wieder — ein Zucken, das
aussieht wie ein Fehler (Review, MEDIUM).

## Impact

- **Migration:** eine Tabelle, eine Policy, ein Index, eine Funktion. **Keine
  Änderung an `message_threads` oder `messages`.**
- **`supabase/tests/grants_test.sql`:** die Grant-Matrix bekommt
  `thread_read_positions/authenticated=INSERT,SELECT,UPDATE`. Ohne diese Zeile
  bricht der Gesamtvergleich und mit ihm der CI-Job.
- **Spec:** `messaging` — vier neue Anforderungen.
- **Frontend:** `src/lib/chat.ts`, `src/components/AppShell.tsx`,
  `src/pages/ChatPage.tsx`, `src/components/chat/ThreadList.tsx`,
  `src/pages/ProfilAnsichtPage.tsx`, `src/config/nav.ts`,
  `src/lib/database.types.ts`.
- **`src/lib/database.types.ts` wird von Hand gepflegt.** `supabase gen types`
  darf nicht darüberlaufen.

## Was dieser Change NICHT tut

- **Keine Glocke.** Der Knopf in `AppShell.tsx:512` trägt bis heute kein
  `onClick`, und `notifications` wird im Frontend nirgends gelesen. Eigener
  Change (`glocke-und-hinweistypen`), weil dort Schreib-Trigger auf fünf
  Tabellen dazukommen — eine andere Risikoklasse als eine Tabelle mit drei
  Spalten.
- **Kein Menüeintrag** für `/chat`. Entschieden am 24.08.
- **Keine Lesebestätigungen**, keine Anhänge, keine Gruppen, keine Suche in
  Nachrichten, kein Löschen, kein Blockieren, kein „wieder auf ungelesen".
- **Kein neuer leerer Zustand** — der bestehende erfüllt die Anforderung schon.

## Was bleibt offen, wissentlich

- **`fetchThreads` lädt alle Nachrichten aller Threads**
  (`src/lib/chat.ts:155-159`, kein `limit`), um je Thread die letzte als
  Vorschau zu zeigen. Bestehender Mangel; dieser Change fasst ihn **nicht** an
  und verschlimmert ihn nicht — der Zähler kommt aus der neuen Funktion, nicht
  aus dieser Abfrage. Ein eigener Vorgang. **Zwei Reviewer haben unabhängig
  angemerkt, dass hier ein zweiter unbegrenzter Durchlauf im selben Teilsystem
  entsteht.** Das stimmt, und die Antwort ist der Index aus Abschnitt 3 plus die
  Beschränkung auf Threads mit Ungelesenem — nicht eine Sanierung, die diesen
  Change verdoppelt.
- **Der Lesestand ist thread-, nicht nachrichtengenau.** Wer ein Gespräch öffnet
  und nur die erste von fünf neuen Nachrichten liest, hat danach null
  ungelesene. Der Preis für einen Schreibvorgang statt fünf, und die bewusste
  Wahl des Vorgangs.
- **Die Kopfzeile hält einen dauerhaften Kanal je angemeldeter Sitzung.** Bei 71
  Profilen ohne Belang; bei einem Vielfachen davon zu messen, nicht zu hoffen.
- **Das Schema ist auf genau zwei Teilnehmer gebaut.** Gruppengespräche würden
  Tabelle, Funktion und Anforderung gleichermaßen ungültig machen. Sie stehen
  ausdrücklich nicht auf dem Plan.
