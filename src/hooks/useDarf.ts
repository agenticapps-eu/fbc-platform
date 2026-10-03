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
 * ══ DER LADEZUSTAND IST KEINE ABLEHNUNG ═══════════════════════════════════
 * `laedt` wird eigens herausgegeben, weil der häufigste Fehler dieses Repos
 * genau hier sitzt: `(levelRank ?? 0)` machte aus „noch nicht geladen" ein
 * „Rang 0" und zeigte einem berechtigten Mitglied für einen Moment die Wand
 * (AGE-903). Wer gaten will, behandelt `laedt` ausdrücklich — `darf` ist
 * während des Ladens `false`, und das allein ist keine Aussage.
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
    fehler: isError,
  };
}

/** Trägt der Aufrufer dieses Recht? `laedt` ist kein `false`, sondern „noch unklar". */
export function useDarf(schluessel: Berechtigung): { darf: boolean; laedt: boolean } {
  const { rechte, laedt } = useMeineRechte();
  return { darf: rechte.includes(schluessel), laedt };
}
