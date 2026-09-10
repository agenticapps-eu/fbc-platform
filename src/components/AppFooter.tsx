import RechtsLinks from "./RechtsLinks";

/**
 * Der Footer des Rahmens — die Pflichtlinks (AGE-497) und der Verweis auf den
 * oeffentlichen Blog (AGE-705).
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
 *
 * Die Adresse steht als Literal und nicht als geteilte Konstante: der Rueckweg
 * in `scripts/build-blog.ts` ist eine ANDERE Adresse (die der Anwendung), und
 * ein gemeinsames Modul haette hier nur einen Aufrufer.
 *
 * **Der Blog steht ueber den Pflichtlinks und nicht in ihnen.** `RechtsLinks`
 * ist eine `nav` mit dem Namen „Rechtliches"; ein Blogverweis darin waere fuer
 * einen Screenreader als Rechtsdokument angesagt. Er traegt deshalb eine eigene
 * Zeile und die kraeftigere Farbe — er ist ein Ziel, kein Kleingedrucktes.
 */
export default function AppFooter() {
  return (
    <footer className="fbc-shell-offset border-t border-line">
      <div className="mx-auto w-full max-w-[1440px] min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <p className="mb-3 text-sm">
          <a
            href="https://www.effbeezee.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-strong font-medium underline underline-offset-2"
          >
            Neu im Club: Blog und Tutorials
          </a>
        </p>
        <RechtsLinks />
      </div>
    </footer>
  );
}
