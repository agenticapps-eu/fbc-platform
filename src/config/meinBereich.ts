/**
 * „Mein Bereich" — Inline-Accordion-Struktur (max. 1 Verschachtelungsebene).
 * Entkoppelt vom Routing: nur Anzeige/Navigation der persönlichen Unterpunkte.
 * Bewusst schlank; Doppelung mit den Formaten wird vermieden (außer „Meine Events",
 * bewusst aufgenommen — Detlev/Donald 2026-06-30).
 */
export interface MeinBereichLeaf {
  label: string;
  to: string;
}

export interface MeinBereichNode {
  label: string;
  to?: string;
  children?: MeinBereichLeaf[];
}

export const MEIN_BEREICH_NODES: MeinBereichNode[] = [
  { label: "Mein Profil", to: "/profil" },
  {
    label: "Meine Events",
    children: [
      { label: "Gebuchte", to: "/mein-bereich?tab=events-gebucht" },
      { label: "Eingestellte", to: "/mein-bereich?tab=events-eingestellt" },
    ],
  },
  { label: "Meine Kontakte", to: "/mein-bereich?tab=kontakte" },
  { label: "Meine Investitionen", to: "/mein-bereich?tab=investitionen" },
  { label: "Einstellungen", to: "/mein-bereich?tab=einstellungen" },
];
