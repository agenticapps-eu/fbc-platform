import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../ui/Button";
import { AvatarCropper } from "../profile/AvatarCropper";
import { useToast } from "../ui/toast-context";
import { useAuth } from "../../providers/auth-context";
import {
  coverSignaturKey,
  signEventCovers,
  uploadEventCover,
  SIGNATUR_STALE_MS,
} from "../../lib/event-cover";

/**
 * Titelbild eines Events auswählen, ersetzen oder entfernen (AGE-531).
 *
 * Der Wert nach außen ist DREIWERTIG und das ist der ganze Punkt:
 *   undefined → unangetastet (Speichern ohne Bildauswahl löscht nichts)
 *   null      → ausdrücklich entfernt
 *   string    → neuer Pfad, bereits hochgeladen
 *
 * Hochgeladen wird beim Bestätigen des Zuschnitts, nicht erst beim Speichern
 * des Events — wie bei Beitragsbildern in C7. Bricht das Speichern danach ab,
 * liegt ein Objekt im Bucket, auf das keine `events.cover_path`-Zeile zeigt;
 * `event_cover_lesbar` findet dafür kein Event, also ist es für niemanden
 * signierbar. Das kostet Speicher und leckt nichts — dieselbe Abwägung wie bei
 * `avatars` (AGE-238), `covers` (C6) und `post-media` (C7).
 */
export function EventCoverPicker({
  initialPath,
  value,
  onChange,
  onBusy,
}: {
  initialPath: string | null;
  value: string | null | undefined;
  onChange: (pfad: string | null) => void;
  /**
   * Meldet dem Formular, dass gerade hochgeladen wird. Ohne das bliebe
   * „Speichern" während des Uploads klickbar — und ein Klick genau dann
   * speicherte das Event OHNE das gewählte Bild, während der Upload weiterläuft
   * und ein Objekt hinterlässt, auf das nie ein Event zeigt. Befund aus dem
   * Diff-Review.
   */
  onBusy?: (laeuft: boolean) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const dateiRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [vorschau, setVorschau] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  // Der aktuell gültige Pfad: der neue, wenn einer gewählt wurde, sonst der
  // bestehende. `value === null` heißt entfernt und schlägt beides.
  const pfad = value === undefined ? initialPath : value;

  // Das BESTEHENDE Bild braucht eine Signatur, das frisch zugeschnittene nicht
  // (es liegt als Blob-URL vor). Deshalb nur dann fragen, wenn keine Vorschau
  // da ist — sonst signierte man ein Objekt, das man gerade selbst erzeugt hat.
  const signatur = useQuery({
    queryKey: coverSignaturKey(user?.id ?? null, pfad ? [pfad] : []),
    queryFn: () => signEventCovers([pfad as string]),
    enabled: !!pfad && !vorschau,
    staleTime: SIGNATUR_STALE_MS,
  });

  useEffect(() => {
    return () => {
      if (vorschau) URL.revokeObjectURL(vorschau);
    };
  }, [vorschau]);

  const bildUrl = vorschau ?? (pfad ? (signatur.data?.[pfad] ?? null) : null);

  async function uebernehmen(blob: Blob, url: string) {
    setPending(null);
    if (!user) return;
    setLaedt(true);
    onBusy?.(true);
    try {
      const neuerPfad = await uploadEventCover(user.id, blob);
      if (vorschau) URL.revokeObjectURL(vorschau);
      setVorschau(url);
      onChange(neuerPfad);
    } catch (e) {
      URL.revokeObjectURL(url);
      toast({
        variant: "error",
        title: "Titelbild konnte nicht hochgeladen werden",
        description: e instanceof Error ? e.message : "Unbekannter Fehler.",
      });
    } finally {
      setLaedt(false);
      onBusy?.(false);
    }
  }

  function entfernen() {
    if (vorschau) URL.revokeObjectURL(vorschau);
    setVorschau(null);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink">Titelbild</span>
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-soft">
        {bildUrl ? (
          <img src={bildUrl} alt="" className="aspect-[3/1] w-full object-cover" />
        ) : (
          <div className="flex aspect-[3/1] w-full items-center justify-center text-xs text-muted">
            Noch kein Titelbild
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          ref={dateiRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPending(f);
            e.target.value = "";
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          disabled={laedt}
          onClick={() => dateiRef.current?.click()}
        >
          {laedt ? "Wird hochgeladen…" : pfad ? "Titelbild ersetzen" : "Titelbild wählen"}
        </Button>
        {pfad && (
          <Button variant="ghost" size="sm" disabled={laedt} onClick={entfernen}>
            Titelbild entfernen
          </Button>
        )}
      </div>
      <p className="text-xs text-muted">Optional. Querformat, wird auf WebP verkleinert.</p>
      {pending && (
        <AvatarCropper
          file={pending}
          aspect={3}
          outWidth={1500}
          label="Titelbild zuschneiden"
          onCancel={() => setPending(null)}
          onConfirm={uebernehmen}
        />
      )}
    </div>
  );
}
