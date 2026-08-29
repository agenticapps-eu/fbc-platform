import { supabase } from "./supabase";
import type { Database } from "./database.types";

/**
 * „Mein Bereich"-Dashboard (AGE-240) — Datenschicht. Spec: docs/profile-spec.md §3–5.
 *
 * Lädt ausschließlich das EIGENE Profil (die Seite liegt hinter `requiresAuth`,
 * `uid === auth.uid()`). Alle Abfragen laufen in EINEM `Promise.all` — keine
 * Wasserfälle, Counts über `head`-Queries. Was die RLS nicht freigibt, kommt als
 * 0 Zeilen zurück; CORE-Widgets zeigen dann einen Leerzustand, niemals Fake-Daten.
 *
 * Bewusst NICHT geladen (RLS lässt es am eigenen Profil nicht sinnvoll zu / kein
 * Datenmodell): Likes/Views fremder Nutzer auf eigene Beiträge (`post_likes` ist
 * owner-only sichtbar), sowie die DEMO-Widgets (Communities, Statistik, Projekte,
 * Investments, KI-Assistent, Netzwerk-Kategorien) — die füllt Phase 2.
 */

// Sein · Tun · Haben · Wirken — Reihenfolge & Labels für Radar/Interessen.
export const THEME_ORDER = ["sein", "tun", "haben", "wirken"] as const;
export type Theme = (typeof THEME_ORDER)[number];
export const THEME_LABEL: Record<string, string> = {
  sein: "Sein",
  tun: "Tun",
  haben: "Haben",
  wirken: "Wirken",
};

type ThemeScoreRow = Pick<
  Database["public"]["Tables"]["profile_theme_scores"]["Row"],
  "theme" | "score"
>;
type InterestRow = Pick<
  Database["public"]["Tables"]["profile_interests"]["Row"],
  "theme" | "label"
>;
type GoalRow = Pick<
  Database["public"]["Tables"]["goals"]["Row"],
  "category" | "title" | "progress"
>;
type MatchingRow = {
  id: string;
  category: string | null;
  theme: string | null;
  title: string;
};
type PostRow = Pick<
  Database["public"]["Tables"]["posts"]["Row"],
  "id" | "body" | "hashtags" | "created_at" | "visibility" | "veroeffentlicht_ab"
>;

export interface DashboardProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  cover_url: string | null;
  region: string | null;
  company: string | null;
  short_bio: string | null;
  tier: string;
  roles: string[];
  headline: string | null;
  member_number: string | null;
  member_since: string | null;
  potential_score: number;
  /** Profilvollständigkeit 0–100 (DB-Trigger set_profile_completion). */
  profile_completion: number;
  dev_focus: string | null;
  dev_progress: number;
  next_steps: string[];
}

export interface MatchStats {
  /** Vorgeschlagen oder angefragt — laufende Matches. */
  active: number;
  /** status = 'accepted'. */
  successful: number;
  /** Ø-Score über alle Matches mit Beteiligung (0 wenn keine). */
  avgScore: number;
}

export interface DashboardEvent {
  status: string;
  checked_in: boolean;
  event: {
    id: string;
    title: string;
    type: string | null;
    starts_at: string | null;
    location: string | null;
  } | null;
}

export interface DashboardBadge {
  key: string;
  label: string;
  icon: string | null;
  awarded_at: string;
}

/** Eine der fünf gewichteten Komponenten des Impact Scores (AGE-242). */
export interface ScoreComponent {
  key: string;
  label: string;
  /** Maximalpunkte (= Gewicht in %). */
  weight: number;
  /** Erreichte Punkte (Gewicht × Erfüllungsgrad), 1 Nachkommastelle. */
  points: number;
  /** Menschenlesbare Herleitung, z. B. „3/4 Themen beantwortet“. */
  detail: string;
}

