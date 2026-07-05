import { describe, expect, it } from "vitest";
import { DEFAULT_MEMBER_SETTINGS, type MemberSettings } from "./member-settings";

describe("member-settings defaults", () => {
  it("listet im Verzeichnis und erlaubt Prime-Kontakt standardmäßig", () => {
    const s: MemberSettings = DEFAULT_MEMBER_SETTINGS;
    expect(s.visible_in_directory).toBe(true);
    expect(s.contactable_by_prime).toBe(true);
    expect(s.notify_email_requests).toBe(true);
    expect(s.notify_email_events).toBe(true);
    expect(s.notify_email_digest).toBe(false);
  });
});
