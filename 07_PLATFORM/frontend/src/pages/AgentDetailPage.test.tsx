import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AgentDetailPage } from "./AgentDetailPage";
import { ToastProvider } from "../components/ToastProvider";

const { getAgent, createAgent, updateAgent, deleteAgent, executeAgent } = vi.hoisted(() => ({
  getAgent: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
  executeAgent: vi.fn(),
}));
vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return { ...actual, getAgent, createAgent, updateAgent, deleteAgent, executeAgent };
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
  system_prompt: null,
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
  executeAgent.mockReset();
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

  it("runs the agent and displays the real output", async () => {
    const user = userEvent.setup();
    executeAgent.mockResolvedValue({
      status: "completed",
      output: "Ticket triaged: low priority.",
      model: "gpt-mini",
      prompt_tokens: 12,
      completion_tokens: 6,
      estimated_cost_usd: 0.000036,
      approval_request_id: null,
      reason: null,
    });
    renderPage();
    await screen.findByRole("heading", { name: "Support Triage Agent" });

    await user.type(screen.getByLabelText(/^prompt$/i), "Triage this ticket");
    await user.click(screen.getByRole("button", { name: /^run$/i }));

    expect(executeAgent).toHaveBeenCalledWith(1, {
      prompt: "Triage this ticket",
      model: undefined,
      approval_request_id: undefined,
    });
    expect(await screen.findByText("Ticket triaged: low priority.")).toBeInTheDocument();
  });

  it("shows a pending-approval message with a retry action when gated", async () => {
    const user = userEvent.setup();
    executeAgent.mockResolvedValueOnce({
      status: "pending_approval",
      output: null,
      model: null,
      prompt_tokens: null,
      completion_tokens: null,
      estimated_cost_usd: 0,
      approval_request_id: 42,
      reason: "Agent risk_tier 2 requires human approval before executing.",
    });
    renderPage();
    await screen.findByRole("heading", { name: "Support Triage Agent" });

    await user.type(screen.getByLabelText(/^prompt$/i), "Do something risky");
    await user.click(screen.getByRole("button", { name: /^run$/i }));

    expect(await screen.findByText(/review in the approval queue/i)).toBeInTheDocument();
    expect(screen.getByText(/requires human approval/i)).toBeInTheDocument();

    executeAgent.mockResolvedValueOnce({
      status: "completed",
      output: "done",
      model: "gpt-mini",
      prompt_tokens: 1,
      completion_tokens: 1,
      estimated_cost_usd: 0.000001,
      approval_request_id: null,
      reason: null,
    });
    await user.click(screen.getByRole("button", { name: /retry now/i }));
    expect(executeAgent).toHaveBeenLastCalledWith(1, {
      prompt: "Do something risky",
      model: undefined,
      approval_request_id: 42,
    });
  });

  it("disables the execute form when the kill switch is engaged", async () => {
    getAgent.mockResolvedValue({ ...fixtureAgent, active: false });
    renderPage();
    await screen.findByRole("heading", { name: "Support Triage Agent" });

    expect(screen.getByText(/kill switch is engaged/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^prompt$/i)).not.toBeInTheDocument();
  });
});
