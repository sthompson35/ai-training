import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "./LoginPage";
import { ToastProvider } from "../components/ToastProvider";

const { login } = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock("../lib/api", () => ({ login }));

describe("LoginPage", () => {
  it("logs in with the entered credentials", async () => {
    const user = userEvent.setup();
    login.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ToastProvider>
          <LoginPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/username/i), "admin");
    await user.type(screen.getByLabelText(/password/i), "admin");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(login).toHaveBeenCalledWith("admin", "admin");
  });

  it("shows an error message when login fails", async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(new Error("Invalid username or password"));

    render(
      <MemoryRouter>
        <ToastProvider>
          <LoginPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/username/i), "admin");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password");
  });

  it("shows a session-expired message when reason=expired is in the URL", () => {
    render(
      <MemoryRouter initialEntries={["/login?reason=expired"]}>
        <ToastProvider>
          <LoginPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/your session expired/i)).toBeInTheDocument();
  });

  it("does not show a session-expired message on a plain visit", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <ToastProvider>
          <LoginPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByText(/your session expired/i)).not.toBeInTheDocument();
  });

  it("returns to the next path after logging in", async () => {
    const user = userEvent.setup();
    login.mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/login?next=%2Fincidents%2F42"]}>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/incidents/:id" element={<div>Incident detail page</div>} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/username/i), "admin");
    await user.type(screen.getByLabelText(/password/i), "admin");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByText("Incident detail page")).toBeInTheDocument();
  });
});
