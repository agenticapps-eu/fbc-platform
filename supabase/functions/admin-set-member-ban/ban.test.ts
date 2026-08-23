// deno test --allow-env --allow-net supabase/functions/admin-set-member-ban/
//
// Die reine Logik von admin-set-member-ban (AGE-581). Was hier NICHT steht, ist
// die Verdrahtung — die prüft `deno check` (siehe ci.yml: `deno test` typprüft
// nur, was ein Test importiert, und das sind gerade die reinen Module).
import { assertEquals } from "jsr:@std/assert@1";
import {
  banDauerFuer,
  fasseAusgangZusammen,
  istSchliessen,
  parseBanRequest,
  rpcNameFuer,
  statusFuerPgFehler,
} from "./ban.ts";

const ZIEL = "d0000000-0000-0000-0000-000000000002";

Deno.test("die vier Handlungen werden angenommen", () => {
  for (const action of ["disable", "enable", "delete", "restore"] as const) {
    assertEquals(parseBanRequest({ action, target: ZIEL }), { action, target: ZIEL, grund: null });
  }
});

Deno.test("eine unbekannte Handlung wird abgelehnt", () => {
  // Nicht stillschweigend als „disable" lesen: eine vertippte Handlung, die
  // trotzdem etwas tut, ist schlimmer als eine, die abbricht.
  assertEquals(parseBanRequest({ action: "ban", target: ZIEL }), null);
  assertEquals(parseBanRequest({ action: "", target: ZIEL }), null);
});

Deno.test("eine Ziel-ID, die keine UUID ist, wird abgelehnt", () => {
  assertEquals(parseBanRequest({ action: "disable", target: "irgendwer" }), null);
  assertEquals(parseBanRequest({ action: "disable" }), null);
  assertEquals(parseBanRequest(null), null);
});

Deno.test("der Grund wird getrimmt, und leer heißt kein Grund", () => {
  assertEquals(parseBanRequest({ action: "disable", target: ZIEL, grund: "  Austritt " }), {
    action: "disable",
    target: ZIEL,
    grund: "Austritt",
  });
  assertEquals(parseBanRequest({ action: "disable", target: ZIEL, grund: "   " })?.grund, null);
});

Deno.test("schließen und öffnen sind zwei Richtungen", () => {
  assertEquals(istSchliessen("disable"), true);
  assertEquals(istSchliessen("delete"), true);
  assertEquals(istSchliessen("enable"), false);
  assertEquals(istSchliessen("restore"), false);
});

Deno.test("der Bann ist eine DAUER, kein Zeitpunkt — und die Aufhebung ein eigener Wert", () => {
  // Gemessen am 23.08. gegen den lokalen Stack: die Admin-API nimmt
  // `ban_duration`, nicht `banned_until`; `"none"` hebt auf. Ein Zeitpunkt
  // hätte sich gar nicht setzen lassen.
  assertEquals(banDauerFuer("disable"), "876000h");
  assertEquals(banDauerFuer("delete"), "876000h");
  assertEquals(banDauerFuer("enable"), "none");
  assertEquals(banDauerFuer("restore"), "none");
});

Deno.test("jede Handlung trifft ihre eigene RPC", () => {
  assertEquals(rpcNameFuer("disable"), "admin_disable_member");
  assertEquals(rpcNameFuer("enable"), "admin_enable_member");
  assertEquals(rpcNameFuer("delete"), "admin_delete_member");
  assertEquals(rpcNameFuer("restore"), "admin_restore_member");
});

Deno.test("die Fehlercodes der Datenbank werden übersetzt, nicht verschluckt", () => {
  // 500 für alles wäre bequem und falsch: die Fläche kann „darf nicht",
  // „gibt es nicht" und „ist schon so" nur unterscheiden, wenn der Status es tut.
  assertEquals(statusFuerPgFehler("42501"), 403);
  assertEquals(statusFuerPgFehler("22023"), 409);
  assertEquals(statusFuerPgFehler("P0002"), 404);
  assertEquals(statusFuerPgFehler("XX000"), 500);
  assertEquals(statusFuerPgFehler(undefined), 500);
});

Deno.test("gelingt beides, ist es ein Erfolg — und die Richtung steht im Rumpf", () => {
  assertEquals(fasseAusgangZusammen("disable", null), {
    status: 200,
    body: { hidden: true, banned: true },
  });
  assertEquals(fasseAusgangZusammen("enable", null), {
    status: 200,
    body: { hidden: false, banned: false },
  });
});

Deno.test("der halbe Zustand wird benannt, nicht als Erfolg ausgegeben", () => {
  // Der ZWEITE Schritt ist in beiden Richtungen der, der einen halben Zustand
  // hinterlassen kann — beim Schließen der Bann, beim Öffnen die Datenbank.
  // Dass beide auf denselben Rumpf führen, ist kein Zufall: es IST derselbe
  // Zustand, aus zwei Richtungen erreicht — unsichtbar, aber anmeldefähig.
  assertEquals(fasseAusgangZusammen("disable", "auth down"), {
    status: 207,
    body: { hidden: true, banned: false, detail: "auth down" },
  });
  assertEquals(fasseAusgangZusammen("restore", "db down"), {
    status: 207,
    body: { hidden: true, banned: false, detail: "db down" },
  });
});
