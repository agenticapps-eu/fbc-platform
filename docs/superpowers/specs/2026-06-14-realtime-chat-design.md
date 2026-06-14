# Design — Realtime Chat (AGE-248)

**Status**: Approved  **Date**: 2026-06-14  **Linear**: AGE-248
**Spec**: `docs/matching-spec.md` §9  **Look**: Schwarz & Gold (`docs/design-system.md`)

## Goal

Freigegebene (akzeptierte) Kontakte chatten in Echtzeit; vorher ist der Chat
weder erreichbar noch ist ein `messages`-INSERT möglich (RLS-erzwungen). Nur
Prime+. Optimistisches Senden, kein „gelesen"-Tracking (Phase 1).

## Was bereits existiert (nicht neu bauen)

- Tabellen `message_threads`, `messages` (Migration `20260612065636_matching.sql`).
- RLS (`20260612082726_rls_policies.sql` §6):
  - `threads_select` / `messages_select` — nur Thread-Teilnehmer.
  - `messages_insert` — `sender_id = auth.uid()` UND ein `accepted`
    `contact_request` zwischen den beiden Thread-Profilen existiert.
- Thread-Anlage bei `accepted` läuft serverseitig im Lifecycle-Trigger
  (`20260614100000_contact_request_flow.sql`). Der Client legt **keine** Threads an.

## Die eine Schema-Lücke

`messages` ist **nicht** in der `supabase_realtime`-Publication → Postgres
sendet keine Change-Events. Eine Migration ergänzt das.

## Architektur — 4 isolierte Einheiten

### 1. Migration `20260614140000_messages_realtime.sql`
- `messages` zur `supabase_realtime`-Publication hinzufügen (idempotent:
  `if not exists`-Guard über `pg_publication_tables`).
- `REPLICA IDENTITY` bleibt Default — INSERT-Payloads tragen die neue Zeile,
  mehr braucht der Chat nicht (kein UPDATE/DELETE-Realtime).
- RLS gilt für Realtime mit: Supabase liefert Change-Events nur an Clients, die
  die Zeile per `messages_select` sehen dürfen. Keine zusätzliche Policy nötig.

### 2. Datenschicht `src/lib/chat.ts` (Muster: `routing-queue.ts`)
RLS-treu, dünn. Reine Helfer sind unit-getestet.
- `fetchThreads(uid)` → Threads mit eigener Beteiligung, angereichert über
  `profiles_public` (Partnername/Avatar/Firma) + letzte Nachricht als Vorschau.
- `fetchMessages(threadId)` → Nachrichten aufsteigend nach `created_at`.
- `sendMessage({threadId, senderId, body})` → schlichter Insert; die
  `messages_insert`-RLS erzwingt das Accepted-Gating serverseitig.
- `subscribeToThread(threadId, onInsert)` → kapselt
  `supabase.channel().on('postgres_changes', {event:'INSERT', schema:'public',
  table:'messages', filter:'thread_id=eq.<id>'})`; gibt eine Unsubscribe-Funktion
  zurück.
- Reine Helfer: `mapThreadRow`, `mergeMessages(existing, incoming)` (dedupe nach
  `id`, sortiert), `reconcileOptimistic(messages, optimistic)` (entfernt die
  temporäre Blase, sobald die echte Zeile mit gleichem `(sender_id, body)`
  eintrifft).

### 3. UI `src/pages/ChatPage.tsx` (+ `src/components/chat/`)
- Prime+ Route `/chat` und `/chat/:threadId` (Master-Detail). Desktop:
  Thread-Liste links + Konversation rechts. Mobil: Liste → Thread gestapelt.
- Optimistisches Senden: temporäre Blase sofort anfügen; bei Realtime-Echo /
  Insert-Rückgabe abgleichen; bei RLS-Fehler Blase entfernen + Danger-Toast.
- React-Query für Fetches; Realtime-INSERT hängt per `setQueryData` an.
- Schwarz-&-Gold über vorhandene Tokens/`Card`/`Button`/`Avatar`/`EmptyState`.

### 4. Einstiegspunkte
- `nav.ts`: `/chat` als `minTier: "prime"`, `section: "community"` (kein
  Top-Level-Sidebar-Eintrag, wie `/verzeichnis`).
- MeinBereich „Netzwerk / Bestätigte Kontakte" → Link „Zum Chat" (`/chat`).
- `MeineAnfragenWidget`: nach Annahme verlinkt der Erfolgs-Toast in den Chat.

## Tests (DoD #4 — Kern)
- `supabase/tests/probe_chat_realtime_gating.sql` (Muster:
  `probe_routing_queue.sql`, läuft in Transaktion, rollt zurück):
  1. `messages`-INSERT scheitert, solange die `contact_request` `pending` ist /
     vor Annahme — Thread existiert noch nicht bzw. Gating greift.
  2. Nach `accepted`: Thread existiert, INSERT gelingt, beide Teilnehmer sehen
     die Nachricht.
  3. Nicht-Teilnehmer kann weder SELECT noch INSERT.
  4. Assertion: `messages` ∈ `supabase_realtime`-Publication.
- `src/lib/chat.test.ts` — reine `mapThreadRow`, `mergeMessages`,
  `reconcileOptimistic`.

## Fehlerbehandlung
- Sende-Fehler (z. B. Kontakt nicht mehr akzeptiert) → optimistische Blase
  entfernen + Danger-Toast.
- Unbekannter / fremder Thread → `EmptyState`, kein Absturz.

## Bewusst NICHT in Phase 1
- Kein „gelesen"-Status, keine Tipp-Indikatoren, keine globale Unread-Subscription,
  keine Anhänge. (§9: Lesezustände einfach halten.)
