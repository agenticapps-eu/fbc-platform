import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { navItems } from "../config/nav";
import { TIER_LABEL, type MembershipTier } from "../lib/tiers";
import { useAuth } from "../providers/auth-context";

export default function AppShell() {
  const { user, tier, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  const tierLabel = tier ? (TIER_LABEL[tier as MembershipTier] ?? tier) : null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <Link to="/" className="text-lg font-semibold">
          Fair Business Club
        </Link>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          {user ? (
            <>
              <span className="text-gray-700">
                {user.email}
                {tierLabel && <span className="ml-1 text-gray-400">· {tierLabel}</span>}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-blue-600 hover:underline"
              >
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="text-blue-600 hover:underline">
              Login
            </Link>
          )}
        </div>
      </header>

      <div className="flex">
        <aside className="w-56 shrink-0 border-r border-gray-200 bg-white p-4">
          <nav className="flex flex-col gap-1">
            {navItems.map(({ path, label }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/"}
                className={({ isActive }) =>
                  `rounded px-3 py-2 text-sm ${
                    isActive
                      ? "bg-gray-100 font-medium text-gray-900"
                      : "text-gray-600 hover:bg-gray-50"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
