import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LabsPage } from "./LabsPage";
import { ToastProvider } from "../components/ToastProvider";

const { listLabs, createLab, updateLab, deleteLab, exportLabsCsv, importLabsCsv, bulkDeleteLabs } = vi.hoisted(() => ({
  listLabs: vi.fn(),
  createLab: vi.fn(),
  updateLab: vi.fn(),
  deleteLab: vi.fn(),
  exportLabsCsv: vi.fn(),
  importLabsCsv: vi.fn(),
  bulkDeleteLabs: vi.fn(),
}));
vi.mock("../lib/api", () => ({
  listLabs,
  createLab,
  updateLab,
  deleteLab,
  exportLabsCsv,
  importLabsCsv,
  bulkDeleteLabs,
}));

const fixtureLab = { id: "LAB-001", title: "Availability simulator", domain: "Client-side AI", deliverable: "Demo" };

beforeEach(() => {
  listLabs.mockReset().mockResolvedValue([fixtureLab]);
  createLab.mockReset().mockResolvedValue({ ...fixtureLab, id: "LAB-099" });
  updateLab.mockReset().mockResolvedValue(fixtureLab);
  deleteLab.mockReset().mockResolvedValue(undefined);
});

describe("LabsPage", () => {
  it("renders seeded labs", async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <LabsPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Availability simulator")).toBeInTheDocument();
    expect(screen.getByText("LAB-001")).toBeInTheDocument();
  });

  it(
    "hides a deleted lab immediately, then calls the API once the undo window elapses",
    async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);

      render(
        <MemoryRouter>
          <ToastProvider>
            <LabsPage />
          </ToastProvider>
        </MemoryRouter>,
      );
      await screen.findByText("Availability simulator");

      fireEvent.click(screen.getByRole("button", { name: "Delete" }));

      expect(window.confirm).toHaveBeenCalled();
      expect(screen.queryByText("Availability simulator")).not.toBeInTheDocument();
      expect(deleteLab).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 5200));

      expect(deleteLab).toHaveBeenCalledWith("LAB-001");
    },
    10000,
  );

  it(
    "restores the row and never calls the API when Undo is clicked",
    async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);

      render(
        <MemoryRouter>
          <ToastProvider>
            <LabsPage />
          </ToastProvider>
        </MemoryRouter>,
      );
      await screen.findByText("Availability simulator");

      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      expect(screen.queryByText("Availability simulator")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
      expect(screen.getByText("Availability simulator")).toBeInTheDocument();

      await new Promise((resolve) => setTimeout(resolve, 5200));
      expect(deleteLab).not.toHaveBeenCalled();
    },
    10000,
  );

  it("adds a new lab using a prompted id", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("LAB-099");

    render(
      <MemoryRouter>
        <ToastProvider>
          <LabsPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    await screen.findByText("Availability simulator");
    await user.click(screen.getByRole("button", { name: /add lab/i }));

    await user.type(screen.getByLabelText(/^title$/i), "New lab");
    await user.type(screen.getByLabelText(/^domain$/i), "Agents");
    await user.type(screen.getByLabelText(/deliverable/i), "A demo");
    await user.click(screen.getByRole("button", { name: /^add lab$/i }));

    expect(window.prompt).toHaveBeenCalled();
    expect(createLab).toHaveBeenCalledWith("LAB-099", {
      title: "New lab",
      domain: "Agents",
      deliverable: "A demo",
    });
  });
});
