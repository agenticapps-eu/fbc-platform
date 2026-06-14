import { describe, expect, it } from "vitest";
import { pickRelevantRequest } from "./contact-requests";

const VIEWER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

const row = (id: string, from: string, to: string, status: string) => ({
  id,
  from_id: from,
  to_id: to,
  status,
});

describe("pickRelevantRequest", () => {
  it("returns null when there is no request", () => {
    expect(pickRelevantRequest([], VIEWER)).toBeNull();
  });

  it("marks an outgoing request (viewer is from_id)", () => {
    const result = pickRelevantRequest([row("a", VIEWER, OTHER, "pending")], VIEWER);
    expect(result).toEqual({ id: "a", status: "pending", outgoing: true });
  });

  it("marks an incoming request (viewer is to_id)", () => {
    const result = pickRelevantRequest([row("a", OTHER, VIEWER, "pending")], VIEWER);
    expect(result).toEqual({ id: "a", status: "pending", outgoing: false });
  });

  it("prefers accepted over pending and declined regardless of order", () => {
    const rows = [
      row("a", VIEWER, OTHER, "declined"),
      row("b", OTHER, VIEWER, "accepted"),
      row("c", VIEWER, OTHER, "pending"),
    ];
    expect(pickRelevantRequest(rows, VIEWER)?.status).toBe("accepted");
  });

  it("prefers pending over declined", () => {
    const rows = [row("a", VIEWER, OTHER, "declined"), row("b", OTHER, VIEWER, "pending")];
    expect(pickRelevantRequest(rows, VIEWER)?.id).toBe("b");
  });
});
