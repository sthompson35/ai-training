import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IncidentForm } from "./IncidentForm";

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    listAgents: vi.fn().mockResolvedValue({ items: [{ id: 1, name: "Support Triage Agent" }], total: 1 }),
    listReleases: vi.fn().mockResolvedValue({
      items: [{ id: 1, title: "Add refusal instruction", version: "2.1.0" }],
      total: 1,
    }),
  };
});

describe("IncidentForm", () => {
  it("defaults to medium severity, detected status, and no linked agent", () => {
    render(<IncidentForm submitLabel="Log incident" onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/severity/i)).toHaveValue("medium");
    expect(screen.getByLabelText(/^status$/i)).toHaveValue("detected");
    expect(screen.getByLabelText(/linked agent/i)).toHaveValue("");
  });

  it("loads agents and submits with a linked agent", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<IncidentForm submitLabel="Log incident" onSubmit={onSubmit} />);

    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Support Triage Agent" })).toBeInTheDocument(),
    );

    await user.type(screen.getByLabelText(/title/i), "Agent gave incorrect refund info");
    await user.selectOptions(screen.getByLabelText(/linked agent/i), "1");
    await user.type(screen.getByLabelText(/^owner$/i), "support-eng");
    await user.type(screen.getByLabelText(/description/i), "What happened");
    await user.type(screen.getByLabelText(/impact/i), "One customer affected");
    await user.click(screen.getByRole("button", { name: /log incident/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.title).toBe("Agent gave incorrect refund info");
    expect(payload.agent_id).toBe(1);
    expect(payload.severity).toBe("medium");
  });

  it("loads releases and submits with a linked release and CAPA status", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<IncidentForm submitLabel="Log incident" onSubmit={onSubmit} />);

    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Add refusal instruction (2.1.0)" })).toBeInTheDocument(),
    );

    await user.type(screen.getByLabelText(/title/i), "Regression after refusal instruction release");
    await user.selectOptions(screen.getByLabelText(/linked release/i), "1");
    await user.selectOptions(screen.getByLabelText(/capa status/i), "in_progress");
    await user.type(screen.getByLabelText(/^owner$/i), "support-eng");
    await user.type(screen.getByLabelText(/description/i), "What happened");
    await user.type(screen.getByLabelText(/impact/i), "One customer affected");
    await user.click(screen.getByRole("button", { name: /log incident/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.release_id).toBe(1);
    expect(payload.capa_status).toBe("in_progress");
  });
});
