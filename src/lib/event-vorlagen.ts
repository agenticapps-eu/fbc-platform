import { supabase } from "./supabase";
import type { EventType, EventVisibility } from "./events";

/**
 * Event-Vorlagen und Serientermine (AGE-630) — die Client-Seite.
 *
 * Die Wahrheit über Regelformen, Obergrenzen und Cover-Pfade steht in der
 * Datenbank (`event_vorlagen`, `event_serie_slots`, `event_serie_erzeugen`).
 * Was hier steht, ist Komfort davor: Fehler am Feld statt als Constraint-Name
 * im Toast, und die Namensvergabe, die eine RPC nicht übernehmen kann.
 */

export type Wiederholung = "woechentlich" | "monatlich_tag" | "monatlich_n_ter_wochentag";

/**
 * FESTE Liste aus dem Schema, nicht aus dem Bestand — dasselbe Muster wie
 * `EVENT_TYPE_OPTIONS`. Der CHECK auf `event_vorlagen.wiederholung` hält sie
 * fest; `event-vorlagen.regel.test.ts` hält sie am CHECK fest.
 */
export const WIEDERHOLUNG_OPTIONS: { value: Wiederholung; label: string }[] = [
  { value: "woechentlich", label: "Wöchentlich" },
  { value: "monatlich_tag", label: "Monatlich, fester Tag" },
  { value: "monatlich_n_ter_wochentag", label: "Monatlich, n-ter Wochentag" },
];

/** ISO-8601: 1 = Montag … 7 = Sonntag, wie `extract(isodow …)`. */
export const WOCHENTAG_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Montag" },
  { value: 2, label: "Dienstag" },
  { value: 3, label: "Mittwoch" },
  { value: 4, label: "Donnerstag" },
  { value: 5, label: "Freitag" },
  { value: 6, label: "Samstag" },
  { value: 7, label: "Sonntag" },
];

export const POSITION_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "erster" },
  { value: 2, label: "zweiter" },
  { value: 3, label: "dritter" },
  { value: 4, label: "vierter" },
];

/** Die vier Felder, die `event_vorlagen_regelform` miteinander verknüpft. */
export interface VorlageRegel {
  wiederholung: Wiederholung | null;
  wochentag: number | null;
  tagImMonat: number | null;
  wochentagPosition: number | null;
}

/**
 * Spiegelt den CHECK `event_vorlagen_regelform` (Migration 20260906090000:99).
 * Je Regelform ist genau eine Teilmenge der drei Felder gesetzt, der Rest MUSS
 * null sein — auch der `else`-Zweig ohne Wiederholung.
 *
 * Bewusst eine Nachbildung und keine zweite Wahrheit: die Datenbank weist eine
 * falsche Kombination weiterhin ab. Diese Funktion sorgt nur dafür, dass es
 * nicht erst dort passiert.
 */
export function regelVollstaendig(r: VorlageRegel): boolean {
  switch (r.wiederholung) {
    case "woechentlich":
      return r.wochentag != null && r.tagImMonat == null && r.wochentagPosition == null;
    case "monatlich_tag":
      return r.tagImMonat != null && r.wochentag == null && r.wochentagPosition == null;
    case "monatlich_n_ter_wochentag":
      return r.wochentag != null && r.wochentagPosition != null && r.tagImMonat == null;
    default:
      return r.wochentag == null && r.tagImMonat == null && r.wochentagPosition == null;
  }
}

/**
 * Vergibt die Zielpfade für die Cover-Kopien einer Serie — einen je Termin,
 * alle im eigenen `{uid}/`-Präfix.
 *
 * **UUID statt Zeitstempel**, anders als `uploadEventCover`. Dort trägt der
 * Pfad `Date.now()` und kollidiert nie, weil ein Mensch je Klick ein Bild
 * hochlädt. Hier entstehen bis zu 52 Kopien in derselben Millisekunde, und
 * `event_vorlagen.cover_path` wie `events.cover_path` sind unique — der
 * Zeitstempel wäre hier also genau der Fehler, den er dort verhindert.
 *
 * Die RPC prüft Anzahl, Präfix und Eindeutigkeit und weist Abweichungen mit
 * 22023 ab. Vergeben kann sie die Namen nicht: das Kopieren im Storage passiert
 * vor dem Aufruf, weil ein `storage.copy()` aus SQL heraus nicht geht.
 */
export function serienCoverPfade(uid: string, anzahl: number): string[] {
  return Array.from({ length: anzahl }, () => `${uid}/${crypto.randomUUID()}.webp`);
}

