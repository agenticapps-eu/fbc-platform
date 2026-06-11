import type { ReactNode } from "react";
import { AuthContext, type AuthContextValue } from "./auth-context";

// Platzhalter-Provider: legt die Context-Form fest. Die echte Supabase-Session
// (auth.getSession + onAuthStateChange) wird in einem späteren Issue angebunden.
const placeholderValue: AuthContextValue = {
  user: null,
  isLoading: false,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={placeholderValue}>{children}</AuthContext.Provider>;
}
