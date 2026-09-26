/**
 * Die kaufbaren Stufen — seit AGE-903 genau die drei CLUBSTUFEN. ACTIVE, BOOST
 * und CONNECT liegen ausserhalb des Clubs und tragen 0 €; eine Stufe ohne
 * Funktion und ohne Preis hat keinen Kaufweg.
 *
 * **Stripe ruht (Apple 3.1.1), und das bleibt so.** Diese Datei wird nur so weit
 * nachgezogen, dass nichts bricht und dass die Liste nicht als Beleg für eine
 * Leiter gelesen wird, die es nicht mehr gibt.
 *
 * ACHTUNG BEIM WIEDERANSCHALTEN: `priceEnvKey()` leitet den Namen der
 * Umgebungsvariablen aus dem SCHLÜSSEL ab. Mit `exchange` ist
 * `STRIPE_PRICE_EXCHANGE_*` verschwunden, und `STRIPE_PRICE_DISCOVER_*` meint
 * jetzt 300 €/30 € statt 150 €/15 € — derselbe Variablenname, ein anderer
 * Preis. Wer alte Werte weiterverwendet, verkauft die Clubstufe zum halben
 * Preis, und zwar ohne Fehlermeldung.
 */
export const PAID_LEVELS = ["discover", "focus", "impact"] as const;
export type PaidLevel = (typeof PAID_LEVELS)[number];
export type Interval = "month" | "year";

/** Spiegelt `membership_tiers.level_rank` (AGE-903). `connect` und `discover`
 *  tragen hier ANDERE Zahlen als vor dieser Umstellung (2→3 bzw. 3→4). */
export const LEVEL_RANK: Record<string, number> = {
  active: 1,
  boost: 2,
  connect: 3,
  discover: 4,
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
 * Liest den `sub`-Claim (User-ID) aus einem JWT, OHNE die Signatur zu prüfen.
 * Sicher nur, weil das Edge-Gateway (verify_jwt=true) das Token vorher
 * vollständig verifiziert — ungültige/abgelaufene Tokens erreichen die Funktion
 * nie. Gibt undefined zurück, wenn das Token unlesbar ist oder keinen
 * String-`sub` trägt. Payload ist base64url-kodiert.
 */
export function jwtSub(jwt: string): string | undefined {
  const seg = jwt.split(".")[1];
  if (!seg) return undefined;
  const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  try {
    const payload = JSON.parse(atob(b64 + pad));
    return typeof payload?.sub === "string" ? payload.sub : undefined;
  } catch {
    return undefined;
  }
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
