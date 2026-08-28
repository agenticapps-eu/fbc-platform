# Session Handoff — 2026-08-28 (Abend, AGE-656 und AGE-655 ausgeliefert)

**Sitzung:** `fbc-platform-f4`, Worktree
`fbc-platform.donald-age-655-chat-verlauf-paging`, Branch
`donald/age-655-archiv`. Parallel lief `fbc-platform-b7` an der mobilen Hülle
(AGE-642); die Arbeitsteilung war **mobil dort, alles andere hier** und hat
zweimal verhindert, dass wir uns überschreiben.

**Vier PRs gemergt:** #271 (Übergabe), #273 (AGE-656), #274 (AGE-655 Code),
#275 (AGE-655 Archivierung). Alle `main`-Läufe vollständig grün — inklusive
`drift-gate: success`, nicht `skipped`.

## Accomplished

**AGE-656 — Passwort-Mindestlänge (High, klein).** `EinstellungenPage.tsx` prüfte
`pw.length < 8`, während GoTrue, `config.toml:230`, die `redeem-activation`-Function
und die Aktivierungsseite alle 10 verlangen. Wer 8–9 Zeichen wählte, kam durch
die Feldprüfung, wurde vom Server abgelehnt — und sein Passwort blieb unverändert.
Die Zahl liegt jetzt in `src/config/auth.ts`. **Kein OpenSpec-Change:**
`access-control/spec.md:864` verlangt das schon; die Spec war wahr, der Code nicht.

**AGE-655 — Seitengrenze im Nachrichtenverlauf (Medium, voller Loop).**
`fetchMessages` lädt eine Seite von 50 vom jüngsten Ende, ein Knopf „Ältere laden"
holt nach. Die Anforderung steht mit acht Szenarien in
`openspec/specs/messaging/spec.md`.

**Zwei Funde, die den Change tragen und in keinem Issue standen:**

1. `Conversation.tsx` scrollte bei jeder **Längenänderung** ans Ende — Ältere
   davorzusetzen ändert die Länge genauso wie Anhängen. Jedes „Ältere laden"
   hätte das Mitglied weggerissen.
2. `new QueryClient()` (`main.tsx:14`) läuft auf den Vorgaben
   (`refetchOnWindowFocus: true`, `staleTime: 0`).

**Beide Review-Runden haben den Entwurf umgeworfen.** Plan-Review: opencode
REQUEST-CHANGES mit zwei HIGH (react-query **ersetzt** beim Auflösen; `erschoepft`
sprang zurück) — gemini APPROVE auf denselben Artefakten. Diff-Review: codex
**ABLEHNUNG** mit neun Befunden, opencode drei. Zwei davon kassierten eine
Korrektur aus Runde eins.

## Decisions

- **Knopf „Ältere laden" statt Nachladen beim Hochscrollen** — Donalds
  Entscheidung. Kein Scroll-Anker-Gefummel, in jsdom messbar.
- **Cursor `(created_at, id)`, nicht `offset` und nicht `created_at` allein.**
  Das Issue schlug `offset` vor; am geladenen Ende kommen laufend Zeilen hinzu.
  Und `created_at` allein ist keine totale Ordnung: `now()` ist **innerhalb einer
  Transaktion stabil**, ein Import erzeugt Gleichstände der Bauart nach. Eine
  Zwischenfassung mit `lte` war zu klein — sie verschob den stillen Verlust nur
  in einen Stillstand.
- **`cancelQueries`, nicht `structuralSharing`.** codex' Befund war richtig, das
  Mittel nicht: React Query wendet `structuralSharing` **auch auf `setQueryData`**
  an, und eine additive Vereinigung kann keine Entfernung ausdrücken — das
  Ersetzen der optimistischen Blase und ihre Rücknahme waren damit kaputt.
- **Sperrklinke ersatzlos entfernt.** Beide Begründungen widerlegt; ihr
  Fehlerfall heilte nicht, der ohne sie schon.
- **`src/main.tsx` nicht angefasst.** Die Absicherung liegt im Cache, damit die
  Produktentscheidung über die Vorgaben unbelastet bleibt (AGE-658, bei b7).

## Files modified

- `src/config/auth.ts` — **neu**, `MIN_PASSWORT_LAENGE = 10` (AGE-656)
- `src/pages/EinstellungenPage.tsx`, `src/pages/ActivationRedeemPage.tsx` — lesen
  die geteilte Konstante
