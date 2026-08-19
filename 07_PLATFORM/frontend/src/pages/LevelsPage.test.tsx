import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LevelsPage } from "./LevelsPage";

const { listLevels } = vi.hoisted(() => ({ listLevels: vi.fn() }));
vi.mock("../lib/api", () => ({ listLevels }));

describe("LevelsPage", () => {
  it("shows a loading state, then the levels with links", async () => {
    listLevels.mockResolvedValue([
      { id: "00", title: "Orientation and AI Literacy" },
      { id: "01", title: "AI Foundations" },
    ]);

    render(
      <MemoryRouter>
        <LevelsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/loading levels/i)).toBeInTheDocument();

    expect(await screen.findByText(/Orientation and AI Literacy/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /01.*AI Foundations/ });
    expect(link).toHaveAttribute("href", "/levels/01");
  });

  it("shows an error message when the request fails", async () => {
    listLevels.mockRejectedValue(new Error("network down"));

    render(
      <MemoryRouter>
        <LevelsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("network down");
  });
});
