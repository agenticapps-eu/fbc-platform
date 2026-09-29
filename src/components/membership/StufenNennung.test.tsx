import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { MemberCard } from "../community/MemberDirectory";
import { MembershipSummary } from "./MembershipSummary";
import { ProfileHero } from "../profile/ProfileHero";
import { TierBadge } from "../ui/TierBadge";

/**
 * Die Oberfläche benennt nur die Clubstufen (AGE-969).
 *
 * ── WARUM DIESER TEST GERENDERTE ANSICHTEN MISST UND NICHT DAS BÜNDEL ───────
 * Die erste Fassung des Entwurfs wollte das gebaute Bündel nach den Wörtern
 * durchsuchen. Der Fremdreview hat gezeigt, dass diese Zusage **ab dem ersten
 * Bau falsch** ist, und zwar aus drei Gründen, die alle im Change selbst
 * stehen:
 *
 *   1. `levels.ts` behält alle sechs Einträge SAMT Labels — ausdrücklich — und
 *      wird von Mitgliederkomponenten importiert. Die Strings liegen also
 *      zwingend im Bündel.
 *   2. Die Admin-Einzelbearbeitung MUSS den Namen einer gesetzten niedrigeren
 *      Stufe zeigen können, sonst setzte ein Speichern sie still hoch.
 *   3. `release-entries.generated.ts` behält sieben Vorkommen absichtlich.
 *
 * Ein Wächter über dem Artefakt kann diese drei nicht von einer echten
 * Fundstelle trennen — er wäre rot oder führte eine Ausnahmeliste, und die ist
 * wieder die Inventur, die er ersetzen sollte.
 *
 * ── WAS DIESER TEST NICHT SIEHT ─────────────────────────────────────────────
 * Benannt statt verschwiegen:
 *
 *   * Inhalte, die ein Admin zur LAUFZEIT pflegt — Beiträge, Events,
 *     Neuigkeiten. Dort kann jemand jederzeit „Connect" tippen.
 *   * Die Flächen, die hier nicht gerendert werden. Ihre Zusagen stehen je in
 *     der eigenen Testdatei; diese hier deckt die drei Bauteile ab, die eine
 *     Stufe UNMITTELBAR anzeigen.
 *   * Das Verzeichnis und das Dashboard — sie rendern über `TierBadge`
 *     beziehungsweise eine eigene Plakette; ihre Zusagen stehen daneben.
 *
 * ── BEIDE HÄLFTEN, IMMER ────────────────────────────────────────────────────
 * Jede Verneinung hat hier eine Gegenprobe. Ohne sie bestünde „unterhalb des
 * Clubs steht kein Name" auch mit einer Plakette, die es überhaupt nie gibt.
 */
const AUSSERHALB = ["active", "boost", "connect"] as const;

describe("TierBadge", () => {
  it.each(AUSSERHALB)("zeigt für %s gar nichts", (stufe) => {
    const { container } = render(<TierBadge tier={stufe} />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each(["discover", "focus", "impact"])("zeigt für %s den Namen", (stufe) => {
    render(<TierBadge tier={stufe} />);
    const erwartet = stufe.charAt(0).toUpperCase() + stufe.slice(1);
    expect(screen.getByText(erwartet)).toBeInTheDocument();
  });

  it("zeigt auch für einen unbekannten Schlüssel nichts", () => {
    // Eine halbe Auslieferung darf keinen rohen Schlüssel an die Fläche lassen.
    const { container } = render(<TierBadge tier="gibtesnicht" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ProfileHero", () => {
  it.each(AUSSERHALB)("nennt %s nicht", (stufe) => {
    render(<ProfileHero name="Anna Berg" tier={stufe} />);
    expect(screen.queryByText(/Member/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/Active|Boost|Connect/);
  });

  it("nennt eine Clubstufe weiter", () => {
    render(<ProfileHero name="Anna Berg" tier="focus" />);
    expect(screen.getByText(/Focus Member/)).toBeInTheDocument();
  });
});

describe("MembershipSummary", () => {
  it.each(AUSSERHALB)("nennt für %s keine Stufe, sondern den Zugangssatz", (stufe) => {
    render(<MembershipSummary current={stufe} />);
    expect(document.body.textContent).not.toMatch(/Active|Boost|Connect/);
    // Die Sackgasse wird benannt, nicht verschwiegen: es gibt keinen
    // Selbstbedienungsweg, und der Kontaktweg steht dabei.
    expect(screen.getByText(/nicht selbst buchen/)).toBeInTheDocument();
    expect(screen.getByText(/Support/)).toBeInTheDocument();
  });

  it("nennt für eine Clubstufe ihren Namen", () => {
    render(<MembershipSummary current="discover" />);
    expect(screen.getByText("Discover")).toBeInTheDocument();
  });

  it("schlägt keinen nächsten Schritt vor, den die Fläche verschweigt", () => {
    // Von ACTIVE wäre der nächste Rang BOOST — und den gibt es an der
    // Oberfläche nicht. Ein Vorschlag darauf wäre ein Verweis ins Leere.
    render(<MembershipSummary current="active" />);
    expect(screen.queryByText(/Nächster Schritt/)).toBeNull();
  });

  it("schlägt innerhalb des Clubs weiter einen nächsten Schritt vor", () => {
    render(<MembershipSummary current="discover" />);
    expect(screen.getByText(/Nächster Schritt: Focus/)).toBeInTheDocument();
  });
});

describe("MemberCard im Verzeichnis", () => {
  function karte(tier: string) {
    return render(
      <MemoryRouter>
        <MemberCard
          member={
            {
              id: "m1",
              name: "Anna Berg",
              avatar_url: null,
              cover_url: null,
              region: null,
              company: null,
              short_bio: null,
              branche: null,
              tier,
              roles: null,
              competencies: null,
              has_offers: false,
              has_needs: false,
              offer_categories: [],
              need_categories: [],
            } as never
          }
        />
      </MemoryRouter>,
    );
  }

  it.each(AUSSERHALB)("zeigt für %s keine Plakette", (stufe) => {
    karte(stufe);
    expect(document.body.textContent).not.toMatch(/Active|Boost|Connect/);
  });

  it("zeigt für eine Clubstufe die Plakette", () => {
    // Die Gegenprobe: ohne sie bestünde die Zusage darüber auch mit einer
    // Karte, die überhaupt nie eine Plakette zeichnet.
    karte("impact");
    expect(screen.getByText("Impact")).toBeInTheDocument();
  });
});
