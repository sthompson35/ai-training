import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./ToastProvider";

function TestConsumer({ onUndo }: { onUndo?: () => void } = {}) {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.success("Saved successfully.")}>Trigger success</button>
      <button onClick={() => toast.error("Something broke.")}>Trigger error</button>
      <button onClick={() => toast.success("Lab deleted.", { label: "Undo", onClick: onUndo ?? (() => {}) })}>
        Trigger undoable success
      </button>
    </>
  );
}

function renderConsumer(onUndo?: () => void) {
  return render(
    <ToastProvider>
      <TestConsumer onUndo={onUndo} />
    </ToastProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("ToastProvider", () => {
  it("renders a success toast with role=status", () => {
    renderConsumer();
    fireEvent.click(screen.getByText("Trigger success"));

    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("Saved successfully.");
  });

  it("renders an error toast with role=alert", () => {
    renderConsumer();
    fireEvent.click(screen.getByText("Trigger error"));

    const toast = screen.getByRole("alert");
    expect(toast).toHaveTextContent("Something broke.");
  });

  it("stacks multiple toasts at once", () => {
    renderConsumer();
    fireEvent.click(screen.getByText("Trigger success"));
    fireEvent.click(screen.getByText("Trigger error"));

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("auto-dismisses a toast after the timeout", () => {
    vi.useFakeTimers();
    renderConsumer();
    fireEvent.click(screen.getByText("Trigger success"));

    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("dismisses a toast immediately when its close button is clicked", async () => {
    const user = userEvent.setup();
    renderConsumer();
    await user.click(screen.getByText("Trigger error"));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Dismiss"));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders an action button and calls onClick, dismissing the toast immediately", async () => {
    const onUndo = vi.fn();
    const user = userEvent.setup();
    renderConsumer(onUndo);

    await user.click(screen.getByText("Trigger undoable success"));
    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("Lab deleted.");

    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
