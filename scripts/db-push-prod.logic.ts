export type Stage1Result =
  | { kind: "abort"; reason: string }
  | { kind: "confirm-required"; ref: string };

export type Stage2Result = { kind: "abort"; reason: string } | { kind: "proceed"; ref: string };

export function extractProjectRef(dbUrl: string): string | null {
  void dbUrl;
  throw new Error("not implemented");
}

export function evaluateStage1(input: {
  dbUrl: string | undefined;
  expectedRef: string;
  args: string[];
}): Stage1Result {
  void input;
  throw new Error("not implemented");
}

export function evaluateStage2(input: { ref: string; typed: string }): Stage2Result {
  void input;
  throw new Error("not implemented");
}
