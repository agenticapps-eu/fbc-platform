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
  assertEquals(fasseAusgangZusammen("disable", true, null), {
    status: 200,
    body: { hidden: true, banned: true },
  });
  assertEquals(fasseAusgangZusammen("enable", true, null), {
    status: 200,
    body: { hidden: false, banned: false },
  });
});

/**
 * Die Ordnung beim Öffnen ist seit dem 24.08. DATENBANK ZUERST (AGE-581,
 * Diff-Prüfung). Vorher entbannte die Function unbedingt und rief die RPC
 * danach — dabei entstanden zwei Zustände, die das Spec ausdrücklich verbietet:
 * ein GELÖSCHTES Mitglied mit aufgehobener Sperre (die RPC lehnte danach mit
 * 22023 ab, der Ban war schon weg), und ein DEAKTIVIERTES mit aufgehobener
 * Sperre (`admin_restore_member` gibt `entbannen: false` zurück, und niemand
 * las es).
 */
Deno.test("wiederherstellen entbannt NICHT, wenn das Mitglied deaktiviert bleibt", () => {
  // `entbannen: false` — die RPC hat `deleted_at` geleert, `disabled_at` steht
  // weiter. Der Ban bleibt, und das ist kein halber Zustand, sondern der
  // richtige: verborgen UND gesperrt.
  assertEquals(fasseAusgangZusammen("restore", false, null), {
    status: 200,
    body: { hidden: true, banned: true },
  });
});

Deno.test("der halbe Zustand ist die Ungleichheit von verborgen und gesperrt", () => {
  // Schliessen: die Datenbank ist umgestellt, der Bann fehlt.
  assertEquals(fasseAusgangZusammen("disable", true, "auth down"), {
    status: 207,
    body: { hidden: true, banned: false, detail: "auth down" },
  });
  // Öffnen: die Datenbank ist umgestellt, die Aufhebung fehlt. Das ist die
  // ANDERE Hälfte als früher — sichtbar, aber ausgesperrt. Vorher meldete die
  // Function hier „unsichtbar und anmeldefähig", also das Gegenteil.
  assertEquals(fasseAusgangZusammen("restore", true, "auth down"), {
    status: 207,
    body: { hidden: false, banned: true, detail: "auth down" },
  });
  assertEquals(fasseAusgangZusammen("enable", true, "auth down"), {
    status: 207,
    body: { hidden: false, banned: true, detail: "auth down" },
  });
});

Deno.test("verborgen und gesperrt fallen in JEDEM Erfolgsfall zusammen", () => {
  // Die Regel hinter dem Statuscode, als Zusage: 200 heisst „die beiden Hälften
  // stimmen überein", 207 heisst „sie tun es nicht". Ohne sie wäre die Zuordnung
  // eine Tabelle, die man beim nächsten Fall wieder raten muss.
  for (const fall of [
    fasseAusgangZusammen("disable", true, null),
    fasseAusgangZusammen("delete", true, null),
    fasseAusgangZusammen("enable", true, null),
    fasseAusgangZusammen("restore", true, null),
    fasseAusgangZusammen("restore", false, null),
  ]) {
    assertEquals(fall.status, 200);
    assertEquals(fall.body.hidden, fall.body.banned);
  }
});
