import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GlossaryPage } from "./GlossaryPage";
import { ToastProvider } from "../components/ToastProvider";

const {
  listGlossary,
  createGlossaryTerm,
  updateGlossaryTerm,
  deleteGlossaryTerm,
  exportGlossaryCsv,
  importGlossaryCsv,
  bulkDeleteGlossary,
} = vi.hoisted(() => ({
  listGlossary: vi.fn(),
  createGlossaryTerm: vi.fn(),
  updateGlossaryTerm: vi.fn(),
  deleteGlossaryTerm: vi.fn(),
  exportGlossaryCsv: vi.fn(),
  importGlossaryCsv: vi.fn(),
  bulkDeleteGlossary: vi.fn(),
}));
vi.mock("../lib/api", () => ({
  listGlossary,
  createGlossaryTerm,
  updateGlossaryTerm,
  deleteGlossaryTerm,
  exportGlossaryCsv,
  importGlossaryCsv,
  bulkDeleteGlossary,
}));

beforeEach(() => {
  listGlossary.mockReset().mockResolvedValue([{ term: "Agent", definition: "A bounded system." }]);
  createGlossaryTerm.mockReset().mockResolvedValue({ term: "RAG", definition: "Retrieval." });
  updateGlossaryTerm.mockReset().mockResolvedValue({ term: "Agent", definition: "Updated." });
  deleteGlossaryTerm.mockReset().mockResolvedValue(undefined);
});

describe("GlossaryPage", () => {
  it("renders seeded terms", async () => {
    render(
      <ToastProvider>
        <GlossaryPage />
      </ToastProvider>,
    );
    expect(await screen.findByText("Agent")).toBeInTheDocument();
    expect(screen.getByText(/A bounded system/)).toBeInTheDocument();
  });

  it("edits a term's definition inline", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <GlossaryPage />
      </ToastProvider>,
    );
    await screen.findByText("Agent");

    await user.click(screen.getByRole("button", { name: /edit/i }));
    const definitionField = screen.getByLabelText(/definition/i);
    await user.clear(definitionField);
    await user.type(definitionField, "Updated.");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(updateGlossaryTerm).toHaveBeenCalledWith("Agent", "Updated.");
  });

  it(
    "deletes a term after confirmation and the undo window elapses",
    async () => {
      const user = userEvent.setup();
      vi.spyOn(window, "confirm").mockReturnValue(true);
      render(
        <ToastProvider>
          <GlossaryPage />
        </ToastProvider>,
      );
      await screen.findByText("Agent");

      await user.click(screen.getByRole("button", { name: "Delete" }));
      expect(screen.queryByText("Agent")).not.toBeInTheDocument();
      expect(deleteGlossaryTerm).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 5200));
      expect(deleteGlossaryTerm).toHaveBeenCalledWith("Agent");
    },
    10000,
  );
});
