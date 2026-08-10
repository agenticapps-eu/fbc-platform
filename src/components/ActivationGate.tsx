import type { ReactNode } from "react";
import { useAuth } from "../providers/auth-context";
import ActivationScreen from "../pages/ActivationScreen";
import { Button } from "./ui/Button";
import { Card, CardDescription, CardTitle } from "./ui/Card";

/**
 * Aktivierungs-Wand (AGE-495 / C3).
 *
 * Eingeloggt und nicht bestätigt → ausschließlich der Aktivierungsbildschirm,
 * egal welche Route aufgerufen wurde.
 *
 * **Das hier ist Bequemlichkeit, nicht die Sicherheitsgrenze.** Wer das
 * verteilte Passwort hat, kann sich mit einem eigenen Supabase-Client anmelden
 * und die Tabellen direkt abfragen — an dieser Komponente vorbei. Was ihn
 * aufhält, ist die RLS (`supabase/migrations/20260806080100_activation_gate.sql`).
 * Diese Wand sorgt dafür, dass ein echtes Mitglied nicht auf leere Seiten
 * schaut, sondern erfährt, was zu tun ist.
 *
 * Sitzt in der Naht, die AGE-494 in `HomeRedirect` ausdrücklich für C3
 * stehengelassen hat, und um die `AppShell`-Routen.
 */
export default function ActivationGate({ children }: { children: ReactNode }) {
  const { user, isLoading, isActivated, activationLookupFailed } = useAuth();

  // Session noch nicht aufgelöst: nichts entscheiden (kein Flackern beim Reload).
  if (isLoading) return null;

  // Ausgeloggt: das Gate geht ihn nichts an. Das Schaufenster bleibt offen,
  // die persönlichen Bereiche regelt RequireAuth.
  if (!user) return <>{children}</>;

  // `null` = noch unbekannt. Fail closed heißt hier WARTEN, nicht durchlassen —
  // und auch nicht die Wand zeigen: ein Netzwerkfehler darf einem bestätigten
  // Mitglied nicht vorwerfen, es sei unbestätigt. Das gilt weiter für den
  // Normalfall (noch am Laden/Wiederholen) — nur die endgültige Aufgeben-Lage
  // nach drei Fehlversuchen (`activationLookupFailed`) bekommt eine Meldung
  // statt dauerhaft nichts (AGE-495, Befund F2).
  if (isActivated === null) {
    return activationLookupFailed ? <ActivationLookupError /> : null;
  }

  if (!isActivated) return <ActivationScreen />;

  return <>{children}</>;
}

/** Aufgeben-Lage von ActivationGate: die Prüfung ist nach drei Versuchen
 *  gescheitert, nicht das Konto ist unbestätigt. Ein Reload lässt AuthProvider
 *  neu laden — mehr Zustand braucht der Ausweg nicht. */
function ActivationLookupError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-soft px-6">
      <Card className="w-full max-w-md text-center">
        <CardTitle>Aktivierungsstatus nicht prüfbar</CardTitle>
        <CardDescription>
          Wir konnten gerade nicht feststellen, ob dein Zugang bestätigt ist. Das liegt an der
          Verbindung, nicht an deinem Konto.
        </CardDescription>
        <div className="mt-6 flex justify-center">
          <Button variant="primary" onClick={() => window.location.reload()}>
            Erneut versuchen
          </Button>
        </div>
      </Card>
    </div>
  );
}
