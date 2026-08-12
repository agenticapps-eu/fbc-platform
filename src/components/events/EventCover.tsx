/**
 * Das Titelbild eines Events im Querformat, mit der Datumsmarke des Mockups
 * (Monat über Tag, links oben auf dem Bild).
 *
 * EIN Bauteil für Kachel und Detailseite, weil beide dieselbe Marke tragen und
 * dieselbe Frage beantworten müssen: was steht da, wenn es kein Bild gibt.
 * Die Antwort ist ein Platzhalter in GLEICHER Höhe — sonst springt das Raster,
 * sobald der Bestand gemischt ist. Ein nicht signierbares Objekt und ein
 * fehlendes sind hier derselbe Fall, mit Absicht: dass ein Bild nicht
 * signierbar ist, heißt, der Betrachter darf es nicht sehen.
 */
const monatFmt = new Intl.DateTimeFormat("de-DE", { month: "short" });
const tagFmt = new Intl.DateTimeFormat("de-DE", { day: "2-digit" });
const wochentagFmt = new Intl.DateTimeFormat("de-DE", { weekday: "long" });

export function EventCover({
  startsAt,
  url,
  gross = false,
}: {
  startsAt: string | null;
  url: string | null;
  gross?: boolean;
}) {
  const d = startsAt ? new Date(startsAt) : null;
  const gueltig = d && !Number.isNaN(d.getTime());
  // Auf der DETAILSEITE ohne Bild ein flaches Band statt 3:1. Gemessen in der
  // Sichtprobe: ein 3:1-Platzhalter ist auf einer 1100 px breiten Seite rund
  // 370 px leerer Verlauf, der den Titel unter die Falz drückt — und ohne
  // Titelbilder ist das zum Start der Normalfall, nicht die Ausnahme. Die
  // Datumsmarke bleibt, sie ist der einzige Inhalt, den das Band trägt.
  //
  // In der KACHEL bleibt es bei 16:9, auch ohne Bild: dort stehen bebilderte
  // und unbebilderte Events nebeneinander, und ungleiche Bildhöhen ließen das
  // Raster ausfransen.
  const hoehe = gross ? (url ? "aspect-[3/1]" : "h-28") : "aspect-[16/9]";
  return (
    <div className={`relative overflow-hidden bg-soft ${hoehe}`}>
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        // Kein `alt`-Text und keine Meldung: der Platzhalter ist Gestaltung,
        // keine Information. „Kein Bild vorhanden" vorzulesen hilft niemandem.
        <div aria-hidden className="h-full w-full bg-gradient-to-br from-soft to-line" />
      )}
      {gueltig && (
        <div className="absolute top-3 left-3 rounded-lg bg-surface/95 px-2.5 py-1.5 text-center shadow-sm">
          <div className="text-[0.65rem] font-semibold tracking-wider text-muted uppercase">
            {monatFmt.format(d)}
          </div>
          <div className="font-display text-xl leading-none font-semibold text-ink">
            {tagFmt.format(d)}
          </div>
          {gross && (
            <div className="mt-0.5 text-[0.6rem] tracking-wide text-muted uppercase">
              {wochentagFmt.format(d)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
