import type { AuthError, Session, User } from "@supabase/supabase-js";
import { createContext, useContext } from "react";

export interface AuthContextValue {
  /** Aktuelle Supabase-Session, oder null wenn ausgeloggt. */
  session: Session | null;
  /** Angemeldeter Nutzer, oder null. */
  user: User | null;
  /** Mitgliedsstufe (membership_tiers.key), z. B. "basic". null wenn ausgeloggt. */
  tier: string | null;
  /** level_rank der Mitgliedsstufe (discover=1 … legacy=7). null wenn ausgeloggt. */
  levelRank: number | null;
  /**
   * Staff-Rolle aus `staff_roles` (matching_manager/admin) oder null. Server-
   * kontrolliert, NICHT aus dem frei editierbaren profiles.roles (AGE-249, §8).
   */
  staffRole: string | null;
  /** true bis die Session beim Start aufgelöst ist (nur Session, nicht das Profil). */
  isLoading: boolean;
  /** true während für den eingeloggten Nutzer tier/level_rank/staffRole nachgeladen werden. */
  tierLoading: boolean;
  /**
   * Legt ein Konto an. `fullName` geht als `full_name` in die User-Metadaten und
   * wird vom Signup-Trigger nach `profiles.name` übernommen (AGE-437) — ohne ihn
   * bliebe das Mitglied im Verzeichnis namenlos.
   */
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth muss innerhalb von <AuthProvider> verwendet werden.");
  }
  return ctx;
}
