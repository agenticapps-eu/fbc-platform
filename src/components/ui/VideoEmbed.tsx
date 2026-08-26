import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { parseVideoUrl } from "../../lib/feed";
import { Icon } from "./icons";

const ANBIETER = { youtube: "YouTube", vimeo: "Vimeo" } as const;

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
  // Die Freigabe hängt an der URL, NICHT an der Instanz. Der Profil-Editor
  // schlüsselt seine Zeilen nach Index: hinge sie an der Instanz, lüde eine
  // geänderte Zeile den neuen Anbieter ohne neue Aktivierung. Gefunden in der
  // Plan-Review, bevor es Code gab.
  const [freigegeben, setFreigegeben] = useState<string | null>(null);
  const rahmen = useRef<HTMLIFrameElement>(null);
  const offen = freigegeben === url;

  useEffect(() => {
    // Nach dem Austausch fiele der Tastaturfokus sonst auf `document.body` —
    // wer gerade per Tastatur aktiviert hat, stünde nirgends.
    if (offen) rahmen.current?.focus();
  }, [offen]);

  const video = parseVideoUrl(url);
  if (!video) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line bg-soft p-4 text-center text-sm text-muted">
        Video kann nicht eingebettet werden. Nur YouTube- und Vimeo-Links werden unterstützt.
      </div>
    );
  }

  const anbieter = ANBIETER[video.provider];

  if (!offen) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setFreigegeben(url)}
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
          dorthin übertragen.{" "}
          <Link to="/datenschutz" className="underline hover:text-ink">
            Mehr in der Datenschutzerklärung
          </Link>
        </p>
      </div>
    );
  }

  // `autoplay=1` erst hier, nicht in `parseVideoUrl`: das Abspielen ist eine
  // Frage dieser Fläche, die kanonische Grenze bleibt davon unberührt. Ohne den
  // Parameter lädt der Player PAUSIERT und verlangt einen zweiten Klick, diesmal
  // im fremden Rahmen — das Tor hätte die Bedienung verschlechtert.
  const src = new URL(video.embedUrl);
  src.searchParams.set("autoplay", "1");

  return (
    <div className="relative aspect-video overflow-hidden rounded-[var(--radius-card)] border border-line bg-chrome">
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
