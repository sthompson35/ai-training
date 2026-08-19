import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LevelDetailPage } from "./LevelDetailPage";
import { ToastProvider } from "../components/ToastProvider";

const { getLevel, createModule, updateModule, deleteModule, exportModulesCsv, importModulesCsv, bulkDeleteModules } =
  vi.hoisted(() => ({
    getLevel: vi.fn(),
    createModule: vi.fn(),
    updateModule: vi.fn(),
    deleteModule: vi.fn(),
    exportModulesCsv: vi.fn(),
    importModulesCsv: vi.fn(),
    bulkDeleteModules: vi.fn(),
  }));
vi.mock("../lib/api", () => ({
  getLevel,
  createModule,
  updateModule,
  deleteModule,
  exportModulesCsv,
  importModulesCsv,
  bulkDeleteModules,
}));

const fixtureLevel = {
  id: "01",
  title: "AI Foundations",
  modules: [
    {
      id: "01.1",
      level_id: "01",
      title: "Machine learning and neural networks",
      learning_outcome: "Describe training and inference.",
      estimated_hours: 4,
      assessment: "Quiz + Lab + Evidence",
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/levels/01"]}>
      <ToastProvider>
        <Routes>
          <Route path="/levels/:levelId" element={<LevelDetailPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getLevel.mockReset().mockResolvedValue(fixtureLevel);
  createModule.mockReset().mockResolvedValue(fixtureLevel.modules[0]);
  updateModule.mockReset().mockResolvedValue(fixtureLevel.modules[0]);
  deleteModule.mockReset().mockResolvedValue(undefined);
});

describe("LevelDetailPage", () => {
  it("renders the level and its modules", async () => {
    renderPage();
    expect(await screen.findByText(/AI Foundations/)).toBeInTheDocument();
    expect(screen.getByText("01.1")).toBeInTheDocument();
    expect(getLevel).toHaveBeenCalledWith("01");
  });

  it("edits a module inline", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("01.1");

    await user.click(screen.getByRole("button", { name: /edit/i }));
    const titleField = screen.getByLabelText(/title/i);
    await user.clear(titleField);
    await user.type(titleField, "Updated title");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(updateModule).toHaveBeenCalledWith(
      "01.1",
      expect.objectContaining({ title: "Updated title" }),
    );
  });

  it(
    "deletes a module after confirmation and the undo window elapses",
    async () => {
      const user = userEvent.setup();
      vi.spyOn(window, "confirm").mockReturnValue(true);
      renderPage();
      await screen.findByText("01.1");

      await user.click(screen.getByRole("button", { name: "Delete" }));
      expect(screen.queryByText("01.1")).not.toBeInTheDocument();
      expect(deleteModule).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 5200));
      expect(deleteModule).toHaveBeenCalledWith("01.1");
    },
    10000,
  );

  it("adds a module using a prompted code", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("01.5");
    renderPage();
    await screen.findByText("01.1");

    await user.click(screen.getByRole("button", { name: /add module/i }));
    await user.type(screen.getByLabelText(/title/i), "New module");
    await user.type(screen.getByLabelText(/learning outcome/i), "Outcome");
    await user.type(screen.getByLabelText(/assessment/i), "Quiz");
    await user.click(screen.getByRole("button", { name: /^add module$/i }));

    expect(createModule).toHaveBeenCalledWith(
      "01",
      "01.5",
      expect.objectContaining({ title: "New module" }),
    );
  });
});
