import { supabase } from "./supabase";
import type { Database } from "./database.types";

/**
 * Mitgliederverzeichnis (AGE-241) — Datenschicht.
 *
 * Sichtbarkeit entscheidet AUSSCHLIESSLICH die RLS, nicht das Frontend: die RPC
 * `search_directory` ist SECURITY INVOKER, die Policy `profiles_select_self_or_prime`
 * (AGE-235) gibt vollständige Profilzeilen nur am eigenen Profil ODER für Prime+
 * zurück. Eine Discover-/anon-Abfrage liefert höchstens die eigene Zeile — niemals
 * fremde Mitglieder. Der „Verzeichnis"-Tab wird zusätzlich unter Prime UI-seitig
 * versteckt (Komfort, nicht die Grenze).
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
}

export const emptyDirectoryFilters: DirectoryFilters = {
  query: "",
  theme: "",
  branche: "",
  region: "",
  competency: "",
  offering: "",
};

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
    f.offering !== ""
  );
}

/** UI-Filterzustand → RPC-Argumente; leere Strings → undefined (= serverseitig kein Filter). */
export function filtersToArgs(f: DirectoryFilters) {
  const blank = (s: string) => {
    const trimmed = s.trim();
    return trimmed === "" ? undefined : trimmed;
  };
  return {
    p_query: blank(f.query),
    p_theme: blank(f.theme),
    p_branche: blank(f.branche),
    p_region: blank(f.region),
    p_competency: blank(f.competency),
    p_offering: blank(f.offering),
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
