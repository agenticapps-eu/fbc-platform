import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Die Kontaktzeile im Profil-Editor (AGE-537, C6a).
 *
 * Bis zu diesem Change schrieb auf `profile_contacts` ausschließlich
 * `admin_update_profile()` — ein Mitglied kam an die eigene Telefonnummer nicht
 * heran. Hier steht, was der erste Mitglieder-Schreibweg tut.
 *
 * Gemockt ist ausschließlich der Rand zur Datenbank. Die Aussagen sind: WAS
 * geht als Upsert an `profile_contacts`, wie werden leere Felder abgelegt, und
 * was kommt beim Laden zurück, wenn es noch gar keine Zeile gibt.
 */

const upserts: { table: string; payload: Record<string, unknown> }[] = [];
let contactRow: Record<string, unknown> | null = null;

vi.mock("./supabase", () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        upload: async () => ({ error: null }),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://cdn.test/${bucket}/${path}` },
        }),
      }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: profilZeile, error: null }),
          maybeSingle: async () => ({ data: contactRow, error: null }),
          order: async () => ({ data: [], error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: async () => ({
              data: { profile_completion: 42, avatar_url: null, cover_url: null },
              error: null,
            }),
          }),
        }),
      }),
      upsert: async (payload: Record<string, unknown>) => {
        upserts.push({ table, payload });
        return { error: null };
      },
      delete: () => ({ eq: async () => ({ error: null }) }),
      insert: async () => ({ error: null }),
    }),
    rpc: async () => ({ error: null }),
  },
}));

vi.mock("./matches", () => ({ recomputeMyMatches: async () => {} }));

import {
  EMPTY_PROFILE_FORM,
  fetchProfileEditorData,
  profileFormSchema,
  saveProfile,
  type ProfileFormValues,
} from "./profile";

const UID = "11111111-1111-1111-1111-111111111111";

const profilZeile = {
  id: UID,
  name: "Testi",
  region: "Stuttgart",
  company: "Firma",
  short_bio: "Kurz",
  avatar_url: null,
  cover_url: null,
  branche: "Immobilien",
  headline: "",
  roles: [],
  competencies: [],
  website: "",
  dev_focus: null,
  socials: {},
  videos: [],
};

function werte(over: Partial<ProfileFormValues> = {}): ProfileFormValues {
  return {
    ...EMPTY_PROFILE_FORM,
    name: "Testi",
    region: "Stuttgart",
    company: "Firma",
    short_bio: "Kurz",
    ...over,
  };
}

beforeEach(() => {
  upserts.length = 0;
  contactRow = null;
});

describe("saveProfile — die Kontaktzeile", () => {
  it("schreibt Anschrift, E-Mail und Telefon als Upsert auf profile_contacts", async () => {
    await saveProfile(
      UID,
      werte({
        contact: {
          email: "ich@example.test",
          phone: "+49 711 1",
          street: "Hauptstr. 1",
          postal_code: "70173",
          city: "Stuttgart",
          state: "Baden-Württemberg",
          country: "DE",
        },
      }),
      null,
    );

    const kontakt = upserts.find((u) => u.table === "profile_contacts");
    expect(kontakt?.payload).toEqual({
      profile_id: UID,
      email: "ich@example.test",
      phone: "+49 711 1",
      street: "Hauptstr. 1",
      postal_code: "70173",
      city: "Stuttgart",
      state: "Baden-Württemberg",
      country: "DE",
    });
  });

  it("legt leere Felder als null ab, damit ein Leeren auch wirklich leert", async () => {
    await saveProfile(UID, werte(), null);

    const kontakt = upserts.find((u) => u.table === "profile_contacts");
    expect(kontakt?.payload).toEqual({
      profile_id: UID,
      email: null,
      phone: null,
      street: null,
      postal_code: null,
      city: null,
      state: null,
      country: null,
    });
  });
});

describe("fetchProfileEditorData — die Kontaktzeile", () => {
  it("liest eine vorhandene Zeile in das Formular", async () => {
    contactRow = {
      email: "ich@example.test",
      phone: null,
      street: "Hauptstr. 1",
      postal_code: "70173",
      city: "Stuttgart",
      state: null,
      country: "DE",
    };

    const werteAusDb = await fetchProfileEditorData(UID);

    expect(werteAusDb.contact).toEqual({
      email: "ich@example.test",
      phone: "",
      street: "Hauptstr. 1",
      postal_code: "70173",
      city: "Stuttgart",
      state: "",
      country: "DE",
    });
  });

  it("erfindet ohne Kontaktzeile kein Land", async () => {
    contactRow = null;

    const werteAusDb = await fetchProfileEditorData(UID);

    // Der Platzhalter im Feld darf „DE" zeigen; der WERT bleibt leer. Sonst
    // schriebe die nächste Speicherung ein Land, das niemand eingetragen hat.
    expect(werteAusDb.contact.country).toBe("");
    expect(werteAusDb.contact.street).toBe("");
  });
});

describe("profileFormSchema — die Kontakt-E-Mail", () => {
  it("weist eine unbrauchbare Adresse ab", () => {
    const ergebnis = profileFormSchema.safeParse(
      werte({ contact: { ...EMPTY_PROFILE_FORM.contact, email: "keine-adresse" } }),
    );
    expect(ergebnis.success).toBe(false);
  });

  it("lässt ein leeres Feld durch — die Kontaktadresse ist freiwillig", () => {
    const ergebnis = profileFormSchema.safeParse(werte());
    expect(ergebnis.success).toBe(true);
  });
});
