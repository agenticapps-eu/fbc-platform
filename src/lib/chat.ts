import type { RealtimeChannel } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { supabase } from "./supabase";

/**
 * Realtime-Chat (AGE-248) — Datenschicht. Spec: docs/matching-spec.md §9.
 *
 * Der Client macht NUR, was die RLS (§6 der RLS-Policies) erlaubt:
 *  - `fetchThreads` / `fetchMessages` — lesen, durch `threads_select` /
 *    `messages_select` auf eigene Threads beschränkt.
 *  - `sendMessage` — Insert; `messages_insert` erzwingt serverseitig, dass nur ein
 *    Thread-Teilnehmer und nur bei akzeptiertem `contact_request` posten darf.
 *  - `subscribeToThread` — Realtime-INSERTs des offenen Threads (Postgres liefert
 *    via RLS nur Zeilen, die der Nutzer auch per SELECT sähe).
 *
 * Threads werden NIE vom Client angelegt — das macht der Lifecycle-Trigger bei
 * `accepted` (Migration 20260614100000). Reine Helfer sind in chat.test.ts getestet.
 */

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type ThreadRow = Database["public"]["Tables"]["message_threads"]["Row"];

/** Partner-Identität für die Thread-Liste (Teilmenge von profiles). */
type ChatPartner = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  company: string | null;
  tier: string | null;
};

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: string;
  /** Gesetzt, solange eine optimistische Blase auf ihre echte Zeile wartet. */
  pending?: boolean;
}

export interface ChatThread {
  id: string;
  partner: {
    id: string;
    name: string;
    avatarUrl: string | null;
    company: string | null;
    tier: string | null;
  };
  lastMessage: { body: string; createdAt: string; fromMe: boolean } | null;
  /** Sortierschlüssel der Liste: letzte Nachricht oder, mangels Nachrichten, die Thread-Anlage. */
  lastActivityAt: string;
}

// ── reine Helfer ──────────────────────────────────────────────────────────────

export function mapMessageRow(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

export function mapThreadRow(
  thread: Pick<ThreadRow, "id" | "a_profile_id" | "b_profile_id" | "created_at">,
  uid: string,
  partner: ChatPartner | undefined,
  lastMessage: { body: string; created_at: string; sender_id: string } | null,
): ChatThread {
  const partnerId = thread.a_profile_id === uid ? thread.b_profile_id : thread.a_profile_id;
  return {
    id: thread.id,
    partner: {
      id: partnerId,
      name: partner?.name ?? "Mitglied",
      avatarUrl: partner?.avatar_url ?? null,
      company: partner?.company ?? null,
      tier: partner?.tier ?? null,
    },
    lastMessage: lastMessage
      ? {
          body: lastMessage.body,
          createdAt: lastMessage.created_at,
          fromMe: lastMessage.sender_id === uid,
        }
      : null,
    lastActivityAt: lastMessage?.created_at ?? thread.created_at,
  };
}

/**
 * Fügt eine eingehende Nachricht (Realtime-Echo oder Insert-Rückgabe) in die Liste
 * ein und gleicht dabei die optimistische Blase ab:
 *  - gleiche `id` bereits vorhanden → ersetzen (idempotent gegen doppelte Events);
 *  - sonst gibt es eine `pending`-Blase mit gleichem Sender + Text → diese ersetzen;
 *  - sonst anhängen. Ergebnis bleibt chronologisch (created_at, dann id) sortiert.
 */
export function mergeMessage(messages: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const byId = messages.findIndex((m) => m.id === incoming.id);
  let next: ChatMessage[];
  if (byId >= 0) {
    next = messages.slice();
    next[byId] = incoming;
  } else {
    const optimistic = messages.findIndex(
      (m) => m.pending && m.senderId === incoming.senderId && m.body === incoming.body,
    );
    if (optimistic >= 0) {
      next = messages.slice();
      next[optimistic] = incoming;
    } else {
      next = [...messages, incoming];
    }
  }
  return next.sort((a, b) =>
    a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt),
  );
}

// ── Ungelesen (AGE-583) ──────────────────────────────────────────────────────

