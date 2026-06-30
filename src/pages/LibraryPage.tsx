import { FormatHero } from "../components/ui/FormatHero";
import { FORMAT_HERO } from "../config/formatHero";

export default function LibraryPage() {
  return (
    <div>
      <FormatHero meta={FORMAT_HERO["/library"]} />
      <p className="text-sm text-muted">
        Wissen, Ressourcen und Vorlagen. Inhalt folgt in einem späteren Issue.
      </p>
    </div>
  );
}
