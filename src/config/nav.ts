import type { ComponentType } from "react";
import type { MembershipLevel } from "./levels";
import AcademyPage from "../pages/AcademyPage";
import AngeboteGesuchePage from "../pages/AngeboteGesuchePage";
import ChatPage from "../pages/ChatPage";
import CommunityPage from "../pages/CommunityPage";
import CompassPage from "../pages/CompassPage";
import HomeRedirect from "../components/HomeRedirect";
import EventsPage from "../pages/EventsPage";
import LibraryPage from "../pages/LibraryPage";
import MeineChancenPage from "../pages/MeineChancenPage";
import EinstellungenPage from "../pages/EinstellungenPage";
import KontaktePage from "../pages/KontaktePage";
import MeineEventsPage from "../pages/MeineEventsPage";
import ProfilAnsichtPage from "../pages/ProfilAnsichtPage";
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
  minTier?: MembershipLevel;
  /** Route nur für eingeloggte Nutzer (ohne Stufen-Anforderung). */
  requiresAuth?: boolean;
  /** Für anonyme Besucher sichtbar/erreichbar (öffentliches Schaufenster). */
  publicAccess?: boolean;
}

/**
 * Routen innerhalb der AppShell. Einzige Quelle für Sidebar-Navigation und Routing.
 *
 * Reihenfolge der `formate` ist verbindlich (Detlev, AGE-237): die 7 Formate
 * bauen aufeinander auf — Compass → Library → Academy → Events → Community →
 * Matching → Projekte.
 */
export const navItems: NavItem[] = [
  // Start: öffentliche Landingpage ÜBER den Formaten, für alle sichtbar (auch anon).
  // HomeRedirect rendert die HomePage und fängt nur den Onboarding-Gate-Fall ab
  // (frisch eingeloggt, Mini-Compass offen → /onboarding).
  { path: "/", label: "Start", Component: HomeRedirect, section: "formate", publicAccess: true },
  {
    path: "/compass",
    label: "Compass",
    Component: CompassPage,
    section: "formate",
    requiresAuth: true,
  },
  {
    path: "/library",
    label: "Library",
    Component: LibraryPage,
    section: "formate",
    requiresAuth: true,
  },
  {
    path: "/academy",
    label: "Academy",
    Component: AcademyPage,
    section: "formate",
    requiresAuth: true,
  },
  {
    path: "/events",
    label: "Events",
    Component: EventsPage,
    section: "formate",
    publicAccess: true,
  },
  {
    path: "/community",
    label: "Community",
    Component: CommunityPage,
    section: "formate",
    publicAccess: true,
  },
  {
    path: "/meine-chancen",
    label: "Meine Chancen",
    Component: MeineChancenPage,
    section: "formate",
    // §2: „erweiterte Matchings" ab `discover`. Die „ersten Matchings" von
    // `connect` kommen aus der matches-Tabelle und brauchen diese Seite nicht.
    minTier: "discover",
  },
  {
    path: "/projekte",
    label: "Projekte",
    Component: ProjektePage,
    section: "formate",
    requiresAuth: true,
  },
  // Verzeichnis: Unterbereich von Community (ab Discover), kein Top-Level-Eintrag.
  {
    path: "/verzeichnis",
    label: "Verzeichnis",
    Component: VerzeichnisPage,
    section: "community",
    // §2: „vollständiges Mitgliederverzeichnis" ab `discover` (150 €). Darunter
    // bleibt profiles_public — Basisfelder sehen alle Mitglieder.
    minTier: "discover",
  },
  // Chat (AGE-248, §9): Direktnachrichten ab Freigabe. Erreichbar aus „Mein
  // Bereich" und der angenommenen Anfrage, kein eigener Top-Level-Eintrag.
  //
  // Bewusst OHNE minTier (AGE-311): §2 stellt „Nachrichten an bereits akzeptierte
  // Kontakte" ausdrücklich allen ab `basic` frei. Die Schranke ist die Freigabe,
  // nicht die Stufe — und sie sitzt ohnehin in der RLS (messages_insert verlangt
  // eine akzeptierte contact_request). Kontaktanfragen zu STELLEN kostet ab
  // `exchange`; ein bestehendes Gespräch fortzuführen nie.
  {
    path: "/chat",
    label: "Chat",
    Component: ChatPage,
    section: "community",
    requiresAuth: true,
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
    path: "/profil",
    label: "Profil",
    Component: ProfilAnsichtPage,
    section: "konto",
    requiresAuth: true,
  },
  {
    path: "/profil/bearbeiten",
    label: "Profil bearbeiten",
    Component: ProfilPage,
    section: "konto",
    requiresAuth: true,
  },
  {
    path: "/meine-events",
    label: "Meine Events",
    Component: MeineEventsPage,
    section: "konto",
    requiresAuth: true,
  },
  {
    path: "/kontakte",
    label: "Meine Kontakte",
    Component: KontaktePage,
    section: "konto",
    requiresAuth: true,
  },
  {
    path: "/einstellungen",
    label: "Einstellungen",
    Component: EinstellungenPage,
    section: "konto",
    requiresAuth: true,
  },
];
