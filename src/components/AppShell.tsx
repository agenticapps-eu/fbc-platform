import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../lib/cn";
import { navItems, type NavSection } from "../config/nav";
import { useAuth } from "../providers/auth-context";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { FeedbackButton } from "./feedback/FeedbackButton";
import { RouteTransition } from "./ui/Motion";
import { Logo } from "./ui/Logo";
import { SidebarNav } from "./ui/SidebarNav";
import { TierBadge } from "./ui/TierBadge";
import { useOverlay } from "./ui/useOverlay";

// Bis AGE-499 war es umgekehrt: alles wurde auf 720 px gekappt, außer einer
// Liste breiter Routen. Das hat die Fläche verschenkt — `MemberDashboard` trägt
// `lg:grid-cols-3` und `xl:grid-cols-4`, und beide Breakpoints konnten in einer
// 720-px-Spalte nie greifen. Jetzt nutzt jede Seite die Breite, und nur die
// echten Lesespalten (Formulare, Fließtext) behalten einen Deckel.
const NARROW_ROUTES = ["/login", "/onboarding", "/einstellungen", "/profil/bearbeiten"];

// Sidebar-Oberfläche: jetzt token-getrieben über var(--sidebar-surface) (Klasse
// .fbc-sidebar-surface). Wert wird je Design-Variante in index.css gesetzt —
// Fläche kommt aus --sidebar-surface, je Theme. Von aside + Drawer geteilt.
const SIDEBAR_SURFACE = "fbc-sidebar-surface";

/** Breite der angedockten Sidebar, offen und eingeklappt. Wird als CSS-Variable
 *  gesetzt, weil aside-Breite und Inhalts-Versatz denselben Wert brauchen —
 *  zwei Tailwind-Klassen, die man synchron halten muss, laufen auseinander. */
const SIDEBAR_W_OPEN = "16rem";
const SIDEBAR_W_RAIL = "4.5rem";

/** Merkt sich die eingeklappte Sidebar über Reloads hinweg — sie ist eine
 *  Arbeitsplatz-Einstellung, keine Kontoeinstellung, und bleibt daher (anders als
 *  das Theme, AGE-492) bewusst gerätelokal. */
const SIDEBAR_COLLAPSED_KEY = "fbc.sidebarCollapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function ChevronLeftIcon({ flipped }: { flipped: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-4 w-4 transition-transform", flipped && "rotate-180")}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m14 6-6 6 6 6" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="hidden h-4 w-4 text-muted sm:block"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Profil-Menü hinter dem Avatar (E-Mail, Stufe, Links, Logout) — klappt per Klick
 *  auf das Profilbild auf; schließt über Außenklick und Escape. */
