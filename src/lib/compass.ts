import { supabase } from "./supabase";
import {
  COMPASS_SCALE_DEFAULT,
  COMPASS_STEPS,
  type CompassStep,
  type CompassTheme,
} from "../config/compass";

/**
 * Mini-Compass-Onboarding (AGE-243) — Datenschicht.
 *
 * Reine Ableitungslogik (testbar, ohne Supabase) + Persistenz. Der Entwurf wird
 * während des geführten Flows in localStorage gehalten („später fortsetzbar");
 * erst beim Abschluss werden die Antworten in die DB geschrieben und die davon
 * abhängigen Tabellen befüllt:
 *
 *   compass_responses  ← Skala-Antworten je Thema (numerisch → Erfolgsradar)
 *   profile_interests  ← Interessen-Chips
 *   offers / needs     ← „Ich biete" / „Ich suche"-Chips
 *   profiles.dev_focus ← dominantes Thema (hebt profile_completion via Trigger)
 *   profile_theme_scores + potential_score ← recompute_potential_score (AGE-242)
 *
 * Spec: docs/data-model.md §2/§3; Konzept „Mini-Compass" (5–7 Fragen).
 */

const THEME_ORDER: CompassTheme[] = ["sein", "tun", "haben", "wirken"];

/** Entwurfszustand: Skala-Werte und Chip-Auswahlen, je nach Schritt-ID. */
export interface CompassDraft {
  /** stepId → Skalenwert (0–10). */
  scales: Record<string, number>;
  /** stepId → ausgewählte Option-`value`s. */
  chips: Record<string, string[]>;
}

export function emptyDraft(): CompassDraft {
  return { scales: {}, chips: {} };
}

// ── Reine Ableitung (aus Katalog + Entwurf) ──────────────────────────────────

/** Skalenwert eines Schritts; fällt auf den neutralen Default zurück. */
function scaleValue(draft: CompassDraft, stepId: string): number {
  const v = draft.scales[stepId];
  return typeof v === "number" ? v : COMPASS_SCALE_DEFAULT;
}

/** Die in einem Chip-Schritt ausgewählten Optionen (in Katalog-Reihenfolge). */
function selectedOptions(step: Extract<CompassStep, { kind: "chips" }>, draft: CompassDraft) {
  const chosen = new Set(draft.chips[step.id] ?? []);
  return step.options.filter((o) => chosen.has(o.value));
}

/**
 * Dominantes Thema = das am höchsten selbst-eingeschätzte. Bei Gleichstand
 * gewinnt die feste Themen-Reihenfolge (sein → tun → haben → wirken). `null`,
 * wenn der Katalog keine Skala-Schritte enthält.
 */
export function dominantTheme(steps: CompassStep[], draft: CompassDraft): CompassTheme | null {
  const best: Partial<Record<CompassTheme, number>> = {};
  for (const step of steps) {
    if (step.kind !== "scale") continue;
    const v = scaleValue(draft, step.id);
    if (best[step.theme] === undefined || v > best[step.theme]!) best[step.theme] = v;
  }
  let winner: CompassTheme | null = null;
  let winnerVal = -1;
  for (const theme of THEME_ORDER) {
    const v = best[theme];
    if (v !== undefined && v > winnerVal) {
      winner = theme;
      winnerVal = v;
    }
  }
  return winner;
}

export interface CompassResponseRow {
  theme: CompassTheme;
  /** Json-kompatibel: `rating` (numerisch, → Radar) und optional `interests`. */
  answers: Record<string, number | string[]>;
}

/**
 * Eine compass_responses-Zeile je Thema, das eine Skala-Antwort ODER ausgewählte
 * Interessen hat. `rating` (numerisch) speist den Erfolgsradar (recompute mittelt
 * numerische Leaves je Thema); die Interessen-Labels werden als Beleg mitgeführt.
 */
