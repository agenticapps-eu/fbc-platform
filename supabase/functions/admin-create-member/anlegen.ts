// Reine Logik von admin-create-member (AGE-927) — ohne Netz und ohne
// Deno.env, damit sie ohne laufende Plattform prüfbar ist. Muster:
// change-email.ts, checkout.ts.

/**
 * Nur die drei Clubstufen. Die drei darunter (`active`, `boost`, `connect`)
 * liegen ausserhalb des FBC und sind keine Wahl — dieselbe Zusage, die seit
 * AGE-903 für „Stufe setzen" gilt. Ein Mitglied, das über Odoo bezahlt hat,
 * dort anzulegen wäre genau der Fehler, den sie verhindert.
 */
export const CLUB_PLAENE = ["discover", "focus", "impact"] as const;
export type ClubPlan = (typeof CLUB_PLAENE)[number];

// Bewusst grob. Die Adresse wird nicht von uns bestätigt, sondern vom
// Anmeldedienst übernommen — eine strenge Prüfung gäbe eine Sicherheit vor,
// die sie nicht hat. Was sie abfängt, sind Tippfehler und leere Felder.
// Dieselbe Begründung wie in change-email.ts.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CreateRequest {
  name: string;
  email: string;
  plan: ClubPlan;
  mailSenden: boolean;
  firma: string | null;
  telefon: string | null;
}

function text(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  // Leer heisst null und nicht "" — ein leerer String in der Spalte sähe aus
  // wie eine erfasste, aber leere Angabe.
  return t === "" ? null : t;
}

/**
 * Liest den Rumpf des Aufrufs. Gibt `null` zurück, wenn er unbrauchbar ist —
 * der Aufrufer antwortet dann mit 400.
 *
 * **Die Adresse wird hier kleingeschrieben, und das ist tragend, nicht
 * bequem.** Der Unique-Index auf `auth.users(email)` ist partiell
 * (`where is_sso_user = false`) UND schreibungsempfindlich; der einzige Index
 * über `lower(email)` ist nicht unique. Ohne diese Zeile entstünde `A@X.de`
 * neben `a@x.de` als zweites Konto — dasselbe Bild, das der WordPress-Import
 * schon erzeugt hat.
 */
export function parseCreateRequest(body: unknown): CreateRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  const vorname = text(b.vorname);
  const nachname = text(b.nachname);
  const email = text(b.email);
  if (!vorname || !nachname || !email) return null;

  const adresse = email.toLowerCase();
  if (!EMAIL.test(adresse)) return null;

  if (typeof b.plan !== "string") return null;
  if (!(CLUB_PLAENE as readonly string[]).includes(b.plan)) return null;

  if (typeof b.mailSenden !== "boolean") return null;

  return {
    name: `${vorname} ${nachname}`,
    email: adresse,
    plan: b.plan as ClubPlan,
    mailSenden: b.mailSenden,
    firma: text(b.firma),
    telefon: text(b.telefon),
  };
}

/** Vergleicht zwei Anmeldeadressen so, wie die Prüfung es zusagt. */
export function gleicheAdresse(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export interface AnlageVerlauf {
  kontoAngelegt: boolean;
  profilGesetzt: boolean;
  mailSenden: boolean;
  versandOk: boolean;
}

export type AnlageErgebnis =
  | { status: "ok"; schritt: "bestaetigungsmail_verschickt" | "ohne_mail_angelegt" }
  | { status: "teilweise"; schritt: "stufe_nicht_gesetzt" | "mail_nicht_verschickt" }
  | { status: "fehlgeschlagen"; schritt: "kein_konto" };

/**
 * Fasst zusammen, wie weit die Anlage gekommen ist.
 *
 * WARUM „teilweise" EIN EIGENER ZUSTAND IST und kein Fehler: Die Reihenfolge
 * ist Teil der Zusage — erst das Konto, dann Name und Stufe, dann die Mail.
 * Scheitert ein späterer Schritt, IST das Konto angelegt. Meldete die Function
 * das als Gesamtfehler, legte der Admin es ein zweites Mal an — und bekäme
 * beim zweiten Versuch „diese Adresse gehört bereits zu …".
 *
 * Ein Rückbau ist deshalb ausgeschlossen: er nähme dem Admin die einzige Spur.
 * Das Konto steht bei `stufe_nicht_gesetzt` in Schritt ① Angelegt auf der
 * Vorgabestufe und ist über „Stufe setzen" zu berichtigen — sichtbar, nicht
 * versteckt.
 *
 * `mail_nicht_verschickt` ist der Fall, in dem das Mitglied trotzdem in ②
 * Eingeladen steht: `issue_activation_token` legt die Tokenzeile an, BEVOR
 * gesendet wird. Wenn die Antwort das nicht sagt, sagt es niemand.
 */
export function zusammenfassen(v: AnlageVerlauf): AnlageErgebnis {
  if (!v.kontoAngelegt) return { status: "fehlgeschlagen", schritt: "kein_konto" };
  if (!v.profilGesetzt) return { status: "teilweise", schritt: "stufe_nicht_gesetzt" };
  if (!v.mailSenden) return { status: "ok", schritt: "ohne_mail_angelegt" };
  return v.versandOk
    ? { status: "ok", schritt: "bestaetigungsmail_verschickt" }
    : { status: "teilweise", schritt: "mail_nicht_verschickt" };
}
