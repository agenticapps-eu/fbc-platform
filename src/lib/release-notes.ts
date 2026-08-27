import type { Database } from "./database.types";
import { supabase } from "./supabase";
import type { ReleaseEintrag } from "../types/release";

/**
 * Die Datenschicht der Release-Notes (AGE-631).
 *
 * Zwei Quellen treffen hier aufeinander, und das ist der ganze Trick:
 *
 *  - **Was es an Änderungen gibt** kommt aus `release-entries.generated.ts` —
 *    zur Bauzeit aus `openspec/changes/archive/` erzeugt und mit dem Bündel
 *    ausgeliefert. Ein Eintrag, der dort steht, ist per Konstruktion deployed.
 *  - **Was davon schon angekündigt wurde** steht in `release_notes`.
 *
 * Die Zustellung selbst gehört keiner dieser Seiten: sie läuft über
 * `send_release_note()`, weil ein Fan-out auf alle Mitglieder nichts ist, was
 * ein Client tun darf — und weil der Riegel gegen die Doppelzustellung in der
 * Datenbank sitzen muss, nicht im Knopf.
 */

export type ReleaseNote = Database["public"]["Tables"]["release_notes"]["Row"];

/** Wieviele zugestellte Notes eine Seite trägt. */
export const RELEASE_NOTES_SEITE = 20;

/**
 * Der Cache-Schlüssel je Abfrage.
 *
 * **`sent` und `alle-zugestellten` sind mit Absicht verschiedene Schlüssel**,
 * obwohl beide dieselbe Tabelle lesen: `sent` trägt die geseiteten Zeilen MIT
 * `body` für `/neues`, `alle-zugestellten` die vollständigen OHNE `body` für
 * die Rechnung der Admin-Fläche. Unter einem gemeinsamen Schlüssel überschriebe
 * ein Besuch der Admin-Fläche den Cache von `/neues` mit Zeilen ohne `body` —
 * und die Seite zeigte leere Mitteilungen, bis irgendwann neu geladen wird.
 * (Fremd-Review auf dem Diff, gemini und codex, unabhängig voneinander.)
 */
export const releaseNotesQueryKey = (
  was: "draft" | "sent" | "alle-zugestellten" | "uebersprungen",
) => ["release-notes", was] as const;

const SPALTEN =
  "id, title, body, entry_slugs, status, created_by, created_at, sent_at, recipient_count";

/** Warum ein Eintrag im Archiv steht (AGE-636). */
export type ArchivGrund =
  | { art: "zugestellt"; titel: string; am: string | null }
  | { art: "nicht-relevant" };

export interface Aufteilung {
  /** Steht in der Auswahlliste. */
  offen: ReleaseEintrag[];
  /** Steht im zugeklappten Archiv, mit dem Grund daneben. */
  archiv: { eintrag: ReleaseEintrag; grund: ArchivGrund }[];
}

/**
 * Teilt die Einträge in „offen" und „archiviert" (AGE-636).
 *
 * Die Nachfolgerin von `nochNichtAngekuendigt`: dieselbe Mengenrechnung, aber
 * sie gibt **beide** Hälften zurück statt nur der einen. Zugestelltes
 * verschwand vorher spurlos — nachlesbar war nur noch der Titel der Mitteilung.
 *
 * Drei Regeln, jede eine Zusage aus `specs/admin`:
 *
 *  1. **Abgezogen werden nur die Slugs ZUGESTELLTER Notes.** Ein Entwurf darf
 *     nichts verstecken: sonst verschwände ein Change aus der Liste, sobald ihn
 *     jemand in einen Entwurf gezogen und den Entwurf liegen gelassen hat — für
 *     immer unangekündigt, und niemandem fiele es auf, weil eine kürzere Liste
 *     aussieht wie eine vollständige.
 *  2. **Zugestellt schlägt „nicht relevant".** Ein verschickter Eintrag ist
 *     verschickt, egal was vorher jemand angehakt hat — nur so bleibt „kein Weg
 *     zurück" wahr.
 *  3. **Bei mehreren Zustellungen zählt die früheste.** Das ist der Zeitpunkt,
 *     an dem die Mitglieder es erfahren haben. Ein `find()` hätte die Antwort
 *     still von der Reihenfolge der Abfrage abhängig gemacht.
 *
 * Die Reihenfolge beider Hälften ist die der Einträge, also die des Erzeugers:
 * die jüngsten zuerst.
 */
