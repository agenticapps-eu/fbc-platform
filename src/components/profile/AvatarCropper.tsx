import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Button } from "../ui/Button";

const VIEW = 288; // Anzeigegröße des quadratischen Ausschnitts (px)
const OUT = 512; // Kantenlänge des exportierten Avatars (px)

export interface AvatarCropperProps {
  file: File;
  onCancel: () => void;
  onConfirm: (blob: Blob, previewUrl: string) => void;
}

/**
 * Dependency-freier quadratischer Zuschnitt: Bild laden, per Zoom-Slider und
 * Ziehen positionieren, auf 512×512 (webp) exportieren. Das Bild deckt den
 * Ausschnitt immer vollständig ab (kein Rand).
 */
export function AvatarCropper({ file, onCancel, onConfirm }: AvatarCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const baseScaleRef = useRef(1);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Bild aus der gewählten Datei laden, Basis-Skalierung („cover“) bestimmen.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      baseScaleRef.current = VIEW / Math.min(img.naturalWidth, img.naturalHeight);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setReady(true);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Hält den Offset so, dass das (mit Zoom z skalierte) Bild den Ausschnitt füllt.
  function clampFor(x: number, y: number, z: number) {
    const img = imgRef.current;
    const scale = baseScaleRef.current * z;
    const w = (img?.naturalWidth ?? 0) * scale;
    const h = (img?.naturalHeight ?? 0) * scale;
    return { x: Math.min(0, Math.max(VIEW - w, x)), y: Math.min(0, Math.max(VIEW - h, y)) };
  }

  // Live-Vorschau zeichnen.
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !ready) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = baseScaleRef.current * zoom;
    ctx.clearRect(0, 0, VIEW, VIEW);
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
    const out = document.createElement("canvas");
    out.width = OUT;
    out.height = OUT;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    const scale = baseScaleRef.current * zoom;
    const ratio = OUT / VIEW;
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
      aria-label="Avatar zuschneiden"
    >
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-canvas p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-ink">Avatar zuschneiden</h2>
        <p className="mt-1 text-sm text-muted">Ziehen zum Verschieben, Slider zum Zoomen.</p>

        <div className="mt-4 flex justify-center">
          <canvas
            ref={canvasRef}
            width={VIEW}
            height={VIEW}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="touch-none cursor-grab rounded-full border border-line bg-soft active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW }}
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
