import { describe, expect, test } from "vitest";

import { evaluateStage1, evaluateStage2, extractProjectRef } from "./db-push-prod.logic";

const PROD_REF = "aaaabbbbccccddddeeee";
const DEV_REF = "foelowldexkcqzewvrcf";

const prodUrl = `postgresql://postgres:pw@db.${PROD_REF}.supabase.co:5432/postgres`;
const devUrl = `postgresql://postgres:pw@db.${DEV_REF}.supabase.co:5432/postgres`;

describe("extractProjectRef", () => {
  test("liest den Ref aus der direkten Verbindungs-URL", () => {
    expect(extractProjectRef(prodUrl)).toBe(PROD_REF);
  });

  test("liest den Ref aus der Pooler-URL, wo er im Benutzernamen steckt", () => {
    const pooled = `postgresql://postgres.${PROD_REF}:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;
    expect(extractProjectRef(pooled)).toBe(PROD_REF);
  });

  test("liefert null, wenn die URL keinen Ref trägt", () => {
    expect(extractProjectRef("postgresql://postgres:pw@localhost:54322/postgres")).toBeNull();
  });
});

describe("Stufe 1 — maschinell, ohne Menschen", () => {
  test("bricht ab, wenn SUPABASE_DB_URL_PROD fehlt", () => {
    const result = evaluateStage1({ dbUrl: undefined, expectedRef: PROD_REF, args: [] });

    expect(result.kind).toBe("abort");
  });

  test("bricht ab, wenn der Sollwert noch der Platzhalter ist", () => {
    const result = evaluateStage1({
      dbUrl: prodUrl,
      expectedRef: "<wird-in-task-6-gefuellt>",
      args: [],
    });

    expect(result.kind).toBe("abort");
  });

  test("bricht ab, wenn --include-seed übergeben wurde", () => {
    const result = evaluateStage1({
      dbUrl: prodUrl,
      expectedRef: PROD_REF,
      args: ["--include-seed"],
    });

    expect(result.kind).toBe("abort");
  });

  test("bricht ab, wenn die URL auf das DEV-Projekt zeigt — und fragt dabei NIE nach einer Eingabe", () => {
    const result = evaluateStage1({ dbUrl: devUrl, expectedRef: PROD_REF, args: [] });

    // Der Kern des Changes: dieser Fall darf Stufe 2 nie erreichen. Würde er
    // `confirm-required` liefern, bekäme der Mensch den falschen Host zu sehen
    // und bestätigte ihn — die Prüfung wäre zirkulär.
    expect(result.kind).toBe("abort");
    expect(result.kind).not.toBe("confirm-required");
  });

  test("gibt frei, wenn der Ref der URL dem Sollwert entspricht", () => {
    const result = evaluateStage1({ dbUrl: prodUrl, expectedRef: PROD_REF, args: [] });

    expect(result).toEqual({ kind: "confirm-required", ref: PROD_REF });
  });
});

describe("Stufe 2 — durch den Menschen", () => {
  test("bricht ab, wenn die Eingabe nicht dem Ref entspricht", () => {
    expect(evaluateStage2({ ref: PROD_REF, typed: DEV_REF }).kind).toBe("abort");
  });

  test("bricht ab bei leerer Eingabe", () => {
    expect(evaluateStage2({ ref: PROD_REF, typed: "" }).kind).toBe("abort");
  });

  test("gibt frei, wenn die Eingabe dem Ref entspricht", () => {
    expect(evaluateStage2({ ref: PROD_REF, typed: PROD_REF })).toEqual({
      kind: "proceed",
      ref: PROD_REF,
    });
  });
});
