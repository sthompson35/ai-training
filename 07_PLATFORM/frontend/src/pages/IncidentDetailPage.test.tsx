import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { IncidentDetailPage } from "./IncidentDetailPage";
import { ToastProvider } from "../components/ToastProvider";

const { getIncident, createIncident, updateIncident, deleteIncident, listAgents, listReleases } = vi.hoisted(
  () => ({
    getIncident: vi.fn(),
    createIncident: vi.fn(),
    updateIncident: vi.fn(),
    deleteIncident: vi.fn(),
    listAgents: vi.fn(),
    listReleases: vi.fn(),
  }),
);
vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return { ...actual, getIncident, createIncident, updateIncident, deleteIncident, listAgents, listReleases };
});

const fixtureIncident = {
  id: 1,
  title: "Agent gave incorrect refund info",
  severity: "high",
  status: "detected",
  description: "What happened",
  impact: "One customer affected",
  root_cause: null,
  corrective_action: null,
  owner: "support-eng",
  agent_id: null,
  opened_at: "2026-01-01T00:00:00Z",
  resolved_at: null,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/incidents/1"]}>
      <ToastProvider>
        <Routes>
          <Route path="/incidents" element={<p>All incidents</p>} />
          <Route path="/incidents/:incidentId" element={<IncidentDetailPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getIncident.mockReset().mockResolvedValue(fixtureIncident);
  updateIncident.mockReset().mockResolvedValue(fixtureIncident);
  deleteIncident.mockReset().mockResolvedValue(undefined);
  listAgents.mockReset().mockResolvedValue({ items: [], total: 0 });
  listReleases.mockReset().mockResolvedValue({ items: [], total: 0 });
});

describe("IncidentDetailPage", () => {
  it("renders the incident and its form", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Agent gave incorrect refund info" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^owner$/i)).toHaveValue("support-eng");
  });

  it("saves an update", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Agent gave incorrect refund info" });

    await user.selectOptions(screen.getByLabelText(/^status$/i), "resolved");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(updateIncident).toHaveBeenCalledWith(1, expect.objectContaining({ status: "resolved" }));
  });

  it(
    "navigates away immediately and deletes the incident once the undo window elapses",
    async () => {
      const user = userEvent.setup();
      vi.spyOn(window, "confirm").mockReturnValue(true);
      renderPage();
      await screen.findByRole("heading", { name: "Agent gave incorrect refund info" });

      await user.click(screen.getByRole("button", { name: /delete incident/i }));
      expect(await screen.findByText("All incidents")).toBeInTheDocument();
      expect(deleteIncident).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 5200));
      expect(deleteIncident).toHaveBeenCalledWith(1);
    },
    10000,
  );
});
