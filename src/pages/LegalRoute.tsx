import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LegalPage from "./LegalPage";
import LegalZurueck from "../components/LegalZurueck";
import { Logo } from "../components/ui/Logo";
import type { Rechtsseite } from "../content/legal/meta";
import type { Rechtsdokument } from "../content/legal/types";

/**
 * Laedt den Text einer Rechtsseite nach und rendert ihn (AGE-497).
 *
 * Der Text liegt nicht im Hauptbündel — siehe die Messung im Kopf von
 * `content/legal/meta.ts`. Diese Komponente ist die Naht dazwischen.
 */

/** Der Rahmen, den Laden und Fehlschlag teilen. Der Titel kommt aus den
 *  Metadaten und steht deshalb sofort — auch bevor der Text da ist. */
function Rahmen({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[760px] min-w-0 px-4 py-10 sm:px-6">
      <Link to="/" className="inline-flex" aria-label="Zur Startseite">
        <Logo lockup="full" />
      </Link>
      {/* Auch im LADE-Rahmen, nicht nur am fertigen Dokument (AGE-625): sonst
          fehlt der Rückweg genau so lange, wie das Nachladen dauert — und bei
          121k Zeichen AGB ist das die Zeit, in der jemand abbricht. */}
      <div>
        <LegalZurueck />
      </div>
      <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight break-words hyphens-auto text-ink">
        {titel}
      </h1>
      {children}
    </main>
  );
}

export default function LegalRoute({ seite }: { seite: Rechtsseite }) {
  // Der Slug wird MITGESPEICHERT, und das ist der ganze Trick.
  //
  // React montiert diese Komponente beim Wechsel von /impressum nach /agb
  // NICHT neu — beide Routen rendern denselben Elementtyp, also bleibt die
  // Instanz samt Zustand stehen. Ohne den Slug stuende deshalb nach dem Klick
  // weiter das Impressum da, unter der Adresse der AGB, bis der neue Text
  // eintrifft. Bei Rechtstexten ist das falsche Dokument unter der richtigen
  // Adresse der schlimmste der moeglichen Fehler.
  //
  // Gemessen mit einer Probe, die genau diesen Klick nachstellt (siehe
  // `LegalRoute.test.tsx`): sie war rot, bevor der Slug hier stand. Den
  // Zustand stattdessen im Effect zurueckzusetzen reicht NICHT — Effects
  // laufen nach dem Rendern, also bliebe ein Bild lang das alte Dokument
  // stehen. Der Abgleich beim Rendern hat diese Luecke nicht.
  //
  // Und deshalb steht hier EIN Zustand fuer beide Ausgaenge statt zweier:
  // zwei hiessen, den Fehler beim Seitenwechsel zuruecksetzen zu muessen, und
  // ein `setState` direkt im Effektkoerper loest Kaskaden-Renders aus
  // (`react-hooks/set-state-in-effect`). Mit dem Slug im Zustand erledigt sich
  // das von selbst: was nicht zur aktuellen Seite gehoert, wird nicht gezeigt.
  const [zustand, setZustand] = useState<{
    slug: string;
    dokument?: Rechtsdokument;
    fehler?: true;
  } | null>(null);

  useEffect(() => {
    let aktuell = true;
    void seite
      .lade()
      .then((dokument) => {
        // Wer schnell hin und her wechselt, soll nicht den Text der vorigen
        // Seite sehen, weil deren Zusage spaeter eintrifft.
        if (aktuell) setZustand({ slug: seite.slug, dokument });
      })
      .catch(() => {
        // **Ohne diesen Zweig bliebe die Seite dauerhaft leer.** Eine
        // ErrorBoundary faengt nur Fehler beim Rendern, keine abgewiesene
        // Zusage — der Diff-Review hat den Kommentar, der das Gegenteil
        // behauptete, zu Recht zerlegt.
        //
        // Der Fall ist real: nach einem Deploy zeigen alte Seiten auf
        // Bündelstücke, die es nicht mehr gibt (404). Und eine leere
        // Impressumsseite ist schlimmer als gar keine — sie sieht aus, als
        // gaebe es die Pflichtangabe nicht.
        if (aktuell) setZustand({ slug: seite.slug, fehler: true });
      });
    return () => {
      aktuell = false;
    };
  }, [seite]);

  useEffect(() => {
    // WCAG 2.4.2: Der Tab traegt sonst den Titel der Seite, von der man kam —
    // und beim Direktaufruf aus der Aktivierungsmail den allgemeinen
    // Index-Titel.
    const vorher = document.title;
    document.title = `${seite.titel} – eff.bee.zee`;
    return () => {
      document.title = vorher;
    };
  }, [seite]);

  if (zustand?.slug === seite.slug && zustand.fehler) {
    return (
      <Rahmen titel={seite.titel}>
        <p className="mt-4 text-[15px] leading-relaxed text-ink">
          Der Text konnte nicht geladen werden. Das liegt meist an der Internetverbindung oder an
          einer veralteten Fassung dieser Seite im Browser.
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-ink">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-accent underline underline-offset-2 hover:text-accent-strong"
          >
            Seite neu laden
          </button>{" "}
          — oder schreiben Sie uns an{" "}
          <a
            href="mailto:info@fairbusinessclub.de"
            className="text-accent underline underline-offset-2 hover:text-accent-strong"
          >
            info@fairbusinessclub.de
          </a>
          , dann schicken wir den Text zu.
        </p>
      </Rahmen>
    );
  }

  // Waehrend des Ladens steht der Titel schon da — er kommt aus den Metadaten
  // und kostet nichts. Eine voellig leere Seite waere fuer Screenreader ein
  // Dokument ohne jede Landmarke, und der Titel springt so auch nicht.
  if (zustand?.slug !== seite.slug || !zustand.dokument) {
    return <Rahmen titel={seite.titel}>{null}</Rahmen>;
  }

  return <LegalPage dokument={zustand.dokument} />;
}
