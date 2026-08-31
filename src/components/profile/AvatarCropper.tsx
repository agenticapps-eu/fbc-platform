import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "../ui/Button";
import { useOverlay } from "../ui/useOverlay";

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
  // Nur montiert, solange zugeschnitten wird — daher fest `true` (AGE-529).
  // Hier stört das Hintergrund-Scrollen am meisten: man ZIEHT in diesem Overlay.
  const overlay = useOverlay(true, onCancel);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  const [ready, setReady] = useState(false);
  /** Gesetzt, wenn der Browser die Datei nicht dekodieren konnte. */
  const [fehler, setFehler] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // Die natürliche Bildgröße als STATE, nicht als ref: die Geometrie hängt
  // daran, und eine Ref, die während des Renderings gelesen wird, ließe die
  // Canvas-Maße beim Wechsel des Seitenverhältnisses stehen (React-Regel:
  // „Cannot access refs during render", und sie hat hier recht).
  const [natural, setNatural] = useState({ width: 0, height: 0 });

  const geo = cropGeometry({
    aspect,
    outWidth,
    naturalWidth: natural.width,
    naturalHeight: natural.height,
  });
  const { viewWidth, viewHeight } = geo;

  // Bild aus der gewählten Datei laden, Basis-Skalierung („cover“) bestimmen.
  //
  // MIT `onerror`, und das ist der Punkt: vorher gab es nur `onload`. Konnte der
  // Browser die Datei nicht dekodieren, feuerte gar nichts — `ready` blieb
  // false, der Dialog zeigte eine leere Fläche und einen toten
  // „Übernehmen"-Knopf, ohne ein Wort. Für das Mitglied sah das aus, als liesse
  // sich schlicht kein Bild hochladen (gemeldet 17.08. aus der Probe-Umgebung).
  //
  // Die Ursache ist zusätzlich an der Wurzel behoben: die Dateifelder nennen
  // jetzt die Formate einzeln statt `image/*`, damit der Dialog HEIC vom iPhone
  // gar nicht erst anbietet. Dieser Zweig bleibt trotzdem — `accept` ist ein
  // Vorschlag an den Dialog, keine Zusage: Ziehen-und-Ablegen und „alle
  // Dateien" gehen daran vorbei.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNatural({ width: img.naturalWidth, height: img.naturalHeight });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      // Zurücksetzen im ERFOLGSPFAD, nicht im Effektkörper: ein synchrones
      // setState im Effekt löst eine Kaskade aus (react-hooks/set-state-in-effect).
      setFehler(null);
      setReady(true);
    };
    img.onerror = () => {
      imgRef.current = null;
      setReady(false);
      setFehler(
        "Dieses Bild konnte nicht gelesen werden. Fotos vom iPhone liegen oft als " +
          "HEIC vor — bitte als JPG oder PNG auswählen.",
      );
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function clampFor(x: number, y: number, z: number) {
    return geo.clamp(x, y, z);
  }

  // Live-Vorschau zeichnen.
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !ready) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = geo.baseScale * zoom;
    ctx.clearRect(0, 0, geo.viewWidth, geo.viewHeight);
    ctx.drawImage(img, offset.x, offset.y, img.naturalWidth * scale, img.naturalHeight * scale);
  }, [offset, zoom, ready, geo]);

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

  // PORTAL an document.body, und das ist keine Kosmetik: ein transformierter
  // Vorfahre wird zum Containing Block für `position: fixed`. `.fbc-card:hover`
  // setzt `transform: translateY(-2px)` (src/index.css:246) — steht dieser
  // Dialog also in einer Karte und zeigt die Maus darauf, schrumpft er auf die
  // Karte statt den Bildschirm zu füllen.
  //
  // GEMESSEN am 2026-08-12 im Browser, als der Zuschnitt in den Host-Werkzeugen
  // eines Events landete (Karte → EventForm → EventCoverPicker → hier):
  // 1063×1272 bei y = −654 statt 1400×1000 bei 0. jsdom kennt kein Layout und
  // kann das nie sehen; gefunden hat es die Sichtprobe.
  return createPortal(
    <div
      ref={overlay}
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-canvas p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-ink">{label}</h2>
        <p className="mt-1 text-sm text-muted">
          {fehler ?? "Ziehen zum Verschieben, Slider zum Zoomen."}
        </p>

        {/* Die Fläche bleibt bei einem Lesefehler weg: ein leerer Kreis neben
            der Meldung sähe aus, als fehlte nur noch ein Klick.
            BEDINGT GERENDERT, nicht per `hidden` umgeschaltet: `hidden` und
            `flex` auf demselben Element entscheidet die CSS-Reihenfolge, nicht
            die Klassenreihenfolge — in diesem Projekt schon einmal passiert. */}
        {!fehler && (
          <>
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
          </>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!ready}>
            Übernehmen
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
