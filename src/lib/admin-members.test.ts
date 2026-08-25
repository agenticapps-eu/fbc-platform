import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Der Datenzugriff der Admin-Mitgliederliste (AGE-566).
 *
 * Die Aussagen, die hier zählen:
 *
 *  1. Es geht über die RPC und NICHT über einen direkten Tabellenzugriff. Der
 *     scheiterte am Aktivierungs-Gate: `profiles_select_self_or_discover`
 *     verlangt `activated_at` am ZIELPROFIL, und genau die unbestätigten
 *     Mitglieder sind der Anlass dieser Fläche.
 *  2. Das Blättern geht an die Datenbank, nicht an den Browser. Eine Fläche,
 *     die alles holt und lokal schneidet, hat kein Paging — sie hat eine
 *     Illusion davon, und bei 700 Mitgliedern hat sie gar nichts.
 *  3. „Zugangslink angefordert" ist eine Aussage über die ANFRAGE, nicht über
 *     einen Versand — und ein Betriebsfehler darf nicht wie Erfolg aussehen.
 */

const rpcCalls: { name: string; args: unknown }[] = [];
const invokeCalls: { name: string; args: unknown }[] = [];
let rpcAntwort: unknown = null;
let rpcFehler: unknown = null;
let invokeFehler: unknown = null;

vi.mock("./supabase", () => ({
  supabase: {
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return { data: rpcAntwort, error: rpcFehler };
    },
    from: (name: string) => {
      throw new Error(`Kein direkter Tabellenzugriff in der Admin-Liste: ${name}`);
    },
    functions: {
      invoke: async (name: string, opts: unknown) => {
        invokeCalls.push({ name, args: opts });
        return { data: null, error: invokeFehler };
      },
    },
  },
}));

import {
  activateMember,
  adminMemberCountsQueryKey,
  adminMembersQueryKey,
  fetchAdminMemberCounts,
  fetchAdminMembers,
  SEITENGROESSE,
} from "./admin-members";
import { requestActivationLink } from "./activation";

beforeEach(() => {
  rpcCalls.length = 0;
  invokeCalls.length = 0;
  rpcAntwort = [];
  rpcFehler = null;
  invokeFehler = null;
});

describe("fetchAdminMembers", () => {
  it("liest über die RPC und reicht Suche, Status und Seite durch", async () => {
    await fetchAdminMembers({ query: "meier", status: "offen", seite: 2 });

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("admin_list_members");
    expect(rpcCalls[0].args).toEqual({
      p_query: "meier",
      p_status: "offen",
      p_limit: SEITENGROESSE + 1,
      // `seite` ist nullbasiert: Seite 2 ist der DRITTE Abschnitt.
      p_offset: 2 * SEITENGROESSE,
    });
  });

  /**
   * Die Fläche muss wissen, ob es eine nächste Seite gibt, OHNE die Gesamtzahl
   * zu kennen — die RPC liefert sie nicht, und eine zweite zählende Abfrage
   * wäre ein zweiter Weg an dieselben Daten. Deshalb wird EINE Zeile mehr
   * angefordert als angezeigt: kommt sie, gibt es eine Folgeseite.
   */
  it("fordert eine Zeile mehr an, als sie zurückgibt, und meldet damit die Folgeseite", async () => {
    rpcAntwort = Array.from({ length: SEITENGROESSE + 1 }, (_, i) => ({ id: `m${i}` }));

    const ergebnis = await fetchAdminMembers({ query: "", status: "alle", seite: 0 });

    expect(ergebnis.members).toHaveLength(SEITENGROESSE);
    expect(ergebnis.hatWeitere).toBe(true);
  });

  it("meldet keine Folgeseite, wenn die Zusatzzeile ausbleibt", async () => {
    rpcAntwort = Array.from({ length: 3 }, (_, i) => ({ id: `m${i}` }));

    const ergebnis = await fetchAdminMembers({ query: "", status: "alle", seite: 0 });

    expect(ergebnis.members).toHaveLength(3);
    expect(ergebnis.hatWeitere).toBe(false);
  });

  /** Ein leeres Suchfeld ist „kein Filter", nicht „suche nach dem leeren Text". */
  it("schickt einen leeren Suchbegriff als null", async () => {
    await fetchAdminMembers({ query: "   ", status: "alle", seite: 0 });

    expect((rpcCalls[0].args as { p_query: string | null }).p_query).toBeNull();
  });

  it("wirft, statt eine leere Liste zu liefern", async () => {
    rpcFehler = { message: "boom" };

    // Eine leere Liste hiesse „keine Mitglieder" — und genau das ist der
    // Anblick, den ein fehlgeschlagener Import auch erzeugt. Die beiden
    // ununterscheidbar zu machen, war in diesem Projekt schon einmal ein
    // halber Tag.
    await expect(fetchAdminMembers({ query: "", status: "alle", seite: 0 })).rejects.toBeTruthy();
  });
});

