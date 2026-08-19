import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentCardForm } from "./AgentCardForm";

async function fillRequiredTextFields(user: ReturnType<typeof userEvent.setup>) {
  const labels = [
    /^purpose$/i,
    /non-goals/i,
    /approved models/i,
    /approved tools/i,
    /data access/i,
    /action permissions/i,
    /approval requirements/i,
    /^budgets$/i,
    /^fallback$/i,
    /^monitoring$/i,
    /kill switch \(mechanism description\)/i,
    /evaluation set/i,
  ];
  for (const label of labels) {
    await user.type(screen.getByLabelText(label), "content");
  }
}

describe("AgentCardForm", () => {
  it("defaults to risk tier 1, draft status, and active", () => {
    render(<AgentCardForm submitLabel="Register agent" onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/risk tier/i)).toHaveValue("1");
    expect(screen.getByLabelText(/approval status/i)).toHaveValue("draft");
    expect(screen.getByLabelText(/active/i)).toBeChecked();
  });

  it("submits a fully filled-out card with the kill switch pulled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AgentCardForm submitLabel="Register agent" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^name$/i), "Support Triage Agent");
    await user.type(screen.getByLabelText(/^owner$/i), "support-eng");
    await user.type(screen.getByLabelText(/last review/i), "2026-01-01");
    await fillRequiredTextFields(user);
    await user.click(screen.getByLabelText(/active/i));
    await user.click(screen.getByRole("button", { name: /register agent/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.name).toBe("Support Triage Agent");
    expect(payload.active).toBe(false);
    expect(payload.risk_tier).toBe(1);
  });

  it("disables the name field when editing an existing agent", () => {
    render(
      <AgentCardForm
        submitLabel="Save changes"
        onSubmit={vi.fn()}
        initialValues={{
          name: "Existing Agent",
          owner: "eng",
          service_member_id: null,
          version: "1.0",
          purpose: "p",
          non_goals: "n",
          risk_tier: 2,
          approved_models: "m",
          approved_tools: "t",
          data_access: "d",
          action_permissions: "a",
          approval_requirements: "r",
          budgets: "b",
          fallback: "f",
          monitoring: "m",
          kill_switch: "k",
          active: true,
          approval_status: "approved",
          evaluation_set: "e",
          last_review: "2026-01-01",
        }}
      />,
    );

    expect(screen.getByLabelText(/^name$/i)).toBeDisabled();
  });
});
