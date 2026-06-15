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

// ── Lesen ─────────────────────────────────────────────────────────────────────

export const threadsQueryKey = (uid: string) => ["chat", "threads", uid] as const;
export const messagesQueryKey = (threadId: string) => ["chat", "messages", threadId] as const;

/**
 * Lädt meine Threads (RLS: nur eigene), reichert den Partner über `profiles_public`
 * an und hängt die letzte Nachricht je Thread als Vorschau + Sortierschlüssel an.
 * Absteigend nach letzter Aktivität sortiert.
 */
export async function fetchThreads(uid: string): Promise<ChatThread[]> {
  const { data: threads, error } = await supabase
    .from("message_threads")
    .select("id, a_profile_id, b_profile_id, created_at");
  if (error) throw error;
  const rows = threads ?? [];
  if (rows.length === 0) return [];

  const partnerIds = [
    ...new Set(rows.map((t) => (t.a_profile_id === uid ? t.b_profile_id : t.a_profile_id))),
  ];
  const threadIds = rows.map((t) => t.id);

  const [profilesRes, lastMsgRes] = await Promise.all([
    // Partner aus der Basistabelle `profiles` (NICHT `profiles_public`): die Chat-Route
    // ist Prime+, und `profiles_select_self_or_prime` gibt Prime+ jede Profilzeile frei.
    // So sieht man den Namen eines freigegebenen Kontakts auch dann, wenn dieser sein
    // Profil NICHT öffentlich gestellt hat (profiles_public filtert `where is_public`).
    supabase.from("profiles").select("id, name, avatar_url, company, tier").in("id", partnerIds),
    // Neueste zuerst; pro Thread nimmt der Reduce die erste (= jüngste) Zeile.
    supabase
      .from("messages")
      .select("thread_id, body, created_at, sender_id")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false }),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (lastMsgRes.error) throw lastMsgRes.error;

  const partnerById = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const lastByThread = new Map<string, { body: string; created_at: string; sender_id: string }>();
  for (const m of lastMsgRes.data ?? []) {
    if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, m);
  }

  const partnerId = (t: (typeof rows)[number]) =>
    t.a_profile_id === uid ? t.b_profile_id : t.a_profile_id;

  return rows
    .map((t) => mapThreadRow(t, uid, partnerById.get(partnerId(t)), lastByThread.get(t.id) ?? null))
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}

/** Lädt die Nachrichten eines Threads, chronologisch (RLS: nur Teilnehmer). */
export async function fetchMessages(threadId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, thread_id, sender_id, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapMessageRow);
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
