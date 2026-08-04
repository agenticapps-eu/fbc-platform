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
 * Die Komponente bleibt als Naht bestehen, obwohl sie im Moment nichts entscheidet:
 * **C3 setzt genau hier das Aktivierungs-Gate.** Sie jetzt aufzulösen und in C3
 * wieder einzuziehen, wäre zweimal dieselbe Arbeit und ein Diff mehr an einer
 * Stelle, die ohnehin gleich wieder aufgeht.
 */
export default function HomeRedirect() {
  return <HomePage />;
}
