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
      <h1 className="font-display text-2xl font-semibold text-ink">Meine Kurse</h1>
      <p className="text-sm text-muted">
        Du hast noch keine Kurse belegt. Sobald du in der Academy einen Kurs startest, erscheint er
        hier.
      </p>
    </div>
  );
}