/** Transparente Aufschlüsselung des Impact Scores (Rückgabe der RPC). */
export interface ScoreBreakdown {
  score: number;
  components: ScoreComponent[];
}

/**
 * Validiert die jsonb-Rückgabe von `recompute_potential_score`. Defensiv: bei
 * unerwarteter Form `null`, damit das Dashboard den Score trotzdem zeigt (ohne
 * Aufschlüsselung), statt zu brechen.
 */
export function parseScoreBreakdown(raw: unknown): ScoreBreakdown | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.score !== "number" || !Array.isArray(obj.components)) return null;
  const components: ScoreComponent[] = [];
  for (const c of obj.components) {
    if (!c || typeof c !== "object") return null;
    const o = c as Record<string, unknown>;
    if (
      typeof o.key !== "string" ||
      typeof o.label !== "string" ||
      typeof o.weight !== "number" ||
      typeof o.points !== "number" ||
      typeof o.detail !== "string"
    ) {
      return null;
    }
    components.push({
      key: o.key,
      label: o.label,
      weight: o.weight,
      points: o.points,
      detail: o.detail,
    });
  }
  return { score: obj.score, components };
}

export interface DashboardData {
  profile: DashboardProfile;
  themeScores: ThemeScoreRow[];
  /** Aufschlüsselung des Impact Scores; null, wenn die RPC nicht lief/parste. */
  scoreBreakdown: ScoreBreakdown | null;
  interests: InterestRow[];
  goals: GoalRow[];
  offers: MatchingRow[];
  needs: MatchingRow[];
  badges: DashboardBadge[];
  matchStats: MatchStats;
  /** Angenommene Kontaktanfragen (= bestätigte Kontakte). */
  contactsCount: number;
  /** Eigene Event-Registrierungen (Anzahl für die Stat-Tile). */
  eventsCount: number;
  events: DashboardEvent[];
  /** Events, die ich selbst hoste (host_id = uid). */
  hostedEvents: {
    id: string;
    title: string;
    type: string | null;
    starts_at: string | null;
    location: string | null;
  }[];
  posts: PostRow[];
}

export const dashboardQueryKey = (uid: string) => ["dashboard", uid] as const;

function computeMatchStats(rows: { score: number; status: string }[]): MatchStats {
  if (rows.length === 0) return { active: 0, successful: 0, avgScore: 0 };
  const active = rows.filter((m) => m.status === "suggested" || m.status === "requested").length;
  const successful = rows.filter((m) => m.status === "accepted").length;
  const avgScore = Math.round(rows.reduce((sum, m) => sum + m.score, 0) / rows.length);
  return { active, successful, avgScore };
}

/**
 * Lädt alle CORE-Daten des eigenen Dashboards parallel. `uid` ist das eigene
 * Profil (RLS-geprüft über `auth.uid()`).
 */
