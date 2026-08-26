import RechtsLinks from "./RechtsLinks";

/**
 * Der Footer des Rahmens — die Pflichtlinks (AGE-497).
 *
 * **`fbc-shell-offset` ist hier keine Kosmetik.** Die Sidebar ist `fixed`; ohne
 * dieselbe Klasse, die auch `<main>` traegt, laege der Footer ab `lg` unter ihr.
 * Die Shell-Wurzel ist ein schlichtes Block-`div`, deshalb stapelt der Footer
 * unter dem Inhalt — bei einem Flex-Container waere das ein anderer Fall.
 *
 * **Er erreicht das unbestaetigte Konto nicht**, und das ist keine
 * Nachlaessigkeit, sondern eine Grenze des `ActivationGate`: wer eingeloggt und
 * noch nicht bestaetigt ist, sieht die Shell nie. Genau deshalb tragen die
 * Anmeldeseite und der Aktivierungsbildschirm dieselben Links selbst.
 */
export default function AppFooter() {
  return (
    <footer className="fbc-shell-offset border-t border-line">
      <div className="mx-auto w-full max-w-[1440px] min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <RechtsLinks />
      </div>
    </footer>
  );
}
