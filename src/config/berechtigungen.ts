import type { MembershipLevel } from "./levels";

/**
 * Die Feature-Rechte aus SPEC 01 (V5 FINAL, 01.10.2026), AGE-1000.
 *
 * ══ WAS HIER STEHT UND WAS NICHT ══════════════════════════════════════════
 * Hier stehen die **Namen** der Rechte und — für die Oberflächentexte — die
 * Stufe, ab der sie gelten. Hier steht **keine Rangzahl und kein Vergleich**.
 * Ob der Aufrufer ein Recht hat, beantwortet ausschließlich `meine_rechte()`
 * aus der Datenbank; `useDarf` liest nur diese Antwort.
 *
 * Die Zuordnung Recht → Stufe ist deshalb eine **Textquelle**, kein Gate: sie
 * füllt Sätze wie „Gezielte Suche ab IMPACT". Dass sie trotzdem eine Kopie der
 * Konfiguration ist, ist ein echtes Driftrisiko — deshalb vergleicht
 * `berechtigungen.guard.test.ts` sie gegen den Seed der Migration und wird rot,
 * sobald eine Schwelle dort verschoben wird, ohne hier nachzuziehen.
 *
 * Die Clubschwelle (Rang 4) kommt hier NICHT vor. Sie ist `has_level(4)` in der
 * Datenbank und `minTier` in `nav.ts` — eine Tür, kein Recht.
 */
export const BERECHTIGUNGEN = [
  "profil.business",
  "organisation.verwalten",
  "suche_biete",
  "vorschlaege",
  "verzeichnis.suchen",
  "events.erstellen",
  "community.erstellen",
  "projekt.erstellen",
  "academy.anbieten",
  "fbc_format.initiieren",
] as const;

export type Berechtigung = (typeof BERECHTIGUNGEN)[number];

/**
 * Ab welcher Stufe ein Recht gilt — ausschließlich für Oberflächentexte.
 * Siehe den Kopfkommentar: keine Entscheidung hängt daran.
 */
export const BERECHTIGUNG_STUFE: Record<Berechtigung, MembershipLevel> = {
  "profil.business": "focus",
  "organisation.verwalten": "focus",
  suche_biete: "focus",
  vorschlaege: "focus",
  "verzeichnis.suchen": "impact",
  "events.erstellen": "impact",
  "community.erstellen": "impact",
  "projekt.erstellen": "impact",
  "academy.anbieten": "impact",
  "fbc_format.initiieren": "impact",
};
