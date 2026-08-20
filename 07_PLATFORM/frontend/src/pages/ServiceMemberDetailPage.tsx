import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  COMMAND_LAYERS,
  CommandLayer,
  IdentityVerification,
  LifecycleTransitionHistoryEntry,
  MEMBER_CLASSES,
  MemberClass,
  READINESS_STATES,
  ReadinessState,
  RoleAssignmentHistoryEntry,
  RoleChangeInput,
  ServiceMember,
  ServiceMemberInput,
  ServiceMemberUpdateInput,
  VERIFICATION_OUTCOMES,
  VerifyIdentityInput,
  changeServiceMemberRole,
  createServiceMember,
  deactivateServiceMember,
  dischargeServiceMember,
  getLifecycleHistory,
  getRoleHistory,
  getServiceMember,
  getVerifications,
  reactivateServiceMember,
  updateServiceMember,
  verifyIdentity,
} from "../lib/api";
import { useToast } from "../components/ToastProvider";

const createDefaults: ServiceMemberInput = {
  service_member_id: "",
  callsign_id: "",
  callsign: "",
  display_name: "",
  member_class: "human_trooper",
  command_layer: "field_operations",
  current_role: "",
  lifecycle_state: "active",
  readiness_state: "ready",
  production_verification_state: "unverified",
  legacy_alias: null,
  source_lineage: null,
};

