import type { ComponentType } from "react";
import type { MembershipLevel } from "./levels";
import AcademyPage from "../pages/AcademyPage";
import AktivitaetPage from "../pages/AktivitaetPage";
import ChatPage from "../pages/ChatPage";
import CompassPage from "../pages/CompassPage";
import HomeRedirect from "../components/HomeRedirect";
import EventsPage from "../pages/EventsPage";
import MeineKursePage from "../pages/MeineKursePage";
import EinstellungenPage from "../pages/EinstellungenPage";
import KontaktePage from "../pages/KontaktePage";
import MeineEventsPage from "../pages/MeineEventsPage";
import MitgliederPage from "../pages/MitgliederPage";
import MitgliedschaftPage from "../pages/MitgliedschaftPage";
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
 * Academy (entwickle mich) → Events (treffe Menschen) → Mitglieder (finde
 * Passende) → Aktivität (hier lebt der Club).
 *
 * AGE-494: Das Menü zeigt nur noch, was es zum Go-Live wirklich gibt — sieben
 * Einträge in zwei Gruppen. Der Kompass hat keinen eigenen Punkt mehr: als eigene
 * Seite ist er im MVP dünn, als Filter über der Mitgliederliste und als Block im
 * Profil ist derselbe Inhalt sofort nützlich. `/kompass`, `/mitgliedschaft`,
 * `/meine-kurse` und `/kontakte` bleiben als `sub` geroutet — nichts wird
 * gelöscht, es wird nur unerreichbar, und das Zurückholen ist diese eine Zeile.
 */
export const navItems: NavItem[] = [
  { path: "/", label: "Start", Component: HomeRedirect, section: "entdecken" },
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
  // AGE-450: Chancen fürs Sommerfest komplett raus (Detlev, 22.07.). Anders als
  // AGE-443 (nur Menüeintrag weg, Route blieb `sub`): der navItem entfällt ganz,
  // und App.tsx leitet /meine-chancen auf / um — die Route ist unerreichbar. Die
  // Seite (MeineChancenPage) bleibt im Code, das Zurückholen ist ein navItem plus
  // Entfernen des Redirects.
  {
    path: "/einstellungen",
    label: "Einstellungen",
    Component: EinstellungenPage,
    section: "mein-bereich",
    requiresAuth: true,
  },

  // AGE-494: Der Kompass verliert seinen Menüpunkt (Entscheidung 04.08.), die
  // Route bleibt. Wizard, Erfolgsradar und der Such-/Biete-Editor liegen
  // vollständig im Code — sichtbar wird der Kompass jetzt als Filter über der
  // Mitgliederliste und als Chip-Block im Profil.
  {
    path: "/kompass",
    label: "Kompass",
    Component: CompassPage,
    section: "sub",
    requiresAuth: true,
  },
  // AGE-494: Ein leerer Stub ohne Datenbasis — die Academy ist im MVP kuratiert
  // und kennt keine Einschreibung. In C9 tritt „Meine Academy" an diese Stelle.
  {
    path: "/meine-kurse",
    label: "Meine Kurse",
    Component: MeineKursePage,
    section: "sub",
    requiresAuth: true,
  },
  // AGE-442: Gebuchte und eigene Events stehen jetzt als dritter Reiter unter
  // /events („keine weitere Unterseite"). Der Menüeintrag entfällt, die Route
  // bleibt als `sub` erreichbar — alte Links und Lesezeichen laufen nicht ins
  // Leere, und das Zurückholen ist wie bei AGE-443 eine Zeile.
  {
    path: "/meine-events",
    label: "Meine Events",
    Component: MeineEventsPage,
    section: "sub",
    requiresAuth: true,
  },
  // AGE-494: Kontakte erreicht man über das Profil und den Chat; ein eigener
  // Menüpunkt daneben ist ein dritter Weg zum selben Ort.
  {
    path: "/kontakte",
    label: "Meine Kontakte",
    Component: KontaktePage,
    section: "sub",
    requiresAuth: true,
  },
  // AGE-443 gab ihr einen Menüeintrag. AGE-494 nimmt ihn wieder: zum Go-Live sind
  // alle `impact`, es gibt nichts zu kaufen. Kein Redirect — wer den Link kennt,
  // soll die Seite sehen dürfen.
  {
    path: "/mitgliedschaft",
    label: "Mitgliedschaft",
    Component: MitgliedschaftPage,
    section: "sub",
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
