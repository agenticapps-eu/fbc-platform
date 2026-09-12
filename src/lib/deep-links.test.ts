import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Der Weg von einer geöffneten Adresse ins Routing (AGE-643, §6).
 *
 * `appUrlOpen` ist ein natives Ereignis und feuert in jsdom nie. Geprüft wird
 * deshalb, was hier entschieden wird — die Übersetzung — und DASS der Zuhörer
 * hängt und wieder abgeht. Ein Test, der auf die Ereignisquelle wartet, wäre
 * grün, weil nichts passiert; dieselbe Falle wie beim `backButton`.
 */

const { addListener, remove, istNativ } = vi.hoisted(() => ({
  addListener: vi.fn(),
  remove: vi.fn(async () => {}),
  istNativ: vi.fn(() => true),
}));

vi.mock("@capacitor/app", () => ({ App: { addListener } }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: istNativ } }));

const { deepLinkZiel, deepLinkZuhoerer } = await import("./deep-links");

const LINK = (pfad: string) => `https://app.effbeezee.com${pfad}`;

beforeEach(() => {
  addListener.mockReset();
  remove.mockClear();
  istNativ.mockReturnValue(true);
  addListener.mockResolvedValue({ remove });
});

describe("deepLinkZiel — die Übersetzung", () => {
  it.each([
    ["/aktivierung", "/aktivierung"],
    ["/chat/abc-123", "/chat/abc-123"],
    ["/events/42", "/events/42"],
    ["/p/9f7", "/p/9f7"],
    ["/events/42?von=mail", "/events/42?von=mail"],
  ])("übersetzt %s", (pfad, erwartet) => {
    expect(deepLinkZiel(LINK(pfad))).toBe(erwartet);
  });

  it("führt das Fragment mit — dort steht der Aktivierungs-Token", () => {
    // DER TEUERSTE PFAD. Der Token steht im Fragment, nicht im Query
    // (`src/instrument.test.ts`, `App.test.tsx`). Eine Übersetzung aus
    // `pathname` + `search` allein öffnete die App auf dem Aktivierungsweg
    // ohne Token — und das ist für viele der erste Kontakt überhaupt.
    expect(deepLinkZiel(LINK("/aktivierung#token=abc.def"))).toBe("/aktivierung#token=abc.def");
  });

  it.each([
    ["/login", "keine beanspruchte Route"],
    ["/passwort-neu#token=abc", "bewusst draussen (Entwurf, Entscheidung 10)"],
    ["/", "die Startseite"],
    ["/aktivierungsfeier", "Präfix ohne Trennzeichen"],
  ])("verwirft %s (%s)", (pfad) => {
    expect(deepLinkZiel(LINK(pfad))).toBeNull();
  });

  it.each([
    "https://boese.example/chat/abc",
    "http://app.effbeezee.com/chat/abc",
    "effbeezee://chat/abc",
    "kein-url",
  ])("verwirft die fremde Adresse %s", (adresse) => {
    expect(deepLinkZiel(adresse)).toBeNull();
  });
});

describe("deepLinkZuhoerer — hängen und abgehen", () => {
  it("navigiert ans übersetzte Ziel", async () => {
    const navigiere = vi.fn();
    deepLinkZuhoerer(navigiere);

    expect(addListener).toHaveBeenCalledTimes(1);
    expect(addListener.mock.calls[0]?.[0]).toBe("appUrlOpen");

    addListener.mock.calls[0]?.[1]({ url: LINK("/chat/abc-123") });
    expect(navigiere).toHaveBeenCalledWith("/chat/abc-123");
  });

  it("bewegt nichts, wenn die Adresse zu keinem bekannten Pfad gehört", () => {
    // Die Gegenprobe. Ohne sie belegte der Test darüber auch einen Sprung auf
    // gut Glück.
    const navigiere = vi.fn();
    deepLinkZuhoerer(navigiere);

    addListener.mock.calls[0]?.[1]({ url: LINK("/login") });
    expect(navigiere).not.toHaveBeenCalled();
  });

  it("entfernt den Zuhörer beim Abräumen", async () => {
    const abraeumen = deepLinkZuhoerer(vi.fn());
    await addListener.mock.results[0]?.value;

    abraeumen();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("entfernt ihn auch, wenn das Abräumen vor dem Anmelden kommt", async () => {
    // Der Fall, den das Muster daneben am `backButton` trägt: `addListener`
    // gibt ein Versprechen zurück. Wer vorher abräumt, liesse den Zuhörer
    // sonst für immer stehen.
    const abraeumen = deepLinkZuhoerer(vi.fn());
    abraeumen();
    await addListener.mock.results[0]?.value;

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("hängt im Web gar nicht erst", () => {
    istNativ.mockReturnValue(false);
    deepLinkZuhoerer(vi.fn());
    expect(addListener).not.toHaveBeenCalled();
  });
});
