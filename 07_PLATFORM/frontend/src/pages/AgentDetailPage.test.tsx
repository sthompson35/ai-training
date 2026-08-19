import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AgentDetailPage } from "./AgentDetailPage";
import { ToastProvider } from "../components/ToastProvider";

const { getAgent, createAgent, updateAgent, deleteAgent } = vi.hoisted(() => ({
  getAgent: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
}));
vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return { ...actual, getAgent, createAgent, updateAgent, deleteAgent };
});

const fixtureAgent = {
  id: 1,
  name: "Support Triage Agent",
  owner: "support-eng",
  version: "1.0",
  purpose: "Triage tickets",
  non_goals: "No refunds",
  risk_tier: 2,
  approved_models: "gpt-mini",
  approved_tools: "ticket-search",
  data_access: "metadata only",
  action_permissions: "read-only",
  approval_requirements: "tier-2 approval",
  budgets: "1000 tokens",
  fallback: "route to human",
  monitoring: "dashboard",
  kill_switch: "feature flag",
  active: true,
  approval_status: "approved" as const,
  evaluation_set: "eval-v1",
  last_review: "2026-01-01",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/agents/1"]}>
      <ToastProvider>
        <Routes>
          <Route path="/agents" element={<p>All agents</p>} />
          <Route path="/agents/:agentId" element={<AgentDetailPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getAgent.mockReset().mockResolvedValue(fixtureAgent);
  updateAgent.mockReset().mockResolvedValue(fixtureAgent);
  deleteAgent.mockReset().mockResolvedValue(undefined);
});

describe("AgentDetailPage", () => {
  it("renders the agent's status and form", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Support Triage Agent" })).toBeInTheDocument();
    expect(screen.getByText(/status: active/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i)).toBeDisabled();
  });

  it("pulls the kill switch after confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    await screen.findByRole("heading", { name: "Support Triage Agent" });

    await user.click(screen.getByRole("button", { name: /pull kill switch/i }));

    expect(updateAgent).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ active: false, name: "Support Triage Agent" }),
    );
  });

  it("does not toggle the kill switch when the confirmation is declined", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPage();
    await screen.findByRole("heading", { name: "Support Triage Agent" });

    await user.click(screen.getByRole("button", { name: /pull kill switch/i }));
    expect(updateAgent).not.toHaveBeenCalled();
  });

  it(
    "navigates away immediately and deletes the agent once the undo window elapses",
    async () => {
      const user = userEvent.setup();
      vi.spyOn(window, "confirm").mockReturnValue(true);
      renderPage();
      await screen.findByRole("heading", { name: "Support Triage Agent" });

      await user.click(screen.getByRole("button", { name: /delete agent/i }));
      expect(await screen.findByText("All agents")).toBeInTheDocument();
      expect(deleteAgent).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 5200));
      expect(deleteAgent).toHaveBeenCalledWith(1);
    },
    10000,
  );
});
