import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "../App";
import { ToastProvider } from "./ui/Toast";
import type { AuthContextValue } from "../providers/auth-context";
import { AuthFixture, authAsTier, fakeAuthValue } from "../test/auth-fixtures";
import { rechtsseiten } from "../content/legal/meta";

/**
 * Rechtsseiten und Footer (AGE-497).
 *
 * Bewusst ueber die ECHTEN Routen und den echten `App`-Baum, nicht ueber eine
 * zweimal gerenderte Shell mit zwei Mock-Zustaenden: der Plan-Review hat zu
 * Recht angemerkt, dass Letzteres keine reale Erreichbarkeit belegt. Der Fall,
 * auf den es ankommt — eingeloggt und UNBESTAETIGT —, entsteht nur, wenn das
 * `ActivationGate` wirklich im Baum haengt.
 */

const AUSGELOGGT = fakeAuthValue();
const AKTIVIERT = authAsTier("impact");
const UNBESTAETIGT = fakeAuthValue({
  user: { id: "test-user" } as AuthContextValue["user"],
  isActivated: false,
});

function renderAt(pfad: string, value: AuthContextValue) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={value}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[pfad]}>
            <App />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

describe("Footer im Rahmen", () => {
  it("verlinkt ausgeloggt alle vier Rechtsseiten", () => {
    renderAt("/", AUSGELOGGT);
    const footer = screen.getByRole("contentinfo");
    for (const dok of rechtsseiten) {
      expect(within(footer).getByRole("link", { name: dok.titel })).toHaveAttribute(
        "href",
        `/${dok.slug}`,
      );
    }
  });

  it("verlinkt sie fuer ein aktiviertes Mitglied genauso", () => {
    renderAt("/aktivitaet", AKTIVIERT);
    const footer = screen.getByRole("contentinfo");
    for (const dok of rechtsseiten) {
      expect(within(footer).getByRole("link", { name: dok.titel })).toBeInTheDocument();
    }
  });
});

/**
 * Wartet auf den NACHGELADENEN Text — nicht auf die Ueberschrift.
 *
 * Die Ueberschrift steht seit der Metadaten-Trennung schon waehrend des
 * Ladens da. Ein Test, der nur auf sie wartet, ist zweimal schwach:
 *
 *  1. Er waere auch gruen, wenn der Text nie eintrifft.
 *  2. Er ist flatterhaft. `findByRole` loeste auf dem `<h1>` der Ladeansicht
 *     auf; sobald der Text kam, ersetzte React den Knoten, und das
 *     abgewartete Element war abgehaengt — `toBeInTheDocument()` schlug fehl.
 *     Vier Tests fielen genau so, und nur im Dateilauf, nicht einzeln.
 *
 * Die Abschnitts-Ueberschriften gibt es ausschliesslich im geladenen
 * Dokument. Erst danach wird die `<h1>` frisch abgefragt.
 */
async function erwarteGeladenesDokument(titel: string) {
  await waitFor(() =>
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(3),
  );
  // Der EIGENE Titel, nicht irgendeiner: sonst bestuende der Test auch, wenn
  // alle vier Routen dasselbe Dokument zeigen.
  expect(screen.getByRole("heading", { level: 1, name: titel })).toBeInTheDocument();
}

describe("Die vier Rechtsrouten", () => {
  it.each(rechtsseiten.map((d) => [d.slug, d.titel]))(
    "/%s zeigt ausgeloggt „%s“",
    async (slug, titel) => {
      renderAt(`/${slug}`, AUSGELOGGT);
      await erwarteGeladenesDokument(titel);
    },
  );

  it.each(rechtsseiten.map((d) => [d.slug, d.titel]))(
    "/%s ist auch fuer ein UNBESTAETIGTES Konto erreichbar",
    async (slug, titel) => {
      // Der Fall, um dessentwillen die Routen ausserhalb der AppShell liegen.
      // Laegen sie drin, stuende hier der Aktivierungsbildschirm.
      renderAt(`/${slug}`, UNBESTAETIGT);
      await erwarteGeladenesDokument(titel);
    },
  );
});

describe("Rechtslinks an den Einstiegen", () => {
  // § 312i BGB verlangt die AGB bei Vertragsschluss, Art. 13 DSGVO die
  // Information bei Erhebung. Beides passiert hier, nicht im Footer einer
  // Seite, die ein unbestaetigtes Konto nie sieht.

  // Gescopt auf die benannte Landmarke: ohne das bestuende der Test auch,
  // wenn die Zeile verschwindet und irgendwo sonst ein gleichnamiger Link
  // auftaucht — und er braeche, sobald einer dazukommt.
  function rechtsLinkeZeile() {
    return within(screen.getByRole("navigation", { name: "Rechtliches" }));
  }

  it("die Anmeldeseite verlinkt alle vier", () => {
    renderAt("/login", AUSGELOGGT);
    for (const dok of rechtsseiten) {
      expect(rechtsLinkeZeile().getByRole("link", { name: dok.titel })).toHaveAttribute(
        "href",
        `/${dok.slug}`,
      );
    }
  });

  it("der Aktivierungsbildschirm verlinkt alle vier", () => {
    renderAt("/", UNBESTAETIGT);
    for (const dok of rechtsseiten) {
      expect(rechtsLinkeZeile().getByRole("link", { name: dok.titel })).toHaveAttribute(
        "href",
        `/${dok.slug}`,
      );
    }
  });
});
