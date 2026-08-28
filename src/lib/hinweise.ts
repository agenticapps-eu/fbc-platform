import { supabase } from "./supabase";

/**
 * Die Datenschicht der Benachrichtigungs-Glocke (AGE-620).
 *
 * **Warum es das ueberhaupt braucht.** Die Glocke in der Kopfzeile war seit Juni
 * ein toter Knopf — `AppShell.tsx`, kein `onClick`, kein Zaehler — waehrend drei
 * Typen laengst in die Tabelle schrieben (`contact_request`, `_accepted`,
 * `_declined`). Diese Hinweise hat nie jemand zu sehen bekommen.
 *
 * **Keine Migration.** `notifications` traegt `read_at`, die Grants
 * (`select, insert, update, delete` fuer `authenticated`) stehen, und
 * `notifications_own` begrenzt auf aktivierte Mitglieder und die eigene Zeile.
 * Es fehlte ausschliesslich das Frontend.
 *
 * **Die Policy erlaubt mehr, als diese Datei tut.** `notifications_own` ist
 * `for all` — ein Mitglied duerfte sich eigene Zeilen anlegen und loeschen. Die
 * Glocke tut das nicht: sie liest, und sie setzt `read_at`. Mehr steht hier
 * nicht, damit die Fläche schmaler ist als ihr Recht.
 */

export interface Hinweis {
  id: string;
  type: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

/** Eine Grenze gehoert in die ERSTE Fassung jeder listenden Flaeche, nicht in
 *  die zweite. In der Startwoche aktivieren sich rund 70 Mitglieder nacheinander
 *  — ohne Grenze zoege die Glocke sie alle auf einmal. */
const GRENZE = 50;

/** Nachrichten liegen VOR dem Eindampfen einzeln vor: seit `20260828200000`
 *  legt der Trigger eine Zeile je Nachricht an, weil am INSERT der Push haengt.
 *  Eine eigene, groessere Grenze — sonst verdraengte ein einziger
 *  vielbeschriebener Faden die uebrigen Typen aus der Liste. */
const NACHRICHTEN_GRENZE = 200;

const SPALTEN = "id, type, payload, created_at";

export function hinweiseQueryKey(uid: string) {
  // An der Kennung, nicht global: sonst zeigte nach einem Kontowechsel der
  // Zaehler des Vorgaengers weiter.
  return ["hinweise", uid] as const;
}

function faden(h: Hinweis): string | null {
  const wert = h.payload?.["thread_id"];
  return h.type === "message" && typeof wert === "string" && wert ? wert : null;
}

/**
 * ZWEI Abfragen, nicht eine — und das ist der Kern dieser Funktion (AGE-641).
 *
 * Die Zusammenfassung je Gespraech stand bis zum 28.08. im Trigger. Dort war
 * sie falsch: am selben INSERT haengt `notifications_push_webhook`, eine
 * unterdrueckte Zeile machte das Telefon fuer den Faden dauerhaft stumm. Sie
 * gehoert in die ANZEIGE, also hierher.
 *
 * Die Grenze greift dabei VOR dem Eindampfen. Laegen beide Sorten in einer
 * Abfrage, koennte ein Faden mit fuenfzig ungelesenen Nachrichten eine
 * Kontaktanfrage von gestern aus der Liste draengen — und niemandem fiele auf,
 * dass sie je da war. Deshalb holt jede Sorte ihre eigenen Zeilen.
 */
export async function fetchHinweise(): Promise<Hinweis[]> {
  const [andere, nachrichten] = await Promise.all([
    supabase
      .from("notifications")
      .select(SPALTEN)
      .is("read_at", null)
      // `neq` allein liesse Zeilen ohne Typ fallen — `null <> 'message'` ist in
      // SQL nicht wahr, sondern null. Die Spalte ist nullable.
      .or("type.neq.message,type.is.null")
      .order("created_at", { ascending: false })
      .limit(GRENZE),
    supabase
      .from("notifications")
      .select(SPALTEN)
      .is("read_at", null)
      .eq("type", "message")
      .order("created_at", { ascending: false })
      .limit(NACHRICHTEN_GRENZE),
  ]);
  // Weiterwerfen, nicht verschlucken: ein stiller Fehler saehe aus wie „nichts
  // ungelesen", und das faellt niemandem auf.
  if (andere.error) throw andere.error;
  if (nachrichten.error) throw nachrichten.error;

  // Absteigend sortiert — der erste Treffer je Faden ist damit der neueste.
  const jeFaden = new Map<string, Hinweis>();
  for (const h of (nachrichten.data ?? []) as Hinweis[]) {
    const schluessel = faden(h) ?? h.id;
    if (!jeFaden.has(schluessel)) jeFaden.set(schluessel, h);
  }

  return [...((andere.data ?? []) as Hinweis[]), ...jeFaden.values()]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, GRENZE);
}

/**
 * `'now'` ist ein Sonderwert von Postgres und ergibt die Zeit der SERVER-
 * Transaktion. Bewusst NICHT `new Date().toISOString()`: das schickte die Uhr
 * des Besuchers mit, und genau daran ist in AGE-583 ein Lesestand vor die
 * Nachricht gerutscht, die er als gelesen erklaerte.
 *
 * Ein Trigger, der den Wert serverseitig ueberschreibt, waere die haerteste
 * Fassung — er kostete aber eine Migration, und die braucht die Glocke sonst
 * nicht. `'now'` loest der Server, nicht der Client; das genuegt hier, weil an
 * `read_at` kein Vergleich gegen eine zweite Uhr haengt.
 */
const SERVERZEIT = "now";

/**
 * Nimmt den HINWEIS, nicht seine Kennung — weil ein Nachrichten-Eintrag in der
 * Liste fuer alle ungelesenen Zeilen seines Fadens steht.
 *
 * Wuerde hier nur die eine Zeile markiert, taeuchte der eingedampfte Eintrag
 * sofort wieder auf, mit der naechstaelteren Zeile desselben Fadens. Die
 * Glocke liesse sich dann Nachricht fuer Nachricht abarbeiten, obwohl sie eine
 * einzige Zeile zeigt.
 */
export async function markiereHinweisGelesen(h: Hinweis): Promise<void> {
  const thread = faden(h);
  const abfrage = supabase.from("notifications").update({ read_at: SERVERZEIT });
  const { error } = thread
    ? await abfrage.eq("type", "message").eq("payload->>thread_id", thread).is("read_at", null)
    : await abfrage.eq("id", h.id);
  if (error) throw error;
}

export async function markiereAlleGelesen(): Promise<void> {
  // EIN Aufruf, nicht einer je Zeile. Die RLS begrenzt ihn ohnehin auf die
  // eigenen Zeilen — ein `eq("profile_id", …)` waere eine zweite, schwaechere
  // Kopie derselben Bedingung.
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: SERVERZEIT })
    .is("read_at", null);
  if (error) throw error;
}
