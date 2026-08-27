import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import LegalPage from "./LegalPage";
import { rechtsseiten } from "../content/legal/meta";
import { impressum as impressumDok } from "../content/legal/impressum";
import { datenschutz as datenschutzDok } from "../content/legal/datenschutz";
import type { Rechtsdokument } from "../content/legal/types";

function zeige(dok: Rechtsdokument) {
  return render(
    <MemoryRouter>
      <LegalPage dokument={dok} />
    </MemoryRouter>,
  );
}

const impressum = impressumDok;
const datenschutz = datenschutzDok;

describe("LegalPage", () => {
  it("zeigt Titel und Stand des Dokuments", () => {
    zeige(impressum);
    expect(screen.getByRole("heading", { level: 1, name: "Impressum" })).toBeInTheDocument();
    // Genau die Standzeile — das Datum steht auch in der Herkunftsangabe.
    expect(screen.getByText(/^Stand: 15\. Juli 2026$/)).toBeInTheDocument();
  });

  it("rendert Text als TEXT, nicht als Markup", () => {
    // Der Kern von Requirement „rendered as data, never as markup". Ein
    // Renderer mit dangerouslySetInnerHTML wuerde hier ein <script> in den
    // Baum haengen; dieser Test faellt dann, weil der Text verschwindet.
    const bomb: Rechtsdokument = {
      ...impressum,
      abschnitte: [
        {
          titel: "<b>Titel</b>",
          bloecke: [{ art: "absatz", inhalt: ["<script>alert(1)</script>"] }],
        },
      ],
    };
    const { container } = zeige(bomb);
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(screen.getByText("<b>Titel</b>")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
  });

  it("zeigt den Entwurfshinweis mit den offenen Punkten DIESES Dokuments", () => {
    zeige(datenschutz);
    const hinweis = screen.getByRole("note");
    // Der Verantwortlichen-Widerspruch ist der Punkt, der nicht still
    // passieren darf.
    expect(within(hinweis).getByText(/DK Real Invest eG/)).toBeInTheDocument();
  });

  it("zeigt bei zwei Dokumenten VERSCHIEDENE offene Punkte", () => {
    // Ein Einheitssatz muss diesen Test brechen — sonst prueft er nur, dass
    // irgendein Kasten da ist. Beide Plan-Reviewer haben genau das beanstandet.
    const { unmount } = zeige(datenschutz);
    const a = screen.getByRole("note").textContent;
    unmount();
    zeige(impressum);
    const b = screen.getByRole("note").textContent;
    expect(a).not.toEqual(b);
  });

  it("zeigt KEINEN Entwurfshinweis, wenn das Dokument nicht provisorisch ist", () => {
    // Ohne diesen Fall koennte das Szenario „a document not marked provisional
    // carries no notice" nie rot werden.
    zeige({ ...impressum, provisorisch: false, offenePunkte: [] });
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("nennt die Herkunft des Textes", () => {
    zeige(impressum);
    expect(screen.getByText(/05 FBC Impressum\.docx/)).toBeInTheDocument();
  });

  it("verweist auf die drei anderen Rechtsseiten und zurueck auf die Startseite", () => {
    zeige(impressum);
    for (const dok of rechtsseiten.filter((d) => d.slug !== "impressum")) {
      expect(screen.getByRole("link", { name: dok.titel })).toHaveAttribute("href", `/${dok.slug}`);
    }
    // Statischer Link, kein history.back() — das bricht beim Direktaufruf.
    //
    // Auf die Fußzeilen-NAVIGATION eingeschraenkt, seit der Kopf einen zweiten
    // Rueckweg traegt (AGE-625): beide heissen beim Direktaufruf gleich, und
    // ein `getByRole` ueber das ganze Dokument faende zwei. Die Einschraenkung
    // macht die Zusage praeziser, nicht schwaecher — sie sagt jetzt, WO der
    // Link steht.
    const fusszeile = screen.getByRole("navigation", { name: "Weitere Rechtsseiten" });
    expect(within(fusszeile).getByRole("link", { name: "Zurück zur Startseite" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("macht aus einem javascript:-Verweis KEINEN Link", () => {
    // `types.ts` verspricht „nie als Markup" — fuer href galt das nicht.
    // Der Text bleibt sichtbar, aber er ist nicht anklickbar.
    zeige({
      ...impressum,
      provisorisch: false,
      abschnitte: [
        {
          titel: "Probe",
          bloecke: [
            {
              art: "absatz",
              inhalt: [{ text: "Harmlos aussehend", href: "javascript:alert(1)" }],
            },
          ],
        },
      ],
    });
    expect(screen.getByText("Harmlos aussehend")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Harmlos aussehend" })).toBeNull();
  });

  it("rendert Verweise im Fliesstext als echte Links", () => {
    zeige(impressum);
    expect(screen.getByRole("link", { name: "info@fairbusinessclub.de" })).toHaveAttribute(
      "href",
      "mailto:info@fairbusinessclub.de",
    );
  });

  it("rendert jede Blockart", () => {
    // provisorisch: false — sonst bringt der Entwurfshinweis eine zweite
    // Liste mit und `getByRole("list")` findet zwei.
    zeige({
      ...impressum,
      provisorisch: false,
      abschnitte: [
        {
          titel: "Alle drei",
          bloecke: [
            { art: "absatz", inhalt: ["Ein Absatz."] },
            { art: "liste", punkte: [["Erster Punkt"], ["Zweiter Punkt"]] },
            { art: "zeilen", zeilen: [["Zeile eins"], ["Zeile zwei"]] },
          ],
        },
      ],
    });
    expect(screen.getByText("Ein Absatz.")).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByText("Erster Punkt")).toBeInTheDocument();
    expect(screen.getByText("Zeile eins")).toBeInTheDocument();
  });
});
