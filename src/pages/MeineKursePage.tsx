import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { FormatHero } from "../components/ui/FormatHero";
import { FORMAT_HERO } from "../config/formatHero";
/**
 * Meine Kurse (AGE-314, Spec §2): persönliches Gegenstück zur Academy, so wie
 * „Meine Events" zu „Events".
 *
 * Bewusst ein Stub: die Academy ist im MVP kuratiert (drei feste Videos) und kennt
 * keine Einschreibung — es gibt noch keine Datenbasis für „meine" Kurse. Der Eintrag
 * hält die Navigation vollständig wie in der Spec, ohne etwas vorzutäuschen.
 */
export default function MeineKursePage() {
  return (
    <div className="flex flex-col gap-6">
      <FormatHero meta={FORMAT_HERO["/meine-kurse"]} className="" />
      {/* AGE-494: Bis hierher ein nackter Satz ohne Weg. Die Handlung liegt beim
          Mitglied — also den Weg zeigen, statt den Mangel zu benennen. */}
      <EmptyState
        title="Dein Lernpfad beginnt in der Academy"
        description="Hier sammeln sich die Kurse, die du begonnen hast. In der Academy findest du die kuratierten Inhalte des Clubs."
        action={
          <Link to="/academy">
            <Button variant="primary" size="sm">
              Zur Academy
            </Button>
          </Link>
        }
      />
    </div>
  );
}
