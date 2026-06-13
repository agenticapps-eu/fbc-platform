import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card, CardDescription, CardTitle } from "../components/ui/Card";
import { compassStatusQueryKey, fetchCompassStatus, loadDraft } from "../lib/compass";
import { useAuth } from "../providers/auth-context";

/**
 * Compass-Format (AGE-243): Einstieg in den Mini-Compass. Die geführte Strecke
 * selbst läuft unter /onboarding (Vollbild); diese Seite startet, setzt fort oder
 * wiederholt sie und verweist auf den Erfolgsradar im Dashboard.
 */
export default function CompassPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const uid = user?.id;
  const { data } = useQuery({
    queryKey: compassStatusQueryKey(uid ?? "anon"),
    queryFn: () => fetchCompassStatus(uid!),
    enabled: !!uid,
  });

  const draft = uid ? loadDraft(uid) : null;
  const hasDraft =
    !!draft && (Object.keys(draft.scales).length > 0 || Object.keys(draft.chips).length > 0);
  const hasResponses = data?.hasResponses ?? false;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Compass</h1>
        <p className="mt-1 text-sm text-muted">Dein Weg. Deine Richtung.</p>
      </header>

      <Card className="flex flex-col gap-4">
        <div>
          <CardTitle>Mini-Compass</CardTitle>
          <CardDescription>
            In wenigen Fragen entlang Sein · Tun · Haben · Wirken sowie „Ich suche" / „Ich biete"
            erstellen wir deinen Erfolgsradar, dein Such- &amp; Bieteprofil und erste Empfehlungen.
          </CardDescription>
        </div>

        {!user ? (
          <div>
            <Button variant="primary" onClick={() => navigate("/login")}>
              Anmelden, um zu starten
            </Button>
          </div>
        ) : hasResponses ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted">Du hast deinen Compass bereits ausgefüllt.</p>
            <Button variant="ghost" onClick={() => navigate("/onboarding")}>
              Erneut durchlaufen
            </Button>
            <Link
              to="/mein-bereich"
              className="text-sm font-medium text-gold-strong hover:underline"
            >
              Zum Erfolgsradar →
            </Link>
          </div>
        ) : (
          <div>
            <Button variant="primary" onClick={() => navigate("/onboarding")}>
              {hasDraft ? "Mini-Compass fortsetzen" : "Mini-Compass starten"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
