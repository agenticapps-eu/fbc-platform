import { supabase } from "./supabase";

/**
 * Kontaktanfragen — Sender-Seite (gestartet aus dem Matching-Hub, AGE-246 §5/§6.1).
 *
 * Hier wird NUR die Anfrage erzeugt (`contact_requests`-INSERT). Die RLS-Policy
 * `cr_insert_self_prime` erlaubt das ausschließlich für `from_id = auth.uid()` und
 * Prime+. Der Rest des Flows ist AGE-247 und bewusst NICHT hier:
 *  - Empfänger-Posteingang + Annehmen/Ablehnen (`cr_update_recipient`),
 *  - `matches.status → requested/accepted` (serverseitiger Trigger/RPC — der Client
 *    hat absichtlich keine UPDATE-Policy auf `matches`),
 *  - `message_threads` + Chat-Freigabe, Kontaktdaten-Sichtbarkeit, Resend-E-Mail.
 *
 * Kontaktdaten werden nie vor `accepted` sichtbar — das garantiert die RLS, nicht
 * dieses Modul.
 */
export interface SendContactRequestInput {
  fromId: string;
  toId: string;
  matchId: string;
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
