import { lazy, type ComponentType } from "react";
import type { MembershipLevel } from "./levels";
import HomeRedirect from "../components/HomeRedirect";

/**
 * AGE-642: Die Seiten kommen einzeln nach, nicht mit dem Erststart.
 *
 * Vorher hingen alle 14 hier als statische Importe und lagen damit im
 * Eintrittsbündel — jedes Mitglied lud beim ersten Aufruf jede Seite mit, auch
 * die, die es nie öffnet. Auf Mobilfunk ist das der Unterschied zwischen einer
 * App, die startet, und einer, die lädt.
 *
 * `HomeRedirect` bleibt bewusst statisch: es ist die Startseite und damit für
 * ausgeloggte wie eingeloggte Besucher der erste Bildschirm. Ein Ladezustand
 * davor wäre ein leerer Start.
 *
 * Die Sidebar liest `path`, `label` und `section` — sie berührt `Component`
 * nicht und merkt von dieser Änderung nichts.
 */
const AcademyPage = lazy(() => import("../pages/AcademyPage"));
const AktivitaetPage = lazy(() => import("../pages/AktivitaetPage"));
const ChatPage = lazy(() => import("../pages/ChatPage"));
const NeuesPage = lazy(() => import("../pages/NeuesPage"));
const CompassPage = lazy(() => import("../pages/CompassPage"));
const EventsPage = lazy(() => import("../pages/EventsPage"));
const EinstellungenPage = lazy(() => import("../pages/EinstellungenPage"));
const HilfeTutorialsPage = lazy(() => import("../pages/HilfeTutorialsPage"));
const KontaktePage = lazy(() => import("../pages/KontaktePage"));
const MeineEventsPage = lazy(() => import("../pages/MeineEventsPage"));
const MitgliederPage = lazy(() => import("../pages/MitgliederPage"));
const ProfilAnsichtPage = lazy(() => import("../pages/ProfilAnsichtPage"));
const ProfilPage = lazy(() => import("../pages/ProfilPage"));

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
 * Profil ist derselbe Inhalt sofort nützlich. `/kompass` und `/kontakte` bleiben
 * als `sub` geroutet — nichts wird gelöscht, es wird nur aus dem Menü genommen,
 * und das Zurückholen ist diese eine Zeile.
 *
 * AGE-907: `/mitgliedschaft` stand in diesem Satz und ist seit dem 25.09. nicht
 * mehr geroutet, sondern umgeleitet. Der Satz sagte „unerreichbar" und meinte
 * „ohne Menüeintrag" — die Route war von sieben Stellen aus verlinkt. Was
 * `section: "sub"` leistet, ist das Fehlen im Menü, nicht Unerreichbarkeit.
 *
 * AGE-533: `/meine-kurse` ist die Ausnahme von diesem Satz — die Seite ist
 * GELÖSCHT, nicht ausgeblendet. „Meine Academy" ist als Reiter an ihre Stelle
 * getreten, und ein Stub, der auf die Academy verweist, neben einem Reiter, der
 * dasselbe leistet, wäre ein zweiter Weg zum selben Ort. `App.tsx` leitet den
 * alten Pfad dorthin um, damit Lesezeichen nicht ins Leere laufen.
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
    // AGE-598: eine Stufe tiefer. Die LISTE beginnt seit 20260902150000 bei
    // `connect` (Rang 2); die erweiterten Felder — Kompetenzen, Biete/Suche —
    // bleiben unverändert bei `discover` (Rang 3), maskiert in derselben RPC.
    //
    // Die Schranke folgt der Datenbank, sie führt sie nicht: die Zusage trägt
    // `search_directory`, hier steht nur Komfort. Sie wird trotzdem mitgezogen,
    // weil eine Fläche, die die RLS freigibt und die Navigation verbirgt,
    // schlechter ist als beides zu.
    //
    // (Stand bis AGE-598 auf `discover`, mit der Begründung aus §2:
    // „vollständiges Mitgliederverzeichnis" ab `discover`. Das VOLLSTÄNDIGE
    // Verzeichnis fängt weiterhin dort an — nur die Liste nicht mehr.)
    minTier: "connect",
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
  // AGE-907: `/mitgliedschaft` steht hier NICHT mehr, und diesmal ist die Route
  // wirklich zu. AGE-443 gab ihr einen Menüeintrag, AGE-494 nahm ihn wieder und
  // schrieb an diese Stelle „kein Redirect — wer den Link kennt, soll die Seite
  // sehen dürfen". Genau das ist der 3.1.1-Befund: die Seite schickt den Browser
  // über `create-checkout-session` zu Stripe, und am 25.09. führten SIEBEN
  // Stellen dorthin, keine davon ein Menüeintrag. „Unerreichbar" war seit AGE-494
  // eine Zusage, die nie gestimmt hat.
  //
  // Der Redirect steht jetzt in `App.tsx`, die Bauform von `/meine-chancen`
  // (AGE-450): Seite und Preiskarten bleiben unverändert im Code,
  // `MitgliedschaftPage` wird nur von nichts mehr importiert — wie
  // `MeineChancenPage`. Zurückholen für AGE-908 ist dieser Block plus das
  // Entfernen der Redirect-Zeile. Bewacht von `scripts/kaufweg-ruhend.test.ts`.

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
  //
  // AGE-583: Label „Chat" → „Nachrichten". Der Pfad bleibt `/chat` (Lesezeichen),
  // und `section: "sub"` bleibt ebenfalls — der Einstieg ist das Kuvert in der
  // Kopfzeile, kein Menüeintrag (Entscheidung Donald, 24.08.). Das Label trägt
  // Seitentitel und Bröselpfad; hieße es weiter „Chat", benennte die Kopfzeile
  // ein anderes Ziel als die Seite, auf der man landet.
  { path: "/chat", label: "Nachrichten", Component: ChatPage, section: "sub", requiresAuth: true },
  // „Neu in der App" (AGE-631). `section: "sub"` wie `/chat`: der Weg dorthin
  // ist der Hinweis in der Glocke, nicht ein Daueeintrag im Menue — eine
  // Aenderungsliste ist nichts, was man taeglich aufsucht. Kein `minTier`: was
  // die Anwendung kann, ist keine Frage der Mitgliedsstufe.
  {
    path: "/neues",
    label: "Neu in der App",
    Component: NeuesPage,
    section: "sub",
    requiresAuth: true,
  },
  // Die Tutorials (AGE-904). `section: "sub"` wie `/neues`: der Weg dorthin ist
  // der Abschnitt „Support" am Fuss der Seitenleiste, kein achter Menüeintrag —
  // Hilfe ist nachgeordnet (V5, Bauplan §4). Kein `minTier`: was die Anwendung
  // kann, ist keine Frage der Mitgliedsstufe, und gerade das Konto auf der
  // untersten Stufe hat den grössten Bedarf, es zu erfahren.
  //
  // KEIN Deep Link: `src/lib/deep-links.ts` führt die Adresse nicht, Manifest
  // und AASA halten sich daran. Von aussen angeklickt öffnet sie den Browser,
  // nicht die App — für eine Hilfeseite richtig, und kein Versehen.
  {
    path: "/hilfe/tutorials",
    label: "Tutorials",
    Component: HilfeTutorialsPage,
    section: "sub",
    requiresAuth: true,
  },
];
