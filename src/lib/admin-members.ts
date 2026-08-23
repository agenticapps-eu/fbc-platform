import { supabase } from "./supabase";
import type { Database } from "./database.types";

/**
 * Die Admin-Mitgliederliste (AGE-566).
 *
 * ALLES hier geht über die RPC `admin_list_members`, nichts über einen direkten
 * Tabellenzugriff — und zwar aus demselben Grund, aus dem es die Funktion
 * überhaupt gibt: `profiles_select_self_or_discover` und `profiles_public`
 * verlangen beide ein BESTÄTIGTES Zielprofil. Ein importiertes, noch
 * unbestätigtes Mitglied ist über jeden anderen Lesepfad für niemanden
 * sichtbar, auch nicht für einen Admin — und genau diese Mitglieder sind der
 * Anlass dieser Fläche.
 *
 * Die Grenze steht in der Datenbank (`is_admin()` im Rumpf der Funktion), nicht
 * hier. Was hier steht, ist Bequemlichkeit.
 */

export type AdminMember = Database["public"]["Functions"]["admin_list_members"]["Returns"][number];

/** Die drei Werte, die `p_status` kennt. Ein vierter bricht in der Datenbank ab. */
export type AdminMemberStatus = "alle" | "aktiviert" | "offen";

export interface AdminMemberFilters {
  query: string;
  status: AdminMemberStatus;
  /** Nullbasiert. */
  seite: number;
}

export interface AdminMemberPage {
  members: AdminMember[];
  hatWeitere: boolean;
}

/**
 * Wie viele Mitglieder eine Seite zeigt.
 *
 * Blättern steht von Anfang an drin, obwohl es bei 70 Datensätzen noch nichts
 * bringt: die Signatur später zu ändern, wenn sie Aufrufer hat, kostet mehr,
 * als sie jetzt richtig zu setzen.
 */
export const SEITENGROESSE = 25;

export const adminMembersQueryKey = (f: AdminMemberFilters) =>
  ["admin-members", f.query, f.status, f.seite] as const;

/**
 * Eine Seite der Mitgliederliste.
 *
 * Es wird EINE Zeile mehr angefordert als angezeigt. Die RPC liefert keine
 * Gesamtzahl, und eine zweite, zählende Abfrage wäre ein zweiter Weg an
 * dieselben Daten — mit der Möglichkeit, dass beide sich widersprechen. Kommt
 * die Zusatzzeile zurück, gibt es eine Folgeseite; angezeigt wird sie nicht.
 *
 * Wirft bei einem Fehler, statt eine leere Liste zu liefern. Eine leere Liste
 * hiesse „keine Mitglieder" — und genau so sieht auch ein fehlgeschlagener
 * Import aus. „Keine Mitglieder" hat in diesem Projekt ohnehin schon zwei
 * ununterscheidbare Ursachen (der Rang des Aufrufers und `activated_at` der
 * Zielzeilen); eine dritte, stumme braucht es nicht.
 */
export async function fetchAdminMembers(f: AdminMemberFilters): Promise<AdminMemberPage> {
  const { data, error } = await supabase.rpc("admin_list_members", {
    // Leeres Suchfeld heisst „kein Filter", nicht „suche den leeren Text".
    p_query: f.query.trim() === "" ? null : f.query.trim(),
    p_status: f.status,
    p_limit: SEITENGROESSE + 1,
    p_offset: f.seite * SEITENGROESSE,
  });
  if (error) throw error;

  const zeilen = (data ?? []) as AdminMember[];
  return {
    members: zeilen.slice(0, SEITENGROESSE),
    hatWeitere: zeilen.length > SEITENGROESSE,
  };
}

/**
 * Aktiviert ein Mitglied unmittelbar — der Ausnahmeweg neben dem Zugangslink.
 *
 * Geht über `admin_activate_member` und NICHT über `mark_activated`: die zweite
 * prüft `is_admin()` bewusst nicht (sie gehört dem Einlöseweg mit
 * `service_role`) und schreibt keine Spur. Die erste tut beides, in einer
 * Transaktion.
 *
 * Die Handlung ist durch die Anwendung nicht umkehrbar — es gibt keinen
 * Rücksetzweg. Deshalb steht vor ihr eine namentliche Rückfrage, und deshalb
 * wirft diese Funktion, statt einen Fehlschlag zu schlucken.
 */
export async function activateMember(id: string): Promise<void> {
  const { error } = await supabase.rpc("admin_activate_member", { target: id });
  if (error) throw error;
}

/** Die vier Handlungen, die `admin-set-member-ban` kennt. */
export type LebenszyklusHandlung = "disable" | "enable" | "delete" | "restore";

export interface BanErgebnis {
  /**
   * Wahr, wenn nur die HÄLFTE gelang: das Mitglied ist unsichtbar, kann sich
   * aber weiterhin anmelden (oder umgekehrt entbannt, aber noch gesperrt).
   */
  halb: boolean;
}

/**
 * Der einzige Weg der Oberfläche zu den vier Lebenszyklus-Handlungen.
 *
 * NICHT über `supabase.rpc`: die vier RPCs sind nur die eine Hälfte der Sperre.
 * Die andere ist `banned_until` in `auth.users`, und die setzt allein die Edge
 * Function mit dem `service_role`-Schlüssel. Ein direkter RPC-Aufruf von hier
 * ergäbe ein Profil, das aus dem Verzeichnis verschwindet und sich weiterhin
 * anmeldet.
 *
 * `grund` wird nicht mitgegeben. Die RPCs führen ihn als `default null`, und
 * diese Fläche hat kein Feld dafür — ein Parameter ohne Aufrufer, benannt statt
 * verschwiegen.
 *
 * DER TEILZUSTAND IST KEIN `error`. Die Function antwortet auf ihn mit `207`,
 * und supabase-js behandelt jedes 2xx als Erfolg — `error` bliebe null. Die
 * Unterscheidung hängt deshalb am Rumpf, und zwar an BEIDEN Feldern: `banned`
 * allein reicht nicht, weil ein gelungenes „reaktivieren" ebenfalls
 * `banned: false` liefert. Genau `hidden && !banned` kommt in keinem der beiden
 * Erfolgsfälle vor — Schliessen gelingt als `{hidden, banned}`, Öffnen als
 * `{!hidden, !banned}`.
 */
export async function setMemberBan(
  action: LebenszyklusHandlung,
  target: string,
): Promise<BanErgebnis> {
  const { data, error } = await supabase.functions.invoke("admin-set-member-ban", {
    body: { action, target },
  });
  if (error) throw error;

  const rumpf = (data ?? {}) as { hidden?: boolean; banned?: boolean };
  return { halb: rumpf.hidden === true && rumpf.banned === false };
}
