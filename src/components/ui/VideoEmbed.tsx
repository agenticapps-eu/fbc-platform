import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { parseVideoUrl } from "../../lib/feed";
import { freigeben, useFreigabe } from "../../lib/video-freigabe";
import { Icon } from "./icons";

const ANBIETER = { youtube: "YouTube", vimeo: "Vimeo" } as const;

/** Ein Video wächst sonst mit seiner Karte: in einer 1300 px breiten
 *  Beitragskarte macht `aspect-video` daraus 733 px Höhe — mehr als ein
 *  Bildschirm, für einen Beitrag unter vielen. Mit dem Einwilligungstor fiel es
 *  auf, weil die ungeklickte Fläche dieselbe Höhe als Grau einnimmt; der Player
 *  davor war genauso groß, nur füllte ihn ein Bild.
 *
 *  Die Grenze gilt für BEIDE Zustände. Nur die Fläche zu begrenzen ließe die
 *  Seite beim Aktivieren springen. */
const BREITE = "w-full max-w-2xl";

/**
 * Sicheres, responsives Video-Embed (AGE-252 / W4-3). Akzeptiert NUR YouTube- und
 * Vimeo-URLs — `parseVideoUrl` lässt ausschließlich diese Anbieter und valide IDs zu,
 * sodass nie ein beliebiges iframe/Skript eingebettet wird. 16:9.
 * Eine nicht-einbettbare URL ergibt eine klare Fehlermeldung statt eines Embeds.
 *
 * **Einwilligungstor (AGE-611).** Der Rahmen entsteht erst auf Anforderung. Vorher
 * steht eine Fläche aus dem eigenen Ursprung. Der Grund ist nicht Ästhetik: ein
 * `<iframe>` auf den Anbieter löst den Aufruf beim RENDERN aus, mitsamt IP-Adresse
 * — und diese Komponente steht auch auf der öffentlichen Startseite und dem
 * öffentlichen Profil, die ohne Konto erreichbar sind.
 *
 * `loading="lazy"` half dagegen nicht: es verschiebt den Aufruf, es verhindert ihn
 * nicht. Sobald der Rahmen in Sichtweite kommt, geht er hinaus.
 *
 * Bewusst KEIN Vorschaubild vom Anbieter (`img.youtube.com`, `vumbnail.com`): das
 * wäre derselbe Aufruf mit einem anderen Hostnamen. Die Fläche ist deshalb
 * schlichter, als sie sein könnte.
 */
export function VideoEmbed({ url, title = "Video" }: { url: string; title?: string }) {
  const video = parseVideoUrl(url);

  // Die Freigabe hängt seit AGE-621 am ANBIETER und liegt auf dem Endgerät —
  // vorher hing sie an dieser einen URL und starb mit der Instanz. Der Schutz,
  // um den es beim URL-Bezug ging, bleibt: der Profil-Editor schlüsselt seine
  // Zeilen nach Index, und eine geänderte Zeile mit einem noch nicht
  // freigegebenen Anbieter zeigt weiterhin das Tor.
  const freigegeben = useFreigabe(video?.provider ?? null);

  // Getrennt davon: wurde GENAU DIESE Fläche gerade eben angeklickt? Nur dann
  // wird abgespielt und der Fokus geholt. Läge beides am Offen-Sein, spielten
  // beim Seitenaufruf alle Videos einer freigegebenen Seite gleichzeitig los
  // und der Fokus spränge in einen fremden Rahmen.
  const [geklickt, setGeklickt] = useState<string | null>(null);
  const spieltAb = geklickt === url;

  // `|| spieltAb`, nicht nur `freigegeben`: schlägt das Speichern fehl
  // (abgeschotteter Kontext, volles Kontingent), soll der Klick sein Video
  // trotzdem öffnen. Verloren ist dann nur das Merken.
  const offen = freigegeben || spieltAb;

  const rahmen = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Nach dem Austausch fiele der Tastaturfokus sonst auf `document.body` —
    // wer gerade per Tastatur aktiviert hat, stünde nirgends.
    if (spieltAb) rahmen.current?.focus();
  }, [spieltAb]);

  if (!video) {
    return (
      <div
        className={`${BREITE} flex aspect-video items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line bg-soft p-4 text-center text-sm text-muted`}
      >
        Video kann nicht eingebettet werden. Nur YouTube- und Vimeo-Links werden unterstützt.
      </div>
    );
  }

  const anbieter = ANBIETER[video.provider];

  if (!offen) {
    return (
      <div className={`${BREITE} space-y-2`}>
        <button
          type="button"
          onClick={() => {
            setGeklickt(url);
            freigeben(video.provider);
          }}
          className="group flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-[var(--radius-card)] border border-line bg-gradient-to-br from-soft to-chrome transition-colors hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-soft"
        >
          {/* Ohne Vorschaubild vom Anbieter trägt die Fläche nichts als sich
              selbst. Deshalb wenigstens eine erkennbare Abspiel-Geste statt
              eines leeren Rechtecks. */}
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-white shadow-soft transition-transform group-hover:scale-105">
            <Icon name="video" className="h-7 w-7" />
          </span>
          <span className="text-sm font-medium text-ink">Video von {anbieter} laden</span>
        </button>
        {/* Der Verweis liegt AUSSERHALB des Knopfes: ein Link im Knopf ist
            ungültiges Markup und eine Tastaturfalle. */}
        <p className="text-xs text-muted">
          Beim Laden wird eine Verbindung zu {anbieter} hergestellt. Dabei wird Ihre IP-Adresse
          dorthin übertragen. Ihre Entscheidung wird für {anbieter} gespeichert, bis Sie sie
          zurücknehmen.{" "}
          <Link to="/datenschutz" className="underline hover:text-ink">
            Mehr und Widerruf in der Datenschutzerklärung
          </Link>
        </p>
      </div>
    );
  }

  // `autoplay=1` erst hier, nicht in `parseVideoUrl`: das Abspielen ist eine
  // Frage dieser Fläche, die kanonische Grenze bleibt davon unberührt. Ohne den
  // Parameter lädt der Player PAUSIERT und verlangt einen zweiten Klick, diesmal
  // im fremden Rahmen — das Tor hätte die Bedienung verschlechtert.
  //
  // NUR beim frischen Klick (AGE-621). Ein Video, das bloß wegen einer
  // gemerkten Freigabe lädt, hat niemand in diesem Moment angefordert; spielte
  // es ab, liefen beim Seitenaufruf alle Videos der Seite gleichzeitig.
  const src = new URL(video.embedUrl);
  if (spieltAb) src.searchParams.set("autoplay", "1");

  return (
    <div
      className={`${BREITE} relative aspect-video overflow-hidden rounded-[var(--radius-card)] border border-line bg-chrome`}
    >
      <iframe
        ref={rahmen}
        src={src.toString()}
        title={title}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
