import { Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import RequireAuth from "./components/RequireAuth";
import RequireTier from "./components/RequireTier";
import { navItems, type NavItem } from "./config/nav";
import LoginPage from "./pages/LoginPage";

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
        {navItems.map((item) => (
          <Route key={item.path} path={item.path} element={gatedElement(item)} />
        ))}
      </Route>
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  );
}
