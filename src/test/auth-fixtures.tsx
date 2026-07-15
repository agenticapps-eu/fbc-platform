/* eslint-disable react-refresh/only-export-components -- Test-Helfer, kein HMR-Ziel. */
import type { ReactNode } from "react";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthContext } from "../providers/auth-context";
import { LEVEL_RANK, type MembershipLevel } from "../config/levels";

/**
 * Test-Helfer: stellt einen Auth-Context mit fester Stufe bereit, ohne Supabase
 * anzufassen. Gating-Komponenten lesen ausschließlich aus dem Context, daher
 * lässt sich das Verhalten so deterministisch und ohne Netzwerk testen.
 */
export function fakeAuthValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    session: null,
    user: null,
    tier: null,
    levelRank: null,
    staffRole: null,
    isLoading: false,
    tierLoading: false,
    signUp: async () => ({ error: null }),
    signIn: async () => ({ error: null }),
    signOut: async () => {},
    ...overrides,
  };
}

/** Eingeloggter Nutzer mit der angegebenen Mitgliedsstufe. */
export function authAsTier(tier: MembershipLevel): AuthContextValue {
  return fakeAuthValue({
    // Minimaler User-Stub — Gating prüft nur Vorhandensein + levelRank.
    user: { id: "test-user" } as AuthContextValue["user"],
    tier,
    levelRank: LEVEL_RANK[tier],
  });
}

export function AuthFixture({ value, children }: { value: AuthContextValue; children: ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
