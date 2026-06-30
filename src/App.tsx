import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import { DesignSwitcher } from "./components/DesignSwitcher";
import { DesignVariantProvider } from "./providers/DesignVariantProvider";
import MembershipGate from "./components/MembershipGate";
import RequireAuth from "./components/RequireAuth";
import RequireStaff from "./components/RequireStaff";
import RequireTier from "./components/RequireTier";
import { navItems, type NavItem } from "./config/nav";
import ChatPage from "./pages/ChatPage";
import EventDetailPage from "./pages/EventDetailPage";
import InternRoutingPage from "./pages/InternRoutingPage";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import PublicProfilePage from "./pages/PublicProfilePage";

// Dev-only: aus dem Prod-Build heraustree-shaken (DEV ist statisch false).
const StyleguidePage = import.meta.env.DEV ? lazy(() => import("./pages/StyleguidePage")) : null;

function gatedElement(item: NavItem) {
  const element = <item.Component />;
  // Formate werden NICHT weggeleitet, sondern zeigen für anon/zu niedrige Stufe
  // eine „Mitglied werden"-Wand (öffentliches Schaufenster bleibt sichtbar).
  if (item.section === "formate") {
    if (item.minTier) return <MembershipGate min={item.minTier}>{element}</MembershipGate>;
    if (item.requiresAuth) return <MembershipGate>{element}</MembershipGate>;
    return element; // öffentliche Formate (Start/Community/Events)
  }
  if (item.minTier) return <RequireTier min={item.minTier}>{element}</RequireTier>;
  if (item.requiresAuth) return <RequireAuth>{element}</RequireAuth>;
  return element;
}

export default function App() {
  return (
    <DesignVariantProvider>
      <Routes>
        <Route element={<AppShell />}>
          {/* Startseite (`/`) kommt aus navItems (Eintrag „Start" → HomeRedirect, das die
            öffentliche HomePage rendert und nur den Onboarding-Gate-Fall abfängt). */}
          {navItems.map((item) => (
            <Route key={item.path} path={item.path} element={gatedElement(item)} />
          ))}
          {/* Chat-Deeplink auf einen Thread (AGE-248 §9). /chat selbst kommt aus navItems;
            die param-Variante öffnet direkt eine Konversation (z. B. aus einer Anfrage). */}
          <Route
            path="/chat/:threadId"
            element={
              <RequireTier min="prime">
                <ChatPage />
              </RequireTier>
            }
          />
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
          {/* Event-Detail (AGE-251) — param-basiert, daher kein Sidebar-Eintrag. Ohne
            RequireAuth: anon darf öffentliche Events sehen; die RLS gated den Rest. */}
          <Route path="/events/:id" element={<EventDetailPage />} />
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
      {/* App-weiter Live-Design-Switcher (temporäres Review-Tool, AGE-237). */}
      <DesignSwitcher />
    </DesignVariantProvider>
  );
}
