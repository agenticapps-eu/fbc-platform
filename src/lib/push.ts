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

// Das zuletzt erhaltene Gerätetoken. Es wird hier gemerkt, weil die Brücke es
// nicht wieder herausgibt — und weil beim Abmelden GENAU diese eine Zeile weg
// muss und nicht alle Token des Kontos: sonst verstummten Tablet und Zweitgerät
// desselben Menschen mit.
let letztesToken: string | null = null;

// Die Zuhörer dürfen nur EINMAL angemeldet werden. `addListener` haengt bei
// jedem Aufruf einen weiteren an; beim zweiten Öffnen der Nachrichten schriebe
// die App ihr Token sonst doppelt, beim dritten dreifach.
let zuhoererStehen = false;

/**
 * Holt das Token und legt es ab — mit oder ohne vorherige Frage.
 *
 * Beide Ausgänge unten teilen sich diesen Rumpf. Der einzige Unterschied ist
 * `darfFragen`, und der ist eine Zeile: ob bei noch offener Erlaubnis der
 * Systemdialog ausgelöst wird.
 */
async function registriere(darfFragen: boolean): Promise<PushStand> {
  const ziel = pushPlattform(Capacitor.isNativePlatform(), Capacitor.getPlatform());
  if (!ziel) return "web";

  try {
    let erlaubnis = (await PushNotifications.checkPermissions()).receive;
    if (darfFragen && (erlaubnis === "prompt" || erlaubnis === "prompt-with-rationale")) {
      erlaubnis = (await PushNotifications.requestPermissions()).receive;
    }
    if (erlaubnis !== "granted") return "abgelehnt";

    // Die Zuhörer MÜSSEN vor `register()` stehen. Danach angemeldet, ginge das
    // `registration`-Ereignis des ersten Laufs verloren — und genau das ist der
    // Lauf, in dem das Token zum ersten Mal kommt.
    if (!zuhoererStehen) {
      zuhoererStehen = true;
      await PushNotifications.addListener("registration", async (token) => {
        letztesToken = token.value;
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

/**
 * Fragt die Erlaubnis, holt das Token und legt es ab.
 *
 * **Nicht beim Kaltstart aufrufen.** Wer beim ersten Start gefragt wird, sagt
 * nein — und iOS fragt kein zweites Mal, die Entscheidung ist dann endgültig.
 * Der Aufruf gehört an eine Stelle, an der die Frage erklärbar ist: wenn
 * jemand die Nachrichten öffnet.
 */
export function pushEinrichten(): Promise<PushStand> {
  return registriere(true);
}

/**
 * Legt ein BEREITS erlaubtes Token erneut ab — beim Start, ohne Dialog.
 *
 * **Der Zweck ist der Zeitstempel, nicht die Registrierung** (AGE-682). Die
 * steht längst; erneuert wird `push_tokens.letzter_kontakt`. Ohne diesen Weg
 * misst die Spalte nur, wann jemand zuletzt die NACHRICHTEN geöffnet hat —
 * `pushEinrichten` hängt allein daran, und dort an einem Riegel je Konto. Wer
 * die App täglich nutzt und nie in den Chat geht, hätte einen Wert, der nie
 * wieder steigt, und verlöre sein funktionierendes Token an den Aufräumer.
 *
 * **Hier wird NICHT gefragt**, und das ist die tragende Eigenschaft: iOS zeigt
 * den Systemdialog einmal. Ist die Erlaubnis offen, geschieht nichts — der
 * Dialog bleibt dem Nachrichten-Weg vorbehalten, wo er erklärbar ist. Damit
 * widerspricht dieser Aufruf der Anforderung „Der Start fragt nicht" nicht:
 * sie verbietet das ANFORDERN, nicht das Erneuern eines erteilten Tokens.
 */
export function pushLebenszeichen(): Promise<PushStand> {
  return registriere(false);
}

/**
 * Die Kennung des Mitteilungskanals (AGE-642).
 *
 * **Zeichengleich mit `com.google.firebase.messaging.default_notification_channel_id`
 * in `android/app/src/main/AndroidManifest.xml`.** `push.kanal.test.ts` hält
 * beide zusammen, denn der Fehlermodus einer Abweichung ist Schweigen: FCM legt
 * sich dann wieder seinen eigenen `fcm_fallback_notification_channel` an, der
 * Kanal von hier steht ungenutzt daneben, und am Gerät sieht alles aus wie
 * vorher.
 *
 * **Sie darf sich nie wieder ändern.** Für Android ist eine neue Kennung ein
 * neuer Kanal — wer den alten leiser gestellt oder abgeschaltet hatte, bekommt
 * ihn ungefragt wieder auf laut.
 */
export const PUSH_KANAL_ID = "mitteilungen";

/**
 * Legt den Mitteilungskanal an — Android, beim Start.
 *
 * **Warum es ihn braucht.** Gemessen am 04.09. mit `dumpsys notification`:
 * `channel=fcm_fallback_notification_channel`, `sound=null vibrate=null
 * defaults=0`, dazu im logcat `Missing Default Notification Channel metadata in
 * AndroidManifest`. Die App deklarierte keinen Kanal, also legte FCM sich
 * einen an. Zwei Folgen: `default_sound: true` in `fcmKoerper` ist auf
 * Android 8+ wirkungslos — Ton und Vibration sind dort Eigenschaften des
 * KANALS, nicht der Nachricht —, und in den Systemeinstellungen heisst der
 * Kanal „Sonstiges".
 *
 * **BEIM START, nicht beim ersten Push.** Ein Kanal, den es im Moment der
 * Zustellung nicht gibt, fällt auf denselben Fallback zurück; die Mitteilung
 * ist dann schon zugestellt, und der später angelegte Kanal ändert daran
 * nichts mehr.
 *
 * **EIN Kanal, bewusst.** Eine Trennung nach Nachricht und Kontaktanfrage wäre
 * die naheliegende zweite Stufe und ist hier ausdrücklich nicht dran: einen
 * Kanal, den ein Mitglied einmal abgeschaltet hat, kann die App nie wieder
 * einschalten. Das ist ein Entwurf, kein Anbau.
 *
 * **iOS ist nicht betroffen** — Kanäle gibt es dort nicht, und die Brücke
 * meldete den Aufruf als `unimplemented`. Die Weiche oben hält ihn davon fern.
 */
export async function pushKanalAnlegen(): Promise<"angelegt" | "entfaellt" | "fehler"> {
  if (pushPlattform(Capacitor.isNativePlatform(), Capacitor.getPlatform()) !== "android") {
    return "entfaellt";
  }

  try {
    await PushNotifications.createChannel({
      id: PUSH_KANAL_ID,
      // Sichtbar in den Systemeinstellungen. Er nennt beides, was hier
      // ankommt — „Mitteilungen" wäre so nichtssagend wie das „Sonstiges",
      // das er ersetzt.
      name: "Nachrichten und Kontaktanfragen",
      description: "Wenn Ihnen jemand schreibt oder Sie kennenlernen möchte.",
      // 4 = HIGH: Ton und Einblendung. Der Versand setzt `priority: "high"`,
      // damit die Nachricht nicht bis zum nächsten Doze-Wartungsfenster
      // liegen bleibt — käme sie dann lautlos in der Leiste an, wäre dafür
      // nichts gewonnen. Herunterstellen kann das Mitglied selbst; von der
      // App aus geht es nach dem Anlegen in keine Richtung mehr.
      importance: 4,
      // AUSDRÜCKLICH, und das ist keine Verzierung: Capacitors
      // `NotificationChannelManager` liest `vibration` mit dem Vorgabewert
      // FALSE und ruft `enableVibration(false)` — anders als Android selbst,
      // wo ein Kanal dieser Stufe vibriert. Ohne diese Zeile bliebe der am
      // 04.09. gemessene Zustand `vibrate=null` bestehen.
      vibration: true,
      // KEIN `sound`: ohne den Schlüssel ruft die Brücke `setSound` gar nicht
      // erst, und der Kanal behält den Standardton des Systems. Ein Wert hier
      // verlangte eine eigene Datei unter `res/raw`.
    });
    return "angelegt";
  } catch (e) {
    // Nur auf die Konsole. Unterhalb von Android 8 antwortet die Brücke mit
    // `unavailable` — dort gibt es keine Kanäle, und `default_sound` im
    // Versand greift wieder. Ein Fehler hier darf den Start nicht aufhalten.
    console.error("[push] Kanal nicht angelegt:", (e as Error).message);
    return "fehler";
  }
}

/**
 * Nimmt das Gerätetoken beim Abmelden mit — bester Versuch, keine Garantie.
 *
 * **Vor** `auth.signOut()` zu rufen ist Pflicht: die Zeile gehört dem
 * angemeldeten Konto, und owner-only RLS lässt sie nur ihm löschen. Danach
 * träfe das `delete` null Zeilen und meldete trotzdem keinen Fehler — ein
 * Aufräumen, das aussieht wie eines und keines ist.
 *
 * Scheitert es doch (kein Netz, App abgestürzt, Konto direkt gewechselt), ist
 * das kein stiller Fehlzustand: `claim_push_token` schreibt dasselbe Token beim
 * nächsten Konto auf demselben Gerät um. Die Garantie liegt auf dem Server, hier
 * liegt nur die Höflichkeit — und deshalb darf ein Fehler hier das Abmelden
 * niemals verhindern.
 */
export async function pushAbmelden(): Promise<"nichts" | "entfernt" | "fehler"> {
  const token = letztesToken;
  letztesToken = null;
  if (!token) return "nichts";

  const { error } = await supabase.from("push_tokens").delete().eq("token", token);
  if (error) {
    console.error("[push] Token beim Abmelden nicht entfernt:", error.message);
    return "fehler";
  }
  return "entfernt";
}

/**
 * Das Sprungziel aus der Nutzlast einer Mitteilung — oder `null`.
 *
 * Die Serverseite legt es längst bei (`send-push/nachrichten.ts`): für eine
 * Nachricht `/chat/<thread_id>`, für die drei Kontaktanfrage-Typen bewusst
 * nichts. Gelesen wurde es auf dem Gerät bis zum 28.08. nicht, und ein Tipp
 * öffnete deshalb nur die App — bei einem Hinweis, der „jemand hat Ihnen
 * geschrieben" sagt, ist das der schlechteste aller Ausgänge: er nennt einen
 * Anlass und lässt einen dann suchen.
 *
 * **Warum hier geprüft wird, obwohl der Wert vom eigenen Server kommt.** Er
 * kommt über einen FREMDEN Zustelldienst auf das Gerät und wird ungeprüft in
 * eine Navigation gegeben. Genau daraus wird aus einem Push ein Umleiter auf
 * eine fremde Seite. Erlaubt ist deshalb nur ein absoluter Pfad innerhalb
 * dieser Anwendung — und ausdrücklich NICHT `//host`, das wie ein interner
 * Pfad aussieht und protokollrelativ auf einen fremden Host führt.
 */
export function pushZiel(daten: unknown): string | null {
  const ziel = (daten as { ziel?: unknown } | undefined)?.ziel;
  if (typeof ziel !== "string") return null;
  if (!ziel.startsWith("/") || ziel.startsWith("//")) return null;
  return ziel;
}

// Auch dieser Zuhörer darf nur EINMAL hängen — `addListener` haengt sonst bei
// jedem Aufruf einen weiteren an, und ein Tipp navigierte doppelt.
let zielZuhoererSteht = false;

/**
 * Lässt einen Tipp auf die Mitteilung in ihr Gespräch führen.
 *
 * **Getrennt von `pushEinrichten` und früher als sie.** Die Erlaubnisfrage
 * gehört ans Öffnen der Nachrichten; dieser Zuhörer muss stehen, sobald die
 * Hülle steht — sonst kommt ein Kaltstart AUS der Mitteilung heraus an, bevor
 * jemand zuhört, und der Sprung fällt genau dann aus, wenn er am meisten
 * bedeutet.
 */
export async function pushZielZuhoerer(navigiere: (ziel: string) => void): Promise<void> {
  if (!pushPlattform(Capacitor.isNativePlatform(), Capacitor.getPlatform())) return;
  if (zielZuhoererSteht) return;
  zielZuhoererSteht = true;

  await PushNotifications.addListener("pushNotificationActionPerformed", (ereignis) => {
    const ziel = pushZiel(ereignis.notification.data);
    // Ohne Ziel bleibt die App dort, wo sie ist. Ein Sprung auf gut Glück wäre
    // schlechter als keiner.
    if (ziel) navigiere(ziel);
  });
}
