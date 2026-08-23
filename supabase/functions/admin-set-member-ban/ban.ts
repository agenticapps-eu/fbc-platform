// Reine Logik von admin-set-member-ban (AGE-581) — ohne Netz und ohne Deno.env,
// damit sie ohne laufende Plattform prüfbar ist. Muster: change-email.ts.

export type BanAction = "disable" | "enable" | "delete" | "restore";

export interface BanRequest {
  action: BanAction;
  target: string;
  /** Nur die schliessenden Handlungen kennen einen Grund; leer heisst keiner. */
  grund: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AKTIONEN: readonly BanAction[] = ["disable", "enable", "delete", "restore"];

/**
 * Liest den Rumpf des Aufrufs. `null` heisst unbrauchbar — der Aufrufer
 * antwortet dann mit 400.
 *
 * Eine unbekannte Handlung wird NICHT stillschweigend als „disable" gelesen:
 * eine vertippte Handlung, die trotzdem etwas tut, ist schlimmer als eine, die
 * abbricht. Dieselbe Regel wie bei `p_status` in `admin_list_members`.
 */
export function parseBanRequest(body: unknown): BanRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { action, target, grund } = body as Record<string, unknown>;
  if (typeof action !== "string" || !AKTIONEN.includes(action as BanAction)) return null;
  if (typeof target !== "string" || !UUID.test(target)) return null;
  const g = typeof grund === "string" ? grund.trim() : "";
  return { action: action as BanAction, target, grund: g === "" ? null : g };
}

/**
 * Schliessen oder öffnen. Davon hängt die REIHENFOLGE ab, und die ist je
 * Richtung eine andere:
 *
 * - **Schliessen** (deaktivieren, löschen): Datenbank zuerst, Bann danach.
 *   Scheitert der Bann, ist das Mitglied unsichtbar und kommt noch herein —
 *   die kleinere Hälfte des Schadens.
 * - **Öffnen** (reaktivieren, wiederherstellen): Bann zuerst, Datenbank danach.
 *   Andersherum wäre das Profil sichtbar, während die Anmeldung noch gesperrt
 *   ist — und die Handlung verschwände aus der Oberfläche, weil die Zeile nicht
 *   mehr als deaktiviert gilt. Der halbe Zustand wäre dann unerreichbar.
 */
export function istSchliessen(action: BanAction): boolean {
  return action === "disable" || action === "delete";
}

/**
 * Was die GoTrue-Admin-API entgegennimmt.
 *
 * Eine DAUER, kein Zeitpunkt — gemessen am 23.08. gegen den lokalen Stack
 * (`scripts/probe-age581-gotrue-ban.ts`): `ban_duration: "876000h"` (hundert
 * Jahre) wird angenommen und setzt `banned_until`; ein `banned_until` liesse
 * sich nicht setzen. Die Umkehrung ist ein eigener Wert (`"none"`), kein
 * Nullwert.
 */
export function banDauerFuer(action: BanAction): string {
  return istSchliessen(action) ? "876000h" : "none";
}

/** Jede Handlung hat ihre eigene Datenbankfunktion; alle vier nur für `service_role`. */
export function rpcNameFuer(action: BanAction): string {
  switch (action) {
    case "disable":
      return "admin_disable_member";
    case "enable":
      return "admin_enable_member";
    case "delete":
      return "admin_delete_member";
    case "restore":
      return "admin_restore_member";
  }
}

/**
 * Die Fehlercodes der vier RPCs in HTTP übersetzt.
 *
 * 500 für alles wäre bequem und falsch: die Fläche kann „darf nicht", „gibt es
 * nicht" und „ist schon so" nur unterscheiden, wenn der Status es tut — und
 * gerade `22023` ist hier der häufigste Ausgang (zweimal dieselbe Handlung).
 */
export function statusFuerPgFehler(code: string | undefined): number {
  switch (code) {
    case "42501":
      return 403;
    case "22023":
      return 409;
    case "P0002":
      return 404;
    default:
      return 500;
  }
}

export interface BanErgebnis {
  status: number;
  body: { hidden: boolean; banned: boolean; detail?: string };
}

/**
 * Fasst zusammen, was nach dem ZWEITEN Schritt gilt.
 *
 * Der zweite Schritt ist in beiden Richtungen der, der einen halben Zustand
 * hinterlassen kann — beim Schliessen der Bann, beim Öffnen die Datenbank. Der
 * erste kann es nicht: scheitert er, hat sich nichts geändert, und der Aufrufer
 * bekommt den übersetzten Fehler.
 *
 * Dass beide Teilfehlschläge auf denselben Rumpf führen, ist kein Zufall: es
 * IST derselbe Zustand, aus zwei Richtungen erreicht — unsichtbar, aber
 * anmeldefähig. `207` und nicht `200`, weil die Oberfläche eine Warnung zeigen
 * muss und keinen Erfolgston: das Mitglied ist nicht mehr sichtbar, kann sich
 * aber weiterhin anmelden, bis der Vorgang wiederholt wird.
 */
export function fasseAusgangZusammen(
  action: BanAction,
  zweiterSchrittFehler: string | null,
): BanErgebnis {
  if (zweiterSchrittFehler !== null) {
    return { status: 207, body: { hidden: true, banned: false, detail: zweiterSchrittFehler } };
  }
  return istSchliessen(action)
    ? { status: 200, body: { hidden: true, banned: true } }
    : { status: 200, body: { hidden: false, banned: false } };
}
