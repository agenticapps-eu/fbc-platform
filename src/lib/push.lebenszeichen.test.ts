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
const { checkPermissions, requestPermissions, register, addListener, rpc, zuhoerer } = vi.hoisted(
  () => {
    // Die Zuhoerer werden FESTGEHALTEN, nicht bloss gezaehlt. Ohne das prueft
    // der Lauf nur, DASS `register()` lief — und ein Diff, der
    // `claim_push_token` herausnimmt, bliebe gruen, waehrend `letzter_kontakt`
    // nie wieder steigt und der Aufraeumer lebende Token loescht. Genau dieser
    // blinde Fleck kam aus der Diff-Review.
    const zuhoerer = new Map<string, (e: { value: string }) => Promise<void> | void>();
    return {
      checkPermissions: vi.fn(async () => ({ receive: "granted" as string })),
      requestPermissions: vi.fn(async () => ({ receive: "granted" as string })),
      register: vi.fn(async () => {}),
      addListener: vi.fn(async (name: string, cb: (e: { value: string }) => void) => {
        zuhoerer.set(name, cb);
      }),
      rpc: vi.fn(async () => ({ error: null })),
      zuhoerer,
    };
  },
);

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

  it("legt das erneuerte Token über claim_push_token ab", async () => {
    // DIE Zusage, an der der ganze Vorgang hängt: `register()` allein erneuert
    // nichts. Erst das `registration`-Ereignis schreibt `letzter_kontakt` — und
    // ohne diesen Test bliebe ein Diff grün, der genau diesen RPC entfernt.
    await pushLebenszeichen();
    const beiRegistrierung = zuhoerer.get("registration");
    expect(beiRegistrierung).toBeTypeOf("function");

    await beiRegistrierung!({ value: "tok-erneuert" });

    expect(rpc).toHaveBeenCalledWith("claim_push_token", {
      p_token: "tok-erneuert",
      p_plattform: "ios",
    });
  });

  it("fragt NICHT, wenn die Erlaubnis noch offen ist — und registriert auch nicht", async () => {
    checkPermissions.mockResolvedValue({ receive: "prompt" });

    expect(await pushLebenszeichen()).toBe("abgelehnt");
    expect(requestPermissions).not.toHaveBeenCalled();
    // Ohne Erlaubnis gibt es kein Token zu erneuern — `register()` liefe ins
    // Leere. NICHT, weil es den Dialog auslöste: `register()` ruft nur
    // `registerForRemoteNotifications()`, der Dialog entsteht ausschliesslich
    // über `requestPermissions()`. (Befund der Diff-Review; die erste Fassung
    // dieses Kommentars behauptete das Gegenteil.)
    expect(register).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
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
