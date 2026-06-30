/**
 * „Mein Bereich" — flache Navigationsliste. Jeder Eintrag ist eine eigene Route
 * mit eigenem Pfad (kein ?tab), damit NavLink pro Seite genau einen Eintrag aktiv
 * markiert. Bewusst schlank; Doppelung mit den Formaten wird vermieden (außer
 * „Meine Events", bewusst aufgenommen — Detlev/Donald 2026-06-30).
 */
export interface MeinBereichLeaf {
  label: string;
  to: string;
}

export const MEIN_BEREICH_NODES: MeinBereichLeaf[] = [
  { label: "Mein Profil", to: "/profil" },
  { label: "Meine Events", to: "/meine-events" },
  { label: "Meine Kontakte", to: "/kontakte" },
  { label: "Einstellungen", to: "/einstellungen" },
];
