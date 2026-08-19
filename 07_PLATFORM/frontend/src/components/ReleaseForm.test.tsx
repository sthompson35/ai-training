import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReleaseForm } from "./ReleaseForm";

describe("ReleaseForm", () => {
  it("defaults to risk tier 1 and status proposed", () => {
    render(<ReleaseForm submitLabel="Log release" onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/risk tier/i)).toHaveValue("1");
    expect(screen.getByLabelText(/^status$/i)).toHaveValue("proposed");
  });

  it("submits a fully filled-out release", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ReleaseForm submitLabel="Log release" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/title/i), "Add refusal instruction");
    await user.type(screen.getByLabelText(/version/i), "2.1.0");
    await user.selectOptions(screen.getByLabelText(/^status$/i), "approved");
    await user.type(screen.getByLabelText(/approver/i), "ai-architect");
    await user.type(screen.getByLabelText(/release date/i), "2026-02-01");
    await user.type(screen.getByLabelText(/rationale/i), "Prevent hallucinated approvals");
    await user.type(screen.getByLabelText(/expected impact/i), "Fewer incorrect statements");
    await user.type(screen.getByLabelText(/test evidence/i), "Regression suite passing");
    await user.type(screen.getByLabelText(/rollback target/i), "prompt v2.0.3");
    await user.click(screen.getByRole("button", { name: /log release/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.title).toBe("Add refusal instruction");
    expect(payload.version).toBe("2.1.0");
    expect(payload.status).toBe("approved");
  });
});
