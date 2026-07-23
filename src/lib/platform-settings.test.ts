import { describe, expect, it } from "vitest";
import { DEFAULT_PLATFORM_SETTINGS, platformSettingsFromRow } from "./platform-settings";

describe("platformSettingsFromRow", () => {
  it("liest open_contact aus der Zeile", () => {
    expect(platformSettingsFromRow({ open_contact: true })).toEqual({ openContact: true });
    expect(platformSettingsFromRow({ open_contact: false })).toEqual({ openContact: false });
  });

  it("fällt ohne Zeile auf den sicheren Default (geschlossen) zurück", () => {
    expect(platformSettingsFromRow(null)).toEqual(DEFAULT_PLATFORM_SETTINGS);
    expect(DEFAULT_PLATFORM_SETTINGS.openContact).toBe(false);
  });
});
