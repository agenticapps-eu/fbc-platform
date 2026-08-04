import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMemberTheme, memberThemeQueryKey } from "../lib/member-settings";
import { useAuth } from "./auth-context";
import { useDesignVariant } from "./design-variant-context";

/** Übernimmt beim Login das serverseitig gespeicherte Theme (AGE-492).
 *
 *  Rendert nichts. Sitzt bewusst NEBEN dem DesignVariantProvider statt in ihm:
 *  der Abgleich braucht Auth und React Query, und diese Abhängigkeiten in den
 *  Provider zu ziehen zwingt jeden Test, der irgendeine Seite rendert, beide
 *  mitzubringen.
 *
 *  Diese Komponente LIEST nur. Geschrieben wird dort, wo ein Mitglied das Theme
 *  tatsächlich umstellt (EinstellungenPage). Das ist keine Stilfrage: leitet man
 *  den Write aus einem Effect über `variant` ab, laufen Übernahme und Write im
 *  selben Commit, der Write sieht noch den alten Wert und schreibt die lokale
 *  Wahl über den Serverwert — also genau verkehrt herum.
 *
 *  Der Serverwert kann prinzipbedingt nicht vor dem ersten Paint da sein. Für
 *  den Normalfall (gleiches Gerät, gleiche Wahl) sind lokal und server identisch
 *  und es bewegt sich nichts; weichen sie ab, ist der Wechsel gewollt. */
export function ThemeServerSync() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const { setVariant } = useDesignVariant();

  const { data: serverTheme } = useQuery({
    queryKey: memberThemeQueryKey(uid),
    queryFn: () => fetchMemberTheme(uid),
    enabled: !!uid,
    staleTime: Infinity,
  });

  // `null` heißt „noch nie gespeichert" und lässt die lokale Wahl stehen —
  // sonst verlöre jeder Erstlogin sein Theme.
  useEffect(() => {
    if (serverTheme) setVariant(serverTheme);
  }, [serverTheme, setVariant]);

  return null;
}
