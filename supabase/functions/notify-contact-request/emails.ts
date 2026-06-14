// Pure email logic for the notify-contact-request Edge Function (AGE-247, spec §7).
//
// Everything here is side-effect-free so it can be unit-tested with `deno test`
// (see emails.test.ts): the webhook→email-type decision and the three HTML
// templates. All I/O (DB reads, Resend send) lives in index.ts.
//
// Brand: schwarz & gold (docs/design-system.md). Table-based, inline-styled HTML
// so it survives email clients.

/** A contact_requests row, as delivered in a Supabase Database Webhook payload. */
export interface ContactRequestRow {
  id: string;
  from_id: string;
  to_id: string;
  match_id: string | null;
  message: string | null;
  status: "pending" | "accepted" | "declined";
  created_at: string;
}

/** Supabase Database Webhook envelope for contact_requests. */
export interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: ContactRequestRow | null;
  old_record: ContactRequestRow | null;
}

export type NotificationKind = "new_request" | "accepted" | "declined";

/**
 * Which email (if any) a webhook event should trigger, and who receives it.
 * `recipientId` is the profile we email; `otherId` is the counterparty named in
 * the copy. Returns null when the event warrants no email.
 *
 * Mirrors the in-app notifications written by the contact_requests_lifecycle
 * trigger (migration 20260614100000): recipient on INSERT, sender on accept/decline.
 */
export function selectNotification(payload: WebhookPayload): {
  kind: NotificationKind;
  recipientId: string;
  otherId: string;
  request: ContactRequestRow;
} | null {
  const row = payload.record;
  if (!row) return null;

  if (payload.type === "INSERT") {
    // New request → tell the recipient about the sender.
    return { kind: "new_request", recipientId: row.to_id, otherId: row.from_id, request: row };
  }

  if (payload.type === "UPDATE") {
    // React only to an actual status change (mirrors the lifecycle trigger).
    if (payload.old_record && payload.old_record.status === row.status) return null;
    if (row.status === "accepted") {
      return { kind: "accepted", recipientId: row.from_id, otherId: row.to_id, request: row };
    }
    if (row.status === "declined") {
      return { kind: "declined", recipientId: row.from_id, otherId: row.to_id, request: row };
    }
  }

  return null;
}

/** Minimal HTML-entity escape — names and messages are member-controlled. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const GOLD = "#c8a24b";
const INK = "#0d0d0d";
const PAPER = "#111111";

/** Shared dark/gold shell. `bodyHtml` is trusted (already escaped by callers). */
function layout(opts: {
  heading: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
}): string {
  const button = opts.cta
    ? `<tr><td style="padding:8px 0 4px;">
         <a href="${escapeHtml(opts.cta.url)}"
            style="display:inline-block;background:${GOLD};color:${INK};text-decoration:none;
                   font-weight:600;padding:12px 22px;border-radius:6px;font-size:15px;">
           ${escapeHtml(opts.cta.label)}
         </a></td></tr>`
    : "";

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:${INK};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${INK};padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:520px;background:${PAPER};border:1px solid #232323;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 32px;border-bottom:1px solid #232323;">
          <span style="color:${GOLD};font-size:18px;font-weight:700;letter-spacing:0.04em;">FAIR BUSINESS CLUB</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="color:#f5f0e1;font-size:22px;font-weight:700;padding-bottom:14px;">${escapeHtml(opts.heading)}</td></tr>
            <tr><td style="color:#cfcabd;font-size:15px;line-height:1.6;">${opts.bodyHtml}</td></tr>
            ${button}
          </table>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #232323;color:#6f6a5e;font-size:12px;line-height:1.5;">
          Du erhältst diese E-Mail, weil du Mitglied im Fair Business Club bist.
          Kontaktdaten werden nie automatisch geteilt — nur nach deiner ausdrücklichen Zustimmung.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** "Neue Kontaktanfrage von {Name}" — to the recipient. */
export function renderNewRequest(opts: {
  fromName: string;
  message: string | null;
  appUrl?: string;
}): RenderedEmail {
  const from = opts.fromName?.trim() || "Ein Mitglied";
  const subject = `Neue Kontaktanfrage von ${from}`;
  const messageBlock = opts.message?.trim()
    ? `<p style="margin:0 0 16px;">Persönliche Nachricht:</p>
       <blockquote style="margin:0 0 16px;padding:12px 16px;border-left:3px solid ${GOLD};
         background:#0d0d0d;color:#e7e2d4;border-radius:0 6px 6px 0;">${escapeHtml(opts.message.trim())}</blockquote>`
    : "";
  const bodyHtml =
    `<p style="margin:0 0 16px;"><strong style="color:#f5f0e1;">${escapeHtml(from)}</strong> möchte mit dir in Kontakt treten.</p>` +
    messageBlock +
    `<p style="margin:0 0 16px;">Nimm die Anfrage in deinem Bereich an, um den Chat und die Kontaktdaten freizugeben.</p>`;
  const html = layout({
    heading: "Neue Kontaktanfrage",
    bodyHtml,
    cta: opts.appUrl ? { label: "Anfrage ansehen", url: opts.appUrl } : undefined,
  });
  const text =
    `${from} möchte mit dir in Kontakt treten.` +
    (opts.message?.trim() ? `\n\nNachricht: ${opts.message.trim()}` : "") +
    `\n\nNimm die Anfrage in deinem Bereich an, um Chat und Kontaktdaten freizugeben.` +
    (opts.appUrl ? `\n${opts.appUrl}` : "");
  return { subject, html, text };
}

/** "Deine Anfrage wurde angenommen" — to the sender, with chat link. */
export function renderAccepted(opts: { toName: string; appUrl?: string }): RenderedEmail {
  const to = opts.toName?.trim() || "Das Mitglied";
  const subject = "Deine Kontaktanfrage wurde angenommen";
  const bodyHtml =
    `<p style="margin:0 0 16px;"><strong style="color:#f5f0e1;">${escapeHtml(to)}</strong> hat deine Kontaktanfrage angenommen.</p>` +
    `<p style="margin:0 0 16px;">Der Chat ist jetzt frei und die Kontaktdaten sind für euch beide sichtbar.</p>`;
  const html = layout({
    heading: "Anfrage angenommen",
    bodyHtml,
    cta: opts.appUrl ? { label: "Zum Chat", url: opts.appUrl } : undefined,
  });
  const text =
    `${to} hat deine Kontaktanfrage angenommen. Der Chat ist jetzt frei und die Kontaktdaten sind sichtbar.` +
    (opts.appUrl ? `\n\nZum Chat: ${opts.appUrl}` : "");
  return { subject, html, text };
}

/** Optional "abgelehnt" — to the sender. */
export function renderDeclined(opts: { toName: string }): RenderedEmail {
  const to = opts.toName?.trim() || "Das Mitglied";
  const subject = "Deine Kontaktanfrage wurde nicht angenommen";
  const bodyHtml =
    `<p style="margin:0 0 16px;"><strong style="color:#f5f0e1;">${escapeHtml(to)}</strong> hat deine Kontaktanfrage diesmal nicht angenommen.</p>` +
    `<p style="margin:0;">Es werden keine Kontaktdaten geteilt. Im Matching-Hub findest du weitere passende Kontakte.</p>`;
  const html = layout({ heading: "Anfrage nicht angenommen", bodyHtml });
  const text = `${to} hat deine Kontaktanfrage diesmal nicht angenommen. Es werden keine Kontaktdaten geteilt.`;
  return { subject, html, text };
}
