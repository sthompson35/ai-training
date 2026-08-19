import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KBArticleForm } from "./KBArticleForm";

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    listLevels: vi.fn().mockResolvedValue([{ id: "08", title: "Knowledge Systems and RAG" }]),
  };
});

async function fillRequiredTextFields(user: ReturnType<typeof userEvent.setup>) {
  const labels = [
    /^definition$/i,
    /why it matters/i,
    /when to use/i,
    /when not to use/i,
    /architecture/i,
    /inputs and outputs/i,
    /risks and controls/i,
    /examples/i,
    /evaluation criteria/i,
    /sources/i,
  ];
  for (const label of labels) {
    await user.type(screen.getByLabelText(label), "content");
  }
}

describe("KBArticleForm", () => {
  it("loads domain options from listLevels and submits a full article", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<KBArticleForm submitLabel="Create article" onSubmit={onSubmit} />);

    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Knowledge Systems and RAG" })).toBeInTheDocument(),
    );

    await user.type(screen.getByLabelText(/title/i), "Grounded generation basics");
    await user.selectOptions(screen.getByLabelText(/domain/i), "Knowledge Systems and RAG");
    await user.type(screen.getByLabelText(/owner/i), "kb-team");
    await user.type(screen.getByLabelText(/review date/i), "2026-06-01");
    await fillRequiredTextFields(user);

    await user.click(screen.getByRole("button", { name: /create article/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.title).toBe("Grounded generation basics");
    expect(payload.domain).toBe("Knowledge Systems and RAG");
    expect(payload.owner).toBe("kb-team");
    expect(payload.definition).toBe("content");
  });
});
