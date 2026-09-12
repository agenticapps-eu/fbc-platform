import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../providers/auth-context";

/**
 * Route-/Komponenten-Gate: rendert children nur für eingeloggte Nutzer.
 * Während die Session noch lädt, wird nichts entschieden (kein Flackern beim
 * Reload). Nicht eingeloggte Nutzer werden auf /login geleitet.
 *
 * **Der Ort reist mit (AGE-643).** Bis dahin stand hier `<Navigate to="/login"
 * replace />`, und das verwarf das Ziel vollständig. In der App zählt das mehr
 * als im Browser: Browser und App führen getrennte Sitzungsspeicher, wer im
 * Browser angemeldet ist, ist es in der App nicht. Ohne den Zustand endete
 * jeder geteilte Link auf der Startseite.
 *
 * Über `state` und NICHT über einen Query-Parameter: ein Ziel in der Adresse
 * stünde in jedem Zugriffsprotokoll und in jedem Verlauf. `LoginPage` liest ihn
 * mit `zielNachAnmeldung`, das jedes nicht-interne Ziel verwirft.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const ort = useLocation();

  if (isLoading) return null;
  if (!user) {
    return (
      <Navigate to="/login" replace state={{ ziel: `${ort.pathname}${ort.search}${ort.hash}` }} />
    );
  }
  return <>{children}</>;
}
