import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { AuthContext, type AuthContextValue } from "./auth-context";

/** Geladene Stufe, getaggt mit der userId, zu der sie gehört (Stale-Schutz beim Wechsel). */
interface LoadedProfile {
  userId: string;
  tier: string | null;
  levelRank: number | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<LoadedProfile | null>(null);

  // Session beim Start laden und auf Änderungen (Login/Logout/Refresh) hören.
  // Der Callback setzt nur State — kein supabase.from() darin (Deadlock-Caveat);
  // die Profil-/Stufen-Abfrage erfolgt im zweiten Effect.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Mitgliedsstufe (tier + level_rank) des eingeloggten Nutzers laden.
  // Die eigene Zeile ist per RLS (profiles_select_self_or_prime) lesbar,
  // membership_tiers per tiers_read_all — beides in einer Abfrage.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) return;

    let active = true;
    supabase
      .from("profiles")
      .select("tier, membership_tiers(level_rank)")
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (!active) return;
        setProfile({
          userId,
          tier: error || !data ? null : data.tier,
          levelRank: error || !data ? null : (data.membership_tiers?.level_rank ?? null),
        });
      });

    return () => {
      active = false;
    };
  }, [userId]);

  // Abgeleitet: das geladene Profil zählt nur, wenn es zum aktuellen Nutzer gehört.
  const profileLoaded = profile?.userId === userId;
  const tier = userId && profileLoaded ? profile.tier : null;
  const levelRank = userId && profileLoaded ? profile.levelRank : null;
  const isLoading = !authReady || (!!userId && !profileLoaded);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      tier,
      levelRank,
      isLoading,
      signUp: async (email, password) => {
        const { error } = await supabase.auth.signUp({ email, password });
        return { error };
      },
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, tier, levelRank, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
