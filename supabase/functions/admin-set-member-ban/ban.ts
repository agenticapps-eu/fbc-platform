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
 * - **Öffnen** (reaktivieren, wiederherstellen): **Datenbank zuerst**, Bann
 *   danach — geändert am 24.08. nach der Diff-Prüfung.
 *
 * Die frühere Ordnung („Bann zuerst") wollte vermeiden, dass ein Profil
 * sichtbar wird, während die Anmeldung noch gesperrt ist. Sie erzeugte dafür
 * zwei Zustände, die das Spec an anderer Stelle ausdrücklich verbietet: Lehnt
 * die RPC ab — „reaktivieren" auf ein GELÖSCHTES Profil bricht mit `22023` ab —,
 * war der Bann schon aufgehoben. Und `admin_restore_member` gibt in `entbannen`
 * zurück, ob überhaupt entbannt werden soll; wer vorher entbannt, kann die
 * Antwort nicht mehr befolgen. Beides ergab ein entferntes Mitglied, das sich
 * anmelden kann.
 *
 * Der Preis ist der umgekehrte halbe Zustand: sichtbar, aber ausgesperrt. Der
 * ist über die Oberfläche erreichbar (deaktivieren, dann reaktivieren) und
 * damit die kleinere Hälfte des Schadens — dieselbe Abwägung wie beim
 * Schliessen, nur andersherum.
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
 * DIE REGEL IST EINE INVARIANTE, KEINE TABELLE: verborgen und gesperrt gehören
 * zusammen. Ein Mitglied, das nicht mehr sichtbar ist, darf sich nicht anmelden
 * können, und eines, das wieder dabei ist, darf nicht ausgesperrt sein. `200`
 * heisst deshalb genau „die beiden Hälften stimmen überein", `207` genau „sie
 * tun es nicht" — welche Hälfte fehlt, sagt der Rumpf.
 *
 * Beim SCHLIESSEN kann der Bann fehlen: unsichtbar, aber anmeldefähig.
 * Beim ÖFFNEN kann die Aufhebung fehlen: sichtbar, aber ausgesperrt. Das ist
 * NICHT derselbe Zustand aus zwei Richtungen — eine frühere Fassung dieser
 * Funktion behauptete das und meldete für beide „unsichtbar und anmeldefähig",
 * also für das Öffnen das Gegenteil der Wahrheit.
 *
 * `sollEntbannen` kommt aus `admin_restore_member`: war das Mitglied vor dem
 * Löschen deaktiviert, bleibt es das danach, und dann ist „verborgen und
 * gesperrt" der RICHTIGE Ausgang und kein halber. `admin_enable_member` kennt
 * die Frage nicht — dort ist es immer `true`.
 */
export function fasseAusgangZusammen(
  action: BanAction,
  sollEntbannen: boolean,
  zweiterSchrittFehler: string | null,
): BanErgebnis {
  const [hidden, banned] = istSchliessen(action)
    ? [true, zweiterSchrittFehler === null]
    : sollEntbannen
      ? [false, zweiterSchrittFehler !== null]
      : // Kein zweiter Schritt: es wurde gar nicht erst entbannt.
        [true, true];

  const body =
    zweiterSchrittFehler === null
      ? { hidden, banned }
      : { hidden, banned, detail: zweiterSchrittFehler };
  return { status: hidden === banned ? 200 : 207, body };
}
