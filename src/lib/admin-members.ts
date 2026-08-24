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

/**
 * Die fünf Werte, die `p_status` kennt. Ein sechster bricht in der Datenbank
 * mit `22023` ab.
 *
 * Es sind NICHT die fünf Reiter der Fläche: `aktiviert` hat keinen, und
 * „Mitgliedschaft" ist ein Darstellungsmodus über `alle`. Die Abbildung steht
 * in `AdminMitgliederPage.tsx` und ist dort ausgeschrieben, nicht vermutet.
 */
export type AdminMemberStatus = "alle" | "aktiviert" | "offen" | "deaktiviert" | "geloescht";

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
 * Die Aktion ist durch die Anwendung nicht umkehrbar — es gibt keinen
 * Rücksetzweg. Deshalb steht vor ihr eine namentliche Rückfrage, und deshalb
 * wirft diese Funktion, statt einen Fehlschlag zu schlucken.
 */
export async function activateMember(id: string): Promise<void> {
  const { error } = await supabase.rpc("admin_activate_member", { target: id });
  if (error) throw error;
}

/** Die vier Aktionen, die `admin-set-member-ban` kennt. */
export type LebenszyklusAktion = "disable" | "enable" | "delete" | "restore";

export interface BanErgebnis {
  /** Wahr, wenn nur die HÄLFTE gelang — siehe die Invariante unten. */
  halb: boolean;
  /** Ob das Mitglied danach noch verborgen ist. Trägt beim Wiederherstellen
   *  die Auskunft „bleibt deaktiviert". */
  verborgen: boolean;
}

/**
 * Der einzige Weg der Oberfläche zu den vier Lebenszyklus-Aktionen.
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
 * FEHLER WERDEN ÜBERSETZT. supabase-js verpackt jedes Nicht-2xx in einen
 * `FunctionsHttpError` mit der immer gleichen Meldung „Edge Function returned a
 * non-2xx status code"; Status und `detail` stecken nur in `error.context`.
 * Ungelesen sähe ein Admin also genau diesen englischen Satz — und „darf
 * nicht", „gibt es nicht" und „ist schon so" wären ununterscheidbar, obwohl
 * `statusFuerPgFehler` in der Function sie ausdrücklich auseinanderhält.
 * Gefunden in der Diff-Prüfung.
 *
 * DER TEILZUSTAND IST KEIN `error`. Die Function antwortet auf ihn mit `207`,
 * und supabase-js behandelt jedes 2xx als Erfolg — `error` bliebe null. Die
 * Unterscheidung hängt deshalb am Rumpf.
 *
 * DAS KRITERIUM IST EINE INVARIANTE, KEINE FALLUNTERSCHEIDUNG: verborgen und
 * gesperrt gehören zusammen. Wer nicht mehr sichtbar ist, darf sich nicht
 * anmelden können; wer wieder dabei ist, darf nicht ausgesperrt sein. Ein
 * halber Zustand ist genau die Verletzung dieser Gleichung, aus welcher
 * Richtung auch immer.
 *
 * `hidden && !banned` — die erste Fassung — sah nur die eine Hälfte. Seit die
 * Datenbank beim Öffnen zuerst kommt (24.08.), gibt es auch die andere:
 * sichtbar, aber ausgesperrt. Die hätte sie als Erfolg durchgehen lassen.
 */
export async function setMemberBan(
  action: LebenszyklusAktion,
  target: string,
): Promise<BanErgebnis> {
  const { data, error } = await supabase.functions.invoke("admin-set-member-ban", {
    body: { action, target },
  });
  if (error) throw new Error(await uebersetzeFehler(error));

  const rumpf = (data ?? {}) as { hidden?: boolean; banned?: boolean };
  return { halb: rumpf.hidden !== rumpf.banned, verborgen: rumpf.hidden === true };
}

/**
 * Macht aus dem Statuscode der Function einen Satz, den ein Admin lesen kann.
 *
 * `409` ist der häufigste Ausgang und der einzige, der kein Fehler im
 * eigentlichen Sinn ist: die Zeile war schon in dem Zustand, in den sie
 * gebracht werden sollte — meist, weil jemand anderes schneller war.
 */
