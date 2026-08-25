import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const rpc = vi.fn();
vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => ({ insert: (row: unknown) => insert(table, row) }),
    rpc: (name: string, args?: unknown) => rpc(name, args),
  },
}));

import {
  adminFeedbackQueryKey,
  fetchAdminFeedback,
  FEEDBACK_SEITENGROESSE,
  submitPlatformFeedback,
} from "./feedback";

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
  it("holt die erste Seite mit p_limit/p_offset — und EINE Zeile mehr als sie zeigt", async () => {
    rpc.mockResolvedValue({ data: [{ id: "f1", author_name: "Anna", profile_id: "u1" }], error: null });

    const seite = await fetchAdminFeedback(0);

    // Die Zusatzzeile ist der Weg, „gibt es eine Folgeseite?" zu beantworten,
    // ohne eine zweite, zaehlende Abfrage an dieselben Daten zu stellen —
    // dasselbe Muster wie `fetchAdminMembers`.
    expect(rpc).toHaveBeenCalledWith("admin_list_feedback", {
      p_limit: FEEDBACK_SEITENGROESSE + 1,
      p_offset: 0,
    });
    expect(seite.feedbacks).toEqual([{ id: "f1", author_name: "Anna", profile_id: "u1" }]);
    expect(seite.hatWeitere).toBe(false);
  });

  it("verschiebt den Offset mit der Seite — sonst zeigt Seite 2 den Inhalt von Seite 1", async () => {
    await fetchAdminFeedback(2);

    expect(rpc).toHaveBeenCalledWith("admin_list_feedback", {
      p_limit: FEEDBACK_SEITENGROESSE + 1,
      p_offset: 2 * FEEDBACK_SEITENGROESSE,
    });
  });

  it("zeigt die Zusatzzeile NICHT an, meldet aber die Folgeseite", async () => {
    rpc.mockResolvedValue({
      data: Array.from({ length: FEEDBACK_SEITENGROESSE + 1 }, (_, i) => ({ id: `f${i}` })),
      error: null,
    });

    const seite = await fetchAdminFeedback(0);

    expect(seite.feedbacks).toHaveLength(FEEDBACK_SEITENGROESSE);
    expect(seite.hatWeitere).toBe(true);
  });

  it("gibt die profile_id heraus — die Zeile soll verknuepfbar sein, nicht nur lesbar", async () => {
    rpc.mockResolvedValue({ data: [{ id: "f1", author_name: "Anna", profile_id: "u7" }], error: null });

    const seite = await fetchAdminFeedback(0);

    expect(seite.feedbacks[0].profile_id).toBe("u7");
  });

  it("gibt eine leere Liste zurück, wenn die RPC null liefert (Nicht-Admin sieht nichts)", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    expect(await fetchAdminFeedback(0)).toEqual({ feedbacks: [], hatWeitere: false });
  });

  it("reicht einen Fehler der RPC durch, statt ihn zu einer leeren Liste zu glaetten", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(fetchAdminFeedback(0)).rejects.toMatchObject({ message: "boom" });
  });
});

describe("adminFeedbackQueryKey", () => {
  it("traegt die Seite im Schluessel — sonst zeigt Seite 2 den zwischengespeicherten Inhalt von Seite 1", () => {
    expect(adminFeedbackQueryKey(0)).not.toEqual(adminFeedbackQueryKey(1));
  });
});