export function teileAuf(
  eintraege: ReleaseEintrag[],
  notes: Pick<ReleaseNote, "status" | "entry_slugs" | "title" | "sent_at">[],
  uebersprungen: string[],
): Aufteilung {
  const zugestellt = new Map<string, Pick<ReleaseNote, "title" | "sent_at">>();
  for (const note of notes) {
    if (note.status !== "sent") continue;
    for (const slug of note.entry_slugs) {
      const bisher = zugestellt.get(slug);
      if (!bisher || frueher(note.sent_at, bisher.sent_at)) {
        zugestellt.set(slug, { title: note.title, sent_at: note.sent_at });
      }
    }
  }
  const markiert = new Set(uebersprungen);

  const offen: ReleaseEintrag[] = [];
  const archiv: Aufteilung["archiv"] = [];
  for (const eintrag of eintraege) {
    const note = zugestellt.get(eintrag.slug);
    if (note) {
      archiv.push({
        eintrag,
        grund: { art: "zugestellt", titel: note.title, am: note.sent_at },
      });
    } else if (markiert.has(eintrag.slug)) {
      archiv.push({ eintrag, grund: { art: "nicht-relevant" } });
    } else {
      offen.push(eintrag);
    }
  }
  return { offen, archiv };
}

/** Ist `a` früher als `b`? Ein fehlendes Datum verliert — es gibt hier zwar
 *  keine zugestellte Note ohne `sent_at`, aber die Ordnung soll nicht davon
 *  abhängen, dass das so bleibt. */
function frueher(a: string | null, b: string | null): boolean {
  if (a === null) return false;
  if (b === null) return true;
  return a < b;
}

/** Die Entwürfe. Nur ein Admin sieht sie — das hält `release_notes_read_sent`. */
export async function fetchEntwuerfe(): Promise<ReleaseNote[]> {
  const { data, error } = await supabase
    .from("release_notes")
    .select(SPALTEN)
    .eq("status", "draft");
  if (error) throw error;
  return (data ?? []) as ReleaseNote[];
}

/**
 * Die zugestellten Notes, neueste zuerst. `nullsFirst: false`, weil `desc` in
 * Postgres `nulls first` ist — eine Note ohne `sent_at` gibt es hier zwar nicht
 * (der Zustand `sent` setzt ihn), aber die Ordnung soll nicht davon abhängen,
 * dass das so bleibt.
 */
