import { supabase } from "./supabase";

/**
 * Kontaktanfrage-Flow (AGE-247) — Datenschicht. Spec: docs/matching-spec.md §6.
 *
 * Der Client macht hier NUR, was die RLS ihm erlaubt:
 *  - `sendContactRequest` — Sender-Insert (RLS `cr_insert_self_prime`: from_id=self + Prime+).
 *  - `respondToContactRequest` — Empfänger setzt `status` accepted/declined
 *    (RLS `cr_update_recipient`: nur to_id).
 *  - lesende Anreicherung über `profiles_public` / `profile_contacts` / `matches`.
 *
 * ALLE Folgewirkungen laufen serverseitig im Trigger `contact_requests_lifecycle`
 * (Migration 20260614100000), weil der Client sie unter RLS nicht ausführen darf:
 *  - `matches.status` → requested/accepted/declined (kein Client-UPDATE auf matches),
 *  - `message_threads` bei accepted (Chat-Freigabe),
 *  - `notifications` für das Gegenüber (`notifications_own` erlaubt nur eigene Zeilen).
 *
 * Kontaktdaten (`profile_contacts`) werden NIE vor `accepted` sichtbar — das
 * garantiert die RLS (`contacts_select_self_or_released`), nicht dieses Modul.
 */

// ── Senden (Sender-Seite, §6.1) ───────────────────────────────────────────────
export interface SendContactRequestInput {
  fromId: string;
  toId: string;
  /** Zugehöriges Match (aus dem Hub). Von der Profilseite ggf. `null`. */
  matchId: string | null;
  message: string;
}

export async function sendContactRequest(input: SendContactRequestInput): Promise<void> {
  const { error } = await supabase.from("contact_requests").insert({
    from_id: input.fromId,
    to_id: input.toId,
    match_id: input.matchId,
    message: input.message.trim() || null,
  });
  if (error) throw error;
}

// ── Annehmen / Ablehnen (Empfänger-Seite, §6.2–6.4) ───────────────────────────
export async function respondToContactRequest(input: {
  requestId: string;
  accept: boolean;
}): Promise<void> {
  const { error } = await supabase
    .from("contact_requests")
    .update({ status: input.accept ? "accepted" : "declined" })
    .eq("id", input.requestId);
  if (error) throw error;
}

// ── „Meine Anfragen" — eingehende offene Anfragen (Dashboard, §6.2) ────────────
export interface IncomingRequest {
  id: string;
  message: string | null;
  created_at: string;
  from: {
    id: string;
    name: string;
    avatar_url: string | null;
    company: string | null;
    region: string | null;
  };
}

export const incomingRequestsQueryKey = (uid: string) =>
  ["contact-requests", "incoming", uid] as const;

/**
 * Lädt die offenen eingehenden Anfragen (`to_id = uid`, `status = 'pending'`) und
 * reichert den Absender über `profiles_public` an. RLS `cr_select_participants`
 * gibt nur Zeilen mit eigener Beteiligung frei.
 */
export async function fetchIncomingRequests(uid: string): Promise<IncomingRequest[]> {
  const { data, error } = await supabase
    .from("contact_requests")
    .select("id, message, created_at, from_id")
    .eq("to_id", uid)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const fromIds = [...new Set(rows.map((r) => r.from_id))];
  const profilesRes = await supabase
    .from("profiles_public")
    .select("id, name, avatar_url, company, region")
    .in("id", fromIds);
  if (profilesRes.error) throw profilesRes.error;

  const byId = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  return rows.map((r) => {
    const p = byId.get(r.from_id);
    return {
      id: r.id,
      message: r.message,
      created_at: r.created_at,
      from: {
        id: r.from_id,
        name: p?.name ?? "Mitglied",
        avatar_url: p?.avatar_url ?? null,
        company: p?.company ?? null,
        region: p?.region ?? null,
      },
    };
  });
}

