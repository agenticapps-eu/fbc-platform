import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/auth-context";

/**
 * Route-Gate für Staff-Ansichten (matching_manager/admin, AGE-249 §8). Rendert
 * children nur, wenn der Nutzer eine Staff-Rolle aus `staff_roles` trägt. Nicht
 * eingeloggte Nutzer landen auf /login, eingeloggte ohne Staff-Rolle auf /.
 *
 * Wie RequireTier ist das reines UI-Gating (Komfort). Die echte Zugriffskontrolle
 * erzwingt die RLS (routing_queue + list_routing_queue prüfen is_matching_manager()),
 * unabhängig vom Client.
 */
export default function RequireStaff({ children }: { children: ReactNode }) {
  const { user, staffRole, isLoading, tierLoading } = useAuth();

  // Erst entscheiden, wenn Session UND Profil (inkl. staffRole) geladen sind.
  if (isLoading || (user && tierLoading)) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!staffRole) return <Navigate to="/" replace />;
  return <>{children}</>;
}
