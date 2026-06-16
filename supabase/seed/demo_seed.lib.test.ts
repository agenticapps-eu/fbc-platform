import { describe, expect, it } from "vitest";

import { assertOptIn, parseMode, redactDatabaseUrl, resolveDatabaseUrl } from "./demo_seed.lib";

describe("assertOptIn", () => {
  it("passes when the confirm flag is exactly fbc-demo", () => {
    expect(() => assertOptIn({ DEMO_SEED_CONFIRM: "fbc-demo" })).not.toThrow();
  });

  it("throws when the confirm flag is missing", () => {
    expect(() => assertOptIn({})).toThrow(/DEMO_SEED_CONFIRM/);
  });

  it("throws when the confirm flag is wrong", () => {
    expect(() => assertOptIn({ DEMO_SEED_CONFIRM: "yes" })).toThrow(/DEMO_SEED_CONFIRM/);
  });
});

describe("parseMode", () => {
  it("defaults to seed", () => {
    expect(parseMode({})).toBe("seed");
    expect(parseMode({ DEMO_SEED_MODE: "seed" })).toBe("seed");
  });

  it("recognises reset", () => {
    expect(parseMode({ DEMO_SEED_MODE: "reset" })).toBe("reset");
  });

  it("rejects an unknown mode", () => {
    expect(() => parseMode({ DEMO_SEED_MODE: "wipe" })).toThrow(/DEMO_SEED_MODE/);
  });
});

describe("resolveDatabaseUrl", () => {
  it("prefers an explicit DEMO_SEED_DATABASE_URL", () => {
    const url = "postgresql://u:p@example.com:5432/postgres";
    expect(resolveDatabaseUrl({ DEMO_SEED_DATABASE_URL: url })).toBe(url);
  });

  it("constructs a session-pooler URL from SUPABASE_DB_PASSWORD", () => {
    const url = resolveDatabaseUrl({ SUPABASE_DB_PASSWORD: "p@ss/w#rd" });
    const parsed = new URL(url);
    expect(parsed.protocol).toBe("postgresql:");
    expect(parsed.username).toBe("postgres.foelowldexkcqzewvrcf");
    // Special characters are percent-encoded so the URL stays valid; the
    // original password must round-trip back out.
    expect(parsed.password).toBe(encodeURIComponent("p@ss/w#rd"));
    expect(decodeURIComponent(parsed.password)).toBe("p@ss/w#rd");
    expect(parsed.hostname).toBe("aws-1-eu-central-1.pooler.supabase.com");
    expect(parsed.port).toBe("5432");
    expect(parsed.pathname).toBe("/postgres");
  });

  it("throws a helpful error when no connection material is present", () => {
    expect(() => resolveDatabaseUrl({})).toThrow(/SUPABASE_DB_PASSWORD/);
  });
});

describe("redactDatabaseUrl", () => {
  it("never exposes the password", () => {
    const redacted = redactDatabaseUrl("postgresql://user:secret-pw@host.example:5432/postgres");
    expect(redacted).not.toContain("secret-pw");
    expect(redacted).toContain("host.example:5432");
  });

  it("is robust to an unparseable string", () => {
    expect(redactDatabaseUrl("not a url")).toBe("<unparseable database url>");
  });
});
