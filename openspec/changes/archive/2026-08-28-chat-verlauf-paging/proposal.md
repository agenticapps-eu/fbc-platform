# Ältere Nachrichten nachladen statt den ganzen Verlauf auf einmal

Linear: **AGE-655**

## Why

`fetchMessages` (`src/lib/chat.ts:320`) holt **jede** Nachricht eines Threads —
kein `limit`, kein `range`. Die Threadliste daneben (`fetchThreads`,
`chat.ts:262`) ist seit AGE-638 gebunden und hat mit `THREADS_SEITE = 20` beides;
der Verlauf selbst blieb ungebunden.

Die Kosten wachsen mit dem, was Mitglieder **schreiben**, nicht damit, wie viele
es sind. Heute ist es folgenlos, weil kein Gespräch lang ist — die Last ist also
genau dann am grössten, wenn der Chat funktioniert. Das ist dieselbe Begründung,
die `openspec/specs/messaging/spec.md:394` für die Liste schon ausspricht; für
den Verlauf steht sie nirgends.

Es ist **kein Regress**: die fehlende Grenze steht seit der ersten Fassung auf
`main`. Aufgefallen ist sie bei der Diff-Review zu AGE-645, weil die
Tagesgruppierung über den ganzen Verlauf lief.

## What Changes

- Ein langes Gespräch öffnet sich jetzt **sofort**, statt erst den ganzen
  Verlauf zu laden. Sichtbar sind die letzten 50 Nachrichten — dort, wo man
  weiterliest.
- Wer weiter zurück will, findet am oberen Rand den Knopf **„Ältere laden"**.
  Er holt die nächsten 50 und verschwindet, sobald der Verlauf vollständig ist.
- **Die Ansicht bleibt dabei stehen**, wo sie war. Nachgeladene Nachrichten
  treten oben hinzu, ohne dass es ans Ende des Gesprächs springt.
- Die Tagesmarker rücken mit: lädt man ältere Nachrichten desselben Tages nach,
  steht der Marker danach über der ersten davon.
- Gilt in der **Gesprächsansicht und im angedockten Fenster** gleichermassen.

Für Gespräche mit weniger als 50 Nachrichten ändert sich nichts — kein Knopf,
kein Unterschied.

## Capabilities

### New Capabilities

_Keine._

### Modified Capabilities

- `messaging`: eine **neue** Anforderung, dass der Nachrichtenverlauf eines
  Threads seitenweise geladen wird und die älteren Nachrichten über ein
  Bedienelement erreichbar bleiben. Die bestehende Anforderung „The conversation
  list loads a bounded page, not every message" (`spec.md:394`) bindet
  ausdrücklich die **Liste** und die Vorschauzeile je Thread — über den Verlauf
  innerhalb eines Threads sagt sie nichts. Sie wird **nicht** geändert.

## Impact

**Was der Change technisch tut** (stand bis zum Archivieren in
`## What Changes` und ist von dort in den Neuigkeiten-Eintrag gelaufen —
den liest ein Mitglied, kein Entwickler):

- `fetchMessages` bekommt eine **Seitengrenze** und lädt die **neuesten**
  Nachrichten statt aller. Die Ordnung kommt vom Server, **vor** der Grenze.
- Der Verlauf trägt am oberen Rand einen Knopf **„Ältere laden"**, der die
  vorherige Seite davorsetzt. Ohne Knopf wäre die Grenze keine Seite, sondern
  eine dauerhafte Abschneidung.
- Die Cache-Form bleibt `ChatMessage[]`. Das ist eine Zusage an die **drei
  anderen Schreiber** desselben Eintrags, nicht Bequemlichkeit: optimistisches
  Senden (`use-gespraech.ts:137`), das globale Realtime-Abo
  (`use-ungelesen.ts:129`) und das Thread-Abo der Vollansicht
  (`ChatPage.tsx:72`) schreiben alle ein flaches Array.
- Eine **Neuabfrage darf geladene ältere Seiten nicht verwerfen.**
  `use-ungelesen.ts:134` invalidiert den Eintrag, wenn eine Nachricht für ein
  Gespräch eintrifft, das noch lädt — und jede Invalidierung liesse die
  `queryFn` neu laufen, die unter Paging nur die neueste Seite kennt.
- Der **Tagesmarker** aus AGE-645 gruppiert die geladene Liste. Steht die
  oberste Gruppe unvollständig da, muss der Marker beim Nachladen verschwinden
  oder sich ändern.
- **Kein** `useInfiniteQuery`: es änderte die Cache-Form und bräche alle drei
  Schreiber oben.
- **Keine** Migration, **keine** neue Tabelle, **kein** Table-Grant — und damit
  auch keine Berührung des Golden-Snapshots in `supabase/tests/grants_test.sql`.

| Fläche | Was |
| --- | --- |
| `src/lib/chat.ts` | `fetchMessages` bekommt `limit`/Cursor und gibt die Fortsetzung mit zurück |
| `src/components/chat/use-gespraech.ts` | der einzige echte Aufrufer; lädt die erste Seite, stellt das Nachladen bereit |
| `src/components/chat/Conversation.tsx` | Knopf am oberen Rand; der Tagesmarker der obersten Gruppe |
| `src/components/chat/use-ungelesen.ts` | die Invalidierung darf den geladenen Verlauf nicht kürzen |
| `src/pages/ChatPage.tsx` | Thread-Abo schreibt weiter in dieselbe Cache-Form |

**Nicht betroffen:** Datenbank, RLS, Grants, Edge Functions. `messages_select`
entscheidet weiterhin allein, wer welche Zeile sieht — eine Seitengrenze ist
Komfort, keine Sicherheitsgrenze.

**Berührt zwei offene Vorgänge:** AGE-646 (Zitat-Antwort) nimmt heute
ausdrücklich an, dass `fetchMessages` den ganzen Thread hält, und muss danach
den Fall „zitierte Nachricht ist noch nicht geladen" beantworten. Und die
Sichtprobe im 14-rem-Fenster aus AGE-639 gehört dazu, weil der Knopf dort
genauso bedienbar sein muss wie in der Vollansicht.
