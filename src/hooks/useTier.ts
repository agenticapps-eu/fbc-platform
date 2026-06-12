import { useAuth } from "../providers/auth-context";

/**
 * Liefert die Mitgliedsstufe des aktuellen Nutzers und deren level_rank.
 * Dünner Wrapper um den Auth-Context, damit Gating-Logik nicht den ganzen
 * Auth-Zustand mitziehen muss. Quelle bleibt der AuthProvider.
 */
export function useTier(): { tier: string | null; levelRank: number | null } {
  const { tier, levelRank } = useAuth();
  return { tier, levelRank };
}
