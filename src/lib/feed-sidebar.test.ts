import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Die zwei Aggregate der Feed-Sidebar (AGE-582, Abschnitt 6).
 *
 * GEMOCKT IST NUR DER RAND ZUR DATENBANK — `supabase.rpc`. Aufgezeichnet wird,
 * WAS gerufen wird und mit welchem Argument; die Zusagen hier sind über die
 * Form des Aufrufs und über das, was der Aufrufer zurückbekommt.
 *
 * Was dieser Mock NICHT belegen kann: dass die beiden Funktionen in der
 * Datenbank wirklich nur Sichtbares zählen. Das ist eine Eigenschaft von
 * `security invoker` und steht in `feed.auswahl.integration.test.ts` gegen den
 * laufenden Stack.
 */

const rpc = vi.fn();

vi.mock("./supabase", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

const { fetchTagZaehler, fetchTopAutoren, tagZaehlerKey, topAutorenKey } =
  await import("./feed-sidebar");

beforeEach(() => {
  rpc.mockReset();
});

describe("fetchTagZaehler", () => {
  it("ruft `feed_tag_counts` ohne Argument und liefert Schlüssel, Beschriftung und Zahl", async () => {
    rpc.mockResolvedValue({
      data: [
        { tag_key: "netzwerken", tag_label: "Netzwerken", post_count: 7 },
        { tag_key: "immobilien", tag_label: "Immobilien", post_count: 2 },
      ],
      error: null,
    });

    const zaehler = await fetchTagZaehler();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("feed_tag_counts");
    expect(zaehler).toEqual([
      { key: "netzwerken", label: "Netzwerken", anzahl: 7 },
      { key: "immobilien", label: "Immobilien", anzahl: 2 },
    ]);
  });

  /* Der Fehler darf NICHT zu einer leeren Liste werden. Eine Sidebar, die aus
     einem verweigerten Aufruf „keine Tags" macht, behauptet etwas über den
     Bestand — die Spec verbietet genau das („Eine Zahl, die für `anon` aus
     einem Fehler eine Null macht, SHALL NOT gezeigt werden"). */
  it("wirft, statt aus einem Fehler eine leere Liste zu machen", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "permission denied" } });

    await expect(fetchTagZaehler()).rejects.toMatchObject({ message: "permission denied" });
  });

  it("liefert eine leere Liste, wenn es nichts zu zählen gibt", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(fetchTagZaehler()).resolves.toEqual([]);
  });
});

describe("fetchTopAutoren", () => {
  it("ruft `feed_top_authors` mit fünf und liefert Kennung, Name, Avatar und Zahl", async () => {
    rpc.mockResolvedValue({
      data: [{ profile_id: "a1", name: "Detlev Meier", avatar_url: null, post_count: 4 }],
      error: null,
    });

    const autoren = await fetchTopAutoren();

    expect(rpc).toHaveBeenCalledWith("feed_top_authors", { p_limit: 5 });
    expect(autoren).toEqual([{ id: "a1", name: "Detlev Meier", avatarUrl: null, anzahl: 4 }]);
  });

  it("wirft bei einem Fehler", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "permission denied" } });

    await expect(fetchTopAutoren()).rejects.toMatchObject({ message: "permission denied" });
  });
});

describe("Die Schlüssel tragen den Betrachter", () => {
  /* Beide Zahlen hängen am Principal: `security invoker` heisst, dass zwei
     Betrachter unterschiedlicher Stufe verschiedene Zahlen sehen. Ein Schlüssel
     ohne `uid` spielte die Zahlen des einen an den anderen aus — derselbe Grund,
     aus dem `feedListKey` die Kennung trägt. */
  it("trennt die Tag-Zähler je Betrachter", () => {
    expect(tagZaehlerKey("m1")).not.toEqual(tagZaehlerKey("m2"));
    expect(tagZaehlerKey(null)).not.toEqual(tagZaehlerKey("m1"));
  });

  it("trennt die aktivsten Mitglieder je Betrachter", () => {
    expect(topAutorenKey("m1")).not.toEqual(topAutorenKey("m2"));
  });

  it("gibt für denselben Betrachter denselben Schlüssel", () => {
    expect(tagZaehlerKey("m1")).toEqual(tagZaehlerKey("m1"));
    expect(topAutorenKey("m1")).toEqual(topAutorenKey("m1"));
  });
});
