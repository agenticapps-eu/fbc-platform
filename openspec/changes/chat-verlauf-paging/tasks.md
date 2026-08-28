> Überarbeitet nach der Plan-Review. Neu sind 1.6, 2.5, 2.6, 2.7 und 3.7 — sie
> gehen auf zwei HIGH- und zwei MEDIUM-Befunde zurück. Die alte 2.5 („die
> `queryFn` fragt 120 an") ist **ersetzt**: sie mass die Anfragegrösse, während
> die Spec-Zusage am Ergebnis hängt.

## 1. Datenschnittstelle

- [x] 1.1 **RED**: Zusage in `src/lib/chat.test.ts`, dass `fetchMessages` eine
      Grenze auf die Abfrage setzt und absteigend ordnet — gemessen an der
      Supabase-Attrappe (`limit`/`order`/`lt` werden gerufen), nicht am
      Rückgabewert allein.
- [x] 1.2 `VERLAUF_SEITE = 50` neben `THREADS_SEITE` (`chat.ts:236`).
- [x] 1.3 `fetchMessages(threadId, { limit, before }?)` →
      `{ messages, erschoepft }`. Abfrage absteigend mit `.limit(limit + 1)`,
      höchstens `limit` zurückgeben, Ergebnis im Client umdrehen.
- [x] 1.4 **Gegenprobe zur Sonde**: `limit + 1` gelieferte Zeilen ergeben
      `erschoepft: false` und **genau `limit`** zurückgegebene Nachrichten;
      `limit` gelieferte ergeben `erschoepft: true`. Ohne den zweiten Fall
      belegt der erste nichts.
- [x] 1.5 Der Doc-Kommentar über `fetchMessages` sagt, dass vom **jüngsten Ende**
      geladen wird und warum der Cursor kein `offset` ist (Entscheidung 1).
- [x] 1.6 **Vereinigung als eigene Funktion** (`vereinigeNachrichten`), über die
      `id`, chronologisch sortiert — dieselbe Ordnung wie `mergeMessage`
      (`created_at`, dann `id`). **RED**: zweimal dieselbe Seite vereinigt ergibt
      die Seite, nicht das Doppelte.

## 2. Der Hook

- [x] 2.1 **RED**: `use-gespraech.test.tsx` — beim Öffnen wird mit
      `{ limit: VERLAUF_SEITE }` geladen, nicht ohne Argument.
- [x] 2.2 Seitenzustand als **eigener Cache-Eintrag**, nicht als
      Komponentenzustand — damit Vollansicht und Fenster denselben Knopf-Zustand
      sehen, wenn sie denselben Thread gleichzeitig führen.

      **Abweichung vom Plan, bewusst:** geteilt wird nur `erschoepft`
      (`verlaufErschoepftQueryKey`, ein blanker `boolean`). `laeuft` blieb lokal —
      es ist Rückmeldung an den Finger, der gerade geklickt hat, und gehört nicht
      der anderen Fläche. Ein Eintrag `{erschoepft, laeuft}` hätte ein fremdes
      Fenster den Knopf sperren lassen, ohne dass dort jemand etwas gedrückt hat.

      **Und nach der Diff-Review zweimal nachgeschärft:** `erschoepft` ist
      **keine Sperrklinke** mehr (beide Begründungen dafür widerlegt, und ihr
      Fehlerfall heilte nicht), und die Sperre gegen den Doppelklick hängt am
      **Ref**, nicht am Zustand — ein Zustand ist erst nach dem nächsten Anstrich
      gesetzt und lässt zwei schnelle Klicks beide durch. Siehe design.md,
      Nachtrag.
- [x] 2.3 `useGespraech` gibt `ladeAeltere` und `hatAeltere` mit heraus.
- [x] 2.4 **RED**: `ladeAeltere` ruft `fetchMessages` mit `before` = `createdAt`
      der ältesten geladenen Nachricht und schreibt das Ergebnis als Vereinigung
      in **denselben** Eintrag.
- [x] 2.5 **RED — Wettlauf (HIGH 1)**: eine Neuabfrage ist unterwegs, das
      Mitglied lädt währenddessen ältere Nachrichten nach, die alte Antwort
      trifft **danach** ein. Zusage am **Ergebnis**: die nachgeladenen Zeilen
      stehen hinterher noch im Cache. Erst rot messen — mit einer ersetzenden
      `queryFn` muss dieser Test fehlschlagen.
- [x] 2.6 **RED — HIGH 2**: nach einer erschöpften Antwort ist `hatAeltere`
      falsch, und eine Neuabfrage, die genau so viele Zeilen zurückgibt wie
      geladen, dreht es **nicht** zurück. Trägt die Sonde (`limit + 1`), nicht
      mehr eine Sperrklinke — samt Gegenrichtung, damit die Zusage nicht nur
      „konstant falsch" belegt.
- [x] 2.7 **RED — Doppelklick (MEDIUM)**: zwei Aufrufe von `ladeAeltere` kurz
      hintereinander stellen **genau eine Anfrage**. Die erste Fassung mass nur
      das entdoppelte Ergebnis und liess die Zusage „der zweite läuft gar nicht
      erst los" ungeprüft (Diff-Review, codex). Mutations-Gegenprobe: Sperre
      zurück auf den Zustand ⇒ rot.
- [x] 2.8 **RED**: ein Wechsel auf einen **anderen** Thread setzt den
      Seitenzustand zurück. Der Eintrag hängt an der `threadId`; ein Reset im
      Effect käme zu spät.

## 3. Die Anzeige

- [x] 3.1 **RED**: `Conversation` zeigt den Knopf „Ältere laden" nur, wenn
      `hatAeltere` gilt — und **nicht**, wenn der Verlauf vollständig ist.
- [x] 3.2 Knopf am oberen Rand des Verlaufs, in **beiden** Varianten
      (`seite` und `fenster`).
- [x] 3.3 **RED — der Kern**: `scrollIntoView` wird beim **Vorsetzen** älterer
      Nachrichten NICHT gerufen, beim **Anhängen** einer neuen schon. Erst rot
      messen (heute hängt der Effect an `messages.length` und feuert bei beidem).
- [x] 3.4 Abhängigkeit des Scroll-Effects von `messages.length` auf
      `messages.at(-1)?.id` umstellen (`Conversation.tsx:112`).
- [x] 3.5 Den Kommentar `Conversation.tsx:69` korrigieren — er behauptet, der
      Verlauf werde ohne Begrenzung geholt. Das ist ab hier falsch.
- [x] 3.6 **RED**: nach dem Vorsetzen älterer Nachrichten desselben Kalendertages
      steht der Tagesmarker über der neuen ältesten Zeile dieses Tages.
- [x] 3.7 Der Knopf ist gesperrt, solange `laeuft` gilt, und sagt das auch
      (kein stiller toter Knopf).

## 4. Sichtprobe im Browser

Die jsdom-Zusagen aus 3.3 belegen, dass die Attrappe nicht gerufen wird — nicht,
dass die gelesene Zeile optisch stehenbleibt. Das ist zweierlei.

Gemessen am 28.08. gegen DEV, in einem eigens angelegten Wegwerf-Konto mit
einem Thread von 60 Nachrichten über drei Kalendertage. Alles danach wieder
gelöscht — `messages` steht global wieder bei 0 wie vorher, `profiles` bei 72.

- [x] 4.1 Erste Seite lädt **50 von 60**, und zwar die neuesten (11–60); Knopf
      steht; drei Tagesmarker. Nach dem Klick: 60 geladen, Knopf weg,
      `scrollTop` bleibt **0**, `scrollHeight` wächst 3398 → 3985.

      **Positivkontrolle im Browser**, dieselbe Mutation wie in jsdom: mit der
      alten Abhängigkeit (`messages.length`) springt `scrollTop` beim Klick von
      **0 auf 3657** — bei 313 px Sichtfenster und 3985 px Inhalt ist das das
      untere Ende. Ohne diese Gegenprobe belegte „springt nicht" nichts.

      Nebenbefund: das Prädikat `scrollTop + clientHeight >= scrollHeight - 2`
      war mit 2 px zu eng und meldete auch im kaputten Fall `false`. Der
      aussagekräftige Wert ist `scrollTop` selbst.
- [x] 4.2 Angedocktes Fenster bei 1280 px mit **beiden** Leisten offen: Fenster
      288 px (18 rem), Knopf 106 px, breiteste Blase 247 px — kein Überlauf.
      `scrollTop` bleibt auch dort 0, 60 geladen, Knopf weg.
- [x] 4.3 Zweiter Thread mit 5 Nachrichten: 5 geladen, **kein** Knopf.
- [x] 4.4 Nach vollständigem Nachladen `visibilitychange` + `focus` ausgelöst
      (so hängt react-query den Fokus ein): **weiterhin 60 geladen, weiterhin
      kein Knopf.** Ohne die Vereinigung wäre hier auf 50 zurückgeschnitten
      worden — die Sichtprobe zu 2.5 und 2.6 zusammen.

**Diese Messungen liegen VOR dem Cursor-Umbau der Diff-Review.** Sie belegen den
Scroll-Sprung, das Nachladen, den Knopf und das Verhalten beim Fokuswechsel —
alles Stellen, die der Umbau nicht angefasst hat. Was er anfasst, ist die
Abfrage, und die ist stattdessen **gegen echtes PostgREST** geprüft: drei Zeilen
mit identischem Zeitstempel, Cursor auf der dritten, HTTP 200 mit genau den zwei
Geschwistern davor. Beides zusammen deckt den Weg ab; keines der beiden allein.

## 5. Abnahme

- [x] 5.1 `pnpm typecheck`, `pnpm lint` (0 Fehler), `pnpm test` (192 Dateien,
      2175 Zusagen), `pnpm build` und die drei `grep`-Wächter aus `verify` grün.
- [x] 5.2 Diff-Review durch **drei** Anbieter gerufen, **zwei gezählt**:
      opencode FREIGABE MIT AUFLAGEN (3 Befunde), codex **ABLEHNUNG** (9), gemini
      nicht gezählt (zwei Wörter auf 1309 Diff-Zeilen). Alle Befunde in
      `REVIEWS.md` aufgelöst — darunter zwei, die eine Korrektur aus der ersten
      Runde wieder umgeworfen haben.
- [ ] 5.3 `openspec validate --all` grün, danach `openspec archive` +
      `pnpm release:entries` + prettier auf die erzeugte Datei.

## 6. Folgevorgänge, die dieser Change erzeugt

Nicht hier zu erledigen, aber hier entstanden — als Vorgang anlegen, nicht als
Notiz verlieren:

- [ ] 6.1 **Index `(thread_id, created_at desc, id desc)` auf `public.messages`.**
      Der zweite Sortierschlüssel gehört seit dem zusammengesetzten Cursor dazu.
      Der vorhandene `messages_thread_id_idx` deckt nur `thread_id`
      (`20260612065636_matching.sql:95`); die Sortierlast je Thread bleibt ohne
      ihn bestehen (Entscheidung 7). Eine Migration, deshalb eigener Vorgang.
- [ ] 6.2 **`defaultOptions` für den `QueryClient`.** `src/main.tsx:14` ist ein
      blankes `new QueryClient()`; `staleTime: 0` und `refetchOnWindowFocus: true`
      sind in einer WebView eine Produktentscheidung über Datenvolumen. Berührt
      die Capacitor-Hülle (AGE-642) und gehört Donald vorgelegt.
- [ ] 6.3 **AGE-646 gegenlesen.** Das Issue nimmt ausdrücklich an, dass
      `fetchMessages` den ganzen Thread hält. Diese Annahme ist ab hier falsch;
      der Sprung zum Zitat braucht dort eine eigene Antwort.