export async function fetchZugestellte({
  limit = RELEASE_NOTES_SEITE,
  offset = 0,
}: { limit?: number; offset?: number } = {}): Promise<ReleaseNote[]> {
  const { data, error } = await supabase
    .from("release_notes")
    .select(SPALTEN)
    .eq("status", "sent")
    .order("sent_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as ReleaseNote[];
}

/**
 * Alle zugestellten Notes für die Admin-Fläche — **ohne Seite** (AGE-636).
 *
 * Die Ausnahme von der Hausregel „jede listende Fläche seitet", und der Grund
 * gehört benannt: hier wird nicht angezeigt, sondern **gerechnet**. Eine
 * Teilantwort wäre von „nicht angekündigt" nicht zu unterscheiden und holte
 * Einträge stillschweigend zurück in die Auswahlliste. Falsch wäre nicht die
 * Menge, sondern die Aussage.
 *
 * Dafür fällt `body` weg — die schwere Spalte, die diese Fläche nirgends
 * zeigt. Die Zeilenzahl ist durch die Zahl der Ankündigungsrunden begrenzt.
 *
 * `/neues` liest weiterhin über `fetchZugestellte`: dort ist seitenweise
 * richtig, weil die Seite anzeigt statt zu rechnen.
 */
export async function fetchAngekuendigt(): Promise<
  Pick<ReleaseNote, "id" | "title" | "entry_slugs" | "status" | "sent_at" | "recipient_count">[]
> {
  const { data, error } = await supabase
    .from("release_notes")
    .select("id, title, entry_slugs, status, sent_at, recipient_count")
    .eq("status", "sent")
    .order("sent_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Awaited<ReturnType<typeof fetchAngekuendigt>>;
}

/** Die Slugs, die ein Admin als „nicht relevant" markiert hat (AGE-636).
 *  Geteilt zwischen allen Admins — das hält `release_entry_skips_admin_read`. */
export async function fetchUebersprungene(): Promise<string[]> {
  const { data, error } = await supabase.from("release_entry_skips").select("slug");
  if (error) throw error;
  return (data ?? []).map((z) => z.slug);
}

/**
 * Markiert einen Eintrag als „nicht relevant" (AGE-636).
 *
 * `upsert` mit `ignoreDuplicates` — das ist der einzige Weg zu
 * `on conflict do nothing`; `insert()` kann die Klausel nicht ausdrücken. Zwei
 * Admins, die gleichzeitig dasselbe markieren, sollen keinen `23505` zu sehen
 * bekommen, wo nichts gestört ist.
 *
 * Geschickt wird **nur der Slug**. `skipped_by` füllt die Datenbank per
 * `default auth.uid()`, und die Insert-Policy verlangt genau das — ein
 * mitgeschickter Wert würde abgewiesen.
 */
export async function markiereUebersprungen(slug: string): Promise<void> {
  const { error } = await supabase
    .from("release_entry_skips")
    .upsert({ slug }, { onConflict: "slug", ignoreDuplicates: true });
  if (error) throw error;
}

/** Nimmt die Markierung zurück (AGE-636). Dieselbe Zeile, die sie angelegt
 *  hat — `slug` ist der Primärschlüssel. */
export async function holeZurueck(slug: string): Promise<void> {
  const { error } = await supabase.from("release_entry_skips").delete().eq("slug", slug);
  if (error) throw error;
}

/** Legt einen Entwurf an oder überschreibt ihn. `status` bleibt `draft` — mehr
 *  lässt die Policy ohnehin nicht zu, und die Fläche soll nicht behaupten, sie
 *  könnte mehr. */
export async function speichereEntwurf(entwurf: {
  id?: string;
  title: string;
  body: string;
  entrySlugs: string[];
  createdBy: string | null;
}): Promise<ReleaseNote> {
  const { data, error } = await supabase
    .from("release_notes")
    .upsert({
      ...(entwurf.id ? { id: entwurf.id } : {}),
      title: entwurf.title,
      body: entwurf.body,
      entry_slugs: entwurf.entrySlugs,
      status: "draft",
      created_by: entwurf.createdBy,
    })
    .select(SPALTEN)
    .single();
  if (error) throw error;
  return data as ReleaseNote;
}

/**
 * Stellt zu. Gibt die Zahl der wirklich beschriebenen Mitglieder zurück.
 *
 * Wirft, wenn der Aufrufer kein Admin ist **oder die Note schon zugestellt
 * wurde** — der zweite Fall ist kein Fehler des Aufrufers, sondern der Riegel,
 * und die Fläche darf ihn nicht verschlucken.
 */
export async function stelleZu(id: string): Promise<number> {
  const { data, error } = await supabase.rpc("send_release_note", { p_id: id });
  if (error) throw error;
  return data ?? 0;
}

/** Wieviele Tage „letzte Woche" umfasst — die Grenze ist einschliessend. */
const VORAUSWAHL_TAGE = 7;

/**
 * Was beim Öffnen der Fläche vorangehakt ist: die Einträge der letzten Woche.
 *
 * **Warum eine Vorauswahl und keine Filterung.** Die Liste zeigt weiterhin
 * alles noch nicht Angekündigte — beim ersten Mal sind das über fünfzig
 * Einträge aus der ganzen Projektgeschichte. Verkürzte man die Liste auf sieben
 * Tage, verschwände der Rest lautlos und für immer aus dem Blick: eine kürzere
 * Liste sieht aus wie eine vollständige. Vorgehakt ist deshalb nur der
 * Vorschlag; abwählen und dazuwählen bleibt in derselben Liste möglich.
 *
 * `heute` wird übergeben, nicht gelesen — sonst wäre die Rechnung nur an dem
 * Tag prüfbar, an dem der Test geschrieben wurde.
 *
 * Verglichen wird `JJJJ-MM-TT` als Zeichenkette. Das geht, weil das Format
 * lexikographisch in derselben Ordnung steht wie chronologisch, und es umgeht
 * die Zeitzonenfrage: `datum` ist ein Kalendertag ohne Uhrzeit, kein Zeitpunkt.
 * Ein Eintrag ohne Datum (`""`) fällt dabei von selbst heraus — er bleibt
 * sichtbar, nur ungehakt.
 */
export function ausLetzterWoche(eintraege: ReleaseEintrag[], heute: Date): ReleaseEintrag[] {
  const grenze = new Date(heute);
  grenze.setDate(grenze.getDate() - VORAUSWAHL_TAGE);
  const tag = grenze.toISOString().slice(0, 10);
  return eintraege.filter((e) => e.datum >= tag);
}
