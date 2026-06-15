import { parseVideoUrl } from "../../lib/feed";
import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";
import { VideoEmbed } from "../ui/VideoEmbed";

export interface VideoLinksInputProps {
  value: string[];
  onChange: (next: string[]) => void;
}

/**
 * Editor für die Profil-Videos (AGE-252): geordnete Liste von YouTube-/Vimeo-URLs.
 * Jede Zeile wird live über `parseVideoUrl` geprüft — nur diese beiden Anbieter sind
 * erlaubt. Gültige Links zeigen eine Vorschau (<VideoEmbed>), ungültige eine klare
 * Fehlermeldung. Leere/ungültige Einträge werden beim Speichern verworfen
 * (`sanitizeVideos`), sodass nie eine nicht-einbettbare URL persistiert wird.
 */
export function VideoLinksInput({ value, onChange }: VideoLinksInputProps) {
  function update(index: number, url: string) {
    onChange(value.map((v, i) => (i === index ? url : v)));
  }
  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-4">
      {value.map((url, index) => {
        const trimmed = url.trim();
        const valid = trimmed === "" || parseVideoUrl(trimmed) !== null;
        return (
          <div key={index} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => update(index, e.target.value)}
                placeholder="YouTube- oder Vimeo-Link"
                aria-label={`Video-Link ${index + 1}`}
                aria-invalid={!valid || undefined}
                className={cn(
                  "h-10 w-full rounded-md border bg-canvas px-3 text-sm text-ink transition-colors placeholder:text-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-soft",
                  valid
                    ? "border-line focus-visible:border-gold focus-visible:ring-gold"
                    : "border-danger focus-visible:ring-danger",
                )}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(index)}
                aria-label={`Video ${index + 1} entfernen`}
              >
                Entfernen
              </Button>
            </div>
            {!valid && (
              <p className="text-xs text-danger">
                Nur YouTube- oder Vimeo-Links werden eingebettet.
              </p>
            )}
            {valid && trimmed !== "" && (
              <div className="max-w-md">
                <VideoEmbed url={trimmed} title={`Video ${index + 1}`} />
              </div>
            )}
          </div>
        );
      })}
      <div>
        <Button variant="ghost" size="sm" onClick={() => onChange([...value, ""])}>
          + Video
        </Button>
      </div>
    </div>
  );
}
