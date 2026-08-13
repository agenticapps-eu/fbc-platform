import { COMPASS_STEPS } from "../config/compass";
import { supabase } from "./supabase";
import type { Database } from "./database.types";

/**
 * Mitgliederverzeichnis (AGE-241) — Datenschicht.
 *
 * Sichtbarkeit entscheidet AUSSCHLIESSLICH die RLS, nicht das Frontend: die RPC
 * `search_directory` ist SECURITY INVOKER, die Policy
 * `profiles_select_self_or_discover` (`has_level(3)`) gibt vollständige Profilzeilen
 * nur am eigenen Profil ODER ab `discover` zurück. Eine Abfrage darunter liefert
 * höchstens die eigene Zeile — niemals fremde Mitglieder. `/mitglieder` ist seit
 * AGE-314 eine eigene Route mit `minTier: "discover"` (Spec §2), die unterhalb davon
 * per MembershipGate die Wand zeigt (Komfort, nicht die Grenze).
 *
 * (Der Kopf nannte bis AGE-494 `profiles_select_self_or_prime` und „Prime+" — das
 * 6-Level-Modell hat die Policy in 20260715150000_six_level_model.sql ersetzt, der
 * Kommentar war seitdem falsch. Mitgezogen, weil dieser Change genau das
 * vergrößert, was hinter dieser Grenze preisgegeben wird.)
 */

export type DirectoryMember =
  Database["public"]["Functions"]["search_directory"]["Returns"][number];

export type DirectoryOffering = "" | "offers" | "needs";

export interface DirectoryFilters {
  /** Volltext-Suche (Name, Firma, Branche, Bio, Rollen, Kompetenzen, Interessen). */
  query: string;
  /** Thema: ""|sein|tun|haben|wirken — Mitglied ist in diesem Thema aktiv. */
  theme: string;
  branche: string;
  region: string;
  competency: string;
  /** "" = egal, "offers" = bietet, "needs" = sucht. */
  offering: DirectoryOffering;
  /** Kompass-Kategorien „bietet" (AGE-494). ODER innerhalb, UND gegen `needs`. */
  offers: string[];
  /** Kompass-Kategorien „sucht". Leere Auswahl = kein Filter. */
  needs: string[];
}

/**
 * Name des Suchparameters in der Adresszeile von `/mitglieder` (AGE-540).
 *
 * Steht hier und nicht an den beiden Verwendungsstellen, weil er die
 * Schnittstelle zwischen ihnen IST: die Kopfzeilen-Suche schreibt ihn, das
 * Verzeichnis liest ihn. Zwei Zeichenketten-Literale wären zwei Wahrheiten, und
 * ihr Auseinanderlaufen fiele erst im Browser auf.
 */
export const DIRECTORY_QUERY_PARAM = "q";

export const emptyDirectoryFilters: DirectoryFilters = {
  query: "",
  theme: "",
  branche: "",
  region: "",
  competency: "",
  offering: "",
  offers: [],
  needs: [],
};

/**
 * Kompass-Kategorien als Filteroptionen (AGE-494) — abgeleitet aus
 * `config/compass.ts`, nicht neu aufgeschrieben: Filter, Profil-Editor und
 * Assistent müssen dieselbe Liste sehen, sonst filtert man nach Kategorien, die
 * niemand schreiben kann.
 *
 * Zwei Fallen stecken darin:
 *
 * 1. Es sind **sechs je Seite, nicht elf**. Die Elf aus dem Issue ist die
 *    VEREINIGUNG beider Seiten — `immobilien` steht in beiden Listen.
 * 2. Gefiltert wird auf `category`, nicht auf `value`. `compass.ts` trennt beides:
 *    `value` ist der Entwurfs-Schlüssel im Assistenten, `category` landet in
 *    `offers`/`needs.category`. Der Chip „expertise" schreibt „know_how" — auf
 *    `value` zu filtern suchte nach Werten, die in der Tabelle nie stehen.
 */
function categoryOptions(target: "offers" | "needs") {
  const step = COMPASS_STEPS.find((s) => s.kind === "chips" && s.target === target);
  if (!step || step.kind !== "chips") return [];
  return step.options
    .filter((o) => o.category)
    .map((o) => ({ value: o.category as string, label: o.label }));
}

export const OFFER_CATEGORY_OPTIONS = categoryOptions("offers");
export const NEED_CATEGORY_OPTIONS = categoryOptions("needs");

/** Sein·Tun·Haben·Wirken — Reihenfolge wie im Erfolgsradar/öffentlichen Profil. */
export const THEME_OPTIONS = [
  { value: "sein", label: "Sein" },
  { value: "tun", label: "Tun" },
  { value: "haben", label: "Haben" },
  { value: "wirken", label: "Wirken" },
] as const;

export const OFFERING_OPTIONS = [
  { value: "offers", label: "Bietet etwas an" },
  { value: "needs", label: "Sucht etwas" },
] as const;

/** True, sobald irgendein Filter (inkl. Suchtext) gesetzt ist. */
export function hasActiveFilters(f: DirectoryFilters): boolean {
  return (
    f.query.trim() !== "" ||
    f.theme !== "" ||
    f.branche !== "" ||
    f.region !== "" ||
    f.competency !== "" ||
    f.offering !== "" ||
    f.offers.length > 0 ||
    f.needs.length > 0
  );
}

