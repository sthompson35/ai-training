import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { GlobalSearch } from "./GlobalSearch";

const { searchAll } = vi.hoisted(() => ({ searchAll: vi.fn() }));
vi.mock("../lib/api", () => ({ searchAll }));

const fixtureResults = [
  { type: "learner", id: "5", title: "Ada Lovelace", subtitle: "ada@example.com", path: "/learners/5" },
  { type: "incident", id: "9", title: "Gateway outage", subtitle: "high / detected", path: "/incidents/9" },
];

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route
          path="/"
          element={
            <div>
              <button type="button">Elsewhere</button>
              <GlobalSearch />
            </div>
          }
        />
        <Route path="/learners/:id" element={<div>Learner detail page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  searchAll.mockReset().mockResolvedValue(fixtureResults);
});

describe("GlobalSearch", () => {
  it("does not search until the query is at least two characters", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.type(screen.getByLabelText("Search"), "z");
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(searchAll).not.toHaveBeenCalled();
  });

  it("searches and renders grouped results after typing two or more characters", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.type(screen.getByLabelText("Search"), "ada");

    await waitFor(() => expect(searchAll).toHaveBeenCalledWith("ada"), { timeout: 2000 });
    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Gateway outage")).toBeInTheDocument();
    expect(screen.getByText("Learners")).toBeInTheDocument();
    expect(screen.getByText("Incidents")).toBeInTheDocument();
  });

  it("navigates to a result's path when clicked and clears the query", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    const input = screen.getByLabelText("Search");
    await user.type(input, "ada");
    const result = await screen.findByText("Ada Lovelace");
    await user.click(result);

    expect(await screen.findByText("Learner detail page")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("closes the dropdown when Escape is pressed", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    const input = screen.getByLabelText("Search");
    await user.type(input, "ada");
    await screen.findByText("Ada Lovelace");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument());
  });

  it("moves the active-descendant highlight through results with the arrow keys", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    const input = screen.getByLabelText("Search");
    await user.type(input, "ada");
    await screen.findByText("Ada Lovelace");

    expect(input).not.toHaveAttribute("aria-activedescendant");

    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", "search-result-learner-5");

    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", "search-result-incident-9");

    // Clamps at the last result rather than wrapping.
    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", "search-result-incident-9");

    await user.keyboard("{ArrowUp}");
    expect(input).toHaveAttribute("aria-activedescendant", "search-result-learner-5");
  });

  it("selects the active result and navigates when Enter is pressed", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    const input = screen.getByLabelText("Search");
    await user.type(input, "ada");
    await screen.findByText("Ada Lovelace");

    await user.keyboard("{ArrowDown}{Enter}");

    expect(await screen.findByText("Learner detail page")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("shows a no-results message when nothing matches", async () => {
    searchAll.mockResolvedValue([]);
    const user = userEvent.setup();
    renderWithRouter();

    await user.type(screen.getByLabelText("Search"), "nothing");

    expect(await screen.findByText("No results")).toBeInTheDocument();
  });

  it("focuses the search input on Ctrl+K from anywhere in the app", () => {
    renderWithRouter();
    screen.getByRole("button", { name: "Elsewhere" }).focus();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(document.activeElement).toBe(screen.getByLabelText("Search"));
  });

  it("focuses the search input on Cmd+K from anywhere in the app", () => {
    renderWithRouter();
    screen.getByRole("button", { name: "Elsewhere" }).focus();

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(document.activeElement).toBe(screen.getByLabelText("Search"));
  });

  it("does not steal focus for a plain 'k' keypress with no modifier", () => {
    renderWithRouter();
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    elsewhere.focus();

    fireEvent.keyDown(window, { key: "k" });

    expect(document.activeElement).toBe(elsewhere);
  });
});
