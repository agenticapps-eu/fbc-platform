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
  const { user, isLoading, isActivated, isBlocked, activationLookupFailed } = useAuth();

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

  // Die Sperre steht VOR der Aktivierungswand und unabhängig von ihr (AGE-581).
  //
  // Vor ihr, weil ein gesperrtes Konto, das nie bestätigt hat, sonst den
  // Aktivierungsbildschirm sähe — mit dem Angebot, sich einen Zugangslink
  // schicken zu lassen, für einen Zugang, den es nicht mehr gibt.
  //
  // Unabhängig von ihr, weil `isActivated` seine Bedeutung behält („hat je
  // bestätigt") und von der Sperre nicht umgedeutet wird. Ein gesperrtes,
  // zuvor bestätigtes Konto trägt beides als `true` und käme ohne diese Zeile
  // durch die Wand — auf lauter leere Seiten, weil die RLS ihm überall nichts
  // liefert. Ein leerer Verein sieht aus wie ein Defekt, nicht wie eine
  // Entscheidung.
  if (isBlocked) return <BlockedNotice />;

  if (!isActivated) return <ActivationScreen />;

  return <>{children}</>;
}

/**
 * Der Sperrhinweis. Ein Bildschirm für beide Fälle — deaktiviert und gelöscht.
 *
 * Er nennt den Grund NICHT und unterscheidet die beiden Handlungen nicht: das
 * ist dieselbe Entscheidung, die in der Datenbank aus zwei Zuständen einen
 * Wahrheitswert `blocked` gemacht hat. Welche Handlung ein Admin vorgenommen
 * hat, geht den Betroffenen so wenig an wie einen Leser des Feeds — und wäre
 * hier obendrein eine Auskunft, die niemand geprüft hat.
 *
 * Kein Knopf für einen Zugangslink: der Zugang ist entzogen, nicht unbestätigt.
 * Ein Link, der nichts aufschliesst, wäre die zweite Enttäuschung nach der
 * ersten. Was bleibt, ist der Weg nach draussen und die Anschrift des Vereins.
 */
function BlockedNotice() {
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-soft px-6">
      <Card className="w-full max-w-md text-center">
        <CardTitle>Zugang gesperrt</CardTitle>
        <CardDescription>
          Für dieses Konto ist der Zugang zum Fair Business Club derzeit nicht freigeschaltet. Wenn
          du glaubst, dass das ein Irrtum ist, wende dich bitte an den Verein.
        </CardDescription>
        <div className="mt-6 flex justify-center">
          <Button variant="primary" onClick={() => void signOut()}>
            Abmelden
          </Button>
        </div>
      </Card>
    </div>
  );
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
