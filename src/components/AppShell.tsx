import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../lib/cn";
import { navItems } from "../config/nav";
import { useAuth } from "../providers/auth-context";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { Logo } from "./ui/Logo";
import { MeinBereichSubnav } from "./ui/MeinBereichSubnav";
import { SidebarNav, type SidebarNavSection } from "./ui/SidebarNav";
import { TierBadge } from "./ui/TierBadge";

const SECTIONS: SidebarNavSection[] = [
  { title: "Formate", items: navItems.filter((i) => i.section === "formate") },
  { title: "Konto", items: navItems.filter((i) => i.section === "konto") },
];

// Mehrspaltige Seiten (Dashboard, Verzeichnis, Matching) brauchen einen breiteren
// Container; textlastige Einspalter bleiben schmal & zentriert (social-feed-Anmutung).
const WIDE_ROUTES = ["/mein-bereich", "/verzeichnis", "/matching"];

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

/** Sidebar-Inhalt — geteilt von angedockter Desktop-Sidebar und Off-Canvas-Drawer.
 *  Schaltet zwischen den 7 Formaten und der „Mein Bereich"-Subnav um (eine Sidebar). */
function SidebarContent({
  inMeinBereich,
  onNavigate,
}: {
  inMeinBereich: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col">
      <Link
        to="/community"
        onClick={onNavigate}
        className="mb-8 inline-flex rounded-md px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-night"
      >
        <Logo tone="dark" />
      </Link>
      {inMeinBereich ? (
        <MeinBereichSubnav onNavigate={onNavigate} />
      ) : (
        <SidebarNav sections={SECTIONS} onNavigate={onNavigate} />
      )}
    </div>
  );
}

export default function AppShell() {
  const { user, tier, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isWide = WIDE_ROUTES.some((r) => pathname.startsWith(r));
  const inMeinBereich = pathname.startsWith("/mein-bereich");

  // Off-Canvas-Sidebar (< lg). Schließt über Backdrop, `onNavigate` an jedem Link
  // und Escape. (setState im Event-Callback, nicht im Effect-Body.)
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-soft text-ink">
      {/* Header — volle Breite, sticky. Links Hamburger/Logo (mobil), Suche mittig,
          rechts Benachrichtigungen + Avatar/Tier. */}
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] items-center gap-4 px-4 py-3.5 sm:px-6">
          <button
            type="button"
            aria-label="Menü öffnen"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-md p-2 text-ink transition-colors hover:bg-ink/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold lg:hidden"
          >
            <MenuIcon />
          </button>
          <Link
            to="/community"
            className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-canvas lg:hidden"
          >
            <Logo />
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
                className="h-10 w-full rounded-full border border-line bg-soft pl-9 pr-4 text-sm text-ink transition-colors placeholder:text-muted/70 focus-visible:border-gold focus-visible:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              />
            </label>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            {user ? (
              <>
                <button
                  type="button"
                  aria-label="Benachrichtigungen"
                  className="rounded-full p-2 text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <BellIcon />
                </button>
                <div className="flex items-center gap-2.5">
                  <Avatar name={user.email ?? "?"} size="sm" />
                  <div className="hidden flex-col leading-tight sm:flex">
                    <span className="text-sm font-medium text-ink">{user.email}</span>
                    {tier && (
                      <span className="mt-0.5">
                        <TierBadge tier={tier} />
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  Logout
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => navigate("/login")}>
                Login
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Zentrierter Shell: Sidebar an die linke Kante des Containers angedockt,
          Content schmal & zentriert (LinkedIn/Facebook-Anmutung). */}
      <div
        className={cn(
          "mx-auto flex gap-8 px-4 py-8 sm:px-6",
          isWide ? "max-w-[1180px]" : "max-w-[1000px]",
        )}
      >
        <aside className="sticky top-24 hidden h-fit max-h-[calc(100vh-7rem)] w-64 shrink-0 overflow-y-auto rounded-[var(--radius-card)] border border-night-border bg-night px-4 py-6 lg:block">
          <SidebarContent inMeinBereich={inMeinBereich} />
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      {/* Off-Canvas-Sidebar (< lg). */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <div
            className="absolute inset-0 bg-night/60 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[80vw] overflow-y-auto bg-night px-4 py-6 shadow-soft">
            <SidebarContent
              inMeinBereich={inMeinBereich}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
