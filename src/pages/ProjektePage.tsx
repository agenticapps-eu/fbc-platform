import { FormatHero } from "../components/ui/FormatHero";
import { FORMAT_HERO } from "../config/formatHero";

export default function ProjektePage() {
  return (
    <div>
      <FormatHero meta={FORMAT_HERO["/projekte"]} />
      <p className="text-sm text-muted">
        Gemeinsame Projekte und Kooperationen. Inhalt folgt in einem späteren Issue.
      </p>
    </div>
  );
}