export interface VorlageItem extends VorlageRegel {
  id: string;
  hostId: string;
  title: string;
  type: EventType | null;
  location: string | null;
  description: string | null;
  topics: string[] | null;
  capacity: number | null;
  visibility: EventVisibility;
  coverPath: string | null;
  /** `time` aus Postgres, als „HH:MM:SS" — nicht als Zahl. */
  ortszeit: string;
  zeitzone: string;
  /** `interval`, als „HH:MM:SS". null = kein Ende am erzeugten Termin. */
  dauer: string | null;
  createdAt: string;
}

export type VorlageInput = Omit<VorlageItem, "id" | "hostId" | "createdAt" | "coverPath"> & {
  /**
   * `undefined` = unangetastet lassen, `null` = entfernen, String = neu setzen
   * — dieselbe Dreiteilung wie `EventInput.coverPath` und aus demselben Grund:
   * ein Speichern ohne neue Bildauswahl darf das Titelbild nicht löschen.
   */
  coverPath?: string | null;
};

/** Am Principal getrennt wie `eventsListKey` — die RLS zeigt nur eigene Zeilen. */
export const vorlagenListKey = (uid: string | null) => ["event-vorlagen", "list", uid] as const;

// EINE Zeichenkette, nicht zusammengesetzt: PostgREST leitet den Zeilentyp aus
// dem Literal ab, und eine Verkettung liefert nur `string` — die Antwort käme
// dann als `GenericStringError[]` zurück und bräuchte einen Cast über `unknown`.
// Dieselbe Form wie `EVENT_COLUMNS`.
const VORLAGEN_COLUMNS =
  "id, host_id, title, type, location, description, topics, capacity, visibility, cover_path, ortszeit, zeitzone, dauer, wiederholung, wochentag, tag_im_monat, wochentag_position, created_at";

interface VorlageRow {
  id: string;
  host_id: string;
  title: string;
  type: string | null;
  location: string | null;
  description: string | null;
  topics: string[] | null;
  capacity: number | null;
  visibility: string;
  cover_path: string | null;
  ortszeit: string;
  zeitzone: string;
  dauer: string | null;
  wiederholung: string | null;
  wochentag: number | null;
  tag_im_monat: number | null;
  wochentag_position: number | null;
  created_at: string;
}

function toItem(row: VorlageRow): VorlageItem {
  return {
    id: row.id,
    hostId: row.host_id,
    title: row.title,
    type: row.type as EventType | null,
    location: row.location,
    description: row.description,
    topics: row.topics,
    capacity: row.capacity,
    visibility: row.visibility as EventVisibility,
    coverPath: row.cover_path,
    ortszeit: row.ortszeit,
    zeitzone: row.zeitzone,
    dauer: row.dauer,
    wiederholung: row.wiederholung as Wiederholung | null,
    wochentag: row.wochentag,
    tagImMonat: row.tag_im_monat,
    wochentagPosition: row.wochentag_position,
    createdAt: row.created_at,
  };
}

/**
 * Die eigenen Vorlagen. Kein `eq("host_id", …)` nötig — `vorlagen_own` zeigt
 * ohnehin nur die eigene Zeile; der Filter stünde daneben als zweite, leiser
 * veraltende Wahrheit.
 */
export async function fetchVorlagen(): Promise<VorlageItem[]> {
  const { data, error } = await supabase
    .from("event_vorlagen")
    .select(VORLAGEN_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as VorlageRow[]).map(toItem);
}

function vorlagePatch(input: VorlageInput) {
  return {
    title: input.title,
    type: input.type,
    location: input.location,
    description: input.description,
    topics: input.topics,
    capacity: input.capacity,
    visibility: input.visibility,
    ortszeit: input.ortszeit,
    zeitzone: input.zeitzone,
    dauer: input.dauer,
    wiederholung: input.wiederholung,
    wochentag: input.wochentag,
    tag_im_monat: input.tagImMonat,
    wochentag_position: input.wochentagPosition,
  };
}

export async function createVorlage(hostId: string, input: VorlageInput): Promise<string> {
  const { data, error } = await supabase
    .from("event_vorlagen")
    .insert({ host_id: hostId, ...vorlagePatch(input), cover_path: input.coverPath ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateVorlage(id: string, input: VorlageInput): Promise<void> {
  const patch = { ...vorlagePatch(input) } as ReturnType<typeof vorlagePatch> & {
    cover_path?: string | null;
  };
  if (input.coverPath !== undefined) patch.cover_path = input.coverPath;
  const { error } = await supabase.from("event_vorlagen").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * Löscht eine Vorlage. Bereits erzeugte Termine bleiben stehen und verlieren
 * nur ihre Herkunft: der Fremdschlüssel trägt `on delete set null`. Das ist
 * Absicht — ein Termin, an dem Mitglieder angemeldet sind, darf nicht
 * verschwinden, weil jemand die Vorlage aufräumt.
 */
export async function deleteVorlage(id: string): Promise<void> {
  const { error } = await supabase.from("event_vorlagen").delete().eq("id", id);
  if (error) throw error;
}
