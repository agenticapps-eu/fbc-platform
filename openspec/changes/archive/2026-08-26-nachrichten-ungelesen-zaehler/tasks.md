# Tasks — Nachrichten sichtbar machen: Zugang und Ungelesen-Zähler (AGE-583)

> Überarbeitet nach der Plan-Review (`REVIEWS.md`, zwei gezählte Fremdanbieter,
> zweimal REQUEST-CHANGES). Die Abschnitte 2 und 3 sehen anders aus als vor der
> Review: der Lesestand liegt jetzt in einer **eigenen Tabelle**, und die
> `SECURITY DEFINER`-Funktion ist ersatzlos entfallen. Die Aufgaben 2.6, 3.7,
> 3.9, 4.5, 7.3 und 8.6 gäbe es ohne die Review nicht.

## 1 · Den Befund messen, bevor irgendetwas geändert wird

- [x] 1.1 Schema belegt: `message_threads` trägt keinen Lese-Zeitstempel,
      `messages` kein `read_at` (`20260612065636_matching.sql:64-80`)
- [x] 1.2 Grants belegt: `message_threads/authenticated=INSERT,SELECT`
      (`grants_test.sql:54`)
- [x] 1.3 Belegt, dass der leere Zustand **schon existiert**
      (`ChatPage.tsx:126-141`, AGE-494) — die Abnahmeliste des Vorgangs führt
      ihn zu Unrecht als offen
- [x] 1.4 Belegt, dass es **kein Dashboard** gibt: `/` ist `HomeRedirect` →
      `HomePage`. Zielfläche ist `/profil` (Entscheidung Donald, 26.08.)
- [x] 1.5 Belegt, dass `messages` bereits in `supabase_realtime` liegt und
      `message_threads` **nicht**
- [x] 1.6 Belegt, dass `profiles.id` und `auth.uid()` derselbe Schlüsselraum
      sind — die Policies vergleichen `a_profile_id = (select auth.uid())`
      direkt. Ohne das wäre „eigene Nachricht" in der Zählabfrage falsch
      (Review, unausgesprochene Annahme)
- [x] 1.7 **RED belegen** mit `scripts/probe-age583-read-position.ts`: vor der
      Migration gibt es die Tabelle nicht; `message_threads` trägt kein
      UPDATE-Recht, auf Tabellen- **und** Spaltenebene. Mit gesetzten
      JWT-Claims, samt Positivkontrolle im selben Lauf

## 2 · Migration

- [x] 2.1 Migrationskopf: Anlass, Entscheidung, **verworfene Alternative** —
      zwei Spalten auf `message_threads` liefern dem Gegenüber eine
      Lesebestätigung, und ein Spalten-Grant repariert das nicht, weil die
      Einschränkung zeilenabhängig ist. Signiert und datiert
- [x] 2.2 `public.thread_read_positions(thread_id, profile_id, last_read_at)`,
      Primärschlüssel `(thread_id, profile_id)`, beide FKs `on delete cascade`
- [x] 2.3 RLS an, Policy eigentümerprivat:
      `using (is_activated() and profile_id = (select auth.uid()))`; im
      `with check` zusätzlich der Nachweis der Teilnahme am Thread
- [x] 2.4 `grant select, insert, update … to authenticated`. **Kein `delete`** —
      „wieder auf ungelesen" ist keine Anforderung
- [x] 2.5 `public.unread_message_counts()` — `security invoker`, `stable`,
      `set search_path = ''`, liefert `(thread_id uuid, unread_count bigint)`,
      **nur** Threads mit mindestens einer ungelesenen Nachricht
- [x] 2.6 `revoke execute … from public, anon` + `grant execute … to
    authenticated`. `revoke` in Default Privileges ist bei Funktionen ein
      No-op — das muss hier ausgesprochen stehen
- [x] 2.7 `comment on table` und `comment on function`, nach dem Muster der
      bestehenden
- [x] 2.8 Index `(thread_id, created_at)` auf `messages` — **am `EXPLAIN`
      belegen**, dass die Zählabfrage ihn nimmt. Zwei Reviewer unabhängig.
      **Ergebnis: sie nimmt ihn nicht** (1,1 ms mit, 1,4 ms ohne — Rauschen).
      Der Index ist wieder entfernt. Gefunden hat der `EXPLAIN` stattdessen die
      RLS-`EXISTS` mit 20 000 Durchläufen; die laterale Fassung bringt
      213 ms → 1,2 ms und 120 252 → 350 Puffer, Ergebnis gegengeprüft
