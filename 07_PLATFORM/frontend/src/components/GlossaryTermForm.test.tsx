import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GlossaryTermForm } from "./GlossaryTermForm";

describe("GlossaryTermForm", () => {
  it("submits a new term", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<GlossaryTermForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/term/i), "RAG");
    await user.type(screen.getByLabelText(/definition/i), "Retrieval-augmented generation.");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      term: "RAG",
      definition: "Retrieval-augmented generation.",
    });
  });

  it("disables the term field when editing an existing term", () => {
    render(
      <GlossaryTermForm
        initialValues={{ term: "Agent", definition: "A bounded system." }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/term/i)).toBeDisabled();
    expect(screen.getByLabelText(/term/i)).toHaveValue("Agent");
  });
});
