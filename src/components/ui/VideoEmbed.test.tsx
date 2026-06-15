import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VideoEmbed } from "./VideoEmbed";

describe("VideoEmbed", () => {
  it("bettet einen YouTube-Link über die sichere Embed-URL ein", () => {
    render(<VideoEmbed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" title="Test" />);
    const frame = screen.getByTitle("Test") as HTMLIFrameElement;
    expect(frame.getAttribute("src")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(frame.getAttribute("loading")).toBe("lazy");
  });

  it("bettet einen Vimeo-Link über die sichere Embed-URL ein", () => {
    render(<VideoEmbed url="https://vimeo.com/123456789" title="Vimeo" />);
    const frame = screen.getByTitle("Vimeo") as HTMLIFrameElement;
    expect(frame.getAttribute("src")).toBe("https://player.vimeo.com/video/123456789");
  });

  it("zeigt für eine nicht unterstützte URL eine klare Fehlermeldung statt eines iframes", () => {
    render(<VideoEmbed url="https://evil.example.com/embed/x" />);
    expect(screen.queryByTitle("Video")).toBeNull();
    expect(screen.getByText(/Nur YouTube- und Vimeo-Links/i)).toBeInTheDocument();
  });
});
