import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Button } from "../ui/Button";

const VIEW_WIDTH = 288; // Anzeigebreite des Ausschnitts (px) — die Höhe folgt dem Seitenverhältnis

export interface CropGeometry {
  viewWidth: number;
  viewHeight: number;
  outWidth: number;
  outHeight: number;
  /** Skalierung, bei der das Bild den Ausschnitt gerade vollständig deckt. */
  baseScale: number;
  /** Hält den Versatz so, dass das (mit Zoom z skalierte) Bild den Ausschnitt füllt. */
  clamp: (x: number, y: number, z: number) => { x: number; y: number };
}

/**
 * Die Rechnung hinter dem Zuschnitt, ohne DOM — damit sie prüfbar ist. jsdom hat
 * keinen 2D-Kontext, ein Render-Test könnte also nur behaupten, dass die
 * Komponente nicht wirft.
 *
 * `baseScale` deckt den Ausschnitt IMMER vollständig ab (kein Rand): maßgeblich
 * ist die knappere der beiden Kanten. Solange der Ausschnitt quadratisch war,
 * fielen „knappere Kante" und „kleinere Bildseite" zusammen — bei 3:1 nicht mehr,
 * und `VIEW / Math.min(w, h)` lieferte dort ein Loch.
 */
export function cropGeometry({
  aspect,
  outWidth,
  naturalWidth = 0,
  naturalHeight = 0,
}: {
  aspect: number;
  outWidth: number;
  naturalWidth?: number;
  naturalHeight?: number;
}): CropGeometry {
  const viewWidth = VIEW_WIDTH;
  const viewHeight = Math.round(VIEW_WIDTH / aspect);
  const baseScale =
    naturalWidth > 0 && naturalHeight > 0
      ? Math.max(viewWidth / naturalWidth, viewHeight / naturalHeight)
      : 1;
  return {
    viewWidth,
    viewHeight,
    outWidth,
    outHeight: Math.round(outWidth / aspect),
    baseScale,
    clamp: (x, y, z) => {
      const w = naturalWidth * baseScale * z;
      const h = naturalHeight * baseScale * z;
      return {
        x: Math.min(0, Math.max(viewWidth - w, x)),
        y: Math.min(0, Math.max(viewHeight - h, y)),
      };
    },
  };
}

export interface AvatarCropperProps {
  file: File;
  onCancel: () => void;
  onConfirm: (blob: Blob, previewUrl: string) => void;
  /** Breite/Höhe des Ausschnitts. 1 = quadratisch (Avatar), 3 = Hintergrundbild. */
  aspect?: number;
  /** Breite des exportierten Bildes in px; die Höhe folgt dem Seitenverhältnis. */
  outWidth?: number;
  /** Überschrift des Dialogs. */
  label?: string;
}

/**
 * Dependency-freier quadratischer Zuschnitt: Bild laden, per Zoom-Slider und
 * Ziehen positionieren, auf 512×512 (webp) exportieren. Das Bild deckt den
 * Ausschnitt immer vollständig ab (kein Rand).
 */
export function AvatarCropper({
  file,
  onCancel,
  onConfirm,
  aspect = 1,
  outWidth = 512,
  label = "Avatar zuschneiden",
}: AvatarCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const geoRef = useRef<CropGeometry>(cropGeometry({ aspect, outWidth }));
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const { viewWidth, viewHeight } = geoRef.current;

  // Bild aus der gewählten Datei laden, Basis-Skalierung („cover“) bestimmen.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      geoRef.current = cropGeometry({
        aspect,
        outWidth,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setReady(true);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, aspect, outWidth]);

  function clampFor(x: number, y: number, z: number) {
    return geoRef.current.clamp(x, y, z);
  }

  // Live-Vorschau zeichnen.
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !ready) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const geo = geoRef.current;
    const scale = geo.baseScale * zoom;
    ctx.clearRect(0, 0, geo.viewWidth, geo.viewHeight);
    ctx.drawImage(img, offset.x, offset.y, img.naturalWidth * scale, img.naturalHeight * scale);
  }, [offset, zoom, ready]);

  function changeZoom(z: number) {
    setZoom(z);
    setOffset((current) => clampFor(current.x, current.y, z));
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startY: event.clientY, ox: offset.x, oy: offset.y };
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    setOffset(
      clampFor(
        drag.ox + (event.clientX - drag.startX),
        drag.oy + (event.clientY - drag.startY),
        zoom,
      ),
    );
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function handleConfirm() {
    const img = imgRef.current;
    if (!img) return;
    const geo = geoRef.current;
    const out = document.createElement("canvas");
    out.width = geo.outWidth;
    out.height = geo.outHeight;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    const scale = geo.baseScale * zoom;
    const ratio = geo.outWidth / geo.viewWidth;
    ctx.drawImage(
      img,
      offset.x * ratio,
      offset.y * ratio,
      img.naturalWidth * scale * ratio,
      img.naturalHeight * scale * ratio,
    );
    out.toBlob(
      (blob) => {
        if (blob) onConfirm(blob, URL.createObjectURL(blob));
      },
      "image/webp",
      0.9,
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-canvas p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-ink">{label}</h2>
        <p className="mt-1 text-sm text-muted">Ziehen zum Verschieben, Slider zum Zoomen.</p>

        <div className="mt-4 flex justify-center">
          <canvas
            ref={canvasRef}
            width={viewWidth}
            height={viewHeight}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className={`touch-none cursor-grab border border-line bg-soft active:cursor-grabbing ${
              aspect === 1 ? "rounded-full" : "rounded-[var(--radius-card)]"
            }`}
            style={{ width: viewWidth, height: viewHeight }}
          />
        </div>

        <label className="mt-4 flex items-center gap-3 text-sm text-muted">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => changeZoom(Number(e.target.value))}
            className="flex-1 accent-accent-strong"
            aria-label="Zoom"
          />
        </label>

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!ready}>
            Übernehmen
          </Button>
        </div>
      </div>
    </div>
  );
}
