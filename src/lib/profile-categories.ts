import { COMPASS_STEPS } from "../config/compass";
import { findCategory, type MatchingSide } from "../config/matching";
import { supabase } from "./supabase";

/**
 * Kompass-Kategorien im Profil-Editor (AGE-494) — Datenschicht.
 *
 * **Warum es diese Datei überhaupt gibt.** `offers`/`needs` haben seit diesem
 * Change DREI Schreiboberflächen: den reichen Suche-&-Biete-Editor (schreibt alle
 * Spalten, Replace-Collection), den geführten Kompass (rein additiv) und diese
 * Chips. Übernähmen die Chips das Replace-Muster, vernichtete jede
 * Profil-Speicherung die Beschreibungen, Tags und Volumenbänder der anderen.
 * Deshalb wird hier **je Kategorie** abgeglichen statt die Sammlung zu ersetzen.
 *
 * Die Regeln, alle drei in `planReconciliation`:
 *   * Kategorie neu gewählt, noch keine Zeile → EINE minimale Zeile anlegen.
 *   * Kategorie abgewählt → ALLE eigenen Zeilen dieser Kategorie löschen.
 *   * Kategorie hat schon Zeilen → unangetastet, Chip zeigt sich als gesetzt.
 *
 * Ob das Abwählen eine Rückfrage braucht, entscheidet `source` — NICHT die Frage,
 * ob `description`/`tags` leer sind. Ein reicher Eintrag kann aus nichts als einem
 * eigenen Titel oder einem Volumenband bestehen und verschwände sonst lautlos.
 */

export type CategorySource = "editor" | "chip";

/** Eine eigene offers/needs-Zeile, reduziert auf das, was der Abgleich braucht. */
export interface CategoryRow {
  id: string;
  category: string | null;
  source: CategorySource;
}

export interface CategorySelection {
  offers: string[];
  needs: string[];
}

export interface ReconciliationPlan {
  /** Kategorien, für die eine minimale Zeile entsteht. */
  insert: string[];
  /** Zeilen-IDs, die gelöscht werden. */
  deleteIds: string[];
  /** Abgewählte Kategorien, die eine nicht-chip-erzeugte Zeile enthalten. */
  confirmRequired: string[];
}

/**
 * Chip-Optionen einer Seite, abgeleitet aus `config/compass.ts`.
 *
 * Gefiltert wird auf `category`, nicht auf `value`: `compass.ts` trennt den
 * Entwurfs-Schlüssel des Assistenten vom Kategorie-Schlüssel, der in
 * `offers`/`needs.category` landet. Der Chip „expertise" schreibt „know_how".
 */
export function categoryOptionsForSide(side: MatchingSide) {
  const target = side === "offer" ? "offers" : "needs";
  const step = COMPASS_STEPS.find((s) => s.kind === "chips" && s.target === target);
  if (!step || step.kind !== "chips") return [];
  return step.options
    .filter((o) => o.category)
    .map((o) => ({ value: o.category as string, label: o.label }));
}

/**
 * Die minimale Zeile für einen gesetzten Chip.
 *
 * Titel und Thema kommen aus `config/matching.ts` — dem Vokabular, dem
 * `offers.category` gehört. Die Kompass-Beschriftung wäre als Titel irreführend:
 * sie nennt `kapital` „Kapital & Beteiligungen", während `beteiligungen` dort
 * eine eigene Kategorie ist. Das Thema wird gesetzt und nicht null gelassen,
 * sonst blieben Chip-Zeilen für den `p_theme`-Facettenfilter unsichtbar, während
 * reiche Zeilen es nicht sind.
 */
export function chipRowFor(side: MatchingSide, category: string) {
  const def = findCategory(side, category);
  return {
    category,
    theme: def?.theme ?? null,
    title: def?.label ?? category,
    source: "chip" as const,
  };
}

/**
 * Was der Abgleich tun würde. Reine Funktion — der Kern ist testbar, ohne eine
 * Datenbank anzufassen, und die Rückfrage-Entscheidung ist dieselbe Rechnung wie
 * die Löschung (sie kann also nicht auseinanderlaufen).
 */
