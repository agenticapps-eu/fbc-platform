import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { THEME_LABEL, THEME_ORDER } from "../../lib/dashboard";

/**
 * Erfolgsradar (CORE) — Sein/Tun/Haben/Wirken aus `profile_theme_scores` (Recharts).
 * In ein eigenes Modul ausgelagert, damit der Render im Test gemockt werden kann
 * (Recharts braucht echte Layout-Maße, die jsdom nicht liefert).
 */
export function ErfolgsradarChart({ scores }: { scores: { theme: string; score: number }[] }) {
  const byTheme = new Map(scores.map((s) => [s.theme, s.score]));
  const data = THEME_ORDER.map((theme) => ({
    theme: THEME_LABEL[theme],
    score: byTheme.get(theme) ?? 0,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {/* AGE-450: horizontaler Rand, damit die seitlichen Achsenlabels („Wirken"
            links, „Tun" rechts) nicht am SVG-Rand abgeschnitten werden. */}
        <RadarChart
          data={data}
          outerRadius="72%"
          margin={{ top: 8, right: 28, bottom: 8, left: 28 }}
        >
          <PolarGrid stroke="var(--color-line)" />
          <PolarAngleAxis
            dataKey="theme"
            tick={{ fill: "var(--color-muted)", fontSize: 12, fontWeight: 500 }}
          />
          <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
          <Radar
            dataKey="score"
            stroke="var(--color-accent-strong)"
            fill="var(--color-accent)"
            fillOpacity={0.35}
            strokeWidth={2}
            dot
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
