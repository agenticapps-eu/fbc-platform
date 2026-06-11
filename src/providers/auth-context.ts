import { createContext, useContext } from "react";

export interface AuthContextValue {
  /** Angemeldeter Nutzer. Platzhalter bis die Supabase-Auth angebunden ist. */
  user: null;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth muss innerhalb von <AuthProvider> verwendet werden.");
  }
  return ctx;
}