export async function fetchDashboard(uid: string): Promise<DashboardData> {
  const involvesMe = `a_profile_id.eq.${uid},b_profile_id.eq.${uid}`;
  const contactSides = `from_id.eq.${uid},to_id.eq.${uid}`;

  // On-demand-Neuberechnung beim Laden (AGE-242): aktualisiert potential_score
  // und profile_theme_scores aus echten Daten, BEVOR wir sie lesen. Schlägt die
  // RPC fehl, zeigen wir den gespeicherten Score ohne Aufschlüsselung — kein Bruch.
  const breakdownRes = await supabase.rpc("recompute_potential_score", {
    p_profile_id: uid,
  });
  const scoreBreakdown = breakdownRes.error ? null : parseScoreBreakdown(breakdownRes.data);

  const [
    profileRes,
    themeRes,
    interestsRes,
    goalsRes,
    offersRes,
    needsRes,
    badgesRes,
    matchesRes,
    contactsRes,
    eventsRes,
    eventsCountRes,
    postsRes,
    hostedRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, name, avatar_url, cover_url, region, company, short_bio, tier, roles, headline, member_number, member_since, potential_score, profile_completion, dev_focus, dev_progress, next_steps",
      )
      .eq("id", uid)
      .single(),
    supabase.from("profile_theme_scores").select("theme, score").eq("profile_id", uid),
    supabase.from("profile_interests").select("theme, label").eq("profile_id", uid).order("label"),
    supabase.from("goals").select("category, title, progress").eq("profile_id", uid),
    supabase
      .from("offers")
      .select("id, category, theme, title")
      .eq("profile_id", uid)
      .order("created_at"),
    supabase
      .from("needs")
      .select("id, category, theme, title")
      .eq("profile_id", uid)
      .order("created_at"),
    supabase
      .from("profile_badges")
      .select("awarded_at, badges(key, label, icon)")
      .eq("profile_id", uid)
      .order("awarded_at"),
    supabase.from("matches").select("score, status").or(involvesMe),
    supabase
      .from("contact_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(contactSides),
    supabase
      .from("event_registrations")
      .select("status, checked_in, events(id, title, type, starts_at, location)")
      .eq("profile_id", uid)
      .order("created_at", { ascending: false }),
    supabase
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", uid),
    supabase
      .from("posts")
      .select("id, body, hashtags, created_at, visibility, veroeffentlicht_ab")
      .eq("author_id", uid)
      // Nur Mitgliedsbeitraege (AGE-533): ein Event-Beitrag traegt einen leeren
      // Body und erschiene hier als leere Karte — und wuerde bei `limit(4)`
      // einen echten Beitrag verdraengen.
      .eq("kind", "member")
      // AGE-667: dieselbe Ordnung wie im Feed — sonst gaebe es zwei Antworten
      // auf die Frage, welcher der neueste eigene Beitrag ist.
      .order("veroeffentlicht_ab", { ascending: false })
      .limit(4),
    supabase
      .from("events")
      .select("id, title, type, starts_at, location")
      .eq("host_id", uid)
      .order("starts_at", { ascending: true, nullsFirst: true }),
  ]);

  if (profileRes.error) throw profileRes.error;

  const p = profileRes.data;
  const profile: DashboardProfile = {
    id: p.id,
    name: p.name ?? "Mitglied",
    avatar_url: p.avatar_url,
    cover_url: p.cover_url,
    region: p.region,
    company: p.company,
    short_bio: p.short_bio,
    tier: p.tier,
    roles: p.roles ?? [],
    headline: p.headline,
    member_number: p.member_number,
    member_since: p.member_since,
    potential_score: p.potential_score,
    profile_completion: p.profile_completion ?? 0,
    dev_focus: p.dev_focus,
    dev_progress: p.dev_progress ?? 0,
    next_steps: p.next_steps ?? [],
  };

  const badges: DashboardBadge[] = (badgesRes.data ?? [])
    .filter((row) => row.badges)
    .map((row) => ({
      key: row.badges!.key,
      label: row.badges!.label,
      icon: row.badges!.icon,
      awarded_at: row.awarded_at,
    }));

  const events: DashboardEvent[] = (eventsRes.data ?? []).map((row) => ({
    status: row.status,
    checked_in: row.checked_in,
    event: row.events
      ? {
          id: row.events.id,
          title: row.events.title,
          type: row.events.type,
          starts_at: row.events.starts_at,
          location: row.events.location,
        }
      : null,
  }));

  return {
    profile,
    themeScores: themeRes.data ?? [],
    scoreBreakdown,
    interests: interestsRes.data ?? [],
    goals: goalsRes.data ?? [],
    offers: offersRes.data ?? [],
    needs: needsRes.data ?? [],
    badges,
    matchStats: computeMatchStats(matchesRes.data ?? []),
    contactsCount: contactsRes.count ?? 0,
    eventsCount: eventsCountRes.count ?? 0,
    events,
    hostedEvents: hostedRes.data ?? [],
    posts: postsRes.data ?? [],
  };
}
