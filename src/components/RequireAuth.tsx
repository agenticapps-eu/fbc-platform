import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/auth-context";

/**
 * Route-/Komponenten-Gate: rendert children nur für eingeloggte Nutzer.
 * Während die Session noch lädt, wird nichts entschieden (kein Flackern beim
 * Reload). Nicht eingeloggte Nutzer werden auf /login geleitet.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
