/* eslint-disable react-refresh/only-export-components -- Test-Helfer, kein HMR-Ziel. */
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthContext } from "../providers/auth-context";
import { LEVEL_RANK, type MembershipLevel } from "../config/levels";
import {
  BERECHTIGUNGEN,
  BERECHTIGUNG_STUFE,
  type Berechtigung,
} from "../config/berechtigungen";

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
    // Vorgabe „nicht gesperrt", aus demselben Grund wie isActivated oben: wer
    // die Sperre prüft, setzt sie ausdrücklich (AGE-581).
    isBlocked: false,
    activationLookupFailed: false,
    activationName: null,
    activationMailStatus: null,
    // Vorgabe „mit Sitzung" (AGE-591): Der Erfolgsfall ist, was die meisten
    // Tests meinen, wenn sie `signUp` überhaupt anfassen. Wer den stummen
    // dritten Ausgang prüft — kein Fehler, keine Sitzung —, setzt
    // `hatSession: false` ausdrücklich.
    signUp: async () => ({ error: null, hatSession: true }),
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

/**
 * Die Feature-Rechte, die eine Stufe traegt (AGE-1000).
 *
 * Abgeleitet aus `BERECHTIGUNG_STUFE` und NICHT abgeschrieben: eine zweite
 * Liste in den Fixtures waere eine dritte Kopie der Konfiguration, und sie
 * wuerde beim naechsten Verschieben einer Schwelle gruene Tests ueber falschen
 * Rechten liefern. `berechtigungen.guard.test.ts` haelt `BERECHTIGUNG_STUFE`
 * selbst gegen den Seed der Migration.
 */
export function rechteFuerStufe(tier: string | null): Berechtigung[] {
  // `string` und nicht `MembershipLevel`: `AuthContextValue.tier` traegt den
  // rohen Wert aus der Datenbank, und der kann ein Schluessel sein, den dieser
  // Build nicht kennt. Ein unbekannter ergibt dann keine Rechte — dieselbe
  // Richtung wie `darf()` in der Datenbank, wo ein unbekannter Schluessel
  // `false` ist.
  if (!tier || !(tier in LEVEL_RANK)) return [];
  const rang = LEVEL_RANK[tier as MembershipLevel];
  return BERECHTIGUNGEN.filter((k) => LEVEL_RANK[BERECHTIGUNG_STUFE[k]] <= rang);
}

/**
 * Legt die Rechte des Fixtures in den Query-Cache, damit `useDarf` sie ohne
 * Netzwerk findet.
 *
 * Warum das noetig ist: `useMeineRechte` fragt die RPC `meine_rechte`. In einem
 * Unit-Test gibt es dafuer keinen Server — die Abfrage scheitert, der Hook
 * meldet „kein Recht", und jede Flaeche hinter einem Recht zeigt die Wand. Der
 * Test wuerde dann nicht die Stufe messen, sondern das fehlende Netz.
 *
 * Ohne Sitzung wird NICHTS gesaet: der Hook fragt dort von sich aus nicht, und
 * ein geseeter Eintrag verdeckte genau diesen Fall.
 */
export function seedeRechte(queryClient: QueryClient, value: AuthContextValue): void {
  const uid = value.user?.id;
  if (!uid) return;
  queryClient.setQueryData(["meine-rechte", uid], rechteFuerStufe(value.tier ?? null));
}
