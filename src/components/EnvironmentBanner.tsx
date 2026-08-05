/**
 * Kennzeichnet, dass gerade nicht die Produktivumgebung im Browser läuft
 * (AGE-496).
 *
 * Seit C4 sind DEV/DEMO und PROD zwei getrennte Supabase-Projekte, die im
 * Browser identisch aussehen. Ohne diese Kennzeichnung merkt niemand, ob eine
 * Einladung, eine Kontaktanfrage oder ein gepflegtes Profil an Demo-Daten geht
 * oder an echte Mitglieder.
 *
 * Bewusst nicht wegklickbar: ein Hinweis, den man schließen kann, ist genau
 * dann weg, wenn er gebraucht wird. `pointer-events-none` sorgt dafür, dass er
 * trotz fester Lage nie einen Bedienpunkt darunter schluckt.
 *
 * Unten MITTIG, nicht in einer Ecke: unten links sitzt der Einklapp-Knopf der
 * Sidebar, unten rechts erscheinen die Toasts. Beide würde er verdecken —
 * Klicks kämen zwar durch, aber man sähe nicht mehr, worauf man klickt.
 */
export default function EnvironmentBanner() {
  // Im Zweifel kennzeichnen: eine fehlende Variable ist kein Beleg dafür, dass
  // hier PROD läuft.
  if (import.meta.env.VITE_ENVIRONMENT === "prod") return null;

  return (
    <div className="pointer-events-none fixed bottom-3 left-1/2 z-50 -translate-x-1/2 select-none rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-900 backdrop-blur dark:text-amber-200">
      Testumgebung — Daten sind nicht echt
    </div>
  );
}
