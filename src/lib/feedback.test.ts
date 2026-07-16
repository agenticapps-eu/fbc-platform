import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
vi.mock("./supabase", () => ({
  supabase: { from: (table: string) => ({ insert: (row: unknown) => insert(table, row) }) },
}));

import { submitPlatformFeedback } from "./feedback";

beforeEach(() => {
  insert.mockReset();
  insert.mockResolvedValue({ error: null });
});

describe("submitPlatformFeedback", () => {
  it("schreibt die drei Texte und die Route in die feedback-Zeile", async () => {
    await submitPlatformFeedback({
      profileId: "u1",
      rating: 4,
      likes: "Der Compass",
      misses: "Nichts",
      idea: "Mehr Events",
      route: "/meine-chancen",
    });

    expect(insert).toHaveBeenCalledWith("feedback", {
      profile_id: "u1",
      rating: 4,
      likes: "Der Compass",
      misses: "Nichts",
      idea: "Mehr Events",
      route: "/meine-chancen",
    });
  });

  it("lässt ref_type/ref_id weg — sonst zählte das Feedback auf den Potenzial-Score", async () => {
    await submitPlatformFeedback({
      profileId: "u1",
      rating: 1,
      likes: "",
      misses: "",
      idea: "",
      route: "/",
    });

    const row = insert.mock.calls[0][1] as Record<string, unknown>;
    expect(row).not.toHaveProperty("ref_type");
    expect(row).not.toHaveProperty("ref_id");
  });

  it("reicht einen Fehler der DB durch, statt ihn zu schlucken", async () => {
    insert.mockResolvedValue({ error: { message: "new row violates row-level security policy" } });

    await expect(
      submitPlatformFeedback({
        profileId: "u1",
        rating: 5,
        likes: "",
        misses: "",
        idea: "",
        route: "/",
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining("row-level security") });
  });
});
