import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BarChart } from "./BarChart";

describe("BarChart", () => {
  it("renders one row per data point with the correct label and count", () => {
    render(
      <BarChart
        title="Incidents by severity"
        data={[
          { label: "critical", count: 1 },
          { label: "high", count: 4 },
        ]}
      />,
    );

    expect(screen.getByText("Incidents by severity")).toBeInTheDocument();
    expect(screen.getByText("critical")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("shows a no-data message when data is empty", () => {
    render(<BarChart title="Releases by status" data={[]} />);

    expect(screen.getByText("No data yet.")).toBeInTheDocument();
  });

  it("sizes the largest bar at 100% width", () => {
    render(
      <BarChart
        title="Modules by level"
        data={[
          { label: "00", count: 2 },
          { label: "01", count: 4 },
        ]}
      />,
    );

    const bars = document.querySelectorAll("div[style*='background: var(--color-accent)']");
    const widths = Array.from(bars).map((el) => (el as HTMLElement).style.width);
    expect(widths).toContain("100%");
    expect(widths).toContain("50%");
  });
});