export function deriveCompassRows(steps: CompassStep[], draft: CompassDraft): CompassResponseRow[] {
  const ratings: Partial<Record<CompassTheme, number>> = {};
  for (const step of steps) {
    if (step.kind === "scale") ratings[step.theme] = scaleValue(draft, step.id);
  }

  const interestsByTheme: Partial<Record<CompassTheme, string[]>> = {};
  for (const step of steps) {
    if (step.kind === "chips" && step.target === "interests") {
      for (const opt of selectedOptions(step, draft)) {
        (interestsByTheme[opt.theme] ??= []).push(opt.label);
      }
    }
  }

  const rows: CompassResponseRow[] = [];
  for (const theme of THEME_ORDER) {
    const rating = ratings[theme];
    const interests = interestsByTheme[theme] ?? [];
    if (rating === undefined && interests.length === 0) continue;
    const answers: Record<string, number | string[]> = {};
    if (rating !== undefined) answers.rating = rating;
    if (interests.length > 0) answers.interests = interests;
    rows.push({ theme, answers });
  }
  return rows;
}

export interface DerivedInterest {
  theme: CompassTheme;
  label: string;
}

export function deriveInterests(steps: CompassStep[], draft: CompassDraft): DerivedInterest[] {
  const out: DerivedInterest[] = [];
  for (const step of steps) {
    if (step.kind === "chips" && step.target === "interests") {
      for (const opt of selectedOptions(step, draft))
        out.push({ theme: opt.theme, label: opt.label });
    }
  }
  return out;
}

export interface DerivedMatchItem {
  theme: CompassTheme;
  category: string | null;
  title: string;
}

function deriveMatchItems(
  steps: CompassStep[],
  draft: CompassDraft,
  target: "offers" | "needs",
): DerivedMatchItem[] {
  const out: DerivedMatchItem[] = [];
  for (const step of steps) {
    if (step.kind === "chips" && step.target === target) {
      for (const opt of selectedOptions(step, draft)) {
        out.push({ theme: opt.theme, category: opt.category ?? null, title: opt.label });
      }
    }
  }
  return out;
}

export const deriveOffers = (steps: CompassStep[], draft: CompassDraft) =>
  deriveMatchItems(steps, draft, "offers");
export const deriveNeeds = (steps: CompassStep[], draft: CompassDraft) =>
  deriveMatchItems(steps, draft, "needs");

// ── Persistenz ───────────────────────────────────────────────────────────────

export interface CompassResult {
  completion: number;
  score: number;
  devFocus: CompassTheme | null;
  themeScores: { theme: string; score: number }[];
  interests: string[];
  offers: string[];
  needs: string[];
}

/**
 * Schreibt den Compass ab. „Replace-Collection"-Muster (wie saveProfile): die
 * compass-eigenen Sammlungen des Nutzers werden ersetzt, damit ein erneuter
 * Durchlauf idempotent ist und keine Duplikate erzeugt. In Phase 1 gibt es keinen
 * separaten offers/needs-Editor, daher ist das Ersetzen unkritisch.
 */
