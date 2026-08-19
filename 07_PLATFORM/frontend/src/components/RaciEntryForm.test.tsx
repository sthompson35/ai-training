import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RaciEntryForm } from "./RaciEntryForm";

describe("RaciEntryForm", () => {
  it("submits the entered values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RaciEntryForm submitLabel="Add entry" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/activity/i), "Technical labs");
    await user.type(screen.getByLabelText(/^role$/i), "AI Architect");
    await user.type(screen.getByLabelText(/responsibility/i), "A/R");
    await user.click(screen.getByRole("button", { name: /add entry/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      activity: "Technical labs",
      role: "AI Architect",
      responsibility: "A/R",
    });
  });

  it("pre-fills from initialValues", () => {
    render(
      <RaciEntryForm
        submitLabel="Save"
        initialValues={{ activity: "Source approval", role: "Academy Owner", responsibility: "A/R" }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/activity/i)).toHaveValue("Source approval");
    expect(screen.getByLabelText(/^role$/i)).toHaveValue("Academy Owner");
  });
});
