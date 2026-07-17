import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./Card";

describe("Card", () => {
  it("applies default padding", () => {
    const { container } = render(<Card>x</Card>);
    expect(container.firstChild).toHaveClass("p-6");
  });

  it("omits padding when padded is false", () => {
    const { container } = render(<Card padded={false}>x</Card>);
    expect(container.firstChild).not.toHaveClass("p-6");
  });

  it("forwards className and data attributes", () => {
    const { container } = render(
      <Card className="custom-x" data-testid="card-1">
        x
      </Card>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("custom-x");
    expect(el).toHaveAttribute("data-testid", "card-1");
    // padded is consumed, not leaked onto the DOM node
    expect(el).not.toHaveAttribute("padded");
  });
});
