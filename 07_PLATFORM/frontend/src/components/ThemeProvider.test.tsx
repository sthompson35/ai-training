import { describe, expect, it, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme } from "./ThemeProvider";

function TestConsumer() {
  const { theme, toggleTheme } = useTheme();
  return (
    <>
      <span>Current theme: {theme}</span>
      <button onClick={toggleTheme}>Toggle</button>
    </>
  );
}

function renderConsumer() {
  return render(
    <ThemeProvider>
      <TestConsumer />
    </ThemeProvider>,
  );
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeProvider", () => {
  it("defaults to light and sets data-theme on the document element", () => {
    renderConsumer();
    expect(screen.getByText("Current theme: light")).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("toggles the theme and persists it to localStorage", async () => {
    const user = userEvent.setup();
    renderConsumer();

    await user.click(screen.getByRole("button", { name: "Toggle" }));

    expect(screen.getByText("Current theme: dark")).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("academy_theme")).toBe("dark");
  });

  it("respects a previously stored theme on mount", () => {
    localStorage.setItem("academy_theme", "dark");
    renderConsumer();

    expect(screen.getByText("Current theme: dark")).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("throws when useTheme is called outside a ThemeProvider", () => {
    function Unwrapped() {
      useTheme();
      return null;
    }
    expect(() => render(<Unwrapped />)).toThrow("useTheme must be used within a ThemeProvider");
  });
});
