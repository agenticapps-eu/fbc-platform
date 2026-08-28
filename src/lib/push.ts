import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

import { supabase } from "./supabase";

/**
 * Geräte-Token für Push (AGE-641 Phase B).
 *
 * Die Serverseite steht seit Phase A vollständig: `claim_push_token`,
 * `send-push`, der Wiederholungslauf und die Kette
 * `messages → notifications → send-push`. Was fehlte, ist genau dieses Stück —
 * ohne Token überspringt `send-push` jede Zustellung, und die Antwort
 * `{"skipped":true}` sieht dabei aus wie Erfolg.
 */
export type PushPlattform = "ios" | "android";

/**
 * Wofür registriert wird — oder `null`, wenn gar nicht.
 *
 * Als reine Funktion, weil der Rest dieses Moduls in jsdom nicht prüfbar ist:
 * Push-Ereignisse entstehen dort nie, und ein Test, der auf sie wartet, wäre
 * grün, weil nichts passiert. Dieselbe Falle wie bei `env(safe-area-inset-*)`
 * und beim `backButton`.
 */
export function pushPlattform(nativ: boolean, plattform: string): PushPlattform | null {
  if (!nativ) return null;
  return plattform === "ios" || plattform === "android" ? plattform : null;
}

export type PushStand = "web" | "abgelehnt" | "registriert" | "fehler";

// Die Zuhörer dürfen nur EINMAL angemeldet werden. `addListener` haengt bei
// jedem Aufruf einen weiteren an; beim zweiten Öffnen der Nachrichten schriebe
// die App ihr Token sonst doppelt, beim dritten dreifach.
let zuhoererStehen = false;

/**
 * Fragt die Erlaubnis, holt das Token und legt es ab.
 *
 * **Nicht beim Kaltstart aufrufen.** Wer beim ersten Start gefragt wird, sagt
 * nein — und iOS fragt kein zweites Mal, die Entscheidung ist dann endgültig.
 * Der Aufruf gehört an eine Stelle, an der die Frage erklärbar ist: wenn
 * jemand die Nachrichten öffnet.
 */
export async function pushEinrichten(): Promise<PushStand> {
  const ziel = pushPlattform(Capacitor.isNativePlatform(), Capacitor.getPlatform());
  if (!ziel) return "web";

  try {
    let erlaubnis = (await PushNotifications.checkPermissions()).receive;
    if (erlaubnis === "prompt" || erlaubnis === "prompt-with-rationale") {
      erlaubnis = (await PushNotifications.requestPermissions()).receive;
    }
    if (erlaubnis !== "granted") return "abgelehnt";

    // Die Zuhörer MÜSSEN vor `register()` stehen. Danach angemeldet, ginge das
    // `registration`-Ereignis des ersten Laufs verloren — und genau das ist der
    // Lauf, in dem das Token zum ersten Mal kommt.
    if (!zuhoererStehen) {
      zuhoererStehen = true;
      await PushNotifications.addListener("registration", async (token) => {
        const { error } = await supabase.rpc("claim_push_token", {
          p_token: token.value,
          p_plattform: ziel,
        });
        // Bewusst nur auf die Konsole: ein Fehler hier darf die Nachrichten
        // nicht blockieren. Sichtbar wird er am Gerät und in `push_tokens`.
        if (error) console.error("[push] claim_push_token:", error.message);
        else console.log("[push] Token abgelegt, Plattform", ziel);
      });
      await PushNotifications.addListener("registrationError", (e) => {
        console.error("[push] Registrierung fehlgeschlagen:", JSON.stringify(e));
      });
    }

    await PushNotifications.register();
    return "registriert";
  } catch (e) {
    console.error("[push] unerwartet:", (e as Error).message);
    return "fehler";
  }
}
