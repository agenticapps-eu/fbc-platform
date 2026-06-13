import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { fetchCompassStatus, isSkipped } from "../lib/compass";
import { useAuth } from "../providers/auth-context";

/**
 * Startseiten-Weiche (`/`). Da nach dem Login alles über „/" läuft, entscheidet
 * sich hier, ob neue Nutzer einmalig ins Mini-Compass-Onboarding (AGE-243)
 * geleitet werden — sonst in die Community.
 *
 * Onboarding wird gezeigt, wenn der Nutzer noch keine compass_responses hat UND
 * den Compass nicht (clientseitig) übersprungen hat. Gäste und übersprungene
 * Nutzer werden ohne Netzabfrage sofort (render-zeit) in die Community geleitet;
 * nur der „eingeloggt, Status unbekannt"-Fall braucht die DB-Abfrage. Fehler
 * blockieren nie — im Zweifel Community.
 */
export default function HomeRedirect() {
  const { user, isLoading } = useAuth();

  // Synchroner Sofort-Fall: Gast oder bereits übersprungen → Community.
  const immediate = useMemo<string | null>(() => {
    if (isLoading) return null;
    if (!user) return "/community";
    if (isSkipped(user.id)) return "/community";
    return null; // eingeloggt, Status unbekannt → DB-Abfrage nötig
  }, [user, isLoading]);

  const [asyncTarget, setAsyncTarget] = useState<string | null>(null);

  useEffect(() => {
    if (immediate !== null || !user) return;
    let active = true;
    fetchCompassStatus(user.id)
      .then(({ hasResponses }) => {
        if (active) setAsyncTarget(hasResponses ? "/community" : "/onboarding");
      })
      .catch(() => {
        if (active) setAsyncTarget("/community");
      });
    return () => {
      active = false;
    };
  }, [immediate, user]);

  const target = immediate ?? asyncTarget;
  // Solange die Entscheidung aussteht, nichts rendern (kein Flackern).
  if (!target) return null;
  return <Navigate to={target} replace />;
}
