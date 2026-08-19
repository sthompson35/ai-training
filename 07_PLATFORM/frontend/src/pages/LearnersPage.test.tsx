import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LearnersPage } from "./LearnersPage";
import { ToastProvider } from "../components/ToastProvider";

const { listLearners, createLearner, deleteLearner, exportLearnersCsv, importLearnersCsv, bulkDeleteLearners } =
  vi.hoisted(() => ({
    listLearners: vi.fn(),
    createLearner: vi.fn(),
    deleteLearner: vi.fn(),
    exportLearnersCsv: vi.fn(),
    importLearnersCsv: vi.fn(),
    bulkDeleteLearners: vi.fn(),
  }));
vi.mock("../lib/api", () => ({
  listLearners,
  createLearner,
  deleteLearner,
  exportLearnersCsv,
  importLearnersCsv,
  bulkDeleteLearners,
}));

const fixtureLearner = { id: 1, name: "Ada Lovelace", email: "ada@example.com" };

beforeEach(() => {
  listLearners.mockReset().mockResolvedValue({ items: [fixtureLearner], total: 1 });
  createLearner.mockReset().mockResolvedValue({ id: 2, name: "Grace Hopper", email: "grace@example.com" });
  deleteLearner.mockReset().mockResolvedValue(undefined);
});

describe("LearnersPage", () => {
  it("renders seeded learners", async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <LearnersPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText(/ada@example.com/)).toBeInTheDocument();
  });

  it("creates a learner via the form and clears it afterward", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <LearnersPage />
        </ToastProvider>
      </MemoryRouter>,
    );
    await screen.findByText("Ada Lovelace");

    await user.type(screen.getByLabelText(/name/i), "Grace Hopper");
    await user.type(screen.getByLabelText(/email/i), "grace@example.com");
    await user.click(screen.getByRole("button", { name: /add learner/i }));

    expect(createLearner).toHaveBeenCalledWith({ name: "Grace Hopper", email: "grace@example.com" });
    expect(await screen.findByLabelText(/name/i)).toHaveValue("");
  });

  it(
    "deletes a learner after confirmation and the undo window elapses",
    async () => {
      const user = userEvent.setup();
      vi.spyOn(window, "confirm").mockReturnValue(true);

      render(
        <MemoryRouter>
          <ToastProvider>
            <LearnersPage />
          </ToastProvider>
        </MemoryRouter>,
      );
      await screen.findByText("Ada Lovelace");

      await user.click(screen.getByRole("button", { name: "Delete" }));
      expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
      expect(deleteLearner).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 5200));
      expect(deleteLearner).toHaveBeenCalledWith(1);
    },
    10000,
  );

  it("searches by name, resetting to the first page", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <LearnersPage />
        </ToastProvider>
      </MemoryRouter>,
    );
    await screen.findByText("Ada Lovelace");

    await user.type(screen.getByLabelText(/search/i), "grace");

    expect(listLearners).toHaveBeenLastCalledWith({ q: "grace", limit: 20, offset: 0 });
  });

  it("shows pagination controls and paginates with Next", async () => {
    listLearners.mockResolvedValue({ items: [fixtureLearner], total: 25 });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <LearnersPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/showing 1–20 of 25/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(listLearners).toHaveBeenLastCalledWith({ q: undefined, limit: 20, offset: 20 });
  });
});
