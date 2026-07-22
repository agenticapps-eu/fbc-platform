import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { logEvent } from "../lib/log";
import { supabase } from "../lib/supabase";
import { AuthContext, type AuthContextValue } from "./auth-context";

/** Geladene Stufe, getaggt mit der userId, zu der sie gehört (Stale-Schutz beim Wechsel). */
interface LoadedProfile {
  userId: string;
  tier: string | null;
  levelRank: number | null;
  staffRole: string | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<LoadedProfile | null>(null);

  // Session beim Start laden und auf Änderungen (Login/Logout/Refresh) hören.
  // Der Callback setzt nur State — kein supabase.from() darin (Deadlock-Caveat);
  // die Profil-/Stufen-Abfrage erfolgt im zweiten Effect. Bei Logout das Profil
  // leeren, damit ein erneuter Login (auch mit derselben id) keine veraltete
  // Stufe wiederverwendet.
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setAuthReady(true);
      })
      .catch(() => setAuthReady(true));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      if (!nextSession) setProfile(null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Mitgliedsstufe (tier + level_rank) des eingeloggten Nutzers laden.
  // Die eigene Zeile ist per RLS (profiles_select_self_or_prime) lesbar,
  // membership_tiers per tiers_read_all — beides in einer Abfrage.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) return;
    // userId hier nach dem Guard als string fixieren — die Narrowing-Info geht in
    // der verschachtelten (später via setTimeout aufgerufenen) load()-Closure verloren.
    const uid = userId;

    let active = true;
    let attempt = 0;

    async function load() {
      try {
        // Stufe (Pflichtfeld) und Staff-Rolle (optional) parallel laden. Nur die
        // Stufen-Abfrage steuert Retry/Fallback; eine fehlende staff_roles-Zeile
        // ist der Normalfall (maybeSingle → data null) und kein Fehler.
        const [profileRes, staffRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("tier, membership_tiers(level_rank)")
            .eq("id", uid)
            .single(),
          supabase.from("staff_roles").select("role").eq("profile_id", uid).maybeSingle(),
        ]);
        if (!active) return;
        const { data, error } = profileRes;
        if (!error && data) {
          setProfile({
            userId: uid,
            tier: data.tier,
            levelRank: data.membership_tiers?.level_rank ?? null,
            staffRole: staffRes.data?.role ?? null,
          });
          return;
        }
      } catch {
        if (!active) return;
      }

      // Fehler / keine Zeile / Exception: bei transientem Fehler oder Trigger-Lag
      // direkt nach Signup begrenzt erneut versuchen, statt den Nutzer fälschlich
      // auf level_rank 0 herabzustufen (würde Prime/Legacy von ihren eigenen
      // Seiten aussperren).
      if (attempt < 3) {
        attempt += 1;
        setTimeout(() => {
          if (active) load();
        }, 500 * attempt);
        return;
      }
      setProfile({ userId: uid, tier: null, levelRank: null, staffRole: null });
    }

    load();
    return () => {
      active = false;
    };
  }, [userId]);

  // Abgeleitet: das geladene Profil zählt nur, wenn es zum aktuellen Nutzer gehört.
  const profileLoaded = profile?.userId === userId;
  const tier = userId && profileLoaded ? profile.tier : null;
  const levelRank = userId && profileLoaded ? profile.levelRank : null;
  const staffRole = userId && profileLoaded ? profile.staffRole : null;
  // isLoading = nur Session-Bereitschaft (für RequireAuth/LoginPage, die nur
  // `user` brauchen). Die Stufen-Bereitschaft ist separat (tierLoading).
  const isLoading = !authReady;
  const tierLoading = !!userId && !profileLoaded;

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      tier,
      levelRank,
      staffRole,
      isLoading,
      tierLoading,
      signUp: async (email, password, fullName) => {
        // `full_name` landet in raw_user_meta_data; der handle_new_user-Trigger
        // (20260611171003) liest genau diesen Schlüssel nach profiles.name.
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (!error) logEvent("signup");
        return { error };
      },
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) logEvent("login");
        return { error };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        if (!error) logEvent("password_change");
        return { error };
      },
    }),
    [session, tier, levelRank, staffRole, isLoading, tierLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
