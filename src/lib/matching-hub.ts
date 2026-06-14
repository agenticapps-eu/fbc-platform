import { categoryLabel } from "../config/matching";
import { supabase } from "./supabase";

/**
 * Matching-Hub (AGE-246) — Datenschicht. Spec: docs/matching-spec.md §5.
 *
 * Liest die EIGENEN `matches` (RLS `matches_select_participant` gibt nur Paare mit
 * Beteiligung des eingeloggten Profils frei) und reichert jede Zeile mit dem
 * Gegenüber an: öffentliche Profilfelder (`profiles_public`) und dessen Biete/Suche
 * (`offers`/`needs` — für Prime+ per RLS lesbar). So entsteht die „Chancen-
 * Datenbank": Such-/Bieteprofil steht im Vordergrund, nicht der Name.
 *
 * Die Route ist Prime+-gegated; ein Discover-Nutzer erreicht sie nicht und bekäme
 * fremde offers/needs auch von der RLS nicht — die Sichtbarkeit ist DB-seitig, nicht
 * im Frontend, garantiert.
 */

// ── basis (jsonb der Engine, AGE-245) ─────────────────────────────────────────
export interface MatchComponent {
  key: string;
  label: string;
  /** Maximalpunkte (= Gewicht in %). */
  weight: number;
  /** Erreichte Punkte (Gewicht × Erfüllungsgrad). */
  points: number;
  /** Optionaler Herleitungstext (nur Komplementarität liefert ihn). */
  detail?: string;
}

export interface ComplementarityPair {
  need: string;
  offer: string;
}

export interface MatchBasis {
  score: number;
  routing: string;
  complementarity_pairs: ComplementarityPair[];
  components: MatchComponent[];
}

/**
 * Validiert die `basis`-jsonb-Spalte defensiv. Bei unerwarteter Form `null`, damit
 * eine Karte den Score trotzdem zeigt (ohne Begründung), statt zu brechen.
 */
export function parseBasis(raw: unknown): MatchBasis | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.components)) return null;

  const components: MatchComponent[] = [];
  for (const c of obj.components) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    if (
      typeof o.key !== "string" ||
      typeof o.label !== "string" ||
      typeof o.weight !== "number" ||
      typeof o.points !== "number"
    ) {
      continue;
    }
    components.push({
      key: o.key,
      label: o.label,
      weight: o.weight,
      points: o.points,
      detail: typeof o.detail === "string" ? o.detail : undefined,
    });
  }

  const pairs: ComplementarityPair[] = Array.isArray(obj.complementarity_pairs)
    ? obj.complementarity_pairs.flatMap((p) => {
        if (!p || typeof p !== "object") return [];
        const pp = p as Record<string, unknown>;
        return typeof pp.need === "string" && typeof pp.offer === "string"
          ? [{ need: pp.need, offer: pp.offer }]
          : [];
      })
    : [];

  return {
    score: typeof obj.score === "number" ? obj.score : 0,
    routing: typeof obj.routing === "string" ? obj.routing : "fbc",
    complementarity_pairs: pairs,
    components,
  };
}

// ── Typen ─────────────────────────────────────────────────────────────────────
export interface HubOffering {
  id: string;
  category: string | null;
  theme: string | null;
  title: string;
}

export interface HubPartner {
  id: string;
  name: string;
  avatar_url: string | null;
  region: string | null;
  company: string | null;
  tier: string | null;
  offers: HubOffering[];
  needs: HubOffering[];
}

/** Bestehende Kontaktanfrage zwischen mir und dem Gegenüber (falls vorhanden). */
export interface HubContactRequest {
  status: string;
  /** True, wenn ICH die Anfrage gestellt habe (sonst hat das Gegenüber angefragt). */
  outgoing: boolean;
}

export interface HubMatch {
  id: string;
  score: number;
  status: string;
  routing: string;
  basis: MatchBasis | null;
  partner: HubPartner;
  contactRequest: HubContactRequest | null;
}

