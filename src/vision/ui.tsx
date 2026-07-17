import type { ReactNode } from "react";

/**
 * Geteilte Primitives des eff.bee.zee-Dummys. Farben kommen aus den `--ebz-*`
 * CSS-Variablen (siehe theme.ts), damit alle Screens denselben Marken-Look erben.
 */

export function EbzCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-[var(--ebz-line)] bg-[var(--ebz-card)] p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function EbzSectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-lg font-bold text-[var(--ebz-ink)]">{title}</h2>
      {action}
    </div>
  );
}

export function EbzLink({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="text-sm font-semibold text-[var(--ebz-blue)] hover:underline">
      {children} →
    </button>
  );
}

type TagTone = "blue" | "green" | "gold" | "neutral";
const TAG_TONE: Record<TagTone, string> = {
  blue: "bg-[var(--ebz-blue-soft)] text-[var(--ebz-blue)]",
  green: "bg-[var(--ebz-green-soft)] text-[var(--ebz-green)]",
  gold: "bg-[#fbf1d8] text-[#a97f18]",
  neutral: "bg-[#eef1f7] text-[var(--ebz-muted)]",
};

export function EbzTag({ children, tone = "neutral" }: { children: ReactNode; tone?: TagTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TAG_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

/** Grüne „+X P"-Belohnung. */
export function PointsPill({ points }: { points: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--ebz-green-soft)] px-2.5 py-0.5 text-sm font-bold text-[var(--ebz-green)]">
      +{points}&nbsp;P
    </span>
  );
}

/** Initialen-Avatar (kein FBC-Avatar → kein Gold-Ring/Marken-Bleed). */
export function EbzAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--ebz-blue-soft)] font-bold text-[var(--ebz-blue)]"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

/** Kompakte KPI-Kachel (Label oben, große Zahl, optionaler Zusatz). */
export function EbzStat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <EbzCard>
      <p className="text-sm text-[var(--ebz-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-[var(--ebz-ink)]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--ebz-muted)]">{sub}</p>}
    </EbzCard>
  );
}

/** Konzentrischer Fortschrittsring (SVG) — für ActivePoints / Level. */
export function EbzRing({
  value,
  max,
  label,
  centerTop,
  centerBottom,
}: {
  value: number;
  max: number;
  label?: string;
  centerTop: ReactNode;
  centerBottom?: string;
}) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[132px] w-[132px]">
        <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90">
          <circle cx="66" cy="66" r={r} fill="none" stroke="var(--ebz-line)" strokeWidth="10" />
          <circle
            cx="66"
            cy="66"
            r={r}
            fill="none"
            stroke="var(--ebz-blue)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold text-[var(--ebz-ink)]">{centerTop}</span>
          {centerBottom && <span className="text-xs text-[var(--ebz-muted)]">{centerBottom}</span>}
        </div>
      </div>
      {label && <p className="mt-2 text-sm font-semibold text-[var(--ebz-ink)]">{label}</p>}
    </div>
  );
}

/** Schlanke Fortschrittsleiste (Level-Fortschritt etc.). */
export function EbzProgress({ pct }: { pct: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--ebz-line)]">
      <div
        className="h-full rounded-full bg-[var(--ebz-blue)]"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}
