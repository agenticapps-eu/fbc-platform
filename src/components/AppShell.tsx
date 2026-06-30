import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../lib/cn";
import { navItems } from "../config/nav";
import { useAuth } from "../providers/auth-context";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { Logo } from "./ui/Logo";
import { MeinBereichAccordion } from "./ui/MeinBereichAccordion";
import { RouteTransition } from "./ui/Motion";
import { SidebarNav } from "./ui/SidebarNav";
import { TierBadge } from "./ui/TierBadge";
import { VariantBackdrop } from "./ui/VariantBackdrop";
import { useDesignVariantValue } from "../providers/design-variant-context";

// Der Container hat IMMER dieselbe Breite (Sidebar springt nicht). Mehrspaltige
// Seiten füllen den Content-Bereich; textlastige Einspalter cappen nur ihre
// innere Spalte (zentriert) — die Sidebar-Position bleibt konstant.
const WIDE_ROUTES = ["/mein-bereich", "/verzeichnis", "/matching"];

// Sidebar-Oberfläche: jetzt token-getrieben über var(--sidebar-surface) (Klasse
// .fbc-sidebar-surface). Wert wird je Design-Variante in index.css gesetzt —
// heller Champagner→Gold-Verlauf (a/c/d) bzw. dunkel (b). Von aside + Drawer geteilt.
const SIDEBAR_SURFACE = "fbc-sidebar-surface";

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
        className="flex items-center gap-1.5 rounded-full p-1 transition-colors hover:bg-ink/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-strong"
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
            to="/mein-bereich"
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

/** Sidebar-Inhalt — geteilt von angedockter Desktop-Sidebar und Off-Canvas-Drawer.
 *  Mitglieder-Block oben, flaches Hauptmenü, „Mein Bereich"-Akkordeon unten. */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, tier } = useAuth();
  // Anon sieht nur die öffentlichen Formate (Start/Events/Community), in
  // Formate-Reihenfolge; eingeloggte Mitglieder sehen alle.
  const formats = navItems.filter((i) => i.section === "formate");
  const visible = user ? formats : formats.filter((i) => i.publicAccess);
  return (
    <div className="flex flex-col gap-7">
      {user ? (
        <Link
          to="/profil"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-[var(--radius-card)] border border-gold/20 bg-canvas/50 px-3 py-2.5 transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-strong"
        >
          <Avatar name={user.email ?? "?"} size="md" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">{user.email}</span>
            {tier && (
              <span className="mt-0.5 inline-block">
                <TierBadge tier={tier} />
              </span>
            )}
          </span>
        </Link>
      ) : (
        <Link
          to="/login"
          onClick={onNavigate}
          className="rounded-[var(--radius-card)] border border-gold/20 bg-canvas/50 px-3 py-2.5 text-sm text-ink/70 transition-colors hover:bg-canvas"
        >
          <span className="font-semibold text-ink">Anmelden</span>
          <span className="mt-0.5 block text-xs text-muted">Mitglied werden &amp; alles sehen</span>
        </Link>
      )}
      <SidebarNav sections={[{ items: visible }]} onNavigate={onNavigate} />
      {user && <MeinBereichAccordion onNavigate={onNavigate} />}
    </div>
  );
}

export default function AppShell() {
  const { user, tier, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { meta } = useDesignVariantValue();
  const hasBackdrop = (meta.backdrop ?? "none") !== "none";
  const isWide = WIDE_ROUTES.some((r) => pathname.startsWith(r));

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
    <div
      className={cn(
        "relative isolate min-h-screen text-ink",
        // Bei aktivem Backdrop (F/G) ist der Shell-Hintergrund transparent, damit
        // die fixe -z-10-Ebene (<VariantBackdrop>) durchscheint; sonst wie gehabt.
        hasBackdrop ? "bg-transparent" : "bg-soft",
      )}
    >
      <VariantBackdrop />
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
            to="/"
            className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <Logo lockup="mark" className="h-8 w-auto" />
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

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {user ? (
              <>
                <button
                  type="button"
                  aria-label="Benachrichtigungen"
                  className="rounded-full p-2 text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <BellIcon />
                </button>
                <UserMenu email={user.email ?? "?"} tier={tier} onSignOut={handleSignOut} />
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
      <div className="mx-auto flex max-w-[1180px] gap-4 px-4 py-8 sm:px-6">
        <aside
          className={cn(
            "sticky top-24 hidden h-fit max-h-[calc(100vh-7rem)] w-64 shrink-0 overflow-y-auto rounded-[var(--radius-card)] border border-gold/25 px-4 py-6 shadow-soft lg:block",
            SIDEBAR_SURFACE,
          )}
        >
          <SidebarContent />
        </aside>

        <main className="min-w-0 flex-1">
          {/* Einspalter cappen ihre innere Spalte zentriert; Sidebar bleibt fix.
              RouteTransition: weicher Fade/Slide-Up beim Seitenwechsel (Intensität
              je Variante, reduced-motion-sicher). */}
          <div className={cn(!isWide && "mx-auto max-w-[720px]")}>
            <RouteTransition routeKey={pathname}>
              <Outlet />
            </RouteTransition>
          </div>
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
    </div>
  );
}