- [x] 2.9 **`grants_test.sql` mitpflegen**: `thread_read_positions/
    authenticated=INSERT,SELECT,UPDATE` in den Golden-String. Ohne diese Zeile
      bricht der Gesamtvergleich, auch ohne dass der Tabellenname im Test steht
- [x] 2.10 Belegen, dass `message_threads` und `messages` **unverändert** sind —
      keine Spalte, kein Grant, keine Policy

## 3 · pgTAP — die Zusagen, die kein UI-Test halten kann

> `alike()` statt `like()`; ein fremdes UPDATE ergibt null Zeilen statt `42501`;
> eine Sonde ohne JWT-Claims trifft null Zeilen und belegt damit **nichts**.

- [x] 3.1 Test: Teilnehmer schreibt seine Zeile → geht durch
- [x] 3.2 Test: **A kann B's Zeile nicht lesen** — die eigentliche Zusage.
      Positivkontrolle im selben Lauf: A liest seine eigene
- [x] 3.3 Test: A kann keine Zeile mit fremdem `profile_id` schreiben
- [x] 3.4 Test: Unbeteiligter kann für diesen Thread keine Zeile schreiben
- [x] 3.5 Test: nicht aktiviertes Konto → kein Schreiben, und
      `unread_message_counts()` liefert null Zeilen
- [x] 3.6 Test: eigene Nachricht erhöht den eigenen Zähler nicht
- [x] 3.7 Test: **ohne Lesestand zählen alle fremden Nachrichten**, nicht keine
- [x] 3.8 Test: Thread ohne Ungelesenes liefert **gar keine Zeile** (Review,
      MEDIUM — sonst pinnt der Test ein Verhalten, das die Spec nicht nennt)
- [x] 3.9 Test: die Funktion trägt auch bei vergiftetem `search_path`
      (`set local search_path = 'pg_temp'` vor dem Aufruf). Review, LOW
- [x] 3.10 Test: `message_threads` trägt weiterhin genau `INSERT, SELECT` — auf
      Tabellen- **und** Spaltenebene. Die Spalten-Assertion in `grants_test.sql`
      hat eine `table_name in (…)`-Liste und prüft still nicht, was nicht
      drinsteht — die neue Tabelle also dort mit aufnehmen
- [x] 3.11 `supabase test db` **mit Dateiliste** laufen lassen — ohne sie meldet
      der Befehl FAIL, weil die elf `probe_*.sql` kein pgTAP sind. Und belegen,
      dass die neue Datei in dieser Liste steht

## 4 · Datenschicht im Frontend

- [x] 4.1 `database.types.ts` **von Hand** um Tabelle und Funktion ergänzen.
      `supabase gen types` NICHT darüberlaufen lassen
- [x] 4.2 Test zuerst: reiner Helfer, der die Zeilen zu einer Summe und einer
      Zuordnung je Thread verdichtet — inklusive „keine Zeile heißt 0"
- [x] 4.3 `fetchUnreadCounts()` und `markThreadRead()` in `src/lib/chat.ts`.
      `markThreadRead` ist ein Upsert auf die eigene Zeile, keine RPC
- [x] 4.4 Abo: INSERTs auf `messages` **ohne** Thread-Filter, invalidiert den
      Zähler. Das bestehende `subscribeToThread` bleibt unangetastet — es hat
      einen anderen Zweck
- [x] 4.5 **Entprellen**, damit ein Schwall eingehender Nachrichten nicht einen
      Aufruf je Nachricht auslöst (Review, LOW)

## 5 · Kopfzeile

- [x] 5.1 Test: bei 0 rendert **keine** Blase
- [x] 5.2 Test: bei >0 nennt der zugängliche Name die Zahl — Farbe trägt nie
      allein eine Bedeutung
