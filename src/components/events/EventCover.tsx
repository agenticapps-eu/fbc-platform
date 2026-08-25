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
  // DAS BILDFELD IST 3:1 — das Verhältnis, auf das `EventCoverPicker` bereits
  // zuschneidet (AGE-596). Die Kachel stand bis dahin auf 16:9: gemessen bei
  // 1370 px fielen davon von einem 2,70:1-Bild 34,2 % der Breite weg, von
  // einem 3,00:1-Bild 40,7 %. Nicht `object-cover` war die Ursache, sondern
  // die Abweichung zwischen Feld und Bild — `cover` hat sie nur sichtbar
  // gemacht.
  //
  // Die KACHEL ist 3:1 auch OHNE Bild, und das ist kein Widerspruch zur Zeile
  // darunter: dort stehen bebilderte und unbebilderte Events NEBENEINANDER,
  // und ungleiche Bildhöhen ließen das Raster ausfransen. Der Grund ist die
  // Ausrichtung im Raster, nicht das Verhältnis eines Bildes.
  //
  // Auf der DETAILSEITE ohne Bild bleibt es beim flachen Band statt 3:1. Dort
  // steht die Kachel allein, es gibt kein Raster auszurichten — und gemessen
  // in der Sichtprobe ist ein 3:1-Platzhalter auf einer 1100 px breiten Seite
  // rund 370 px leerer Verlauf, der den Titel unter die Falz drückt. Ohne
  // Titelbilder ist das zum Start der Normalfall, nicht die Ausnahme. Die
  // Datumsmarke bleibt, sie ist der einzige Inhalt, den das Band trägt.
  const hoehe = gross && !url ? "h-28" : "aspect-[3/1]";
  return (
    <div className={`relative overflow-hidden bg-soft ${hoehe}`}>
      {/* Der Verlauf steht IMMER im Baum, nicht nur im Zweig „kein Bild".
          Ein eingepasstes Bild füllt sein Feld nicht aus, und die frei
          bleibende Fläche soll dieselbe Gestaltung zeigen wie das Feld ohne
          Bild — sonst schiene daneben die Fläche des Elternteils durch, was
          sich als Fehler liest und nicht als Rahmung.

          Kein `alt`-Text und keine Meldung: der Platzhalter ist Gestaltung,
          keine Information. „Kein Bild vorhanden" vorzulesen hilft niemandem.

          Er steht VOR dem Bild im DOM, und das ist die tragende Zeile: beide
          sind `absolute` positioniert, unter gleichem z-index entscheidet
          allein die Reihenfolge im Baum. Umgestellt malt er das Bild zu. */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-soft to-line" />
      {url && (
        // `object-contain`, nicht `-cover`. Die Begründung steht hier eigens,
        // denn die 55 gemessenen Cover aus AGE-596 sind der Bucket `covers`
        // (Profilbanner) — Event-Titelbilder liegen in `event-covers` und sind
        // ein anderer Bestand.
        //
        // Gemessen am 25.08.: PROD führt GENAU EIN Event-Titelbild, und das ist
        // 3,00:1 — es kam durch `EventCoverPicker`, der auf `aspect={3}`
        // festlegt. Alles, was über das Produkt hochgeladen wird, ist damit
        // 3:1 und sitzt hier randlos.
        //
        // ACHTUNG, die Ausnahme ist der DEMO-SEED: seine acht Bilder sind
        // Seiten-Heldenbilder (1,50:1, eines 1,33:1), die am Zuschneider VORBEI
        // hochgeladen werden. Unter `contain` stehen sie mit rund 25 % grauer
        // Fläche je Seite in der Kachel. Das ist ein Fehler des Seeds, nicht
        // des Feldes — er lädt Material, das das Produkt so nie erzeugt.
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-contain" />
      )}
      {gueltig && (
        // Am Feld, nicht am Bild: die Marke beschriftet die Kachel, nicht das
        // Motiv. Hinge sie am Bild, wanderte sie mit dessen Rand nach innen,
        // sobald freie Fläche entsteht.
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
