import { describe, expect, it } from "vitest";

import {
  fasseUngelesenZusammen,
  mapMessageRow,
  mapThreadRow,
  mergeMessage,
  type ChatMessage,
} from "./chat";

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

  it("reconciles two identical-body pending bubbles to two distinct real rows", () => {
    // Selber Text zweimal schnell gesendet: beide echten Zeilen (distinct id)
    // müssen je eine pending-Blase ersetzen — keine darf verloren gehen oder kollabieren.
    const opt1: ChatMessage = { ...optimistic, id: "opt-1" };
    const opt2: ChatMessage = { ...optimistic, id: "opt-2", createdAt: "2026-06-14T10:00:01Z" };
    const real1: ChatMessage = {
      id: "real-1",
      threadId: "t1",
      senderId: uid,
      body: "Hallo von mir",
      createdAt: "2026-06-14T10:00:02Z",
    };
    const real2: ChatMessage = { ...real1, id: "real-2", createdAt: "2026-06-14T10:00:03Z" };

    const afterFirst = mergeMessage([opt1, opt2], real1);
    const afterSecond = mergeMessage(afterFirst, real2);
    expect(afterSecond).toHaveLength(2);
    expect(afterSecond.map((m) => m.id)).toEqual(["real-1", "real-2"]);
    expect(afterSecond.every((m) => !m.pending)).toBe(true);
  });

  it("breaks createdAt ties deterministically by id", () => {
    const sameTime = "2026-06-14T10:00:00Z";
    const b: ChatMessage = {
      id: "b",
      threadId: "t1",
      senderId: uid,
      body: "b",
      createdAt: sameTime,
    };
    const a: ChatMessage = {
      id: "a",
      threadId: "t1",
      senderId: uid,
      body: "a",
      createdAt: sameTime,
    };
    expect(mergeMessage([b], a).map((m) => m.id)).toEqual(["a", "b"]);
  });
});

describe("fasseUngelesenZusammen (AGE-583)", () => {
  it("summiert über alle Threads und ordnet je Thread zu", () => {
    const z = fasseUngelesenZusammen([
      { thread_id: "t1", unread_count: 2 },
      { thread_id: "t2", unread_count: 5 },
    ]);
    expect(z.gesamt).toBe(7);
    expect(z.jeThread.get("t1")).toBe(2);
    expect(z.jeThread.get("t2")).toBe(5);
  });

  // Die RPC liefert Threads OHNE Ungelesenes gar nicht zurück. Ein Thread, nach
  // dem gefragt wird und der nicht in der Antwort steht, hat also 0 — und NICHT
  // „unbekannt". Ohne diese Zusage müsste jede Aufrufstelle für sich raten, und
  // eine davon würde falsch raten.
  it("ein Thread ohne Zeile hat null, nicht undefined", () => {
    const z = fasseUngelesenZusammen([{ thread_id: "t1", unread_count: 2 }]);
    expect(z.hatUngelesen("t2")).toBe(false);
    expect(z.hatUngelesen("t1")).toBe(true);
  });

  it("keine Zeilen heißt Gesamtzahl null", () => {
    const z = fasseUngelesenZusammen([]);
    expect(z.gesamt).toBe(0);
    expect(z.hatUngelesen("t1")).toBe(false);
  });

  // Gegen die Falle, die beim Schreiben der Typen fast passiert wäre: hielte man
  // `unread_count` für eine Zeichenkette, ergäbe die Summe "02" statt 2. Gemessen
  // ist es eine Zahl — dieser Test hält das fest, falls PostgREST seine Meinung
  // ändert, statt es beim nächsten Leser wieder zur Vermutung zu machen.
  it("summiert numerisch, nicht als Zeichenkette", () => {
    const z = fasseUngelesenZusammen([
      { thread_id: "t1", unread_count: 2 },
      { thread_id: "t2", unread_count: 3 },
    ]);
    expect(z.gesamt).toBe(5);
    expect(typeof z.gesamt).toBe("number");
  });
});