describe("activateMember", () => {
  it("geht über die eigene RPC, nicht über mark_activated", async () => {
    await activateMember("ziel-1");

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("admin_activate_member");
    expect(rpcCalls[0].args).toEqual({ target: "ziel-1" });
  });

  it("wirft, wenn die Datenbank ablehnt", async () => {
    rpcFehler = { message: "bereits bestaetigt", code: "22023" };

    await expect(activateMember("ziel-1")).rejects.toBeTruthy();
  });
});

describe("requestActivationLink aus der Admin-Fläche", () => {
  it("ruft send-activation mit der Anmeldeadresse", async () => {
    await requestActivationLink("wer@test.fbc");

    expect(invokeCalls).toHaveLength(1);
    expect(invokeCalls[0].name).toBe("send-activation");
    expect(invokeCalls[0].args).toEqual({ body: { email: "wer@test.fbc" } });
  });

  /**
   * Der Befund aus dem Plan-Review (codex, MEDIUM-2): „send-activation
   * antwortet immer mit 202" ist falsch. Der Handler liefert auch 405, 400,
   * 500 und 502. Eine Fläche, die den Aufruf nicht auf Fehler prüft, meldete
   * bei einem Betriebsfehler „angefordert" — und niemand suchte danach.
   */
  it("wirft bei einem Betriebsfehler, statt Erfolg zu melden", async () => {
    invokeFehler = { message: "Internal Server Error" };

    await expect(requestActivationLink("wer@test.fbc")).rejects.toBeTruthy();
  });
});

/**
 * Die Zahlen an den Reitern (AGE-587).
 *
 * Sie kommen aus einer EIGENEN RPC und nicht aus einer erweiterten
 * `admin_list_members`: deren Signatur und Spaltensatz sind je durch eine
 * ausdrückliche Zusage bewacht, und sie zu erweitern machte aus zwei Wächtern
 * zwei Hindernisse. Ausserdem sind die Zahlen global, während die Liste
 * gefiltert und geblättert ist — zwei verschiedene Fragen.
 */
describe("fetchAdminMemberCounts", () => {
  it("liest über die Zähl-RPC, ohne Argumente — die Zahlen sind global", async () => {
    rpcAntwort = [];

    await fetchAdminMemberCounts();

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("admin_member_counts");
    // Kein `p_query`: der Reiter beantwortet „wie viele gibt es", nicht „wie
    // viele meiner Treffer". Ein durchgereichter Suchbegriff wäre die andere,
    // nicht bestellte Frage.
    expect(rpcCalls[0].args).toBeUndefined();
  });

  it("bildet die Zeilen auf eine Zuordnung Zustand → Zahl ab", async () => {
    rpcAntwort = [
      { status: "alle", anzahl: 12 },
      { status: "aktiviert", anzahl: 10 },
      { status: "offen", anzahl: 2 },
      { status: "deaktiviert", anzahl: 1 },
      { status: "geloescht", anzahl: 3 },
    ];

    expect(await fetchAdminMemberCounts()).toEqual({
      alle: 12,
      aktiviert: 10,
      offen: 2,
      deaktiviert: 1,
      geloescht: 3,
    });
  });

  it("gibt die Zahl null weiter, statt sie zu verschlucken", async () => {
    rpcAntwort = [{ status: "geloescht", anzahl: 0 }];

    // „Keine Zahl" und „die Zahl null" sind zwei verschiedene Auskünfte. Die
    // RPC unterscheidet sie ausdrücklich; die Datenschicht darf das nicht
    // wieder einebnen.
    expect(await fetchAdminMemberCounts()).toEqual({ geloescht: 0 });
  });

  it("reicht einen Fehler durch, statt lauter Nullen zu erfinden", async () => {
    rpcFehler = { message: "forbidden: admin_member_counts" };

    await expect(fetchAdminMemberCounts()).rejects.toMatchObject({
      message: "forbidden: admin_member_counts",
    });
  });
});

describe("adminMemberCountsQueryKey", () => {
  /**
   * Der Schlüssel MUSS unter demselben Präfix liegen wie die Liste. Die
   * Lebenszyklus-Aktionen entwerten `["admin-members"]` als Präfix; ein eigener
   * Schlüssel daneben liesse die Zahlen nach jeder Aktivierung stehen — und
   * jeder Test auf das erste Rendern bliebe dabei grün.
   */
  it("liegt unter demselben Präfix wie die Liste", () => {
    expect(adminMemberCountsQueryKey[0]).toBe(
      adminMembersQueryKey({ query: "", status: "alle", seite: 0 })[0],
    );
  });

  it("ist trotzdem ein anderer Schlüssel als der der Liste", () => {
    expect(adminMemberCountsQueryKey).not.toEqual(
      adminMembersQueryKey({ query: "", status: "alle", seite: 0 }),
    );
  });
});
