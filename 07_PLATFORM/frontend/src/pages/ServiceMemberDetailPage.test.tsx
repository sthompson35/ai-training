import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ServiceMemberDetailPage } from "./ServiceMemberDetailPage";
import { ToastProvider } from "../components/ToastProvider";

const {
  getServiceMember,
  getRoleHistory,
  getVerifications,
  getLifecycleHistory,
  verifyIdentity,
  deactivateServiceMember,
  reactivateServiceMember,
  dischargeServiceMember,
} = vi.hoisted(() => ({
  getServiceMember: vi.fn(),
  getRoleHistory: vi.fn(),
  getVerifications: vi.fn(),
  getLifecycleHistory: vi.fn(),
  verifyIdentity: vi.fn(),
  deactivateServiceMember: vi.fn(),
  reactivateServiceMember: vi.fn(),
  dischargeServiceMember: vi.fn(),
}));
vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    getServiceMember,
    getRoleHistory,
    getVerifications,
    getLifecycleHistory,
    verifyIdentity,
    deactivateServiceMember,
    reactivateServiceMember,
    dischargeServiceMember,
  };
});

const fixtureMember = {
  service_member_id: "SM-1",
  callsign_id: "CS-1",
  callsign: "@VICTOR",
  display_name: "Victor Trooper",
  member_class: "human_trooper" as const,
  command_layer: "field_operations" as const,
  current_role: "Operator",
  role_version: 1,
  lifecycle_state: "active" as const,
  readiness_state: "ready" as const,
  production_verification_state: "unverified" as const,
  created_by_service_member_id: "SM-0",
  legacy_alias: null,
  source_lineage: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const fixtureVerification = {
  id: 1,
  service_member_id: "SM-1",
  evidence_reference: "Background check #123",
  verification_method: "document review",
  outcome: "verified" as const,
  verifier_service_member_id: "SM-9",
  notes: null,
  verified_at: "2026-01-02T00:00:00Z",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/service-members/SM-1"]}>
      <ToastProvider>
        <Routes>
          <Route path="/service-members" element={<p>All service members</p>} />
          <Route path="/service-members/:serviceMemberId" element={<ServiceMemberDetailPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getServiceMember.mockReset().mockResolvedValue(fixtureMember);
  getRoleHistory.mockReset().mockResolvedValue([]);
  getVerifications.mockReset().mockResolvedValue([]);
  getLifecycleHistory.mockReset().mockResolvedValue([]);
  verifyIdentity.mockReset().mockResolvedValue({ ...fixtureVerification, outcome: "verified" });
  deactivateServiceMember.mockReset();
  reactivateServiceMember.mockReset();
  dischargeServiceMember.mockReset();
});

describe("ServiceMemberDetailPage verification workflow", () => {
  it("does not show production_verification_state as an editable field", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Victor Trooper" });
    expect(screen.queryByLabelText(/production verification state/i)).not.toBeInTheDocument();
    expect(screen.getByText(/current state: unverified/i)).toBeInTheDocument();
  });

  it("submits the record-verification form and shows the returned outcome", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Victor Trooper" });

    await user.click(screen.getByRole("button", { name: /record verification/i }));
    await user.type(screen.getByLabelText(/evidence reference/i), "Background check #123");
    await user.type(screen.getByLabelText(/verification method/i), "document review");
    await user.selectOptions(screen.getByLabelText(/outcome/i), "verified");
    await user.click(screen.getByRole("button", { name: /submit verification/i }));

    expect(verifyIdentity).toHaveBeenCalledWith(
      "SM-1",
      expect.objectContaining({
        evidence_reference: "Background check #123",
        verification_method: "document review",
        outcome: "verified",
      }),
    );
    expect(await screen.findByText(/verification recorded — outcome: verified/i)).toBeInTheDocument();
  });
});

describe("ServiceMemberDetailPage lifecycle workflow", () => {
  it("does not show lifecycle_state as an editable field in the edit form", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Victor Trooper" });
    expect(screen.queryByLabelText(/^lifecycle state$/i)).not.toBeInTheDocument();
  });

  it("requires a reason before enabling deactivate, and calls deactivateServiceMember with it", async () => {
    const user = userEvent.setup();
    deactivateServiceMember.mockResolvedValue({
      id: 1,
      service_member_id: "SM-1",
      from_state: "active",
      to_state: "inactive",
      reason: "Extended leave",
      changed_by: null,
      effective_at: "2026-01-03T00:00:00Z",
    });
    renderPage();
    await screen.findByRole("heading", { name: "Victor Trooper" });

    const deactivateButton = screen.getByRole("button", { name: /^deactivate$/i });
    expect(deactivateButton).toBeDisabled();

    await user.type(screen.getByLabelText(/reason \(required for any transition/i), "Extended leave");
    expect(deactivateButton).toBeEnabled();

    await user.click(deactivateButton);
    expect(deactivateServiceMember).toHaveBeenCalledWith("SM-1", { reason: "Extended leave" });
    expect(await screen.findByText(/identity deactivated/i)).toBeInTheDocument();
  });

  it("shows discharged as terminal with no further transition buttons", async () => {
    getServiceMember.mockResolvedValue({ ...fixtureMember, lifecycle_state: "discharged" });
    renderPage();
    await screen.findByRole("heading", { name: "Victor Trooper" });

    expect(screen.getByText(/discharged is terminal/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reactivate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /discharge/i })).not.toBeInTheDocument();
  });
});
