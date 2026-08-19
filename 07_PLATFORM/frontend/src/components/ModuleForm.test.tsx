import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModuleForm } from "./ModuleForm";

describe("ModuleForm", () => {
  it("submits the entered values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ModuleForm submitLabel="Add module" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/title/i), "New module");
    await user.type(screen.getByLabelText(/learning outcome/i), "Do the thing");
    await user.clear(screen.getByLabelText(/estimated hours/i));
    await user.type(screen.getByLabelText(/estimated hours/i), "6");
    await user.click(screen.getByRole("button", { name: /add module/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: "New module",
      learning_outcome: "Do the thing",
      estimated_hours: 6,
      assessment: "Quiz + Lab + Evidence",
    });
  });

  it("pre-fills from initialValues and calls onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ModuleForm
        submitLabel="Save"
        initialValues={{
          title: "Existing",
          learning_outcome: "Outcome",
          estimated_hours: 4,
          assessment: "Quiz",
        }}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByLabelText(/title/i)).toHaveValue("Existing");
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
