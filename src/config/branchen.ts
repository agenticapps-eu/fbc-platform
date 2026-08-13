/**
 * Branchen — kuratierte Liste (AGE-537, C6a).
 *
 * EINZIGE Quelle der auswählbaren Branchen. Bewusst als schlichte, deklarative
 * Konfiguration gehalten wie `config/compass.ts`: die Liste wird mit Detlev
 * abgestimmt, und sie zu ändern ist eine Textänderung hier — keine Migration.
 *
 * WARUM ES SIE GIBT: In WordPress existiert kein Branchenfeld. Der Filter im
 * Mitgliederverzeichnis bliebe nach dem Import (C10) leer. `matchBranche` leitet
 * die Branche aus dem Freitextfeld „Business" ab und braucht dafür ein Ziel.
 *
 * WAS SIE NICHT IST: eine Beschränkung der Spalte. `profiles.branche` bleibt
 * `text`, ohne `check` und ohne Fremdschlüssel — sonst wäre jede Listenänderung
 * eine Migration mit Datenumschrift davor. Bestandswerte aus der Zeit vor
 * diesem Change bleiben deshalb lesbar, und die Facette im Verzeichnis zeigt
 * weiterhin, was in den Daten steht, nicht was hier aufgeschrieben ist.
 *
 * Die Stichwörter sind kleingeschrieben; `matchBranche` vergleicht auf
 * kleingeschriebenem Text.
 */

export interface Branche {
  value: string;
  keywords: string[];
}

export const BRANCHEN: Branche[] = [
  {
    value: "Immobilien",
    keywords: ["immobilie", "makler", "hausverwaltung", "bauträger", "wohnungsbau"],
  },
  {
    value: "Finanzen & Versicherung",
    keywords: ["finanz", "versicherung", "bank", "vermögen", "kapitalanlage", "kredit"],
  },
  {
    value: "Steuern & Recht",
    keywords: ["steuerberat", "rechtsanwalt", "kanzlei", "notar", "wirtschaftsprüf"],
  },
  {
    value: "Bau & Handwerk",
    keywords: ["handwerk", "bauunternehmen", "sanierung", "elektro", "sanitär", "dachdecker"],
  },
  {
    value: "Industrie & Produktion",
    keywords: ["produktion", "fertigung", "maschinenbau", "industrie", "werkstoff"],
  },
  {
    value: "Handel & E-Commerce",
    keywords: ["handel", "e-commerce", "onlineshop", "einzelhandel", "großhandel", "vertrieb"],
  },
  {
    value: "IT & Software",
    keywords: ["software", "it-", "digitalisierung", "entwickl", "saas", "künstliche intelligenz"],
  },
  {
    value: "Marketing & Medien",
    keywords: ["marketing", "werbung", "agentur", "medien", "design", "kommunikation"],
  },
  {
    value: "Beratung & Coaching",
    keywords: ["unternehmensberat", "coaching", "consulting", "training", "mentoring"],
  },
  {
    value: "Gesundheit & Pflege",
    keywords: ["gesundheit", "pflege", "praxis", "medizin", "therapie", "heilprakt"],
  },
  {
    value: "Bildung & Wissenschaft",
    keywords: ["bildung", "schule", "hochschule", "forschung", "akademie", "weiterbildung"],
  },
  {
    value: "Gastronomie & Tourismus",
    keywords: ["gastronomie", "restaurant", "hotel", "tourismus", "catering"],
  },
  {
    value: "Energie & Umwelt",
    keywords: ["energie", "photovoltaik", "nachhaltig", "umwelt", "recycling", "solar"],
  },
  {
    value: "Logistik & Verkehr",
    keywords: ["logistik", "spedition", "transport", "verkehr", "fuhrpark"],
  },
];

/**
 * Ordnet einen Freitext höchstens einer Branche zu — Stichwortsuche, kein
 * Sprachmodell.
 *
 * Trifft KEINE Branche, oder treffen MEHRERE, ist das Ergebnis `null`. Der
 * zweite Fall ist der wichtige: sonst entschiede die Reihenfolge dieser Liste,
 * in welcher Branche ein Mitglied landet, und die Reihenfolge ist Redaktion.
 * Ein leeres Feld, das jemand selbst füllt, ist besser als eine Zuordnung, die
 * an einer Sortierung hängt.
 *
 * Aufgerufen wird die Funktion vom Import (C10, AGE-534), der auch die Quote
 * in seinem Bericht ausweist — die Testfälle hier sind erdacht, die echten
 * neunundsechzig Freitexte liegen erst dort vor.
 */
export function matchBranche(freitext: string | null | undefined): string | null {
  const text = (freitext ?? "").toLowerCase().trim();
  if (text === "") return null;

  const treffer = BRANCHEN.filter((b) => b.keywords.some((k) => text.includes(k)));
  return treffer.length === 1 ? treffer[0].value : null;
}