- [x] 5.3 Test: ausgeloggt erscheint das Kuvert nicht
- [x] 5.4 Test: der Klick führt auf `/chat`
- [x] 5.5 Implementieren, neben dem bestehenden (funktionslosen) Glockenknopf
- [x] 5.6 **Bei 320 px messen**, nicht schätzen: die Kopfzeile hatte nach
      AGE-540 genau 56 px Reserve, ein zweites Symbol kostet davon. Am
      **Inhaltsbedarf** messen — `scrollWidth` meldet „passt", wo es nicht passt
- [x] 5.7 Trägt es nicht: entscheiden lassen, nicht still unter `sm` ausblenden.
      **Es trägt** — gemessen bei echten 320 px (Emulation, nicht Resize):
      Inhaltsbedarf 308 px, **12 px Reserve**, Dokumentbreite 320, nichts
      seitlich schiebbar. Das Kuvert kostet 36 px, vorher waren es also 48 px
      Reserve. Auch mit ZWEISTELLIGER Blase (24) geprüft: die Blase liegt
      absolut und ändert die Breite nicht, ihr rechter Rand steht bei 214 px.
      **12 px sind knapp** — ein drittes Symbol in der Kopfzeile trägt sie nicht
      mehr, und das ist beim Verdrahten der Glocke zu messen, nicht zu hoffen

## 6 · `/profil`, Thread-Liste und Label

- [x] 6.1 Test: dritte Kachel erscheint nur bei >0
- [x] 6.2 Test: sie führt auf `/chat`
- [x] 6.3 `StatTile` in `ProfilAnsichtPage` — echte Daten, keine erfundenen
      (Anforderung aus AGE-539)
- [x] 6.4 Test: `ThreadList` markiert genau die Zeilen mit Ungelesenem
- [x] 6.5 Test: bei 0 ist **keine** Zeile markiert
- [x] 6.6 `nav.ts:155` Label „Chat" → „Nachrichten"; Seitentitel in
      `ChatPage.tsx` mitziehen
- [x] 6.7 Bestehende Tests auf „Chat" als Zeichenkette prüfen, **bevor** CI es
      findet

## 7 · Gelesen-Markierung an der Oberfläche

- [x] 7.1 Test: Öffnen eines Threads schreibt **einmal**, nicht je Nachricht
- [x] 7.2 Test: der Zähler des offenen Threads fällt auf 0
- [x] 7.3 Test: kommt eine Nachricht in den **offenen** Thread, rückt der
      Lesestand sofort vor — die Summe steigt nicht auf 1 und fällt zurück
      (Review, MEDIUM)
- [x] 7.4 Implementieren

## 8 · Gegenprobe im Browser

> Grüne Tests haben in AGE-492 ein visuell falsches Ergebnis durchgewunken.

- [x] 8.1 `npx tsx scripts/chat-testkonten.ts` — zwei verbundene Konten. A
      schreibt, B hat die App offen: **Zähler bewegt sich ohne Neuladen**
- [x] 8.2 Positivkontrolle: B öffnet, Zähler fällt auf 0; **A's Lesestand
      unverändert** — und für A gar nicht abfragbar
- [x] 8.3 Beide Themes (`hell` und `navy`), 1440 / 1024 / 375 / 320 px
- [x] 8.4 Ein Konto **ohne** Nachrichten: keine Blase, keine Kachel, keine Null,
      keine Markierung
- [x] 8.5 Ein **nicht aktiviertes** Konto: kein Zähler — mit rohem Client
      gegengeprüft, nicht nur im UI
- [x] 8.6 **Realtime-Fehlschlag prüfen, nicht den Glücksfall** (Review,
      unausgesprochene Annahme): ein unbeteiligtes Konto abonniert `messages`
      ohne Filter und darf für eine fremde Nachricht **kein** Ereignis
      bekommen. Ein Kanal, der zu viel liefert, sieht im Normalbetrieb aus wie
      einer, der richtig filtert
- [x] 8.7 `npx tsx scripts/probe-age583-read-position.ts` — GREEN-Lauf

## 9 · Abschluss

- [x] 9.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` grün
- [x] 9.2 Diff-Review durch einen unabhängigen Leser
- [x] 9.3 `openspec validate --all` grün, Change archivieren
- [ ] 9.4 Migration auf DEV anwenden (`pnpm db:push`) — der Merge allein wendet
      **keine** Migration an, und eine Migration auf `main`, die PROD fehlt,
      überspringt still jeden Frontend-Deploy
- [ ] 9.5 PR, Linear auf Done
