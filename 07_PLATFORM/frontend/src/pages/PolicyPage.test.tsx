import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PolicyPage } from "./PolicyPage";
import { ToastProvider } from "../components/ToastProvider";

const { listApprovals, approveApproval, rejectApproval, getPolicyConfig } = vi.hoisted(() => ({
  listApprovals: vi.fn(),
  approveApproval: vi.fn(),
  rejectApproval: vi.fn(),
  getPolicyConfig: vi.fn(),
}));
vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    listApprovals,
    approveApproval,
    rejectApproval,
    getPolicyConfig,
  };
});

const fixtureApproval = {
  id: 42,
  task_type: "research",
  route: "server",
  risk_tier: 4,
  input_chars: 2000,
  reason: "Current external information requires server-side tools or retrieval.",
  status: "pending",
  requested_at: "2026-08-01T00:00:00Z",
  decided_at: null,
  decided_by: null,
  decision_note: null,
};

function renderPage() {
  return render(
    <ToastProvider>
      <PolicyPage />
    </ToastProvider>,
  );
}

beforeEach(() => {
  listApprovals.mockReset().mockResolvedValue({ items: [fixtureApproval], total: 1 });
  getPolicyConfig.mockReset().mockResolvedValue({ approval_tier: 2, cost_per_1k_chars_usd: 0.002 });
  approveApproval.mockReset().mockResolvedValue({ ...fixtureApproval, status: "approved" });
  rejectApproval.mockReset().mockResolvedValue({ ...fixtureApproval, status: "rejected" });
});

describe("PolicyPage", () => {
  it("renders pending approval requests and the active policy config", async () => {
    renderPage();
    expect(await screen.findByText("research")).toBeInTheDocument();
    expect(screen.getByText(/risk tier ≥ 2/i)).toBeInTheDocument();
    expect(listApprovals).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending" }),
    );
  });

  it("approves a pending request", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue(null);
    renderPage();
    await screen.findByText("research");

    await user.click(screen.getByRole("button", { name: /approve/i }));

    expect(approveApproval).toHaveBeenCalledWith(42, undefined);
    expect(await screen.findByText("Request approved.")).toBeInTheDocument();
  });

  it("rejects a pending request", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue(null);
    renderPage();
    await screen.findByText("research");

    await user.click(screen.getByRole("button", { name: /reject/i }));

    expect(rejectApproval).toHaveBeenCalledWith(42, undefined);
    expect(await screen.findByText("Request rejected.")).toBeInTheDocument();
  });

  it("shows an empty state when there are no matching approval requests", async () => {
    listApprovals.mockResolvedValue({ items: [], total: 0 });
    renderPage();
    expect(await screen.findByText(/no approval requests/i)).toBeInTheDocument();
  });
});
