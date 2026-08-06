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
   * Hat das Mitglied seinen Zugang bestätigt (AGE-495)? `null` heißt „noch
   * unbekannt" — bewusst dreiwertig: ein Netzwerkfehler darf einem aktivierten
   * Mitglied nicht die Wand zeigen, und ein unaktiviertes darf nicht
   * durchrutschen, solange die Antwort aussteht. Fail closed heißt hier:
   * warten, nicht durchlassen.
   */
  isActivated: boolean | null;
  /** Anzeigename aus `my_activation_state()` — für die Anrede auf dem Aktivierungsschirm. */
  activationName: string | null;
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
  /**
   * Ändert das Passwort des eingeloggten Nutzers (AGE-450). Setzt eine aktive
   * Session voraus (Supabase updateUser) — kein Re-Auth mit dem alten Passwort.
   */
  updatePassword: (password: string) => Promise<{ error: AuthError | null }>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth muss innerhalb von <AuthProvider> verwendet werden.");
  }
  return ctx;
}
