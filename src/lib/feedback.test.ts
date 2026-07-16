import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const rpc = vi.fn();
vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => ({ insert: (row: unknown) => insert(table, row) }),
    rpc: (name: string) => rpc(name),
  },
}));

import { fetchAdminFeedback, submitPlatformFeedback } from "./feedback";

beforeEach(() => {
  insert.mockReset();
  insert.mockResolvedValue({ error: null });
  rpc.mockReset();
  rpc.mockResolvedValue({ data: [], error: null });
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

describe("fetchAdminFeedback", () => {
  it("ruft die RPC admin_list_feedback und gibt ihre Zeilen zurück", async () => {
    rpc.mockResolvedValue({ data: [{ id: "f1", author_name: "Anna" }], error: null });

    const rows = await fetchAdminFeedback();

    expect(rpc).toHaveBeenCalledWith("admin_list_feedback");
    expect(rows).toEqual([{ id: "f1", author_name: "Anna" }]);
  });

  it("gibt eine leere Liste zurück, wenn die RPC null liefert (Nicht-Admin sieht nichts)", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    expect(await fetchAdminFeedback()).toEqual([]);
  });

  it("reicht einen Fehler der RPC durch, statt ihn zu schlucken", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(fetchAdminFeedback()).rejects.toMatchObject({ message: "boom" });
  });
});
