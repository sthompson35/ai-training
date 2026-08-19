import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnrollmentForm } from "./EnrollmentForm";

describe("EnrollmentForm", () => {
  it("defaults to status enrolled with null score/notes", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<EnrollmentForm onSubmit={onSubmit} />);

    expect(screen.getByLabelText(/status/i)).toHaveValue("enrolled");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith({ status: "enrolled", written_score: null, notes: null });
  });

  it("updates status, score, and notes before submitting", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<EnrollmentForm onSubmit={onSubmit} />);

    await user.selectOptions(screen.getByLabelText(/status/i), "certified");
    await user.type(screen.getByLabelText(/written score/i), "92");
    await user.type(screen.getByLabelText(/notes/i), "Board approved");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      status: "certified",
      written_score: 92,
      notes: "Board approved",
    });
  });
});