/** UI-Filterzustand → RPC-Argumente; leere Strings → undefined (= serverseitig kein Filter). */
export function filtersToArgs(f: DirectoryFilters) {
  const blank = (s: string) => {
    const trimmed = s.trim();
    return trimmed === "" ? undefined : trimmed;
  };
  // Leere Auswahl → undefined statt []. Serverseitig filtert `cardinality(...) = 0`
  // ohnehin nicht; entscheidend ist der React-Query-Key, in den der Filterzustand
  // als Objekt wandert — `[]` und `undefined` wären dort zwei Schlüssel für
  // dieselbe Abfrage und damit ein zweiter, überflüssiger Netzaufruf.
  const list = (xs: string[]) => (xs.length > 0 ? xs : undefined);
  return {
    p_query: blank(f.query),
    p_theme: blank(f.theme),
    p_branche: blank(f.branche),
    p_region: blank(f.region),
    p_competency: blank(f.competency),
    p_offering: blank(f.offering),
    p_offers: list(f.offers),
    p_needs: list(f.needs),
  };
}

export interface DirectoryFacets {
  branchen: string[];
  regionen: string[];
  kompetenzen: string[];
}

/**
 * Distinkte, alphabetisch sortierte Filterwerte aus der ungefilterten Mitgliederliste.
 * Bewusst aus dem Baseline-Set abgeleitet, damit die Dropdown-Optionen beim Filtern
 * nicht zusammenschrumpfen.
 */
export function deriveFacets(members: DirectoryMember[]): DirectoryFacets {
  const branchen = new Set<string>();
  const regionen = new Set<string>();
  const kompetenzen = new Set<string>();
  for (const m of members) {
    if (m.branche) branchen.add(m.branche);
    if (m.region) regionen.add(m.region);
    for (const c of m.competencies ?? []) if (c) kompetenzen.add(c);
  }
  const sorted = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b, "de"));
  return {
    branchen: sorted(branchen),
    regionen: sorted(regionen),
    kompetenzen: sorted(kompetenzen),
  };
}

export const directoryQueryKey = (f: DirectoryFilters) => ["directory", "search", f] as const;
export const directoryFacetsQueryKey = ["directory", "facets"] as const;

export async function searchDirectory(f: DirectoryFilters): Promise<DirectoryMember[]> {
  const { data, error } = await supabase.rpc("search_directory", filtersToArgs(f));
  if (error) throw error;
  return data ?? [];
}

/** Ungefilterte Baseline für die Facetten-Optionen (Prime+ sieht alle is_public-Profile). */
export async function fetchDirectoryBaseline(): Promise<DirectoryMember[]> {
  const { data, error } = await supabase.rpc("search_directory", {});
  if (error) throw error;
  return data ?? [];
}

// ── Kopfzeilen-Suche (AGE-540) ──────────────────────────────────────────────

/** Höchstzahl der Treffer im Dropdown der Kopfzeile. */
const HEADER_SEARCH_LIMIT = 5;

/** Mindestlänge des GETRIMMTEN Suchtexts, ab der überhaupt abgefragt wird. */
export const HEADER_SEARCH_MIN_CHARS = 2;

/** Präfix aller Kopfzeilen-Schlüssel — zum Entfernen beim Identitätswechsel. */
export const headerSearchKeyPrefix = ["directory", "header-search"] as const;

/**
 * Eigener Schlüssel, und die Kontenkennung gehört hinein.
 *
 * Zwei Gründe, beide im Plan-Review gefunden. Erstens sind die Treffer
 * RLS-gefiltert und damit stufen- und kontoabhängig: ohne Identität im
 * Schlüssel bekäme ein später angemeldetes `basic`-Konto die Treffer eines
 * `discover`-Kontos aus dem Zwischenspeicher. `feedQueryKey` trennt aus genau
 * diesem Grund seit je nach `uid` — das Verzeichnis tat es nicht.
 *
 * Zweitens darf ein auf fünf gekürztes Ergebnis NIE unter `directoryQueryKey`
 * liegen: dort erwartet die Verzeichnisseite die vollständige Liste.
 *
 * Die allgemeine Fassung („Zwischenspeicher beim Abmelden leeren") ist AGE-258
 * und liegt im Change `finish-ui-polish`. Hier ist nur dieser eine Weg dicht.
 */
export const headerSearchQueryKey = (uid: string, term: string) =>
  [...headerSearchKeyPrefix, uid, term] as const;

/**
 * Die ersten N Treffer zu einem Begriff.
 *
 * `search_directory` kennt **kein** `LIMIT` und sortiert `order by p.name nulls
 * last`. „Die ersten fünf" heißt hier also: alphabetisch die ersten fünf ALLER
 * Treffer, geladen und clientseitig gekürzt — keine Rangfolge nach Relevanz.
 * Bei der Größenordnung dieses Verzeichnisses ist das hingenommen; es steht
 * hier, damit es niemand für eine serverseitige Kappung hält.
 */
export async function searchMembersForHeader(term: string): Promise<DirectoryMember[]> {
  const alle = await searchDirectory({ ...emptyDirectoryFilters, query: term });
  return alle.slice(0, HEADER_SEARCH_LIMIT);
}

/** Adresse der Verzeichnisseite mit übernommenem Suchbegriff. */
export function directoryUrlForQuery(term: string): string {
  const t = term.trim();
  return t ? `/mitglieder?${DIRECTORY_QUERY_PARAM}=${encodeURIComponent(t)}` : "/mitglieder";
}
