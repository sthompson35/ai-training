import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ReleaseDetailPage } from "./ReleaseDetailPage";
import { ToastProvider } from "../components/ToastProvider";

const { getRelease, createRelease, updateRelease, deleteRelease, listIncidents } = vi.hoisted(() => ({
  getRelease: vi.fn(),
  createRelease: vi.fn(),
  updateRelease: vi.fn(),
  deleteRelease: vi.fn(),
  listIncidents: vi.fn(),
}));
vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return { ...actual, getRelease, createRelease, updateRelease, deleteRelease, listIncidents };
});

const fixtureRelease = {
  id: 1,
  title: "Add refusal instruction",
  version: "2.1.0",
  rationale: "Prevent hallucinated approvals",
  expected_impact: "Fewer incorrect statements",
  test_evidence: "Regression suite passing",
  approver: "ai-architect",
  risk_tier: 2,
  release_date: "2026-02-01",
  rollback_target: "prompt v2.0.3",
  status: "proposed",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/releases/1"]}>
      <ToastProvider>
        <Routes>
          <Route path="/releases" element={<p>All releases</p>} />
          <Route path="/releases/:releaseId" element={<ReleaseDetailPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getRelease.mockReset().mockResolvedValue(fixtureRelease);
  updateRelease.mockReset().mockResolvedValue(fixtureRelease);
  deleteRelease.mockReset().mockResolvedValue(undefined);
  listIncidents.mockReset().mockResolvedValue({ items: [], total: 0 });
});

describe("ReleaseDetailPage", () => {
  it("renders the release and its form", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Add refusal instruction" })).toBeInTheDocument();
    expect(screen.getByLabelText(/approver/i)).toHaveValue("ai-architect");
  });

  it("shows an empty state when no incidents are linked", async () => {
    renderPage();
    expect(await screen.findByText(/no incidents linked to this release/i)).toBeInTheDocument();
  });

  it("renders linked incidents with their status and CAPA status", async () => {
    listIncidents.mockResolvedValue({
      items: [
        { id: 7, title: "Regression after refusal instruction release", status: "investigating", capa_status: "in_progress" },
      ],
      total: 1,
    });
    renderPage();

    expect(
      await screen.findByRole("link", { name: /Regression after refusal instruction release/ }),
    ).toHaveAttribute("href", "/incidents/7");
    expect(screen.getByText(/investigating/)).toBeInTheDocument();
    expect(screen.getByText(/CAPA: in_progress/)).toBeInTheDocument();
    expect(listIncidents).toHaveBeenCalledWith({ releaseId: 1, limit: 100 });
  });

  it("saves an update", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Add refusal instruction" });

    await user.selectOptions(screen.getByLabelText(/^status$/i), "released");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(updateRelease).toHaveBeenCalledWith(1, expect.objectContaining({ status: "released" }));
  });

  it(
    "navigates away immediately and deletes the release once the undo window elapses",
    async () => {
      const user = userEvent.setup();
      vi.spyOn(window, "confirm").mockReturnValue(true);
      renderPage();
      await screen.findByRole("heading", { name: "Add refusal instruction" });

      await user.click(screen.getByRole("button", { name: /delete release/i }));
      expect(await screen.findByText("All releases")).toBeInTheDocument();
      expect(deleteRelease).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 5200));
      expect(deleteRelease).toHaveBeenCalledWith(1);
    },
    10000,
  );
});
