import type { ComponentType } from "react";
import type { MembershipLevel } from "./levels";
import AcademyPage from "../pages/AcademyPage";
import AktivitaetPage from "../pages/AktivitaetPage";
import ChatPage from "../pages/ChatPage";
import CompassPage from "../pages/CompassPage";
import HomeRedirect from "../components/HomeRedirect";
import EventsPage from "../pages/EventsPage";
import MeineChancenPage from "../pages/MeineChancenPage";
import MeineKursePage from "../pages/MeineKursePage";
import EinstellungenPage from "../pages/EinstellungenPage";
import KontaktePage from "../pages/KontaktePage";
import MeineEventsPage from "../pages/MeineEventsPage";
import MitgliederPage from "../pages/MitgliederPage";
import ProfilAnsichtPage from "../pages/ProfilAnsichtPage";
import ProfilPage from "../pages/ProfilPage";

/**
 * Sidebar-Abschnitt (AGE-314, Spec §2):
 * - `entdecken`    — das öffentliche Schaufenster; auch anon sichtbar.
 * - `mein-bereich` — persönliche Bereiche; setzen ein Konto voraus.
 * - `service`      — Konto-nahes.
 * - `sub`          — geroutet, aber KEIN Menüeintrag (z. B. Chat).
 */
export type NavSection = "entdecken" | "mein-bereich" | "service" | "sub";

export interface NavItem {
  path: string;
  label: string;
  Component: ComponentType;
  /** Gruppierung in der Sidebar. */
  section: NavSection;
  /** Mindest-Mitgliedsstufe. Löst in App.tsx die „Mitglied werden"-Wand aus. */
  minTier?: MembershipLevel;
  /** Route nur für eingeloggte Nutzer (ohne Stufen-Anforderung). */
  requiresAuth?: boolean;
}

/**
 * Routen innerhalb der AppShell. Einzige Quelle für Sidebar-Navigation und Routing.
 *
 * Alle Mitglieder sehen dieselbe Navigation (Spec §1) — Rechte gaten die Inhalte,
 * nicht das Menü. Anon sieht nur `entdecken` (Donald, 15.07.2026).
 *
 * Die Reihenfolge unter `entdecken` ist verbindlich und erzählt die Reise:
 * Compass (entdecke mich) → Academy (entwickle mich) → Events (treffe Menschen) →
 * Mitglieder (finde Passende) → Aktivität (hier lebt der Club).
 */
export const navItems: NavItem[] = [
  { path: "/", label: "Start", Component: HomeRedirect, section: "entdecken" },
  {
    path: "/compass",
    label: "Compass",
    Component: CompassPage,
    section: "entdecken",
    requiresAuth: true,
  },
  {
    path: "/academy",
    label: "Academy",
    Component: AcademyPage,
    section: "entdecken",
    requiresAuth: true,
  },
  { path: "/events", label: "Events", Component: EventsPage, section: "entdecken" },
  {
    path: "/mitglieder",
    label: "Mitglieder",
    Component: MitgliederPage,
    section: "entdecken",
    // §2: „vollständiges Mitgliederverzeichnis" ab `discover`. Darunter greift die
    // Wand; die RLS liefert ohnehin höchstens die eigene Zeile.
    minTier: "discover",
  },
  { path: "/aktivitaet", label: "Aktivität", Component: AktivitaetPage, section: "entdecken" },

  {
    path: "/profil",
    label: "Mein Profil",
    Component: ProfilAnsichtPage,
    section: "mein-bereich",
    requiresAuth: true,
  },
  {
    path: "/meine-chancen",
    label: "Meine Chancen",
    Component: MeineChancenPage,
    section: "mein-bereich",
    // §2: „erweiterte Matchings" ab `discover`.
    minTier: "discover",
  },
  {
    path: "/meine-kurse",
    label: "Meine Kurse",
    Component: MeineKursePage,
    section: "mein-bereich",
    requiresAuth: true,
  },
  {
    path: "/meine-events",
    label: "Meine Events",
    Component: MeineEventsPage,
    section: "mein-bereich",
    requiresAuth: true,
  },
  {
    path: "/kontakte",
    label: "Meine Kontakte",
    Component: KontaktePage,
    section: "mein-bereich",
    requiresAuth: true,
  },

  {
    path: "/einstellungen",
    label: "Einstellungen",
    Component: EinstellungenPage,
    section: "service",
    requiresAuth: true,
  },

  // Unterbereiche: geroutet, kein Menüeintrag.
  {
    path: "/profil/bearbeiten",
    label: "Profil bearbeiten",
    Component: ProfilPage,
    section: "sub",
    requiresAuth: true,
  },
  // Chat bewusst OHNE minTier (AGE-311): §2 stellt Nachrichten an akzeptierte Kontakte
  // allen ab `basic` frei. Die Schranke ist die Freigabe, nicht die Stufe — und sie
  // sitzt in der RLS (messages_insert verlangt eine akzeptierte contact_request).
  { path: "/chat", label: "Chat", Component: ChatPage, section: "sub", requiresAuth: true },
];
