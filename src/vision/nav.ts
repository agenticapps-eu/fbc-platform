/**
 * eff.bee.zee-Vision-Nav (bewusst breiter als FBC) — 9 + 6 + 3 Einträge.
 * `key` steuert die state-basierte Navigation im Shell (kein echtes Routing,
 * keine toten Links). Reihenfolge/Labels aus dem Sommerfest-Prompt §C.
 */
export type VisionKey =
  | "uebersicht"
  | "active"
  | "compass"
  | "opportunities"
  | "menschen"
  | "communities"
  | "organisationen"
  | "events"
  | "academy"
  | "netzwerk"
  | "matchings"
  | "aktivitaeten"
  | "nachrichten"
  | "gespeichert"
  | "fortschritt"
  | "playbook"
  | "einstellungen"
  | "hilfe";

export interface VisionNavItem {
  key: VisionKey;
  label: string;
  sub: string;
  icon: string;
  /** Badge-Zahl (z. B. ungelesene Nachrichten). */
  badge?: number;
}

export interface VisionNavSection {
  title: string;
  items: VisionNavItem[];
}

export const VISION_NAV: VisionNavSection[] = [
  {
    title: "Entdecken",
    items: [
      { key: "uebersicht", label: "Übersicht", sub: "Dein Start.", icon: "🏠" },
      { key: "active", label: "Active", sub: "Bewerten. Punkte. Gewinnen.", icon: "⭐" },
      { key: "compass", label: "Compass", sub: "Dein Potenzial.", icon: "🧭" },
      { key: "opportunities", label: "Opportunities", sub: "Chancen entdecken.", icon: "🎯" },
      { key: "menschen", label: "Menschen", sub: "Kontakte finden.", icon: "👥" },
      { key: "communities", label: "Communities", sub: "Gemeinsam mehr erreichen.", icon: "🌐" },
      { key: "organisationen", label: "Organisationen", sub: "Unternehmen entdecken.", icon: "🏢" },
      { key: "events", label: "Events", sub: "Treffen. Erleben.", icon: "📅" },
      { key: "academy", label: "Academy", sub: "Wissen. Lernen. Wachsen.", icon: "🎓" },
    ],
  },
  {
    title: "Mein Bereich",
    items: [
      { key: "netzwerk", label: "Mein Netzwerk", sub: "Deine Kontakte.", icon: "🕸️" },
      { key: "matchings", label: "Meine Matchings", sub: "Passende Verbindungen.", icon: "🤝" },
      {
        key: "aktivitaeten",
        label: "Meine Aktivitäten",
        sub: "Deine letzten Aktionen.",
        icon: "📊",
      },
      { key: "nachrichten", label: "Nachrichten", sub: "Chats & Updates.", icon: "💬", badge: 5 },
      { key: "gespeichert", label: "Gespeichert", sub: "Favoriten & Merkliste.", icon: "🔖" },
      {
        key: "fortschritt",
        label: "Mein Fortschritt",
        sub: "Level, Punkte & Vorteile.",
        icon: "📈",
      },
    ],
  },
  {
    title: "Service",
    items: [
      { key: "playbook", label: "Playbook", sub: "Anleitungen & Best Practices.", icon: "📘" },
      {
        key: "einstellungen",
        label: "Einstellungen",
        sub: "Profil, Sicherheit & Konto.",
        icon: "⚙️",
      },
      { key: "hilfe", label: "Hilfe & Support", sub: "Wir sind für dich da.", icon: "❓" },
    ],
  },
];

export const VISION_ITEMS: VisionNavItem[] = VISION_NAV.flatMap((s) => s.items);
