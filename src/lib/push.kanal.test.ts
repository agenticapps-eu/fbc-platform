import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AGE-642 — der Mitteilungskanal.
 *
 * WARUM ES IHN GIBT. Gemessen am 04.09. auf dem Pixel, nachdem die Zustellung
 * durch war: `channel=fcm_fallback_notification_channel`, `sound=null
 * vibrate=null defaults=0`, im logcat `Missing Default Notification Channel
 * metadata in AndroidManifest`. Die App deklarierte keinen Kanal, also legte
 * FCM sich selbst einen an — er heisst in den Systemeinstellungen „Sonstiges",
 * und `default_sound: true` im Versand ist auf Android 8+ wirkungslos, weil Ton
 * dort Sache des KANALS ist.
 *
 * WAS HIER GEPRÜFT WIRD, UND WARUM GERADE DAS. Der Fehlermodus dieses Vorgangs
 * ist durchweg SCHWEIGEN: bei jeder der drei möglichen Abweichungen — Kennung
 * im Manifest ungleich der im Code, `vibration` weggelassen, Kanal erst beim
 * Push statt beim Start — läuft alles weiter, die Mitteilung kommt an, und nur
 * `dumpsys notification` am Gerät sähe den Unterschied. Zwei davon sind von
 * hier aus prüfbar und stehen unten. Die dritte ist eine Aufrufstelle und steht
 * in `AppShell.push.test.tsx`.
 *
 * Nicht geprüft wird, was Android daraus MACHT — das entsteht in jsdom nie.
 * Der Beleg dafür bleibt der Lauf am Gerät.
 */
// Der Typ steht am `vi.fn`, nicht als Parameter am Rumpf: ohne ihn hat die
// Attrappe eine leere Parameterliste, und `mock.calls[0][0]` ist dann kein
// `unknown`, sondern ein Typfehler. Ein Parameter, den der Rumpf nicht liest,
// wäre die andere Lösung — und ein eslint-Fehler, denn dieses Projekt führt
// kein `argsIgnorePattern`.
const { createChannel } = vi.hoisted(() => ({
  createChannel: vi.fn<(kanal: Record<string, unknown>) => Promise<void>>(async () => {}),
}));

const { istNativ, plattform } = vi.hoisted(() => ({
  istNativ: vi.fn(() => true),
  plattform: vi.fn(() => "android"),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: istNativ, getPlatform: plattform },
}));
vi.mock("@capacitor/push-notifications", () => ({ PushNotifications: { createChannel } }));
vi.mock("./supabase", () => ({ supabase: { rpc: vi.fn() } }));

const { pushKanalAnlegen, PUSH_KANAL_ID } = await import("./push");

beforeEach(() => {
  vi.clearAllMocks();
  istNativ.mockReturnValue(true);
  plattform.mockReturnValue("android");
  createChannel.mockResolvedValue(undefined);
});

describe("die Kennung steht an zwei Stellen und muss dieselbe sein", () => {
  // DIE Zusage dieser Datei. Weichen die beiden ab, legt FCM sich weiterhin
  // seinen Fallback an und der Kanal von `pushKanalAnlegen` steht ungenutzt
  // daneben — ohne Fehler, ohne Logzeile, ohne sichtbaren Unterschied ausser
  // dem Namen „Sonstiges" in den Systemeinstellungen.
  it("das Manifest nennt genau PUSH_KANAL_ID als Vorgabekanal", () => {
    const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
    const treffer = manifest.match(
      /<meta-data\s+android:name="com\.google\.firebase\.messaging\.default_notification_channel_id"\s+android:value="([^"]*)"/,
    );

    // Fehlt der Eintrag ganz, ist `treffer` null — und genau das war der Stand
    // vom 04.09. Diese Zeile ist die Positivkontrolle des Tests.
    expect(treffer, "meta-data für den Vorgabekanal fehlt im AndroidManifest").not.toBeNull();
    expect(treffer![1]).toBe(PUSH_KANAL_ID);
  });
});

describe("pushKanalAnlegen", () => {
  it("legt den Kanal auf Android an", async () => {
    expect(await pushKanalAnlegen()).toBe("angelegt");
    expect(createChannel).toHaveBeenCalledTimes(1);
    expect(createChannel.mock.calls[0][0]).toMatchObject({ id: PUSH_KANAL_ID });
  });

  it("bittet AUSDRÜCKLICH um Vibration", async () => {
    // Kein Feinschliff, sondern die Umkehrung einer Vorgabe: Capacitors
    // `NotificationChannelManager` liest `vibration` mit dem Vorgabewert FALSE
    // und ruft dann `enableVibration(false)` — anders als Android selbst, wo
    // ein Kanal dieser Stufe vibriert. Ohne die Zeile im Aufruf bliebe der am
    // 04.09. gemessene Zustand `vibrate=null` genau so bestehen.
    await pushKanalAnlegen();
    expect(createChannel.mock.calls[0][0]).toMatchObject({ vibration: true, importance: 4 });
  });

  it("nennt KEINEN Ton", async () => {
    // Ohne den Schlüssel ruft die Brücke `setSound` gar nicht erst, und der
    // Kanal behält den Standardton des Systems. Ein Wert hier verlangte eine
    // eigene Datei unter `res/raw` — ein `sound` ohne diese Datei wäre ein
    // stummer Kanal, also derselbe Ausgang wie vor diesem Vorgang.
    await pushKanalAnlegen();
    expect(createChannel.mock.calls[0][0]).not.toHaveProperty("sound");
  });

  it("lässt iOS in Ruhe", async () => {
    // Kanäle gibt es dort nicht; die Brücke meldete den Aufruf als
    // `unimplemented`, und die Fehlerzeile stünde bei jedem Start im Log.
    plattform.mockReturnValue("ios");

    expect(await pushKanalAnlegen()).toBe("entfaellt");
    expect(createChannel).not.toHaveBeenCalled();
  });

  it("lässt das Web in Ruhe", async () => {
    istNativ.mockReturnValue(false);
    plattform.mockReturnValue("web");

    expect(await pushKanalAnlegen()).toBe("entfaellt");
    expect(createChannel).not.toHaveBeenCalled();
  });

  it("hält den Start nicht auf, wenn die Brücke ablehnt", async () => {
    // Unterhalb von Android 8 antwortet sie mit `unavailable`. Dort gibt es
    // keine Kanäle — und `default_sound` im Versand greift auf diesen Geräten
    // wieder. Ein Wurf aus dem Start heraus wäre die schlechtere Antwort.
    createChannel.mockRejectedValueOnce(new Error("Not available"));

    expect(await pushKanalAnlegen()).toBe("fehler");
  });
});
