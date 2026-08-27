import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { freigeben, istFreigegeben } from "../lib/video-freigabe";
import { VideoFreigabeWiderruf } from "./VideoFreigabeWiderruf";

beforeEach(() => {
  localStorage.clear();
});

describe("VideoFreigabeWiderruf (AGE-621)", () => {
  it("sagt ausdrücklich, wenn nichts freigegeben ist", () => {
    render(<VideoFreigabeWiderruf />);

    // Ein leerer Abschnitt liesse offen, ob es nichts gibt oder etwas fehlt.
    expect(screen.getByText(/Sie haben derzeit keinen Anbieter freigegeben/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("bietet den Widerruf nur für den tatsächlich freigegebenen Anbieter an", () => {
    freigeben("youtube");
    render(<VideoFreigabeWiderruf />);

    expect(screen.getByRole("button", { name: /YouTube/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Vimeo/i })).toBeNull();
  });

  it("nimmt die Freigabe zurück und zeigt das sofort", () => {
    freigeben("youtube");
    freigeben("vimeo");
    render(<VideoFreigabeWiderruf />);

    fireEvent.click(screen.getByRole("button", { name: /YouTube/i }));

    expect(istFreigegeben("youtube")).toBe(false);
    // Das Abonnement muss greifen, sonst stünde der Knopf noch da und der
    // Besucher wüsste nicht, ob sein Widerruf angekommen ist.
    expect(screen.queryByRole("button", { name: /YouTube/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Vimeo/i })).toBeInTheDocument();
    expect(istFreigegeben("vimeo")).toBe(true);
  });
});