- `src/lib/chat.ts` — `VERLAUF_SEITE`, `ChatVerlaufCursor`, `fetchMessages` mit
  `limit + 1`-Sonde und zusammengesetztem Cursor, `vereinigeNachrichten`,
  `verlaufErschoepftQueryKey`
- `src/components/chat/use-gespraech.ts` — vereinigende `queryFn`,
  `ladeAeltere` mit `cancelQueries` und Ref-Sperre, `hatAeltere` ohne `isSuccess`
- `src/components/chat/Conversation.tsx` — Knopf, Scroll-Effect an `letzteId`
- `src/components/chat/ChatFenster.tsx`, `src/pages/ChatPage.tsx` — verdrahtet
- Tests: `chat.verlauf-seite.test.ts` und `Conversation.aeltere.test.tsx` neu,
  fünf weitere nachgezogen
- `openspec/specs/messaging/spec.md` — die gefolgte Anforderung
- `openspec/changes/archive/2026-08-28-chat-verlauf-paging/`

## Next session: start here

**Nichts an AGE-655 oder AGE-656 nachzuholen.** Beide sind live, Linear korrekt
auf *Done*, DEV rückstandsfrei (belegt, siehe unten).

**`main` gehört gerade `fbc-platform-b7`.** Die haben zwei ungepushte Commits im
Worktree `fbc-platform.donald-age-642-capacitor-huelle` (Push-Verdrahtung
AGE-641 Phase B, App-Symbole) und ändern `src/components/AppShell.tsx`. **Vor
eigener Arbeit dort abstimmen.**

**Der naheliegende nächste Schritt ist AGE-657** — Index
`(thread_id, created_at desc, id desc)` auf `public.messages`. Klein, eine
Migration, aus AGE-655 entstanden: ohne ihn sortiert Postgres weiterhin alle
Zeilen des Threads. `create index concurrently` läuft **nicht** in einer
Transaktion — sonst bricht `migrate-prod`. Danach **AGE-646** (Zitat-Antwort);
dort steht ein Kommentar von mir, dessen Annahme dieser Change falsch gemacht hat.

## Open questions

- **AGE-658 liegt bei b7**, nicht bei mir. Ich hatte ihn angelegt, obwohl b7 ihn
  angekündigt hatte — Donald hat es gemerkt. Die Entscheidung ist inzwischen
  gefallen und gebaut (nur nativ zähmen, Web unverändert).
- **AGE-657 und AGE-646** offen, siehe oben.
- **Unverändert offen** aus früheren Sitzungen: AGE-610 · AGE-512 ·
  Aktivierungsversand 69/72 · Rotation des PROD-DB-Passworts · AGE-598 ·
  AGE-256 · AGE-606 · AGE-628/629/630.

## Was diese Sitzung über das Verfahren gelernt hat

Fünf Fälle, alle derselben Sorte: **eine Prüfung, die grün ist, weil sie am
falschen Ort sucht.**

1. **Mein Wettlauf-Test war ein Vakuumtest.** `waitFor` war grün, *bevor* die
   veraltete Antwort schrieb. Erst eine zusätzliche Zeile, auf deren Erscheinen
   der Test wartet, machte ihn scharf.
2. **Mein Scroll-Prädikat war 2 px zu eng** und meldete auch im kaputten Fall
   `false`. Der aussagekräftige Wert war `scrollTop` selbst (0 gegen 3657).
3. **`cancelQueries` hatte ich als behoben geführt, ohne zu messen.** Donalds
   Frage „alles behoben?" hat es aufgedeckt; die Reproduktion steht jetzt als
   Test und wird ohne die Zeile rot.
4. **Der `or=`-Ausdruck lief nur gegen meine eigene Attrappe** — die kann eine
   Filtersprache nicht ablehnen. Gegen echtes PostgREST geprüft: HTTP 200 mit
   genau den zwei erwarteten Zeilen.
5. **„DEV rückstandsfrei" war falsch.** Zwei `notifications` überlebten, weil der
   Fremdschlüssel am **Empfänger** hängt und der eine echte Persona war. Meine
   Gegenprobe auf *verwaiste* Zeilen hätte sie nie gefunden.

Sechs Mutations-Gegenproben insgesamt. Vier neue Memories: Doku-PR-Titel
schliessen Vorgänge · fremde Vorgänge nicht anfassen · Aufräumen folgt nicht den
Fremdschlüsseln · `pg_trigger` statt `information_schema`.
