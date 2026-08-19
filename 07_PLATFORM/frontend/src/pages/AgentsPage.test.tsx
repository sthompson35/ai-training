import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AgentsPage } from "./AgentsPage";
import { ToastProvider } from "../components/ToastProvider";

const { listAgents, exportAgentsCsv, importAgentsCsv, bulkDeleteAgents } = vi.hoisted(() => ({
  listAgents: vi.fn(),
  exportAgentsCsv: vi.fn(),
  importAgentsCsv: vi.fn(),
  bulkDeleteAgents: vi.fn(),
}));
vi.mock("../lib/api", () => ({ listAgents, exportAgentsCsv, importAgentsCsv, bulkDeleteAgents }));

const fixtureAgent = {
  id: 1,
  name: "Support Triage Agent",
  owner: "support-eng",
  risk_tier: 2,
  approval_status: "approved",
  active: false,
};

beforeEach(() => {
  listAgents.mockReset();
});

describe("AgentsPage", () => {
  it("renders an empty state when no agents are registered", async () => {
    listAgents.mockResolvedValue({ items: [], total: 0 });
    render(
      <MemoryRouter>
        <ToastProvider>
          <AgentsPage />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/no agents registered yet/i)).toBeInTheDocument();
  });

  it("renders agents with their live state", async () => {
    listAgents.mockResolvedValue({ items: [fixtureAgent], total: 1 });
    render(
      <MemoryRouter>
        <ToastProvider>
          <AgentsPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("link", { name: /Support Triage Agent/ })).toHaveAttribute(
      "href",
      "/agents/1",
    );
    expect(screen.getByText("Killed")).toBeInTheDocument();
    expect(screen.getByText("approved")).toBeInTheDocument();
  });

  it("searches by name, resetting to the first page", async () => {
    listAgents.mockResolvedValue({ items: [fixtureAgent], total: 1 });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <AgentsPage />
        </ToastProvider>
      </MemoryRouter>,
    );
    await screen.findByRole("link", { name: /Support Triage Agent/ });

    await user.type(screen.getByLabelText(/search/i), "triage");
    expect(listAgents).toHaveBeenLastCalledWith({ q: "triage", limit: 20, offset: 0 });
  });

  it("shows pagination controls and paginates with Next", async () => {
    listAgents.mockResolvedValue({ items: [fixtureAgent], total: 25 });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <AgentsPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/showing 1–20 of 25/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(listAgents).toHaveBeenLastCalledWith({ q: undefined, limit: 20, offset: 20 });
  });
});
