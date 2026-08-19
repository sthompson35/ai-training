import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ReleasesPage } from "./ReleasesPage";
import { ToastProvider } from "../components/ToastProvider";

const { listReleases } = vi.hoisted(() => ({ listReleases: vi.fn() }));
vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return { ...actual, listReleases };
});

const fixtureRelease = {
  id: 1,
  title: "Add refusal instruction",
  version: "2.1.0",
  status: "proposed",
  risk_tier: 2,
  approver: "ai-architect",
  release_date: "2026-02-01",
};

beforeEach(() => {
  listReleases.mockReset().mockResolvedValue({ items: [fixtureRelease], total: 1 });
});

describe("ReleasesPage", () => {
  it("renders releases with a link to their detail page", async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <ReleasesPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("link", { name: /Add refusal instruction/ })).toHaveAttribute(
      "href",
      "/releases/1",
    );
    expect(screen.getByText(/approver: ai-architect/)).toBeInTheDocument();
  });

  it("shows an empty state with no releases", async () => {
    listReleases.mockResolvedValue({ items: [], total: 0 });
    render(
      <MemoryRouter>
        <ToastProvider>
          <ReleasesPage />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/no releases logged yet/i)).toBeInTheDocument();
  });

  it("re-queries when the status filter changes", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <ReleasesPage />
        </ToastProvider>
      </MemoryRouter>,
    );
    await screen.findByRole("link", { name: /Add refusal instruction/ });

    await user.selectOptions(screen.getByLabelText(/^status:/i), "released");
    expect(listReleases).toHaveBeenLastCalledWith({
      status: "released",
      q: undefined,
      limit: 20,
      offset: 0,
    });
  });

  it("shows pagination controls and paginates with Next", async () => {
    listReleases.mockResolvedValue({ items: [fixtureRelease], total: 25 });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <ReleasesPage />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/showing 1–20 of 25/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(listReleases).toHaveBeenLastCalledWith({
      status: undefined,
      q: undefined,
      limit: 20,
      offset: 20,
    });
  });
});