export function planReconciliation(current: CategoryRow[], selected: string[]): ReconciliationPlan {
  const wanted = new Set(selected);
  // Zeilen ohne Kategorie gehören keinem Chip — sie bleiben unberührt.
  const kategorisiert = current.filter((r) => r.category !== null);

  const vorhanden = new Set(kategorisiert.map((r) => r.category as string));
  const insert = selected.filter((c) => !vorhanden.has(c));

  const abgewaehlt = kategorisiert.filter((r) => !wanted.has(r.category as string));
  const deleteIds = abgewaehlt.map((r) => r.id);
  const confirmRequired = [
    ...new Set(abgewaehlt.filter((r) => r.source !== "chip").map((r) => r.category as string)),
  ];

  return { insert, deleteIds, confirmRequired };
}

export const profileCategoriesQueryKey = (uid: string) => ["profile-categories", uid] as const;

async function fetchRows(uid: string, table: "offers" | "needs"): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from(table)
    .select("id, category, source")
    .eq("profile_id", uid);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    category: r.category,
    source: (r.source as CategorySource) ?? "editor",
  }));
}

/** Die aktuell belegten Kategorien je Seite — das ist der Chip-Zustand. */
export async function fetchCategorySelection(uid: string): Promise<CategorySelection> {
  const [offers, needs] = await Promise.all([fetchRows(uid, "offers"), fetchRows(uid, "needs")]);
  const belegt = (rows: CategoryRow[]) => [
    ...new Set(rows.map((r) => r.category).filter((c): c is string => c !== null)),
  ];
  return { offers: belegt(offers), needs: belegt(needs) };
}

/** Wird geworfen, wenn ein Abwählen reiche Einträge verwerfen würde. */
export class ConfirmationRequiredError extends Error {
  constructor(readonly categories: { side: MatchingSide; category: string }[]) {
    super("Bestätigung erforderlich");
    this.name = "ConfirmationRequiredError";
  }
}

/**
 * Schreibt die Auswahl zurück.
 *
 * Die Rückfrage-Entscheidung fällt hier — beim SPEICHERN, gegen frisch gelesene
 * Zeilen — und nicht beim Laden des Formulars. Zwischen Laden und Speichern kann
 * im reichen Editor ein Eintrag entstanden sein; eine beim Laden getroffene
 * Entscheidung löschte ihn stumm.
 *
 * Bewusst NICHT atomar: der Abgleich liest und schreibt in getrennten Aufrufen.
 * Gegen doppelte Chip-Zeilen schützt der partielle Unique-Index auf
 * `(profile_id, category) where source = 'chip'`, nicht diese Funktion. Das
 * verbleibende Rennen — eine reiche Zeile entsteht nach diesem Lesen — ist
 * bekannt und in Kauf genommen (openspec/changes/mvp-scope-navigation).
 */
export async function saveCategorySelection(
  uid: string,
  next: CategorySelection,
  opts: { confirmed?: boolean } = {},
): Promise<void> {
  const sides = [
    { side: "offer" as const, table: "offers" as const, selected: next.offers },
    { side: "need" as const, table: "needs" as const, selected: next.needs },
  ];

  const plans = await Promise.all(
    sides.map(async (s) => ({
      ...s,
      plan: planReconciliation(await fetchRows(uid, s.table), s.selected),
    })),
  );

  if (!opts.confirmed) {
    const zuBestaetigen = plans.flatMap((p) =>
      p.plan.confirmRequired.map((category) => ({ side: p.side, category })),
    );
    if (zuBestaetigen.length > 0) throw new ConfirmationRequiredError(zuBestaetigen);
  }

  for (const { table, side, plan } of plans) {
    if (plan.deleteIds.length > 0) {
      const { error } = await supabase.from(table).delete().in("id", plan.deleteIds);
      if (error) throw error;
    }
    if (plan.insert.length > 0) {
      const { error } = await supabase
        .from(table)
        .insert(plan.insert.map((c) => ({ profile_id: uid, ...chipRowFor(side, c) })));
      if (error) throw error;
    }
  }
}
