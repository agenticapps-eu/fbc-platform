import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import {
  fetchOnboardedAt,
  istOnboardingVertagt,
  memberOnboardingQueryKey,
} from "../lib/member-settings";
import { useAuth } from "../providers/auth-context";
import HomePage from "../pages/HomePage";

/**
 * Startseiten-Weiche (`/`). Sie zeigt die öffentliche Landingpage (`HomePage`) —
 * und führt ein aktiviertes Mitglied ohne gesetzten Onboarding-Merker einmalig
 * in die Willkommensstrecke (`/willkommen`, AGE-538).
 *
 * AGE-494: Bis dahin fing sie EINEN Fall ab — eingeloggt, keine
 * `compass_responses`, nicht übersprungen → einmalig nach `/onboarding`. Der
 * Erstlogin führte damit in einen Fragebogen. Der Assistent bleibt vollständig
 * im Code und unter `/onboarding` erreichbar, er wird nur nicht mehr aufgedrängt.
 *
 * AGE-495 (C3) hat das Aktivierungs-Gate eine Ebene höher eingezogen: als
 * `ActivationGate` um die gesamte `AppShell` und nicht nur um die Startseite.
 * Hier allein hätte es `/mitglieder` oder `/profil` nicht erreicht.
 *
 * AGE-538 (C11) setzt an diesen freigewordenen Platz die Willkommensstrecke —
 * und zwar bewusst WIEDER nur hier und nicht als Wand um alles. Die Strecke hat
 * zwei Auswege; jede andere Route bleibt unberührt, auch ohne Merker.
 *
 * **Der Auslöser ist der Aufruf der Startseite, nicht der Sitzungsaufbau.** Nach
 * dem Setzen des Passworts über ein Aktivierungstoken gibt es keine Sitzung:
 * `redeem-activation/index.ts:81` widerruft alle Sitzungen, auch die eigene. Der
 * Einstieg ist deshalb der Login, der auf `/` führt (`LoginPage.tsx:67`).
 *
 * **Drei Zustände, nicht zwei.** Der Merker kommt aus der Datenbank und ist beim
 * ersten Rendern unbekannt. Wer nur „Merker ist null" prüft, schlägt das Laden
 * still dem Umleiten-Zweig zu und bekommt ein Flackern. Und ein LESEFEHLER darf
 * erst recht nicht wie ein fehlender Merker aussehen — ein Netzfehler würde
 * sonst jedes Mitglied bei jedem Aufruf erneut in die Strecke werfen.
 */
export default function HomeRedirect() {
  const { user, isActivated } = useAuth();
  const uid = user?.id ?? "";
  // `isActivated === true` ausdrücklich, nicht `!== false`: für einen
  // ausgeloggten Besucher meldet das System „aktiviert", weil es nichts zu
  // aktivieren gibt (dieselbe Falle wie in ActivationRedeemPage.tsx:129-135).
  const zustaendig = !!uid && isActivated === true;

  const { data, status } = useQuery({
    queryKey: memberOnboardingQueryKey(uid),
    queryFn: () => fetchOnboardedAt(uid),
    enabled: zustaendig,
    // KEIN `staleTime: Infinity`. Der Merker ist eine Zeile über den
    // Primärschlüssel, die Abfrage kostet nichts — und ein für immer frischer
    // `null` überlebte sonst das Beenden der Strecke in einem ANDEREN Tab und
    // schickte dieses Fenster erneut hinein. Ein Nachladen bei vorhandenen
    // Daten flackert nicht: `status` bleibt „success", der alte Wert steht.
    // (Fremd-Review zum Diff, codex, MEDIUM.)
  });

  if (!zustaendig) return <HomePage />;
  // „Später" gilt für diese Anwendungssitzung. Ohne diese Zeile führte der
  // Ausweg im Kreis: er navigiert auf `/`, und `/` ist diese Weiche.
  if (istOnboardingVertagt(uid)) return <HomePage />;
  // Noch unbekannt: weder umleiten noch die Startseite zeigen.
  if (status === "pending") return null;
  if (status === "success" && data === null) return <Navigate to="/willkommen" replace />;
  return <HomePage />;
}
