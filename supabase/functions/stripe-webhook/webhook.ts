const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

/** Stripe-Signatur über `${t}.${body}` (dokumentierter Algorithmus). */
export function computeSignature(rawBody: string, t: number, secret: string): Promise<string> {
  return hmac(secret, `${t}.${rawBody}`);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyStripeSignature(
  rawBody: string,
  sigHeader: string | null,
  secret: string,
  opts?: { toleranceSec?: number; nowSec?: number },
): Promise<boolean> {
  if (!sigHeader) return false;
  const parts: Record<string, string> = {};
  for (const kv of sigHeader.split(",")) {
    const [k, v] = kv.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const tolerance = opts?.toleranceSec ?? 300;
  const now = opts?.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - t) > tolerance) return false;
  const expected = await computeSignature(rawBody, t, secret);
  return timingSafeEqualHex(expected, v1);
}

/**
 * `checkout.session.completed` heisst „der Kauf ist abgeschlossen", NICHT
 * „bezahlt". Bei verzoegerten Zahlungsarten — SEPA-Lastschrift, Ueberweisung,
 * Sofort — feuert Stripe dieses Event sofort mit `payment_status: "unpaid"`
 * und schickt den Erfolg spaeter als `checkout.session.async_payment_succeeded`.
 * Ohne die Pruefung bekaeme jemand die Stufe in dem Moment, in dem er den Kauf
 * ANSTOESST, und behielte sie auch, wenn die Lastschrift platzt.
 *
 * `no_payment_required` gilt: das ist der Nulltarif-Fall, bei dem Stripe gar
 * keine Zahlung erwartet.
 *
 * Ein FEHLENDES Feld gilt nicht. Stripe schickt es bei jeder Session; fehlt es,
 * ist die Nachricht nicht das, wofuer wir sie halten.
 *
 * OFFEN, nicht hier geloest: eine platzende Lastschrift stuft nicht zurueck —
 * `apply_upgrade` ist bewusst nur-hoeher. Das braucht einen eigenen Weg fuer
 * `charge.dispute.created` / `invoice.payment_failed` (eigenes Issue).
 */
const BEZAHLT = new Set(["paid", "no_payment_required"]);

export function parseCheckoutCompleted(event: unknown): { userId: string; level: string } | null {
  const e = event as {
    type?: string;
    data?: { object?: { payment_status?: string; metadata?: Record<string, string> } };
  };
  if (e?.type !== "checkout.session.completed") return null;
  if (!BEZAHLT.has(e.data?.object?.payment_status ?? "")) return null;
  const md = e.data?.object?.metadata;
  if (!md?.user_id || !md?.level) return null;
  return { userId: md.user_id, level: md.level };
}