export interface HubStats {
  /** suggested oder requested — laufende Matches. */
  active: number;
  /** status = 'accepted'. */
  successful: number;
  /** Ø-Score über alle Matches mit Beteiligung (0 wenn keine). */
  avgScore: number;
}

export interface MatchingHubData {
  matches: HubMatch[];
  stats: HubStats;
  /** Distinkte Regionen der Gegenüber — speist den Region-Filter. */
  regions: string[];
}

type MatchRow = {
  id: string;
  a_profile_id: string;
  b_profile_id: string;
  score: number;
  basis: unknown;
  status: string;
  routing: string;
};

export function computeHubStats(rows: { score: number; status: string }[]): HubStats {
  if (rows.length === 0) return { active: 0, successful: 0, avgScore: 0 };
  const active = rows.filter((m) => m.status === "suggested" || m.status === "requested").length;
  const successful = rows.filter((m) => m.status === "accepted").length;
  const avgScore = Math.round(rows.reduce((sum, m) => sum + m.score, 0) / rows.length);
  return { active, successful, avgScore };
}

export const matchingHubQueryKey = (uid: string) => ["matching-hub", uid] as const;

/** Lädt die Matches des eigenen Profils samt angereichertem Gegenüber. */
export async function fetchMatchingHub(uid: string): Promise<MatchingHubData> {
  const involvesMe = `a_profile_id.eq.${uid},b_profile_id.eq.${uid}`;
  const contactSides = `from_id.eq.${uid},to_id.eq.${uid}`;

  const matchesRes = await supabase
    .from("matches")
    .select("id, a_profile_id, b_profile_id, score, basis, status, routing")
    .or(involvesMe)
    .order("score", { ascending: false });
  if (matchesRes.error) throw matchesRes.error;

  const rows = (matchesRes.data ?? []) as MatchRow[];
  const stats = computeHubStats(rows);
  if (rows.length === 0) return { matches: [], stats, regions: [] };

  const partnerIds = [
    ...new Set(rows.map((r) => (r.a_profile_id === uid ? r.b_profile_id : r.a_profile_id))),
  ];

  const [profilesRes, offersRes, needsRes, crRes] = await Promise.all([
    supabase
      .from("profiles_public")
      .select("id, name, avatar_url, region, company, tier")
      .in("id", partnerIds),
    supabase
      .from("offers")
      .select("id, profile_id, category, theme, title")
      .in("profile_id", partnerIds)
      .order("created_at"),
    supabase
      .from("needs")
      .select("id, profile_id, category, theme, title")
      .in("profile_id", partnerIds)
      .order("created_at"),
    supabase.from("contact_requests").select("from_id, to_id, status").or(contactSides),
  ]);
  if (profilesRes.error) throw profilesRes.error;

  const profileById = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const offersByProfile = groupByProfile(offersRes.data ?? []);
  const needsByProfile = groupByProfile(needsRes.data ?? []);

  // Kontaktanfragen je Gegenüber (Richtung mitgeführt fürs UI).
  const crByPartner = new Map<string, HubContactRequest>();
  for (const cr of crRes.data ?? []) {
    const other = cr.from_id === uid ? cr.to_id : cr.from_id;
    crByPartner.set(other, { status: cr.status, outgoing: cr.from_id === uid });
  }

  const regions = new Set<string>();
  const matches: HubMatch[] = rows.map((row) => {
    const partnerId = row.a_profile_id === uid ? row.b_profile_id : row.a_profile_id;
    const pub = profileById.get(partnerId);
    if (pub?.region) regions.add(pub.region);
    return {
      id: row.id,
      score: row.score,
      status: row.status,
      routing: row.routing,
      basis: parseBasis(row.basis),
      partner: {
        id: partnerId,
        name: pub?.name ?? "Mitglied",
        avatar_url: pub?.avatar_url ?? null,
        region: pub?.region ?? null,
        company: pub?.company ?? null,
        tier: pub?.tier ?? null,
        offers: offersByProfile.get(partnerId) ?? [],
        needs: needsByProfile.get(partnerId) ?? [],
      },
      contactRequest: crByPartner.get(partnerId) ?? null,
    };
  });

  return {
    matches,
    stats,
    regions: [...regions].sort((a, b) => a.localeCompare(b, "de")),
  };
}

