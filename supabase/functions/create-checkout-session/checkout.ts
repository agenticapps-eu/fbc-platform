export const PAID_LEVELS = ["discover", "exchange", "focus", "impact"] as const;
export type PaidLevel = (typeof PAID_LEVELS)[number];
export type Interval = "month" | "year";

export const LEVEL_RANK: Record<string, number> = {
  basic: 1,
  connect: 2,
  discover: 3,
  exchange: 4,
  focus: 5,
  impact: 6,
};

export interface UpgradeRequest {
  level: PaidLevel;
  interval: Interval;
}
type ParseResult = { ok: true; value: UpgradeRequest } | { ok: false; error: string };

export function parseUpgradeRequest(body: unknown, currentRank: number): ParseResult {
  const b = body as Record<string, unknown> | null;
  const level = b?.level;
  const interval = b?.interval;
  if (typeof level !== "string" || !(PAID_LEVELS as readonly string[]).includes(level)) {
    return { ok: false, error: "invalid_level" };
  }
  if (interval !== "month" && interval !== "year") {
    return { ok: false, error: "invalid_interval" };
  }
  if (LEVEL_RANK[level] <= currentRank) {
    return { ok: false, error: "not_an_upgrade" };
  }
  return { ok: true, value: { level: level as PaidLevel, interval } };
}

export function priceEnvKey(level: PaidLevel, interval: Interval): string {
  return `STRIPE_PRICE_${level.toUpperCase()}_${interval === "year" ? "YEAR" : "MONTH"}`;
}

/**
 * Rücksprung-Basis-URL für success/cancel: die Request-`Origin`, wenn sie in der
 * Allowlist steht, sonst der erste Allowlist-Eintrag (Fallback). So funktionieren
 * lokal (localhost:5173) UND die gehostete Demo, ohne Open-Redirect — eine fremde
 * Origin kann den Rücksprung nie auf ihre Domain lenken. Trailing Slashes werden
 * normalisiert, damit `${base}/mitgliedschaft…` keinen Doppel-Slash erzeugt.
 */
export function resolveReturnBase(origin: string | null, allowed: string[]): string {
  const list = allowed.map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
  const o = (origin ?? "").trim().replace(/\/+$/, "");
  if (o && list.includes(o)) return o;
  return list[0] ?? "http://localhost:5173";
}
