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

export interface NavItem {
  path: string;
  label: string;
  Component: ComponentType;
  /** Mindest-Mitgliedsstufe fürs Route-Gating (impliziert eingeloggt). */
  minTier?: MembershipTier;
  /** Route nur für eingeloggte Nutzer (ohne Stufen-Anforderung). */
  requiresAuth?: boolean;
}

/** Routen innerhalb der AppShell. Einzige Quelle für Sidebar-Navigation und Routing. */
export const navItems: NavItem[] = [
  { path: "/", label: "Feed", Component: FeedPage },
  { path: "/verzeichnis", label: "Verzeichnis", Component: VerzeichnisPage, minTier: "prime" },
  { path: "/matching", label: "Matching", Component: MatchingPage, minTier: "prime" },
  { path: "/events", label: "Events", Component: EventsPage },
  { path: "/academy", label: "Academy", Component: AcademyPage },
  { path: "/projekte", label: "Projekte", Component: ProjektePage },
  { path: "/compass", label: "Compass", Component: CompassPage },
  { path: "/profil", label: "Profil", Component: ProfilPage },
  { path: "/mein-bereich", label: "Mein Bereich", Component: MeinBereichPage, requiresAuth: true },
];
