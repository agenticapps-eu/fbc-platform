import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import RequireAuth from "./components/RequireAuth";
import RequireTier from "./components/RequireTier";
import { navItems, type NavItem } from "./config/nav";
import LoginPage from "./pages/LoginPage";

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
        {/* Startseite: Community ist die neue „Heimat" (vormals Feed). */}
        <Route index element={<Navigate to="/community" replace />} />
        {navItems.map((item) => (
          <Route key={item.path} path={item.path} element={gatedElement(item)} />
        ))}
      </Route>
      <Route path="/login" element={<LoginPage />} />
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
