import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { fetchActivationState } from "../lib/activation";
import { logEvent } from "../lib/log";
import { supabase } from "../lib/supabase";
import { AuthContext, type AuthContextValue } from "./auth-context";

/** Geladene Stufe, getaggt mit der userId, zu der sie gehört (Stale-Schutz beim Wechsel). */
interface LoadedProfile {
  userId: string;
  tier: string | null;
  levelRank: number | null;
  staffRole: string | null;
  /** null = noch unbekannt (Fehler/ausstehend). Siehe auth-context. */
  isActivated: boolean | null;
  /** true nur in der endgültigen Aufgeben-Lage nach drei Fehlversuchen. Siehe auth-context. */
  activationLookupFailed: boolean;
  activationName: string | null;
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

  // Aktivierungszustand und Mitgliedsstufe des eingeloggten Nutzers laden.
  //
  // Der Aktivierungszustand kommt aus `my_activation_state()` und NICHT aus der
  // Profilzeile: seit AGE-495 ist die auch für den Eigentümer gesperrt, solange
  // er nicht bestätigt hat. Ein Angreifer mit dem verteilten Passwort ist für
  // die Datenbank das Mitglied — „eigene Daten" sind dessen Daten.
  //
  // tier/level_rank/staffRole bleiben wie bisher: sie kommen erst nach der
  // Bestätigung durch und sind dann korrekt. Vorher sind sie null, und das ist
  // richtig so — ein nicht aktiviertes Konto hat keine Stufenrechte.
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
        const [aktivierung, profileRes, staffRes] = await Promise.all([
          fetchActivationState(),
          supabase
            .from("profiles")
            .select("tier, membership_tiers(level_rank)")
            .eq("id", uid)
            .maybeSingle(),
          supabase.from("staff_roles").select("role").eq("profile_id", uid).maybeSingle(),
        ]);
        if (!active) return;
        // Der Aktivierungszustand ist das Entscheidende und steht als erstes:
        // Solange er da ist, ist der Zustand vollständig — eine fehlende
        // Profilzeile ist bei einem nicht aktivierten Konto der NORMALFALL
        // (das Gate sperrt sie) und darf nicht in den Retry laufen.
        setProfile({
          userId: uid,
          tier: profileRes.data?.tier ?? null,
          levelRank: profileRes.data?.membership_tiers?.level_rank ?? null,
          staffRole: staffRes.data?.role ?? null,
          isActivated: aktivierung.activated,
          activationLookupFailed: false,
          activationName: aktivierung.displayName,
        });
        return;
      } catch {
        if (!active) return;
      }

      // Fehler / Exception: bei transientem Fehler oder Trigger-Lag direkt nach
      // Signup begrenzt erneut versuchen, statt den Nutzer fälschlich auf
      // level_rank 0 herabzustufen — und, seit AGE-495, statt ihm fälschlich
      // die Aktivierungswand zu zeigen.
      if (attempt < 3) {
        attempt += 1;
        setTimeout(() => {
          if (active) load();
        }, 500 * attempt);
        return;
      }
      // Nach drei Fehlversuchen bleibt `isActivated` bewusst `null`, nicht
      // `false`: „wir wissen es nicht" ist etwas anderes als „nicht aktiviert".
      // Das Gate hält ohnehin in der Datenbank; die Oberfläche soll hier einen
      // Fehler zeigen und nicht behaupten, das Konto sei unbestätigt.
      // `activationLookupFailed: true` markiert genau diese Aufgeben-Lage —
      // im Unterschied zu `isActivated === null` während noch geladen/wiederholt
      // wird (AGE-495, Befund F2): dort bleibt es `false`, das Gate wartet weiter.
      setProfile({
        userId: uid,
        tier: null,
        levelRank: null,
        staffRole: null,
        isActivated: null,
        activationLookupFailed: true,
        activationName: null,
      });
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
  // Ausgeloggt gibt es nichts zu aktivieren; eingeloggt und noch nicht geladen
  // ist `null` = unbekannt, und der Gate-Guard wartet darauf.
  const isActivated = !userId ? true : profileLoaded ? profile.isActivated : null;
  const activationLookupFailed =
    userId && profileLoaded ? profile.activationLookupFailed : false;
  const activationName = userId && profileLoaded ? profile.activationName : null;
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
      isActivated,
      activationLookupFailed,
      activationName,
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
    [
      session,
      tier,
      levelRank,
      staffRole,
      isLoading,
      tierLoading,
      isActivated,
      activationLookupFailed,
      activationName,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
