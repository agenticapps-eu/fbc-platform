import { describe, expect, it } from "vitest";
import { displayAuthor } from "./displayAuthor";

describe("displayAuthor", () => {
  const author = { id: "u1", name: "Eleonora Voss", avatarUrl: "https://x/a.jpg" };

  it("masks name and avatar for anonymous (logged-out) viewers", () => {
    const r = displayAuthor(author, false);
    expect(r.name).toBe("Ein Mitglied");
    expect(r.masked).toBe(true);
    expect(r.avatarUrl).toBeNull();
  });

  it("reveals real name and avatar for logged-in viewers", () => {
    const r = displayAuthor(author, true);
    expect(r.name).toBe("Eleonora Voss");
    expect(r.masked).toBe(false);
    expect(r.avatarUrl).toBe("https://x/a.jpg");
  });

  it("handles a missing avatar without masking when logged in", () => {
    const r = displayAuthor({ id: "u2", name: "Jonas Keller", avatarUrl: null }, true);
    expect(r.name).toBe("Jonas Keller");
    expect(r.masked).toBe(false);
    expect(r.avatarUrl).toBeNull();
  });
});
