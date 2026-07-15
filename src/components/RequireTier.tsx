import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { LEVEL_RANK, type MembershipLevel } from "../config/levels";
import { useAuth } from "../providers/auth-context";

/**
 * Route-/Komponenten-Gate nach Mitgliedsstufe. Rendert children nur, wenn der
 * Nutzer mindestens `min` erreicht (level_rank-Vergleich). Nicht eingeloggte
 * Nutzer landen auf /login, eingeloggte mit zu niedriger Stufe auf /.
 *
 * Hinweis: Das ist reines UI-Gating (Komfort). Die echte Zugriffskontrolle
 * erzwingt Supabase-RLS in der DB, unabhängig vom Client.
 */
export default function RequireTier({
  min,
  children,
}: {
  min: MembershipLevel;
  children: ReactNode;
}) {
  const { user, levelRank, isLoading, tierLoading } = useAuth();

  // Erst entscheiden, wenn Session UND Stufe geladen sind (sonst Fehl-Redirect).
  if (isLoading || (user && tierLoading)) return null;
  if (!user) return <Navigate to="/login" replace />;
  if ((levelRank ?? 0) < LEVEL_RANK[min]) return <Navigate to="/" replace />;
  return <>{children}</>;
}
