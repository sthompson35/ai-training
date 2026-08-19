import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { IncidentsPage } from "./IncidentsPage";
import { ToastProvider } from "../components/ToastProvider";

const { listIncidents, listAgents, listReleases, bulkUpdateIncidentCapaStatus } = vi.hoisted(() => ({
  listIncidents: vi.fn(),
  listAgents: vi.fn(),
  listReleases: vi.fn(),
  bulkUpdateIncidentCapaStatus: vi.fn(),
}));
vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return { ...actual, listIncidents, listAgents, listReleases, bulkUpdateIncidentCapaStatus };
});

const fixtureIncident = {
  id: 1,
  title: "Agent gave incorrect refund info",
  severity: "high",
  status: "detected",
  owner: "support-eng",
  agent_id: 1,
  release_id: 1,
  capa_status: null,
};

beforeEach(() => {
  listIncidents.mockReset().mockResolvedValue({ items: [fixtureIncident], total: 1 });
  listAgents.mockReset().mockResolvedValue({ items: [{ id: 1, name: "Support Triage Agent" }], total: 1 });
  listReleases.mockReset().mockResolvedValue({
    items: [{ id: 1, title: "Add refusal instruction", version: "2.1.0" }],
    total: 1,
  });
  bulkUpdateIncidentCapaStatus.mockReset().mockResolvedValue({ updated: 1, skipped: [] });
});

describe("IncidentsPage", () => {
  it("focuses the page heading on mount", async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <IncidentsPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Incident Log" })).toHaveFocus();
  });

  it("renders incidents with the linked agent's name", async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <IncidentsPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("link", { name: /Agent gave incorrect refund info/ })).toHaveAttribute(
      "href",
      "/incidents/1",
    );
    expect(screen.getByText(/agent: Support Triage Agent/)).toBeInTheDocument();
    expect(screen.getByText(/release: Add refusal instruction \(2.1.0\)/)).toBeInTheDocument();
  });

  it("bulk-updates the CAPA status of selected incidents after confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <MemoryRouter>
        <ToastProvider>
          <IncidentsPage />
        </ToastProvider>
      </MemoryRouter>,
    );
    await screen.findByRole("link", { name: /Agent gave incorrect refund info/ });

    await user.click(screen.getByLabelText("Select Agent gave incorrect refund info"));

    await user.selectOptions(screen.getByLabelText("Bulk set CAPA status"), "verified");
    await user.click(screen.getByRole("button", { name: /set capa status \(1\)/i }));

    expect(bulkUpdateIncidentCapaStatus).toHaveBeenCalledWith([1], "verified");
    expect(await screen.findByText("Updated 1, skipped 0.")).toBeInTheDocument();
  });

  it("shows an empty state with no incidents", async () => {
    listIncidents.mockResolvedValue({ items: [], total: 0 });
    render(
      <MemoryRouter>
        <ToastProvider>
          <IncidentsPage />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/no incidents logged yet/i)).toBeInTheDocument();
  });

  it("re-queries when the status filter changes", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <IncidentsPage />
        </ToastProvider>
      </MemoryRouter>,
    );
    await screen.findByRole("link", { name: /Agent gave incorrect refund info/ });

    await user.selectOptions(screen.getByLabelText(/^status:/i), "resolved");
    expect(listIncidents).toHaveBeenLastCalledWith({
      status: "resolved",
      severity: undefined,
      q: undefined,
      limit: 20,
      offset: 0,
    });
  });

  it("shows pagination controls and paginates with Next", async () => {
    listIncidents.mockResolvedValue({ items: [fixtureIncident], total: 25 });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <IncidentsPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/showing 1–20 of 25/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(listIncidents).toHaveBeenLastCalledWith({
      status: undefined,
      severity: undefined,
      q: undefined,
      limit: 20,
      offset: 20,
    });
  });
});
