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

export default function AppShell() {
  const { user, tier, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-warm text-ink">
      <header className="sticky top-0 z-40 border-b border-ink/8 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            to="/"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald focus-visible:ring-offset-2 focus-visible:ring-offset-warm"
          >
            <Logo />
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="hidden items-center gap-3 sm:flex">
                  <Avatar name={user.email ?? "?"} size="sm" />
                  <span className="text-sm font-medium text-ink">{user.email}</span>
                  {tier && <TierBadge tier={tier} />}
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
        {/* Feine Goldlinie als Premium-Akzent unter dem Header. */}
        <div className="h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      </header>

      <div className="mx-auto flex max-w-7xl">
        <aside className="hidden w-60 shrink-0 border-r border-ink/8 px-4 py-8 lg:block">
          <SidebarNav sections={SECTIONS} />
        </aside>
        <main className="min-w-0 flex-1 px-6 py-10 lg:px-10">
          <div className="mx-auto max-w-4xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
