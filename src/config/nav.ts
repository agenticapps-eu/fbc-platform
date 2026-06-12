import type { ComponentType } from "react";
import type { MembershipTier } from "../lib/tiers";
import AcademyPage from "../pages/AcademyPage";
import CompassPage from "../pages/CompassPage";
import EventsPage from "../pages/EventsPage";
import FeedPage from "../pages/FeedPage";
import MatchingPage from "../pages/MatchingPage";
import MeinBereichPage from "../pages/MeinBereichPage";
import ProfilPage from "../pages/ProfilPage";
import ProjektePage from "../pages/ProjektePage";
import VerzeichnisPage from "../pages/VerzeichnisPage";

/** Sidebar-Gruppe: die 7 Community-Formate vs. persönliche Konto-Routen. */
export type NavSection = "formate" | "konto";

export interface NavItem {
  path: string;
  label: string;
  Component: ComponentType;
  /** Gruppierung in der Sidebar. */
  section: NavSection;
  /** Mindest-Mitgliedsstufe fürs Route-Gating (impliziert eingeloggt). */
  minTier?: MembershipTier;
  /** Route nur für eingeloggte Nutzer (ohne Stufen-Anforderung). */
  requiresAuth?: boolean;
}

/** Routen innerhalb der AppShell. Einzige Quelle für Sidebar-Navigation und Routing. */
export const navItems: NavItem[] = [
  { path: "/", label: "Feed", Component: FeedPage, section: "formate" },
  {
    path: "/verzeichnis",
    label: "Verzeichnis",
    Component: VerzeichnisPage,
    section: "formate",
    minTier: "prime",
  },
  {
    path: "/matching",
    label: "Matching",
    Component: MatchingPage,
    section: "formate",
    minTier: "prime",
  },
  { path: "/events", label: "Events", Component: EventsPage, section: "formate" },
  { path: "/academy", label: "Academy", Component: AcademyPage, section: "formate" },
  { path: "/projekte", label: "Projekte", Component: ProjektePage, section: "formate" },
  { path: "/compass", label: "Compass", Component: CompassPage, section: "formate" },
  { path: "/profil", label: "Profil", Component: ProfilPage, section: "konto", requiresAuth: true },
  {
    path: "/mein-bereich",
    label: "Mein Bereich",
    Component: MeinBereichPage,
    section: "konto",
    requiresAuth: true,
  },
];
