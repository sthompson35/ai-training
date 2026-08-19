import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UsersPage } from "./UsersPage";
import { ToastProvider } from "../components/ToastProvider";

const { listUsers, createUser, updateUserRole, deleteUser, resetUserPassword, bulkDeleteUsers, bulkUpdateUserRole } =
  vi.hoisted(() => ({
    listUsers: vi.fn(),
    createUser: vi.fn(),
    updateUserRole: vi.fn(),
    deleteUser: vi.fn(),
    resetUserPassword: vi.fn(),
    bulkDeleteUsers: vi.fn(),
    bulkUpdateUserRole: vi.fn(),
  }));
vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    listUsers,
    createUser,
    updateUserRole,
    deleteUser,
    resetUserPassword,
    bulkDeleteUsers,
    bulkUpdateUserRole,
    getStoredUsername: () => "admin",
  };
});

const fixtureUsers = [
  { id: 1, username: "admin", role: "admin", created_at: "2026-01-01T00:00:00Z" },
  { id: 2, username: "contributor", role: "contributor", created_at: "2026-01-02T00:00:00Z" },
];

function renderPage() {
  return render(
    <ToastProvider>
      <UsersPage />
    </ToastProvider>,
  );
}

beforeEach(() => {
  listUsers.mockReset().mockResolvedValue(fixtureUsers);
  bulkUpdateUserRole.mockReset().mockResolvedValue({ updated: 2, skipped: [] });
});

describe("UsersPage", () => {
  it("renders seeded users", async () => {
    renderPage();
    expect(await screen.findByText("admin (you)")).toBeInTheDocument();
    expect(screen.getAllByText("contributor").length).toBeGreaterThan(0);
  });

  it("bulk-updates the role of selected users after confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    await screen.findByText("admin (you)");

    await user.click(screen.getByLabelText("Select admin"));
    await user.click(screen.getByLabelText("Select contributor"));

    await user.selectOptions(screen.getByLabelText("Bulk set role"), "contributor");
    await user.click(screen.getByRole("button", { name: /set role \(2\)/i }));

    expect(window.confirm).toHaveBeenCalledWith('Set role to "contributor" for 2 selected item(s)?');
    expect(bulkUpdateUserRole).toHaveBeenCalledWith([1, 2], "contributor");
    expect(await screen.findByText("Updated 2, skipped 0.")).toBeInTheDocument();
  });

  it("does not call the API when the bulk-edit confirmation is declined", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPage();
    await screen.findByText("admin (you)");

    await user.click(screen.getByLabelText("Select contributor"));
    await user.click(screen.getByRole("button", { name: /set role \(1\)/i }));

    expect(bulkUpdateUserRole).not.toHaveBeenCalled();
  });
});