function groupByProfile(
  rows: {
    profile_id: string;
    id: string;
    category: string | null;
    theme: string | null;
    title: string;
  }[],
): Map<string, HubOffering[]> {
  const map = new Map<string, HubOffering[]>();
  for (const r of rows) {
    const list = map.get(r.profile_id) ?? [];
    list.push({ id: r.id, category: r.category, theme: r.theme, title: r.title });
    map.set(r.profile_id, list);
  }
  return map;
}

// ── Begründung („warum dieses Match?", §5) ────────────────────────────────────
/**
 * Kurz-Begründungen für die Komplementarität: je Paar „Biete ↔ Suche" (z. B.
 * „Kapital ↔ Investoren"). Dedupliziert und auf `limit` gekürzt.
 */
export function complementarityReasons(basis: MatchBasis | null, limit = 2): string[] {
  if (!basis) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const pair of basis.complementarity_pairs) {
    const text = `${categoryLabel("offer", pair.offer)} ↔ ${categoryLabel("need", pair.need)}`;
    if (seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

const SECONDARY_LABEL: Record<string, (partner: HubPartner) => string> = {
  theme: () => "Gemeinsames Thema",
  branche: () => "Gleiche Branche",
  region: (p) => (p.region ? `Region ${p.region}` : "Gleiche Region"),
  interests: () => "Gemeinsame Interessen",
  tier: () => "Passende Stufe",
};

/**
 * Sekundäre Begründungen aus den gewichteten Faktoren mit Punkten > 0 (ohne
 * Komplementarität — die zeigt `complementarityReasons`). Reihenfolge folgt dem
 * `basis.components`-Array (Gewicht absteigend).
 */
export function secondaryReasons(basis: MatchBasis | null, partner: HubPartner): string[] {
  if (!basis) return [];
  return basis.components
    .filter((c) => c.key !== "complementarity" && c.points > 0 && SECONDARY_LABEL[c.key])
    .map((c) => SECONDARY_LABEL[c.key](partner));
}

// ── Filter (§5) ───────────────────────────────────────────────────────────────
export interface HubFilters {
  /** "" | sein | tun | haben | wirken — Gegenüber ist in diesem Thema aktiv. */
  theme: string;
  /** "" | `offer:<key>` | `need:<key>` — Gegenüber bietet/sucht diese Kategorie. */
  category: string;
  region: string;
  /** Mindest-Score (0 = alle). */
  minScore: number;
}

export const emptyHubFilters: HubFilters = { theme: "", category: "", region: "", minScore: 0 };

export function hasActiveHubFilters(f: HubFilters): boolean {
  return f.theme !== "" || f.category !== "" || f.region !== "" || f.minScore > 0;
}

/** Wendet die Filter an; die Eingabe ist bereits nach Score sortiert (Top-Matches). */
export function filterMatches(matches: HubMatch[], f: HubFilters): HubMatch[] {
  return matches.filter((m) => {
    if (m.score < f.minScore) return false;
    if (f.region && m.partner.region !== f.region) return false;
    if (f.theme) {
      const inTheme = [...m.partner.offers, ...m.partner.needs].some((o) => o.theme === f.theme);
      if (!inTheme) return false;
    }
    if (f.category) {
      const [side, key] = f.category.split(":");
      const list = side === "offer" ? m.partner.offers : m.partner.needs;
      if (!list.some((o) => o.category === key)) return false;
    }
    return true;
  });
}
