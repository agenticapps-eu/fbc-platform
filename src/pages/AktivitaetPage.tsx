import CommunityFeed from "../components/community/CommunityFeed";
import { FormatHero } from "../components/ui/FormatHero";
import { FORMAT_HERO } from "../config/formatHero";

/**
 * Aktivität (AGE-314, Spec §3): der lebendige Mittelpunkt — Beiträge, Kommentare,
 * Fotos, Eventberichte. Bewusst derselbe Feed, der bis hierher unter /community lief:
 * verschoben, nicht neu gebaut (Spec §5).
 */
export default function AktivitaetPage() {
  return (
    <div className="flex flex-col gap-6">
      <FormatHero meta={FORMAT_HERO["/aktivitaet"]} bereich="aktivitaet" />
      <CommunityFeed />
    </div>
  );
}
