import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { fetchCompassStatus, isSkipped } from "../lib/compass";
import { useAuth } from "../providers/auth-context";
import HomePage from "../pages/HomePage";

/**
 * Startseiten-Weiche (`/`). Die Route `/` zeigt die öffentliche Landingpage
 * (`HomePage`) — für alle, auch ausgeloggte Besucher. Diese Weiche bleibt davor
 * gesetzt, um EINEN Fall abzufangen: ein frisch eingeloggter Nutzer ohne
 * abgeschlossenen Mini-Compass (AGE-243) wird einmalig ins Onboarding geleitet,
 * sonst sieht er die Startseite.
 *
 * Onboarding wird gezeigt, wenn der Nutzer noch keine compass_responses hat UND
 * den Compass nicht (clientseitig) übersprungen hat. Gäste und übersprungene
 * Nutzer sehen ohne Netzabfrage sofort die Startseite; nur der „eingeloggt,
 * Status unbekannt"-Fall braucht die DB-Abfrage. Fehler blockieren nie — im
 * Zweifel die Startseite.
 */
export default function HomeRedirect() {
  const { user, isLoading } = useAuth();

  // Synchroner Sofort-Fall: kein Onboarding-Gate nötig → Startseite zeigen.
  const immediate = useMemo<boolean | null>(() => {
    if (isLoading) return null;
    if (!user) return true; // Gast → Startseite
    if (isSkipped(user.id)) return true; // übersprungen → Startseite
    return null; // eingeloggt, Status unbekannt → DB-Abfrage nötig
  }, [user, isLoading]);

  const [showHome, setShowHome] = useState<boolean | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (immediate !== null || !user) return;
    let active = true;
    fetchCompassStatus(user.id)
      .then(({ hasResponses }) => {
        if (!active) return;
        if (hasResponses) setShowHome(true);
        else setNeedsOnboarding(true);
      })
      .catch(() => {
        if (active) setShowHome(true);
      });
    return () => {
      active = false;
    };
  }, [immediate, user]);

  if (needsOnboarding) return <Navigate to="/onboarding" replace />;
  // Solange die Entscheidung aussteht, nichts rendern (kein Flackern).
  if (!(immediate ?? showHome)) return null;
  return <HomePage />;
}
