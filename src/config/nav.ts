import type { ComponentType } from "react";
import type { MembershipTier } from "../lib/tiers";
import AcademyPage from "../pages/AcademyPage";
import AngeboteGesuchePage from "../pages/AngeboteGesuchePage";
import ChatPage from "../pages/ChatPage";
import CommunityPage from "../pages/CommunityPage";
import CompassPage from "../pages/CompassPage";
import EventsPage from "../pages/EventsPage";
import LibraryPage from "../pages/LibraryPage";
import MatchingPage from "../pages/MatchingPage";
import MeinBereichPage from "../pages/MeinBereichPage";
import ProfilPage from "../pages/ProfilPage";
import ProjektePage from "../pages/ProjektePage";
import VerzeichnisPage from "../pages/VerzeichnisPage";

/**
 * Sidebar-Gruppe:
 * - `formate`  — die 7 Community-Formate (Top-Level-Sidebar, feste Reihenfolge).
 * - `konto`    — persönliche Routen (Mein Bereich, Profil).
 * - `community`— Unterbereiche von Community (z. B. Verzeichnis); geroutet, aber
 *                NICHT als eigener Top-Level-Eintrag in der Sidebar.
 */
export type NavSection = "formate" | "konto" | "community";

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

/**
 * Routen innerhalb der AppShell. Einzige Quelle für Sidebar-Navigation und Routing.
 *
 * Reihenfolge der `formate` ist verbindlich (Detlev, AGE-237): die 7 Formate
 * bauen aufeinander auf — Compass → Library → Academy → Events → Community →
 * Matching → Projekte.
 */
export const navItems: NavItem[] = [
  { path: "/compass", label: "Compass", Component: CompassPage, section: "formate" },
  { path: "/library", label: "Library", Component: LibraryPage, section: "formate" },
  { path: "/academy", label: "Academy", Component: AcademyPage, section: "formate" },
  { path: "/events", label: "Events", Component: EventsPage, section: "formate" },
  { path: "/community", label: "Community", Component: CommunityPage, section: "formate" },
  {
    path: "/matching",
    label: "Matching",
    Component: MatchingPage,
    section: "formate",
    minTier: "prime",
  },
  { path: "/projekte", label: "Projekte", Component: ProjektePage, section: "formate" },
  // Verzeichnis: Unterbereich von Community (ab Prime), kein Top-Level-Eintrag.
  {
    path: "/verzeichnis",
    label: "Verzeichnis",
    Component: VerzeichnisPage,
    section: "community",
    minTier: "prime",
  },
  // Chat (AGE-248, §9): Direktnachrichten ab Freigabe. Erreichbar aus „Mein
  // Bereich" und der angenommenen Anfrage, kein eigener Top-Level-Eintrag. Prime+.
  {
    path: "/chat",
    label: "Chat",
    Component: ChatPage,
    section: "community",
    minTier: "prime",
  },
  // Such-/Bieteprofil-Editor (AGE-244): erreichbar aus „Mein Bereich" und dem
  // Compass-Kontext, kein eigener Top-Level-Eintrag. Alle Stufen (eigene Zeilen).
  {
    path: "/angebote-gesuche",
    label: "Angebote & Gesuche",
    Component: AngeboteGesuchePage,
    section: "community",
    requiresAuth: true,
  },
  {
    path: "/mein-bereich",
    label: "Mein Bereich",
    Component: MeinBereichPage,
    section: "konto",
    requiresAuth: true,
  },
  { path: "/profil", label: "Profil", Component: ProfilPage, section: "konto", requiresAuth: true },
];
