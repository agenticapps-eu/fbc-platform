import HomePage from "../pages/HomePage";

/**
 * Startseiten-Weiche (`/`). Sie zeigt die öffentliche Landingpage (`HomePage`) —
 * für alle, eingeloggt wie nicht.
 *
 * AGE-494: Bis hierher fing sie EINEN Fall ab — eingeloggt, keine
 * `compass_responses`, nicht übersprungen → einmalig nach `/onboarding`. Der
 * Erstlogin führte damit in einen Fragebogen. Am 17.08. melden sich ~70 Menschen
 * zum ersten Mal an; ein Fragebogen als erster Eindruck ist der falsche Empfang.
 * Der Assistent bleibt vollständig im Code und unter `/onboarding` erreichbar,
 * er wird nur nicht mehr aufgedrängt.
 *
 * AGE-495 (C3) hat die Naht eingelöst — allerdings eine Ebene höher: Das
 * Aktivierungs-Gate sitzt als `ActivationGate` um die gesamte `AppShell`
 * (`App.tsx`) und nicht nur um die Startseite. Der Grund ist der Auftrag selbst:
 * „Egal welche Route aufgerufen wird, es erscheint nur der
 * Aktivierungsbildschirm." Hier allein hätte es `/mitglieder` oder `/profil`
 * nicht erreicht.
 *
 * Damit entscheidet diese Komponente endgültig nichts mehr. Sie bleibt, weil
 * `navItems` sie als Component für „/" führt und ein Umbau dort ein eigener,
 * unbeteiligter Diff wäre.
 */
export default function HomeRedirect() {
  return <HomePage />;
}