// ── Kontaktbeziehung für eine Profilseite (§6.1/§6.3, Kontaktdaten-Freigabe) ───
export interface RelevantRequest {
  id: string;
  status: string;
  /** True, wenn ICH die Anfrage gestellt habe (sonst hat das Gegenüber angefragt). */
  outgoing: boolean;
}

export interface ContactRelation {
  /** Bestehende Anfrage zwischen Betrachter und Profil (stärkste Richtung) oder null. */
  request: RelevantRequest | null;
  /**
   * Kontaktdaten des Gegenübers — von der RLS NUR bei akzeptierter Anfrage
   * zurückgegeben. `null` = nicht freigegeben; ein Objekt (auch mit leeren Feldern)
   * = freigegeben.
   */
  /**
   * Die freigegebene Kontaktzeile — seit AGE-537 samt Anschrift. Sie kommt
   * NICHT von einer eigenen Regel: dieselbe Policy
   * `contacts_select_self_or_released` gibt die ganze Zeile frei oder gar
   * nichts, weshalb eine Auswahl nur der Adressspalten ebenso leer bliebe.
   */
  contact: {
    email: string | null;
    phone: string | null;
    street: string | null;
    postal_code: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  } | null;
  /** Match zwischen beiden (liefert die `match_id` der Anfrage), falls vorhanden. */
  matchId: string | null;
}

export const contactRelationQueryKey = (viewerId: string, profileId: string) =>
  ["contact-relation", viewerId, profileId] as const;

const CR_RANK: Record<string, number> = { accepted: 3, pending: 2, declined: 1 };

/**
 * Wählt aus den (selten beidseitigen) Anfragen eines Paares deterministisch die
 * „stärkste" Zeile: accepted > pending > declined. So hängt der angezeigte Status
 * nicht von der Zeilenreihenfolge ab. Rein & getestet.
 */
export function pickRelevantRequest(
  rows: { id: string; from_id: string; to_id: string; status: string }[],
  viewerId: string,
): RelevantRequest | null {
  let best: RelevantRequest | null = null;
  for (const r of rows) {
    const cand: RelevantRequest = { id: r.id, status: r.status, outgoing: r.from_id === viewerId };
    if (!best || (CR_RANK[cand.status] ?? 0) > (CR_RANK[best.status] ?? 0)) {
      best = cand;
    }
  }
  return best;
}

/**
 * Lädt die Kontaktbeziehung zwischen Betrachter und Profil: eine bestehende Anfrage
 * (beide Richtungen), die — nur bei `accepted` von der RLS freigegebenen —
 * Kontaktdaten und ein evtl. vorhandenes Match (für die `match_id` beim Senden).
 */
export async function fetchContactRelation(
  viewerId: string,
  profileId: string,
): Promise<ContactRelation> {
  const requestPair =
    `and(from_id.eq.${viewerId},to_id.eq.${profileId}),` +
    `and(from_id.eq.${profileId},to_id.eq.${viewerId})`;
  const matchPair =
    `and(a_profile_id.eq.${viewerId},b_profile_id.eq.${profileId}),` +
    `and(a_profile_id.eq.${profileId},b_profile_id.eq.${viewerId})`;

  const [crRes, contactRes, matchRes] = await Promise.all([
    supabase.from("contact_requests").select("id, from_id, to_id, status").or(requestPair),
    supabase
      .from("profile_contacts")
      .select("email, phone, street, postal_code, city, state, country")
      .eq("profile_id", profileId)
      .maybeSingle(),
    supabase.from("matches").select("id").or(matchPair).maybeSingle(),
  ]);
  if (crRes.error) throw crRes.error;
  if (contactRes.error) throw contactRes.error;
  if (matchRes.error) throw matchRes.error;

  return {
    request: pickRelevantRequest(crRes.data ?? [], viewerId),
    contact: contactRes.data
      ? {
          email: contactRes.data.email,
          phone: contactRes.data.phone,
          street: contactRes.data.street,
          postal_code: contactRes.data.postal_code,
          city: contactRes.data.city,
          state: contactRes.data.state,
          country: contactRes.data.country,
        }
      : null,
    matchId: matchRes.data?.id ?? null,
  };
}