export function ServiceMemberDetailPage(): React.ReactElement {
  const { serviceMemberId } = useParams<{ serviceMemberId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = serviceMemberId === undefined;

  const [member, setMember] = useState<ServiceMember | null>(null);
  const [roleHistory, setRoleHistory] = useState<RoleAssignmentHistoryEntry[] | null>(null);
  const [verifications, setVerifications] = useState<IdentityVerification[] | null>(null);
  const [lifecycleHistory, setLifecycleHistory] = useState<LifecycleTransitionHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [createValues, setCreateValues] = useState<ServiceMemberInput>(createDefaults);
  const [creating, setCreating] = useState(false);

  const [editValues, setEditValues] = useState<ServiceMemberUpdateInput | null>(null);
  const [saving, setSaving] = useState(false);

  const [roleChange, setRoleChange] = useState<RoleChangeInput>({
    new_role: "",
    new_command_layer: "field_operations",
    reason: "",
  });
  const [changingRole, setChangingRole] = useState(false);

  const [showVerifyForm, setShowVerifyForm] = useState(false);
  const [verifyValues, setVerifyValues] = useState<VerifyIdentityInput>({
    evidence_reference: "",
    verification_method: "",
    outcome: "verified",
    notes: "",
  });
  const [verifying, setVerifying] = useState(false);

  const [lifecycleReason, setLifecycleReason] = useState("");
  const [transitioningLifecycle, setTransitioningLifecycle] = useState(false);

  function refresh(): void {
    if (isNew) return;
    getServiceMember(serviceMemberId)
      .then((m) => {
        setMember(m);
        setEditValues({
          display_name: m.display_name,
          readiness_state: m.readiness_state,
          legacy_alias: m.legacy_alias,
        });
        setRoleChange((prev) => ({ ...prev, new_command_layer: m.command_layer }));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load service member"));
    getRoleHistory(serviceMemberId)
      .then((rows) => setRoleHistory([...rows].sort((a, b) => a.role_version - b.role_version)))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load role history"));
    getVerifications(serviceMemberId)
      .then((rows) => setVerifications([...rows].sort((a, b) => a.id - b.id)))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load verification history"));
    getLifecycleHistory(serviceMemberId)
      .then(setLifecycleHistory)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load lifecycle history"));
  }

  useEffect(refresh, [serviceMemberId, isNew]);

  async function handleCreate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setCreating(true);
    try {
      const created = await createServiceMember(createValues);
      toast.success("Service member registered.");
      navigate(`/service-members/${encodeURIComponent(created.service_member_id)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to register service member");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!editValues || isNew) return;
    setSaving(true);
    try {
      await updateServiceMember(serviceMemberId!, editValues);
      refresh();
      toast.success("Service member updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update service member");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (isNew) return;
    setChangingRole(true);
    try {
      await changeServiceMemberRole(serviceMemberId!, {
        ...roleChange,
        reason: roleChange.reason || undefined,
      });
      refresh();
      toast.success("Role changed.");
      setRoleChange((prev) => ({ ...prev, new_role: "", reason: "" }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change role");
    } finally {
      setChangingRole(false);
    }
  }

  async function handleVerify(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (isNew) return;
    setVerifying(true);
    try {
      const result = await verifyIdentity(serviceMemberId!, {
        ...verifyValues,
        notes: verifyValues.notes || undefined,
      });
      refresh();
      toast.success(`Verification recorded — outcome: ${result.outcome}.`);
      setVerifyValues({ evidence_reference: "", verification_method: "", outcome: "verified", notes: "" });
      setShowVerifyForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record verification");
    } finally {
      setVerifying(false);
    }
  }

  async function handleLifecycleTransition(
    action: (id: string, payload: { reason: string }) => Promise<unknown>,
    successMessage: string,
  ): Promise<void> {
    if (isNew || !lifecycleReason.trim()) return;
    setTransitioningLifecycle(true);
    try {
      await action(serviceMemberId!, { reason: lifecycleReason.trim() });
      refresh();
      toast.success(successMessage);
      setLifecycleReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change lifecycle state");
    } finally {
      setTransitioningLifecycle(false);
    }
  }

  if (error) return <p role="alert">{error}</p>;
  if (!isNew && (!member || !editValues)) return <p>Loading service member…</p>;

  return (
    <>
      <p>
        <Link to="/service-members">&larr; All service members</Link>
      </p>
      <h1>{isNew ? "New Service Member" : member!.display_name}</h1>

      {isNew ? (
        <form onSubmit={handleCreate} style={{ display: "grid", gap: 8, maxWidth: 480 }}>
          <label>
            Service member ID
            <input
              required
              value={createValues.service_member_id}
              onChange={(e) => setCreateValues({ ...createValues, service_member_id: e.target.value })}
            />
          </label>
          <label>
            Callsign ID
            <input
              required
              value={createValues.callsign_id}
              onChange={(e) => setCreateValues({ ...createValues, callsign_id: e.target.value })}
            />
          </label>
          <label>
            Callsign
            <input
              required
              value={createValues.callsign}
              onChange={(e) => setCreateValues({ ...createValues, callsign: e.target.value })}
              placeholder="@VICTOR"
            />
          </label>
          <label>
            Display name
            <input
              required
              value={createValues.display_name}
              onChange={(e) => setCreateValues({ ...createValues, display_name: e.target.value })}
            />
          </label>
          <label>
            Member class
            <select
              value={createValues.member_class}
              onChange={(e) => setCreateValues({ ...createValues, member_class: e.target.value as MemberClass })}
            >
              {MEMBER_CLASSES.map((mc) => (
                <option key={mc} value={mc}>
                  {mc}
                </option>
              ))}
            </select>
          </label>
          <label>
            Command layer
            <select
              value={createValues.command_layer}
              onChange={(e) => setCreateValues({ ...createValues, command_layer: e.target.value as CommandLayer })}
            >
              {COMMAND_LAYERS.map((cl) => (
                <option key={cl} value={cl}>
                  {cl}
                </option>
              ))}
            </select>
          </label>
          <label>
            Current role
            <input
              required
              value={createValues.current_role}
              onChange={(e) => setCreateValues({ ...createValues, current_role: e.target.value })}
            />
          </label>
          <div>
            <button type="submit" disabled={creating}>
              {creating ? "Registering…" : "Register service member"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <section style={{ marginBottom: 24 }}>
            <h2>Identity (immutable)</h2>
            <table style={{ borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <th style={labelCellStyle} scope="row">Service member ID</th>
                  <td style={cellStyle}>{member!.service_member_id}</td>
                </tr>
                <tr>
                  <th style={labelCellStyle} scope="row">Callsign ID</th>
                  <td style={cellStyle}>{member!.callsign_id}</td>
                </tr>
                <tr>
                  <th style={labelCellStyle} scope="row">Callsign</th>
                  <td style={cellStyle}>{member!.callsign}</td>
                </tr>
                <tr>
                  <th style={labelCellStyle} scope="row">Member class</th>
                  <td style={cellStyle}>{member!.member_class}</td>
                </tr>
                <tr>
                  <th style={labelCellStyle} scope="row">Created by</th>
                  <td style={cellStyle}>{member!.created_by_service_member_id ?? "—"}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section style={{ marginBottom: 24 }}>
            <h2>Edit</h2>
            <form onSubmit={handleSaveEdit} style={{ display: "grid", gap: 8, maxWidth: 480 }}>
              <label>
                Display name
                <input
                  required
                  value={editValues!.display_name}
                  onChange={(e) => setEditValues({ ...editValues!, display_name: e.target.value })}
                />
              </label>
              <label>
                Readiness state
                <select
                  value={editValues!.readiness_state}
                  onChange={(e) =>
                    setEditValues({ ...editValues!, readiness_state: e.target.value as ReadinessState })
                  }
                >
                  {READINESS_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Legacy alias
                <input
                  value={editValues!.legacy_alias ?? ""}
                  onChange={(e) => setEditValues({ ...editValues!, legacy_alias: e.target.value || null })}
                />
              </label>
              <div>
                <button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </section>

          <section style={{ marginBottom: 24 }}>
            <h2>Lifecycle</h2>
            <p>Current state: {member!.lifecycle_state}</p>
            {member!.lifecycle_state === "discharged" ? (
              <p>Discharged is terminal — no further lifecycle transitions are possible.</p>
            ) : (
              <div style={{ display: "grid", gap: 8, maxWidth: 480 }}>
                <label>
                  Reason (required for any transition below)
                  <textarea
                    required
                    value={lifecycleReason}
                    onChange={(e) => setLifecycleReason(e.target.value)}
                  />
                </label>
                <div>
                  {member!.lifecycle_state === "active" && (
                    <button
                      type="button"
                      disabled={transitioningLifecycle || !lifecycleReason.trim()}
                      onClick={() => handleLifecycleTransition(deactivateServiceMember, "Identity deactivated.")}
                    >
                      {transitioningLifecycle ? "Working…" : "Deactivate"}
                    </button>
                  )}
                  {member!.lifecycle_state === "inactive" && (
                    <button
                      type="button"
                      disabled={transitioningLifecycle || !lifecycleReason.trim()}
                      onClick={() => handleLifecycleTransition(reactivateServiceMember, "Identity reactivated.")}
                    >
                      {transitioningLifecycle ? "Working…" : "Reactivate"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={transitioningLifecycle || !lifecycleReason.trim()}
                    onClick={() => handleLifecycleTransition(dischargeServiceMember, "Identity discharged.")}
                    style={{ marginLeft: 8 }}
                  >
                    {transitioningLifecycle ? "Working…" : "Discharge (terminal)"}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section style={{ marginBottom: 24 }}>
            <h2>Current role</h2>
            <p>
              {member!.current_role} · v{member!.role_version} · {member!.command_layer}
            </p>
            <h3>Change role</h3>
            <form onSubmit={handleRoleChange} style={{ display: "grid", gap: 8, maxWidth: 480 }}>
              <label>
                New role
                <input
                  required
                  value={roleChange.new_role}
                  onChange={(e) => setRoleChange({ ...roleChange, new_role: e.target.value })}
                />
              </label>
              <label>
                New command layer
                <select
                  value={roleChange.new_command_layer}
                  onChange={(e) =>
                    setRoleChange({ ...roleChange, new_command_layer: e.target.value as CommandLayer })
                  }
                >
                  {COMMAND_LAYERS.map((cl) => (
                    <option key={cl} value={cl}>
                      {cl}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reason (optional)
                <textarea
                  value={roleChange.reason ?? ""}
                  onChange={(e) => setRoleChange({ ...roleChange, reason: e.target.value })}
                />
              </label>
              <div>
                <button type="submit" disabled={changingRole}>
                  {changingRole ? "Changing…" : "Change role"}
                </button>
              </div>
            </form>
          </section>

          <section style={{ marginBottom: 24 }}>
            <h2>Production verification</h2>
            <p>Current state: {member!.production_verification_state}</p>
            {!showVerifyForm ? (
              <button type="button" onClick={() => setShowVerifyForm(true)}>
                Record verification
              </button>
            ) : (
              <form onSubmit={handleVerify} style={{ display: "grid", gap: 8, maxWidth: 480 }}>
                <label>
                  Evidence reference
                  <textarea
                    required
                    value={verifyValues.evidence_reference}
                    onChange={(e) => setVerifyValues({ ...verifyValues, evidence_reference: e.target.value })}
                  />
                </label>
                <label>
                  Verification method
                  <input
                    required
                    value={verifyValues.verification_method}
                    onChange={(e) => setVerifyValues({ ...verifyValues, verification_method: e.target.value })}
                  />
                </label>
                <label>
                  Outcome
                  <select
                    required
                    value={verifyValues.outcome}
                    onChange={(e) =>
                      setVerifyValues({ ...verifyValues, outcome: e.target.value as VerifyIdentityInput["outcome"] })
                    }
                  >
                    {VERIFICATION_OUTCOMES.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Notes (optional)
                  <textarea
                    value={verifyValues.notes ?? ""}
                    onChange={(e) => setVerifyValues({ ...verifyValues, notes: e.target.value })}
                  />
                </label>
                <div>
                  <button type="submit" disabled={verifying}>
                    {verifying ? "Recording…" : "Submit verification"}
                  </button>
                  <button type="button" onClick={() => setShowVerifyForm(false)} style={{ marginLeft: 8 }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>

          <section style={{ marginBottom: 24 }}>
            <h2>Role history</h2>
            {!roleHistory ? (
              <p>Loading role history…</p>
            ) : roleHistory.length === 0 ? (
              <p>No role history yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={cellStyle} scope="col">Version</th>
                    <th style={cellStyle} scope="col">Role</th>
                    <th style={cellStyle} scope="col">Command layer</th>
                    <th style={cellStyle} scope="col">Readiness state</th>
                    <th style={cellStyle} scope="col">Effective at</th>
                    <th style={cellStyle} scope="col">Changed by</th>
                    <th style={cellStyle} scope="col">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {roleHistory.map((row) => (
                    <tr key={row.id}>
                      <td style={cellStyle}>{row.role_version}</td>
                      <td style={cellStyle}>{row.role}</td>
                      <td style={cellStyle}>{row.command_layer}</td>
                      <td style={cellStyle}>{row.readiness_state}</td>
                      <td style={cellStyle}>{new Date(row.effective_at).toLocaleString()}</td>
                      <td style={cellStyle}>{row.changed_by ?? "—"}</td>
                      <td style={cellStyle}>{row.change_reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section style={{ marginBottom: 24 }}>
            <h2>Lifecycle history</h2>
            {!lifecycleHistory ? (
              <p>Loading lifecycle history…</p>
            ) : lifecycleHistory.length === 0 ? (
              <p>No lifecycle transitions yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={cellStyle} scope="col">From</th>
                    <th style={cellStyle} scope="col">To</th>
                    <th style={cellStyle} scope="col">Reason</th>
                    <th style={cellStyle} scope="col">Changed by</th>
                    <th style={cellStyle} scope="col">Effective at</th>
                  </tr>
                </thead>
                <tbody>
                  {lifecycleHistory.map((row) => (
                    <tr key={row.id}>
                      <td style={cellStyle}>{row.from_state}</td>
                      <td style={cellStyle}>{row.to_state}</td>
                      <td style={cellStyle}>{row.reason}</td>
                      <td style={cellStyle}>{row.changed_by ?? "—"}</td>
                      <td style={cellStyle}>{new Date(row.effective_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h2>Verification history</h2>
            {!verifications ? (
              <p>Loading verification history…</p>
            ) : verifications.length === 0 ? (
              <p>No verification history yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={cellStyle} scope="col">Outcome</th>
                    <th style={cellStyle} scope="col">Evidence reference</th>
                    <th style={cellStyle} scope="col">Verification method</th>
                    <th style={cellStyle} scope="col">Verifier</th>
                    <th style={cellStyle} scope="col">Notes</th>
                    <th style={cellStyle} scope="col">Verified at</th>
                  </tr>
                </thead>
                <tbody>
                  {verifications.map((row) => (
                    <tr key={row.id}>
                      <td style={cellStyle}>{row.outcome}</td>
                      <td style={cellStyle}>{row.evidence_reference}</td>
                      <td style={cellStyle}>{row.verification_method}</td>
                      <td style={cellStyle}>{row.verifier_service_member_id}</td>
                      <td style={cellStyle}>{row.notes ?? "—"}</td>
                      <td style={cellStyle}>{new Date(row.verified_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </>
  );
}

const cellStyle: React.CSSProperties = { border: "1px solid var(--color-border-subtle)", padding: 8, textAlign: "left" };
const labelCellStyle: React.CSSProperties = { ...cellStyle, fontWeight: "bold" };
