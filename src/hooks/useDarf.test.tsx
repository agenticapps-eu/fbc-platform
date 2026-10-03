import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, authAsTier, fakeAuthValue } from "../test/auth-fixtures";
import { useDarf } from "./useDarf";

/**
 * `useDarf` (AGE-1000).
 *
 * Gemessen wird gegen `ladeMeineRechte` als Grenze — nicht gegen einen
 * nachgebauten Supabase-Client. Die RPC selbst ist in pgTAP belegt
 * (`rechte_v5_test.sql`: Rang 4 leer, Rang 5 vier Schlüssel, Rang 6 zehn);
 * hier geht es ausschliesslich darum, was der Hook daraus macht.
 *
 * Der wichtigste Fall ist der dritte: **der Ladezustand darf nicht wie eine
 * Ablehnung aussehen.** Genau dieser Fehler hat in AGE-903 einem berechtigten
 * Mitglied fuer einen Moment die Wand gezeigt, weil `(levelRank ?? 0)` aus
 * „noch nicht geladen" ein „Rang 0" machte.
 */

const laden = vi.hoisted(() => vi.fn());
vi.mock("../lib/berechtigungen", () => ({
  meineRechteQueryKey: ["meine-rechte"],
  ladeMeineRechte: laden,
}));

function Sonde({ schluessel = "verzeichnis.suchen" as const }) {
  const { darf, laedt } = useDarf(schluessel);
  return <output>{laedt ? "laedt" : darf ? "ja" : "nein"}</output>;
}

function zeige(value: AuthContextValue, kind: ReactNode = <Sonde />) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={value}>
      <QueryClientProvider client={queryClient}>{kind}</QueryClientProvider>
    </AuthFixture>,
  );
}

describe("useDarf", () => {
  beforeEach(() => laden.mockReset());

  it("sagt ja, wenn die Antwort den Schluessel traegt", async () => {
    laden.mockResolvedValue(["events.erstellen", "verzeichnis.suchen"]);
    zeige(authAsTier("impact"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ja"));
  });

  it("sagt nein, wenn die Antwort ihn nicht traegt", async () => {
    laden.mockResolvedValue(["suche_biete", "vorschlaege"]);
    zeige(authAsTier("focus"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("nein"));
  });

  it("sagt nein bei leerer Antwort — DISCOVER traegt kein Recht", async () => {
    laden.mockResolvedValue([]);
    zeige(authAsTier("discover"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("nein"));
  });

  it("meldet den Ladezustand, bevor die Antwort da ist — und nicht „nein“", async () => {
    // Eine Zusage, die erst am Ende aufgeloest wird: der Hook bleibt bis dahin
    // im Ladezustand. Mit `waitFor` auf „nein" waere dieser Test gruen, sobald
    // der Hook faelschlich ablehnt — deshalb wird hier auf „laedt" geprueft UND
    // danach eine echte Pause eingelegt, damit der Fall nicht nur im ersten
    // Frame stimmt.
    //
    // Sie wird aufgeloest und nicht haengen gelassen: eine Zusage, die NIE
    // aufgeloest wird, laesst den Teardown von testing-library in den Timeout
    // laufen (10 s), und der Test schlaegt dann fuer den falschen Grund fehl.
    let aufloesen: (r: string[]) => void = () => {};
    laden.mockReturnValue(
      new Promise<string[]>((r) => {
        aufloesen = r;
      }),
    );
    zeige(authAsTier("impact"));
    expect(screen.getByRole("status")).toHaveTextContent("laedt");
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole("status")).toHaveTextContent("laedt");
    aufloesen(["verzeichnis.suchen"]);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ja"));
  });

  it("fragt ohne Sitzung gar nicht und laedt nicht", () => {
    zeige(fakeAuthValue());
    expect(screen.getByRole("status")).toHaveTextContent("nein");
    expect(laden).not.toHaveBeenCalled();
  });

  // Der FEHLERPFAD steht in `src/lib/berechtigungen.test.ts` und nicht hier:
  // auf dieser Ebene laeuft er durch react-query, und eine abgelehnte Zusage
  // meldet vitest dort als unbehandelten Fehler, obwohl die Abfrage sie
  // entgegennimmt. Gemessen wird er deshalb an der Grenze, an der er entsteht —
  // `ladeMeineRechte` wirft, wenn die RPC einen Fehler liefert. Was der Hook
  // daraus macht, ist `isError` unveraendert durchgereicht.
});
