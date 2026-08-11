// Reine Logik von admin-change-email (AGE-498, C6) — ohne Netz und ohne Deno.env,
// damit sie ohne laufende Plattform prüfbar ist. Muster: checkout.ts.

export interface ChangeEmailRequest {
  target: string;
  email: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Bewusst grob. Die Adresse wird nicht von uns bestätigt, sondern vom
// Anmeldedienst übernommen (email_confirm: true) — eine strenge Prüfung hier
// gäbe eine Sicherheit vor, die sie nicht hat. Was sie abfängt, sind
// Tippfehler und leere Felder.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Liest den Rumpf des Aufrufs. Gibt `null` zurück, wenn er unbrauchbar ist —
 * der Aufrufer antwortet dann mit 400.
 */
export function parseChangeEmailRequest(body: unknown): ChangeEmailRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { target, email } = body as Record<string, unknown>;
  if (typeof target !== "string" || !UUID.test(target)) return null;
  if (typeof email !== "string") return null;
  const trimmed = email.trim();
  if (!EMAIL.test(trimmed)) return null;
  return { target, email: trimmed };
}

export type ChangeEmailOutcome =
  | { status: "ok" }
  | { status: "sessions_not_revoked"; detail: string };

/**
 * Fasst zusammen, was nach der Adressänderung mit den Sitzungen geschah.
 *
 * WARUM DAS EIN EIGENER ZUSTAND IST und kein Fehler: Die Reihenfolge ist Teil
 * der Zusage — erst die Adresse, dann die Sitzungen. Schlägt der zweite Schritt
 * fehl, IST die Adresse geändert. Meldete die Function das als Gesamtfehler,
 * wiederholte der Admin eine Änderung, die längst gilt — und wunderte sich,
 * warum das Mitglied sich mit der „nicht gesetzten" Adresse anmelden kann.
 * Aus dem Fremd-Review zum Change (REVIEWS.md, codex).
 */
export function summarizeOutcome(revokeError: string | null): ChangeEmailOutcome {
  return revokeError === null ? { status: "ok" } : { status: "sessions_not_revoked", detail: revokeError };
}
