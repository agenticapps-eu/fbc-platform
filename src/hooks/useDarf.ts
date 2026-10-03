import { useQuery } from "@tanstack/react-query";
import type { Berechtigung } from "../config/berechtigungen";
import { ladeMeineRechte, meineRechteQueryKey } from "../lib/berechtigungen";
import { useAuth } from "../providers/auth-context";

/**
 * Die Feature-Rechte des angemeldeten Kontos (AGE-1000).
 *
 * ══ WARUM EIN HOOK UND KEIN RANGVERGLEICH ═════════════════════════════════
 * Vor AGE-1000 trug jede gatende Stelle im Client ihre eigene Rangzahl
 * (`levelRank >= CLUB_RANK`, `minTier: "discover"`). Eine Verschiebung war
 * damit zwei Änderungen an zwei Orten. Die Oberfläche fragt jetzt nach dem
 * Namen des Rechts; wo die Schwelle liegt, weiß nur die Datenbank.
 *
 * ══ EIN LADEZUSTAND IST EIN MOMENT, EIN FEHLER IST EIN ZUSTAND ════════════
 * Beide heissen „ich weiss es nicht", und beide dürfen NICHT „nein" heissen —
 * genau diese Verwechslung hat in AGE-903 einem berechtigten Mitglied die Wand
 * gezeigt, weil `(levelRank ?? 0)` aus „noch nicht geladen" ein „Rang 0"
 * machte. Sie sind aber nicht derselbe Fall, und der Diff-Review (codex,
 * MEDIUM) hat zu Recht beanstandet, dass die erste Fassung sie gleich behandelte:
 *
 *  * `laedt` **löst sich von selbst auf.** Eine Fläche darf warten — eine
 *    Aktion, die einen Augenblick später erscheint, ist kein Schaden.
 *  * `fehler` **löst sich nicht auf.** Wer hier wartet, wartet für immer; und
 *    wer ablehnt, nimmt einem berechtigten Mitglied dauerhaft eine Fähigkeit
 *    weg, weil das Netz gewackelt hat.
 *
 * Deshalb gibt dieser Hook beide Felder einzeln heraus und entscheidet NICHT
 * für seine Aufrufer. Die Regel, der sie folgen:
 *
 *  * **Routen-Gate** (`MembershipGate`): `laedt` zeigt nichts (kein Flackern),
 *    `fehler` lässt durch — die RLS ist die Grenze, nicht diese Wand.
 *  * **Aktionsknopf** (`EventsList`): `laedt` verbirgt ihn (er kommt gleich),
 *    `fehler` zeigt ihn — dann scheitert höchstens der Schreibvorgang mit einer
 *    benannten Meldung, statt dass die Funktion verschwindet.
 *  * **Filter und Anzeige** (`MemberDirectory`, `HeaderSearch`): beide Fälle
 *    fallen offen bzw. werden neutral formuliert. Ein Filter, der zu viel
 *    zeigt, findet höchstens nichts.
 *
 * Ohne Sitzung wird gar nicht gefragt: `meine_rechte()` ist für `anon` nicht
 * ausführbar, jede Abfrage liefe in einen Rechtefehler.
 */
export function useMeineRechte() {
  const { user } = useAuth();
  const { data, isPending, isError } = useQuery({
    queryKey: [...meineRechteQueryKey, user?.id ?? null],
    queryFn: ladeMeineRechte,
    enabled: !!user,
    // Rechte ändern sich nur, wenn ein Admin die Stufe setzt — dieselbe
    // Eigenschaft wie bei der Stufe selbst: sie wirkt beim nächsten Laden.
    staleTime: Infinity,
  });
  return {
    rechte: data ?? [],
    laedt: !!user && isPending,
    fehler: !!user && isError,
  };
}

/**
 * Trägt der Aufrufer dieses Recht?
 *
 * `laedt` und `fehler` sind beide KEIN `false` — siehe die Regel im
 * Kopfkommentar. Wer nur `darf` liest und die anderen zwei ignoriert, baut die
 * Verwechslung wieder ein.
 */
export function useDarf(schluessel: Berechtigung): {
  darf: boolean;
  laedt: boolean;
  fehler: boolean;
} {
  const { rechte, laedt, fehler } = useMeineRechte();
  return { darf: rechte.includes(schluessel), laedt, fehler };
}
