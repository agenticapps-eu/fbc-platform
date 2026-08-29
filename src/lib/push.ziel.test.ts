import { describe, expect, it } from "vitest";

import { pushZiel } from "./push";

/**
 * AGE-641 Phase B — wohin ein Tipp auf die Mitteilung führt.
 *
 * Die Serverseite legt das Ziel längst bei (`send-push/nachrichten.ts`:
 * `/chat/<thread_id>`, sonst `/chat`). Auf dem Gerät wurde es bis zum 28.08.
 * nicht gelesen — es gab keinen `pushNotificationActionPerformed`-Zuhörer, und
 * ein Tipp öffnete deshalb nur die App.
 *
 * GEPRÜFT WIRD DIE ENTSCHEIDUNG, NICHT DAS EREIGNIS. Push-Ereignisse entstehen
 * in jsdom nie; ein Test, der auf sie wartet, wäre grün, weil nichts passiert
 * — dieselbe Falle wie bei `env(safe-area-inset-*)` und beim `backButton`.
 */
describe("pushZiel — was aus der Nutzlast ein Sprungziel wird", () => {
  it("nimmt das Gespräch, das der Server beigelegt hat", () => {
    expect(pushZiel({ ziel: "/chat/abc-123" })).toBe("/chat/abc-123");
  });

  it("nimmt auch die Übersicht", () => {
    // `gespraechsziel` fällt ohne Kennung auf `/chat` zurück. Das ist ein
    // gültiges Ziel und kein Sonderfall.
    expect(pushZiel({ ziel: "/chat" })).toBe("/chat");
  });

  it("gibt ohne Ziel nichts zurück, statt irgendwohin zu springen", () => {
    // Drei der vier Hinweistypen legen bewusst KEIN Ziel bei. Ein Sprung auf
    // gut Glück wäre schlechter als das blosse Öffnen der App.
    expect(pushZiel({})).toBeNull();
    expect(pushZiel(undefined)).toBeNull();
    expect(pushZiel({ ziel: 42 })).toBeNull();
    expect(pushZiel({ ziel: "" })).toBeNull();
  });

  it("verweigert alles, was aus der App hinausführt", () => {
    // Heute kommt die Nutzlast vom eigenen Server. Sie kommt aber über einen
    // fremden Zustelldienst auf das Gerät, und dieser Wert wird ungeprüft in
    // eine Navigation gegeben — das ist die Stelle, an der aus einem
    // Push-Umleiter eine Phishing-Fläche wird.
    expect(pushZiel({ ziel: "https://example.com/chat" })).toBeNull();
    // Die schärfste der drei: protokollrelativ, sieht aus wie ein interner
    // Pfad, führt aber auf einen fremden Host.
    expect(pushZiel({ ziel: "//example.com/chat" })).toBeNull();
    expect(pushZiel({ ziel: "chat/abc" })).toBeNull();
    expect(pushZiel({ ziel: "javascript:alert(1)" })).toBeNull();
  });
});
