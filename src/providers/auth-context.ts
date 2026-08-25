import type { AuthError, Session, User } from "@supabase/supabase-js";
import { createContext, useContext } from "react";
import type { ResendStatus } from "../lib/activation";

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
  /**
   * true, wenn die Aktivierungsprüfung nach drei Fehlversuchen endgültig
   * aufgegeben hat (siehe `AuthProvider`) — im Unterschied zu „noch am
   * Warten" (auch dort `isActivated === null`, aber dieses Feld bleibt
   * `false`). `ActivationGate` unterscheidet danach, ob es weiter nichts
   * zeigt oder eine Fehlermeldung mit Wiederholen-Option (AGE-495, Befund F2).
   */
  activationLookupFailed: boolean;
  /**
   * true, wenn dem Konto der Zugang entzogen wurde — deaktiviert oder gelöscht
   * (AGE-581).
   *
   * Steht NEBEN `isActivated`, nicht darin: die Sperre deutet die Bestätigung
   * nicht um. Ein gesperrtes, zuvor bestätigtes Konto trägt `isActivated: true`
   * und `isBlocked: true` — käme es nur auf `isActivated` an, liefe es durch
   * die Wand und schaute auf lauter leere Seiten, weil die RLS ihm überall
   * nichts liefert.
   *
   * Trägt bewusst NICHT, WELCHE der beiden Handlungen ein Admin vorgenommen
   * hat: die Unterscheidung geht den Betroffenen nichts an, und die Oberfläche
   * braucht sie nicht — sie zeigt in beiden Fällen denselben Hinweis.
   */
  isBlocked: boolean;
  /** Anzeigename aus `my_activation_state()` — für die Anrede auf dem Aktivierungsschirm. */
  activationName: string | null;
  /**
   * Ergebnis des Versands, den die Registrierung selbst ausgelöst hat
   * (AGE-526), oder `null`, wenn in dieser Sitzung keiner lief — auch nach
   * einem Neuladen.
   *
   * Der Aktivierungsbildschirm hängt an `ActivationGate` und wird erst nach dem
   * Routenwechsel gerendert; ohne diesen Weg erführe er vom automatischen
   * Versand nichts und böte einen Knopf für eine Mail an, die schon unterwegs
   * ist. Er zeigt „unterwegs" ausschließlich bei `issued` — jeder andere Wert
   * heißt, dass nichts versendet wurde, und darf nicht wie ein Versand
   * aussehen.
   */
  activationMailStatus: ResendStatus | null;
  /**
   * Legt ein Konto an. `fullName` geht als `full_name` in die User-Metadaten und
   * wird vom Signup-Trigger nach `profiles.name` übernommen (AGE-437) — ohne ihn
   * bliebe das Mitglied im Verzeichnis namenlos.
   *
   * **Nimmt kein Passwort entgegen** (AGE-527): Es entsteht erst beim Einlösen
   * des Bestätigungslinks. Was der Anmeldedienst bis dahin braucht, erzeugt der
   * Provider selbst — ein optionales Argument hätte einen zweiten Weg offen
   * gelassen, den niemand geht und auf dem niemand das Passwort ersetzt.
   *
   * **`hatSession` unterscheidet den dritten Ausgang** (AGE-591): kein Fehler,
   * aber auch keine Sitzung. Den liefert GoTrue bei einer bereits bekannten
   * Adresse, und ohne dieses Feld ist er vom Erfolg nicht zu unterscheiden —
   * die Seite bliebe stumm, und der Knopf täte wortlos nichts.
   */
  signUp: (
    email: string,
    fullName: string,
  ) => Promise<{ error: AuthError | null; hatSession: boolean }>;
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
