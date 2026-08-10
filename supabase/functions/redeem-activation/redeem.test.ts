// deno test  (aus supabase/functions/redeem-activation/)
//
// Die sicherheitskritische Reihenfolge — Token beanspruchen → Passwort setzen
// → Sitzungen beenden → ERST DANACH aktivieren — ist der ganze Sinn dieses
// Moduls (siehe Kopfkommentar in redeem.ts). Ein Teilfehlschlag, der trotzdem
// aktiviert, ließe das Gate offen. Diese Tests behaupten die Reihenfolge über
// eine mitgeschriebene Aufrufliste, nicht über einzelne „wurde aufgerufen"-
// Prüfungen — nur so fällt es auf, wenn zwei Schritte vertauscht werden.

import { assertEquals } from "jsr:@std/assert@1";
import { redeemActivation, type RedeemDeps } from "./redeem.ts";

const TOKEN = "geheimes-token";
const PASSWORT = "sehr-sicher-123";
const IP = "203.0.113.7";
const PROFILE_ID = "profil-1";

/** Baut Deps mit einer mitgeschriebenen Aufrufliste; einzelne Antworten sind überschreibbar. */
function baueDeps(overrides: Partial<RedeemDeps> = {}) {
  const aufrufe: string[] = [];

  const deps: RedeemDeps = {
    claimActivationToken: async () => {
      aufrufe.push("claim");
      return { data: { status: "claimed", profile_id: PROFILE_ID }, error: null };
    },
    noteFailedActivation: async () => {
      aufrufe.push("noteFailedActivation");
      return { data: { throttled: false, attempts: 1 }, error: null };
    },
    updateUserById: async () => {
      aufrufe.push("updateUserById");
      return { error: null };
    },
    revokeSessions: async () => {
      aufrufe.push("revokeSessions");
      return { error: null };
    },
    markActivated: async () => {
      aufrufe.push("markActivated");
      return { error: null };
    },
    log: (_level, event) => {
      aufrufe.push(`log:${event}`);
    },
    ...overrides,
  };

  return { deps, aufrufe };
}

Deno.test("glücklicher Weg: die vier Schritte laufen in genau dieser Reihenfolge", async () => {
  const { deps, aufrufe } = baueDeps();

  const ergebnis = await redeemActivation(TOKEN, PASSWORT, IP, deps);

  assertEquals(
    aufrufe.filter((a) => !a.startsWith("log:")),
    ["claim", "updateUserById", "revokeSessions", "markActivated"],
  );
  assertEquals(ergebnis, { body: { status: "activated" }, status: 200 });
});

Deno.test("Passwort schlägt fehl → revoke_sessions und mark_activated werden NIE aufgerufen", async () => {
  const { deps, aufrufe } = baueDeps({
    updateUserById: async () => {
      aufrufe.push("updateUserById");
      return { error: { status: 500 } };
    },
  });

  const ergebnis = await redeemActivation(TOKEN, PASSWORT, IP, deps);

  assertEquals(aufrufe.filter((a) => !a.startsWith("log:")), ["claim", "updateUserById"]);
  assertEquals(ergebnis, { body: { status: "retry_needed" }, status: 502 });
});

Deno.test("revoke_sessions schlägt fehl → mark_activated wird NIE aufgerufen (das Gate bliebe sonst offen)", async () => {
  const { deps, aufrufe } = baueDeps({
    revokeSessions: async () => {
      aufrufe.push("revokeSessions");
      return { error: { code: "boom" } };
    },
  });

  const ergebnis = await redeemActivation(TOKEN, PASSWORT, IP, deps);

  assertEquals(aufrufe.filter((a) => !a.startsWith("log:")), [
    "claim",
    "updateUserById",
    "revokeSessions",
  ]);
  assertEquals(ergebnis, { body: { status: "retry_needed" }, status: 502 });
});

Deno.test("mark_activated schlägt fehl → retry_needed/502", async () => {
  const { deps, aufrufe } = baueDeps({
    markActivated: async () => {
      aufrufe.push("markActivated");
      return { error: { code: "boom" } };
    },
  });

  const ergebnis = await redeemActivation(TOKEN, PASSWORT, IP, deps);

  assertEquals(aufrufe.filter((a) => !a.startsWith("log:")), [
    "claim",
    "updateUserById",
    "revokeSessions",
    "markActivated",
  ]);
  assertEquals(ergebnis, { body: { status: "retry_needed" }, status: 502 });
});

Deno.test("Token nicht claimed → updateUserById wird nie aufgerufen; Status + 410", async () => {
  const { deps, aufrufe } = baueDeps({
    claimActivationToken: async () => {
      aufrufe.push("claim");
      return { data: { status: "expired" }, error: null };
    },
  });

  const ergebnis = await redeemActivation(TOKEN, PASSWORT, IP, deps);

  assertEquals(aufrufe.filter((a) => !a.startsWith("log:")), ["claim", "noteFailedActivation"]);
  assertEquals(ergebnis, { body: { status: "expired" }, status: 410 });
});

Deno.test("Token nicht claimed + gesetzte Drossel → 429 statt 410, updateUserById nie aufgerufen", async () => {
  const { deps, aufrufe } = baueDeps({
    claimActivationToken: async () => {
      aufrufe.push("claim");
      return { data: { status: "not_found" }, error: null };
    },
    noteFailedActivation: async () => {
      aufrufe.push("noteFailedActivation");
      return { data: { throttled: true, attempts: 11 }, error: null };
    },
  });

  const ergebnis = await redeemActivation(TOKEN, PASSWORT, IP, deps);

  assertEquals(aufrufe.filter((a) => !a.startsWith("log:")), ["claim", "noteFailedActivation"]);
  assertEquals(ergebnis, { body: { status: "throttled" }, status: 429 });
});
