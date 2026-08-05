import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card, CardDescription, CardTitle } from "../components/ui/Card";
import { FormatHero } from "../components/ui/FormatHero";
import { Tabs } from "../components/ui/Tabs";
import { FORMAT_HERO } from "../config/formatHero";
import { compassStatusQueryKey, fetchCompassStatus, loadDraft } from "../lib/compass";
import { useAuth } from "../providers/auth-context";
import { AngeboteGesucheEditor } from "./AngeboteGesuchePage";

function MiniCompassTab() {
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
    <Card className="flex flex-col gap-4">
      <div>
        <CardTitle>Mini-Kompass</CardTitle>
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
          <p className="text-sm text-muted">Du hast deinen Kompass bereits ausgefüllt.</p>
          <Button variant="ghost" onClick={() => navigate("/onboarding")}>
            Erneut durchlaufen
          </Button>
          <Link to="/profil" className="text-sm font-medium text-accent-strong hover:underline">
            Zum Erfolgsradar →
          </Link>
        </div>
      ) : (
        <div>
          <Button variant="primary" onClick={() => navigate("/onboarding")}>
            {hasDraft ? "Mini-Kompass fortsetzen" : "Mini-Kompass starten"}
          </Button>
        </div>
      )}
    </Card>
  );
}

/**
 * Compass-Format (AGE-243): Einstieg in den Mini-Compass. Die geführte Strecke
 * selbst läuft unter /onboarding (Vollbild); diese Seite startet, setzt fort oder
 * wiederholt sie und verweist auf den Erfolgsradar im Dashboard.
 *
 * Seit AGE-314 (Spec §3: „Biete & Suche wird Teil von Compass") lebt der
 * Such-/Bieteprofil-Editor als zweiter Tab neben dem Mini-Compass.
 */
export default function CompassPage() {
  return (
    <div className="flex flex-col gap-6">
      <FormatHero meta={FORMAT_HERO["/kompass"]} />
      <Tabs
        tabs={[
          { value: "compass", label: "Mini-Kompass", content: <MiniCompassTab /> },
          { value: "suche-biete", label: "Suche & Biete", content: <AngeboteGesucheEditor /> },
        ]}
      />
    </div>
  );
}
