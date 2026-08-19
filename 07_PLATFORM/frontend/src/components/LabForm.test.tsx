import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LabForm } from "./LabForm";

describe("LabForm", () => {
  it("submits the entered values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LabForm submitLabel="Add lab" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/title/i), "New lab");
    await user.type(screen.getByLabelText(/domain/i), "Agents");
    await user.type(screen.getByLabelText(/deliverable/i), "A working demo");
    await user.click(screen.getByRole("button", { name: /add lab/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: "New lab",
      domain: "Agents",
      deliverable: "A working demo",
    });
  });

  it("does not render a cancel button when onCancel is omitted", () => {
    render(<LabForm submitLabel="Add lab" onSubmit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
  });
});
