import { describe, expect, it } from "vitest";
import {
  PROFILE_COMPLETE_THRESHOLD,
  computeProfileCompletion,
  isProfileComplete,
  profileFormSchema,
  sanitizeVideos,
  type ProfileFormValues,
} from "./profile";

const EMPTY: ProfileFormValues = {
  name: "",
  region: "",
  company: "",
  short_bio: "",
  avatar_url: null,
  cover_url: null,
  branche: "",
  headline: "",
  roles: [],
  competencies: [],
  website: "",
  dev_focus: "",
  socials: { linkedin: "", instagram: "", xing: "", facebook: "", youtube: "", twitter: "" },
  interests: [],
  goals: [],
  videos: [],
  contact: {
    email: "",
    phone: "",
    street: "",
    postal_code: "",
    city: "",
    state: "",
    country: "",
  },
};

/** Die 12 gewichteten Felder, jeweils mit einem „gefüllten“ Wert. */
const FILLED: ProfileFormValues = {
  name: "Maximilian Bauer",
  region: "Stuttgart",
  company: "Bauer Holding",
  short_bio: "Unternehmer und Investor.",
  avatar_url: "https://example.test/a.webp",
  cover_url: null,
  branche: "Immobilien",
  headline: "Unternehmer · Investor",
  roles: ["Investor"],
  competencies: ["Deal Sourcing"],
  website: "https://example.test",
  dev_focus: "wirken",
  socials: { linkedin: "max", instagram: "", xing: "", facebook: "", youtube: "", twitter: "" },
  interests: [],
  goals: [],
  videos: [],
  contact: {
    email: "",
    phone: "",
    street: "",
    postal_code: "",
    city: "",
    state: "",
    country: "",
  },
};

describe("computeProfileCompletion", () => {
  it("ist 0 % für ein leeres Profil", () => {
    expect(computeProfileCompletion(EMPTY)).toBe(0);
  });

  it("ist 100 % wenn alle 12 Felder gefüllt sind", () => {
    expect(computeProfileCompletion(FILLED)).toBe(100);
  });

  it("zählt leere Arrays und nur-leere Socials nicht", () => {
    const partial: ProfileFormValues = {
      ...EMPTY,
      name: "A",
      region: "B",
      roles: [],
      socials: { linkedin: "", instagram: "", xing: "", facebook: "", youtube: "", twitter: "" },
    };
    expect(computeProfileCompletion(partial)).toBe(Math.floor((2 * 100) / 12));
  });

  it("erreicht „vollständig“ bei 10 von 12 Feldern (≥ 80 %), nicht bei 9", () => {
    const nine: ProfileFormValues = { ...FILLED, dev_focus: "", website: "", branche: "" };
    const ten: ProfileFormValues = { ...FILLED, dev_focus: "", website: "" };

    expect(computeProfileCompletion(nine)).toBe(75);
    expect(isProfileComplete(computeProfileCompletion(nine))).toBe(false);

    expect(computeProfileCompletion(ten)).toBe(83);
    expect(computeProfileCompletion(ten)).toBeGreaterThanOrEqual(PROFILE_COMPLETE_THRESHOLD);
    expect(isProfileComplete(computeProfileCompletion(ten))).toBe(true);
  });
});

describe("sanitizeVideos (AGE-252)", () => {
  it("behält gültige YouTube-/Vimeo-Links (getrimmt) und bewahrt die Reihenfolge", () => {
    expect(
      sanitizeVideos(["  https://youtu.be/dQw4w9WgXcQ  ", "https://vimeo.com/123456789"]),
    ).toEqual(["https://youtu.be/dQw4w9WgXcQ", "https://vimeo.com/123456789"]);
  });

  it("verwirft leere und nicht einbettbare Einträge", () => {
    expect(
      sanitizeVideos(["", "   ", "nur text", "https://evil.example.com/x", "javascript:alert(1)"]),
    ).toEqual([]);
  });
});

describe("socials — die fünf Netzwerke aus dem Altbestand (AGE-534)", () => {
  it("behält facebook, youtube und twitter beim Parsen", () => {
    // Der Löschpfad, den der Import sonst hätte: `z.object` entfernt unbekannte
    // Schlüssel STILL (strip, nicht strict). Ein importiertes `facebook` läge
    // damit zwar in der jsonb-Spalte, verschwände aber beim ersten Speichern
    // des Mitglieds — saveProfile ersetzt die Spalte vollständig.
    // Betroffen: 23 der 70 Altmitglieder, 5 davon ohne jedes andere Netzwerk.
    const werte = profileFormSchema.parse({
      ...EMPTY,
      name: "Anna",
      region: "Rhein-Main",
      company: "Berg GmbH",
      short_bio: "Kurz",
      socials: {
        linkedin: "https://linkedin.com/in/a",
        instagram: "",
        xing: "",
        facebook: "https://facebook.com/b",
        youtube: "https://youtube.com/@c",
        twitter: "https://x.com/d",
      },
    });

    expect(werte.socials.facebook).toBe("https://facebook.com/b");
    expect(werte.socials.youtube).toBe("https://youtube.com/@c");
    expect(werte.socials.twitter).toBe("https://x.com/d");
  });

  it("zählt ein Profil auch dann als vernetzt, wenn nur facebook gefüllt ist", () => {
    // Sonst wäre die Vollständigkeit für die 5 Menschen ohne linkedin/instagram
    // niedriger, als ihr Profil hergibt.
    const nurFacebook = {
      ...EMPTY,
      socials: { ...EMPTY.socials, facebook: "https://facebook.com/b" },
    };

    expect(computeProfileCompletion(nurFacebook)).toBeGreaterThan(
      computeProfileCompletion(EMPTY),
    );
  });
});
