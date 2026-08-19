import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GovernancePage } from "./GovernancePage";
import { ToastProvider } from "../components/ToastProvider";

const {
  listRaciEntries,
  createRaciEntry,
  updateRaciEntry,
  deleteRaciEntry,
  exportRaciEntriesCsv,
  importRaciEntriesCsv,
  bulkDeleteRaciEntries,
} = vi.hoisted(() => ({
  listRaciEntries: vi.fn(),
  createRaciEntry: vi.fn(),
  updateRaciEntry: vi.fn(),
  deleteRaciEntry: vi.fn(),
  exportRaciEntriesCsv: vi.fn(),
  importRaciEntriesCsv: vi.fn(),
  bulkDeleteRaciEntries: vi.fn(),
}));
vi.mock("../lib/api", () => ({
  listRaciEntries,
  createRaciEntry,
  updateRaciEntry,
  deleteRaciEntry,
  exportRaciEntriesCsv,
  importRaciEntriesCsv,
  bulkDeleteRaciEntries,
}));

const fixtureEntries = [
  { id: 1, activity: "Curriculum governance", role: "Executive Sponsor", responsibility: "A" },
  { id: 2, activity: "Curriculum governance", role: "Academy Owner", responsibility: "R" },
  { id: 3, activity: "Source approval", role: "Academy Owner", responsibility: "A/R" },
];

beforeEach(() => {
  listRaciEntries.mockReset().mockResolvedValue(fixtureEntries);
  createRaciEntry.mockReset().mockResolvedValue(fixtureEntries[0]);
  updateRaciEntry.mockReset().mockResolvedValue(fixtureEntries[0]);
  deleteRaciEntry.mockReset().mockResolvedValue(undefined);
});

describe("GovernancePage", () => {
  it("renders entries grouped by activity", async () => {
    render(
      <ToastProvider>
        <GovernancePage />
      </ToastProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Curriculum governance" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Source approval" })).toBeInTheDocument();
    expect(screen.getByText("Executive Sponsor")).toBeInTheDocument();
    expect(screen.getByText("A/R")).toBeInTheDocument();
  });

  it("edits an entry inline", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <GovernancePage />
      </ToastProvider>,
    );
    await screen.findByRole("heading", { name: "Curriculum governance" });

    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    await user.click(editButtons[0]);
    const responsibilityField = screen.getByLabelText(/responsibility/i);
    await user.clear(responsibilityField);
    await user.type(responsibilityField, "A/R");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(updateRaciEntry).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ responsibility: "A/R" }),
    );
  });

  it(
    "deletes an entry after confirmation and the undo window elapses",
    async () => {
      const user = userEvent.setup();
      vi.spyOn(window, "confirm").mockReturnValue(true);
      render(
        <ToastProvider>
          <GovernancePage />
        </ToastProvider>,
      );
      await screen.findByRole("heading", { name: "Curriculum governance" });

      const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
      await user.click(deleteButtons[0]);
      expect(deleteRaciEntry).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 5200));
      expect(deleteRaciEntry).toHaveBeenCalledWith(1);
    },
    10000,
  );

  it("adds a new entry", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <GovernancePage />
      </ToastProvider>,
    );
    await screen.findByRole("heading", { name: "Curriculum governance" });

    await user.click(screen.getByRole("button", { name: /add entry/i }));
    await user.type(screen.getByLabelText(/activity/i), "Technical labs");
    await user.type(screen.getByLabelText(/^role$/i), "Security Owner");
    await user.type(screen.getByLabelText(/responsibility/i), "C");
    await user.click(screen.getByRole("button", { name: /^add entry$/i }));

    expect(createRaciEntry).toHaveBeenCalledWith({
      activity: "Technical labs",
      role: "Security Owner",
      responsibility: "C",
    });
  });
});
