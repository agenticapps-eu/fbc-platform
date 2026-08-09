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
    // Vorgabe „aktiviert": die allermeisten Tests prüfen etwas anderes als das
    // Aktivierungs-Gate und sollen nicht daran hängenbleiben. Wer das Gate
    // prüft, setzt isActivated ausdrücklich (AGE-495).
    isActivated: true,
    activationLookupFailed: false,
    activationName: null,
    signUp: async () => ({ error: null }),
    signIn: async () => ({ error: null }),
    signOut: async () => {},
    updatePassword: async () => ({ error: null }),
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
