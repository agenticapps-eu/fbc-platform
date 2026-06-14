import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import HomeRedirect from "./components/HomeRedirect";
import RequireAuth from "./components/RequireAuth";
import RequireStaff from "./components/RequireStaff";
import RequireTier from "./components/RequireTier";
import { navItems, type NavItem } from "./config/nav";
import InternRoutingPage from "./pages/InternRoutingPage";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import PublicProfilePage from "./pages/PublicProfilePage";

// Dev-only: aus dem Prod-Build heraustree-shaken (DEV ist statisch false).
const StyleguidePage = import.meta.env.DEV ? lazy(() => import("./pages/StyleguidePage")) : null;

function gatedElement({ Component, minTier, requiresAuth }: NavItem) {
  const element = <Component />;
  if (minTier) return <RequireTier min={minTier}>{element}</RequireTier>;
  if (requiresAuth) return <RequireAuth>{element}</RequireAuth>;
  return element;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        {/* Startseite: leitet neue Nutzer ins Onboarding, sonst in die Community. */}
        <Route index element={<HomeRedirect />} />
        {navItems.map((item) => (
          <Route key={item.path} path={item.path} element={gatedElement(item)} />
        ))}
        {/* Öffentliche Profilseite (AGE-239) — param-basiert, daher kein Sidebar-Eintrag.
            /profil ist der eigene Editor; fremde Profile liegen unter /p/:id. Sichtbarkeit
            erzwingt die RLS (profiles_public ist nur für authenticated lesbar). */}
        <Route
          path="/p/:id"
          element={
            <RequireAuth>
              <PublicProfilePage />
            </RequireAuth>
          }
        />
        {/* Interne Manager-Ansicht: FBC/DKRI-Routing-Queue (AGE-249 §8). Nur Staff
            (matching_manager/admin), daher kein Sidebar-Eintrag; per URL erreichbar.
            DB-seitig erzwingt list_routing_queue/RLS is_matching_manager(). */}
        <Route
          path="/intern/routing"
          element={
            <RequireStaff>
              <InternRoutingPage />
            </RequireStaff>
          }
        />
      </Route>
      <Route path="/login" element={<LoginPage />} />
      {/* Mini-Compass-Onboarding (AGE-243) — eigene, fokussierte Vollbild-Strecke
          außerhalb der AppShell (wie /login). */}
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <OnboardingPage />
          </RequireAuth>
        }
      />
      {StyleguidePage && (
        <Route
          path="/styleguide"
          element={
            <Suspense fallback={null}>
              <StyleguidePage />
            </Suspense>
          }
        />
      )}
    </Routes>
  );
}
