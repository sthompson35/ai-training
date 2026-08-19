import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "./HomePage";

const {
  listLevels,
  listModules,
  listLabs,
  listCertifications,
  listLearners,
  listEnrollments,
  listGlossary,
  listKBArticles,
  listAgents,
  listIncidents,
  listReleases,
  listRaciEntries,
  listAuditLog,
  getAnalytics,
  isAuthenticated,
  getStoredRole,
} = vi.hoisted(() => ({
  listLevels: vi.fn(),
  listModules: vi.fn(),
  listLabs: vi.fn(),
  listCertifications: vi.fn(),
  listLearners: vi.fn(),
  listEnrollments: vi.fn(),
  listGlossary: vi.fn(),
  listKBArticles: vi.fn(),
  listAgents: vi.fn(),
  listIncidents: vi.fn(),
  listReleases: vi.fn(),
  listRaciEntries: vi.fn(),
  listAuditLog: vi.fn(),
  getAnalytics: vi.fn(),
  isAuthenticated: vi.fn(),
  getStoredRole: vi.fn(),
}));

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    listLevels,
    listModules,
    listLabs,
    listCertifications,
    listLearners,
    listEnrollments,
    listGlossary,
    listKBArticles,
    listAgents,
    listIncidents,
    listReleases,
    listRaciEntries,
    listAuditLog,
    getAnalytics,
    isAuthenticated,
    getStoredRole,
  };
});

const emptyAnalytics = {
  modules_by_level: [],
  raci_by_responsibility: [],
  incidents_by_severity: [],
  incidents_by_status: [],
  releases_by_status: [],
  enrollments_by_status: [],
  cost_today_usd: 0,
  cost_daily_limit_usd: 25,
  cost_remaining_usd: 25,
  cost_last_7_days: [
    { date: "2026-07-30", cost_usd: 0 },
    { date: "2026-07-31", cost_usd: 0 },
    { date: "2026-08-01", cost_usd: 0 },
    { date: "2026-08-02", cost_usd: 0 },
    { date: "2026-08-03", cost_usd: 0 },
    { date: "2026-08-04", cost_usd: 0 },
    { date: "2026-08-05", cost_usd: 0.42 },
  ],
};

beforeEach(() => {
  listLevels.mockReset().mockResolvedValue([{ id: "L0" }, { id: "L1" }]);
  listModules.mockReset().mockResolvedValue([{ id: "M1" }]);
  listLabs.mockReset().mockResolvedValue([{ id: "LAB1" }]);
  listCertifications.mockReset().mockResolvedValue([{ code: "AFA" }]);
  listLearners.mockReset().mockResolvedValue({ items: [], total: 7 });
  listEnrollments.mockReset().mockResolvedValue([{ id: 1 }, { id: 2 }]);
  listGlossary.mockReset().mockResolvedValue([{ term: "RAG" }]);
  listKBArticles.mockReset().mockResolvedValue({ items: [], total: 4 });
  listAgents.mockReset().mockResolvedValue({ items: [], total: 3 });
  listIncidents.mockReset().mockResolvedValue({ items: [], total: 2 });
  listReleases.mockReset().mockResolvedValue({ items: [], total: 5 });
  listRaciEntries.mockReset().mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
  listAuditLog.mockReset().mockResolvedValue({ items: [], total: 0 });
  getAnalytics.mockReset().mockResolvedValue(emptyAnalytics);
  isAuthenticated.mockReset().mockReturnValue(false);
  getStoredRole.mockReset().mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HomePage", () => {
  it("renders the diagnostic and shows the route decision on success", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        route: "client",
        reason: "Sensitive, bounded task with local capability available.",
        degraded_mode: false,
        requires_human_approval: false,
        policy_version: "2.0.0",
      }),
    } as Response);

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /evaluate route/i }));

    expect(await screen.findByText(/"route": "client"/)).toBeInTheDocument();
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toMatch(/\/v1\/route$/);
    expect(init.method).toBe("POST");
  });

  it("shows a pending-approval banner with a link to the Policy page for admins", async () => {
    const user = userEvent.setup();
    getStoredRole.mockReturnValue("admin");
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        route: "pending_approval",
        reason: "Awaiting human approval before this request can proceed.",
        degraded_mode: false,
        requires_human_approval: true,
        policy_version: "2.0.0",
        estimated_cost_usd: 0,
        approval_request_id: 42,
      }),
    } as Response);

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /evaluate route/i }));

    expect(await screen.findByText(/requires human approval \(request #42\)/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review it on the policy page/i })).toHaveAttribute(
      "href",
      "/policy",
    );
  });

  it("shows an unavailable result when the request fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 503, json: async () => ({}) } as Response);

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /evaluate route/i }));

    expect(await screen.findByText(/"route": "unavailable"/)).toBeInTheDocument();
    expect(screen.getByText(/Request failed: 503/)).toBeInTheDocument();
  });

  it("renders dashboard tiles with live counts linking to their pages", async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/2 levels · 1 modules · 1 labs/)).toBeInTheDocument();
    expect(screen.getByText(/1 tiers · 7 learners · 2 enrollments/)).toBeInTheDocument();
    expect(screen.getByText(/1 glossary terms · 4 articles/)).toBeInTheDocument();
    expect(screen.getByText(/3 registered/)).toBeInTheDocument();
    expect(screen.getByText(/2 logged/)).toBeInTheDocument();
    expect(screen.getByText(/5 logged/)).toBeInTheDocument();
    expect(screen.getByText(/3 RACI entries/)).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /curriculum/i })).toHaveAttribute("href", "/levels");
    expect(screen.getByRole("link", { name: /incidents/i })).toHaveAttribute("href", "/incidents");
  });

  it("does not fetch or show recent activity when logged out", async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await screen.findByText(/2 levels/);
    expect(screen.queryByText(/recent activity/i)).not.toBeInTheDocument();
    expect(listAuditLog).not.toHaveBeenCalled();
  });

  it("shows recent activity when logged in", async () => {
    isAuthenticated.mockReturnValue(true);
    listAuditLog.mockResolvedValue({
      items: [
        {
          id: 1,
          timestamp: "2026-08-02T17:31:09.860Z",
          username: "admin",
          method: "POST",
          path: "/v1/users",
          status_code: 201,
        },
      ],
      total: 1,
    });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/recent activity/i)).toBeInTheDocument();
    expect(screen.getByText(/admin POST \/v1\/users \(201\)/)).toBeInTheDocument();
  });

  it("renders the analytics section with breakdown data", async () => {
    getAnalytics.mockResolvedValue({
      ...emptyAnalytics,
      modules_by_level: [{ label: "00", count: 2 }],
      raci_by_responsibility: [{ label: "A", count: 3 }],
      incidents_by_severity: [{ label: "high", count: 1 }],
    });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Modules by level")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getAllByText("No data yet.").length).toBeGreaterThan(0);
  });

  it("renders the cost summary and 7-day cost chart", async () => {
    getAnalytics.mockResolvedValue({
      ...emptyAnalytics,
      cost_today_usd: 0.42,
      cost_daily_limit_usd: 25,
      cost_remaining_usd: 24.58,
    });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Cost")).toBeInTheDocument();
    expect(
      screen.getByText("Today: $0.42 spent of $25.00 daily limit ($24.58 remaining)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Cost by day, USD (last 7 days)")).toBeInTheDocument();
    expect(screen.getByText("2026-08-05")).toBeInTheDocument();
  });
});
