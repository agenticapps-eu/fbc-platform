import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { TIER_RANK, type MembershipTier } from "../lib/tiers";
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
  min: MembershipTier;
  children: ReactNode;
}) {
  const { user, levelRank, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if ((levelRank ?? 0) < TIER_RANK[min]) return <Navigate to="/" replace />;
  return <>{children}</>;
}