/** Eine Zeile aus `unread_message_counts()`. */
type UngelesenZeile = Database["public"]["Functions"]["unread_message_counts"]["Returns"][number];

export interface UngelesenStand {
  /** Summe über alle Threads. Die Zahl an Kopfzeile und Profilkachel. */
  gesamt: number;
  jeThread: Map<string, number>;
  hatUngelesen: (threadId: string) => boolean;
}

/**
 * Verdichtet die RPC-Zeilen zu einer Summe und einer Zuordnung je Thread.
 *
 * `unread_message_counts()` liefert Threads OHNE Ungelesenes GAR NICHT — nicht
 * als Zeile mit 0. Ein Thread, der fehlt, hat deshalb null und ist nicht
 * unbekannt. Diese Umdeutung steht hier an EINER Stelle, statt an jeder der drei
 * Aufrufstellen erneut geraten zu werden.
 */
export function fasseUngelesenZusammen(zeilen: UngelesenZeile[]): UngelesenStand {
  const jeThread = new Map(zeilen.map((z) => [z.thread_id, z.unread_count]));
  let gesamt = 0;
  for (const n of jeThread.values()) gesamt += n;
  return { gesamt, jeThread, hatUngelesen: (id) => (jeThread.get(id) ?? 0) > 0 };
}

export const unreadQueryKey = (uid: string) => ["chat", "unread", uid] as const;

/** Ungelesene je Thread. RLS entscheidet, was sichtbar ist — die Funktion ist
 *  SECURITY INVOKER und bringt kein eigenes Gate mit. */
export async function fetchUnreadCounts(): Promise<UngelesenStand> {
  const { data, error } = await supabase.rpc("unread_message_counts");
  if (error) throw error;
  return fasseUngelesenZusammen(data ?? []);
}

/**
 * Setzt den eigenen Lesestand auf jetzt. Ein Upsert auf die eigene Zeile — die
 * `trp_own`-Policy erzwingt serverseitig, dass `profile_id` der Aufrufer ist und
 * dass er am Thread teilnimmt.
 *
 * `last_read_at` steht hier als PLATZHALTER im Rumpf, und sein Wert ist egal.
 *
 * Beides ist nötig, und die erste Fassung hatte es falsch — gefunden hat es die
 * Diff-Review (gemini, HIGH), weil der Kommentar an dieser Stelle das Gegenteil
 * dessen behauptete, was der Code tat:
 *
 *  - **Die Spalte MUSS im Rumpf stehen.** PostgREST baut aus einem Upsert ein
 *    `on conflict do update set <nur die gesendeten Spalten>`. Ohne sie rückte
 *    der Lesestand beim ZWEITEN Markieren nicht an — lautlos.
 *  - **Ihr Wert darf NICHT vom Client kommen.** Verglichen wird gegen
 *    `messages.created_at`, also die Serveruhr; eine zweite Uhr im selben
 *    Vergleich hieße, dass eine vorgehende Client-Uhr Nachrichten als gelesen
 *    gelten lässt, bevor es sie gibt. Ein Trigger (`…_serveruhr`) überschreibt
 *    den Wert deshalb serverseitig mit `clock_timestamp()`.
 *
 * Der Platzhalter ist bewusst der Epoch-Anfang und nicht `new Date()`: ein
 * plausibel aussehender Wert würde bei einem entfernten Trigger nicht auffallen,
 * dieser hier schon.
 */
export async function markThreadRead(threadId: string, uid: string): Promise<void> {
  const { error } = await supabase
    .from("thread_read_positions")
    .upsert(
      { thread_id: threadId, profile_id: uid, last_read_at: "1970-01-01T00:00:00Z" },
      { onConflict: "thread_id,profile_id" },
    );
  if (error) throw error;
}

/**
 * Abonniert ALLE eingehenden Nachrichten des Kontos — ohne Thread-Filter, weil
 * der Zähler auf jeder Seite stimmen muss und nicht nur im offenen Gespräch.
 *
 * Gefiltert wird über die RLS: Postgres liefert nur Zeilen, die das Konto auch
 * per SELECT sähe. Das ist eine Zusage der Plattform, keine dieses Repositorys —
 * sie ist deshalb im Browser gegen den FEHLSCHLAG geprüft (ein unbeteiligtes
 * Konto darf kein Ereignis bekommen), nicht nur gegen den Glücksfall.
 *
 * `subscribeToThread` bleibt daneben bestehen: es spielt die Nachricht in den
 * offenen Verlauf ein, dieses Abo hält nur den Zähler nach.
 */