function UserMenu({
  email,
  tier,
  onSignOut,
}: {
  email: string;
  tier: string | null;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profilmenü"
        className="flex items-center gap-1.5 rounded-full p-1 transition-colors hover:bg-ink/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
      >
        <Avatar name={email} size="sm" />
        <ChevronDownIcon />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-[var(--radius-card)] border border-line bg-canvas py-1 shadow-soft"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-medium text-ink">{email}</p>
            {tier && (
              <span className="mt-1.5 inline-block">
                <TierBadge tier={tier} />
              </span>
            )}
          </div>
          <Link
            to="/profil"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-ink/80 transition-colors hover:bg-ink/[0.04] hover:text-ink"
          >
            Mein Bereich
          </Link>
          <Link
            to="/profil"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-ink/80 transition-colors hover:bg-ink/[0.04] hover:text-ink"
          >
            Profil
          </Link>
          <Link
            to="/mitgliedschaft"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-ink/80 transition-colors hover:bg-ink/[0.04] hover:text-ink"
          >
            Mitgliedschaft
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="block w-full px-4 py-2 text-left text-sm font-medium text-danger transition-colors hover:bg-danger/[0.06]"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

/** Reihenfolge und Titel der Sidebar-Abschnitte (Spec §2). `sub` erscheint nie. */
const SIDEBAR_SECTIONS: Array<{ section: NavSection; title: string }> = [
  { section: "entdecken", title: "Entdecken" },
  { section: "mein-bereich", title: "Mein Bereich" },
  // AGE-494: „Service" ist entfallen. Mitgliedschaft fällt aus dem Menü,
  // Einstellungen steht jetzt unter „Mein Bereich" — bliebe die Zeile hier,
  // rendert die Sidebar eine Überschrift ohne einen einzigen Eintrag darunter.
];

/** Sidebar-Inhalt — geteilt von angedockter Desktop-Sidebar und Off-Canvas-Drawer.
 *  Reine Navigation: die Abschnitte aus `navItems`, für Admins ein eigener dazu. */
function SidebarContent({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { user, staffRole } = useAuth();
  // Alle Mitglieder sehen dieselbe Navigation (Spec §1) — Rechte gaten die Inhalte
  // (MembershipGate), nicht das Menü. Anon sieht nur „Entdecken": „Meine Kontakte"
  // ohne Konto wäre ein Versprechen ins Leere.
  const sections: { title: string; items: { path: string; label: string }[] }[] =
    SIDEBAR_SECTIONS.filter(({ section }) => user || section === "entdecken").map(
      ({ section, title }) => ({
        title,
        items: navItems
          .filter((i) => i.section === section)
          .map((i) => ({ path: i.path, label: i.label })),
      }),
    );
  // Admin-Bereich: eigener, nur für `admin` sichtbarer Abschnitt (AGE-455). Bewusst
  // KEIN navItem — /admin wird in App.tsx über RequireAdmin geroutet, nicht über die
  // navItems-Schleife.
  if (staffRole === "admin") {
    sections.push({
      title: "Administration",
      items: [{ path: "/admin", label: "Administration" }],
    });
  }
  return (
    <div className={cn("flex flex-col", collapsed ? "gap-4" : "gap-7")}>
      {/* Über der Navigation steht nichts — weder ein- noch ausgeloggt.
          AGE-499 hat den „Anmelden"-Block für Gäste entfernt, weil er dieselbe
          Aufforderung ein zweites Mal war (der Weg steht in der Topbar).
          AGE-494 zieht dieselbe Regel für den eingeloggten Fall nach: das
          Mitglied stand hier ein drittes Mal auf demselben Bildschirm — neben
          dem Avatar in der Topbar und der E-Mail samt Stufe im aufgeklappten
          Profilmenü —, und zwar mit der ROHEN E-MAIL statt seines Namens,
          obwohl der im Profil steht. Identität lebt in der Topbar, die Sidebar
          navigiert. „Mein Profil" ist als Menüeintrag ohnehin da. */}
      <SidebarNav sections={sections} onNavigate={onNavigate} collapsed={collapsed} />
    </div>
  );
}

export default function AppShell() {
  const { user, tier, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Exakter Pfad-Vergleich: /profil (Bento) nutzt die Breite, /profil/bearbeiten
  // (Editor) bleibt eine Lesespalte.
  const isNarrow = NARROW_ROUTES.includes(pathname);

  // Off-Canvas-Sidebar (< lg). Schließt über Backdrop, `onNavigate` an jedem Link
  // und Escape. (setState im Event-Callback, nicht im Effect-Body.)
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      // Privater Modus o. Ä. — die Leiste funktioniert, sie merkt sich nur nichts.
    }
  }, [collapsed]);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  // Ab `lg` verschwindet die Schublade NUR per CSS (`lg:hidden`) — der Zustand
  // bliebe offen. Solange das bloß eine unsichtbare Schublade war, fiel es
  // niemandem auf; mit der Scroll-Sperre daran (AGE-529) wäre die Seite danach
  // DAUERHAFT gesperrt, ohne sichtbaren Grund. Also hier schließen.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const auf = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    auf();
    mq.addEventListener("change", auf);
    return () => mq.removeEventListener("change", auf);
  }, []);

  // Off-Canvas-Navigation: das vierte Overlay — im Issue-Tisch fehlte es, und es
  // ist das einzige, das auf JEDER Seite montiert ist und nur auf dem Telefon
  // erscheint. Genau dort zählt die iOS-feste Sperre am meisten.
  const mobileNav = useOverlay(mobileNavOpen);

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div
      className="relative isolate min-h-screen bg-soft text-ink"
      style={
        {
          "--fbc-sidebar-w": collapsed ? SIDEBAR_W_RAIL : SIDEBAR_W_OPEN,
        } as React.CSSProperties
      }
    >
      {/* Angedockte Sidebar (≥ lg): sitzt bündig an der linken Viewport-Kante über
          die volle Höhe, mit border-right statt Rundung und Schatten — so schreibt
          es die verbindliche Vorlage vor (docs/design-system.html: „Sidebar — sitzt
          am Rand, nicht schwebend"). Bis AGE-499 hing sie als gerundete Karte in
          einem zentrierten Container und schwebte sichtbar. */}
      <aside
        className={cn(
          "fbc-sidebar fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-chrome-border lg:flex",
          SIDEBAR_SURFACE,
        )}
      >
        {/* Logo-Zeile — gleiche Höhe wie die Topbar rechts daneben, damit die
            Trennlinien der beiden auf einer Linie liegen. Eingeklappt bleibt nur
            der Kompass stehen; die Wortmarke passt in 4,5 rem nicht. */}
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-chrome-border",
            collapsed ? "justify-center px-2" : "px-5",
          )}
        >
          <Link
            to="/"
            className="rounded-md text-on-chrome-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Logo className="h-8" lockup={collapsed ? "mark" : "full"} onChrome />
          </Link>
        </div>

        <div className={cn("min-h-0 flex-1 overflow-y-auto py-6", collapsed ? "px-2" : "px-4")}>
          <SidebarContent collapsed={collapsed} />
        </div>

        {/* Einklappen — unten, damit der Schalter nicht mit der Navigation
            konkurriert. Der Zustand überlebt den Reload. */}
        <div className="shrink-0 border-t border-chrome-border p-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Navigation ausklappen" : "Navigation einklappen"}
            title={collapsed ? "Ausklappen" : "Einklappen"}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-on-chrome transition-colors hover:bg-chrome-elevated hover:text-on-chrome-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              collapsed && "justify-center px-2",
            )}
          >
            <ChevronLeftIcon flipped={collapsed} />
            {!collapsed && <span>Einklappen</span>}
          </button>
        </div>
      </aside>

      {/* Header — beginnt rechts neben der Sidebar, nicht darüber. Links
          Hamburger/Logo (nur mobil), Suche mittig, rechts Avatar/Benachrichtigungen. */}
      <header className="fbc-shell-offset sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            aria-label="Menü öffnen"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-md p-2 text-ink transition-colors hover:bg-ink/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
          >
            <MenuIcon />
          </button>
          {/* Nur unterhalb von lg — ab lg trägt die Sidebar das Logo (AGE-499).
              Zwei sichtbare Lockups nebeneinander wären doppelt. */}
          <Link
            to="/"
            className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas lg:hidden"
          >
            {/* Das SVG-Lockup ist randlos, skaliert sauber und erbt über
                currentColor die Farbe. Kein sr-only daneben: es enthält die
                Wortmarke als echten Text, der Link trägt seinen Namen selbst. */}
            <Logo className="h-8" />
          </Link>

          <div className="mx-auto hidden w-full max-w-md sm:block">
            <label className="relative block">
              <span className="sr-only">Globale Suche</span>
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                <SearchIcon />
              </span>
              <input
                type="search"
                placeholder="Suchen in der Community…"
                className="h-10 w-full rounded-full border border-line bg-soft pl-9 pr-4 text-sm text-ink transition-colors placeholder:text-muted/70 focus-visible:border-accent focus-visible:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              />
            </label>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {user ? (
              <>
                <button
                  type="button"
                  aria-label="Benachrichtigungen"
                  className="rounded-full p-2 text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <BellIcon />
                </button>
                <UserMenu email={user.email ?? "?"} tier={tier} onSignOut={handleSignOut} />
              </>
            ) : (
              // Genau EIN Anmelde-Weg im Rahmen (AGE-499). Der Block über der
              // Sidebar-Navigation ist entfallen — er war dieselbe Aufforderung
              // ein zweites Mal. Ein zusätzliches „Mitglied werden" hier oben
              // wäre die dritte: die Mitglied-werden-Wand (MembershipGate) und
              // der Hero tragen diesen Ruf schon, dort mit Kontext.
              <Button variant="primary" size="sm" onClick={() => navigate("/login")}>
                Anmelden
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Inhalt — links um die Sidebar versetzt, sonst volle Breite bis 1440 px.
          RouteTransition: weicher Fade/Slide-Up beim Seitenwechsel (reduced-motion-
          sicher). */}
      <main className="fbc-shell-offset">
        <div
          className={cn(
            "mx-auto w-full px-4 py-8 sm:px-6 lg:px-8",
            isNarrow ? "max-w-[760px]" : "max-w-[1440px]",
          )}
        >
          <RouteTransition routeKey={pathname}>
            <Outlet />
          </RouteTransition>
        </div>
      </main>

      {/* Off-Canvas-Sidebar (< lg). */}
      {mobileNavOpen && (
        <div
          ref={mobileNav}
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <div
            className="absolute inset-0 bg-scrim backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <div
            className={cn(
              "absolute inset-y-0 left-0 w-72 max-w-[80vw] overflow-y-auto px-4 py-6 shadow-soft",
              SIDEBAR_SURFACE,
            )}
          >
            <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      {/* QM-Feedback (AGE-300, Spec §3.5) — bewusst außerhalb von <main>, damit der
          Button beim Seitenwechsel stehen bleibt und die Route mitwandert. Rendert
          sich selbst weg, wenn niemand eingeloggt ist. */}
      <FeedbackButton />
    </div>
  );
}
