import React, { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IdentityPicker } from "./IdentityPicker";
import { ServiceMember } from "../lib/api";

const { resolveServiceMember } = vi.hoisted(() => ({ resolveServiceMember: vi.fn() }));

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return { ...actual, resolveServiceMember };
});

const member: ServiceMember = {
  service_member_id: "ATA-VICTOR-000",
  callsign_id: "VICTOR",
  callsign: "@VICTOR",
  display_name: "Victor",
  member_class: "human_trooper",
  command_layer: "command",
  current_role: "Commander",
  role_version: 1,
  lifecycle_state: "active",
  readiness_state: "ready",
  production_verification_state: "verified",
  created_by_service_member_id: null,
  legacy_alias: null,
  source_lineage: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function Harness(): React.ReactElement {
  const [value, setValue] = useState("");
  return <IdentityPicker label="Owner" value={value} onChange={setValue} />;
}

describe("IdentityPicker", () => {
  beforeEach(() => {
    resolveServiceMember.mockReset();
  });

  it("resolves and shows a display name on blur", async () => {
    resolveServiceMember.mockResolvedValueOnce(member);
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText(/^owner$/i), "@VICTOR");
    await user.tab();

    await waitFor(() => expect(screen.getByText(/Victor — @VICTOR/)).toBeInTheDocument());
    expect(resolveServiceMember).toHaveBeenCalledWith("@VICTOR");
  });

  it("shows an error on a 404", async () => {
    resolveServiceMember.mockRejectedValueOnce(new Error("No canonical identity resolves to this identifier"));
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText(/^owner$/i), "@NOBODY");
    await user.tab();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/does not resolve/i));
  });

  it("does not call the API on every keystroke — only on blur", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText(/^owner$/i), "@VICTOR");
    expect(resolveServiceMember).not.toHaveBeenCalled();

    resolveServiceMember.mockResolvedValueOnce(member);
    await user.tab();

    await waitFor(() => expect(resolveServiceMember).toHaveBeenCalledTimes(1));
  });
});