export function subscribeToAllMessages(onInsert: (message: ChatMessage) => void): () => void {
  // Der Themenname trägt eine Zufallskennung, und das ist keine Zierde.
  //
  // Mit einem FESTEN Namen („messages:alle") gibt `channel()` beim zweiten
  // Aufruf denselben, bereits abonnierten Kanal zurück, und `.on()` wirft:
  //   cannot add `postgres_changes` callbacks for realtime:messages:alle
  //   after `subscribe()`
  // Das passiert bei jedem erneuten Montieren — im Entwicklungsmodus schon beim
  // ersten Rendern, im Browser nach jedem Abmelden und Anmelden. Der Zähler
  // wäre danach dauerhaft tot, ohne dass irgendetwas sichtbar kaputtginge.
  //
  // Gefunden hat es `WillkommenPage.test.tsx` — eine Suite, die die ganze
  // Anwendung zweimal rendert und mit Nachrichten nichts zu tun hat.
  const channel: RealtimeChannel = supabase
    .channel(`messages:alle:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) =>
      onInsert(mapMessageRow(payload.new as MessageRow)),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

// ── Lesen ─────────────────────────────────────────────────────────────────────

export const threadsQueryKey = (uid: string) => ["chat", "threads", uid] as const;
export const messagesQueryKey = (threadId: string) => ["chat", "messages", threadId] as const;

/**
 * Ob es zu diesem Thread nichts Älteres mehr zu laden gibt (AGE-655).
 *
 * Steht als **eigener Cache-Eintrag** neben den Nachrichten und nicht im
 * Zustand einer Komponente, aus zwei Gründen, die beide aus der Plan-Review
 * kommen:
 *
 *  - Die Vollansicht und ein angedocktes Fenster können denselben Thread
 *    **gleichzeitig** führen. Zwei Hook-Instanzen mit eigenem Zustand über
 *    einem gemeinsamen Nachrichten-Eintrag liefen auseinander — die eine böte
 *    einen Weg zu älteren Nachrichten an, den die andere schon ausgeschöpft hat.
 *  - Der Wert ist eine **Sperrklinke**: einmal wahr, bleibt er wahr. Eine
 *    Neuabfrage darf ihn nicht zurückdrehen, sonst erschiene der Knopf nach
 *    jedem Fensterwechsel wieder und lüde eine leere Seite. Nachträglich kann
 *    nichts Älteres entstehen — Nachrichten werden hier nicht gelöscht und
 *    nicht rückdatiert.
 */
export const verlaufErschoepftQueryKey = (threadId: string) =>
  ["chat", "verlauf-erschoepft", threadId] as const;

/** Wieviele Threads eine Seite trägt. */
export const THREADS_SEITE = 20;

/**
 * Nachrichten je Verlaufsseite (AGE-655). Grösser als `THREADS_SEITE`, weil eine
 * Nachricht viel weniger kostet als ein Thread mit angereichertem Partner — und
 * weil ein Verlauf, der beim Öffnen sofort einen „Ältere laden"-Knopf zeigt,
 * sich falsch anfühlt.
 */
export const VERLAUF_SEITE = 50;

/** Eine Seite der Unterhaltungsliste; `nextOffset` ist null, wenn keine folgt. */
export interface ChatThreadSeite {
  threads: ChatThread[];
  nextOffset: number | null;
}

/**
 * Lädt EINE SEITE meiner Threads (RLS: nur eigene) und reichert den Partner an.
 *
 * Sortierung und Grenze liegen beim Server: `last_message_at` ist eine Spalte
 * auf `message_threads` (Migration 20260827120000), gefuehrt von einem Trigger
 * auf `messages`. Vorher lud diese Funktion ALLE Threads und ALLE Nachrichten
 * aller dieser Threads und nahm im Client die jüngste je Thread — eine Last,
 * die mit dem wächst, was Mitglieder SCHREIBEN, und die deshalb genau dann am
 * größten ist, wenn der Chat funktioniert.
 *
 * `nullsFirst: false` ist Pflicht, nicht Kosmetik: `desc` ist in Postgres
 * `nulls first`, ein Thread ohne einzige Nachricht stünde sonst ganz oben — und
 * der Index (`… desc nulls last`) käme nicht zum Zug.
 *
 * Nicht nachsortieren: die Ordnung kommt vom Server, VOR der Grenze. Eine Seite
 * nach dem Schneiden zu sortieren kann nur noch ordnen, was der Schnitt schon
 * gewählt hat.
 */
export async function fetchThreads(
  uid: string,
  { limit = THREADS_SEITE, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<ChatThreadSeite> {
  const { data: threads, error } = await supabase
    .from("message_threads")
    // Eine Zeichenkette am Stück: aus einer ZUSAMMENGESETZTEN leitet
    // postgrest-js die Spaltentypen nicht mehr ab und das Ergebnis fällt auf
    // `GenericStringError` zurück.
    // prettier-ignore
    .select(
      "id, a_profile_id, b_profile_id, created_at, last_message_at, last_message_body, last_message_sender_id",
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  const rows = threads ?? [];
  const nextOffset = rows.length === limit ? offset + limit : null;
  if (rows.length === 0) return { threads: [], nextOffset: null };

  const partnerIds = [
    ...new Set(rows.map((t) => (t.a_profile_id === uid ? t.b_profile_id : t.a_profile_id))),
  ];

  // Partner aus der Basistabelle `profiles` (NICHT `profiles_public`): die Chat-Route
  // ist Prime+, und `profiles_select_self_or_prime` gibt Prime+ jede Profilzeile frei.
  // So sieht man den Namen eines freigegebenen Kontakts auch dann, wenn dieser sein
  // Profil NICHT öffentlich gestellt hat (profiles_public filtert `where is_public`).
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, name, avatar_url, company, tier")
    .in("id", partnerIds);
  if (profilesError) throw profilesError;

  const partnerById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const partnerId = (t: (typeof rows)[number]) =>
    t.a_profile_id === uid ? t.b_profile_id : t.a_profile_id;

  return {
    threads: rows.map((t) =>
      mapThreadRow(
        t,
        uid,
        partnerById.get(partnerId(t)),
        t.last_message_at !== null &&
          t.last_message_body !== null &&
          t.last_message_sender_id !== null
          ? {
              body: t.last_message_body,
              created_at: t.last_message_at,
              sender_id: t.last_message_sender_id,
            }
          : null,
      ),
    ),
    nextOffset,
  };
}

export interface ChatVerlaufSeite {
  messages: ChatMessage[];
  /** Ob es JENSEITS dieser Seite nichts Älteres mehr gibt. Aus der Antwort gemessen. */
  erschoepft: boolean;
}

/**
 * Lädt EINE SEITE des Verlaufs, vom **jüngsten Ende** her (RLS: nur Teilnehmer).
 *
 * Bis AGE-655 holte diese Funktion jede Nachricht des Threads. Die Kosten
 * wachsen damit, wie viel Mitglieder SCHREIBEN — sie sind deshalb bei der
 * Einführung unsichtbar und am grössten, wenn der Chat angenommen wird. Das ist
 * dieselbe Begründung, aus der `fetchThreads` seit AGE-638 gebunden ist.
 *
 * **Cursor statt `offset`**, anders als bei der Threadliste. Dort zählt der
 * Offset in eine Liste, die sich am gelesenen Ende nicht verändert; hier kommen
 * am jüngsten Ende laufend Zeilen hinzu. Ein Offset verschöbe sich mit jeder
 * eintreffenden Nachricht, und die nächste Seite überspränge eine Zeile oder
 * lieferte eine doppelt. `before` ist deshalb ein Keyset auf `created_at`.
 *
 * **`limit + 1` ist eine Sonde, keine Nachricht.** Sie beantwortet „gibt es noch
 * ältere", ohne zu raten, und fällt aus dem Ergebnis wieder heraus. Ohne sie
 * wäre „genau `limit` Zeilen übrig" von „noch mehr übrig" nicht zu
 * unterscheiden, und der Weg zu den älteren stünde einmal zu oft da — für eine
 * leere Seite.
 *
 * Absteigend geordnet und erst im Client umgedreht: aufsteigend schnitte die
 * Grenze das ALTE Ende ab, und ein Gespräch beginnt für das Mitglied bei der
 * letzten Nachricht.
 */
export async function fetchMessages(
  threadId: string,
  { limit = VERLAUF_SEITE, before }: { limit?: number; before?: string } = {},
): Promise<ChatVerlaufSeite> {
  let abfrage = supabase
    .from("messages")
    .select("id, thread_id, sender_id, body, created_at")
    .eq("thread_id", threadId);
  if (before !== undefined) abfrage = abfrage.lt("created_at", before);

  const { data, error } = await abfrage.order("created_at", { ascending: false }).limit(limit + 1);
  if (error) throw error;

  const absteigend = data ?? [];
  const erschoepft = absteigend.length <= limit;
  // Die Sonde ist die ÄLTESTE Zeile der absteigenden Antwort — sie fällt hinten
  // weg, bevor umgedreht wird.
  return {
    messages: absteigend.slice(0, limit).map(mapMessageRow).reverse(),
    erschoepft,
  };
}

/**
 * Vereinigt zwei Nachrichtenlisten über die `id`, chronologisch — dieselbe
 * Ordnung wie `mergeMessage` (`created_at`, dann `id`).
 *
 * Sie ersetzt bewusst BEIDE Stellen, an denen sonst „voranstellen" bzw.
 * „überschreiben" stünde, und zwar aus zwei Gründen, die die Plan-Review
 * geliefert hat:
 *
 *  - **Überschreiben verliert im Wettlauf.** react-query ersetzt die Daten,
 *    wenn die `queryFn` auflöst. Eine Abfrage, die vor einem Nachladen mit einer
 *    Seite losläuft und danach antwortet, nähme die inzwischen nachgeladenen
 *    Zeilen wieder weg. Eine Vereinigung kann nur bestätigen, nie wegnehmen —
 *    die Auflösungsreihenfolge wird damit gleichgültig.
 *  - **Voranstellen dupliziert.** Zwei Klicks auf „Ältere laden" kurz
 *    hintereinander lesen dasselbe `before` und holen dieselbe Seite.
 *
 * Bei gleicher `id` gewinnt der NEUE Eintrag: er kommt vom Server, der alte kann
 * eine schwebende Blase sein.
 */
export function vereinigeNachrichten(a: ChatMessage[], b: ChatMessage[]): ChatMessage[] {
  const nachId = new Map(a.map((m) => [m.id, m]));
  for (const m of b) nachId.set(m.id, m);
  return [...nachId.values()].sort((x, y) =>
    x.createdAt === y.createdAt ? x.id.localeCompare(y.id) : x.createdAt.localeCompare(y.createdAt),
  );
}

// ── Senden ──────────────────────────────────────────────────────────────────

/**
 * Sendet eine Nachricht. Die `messages_insert`-RLS erzwingt Teilnahme + akzeptierten
 * Kontakt; ist der Kontakt nicht (mehr) freigegeben, wirft Supabase — der Aufrufer
 * macht dann das optimistische Anfügen rückgängig. Gibt die echte Zeile zurück.
 */
export async function sendMessage(input: {
  threadId: string;
  senderId: string;
  body: string;
}): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ thread_id: input.threadId, sender_id: input.senderId, body: input.body })
    .select("id, thread_id, sender_id, body, created_at")
    .single();
  if (error) throw error;
  return mapMessageRow(data);
}

// ── Realtime ──────────────────────────────────────────────────────────────────

/**
 * Abonniert neue Nachrichten EINES Threads (§9: pro offenem Thread). Liefert eine
 * Funktion zum Beenden des Abos. Postgres sendet via RLS nur Zeilen, die der Nutzer
 * auch per SELECT sähe — d. h. nur eigene Threads.
 */
export function subscribeToThread(
  threadId: string,
  onInsert: (message: ChatMessage) => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`messages:${threadId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
      (payload) => onInsert(mapMessageRow(payload.new as MessageRow)),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