export async function saveCompass(
  uid: string,
  steps: CompassStep[],
  draft: CompassDraft,
): Promise<CompassResult> {
  const rows = deriveCompassRows(steps, draft);
  const interests = deriveInterests(steps, draft);
  const offers = deriveOffers(steps, draft);
  const needs = deriveNeeds(steps, draft);
  const focus = dominantTheme(steps, draft);

  // 1. Eigene compass-Sammlungen leeren (idempotenter Neulauf).
  for (const table of ["compass_responses", "profile_interests", "offers", "needs"] as const) {
    const { error } = await supabase.from(table).delete().eq("profile_id", uid);
    if (error) throw error;
  }

  // 2. Abgeleitete Zeilen einfügen (leere Sammlungen überspringen).
  if (rows.length > 0) {
    const { error } = await supabase
      .from("compass_responses")
      .insert(rows.map((r) => ({ profile_id: uid, theme: r.theme, answers: r.answers })));
    if (error) throw error;
  }
  if (interests.length > 0) {
    const { error } = await supabase
      .from("profile_interests")
      .insert(interests.map((i) => ({ profile_id: uid, theme: i.theme, label: i.label })));
    if (error) throw error;
  }
  if (offers.length > 0) {
    const { error } = await supabase
      .from("offers")
      .insert(
        offers.map((o) => ({
          profile_id: uid,
          theme: o.theme,
          category: o.category,
          title: o.title,
        })),
      );
    if (error) throw error;
  }
  if (needs.length > 0) {
    const { error } = await supabase
      .from("needs")
      .insert(
        needs.map((n) => ({
          profile_id: uid,
          theme: n.theme,
          category: n.category,
          title: n.title,
        })),
      );
    if (error) throw error;
  }

  // 3. dev_focus setzen → set_profile_completion-Trigger hebt profile_completion.
  if (focus) {
    const { error } = await supabase.from("profiles").update({ dev_focus: focus }).eq("id", uid);
    if (error) throw error;
  }

  // 4. Impact Score + Erfolgsradar neu berechnen (AGE-242). Best-effort: das
  //    Profil ist bereits persistiert; ein Fehler holt das Dashboard beim nächsten
  //    Laden nach — daher kein throw, aber sichtbares Log.
  const { error: recomputeError } = await supabase.rpc("recompute_potential_score", {
    p_profile_id: uid,
  });
  if (recomputeError) {
    console.error("recompute_potential_score after compass failed:", recomputeError.message);
  }

  // 5. Persistierte Ergebniswerte für die Abschluss-Seite lesen (echte Daten).
  const [profileRes, themeRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("profile_completion, potential_score, dev_focus")
      .eq("id", uid)
      .single(),
    supabase.from("profile_theme_scores").select("theme, score").eq("profile_id", uid),
  ]);
  if (profileRes.error) throw profileRes.error;

  return {
    completion: profileRes.data.profile_completion,
    score: profileRes.data.potential_score,
    devFocus: (profileRes.data.dev_focus as CompassTheme | null) ?? focus,
    themeScores: themeRes.data ?? [],
    interests: interests.map((i) => i.label),
    offers: offers.map((o) => o.title),
    needs: needs.map((n) => n.title),
  };
}

/** Hat der Nutzer den Compass bereits ausgefüllt (≥ 1 gespeicherte Antwort)? */
export const compassStatusQueryKey = (uid: string) => ["compass-status", uid] as const;

export async function fetchCompassStatus(uid: string): Promise<{ hasResponses: boolean }> {
  const { count, error } = await supabase
    .from("compass_responses")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", uid);
  if (error) throw error;
  return { hasResponses: (count ?? 0) > 0 };
}

// ── Entwurf & „übersprungen"-Merker (localStorage, nutzer-spezifisch) ─────────
// Prototyp-Persistenz für „später fortsetzbar": der laufende Entwurf überlebt
// Reload/Skip clientseitig; der Abschluss schreibt in die DB und räumt auf.

const draftKey = (uid: string) => `fbc:compass-draft:${uid}`;
const skipKey = (uid: string) => `fbc:compass-skipped:${uid}`;

export function loadDraft(uid: string): CompassDraft {
  try {
    const raw = localStorage.getItem(draftKey(uid));
    if (!raw) return emptyDraft();
    const parsed = JSON.parse(raw) as Partial<CompassDraft>;
    return {
      scales: parsed.scales && typeof parsed.scales === "object" ? parsed.scales : {},
      chips: parsed.chips && typeof parsed.chips === "object" ? parsed.chips : {},
    };
  } catch {
    return emptyDraft();
  }
}

export function saveDraft(uid: string, draft: CompassDraft): void {
  try {
    localStorage.setItem(draftKey(uid), JSON.stringify(draft));
  } catch {
    // localStorage nicht verfügbar (Privatmodus o. ä.) — Entwurf bleibt im RAM.
  }
}

export function clearDraft(uid: string): void {
  try {
    localStorage.removeItem(draftKey(uid));
  } catch {
    // ignorieren
  }
}

export function markSkipped(uid: string): void {
  try {
    localStorage.setItem(skipKey(uid), "1");
  } catch {
    // ignorieren
  }
}

export function isSkipped(uid: string): boolean {
  try {
    return localStorage.getItem(skipKey(uid)) === "1";
  } catch {
    return false;
  }
}

export function clearSkipped(uid: string): void {
  try {
    localStorage.removeItem(skipKey(uid));
  } catch {
    // ignorieren
  }
}

/** Bequemer Default-Export des Katalogs für die Seite. */
export { COMPASS_STEPS };
