import { parseVideoUrl } from "../../lib/feed";

/**
 * Sicheres, responsives Video-Embed (AGE-252 / W4-3). Akzeptiert NUR YouTube- und
 * Vimeo-URLs — `parseVideoUrl` lässt ausschließlich diese Anbieter und valide IDs zu,
 * sodass nie ein beliebiges iframe/Skript eingebettet wird. 16:9, lazy geladen.
 * Eine nicht-einbettbare URL ergibt eine klare Fehlermeldung statt eines Embeds.
 */
export function VideoEmbed({ url, title = "Video" }: { url: string; title?: string }) {
  const video = parseVideoUrl(url);
  if (!video) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line bg-soft p-4 text-center text-sm text-muted">
        Video kann nicht eingebettet werden. Nur YouTube- und Vimeo-Links werden unterstützt.
      </div>
    );
  }
  return (
    <div className="relative aspect-video overflow-hidden rounded-[var(--radius-card)] border border-line bg-night">
      <iframe
        src={video.embedUrl}
        title={title}
        loading="lazy"
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
