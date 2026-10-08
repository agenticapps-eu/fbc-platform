import { supabase } from "./supabase";
import type { Database } from "./database.types";

/**
 * Der EINE Weg zu den Profilkarten (AGE-1001).
 *
 * `profil_karten` und `gespraechspartner_karten` nehmen höchstens **200**
 * Kennungen je Aufruf und **werfen** darüber (`22023`) — sie schneiden nicht
 * ab. Diese Datei ist die Antwort darauf: sie teilt in Stapel, damit keine
 * Aufrufstelle die Grenze kennen muss.
 *
 * **Warum das nicht „ein bisschen Vorsorge" ist.** Die erste Fassung der
 * Funktionen las `p_ids[1:200]` und schnitt still ab. Zwei Aufrufstellen fragen
 * ungebremst — `fetchEventAttendees` und `fetchAttendees` geben alle
 * Anmeldungen einer Veranstaltung auf einmal hinein. Ab der 201. Kennung wäre
 * dort lautlos „Mitglied" ohne Bild erschienen, und zwar ausgerechnet beim
 * grossen Event. Das abgelöste `.in("id", ids)` hatte diese Grenze nicht; es
 * wäre eine Regression gewesen, die kein Test und kein Fehlerpfad bemerkt.
 * Befund des Code-Reviews auf dem Diff.
 *
 * Die Reihenfolge der Karten ist dabei die der Stapel, nicht die der Eingabe —
 * das war sie vorher auch nicht: jede Aufrufstelle baut sich eine `Map` über
 * die Kennung und ordnet selbst.
 */

type Karte = Database["public"]["Functions"]["profil_karten"]["Returns"][number];

/** Dieselbe Zahl, die die Funktionen werfen lässt. Eine Kopie — aber eine, die
 *  beim Überschreiten einen lauten Fehler erzeugt und keinen stillen. */
const STAPEL = 200;

async function inStapeln(
  funktion: "profil_karten" | "gespraechspartner_karten",
  ids: string[],
): Promise<{ data: Karte[]; error: null } | { data: null; error: { message: string } }> {
  const karten: Karte[] = [];
  for (let i = 0; i < ids.length; i += STAPEL) {
    const { data, error } = await supabase.rpc(funktion, {
      p_ids: ids.slice(i, i + STAPEL),
    });
    if (error) return { data: null, error };
    karten.push(...(data ?? []));
  }
  return { data: karten, error: null };
}

/** Karten zu bekannten Kennungen — mit dem Prädikat der abgelösten Sicht,
 *  einschliesslich `is_public`. */
export const profilKarten = (ids: string[]) => inStapeln("profil_karten", ids);

/** Dieselben Felder OHNE `is_public`, dafür nur für Profile, mit denen der
 *  Aufrufer einen Gesprächsfaden teilt. Nur für den Chat: ein zurückgezogenes
 *  Profil soll dort seinen Namen behalten. */
export const gespraechspartnerKarten = (ids: string[]) =>
  inStapeln("gespraechspartner_karten", ids);
