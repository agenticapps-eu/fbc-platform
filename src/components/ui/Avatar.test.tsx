import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./Avatar";

describe("Avatar masked", () => {
  it("renders neither image nor initials when masked", () => {
    const { container } = render(<Avatar name="Eleonora Voss" src="https://x/a.jpg" masked />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByText("EV")).toBeNull();
  });

  it("still renders initials when not masked and no src", () => {
    render(<Avatar name="Eleonora Voss" />);
    expect(screen.getByText("EV")).toBeInTheDocument();
  });
});
