import { afterEach, describe, expect, it } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./Layout";

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<div>Home content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("Layout", () => {
  it("shows Log in when logged out", () => {
    renderLayout();
    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
  });

  it("toggles dark mode via the theme button", async () => {
    const user = userEvent.setup();
    renderLayout();

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    await user.click(screen.getByRole("button", { name: "Dark mode" }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Light mode" })).toBeInTheDocument();
  });

  it("updates the nav when another tab logs in, without a local re-render trigger", () => {
    renderLayout();
    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();

    act(() => {
      localStorage.setItem("academy_token", "tok-cross-tab");
      localStorage.setItem("academy_username", "admin");
      localStorage.setItem("academy_role", "admin");
      window.dispatchEvent(new StorageEvent("storage", { key: "academy_token" }));
    });

    expect(screen.getByText(/logged in as admin/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });

  it("updates the nav when another tab logs out", () => {
    localStorage.setItem("academy_token", "tok-1");
    localStorage.setItem("academy_username", "admin");
    localStorage.setItem("academy_role", "admin");
    renderLayout();
    expect(screen.getByText(/logged in as admin/i)).toBeInTheDocument();

    act(() => {
      localStorage.removeItem("academy_token");
      localStorage.removeItem("academy_username");
      localStorage.removeItem("academy_role");
      window.dispatchEvent(new StorageEvent("storage", { key: "academy_token" }));
    });

    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
  });
});
