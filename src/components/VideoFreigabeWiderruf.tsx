import { type Anbieter, useFreigabe, widerrufen } from "../lib/video-freigabe";
import { Button } from "./ui/Button";

const NAMEN: Record<Anbieter, string> = { youtube: "YouTube", vimeo: "Vimeo" };

/**
 * Der Widerruf zur Video-Freigabe (AGE-621).
 *
 * **Warum hier und nicht in den Einstellungen.** Das Einwilligungstor betrifft
 * auch ausgeloggte Besucher der Startseite. Eine Fläche hinter der Anmeldung
 * wäre für genau die Menschen unerreichbar, die am ehesten widerrufen wollen.
 *
 * **Warum kein vierter Blocktyp.** `content/legal/types.ts` begründet
 * ausdrücklich, warum das Inhaltsmodell der Rechtsseiten genau drei Blockarten
 * hat: am pandoc-Export gezählt hat keine vierte einen Verwender. Ein Knopf ist
 * auch kein Fließtext — er gehört neben das Dokument, nicht hinein.
 */
export function VideoFreigabeWiderruf() {
  // Zwei Aufrufe statt einer Liste: `useSyncExternalStore` braucht einen
  // Schnappschuss, der sich nur bei echter Änderung unterscheidet, und ein
  // frisch gebautes Array wäre bei jedem Rendern ein neuer Wert.
  const freigaben: { anbieter: Anbieter; frei: boolean }[] = [
    { anbieter: "youtube", frei: useFreigabe("youtube") },
    { anbieter: "vimeo", frei: useFreigabe("vimeo") },
  ];
  const offene = freigaben.filter((f) => f.frei);

  return (
    <section className="mt-12 rounded-[var(--radius-card)] border border-line bg-soft p-5">
      <h2 className="font-display text-lg font-semibold text-ink-strong">
        Ihre Freigabe für eingebettete Videos
      </h2>

      {offene.length === 0 ? (
        // Ein leerer Abschnitt liesse offen, ob es nichts gibt oder etwas fehlt.
        <p className="mt-2 text-sm text-muted">
          Sie haben derzeit keinen Anbieter freigegeben. Videos werden erst geladen, wenn Sie es am
          jeweiligen Video verlangen.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">
            Sie haben die folgenden Anbieter freigegeben. Ihre Videos werden dadurch ohne weitere
            Nachfrage geladen. Ein Widerruf wirkt sofort und gilt für künftige Aufrufe.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {offene.map(({ anbieter }) => (
              <Button key={anbieter} variant="ghost" size="sm" onClick={() => widerrufen(anbieter)}>
                {/* „Freigabe für YouTube widerrufen" brauchte 246 px und hatte
                    bei 320 px Fensterbreite noch 2 px Reserve — und `size="sm"`
                    hat eine FESTE Höhe (`h-9`), ein umbrechender Text würde
                    also beschnitten, nicht umbrochen. Der kürzere Text lässt
                    ~30 px Luft; was widerrufen wird, sagt der Absatz darüber. */}
                {NAMEN[anbieter]}-Freigabe widerrufen
              </Button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
