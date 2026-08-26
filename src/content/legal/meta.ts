import type { Rechtsdokument } from "./types";

/**
 * Slug und Titel der vier Rechtsseiten — und der Weg, ihren Text NACHZULADEN.
 *
 * **Warum getrennt vom Inhalt.** Der Footer steht auf jeder Seite und braucht
 * nur vier Titel und vier Pfade. Der Text dahinter ist gross, allen voran die
 * AGB mit 62k Zeichen. Gemessen am 26.08. bei identischer Umgebung:
 *
 * | Bündel | roh | gzip |
 * |---|---|---|
 * | ohne Rechtstexte | 1 077,93 kB | 311,20 kB |
 * | mit Rechtstexten im Hauptbündel | 1 199,37 kB | 340,96 kB |
 *
 * Das sind **+29,8 kB gzip auf jedem Seitenaufruf** fuer vier Seiten, die kaum
 * jemand oeffnet. Mit dieser Trennung bleibt im Hauptbündel nur diese Datei;
 * der Text kommt erst, wenn die Seite wirklich aufgerufen wird.
 *
 * Die Importe stehen einzeln und ausgeschrieben, nicht ueber eine Variable
 * gebaut: nur so kann der Bündler sie als eigene Stuecke erkennen.
 */
export interface Rechtsseite {
  slug: string;
  titel: string;
  lade: () => Promise<Rechtsdokument>;
}

/**
 * Reihenfolge im Footer: Impressum zuerst, weil es die Pflichtangabe nach
 * § 5 DDG ist, nach der gesucht wird. Dann die zwei Texte, die eine
 * Rechtsbeziehung beschreiben, dann die Cookie-Richtlinie als Anhang zur
 * Datenschutzerklaerung.
 */
export const rechtsseiten: Rechtsseite[] = [
  {
    slug: "impressum",
    titel: "Impressum",
    lade: () => import("./impressum").then((m) => m.impressum),
  },
  {
    slug: "datenschutz",
    titel: "Datenschutzerklärung",
    lade: () => import("./datenschutz").then((m) => m.datenschutz),
  },
  {
    slug: "agb",
    titel: "Allgemeine Geschäftsbedingungen",
    lade: () => import("./agb").then((m) => m.agb),
  },
  {
    slug: "cookies",
    titel: "Cookie-Richtlinie",
    lade: () => import("./cookies").then((m) => m.cookies),
  },
];
