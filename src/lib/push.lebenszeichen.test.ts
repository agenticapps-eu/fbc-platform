import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AGE-682 — das stille Erneuern beim Start.
 *
 * WARUM ES DIESEN WEG GIBT. `letzter_kontakt` sollte ein Lebenszeichen des
 * Geräts sein und war keines: `claim_push_token` hängt allein an
 * `pushEinrichten`, und das wird nur beim Öffnen der Nachrichten gerufen,
 * dort einmal je Konto. Wer die App täglich nutzt und nie in den Chat geht,
 * hat einen Zeitstempel, der nie wieder steigt — und verlöre sein
 * funktionierendes Token an den Aufräumer. Gefunden von der Plan-Review,
 * bevor eine Zeile Code existierte (`REVIEWS.md`).
 *
 * WAS HIER GEPRÜFT WIRD — UND WARUM DAS NICHT DIE ALTE FALLE IST. Der
 * Hausstil lässt den Rest dieses Moduls ungetestet, weil Push-EREIGNISSE in
 * jsdom nie entstehen; ein Test, der auf sie wartet, wäre grün, weil nichts
 * passiert. Der Erlaubnis-Zweig ist davon nicht betroffen: `checkPermissions`,
 * `requestPermissions` und `register` sind gewöhnliche Promises an einer
 * Modulgrenze. Geprüft wird genau eines — WELCHE der drei gerufen wird.
 *
 * Die Zusage, auf die es ankommt, ist eine VERNEINUNG: der Start fragt NICHT.
 * iOS zeigt den Systemdialog einmal; ein Erneuern, das ihn auslöst, verbrennt
 * den Kanal für immer. Deshalb steht sie hier doppelt — einmal für `prompt`
 * und einmal für den Fall, dass die Erlaubnis schon erteilt ist.
 */
const { checkPermissions, requestPermissions, register, addListener, rpc } = vi.hoisted(() => ({
  checkPermissions: vi.fn(async () => ({ receive: "granted" as string })),
  requestPermissions: vi.fn(async () => ({ receive: "granted" as string })),
  register: vi.fn(async () => {}),
  addListener: vi.fn(async () => {}),
  rpc: vi.fn(async () => ({ error: null })),
}));

const { istNativ, plattform } = vi.hoisted(() => ({
  istNativ: vi.fn(() => true),
  plattform: vi.fn(() => "ios"),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: istNativ, getPlatform: plattform },
}));
vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: { checkPermissions, requestPermissions, register, addListener },
}));
vi.mock("./supabase", () => ({ supabase: { rpc } }));

// Erst NACH den Attrappen laden — sonst zieht das Modul die echte Brücke.
const { pushEinrichten, pushLebenszeichen } = await import("./push");

beforeEach(() => {
  vi.clearAllMocks();
  istNativ.mockReturnValue(true);
  plattform.mockReturnValue("ios");
  checkPermissions.mockResolvedValue({ receive: "granted" });
  requestPermissions.mockResolvedValue({ receive: "granted" });
});

describe("pushLebenszeichen — erneuert, ohne zu fragen", () => {
  it("registriert erneut, wenn die Erlaubnis schon erteilt ist", async () => {
    expect(await pushLebenszeichen()).toBe("registriert");
    expect(register).toHaveBeenCalledTimes(1);
    // DIE Zusage dieses Vorgangs: kein Dialog.
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("fragt NICHT, wenn die Erlaubnis noch offen ist — und registriert auch nicht", async () => {
    checkPermissions.mockResolvedValue({ receive: "prompt" });

    expect(await pushLebenszeichen()).toBe("abgelehnt");
    expect(requestPermissions).not.toHaveBeenCalled();
    // Ohne Erlaubnis gibt es kein Token zu erneuern. `register()` liefe hier
    // ins Leere und wäre auf iOS zudem der Auslöser des Dialogs.
    expect(register).not.toHaveBeenCalled();
  });

  it("fragt NICHT, wenn die Erlaubnis zurückgenommen wurde", async () => {
    checkPermissions.mockResolvedValue({ receive: "denied" });

    expect(await pushLebenszeichen()).toBe("abgelehnt");
    expect(requestPermissions).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });

  it("lässt die Web-Fläche vollständig in Ruhe", async () => {
    istNativ.mockReturnValue(false);
    plattform.mockReturnValue("web");

    expect(await pushLebenszeichen()).toBe("web");
    // Nicht einmal die Abfrage: `checkPermissions` gibt es im Browser nicht.
    expect(checkPermissions).not.toHaveBeenCalled();
    expect(requestPermissions).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });
});

describe("pushEinrichten — der Nachrichten-Weg bleibt, wie er war", () => {
  it("fragt weiterhin, wenn die Erlaubnis offen ist", async () => {
    checkPermissions.mockResolvedValue({ receive: "prompt" });
    requestPermissions.mockResolvedValue({ receive: "granted" });

    expect(await pushEinrichten()).toBe("registriert");
    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledTimes(1);
  });

  it("fragt auch bei `prompt-with-rationale`", async () => {
    checkPermissions.mockResolvedValue({ receive: "prompt-with-rationale" });
    requestPermissions.mockResolvedValue({ receive: "denied" });

    expect(await pushEinrichten()).toBe("abgelehnt");
    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(register).not.toHaveBeenCalled();
  });

  it("fragt nicht mehr, wenn die Erlaubnis bereits erteilt ist", async () => {
    // Der bestehende Weg hat diese Eigenschaft schon; sie steht hier, weil
    // beide Ausgänge sich denselben Rumpf teilen und eine Mutation darin
    // sonst nur eine Hälfte röten würde.
    expect(await pushEinrichten()).toBe("registriert");
    expect(requestPermissions).not.toHaveBeenCalled();
  });
});
