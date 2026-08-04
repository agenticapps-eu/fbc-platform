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
      <p className="text-sm text-muted">
        Du hast noch keine Kurse belegt. Sobald du in der Academy einen Kurs startest, erscheint er
        hier.
      </p>
    </div>
  );
}
