import MemberDirectory from "../components/community/MemberDirectory";
import { FormatHero } from "../components/ui/FormatHero";
import { FORMAT_HERO } from "../config/formatHero";

/**
 * Mitglieder (AGE-314, Spec §3): Suche · Filter · Profile · Kontaktaufnahme —
 * ausdrücklich keine Beiträge mehr (die leben in /aktivitaet).
 *
 * Das Stufen-Gate sitzt NICHT hier, sondern an der Route: `navItems.minTier` lässt
 * App.tsx ein <MembershipGate> legen, das unterhalb von Discover die Wand zeigt.
 * Die harte Grenze ist ohnehin die RLS (siehe lib/directory.ts).
 */
export default function MitgliederPage() {
  return (
    <div className="flex flex-col gap-6">
      <FormatHero meta={FORMAT_HERO["/mitglieder"]} bereich="mitglieder" />
      <MemberDirectory />
    </div>
  );
}
