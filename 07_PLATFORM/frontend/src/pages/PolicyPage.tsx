import React, { useEffect, useState } from "react";
import {
  ApprovalRequest,
  PolicyConfig,
  approveApproval,
  getPolicyConfig,
  listApprovals,
  rejectApproval,
} from "../lib/api";
import { Pagination } from "../components/Pagination";
import { useToast } from "../components/ToastProvider";

const STATUS_OPTIONS = ["pending", "approved", "rejected", ""] as const;
const LIMIT = 20;

export function PolicyPage(): React.ReactElement {
  const [approvals, setApprovals] = useState<ApprovalRequest[] | null>(null);
  const [total, setTotal] = useState(0);
  const [config, setConfig] = useState<PolicyConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [offset, setOffset] = useState(0);
  const toast = useToast();

  function refresh(): void {
    listApprovals({ status: statusFilter || undefined, limit: LIMIT, offset })
      .then(({ items, total }) => {
        setApprovals(items);
        setTotal(total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load approval requests"));
  }

  useEffect(refresh, [statusFilter, offset]);

  useEffect(() => {
    getPolicyConfig()
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  function updateStatusFilter(value: string): void {
    setStatusFilter(value);
    setOffset(0);
  }

  async function handleApprove(id: number): Promise<void> {
    const note = window.prompt("Optional note for this approval:") ?? undefined;
    try {
      await approveApproval(id, note || undefined);
      toast.success("Request approved.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve request");
    }
  }

  async function handleReject(id: number): Promise<void> {
    const note = window.prompt("Optional note for this rejection:") ?? undefined;
    try {
      await rejectApproval(id, note || undefined);
      toast.success("Request rejected.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject request");
    }
  }

  if (error) return <p role="alert">{error}</p>;

  return (
    <>
      <h1>Policy</h1>
      <p>Admin-only: review AI routing requests that were flagged for human approval.</p>

      {config && (
        <p>
          Requests with risk tier ≥ {config.approval_tier} require approval before running on the server
          route (${config.cost_per_1k_chars_usd.toFixed(4)} per 1,000 characters).
        </p>
      )}

      <div style={{ marginBottom: 16 }}>
        <label>
          Status:{" "}
          <select value={statusFilter} onChange={(e) => updateStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status || "all"} value={status}>
                {status || "All"}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!approvals ? (
        <p>Loading approval requests…</p>
      ) : approvals.length === 0 ? (
        <p>No approval requests{statusFilter ? ` with status "${statusFilter}"` : ""}.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--color-border)" }}>
              <th scope="col">ID</th>
              <th scope="col">Task type</th>
              <th scope="col">Route</th>
              <th scope="col">Risk tier</th>
              <th scope="col">Reason</th>
              <th scope="col">Status</th>
              <th scope="col">Requested</th>
              <th scope="col">Decided by</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {approvals.map((approval) => (
              <tr key={approval.id} style={{ borderBottom: "1px solid var(--color-border-faint)" }}>
                <td>{approval.id}</td>
                <td>{approval.task_type}</td>
                <td>{approval.route}</td>
                <td>{approval.risk_tier}</td>
                <td>{approval.reason}</td>
                <td>{approval.status}</td>
                <td>{new Date(approval.requested_at).toLocaleString()}</td>
                <td>{approval.decided_by ?? "–"}</td>
                <td>
                  {approval.status === "pending" && (
                    <>
                      <button onClick={() => handleApprove(approval.id)}>Approve</button>
                      <button onClick={() => handleReject(approval.id)} style={{ marginLeft: 8 }}>
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Pagination offset={offset} limit={LIMIT} total={total} onOffsetChange={setOffset} />
    </>
  );
}
