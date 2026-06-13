import { Link, Outlet, useNavigate } from "react-router-dom";
import { navItems } from "../config/nav";
import { useAuth } from "../providers/auth-context";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { Logo } from "./ui/Logo";
import { SidebarNav, type SidebarNavSection } from "./ui/SidebarNav";
import { TierBadge } from "./ui/TierBadge";

const SECTIONS: SidebarNavSection[] = [
  { title: "Formate", items: navItems.filter((i) => i.section === "formate") },
  { title: "Konto", items: navItems.filter((i) => i.section === "konto") },
];

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

export default function AppShell() {
  const { user, tier, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-soft text-ink">
      {/* Sidebar — near-black Chrome, Gold-Akzente. */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-night-border bg-night px-4 py-6 lg:flex">
        <Link
          to="/community"
          className="mb-8 inline-flex rounded-md px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-night"
        >
          <Logo tone="dark" />
        </Link>
        <SidebarNav sections={SECTIONS} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header — globale Suche mittig, rechts Benachrichtigungen + Avatar/Tier. */}
        <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur">
          <div className="flex items-center gap-4 px-6 py-3.5">
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

        <main className="min-w-0 flex-1 px-6 py-10 lg:px-10">
          <div className="mx-auto max-w-4xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
