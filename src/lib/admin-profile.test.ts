import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Der Admin-Weg (AGE-498). Die Aussagen, die hier zählen:
 *
 *  1. Er geht über die RPCs und NICHT über einen direkten Tabellenzugriff —
 *     der scheiterte am Spalten-Grant bzw. an der Policy.
 *  2. Der Patch trägt die Typen, die `admin_update_profile` erwartet. Ein
 *     leeres Datumsfeld als `""` würde die Funktion abbrechen lassen, und der
 *     Admin sähe einen Fehler für ein Feld, das er nie angefasst hat.
 */

const rpcCalls: { name: string; args: unknown }[] = [];
const tableCalls: string[] = [];
let rpcAntwort: unknown = null;

vi.mock("./supabase", () => ({
  supabase: {
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return { data: rpcAntwort, error: null };
    },
    from: (name: string) => {
      tableCalls.push(name);
      throw new Error(`Kein direkter Tabellenzugriff im Admin-Weg: ${name}`);
    },
    functions: {
      invoke: async (name: string, opts: unknown) => {
        rpcCalls.push({ name: `fn:${name}`, args: opts });
        return { data: { status: "ok" }, error: null };
      },
    },
  },
}));

import { changeLoginEmail, fetchAdminProfile, findProfiles, saveAdminProfile } from "./admin-profile";

const ZIEL = "c6c6c6c6-0000-0000-0000-0000000000b1";

beforeEach(() => {
  rpcCalls.length = 0;
  tableCalls.length = 0;
  rpcAntwort = null;
});

describe("fetchAdminProfile", () => {
  it("liest über admin_get_profile und füllt das Formular", async () => {
    rpcAntwort = {
      profile: { name: "Importiert", company: "Alt GmbH", roles: ["Vorstand"], cover_url: null },
      contact: { email: "kontakt@alt.de", phone: null },
      legacy: { paid_until: "2027-06-30", legacy_price: 1200, legacy_tier: "Premium" },
      login_email: "login@alt.de",
    };

    const daten = await fetchAdminProfile(ZIEL);

    expect(rpcCalls[0]).toEqual({ name: "admin_get_profile", args: { target: ZIEL } });
    expect(tableCalls).toEqual([]);
    expect(daten.form.name).toBe("Importiert");
    expect(daten.form.roles).toEqual(["Vorstand"]);
    expect(daten.contact.email).toBe("kontakt@alt.de");
    expect(daten.legacy.paid_until).toBe("2027-06-30");
    expect(daten.loginEmail).toBe("login@alt.de");
  });

  it("verträgt ein Profil ohne Kontakt- und Altdatenzeile", async () => {
    rpcAntwort = { profile: { name: "Nackt" }, contact: null, legacy: null, login_email: "a@b.de" };

    const daten = await fetchAdminProfile(ZIEL);

    expect(daten.contact.email).toBe("");
    expect(daten.legacy.paid_until).toBe("");
  });
});

describe("saveAdminProfile", () => {
  const form = {
    name: "Korrigiert",
    region: "Berlin",
    company: "Neu GmbH",
    short_bio: "Kurz",
    avatar_url: null,
    cover_url: null,
    branche: "",
    headline: "",
    roles: ["Vorstand", "Beirat"],
    competencies: [],
    website: "",
    dev_focus: "" as const,
    socials: { linkedin: "", instagram: "", xing: "" },
    interests: [],
    goals: [],
    videos: [],
  };

  it("ruft admin_update_profile und fasst kein Tabellenobjekt an", async () => {
    await saveAdminProfile(ZIEL, form, { email: "neu@fbc.de", phone: "" }, {
      paid_until: "2027-06-30",
      legacy_tier: "Premium",
      legacy_price: "1200",
      legacy_source_id: "wp-4711",
    });

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("admin_update_profile");
    expect(tableCalls).toEqual([]);
  });

  it("schickt Arrays als Arrays und Zahlen als Zahlen", async () => {
    await saveAdminProfile(ZIEL, form, { email: "", phone: "" }, {
      paid_until: "2027-06-30",
      legacy_tier: "",
      legacy_price: "1200.50",
      legacy_source_id: "",
    });

    const patch = (rpcCalls[0].args as { patch: Record<string, unknown> }).patch;
    expect(patch.roles).toEqual(["Vorstand", "Beirat"]);
    expect(patch.legacy_price).toBe(1200.5);
    expect(patch.paid_until).toBe("2027-06-30");
  });

  it("macht aus leeren Feldern null — sonst bricht der Datums-Cast ab", async () => {
    await saveAdminProfile(ZIEL, form, { email: "", phone: "" }, {
      paid_until: "",
      legacy_tier: "",
      legacy_price: "",
      legacy_source_id: "",
    });

    const patch = (rpcCalls[0].args as { patch: Record<string, unknown> }).patch;
    expect(patch.paid_until).toBeNull();
    expect(patch.legacy_price).toBeNull();
    expect(patch.email).toBeNull();
  });

  it("schickt kein tier — der Stufenwechsel gehört nicht hierher", async () => {
    await saveAdminProfile(ZIEL, form, { email: "", phone: "" }, {
      paid_until: "",
      legacy_tier: "",
      legacy_price: "",
      legacy_source_id: "",
    });

    const patch = (rpcCalls[0].args as { patch: Record<string, unknown> }).patch;
    expect(patch).not.toHaveProperty("tier");
    expect(patch).not.toHaveProperty("potential_score");
    expect(patch).not.toHaveProperty("profile_completion");
  });
});

describe("findProfiles und changeLoginEmail", () => {
  it("sucht über admin_find_profile", async () => {
    rpcAntwort = [{ id: ZIEL, name: "Importiert", login_email: "a@b.de", bestaetigt: false }];
    const treffer = await findProfiles("importiert");
    expect(rpcCalls[0]).toEqual({ name: "admin_find_profile", args: { needle: "importiert" } });
    expect(treffer).toHaveLength(1);
  });

  it("ändert die Login-Adresse über die Edge Function, nicht über die Datenbank", async () => {
    await changeLoginEmail(ZIEL, "neu@fbc.de");
    expect(rpcCalls[0].name).toBe("fn:admin-change-email");
    expect((rpcCalls[0].args as { body: unknown }).body).toEqual({
      target: ZIEL,
      email: "neu@fbc.de",
    });
  });
});
