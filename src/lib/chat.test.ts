import { describe, expect, it } from "vitest";

import { mapMessageRow, mapThreadRow, mergeMessage, type ChatMessage } from "./chat";

const uid = "me-uuid";
const partnerId = "partner-uuid";

describe("mapMessageRow", () => {
  it("maps a messages row to the UI model", () => {
    expect(
      mapMessageRow({
        id: "m1",
        thread_id: "t1",
        sender_id: partnerId,
        body: "Hallo",
        created_at: "2026-06-14T10:00:00Z",
      }),
    ).toEqual({
      id: "m1",
      threadId: "t1",
      senderId: partnerId,
      body: "Hallo",
      createdAt: "2026-06-14T10:00:00Z",
    });
  });
});

describe("mapThreadRow (§9 Thread-Liste)", () => {
  const thread = {
    id: "t1",
    a_profile_id: uid,
    b_profile_id: partnerId,
    created_at: "2026-06-14T09:00:00Z",
  };
  const partner = {
    id: partnerId,
    name: "Anna Becker",
    avatar_url: null,
    company: "Becker GmbH",
    tier: "legacy",
  };

  it("derives the partner as the OTHER participant, regardless of a/b order", () => {
    const fromA = mapThreadRow(thread, uid, partner, null);
    const fromB = mapThreadRow(
      { ...thread, a_profile_id: partnerId, b_profile_id: uid },
      uid,
      partner,
      null,
    );
    expect(fromA.partner.id).toBe(partnerId);
    expect(fromB.partner.id).toBe(partnerId);
    expect(fromA.partner.name).toBe("Anna Becker");
  });

  it("uses the last message for preview + sort key; null when empty", () => {
    const empty = mapThreadRow(thread, uid, partner, null);
    expect(empty.lastMessage).toBeNull();
    expect(empty.lastActivityAt).toBe(thread.created_at);

    const withMsg = mapThreadRow(thread, uid, partner, {
      body: "Bis morgen",
      created_at: "2026-06-14T12:00:00Z",
      sender_id: uid,
    });
    expect(withMsg.lastMessage).toEqual({
      body: "Bis morgen",
      createdAt: "2026-06-14T12:00:00Z",
      fromMe: true,
    });
    expect(withMsg.lastActivityAt).toBe("2026-06-14T12:00:00Z");
  });

  it("falls back to a neutral label when the partner profile is missing", () => {
    expect(mapThreadRow(thread, uid, undefined, null).partner.name).toBe("Mitglied");
  });
});

describe("mergeMessage (§9 optimistisches Senden + Realtime)", () => {
  const optimistic: ChatMessage = {
    id: "optimistic-1",
    threadId: "t1",
    senderId: uid,
    body: "Hallo von mir",
    createdAt: "2026-06-14T10:00:00Z",
    pending: true,
  };

  it("reconciles the pending bubble with the real row (same sender+body)", () => {
    const real: ChatMessage = {
      id: "m-real",
      threadId: "t1",
      senderId: uid,
      body: "Hallo von mir",
      createdAt: "2026-06-14T10:00:01Z",
    };
    const merged = mergeMessage([optimistic], real);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("m-real");
    expect(merged[0].pending).toBeUndefined();
  });

  it("is idempotent — a row already present by id is not duplicated", () => {
    const real: ChatMessage = {
      id: "m-real",
      threadId: "t1",
      senderId: partnerId,
      body: "Antwort",
      createdAt: "2026-06-14T10:05:00Z",
    };
    const once = mergeMessage([], real);
    const twice = mergeMessage(once, real);
    expect(twice).toHaveLength(1);
  });

  it("appends a genuinely new message and keeps chronological order", () => {
    const a: ChatMessage = {
      id: "a",
      threadId: "t1",
      senderId: uid,
      body: "erst",
      createdAt: "2026-06-14T10:00:00Z",
    };
    const b: ChatMessage = {
      id: "b",
      threadId: "t1",
      senderId: partnerId,
      body: "danach",
      createdAt: "2026-06-14T10:01:00Z",
    };
    const merged = mergeMessage([b], a);
    expect(merged.map((m) => m.id)).toEqual(["a", "b"]);
  });
});
