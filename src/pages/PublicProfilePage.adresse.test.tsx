import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReleasedContact } from "./PublicProfilePage";

/**
 * Die Anschrift in der Profilansicht (AGE-537, C6a).
 *
 * Nichts ist gemockt: `ReleasedContact` bekommt genau das, was
 * `fetchContactRelation` liefert, und wird gerendert. Die Sperre selbst liegt
 * in der RLS und ist in `rls_test.sql` §23 belegt — hier steht nur, was die
 * Ansicht mit einer freigegebenen Zeile tut.
 */

const VOLL = {
  email: "ich@example.test",
  phone: "+49 711 1",
  street: "Hauptstr. 1",
  postal_code: "70173",
  city: "Stuttgart",
  state: "Baden-Württemberg",
  country: "DE",
};

describe("ReleasedContact — die Anschrift", () => {
  it("zeigt sie, wenn die Kontaktzeile freigegeben ist", () => {
    render(<ReleasedContact name="Maxi" contact={VOLL} />);

    expect(screen.getByText("Hauptstr. 1")).toBeInTheDocument();
    expect(screen.getByText(/70173 Stuttgart/)).toBeInTheDocument();
  });

  it("lässt leere Felder weg, statt Kommas ins Leere zu setzen", () => {
    render(
      <ReleasedContact
        name="Maxi"
        contact={{ ...VOLL, street: null, state: null, country: null }}
      />,
    );

    expect(screen.getByText(/70173 Stuttgart/)).toBeInTheDocument();
    expect(screen.queryByText(/,\s*$/)).not.toBeInTheDocument();
    expect(screen.queryByText("Hauptstr. 1")).not.toBeInTheDocument();
  });

  it("meldet „keine Kontaktdaten“ nur, wenn wirklich nichts da ist", () => {
    render(
      <ReleasedContact
        name="Maxi"
        contact={{
          email: null,
          phone: null,
          street: null,
          postal_code: null,
          city: null,
          state: null,
          country: null,
        }}
      />,
    );

    expect(screen.getByText(/noch keine Kontaktdaten hinterlegt/)).toBeInTheDocument();
  });

  it("meldet das NICHT, wenn nur eine Anschrift hinterlegt ist", () => {
    render(
      <ReleasedContact
        name="Maxi"
        contact={{
          email: null,
          phone: null,
          street: "Hauptstr. 1",
          postal_code: "70173",
          city: "Stuttgart",
          state: null,
          country: null,
        }}
      />,
    );

    expect(screen.queryByText(/noch keine Kontaktdaten hinterlegt/)).not.toBeInTheDocument();
    expect(screen.getByText("Hauptstr. 1")).toBeInTheDocument();
  });
});