async function uebersetzeFehler(error: unknown): Promise<string> {
  const context = (error as { context?: Response }).context;
  const status = context?.status;
  const satz: Record<number, string> = {
    400: "Die Anfrage war unbrauchbar. Das ist ein Fehler dieser Fläche, nicht deiner.",
    403: "Dafür fehlt die Berechtigung — oder das eigene Konto ist nicht mehr freigeschaltet.",
    404: "Dieses Mitglied gibt es nicht mehr.",
    409: "Die Zeile ist schon in diesem Zustand. Die Liste zeigt ihn gleich neu.",
    502: "Der Anmeldedienst antwortet nicht. Es hat sich nichts geändert — noch einmal versuchen.",
  };
  if (status !== undefined && satz[status]) return satz[status];

  // Kein bekannter Status: den Rumpf lesen, bevor die generische Meldung von
  // supabase-js übrig bleibt. `context.json()` kann fehlschlagen (leerer Rumpf,
  // schon gelesen) — dann bleibt der Rohtext, und der ist immer noch mehr als
  // „non-2xx status code".
  try {
    const rumpf = (await context?.json()) as { detail?: string; error?: string } | undefined;
    const detail = rumpf?.detail ?? rumpf?.error;
    if (detail) return detail;
  } catch {
    // Leerer oder bereits gelesener Rumpf — dann bleibt die Rohmeldung, und
    // die ist immer noch mehr als nichts.
  }
  return (error as { message?: string }).message ?? "Unbekannter Fehler.";
}

/**
 * Die acht Zahlungsarten (AGE-581) — und die Liste ist hier eine ABBILDUNG auf
 * Beschriftungen, nicht die Regel selbst. Die Regel steht als `check`-Bedingung
 * auf `profile_legacy.payment_type`: eine Zahlungsart, die nur ein Auswahlfeld
 * kennt, ist beim nächsten Skript ein freier Text.
 *
 * `null` heisst NICHT ERFASST und ist kein neunter Wert. Im Auswahlfeld trägt es
 * die leere Kennung — „nicht erfasst" ist eine Auskunft, keine Zahlungsart.
 */
export const ZAHLUNGSARTEN: { id: string; label: string }[] = [
  { id: "rechnung", label: "Rechnung" },
  { id: "stripe", label: "Stripe" },
  { id: "copecart", label: "CopeCart" },
  { id: "paypal", label: "PayPal" },
  { id: "digistore24", label: "Digistore24" },
  { id: "ehren", label: "Ehrenmitglied" },
  { id: "partner", label: "Partner" },
  { id: "offen", label: "Offen" },
];

/**
 * Ändert bezahlt-bis und Zahlungsart eines Mitglieds — und NUR diese beiden.
 *
 * Geht über `admin_update_profile`, weil dort die Weissliste, der `is_admin()`-
 * Riegel und die Spur in `admin_audit` sitzen; ein direkter Tabellenzugriff auf
 * `profile_legacy` hätte keines davon.
 *
 * NICHT über `saveAdminProfile`: die Funktion baut einen Patch aus DREISSIG
 * Feldern und schreibt jedes davon — Name, Anschrift, Rollen, Kompetenzen,
 * Videos. Aus einem Zwei-Felder-Formular räumte sie lautlos alles weg, was die
 * Liste gar nicht kennt. Der Patch hier trägt genau die zwei Schlüssel, die
 * geändert werden sollen; die RPC lässt jedes nicht genannte Feld stehen.
 *
 * Leer heisst `null`, nicht `""`: die Funktion castet `paid_until` nach `date`,
 * und ein leerer Text liesse den Cast scheitern. Für `payment_type` ist es die
 * Unterscheidung zwischen „nicht erfasst" und einem Wert, den die
 * `check`-Bedingung nicht kennt.
 */
export async function updateMitgliedschaft(
  id: string,
  werte: { paid_until: string; payment_type: string },
): Promise<void> {
  const { error } = await supabase.rpc("admin_update_profile", {
    target: id,
    patch: {
      paid_until: werte.paid_until === "" ? null : werte.paid_until,
      payment_type: werte.payment_type === "" ? null : werte.payment_type,
    },
  });
  if (error) throw error;
}
