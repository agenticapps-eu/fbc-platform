import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/auth-context";

/**
 * Route-Gate für die Admin-Seite (AGE-455). Rendert children nur, wenn der Nutzer die
 * `admin`-Rolle aus `staff_roles` trägt (nicht matching_manager). Reines UI-Gating —
 * die echte Zugriffskontrolle erzwingt die RLS (platform_settings_update_admin prüft
 * is_admin()), unabhängig vom Client.
 */
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, staffRole, isLoading, tierLoading } = useAuth();

  if (isLoading || (user && tierLoading)) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (staffRole !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}
