import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AgentCard,
  AgentCardInput,
  AgentExecuteResult,
  createAgent,
  deleteAgent,
  executeAgent,
  getAgent,
  updateAgent,
} from "../lib/api";
import { AgentCardForm } from "../components/AgentCardForm";
import { useToast, UNDO_WINDOW_MS } from "../components/ToastProvider";

export function AgentDetailPage(): React.ReactElement {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = agentId === undefined;
  const [agent, setAgent] = useState<AgentCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh(): void {
    if (isNew) return;
    getAgent(Number(agentId))
      .then(setAgent)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load agent"));
  }

  useEffect(refresh, [agentId, isNew]);

  async function handleSubmit(payload: AgentCardInput): Promise<void> {
    try {
      if (isNew) {
        const created = await createAgent(payload);
        toast.success("Agent registered.");
        navigate(`/agents/${created.id}`);
      } else {
        await updateAgent(Number(agentId), payload);
        refresh();
        toast.success("Agent updated.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save agent");
    }
  }

  async function handleToggleKillSwitch(): Promise<void> {
    if (!agent) return;
    const action = agent.active ? "pull the kill switch on" : "reactivate";
    if (!window.confirm(`Are you sure you want to ${action} "${agent.name}"?`)) return;
    try {
      const { id, owner_service_member_id, ...rest } = agent;
      await updateAgent(id, { ...rest, active: !agent.active });
      refresh();
      toast.success(agent.active ? "Kill switch pulled." : "Agent reactivated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update agent status");
    }
  }

  const approvedModels = (agent?.approved_models ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const [execPrompt, setExecPrompt] = useState("");
  const [execModel, setExecModel] = useState("");
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<AgentExecuteResult | null>(null);

  async function handleExecute(event: React.FormEvent, approvalRequestId?: number): Promise<void> {
    event.preventDefault();
    if (!agent || !execPrompt.trim()) return;
    setExecuting(true);
    try {
      const result = await executeAgent(agent.id, {
        prompt: execPrompt,
        model: execModel || undefined,
        approval_request_id: approvalRequestId,
      });
      setExecResult(result);
      if (result.status === "completed") {
        toast.success("Agent executed.");
      } else {
        toast.success(`Awaiting approval — request #${result.approval_request_id}.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to execute agent");
    } finally {
      setExecuting(false);
    }
  }

  function handleDelete(): void {
    if (!agent || !window.confirm(`Delete agent "${agent.name}"?`)) return;
    const { id, name } = agent;
    navigate("/agents");
    const timeoutId = setTimeout(async () => {
      try {
        await deleteAgent(id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete agent");
      }
    }, UNDO_WINDOW_MS);
    toast.success(`${name} deleted.`, { label: "Undo", onClick: () => clearTimeout(timeoutId) });
  }

  if (error) return <p role="alert">{error}</p>;
  if (!isNew && !agent) return <p>Loading agent…</p>;

  return (
    <>
      <p>
        <Link to="/agents">&larr; All agents</Link>
      </p>
      <h1>{isNew ? "New Agent" : agent!.name}</h1>

      {!isNew && (
        <div style={{ marginBottom: 16 }}>
          <strong>Status: {agent!.active ? "Active" : "Killed"}</strong>
          <button onClick={handleToggleKillSwitch} style={{ marginLeft: 12 }}>
            {agent!.active ? "Pull kill switch" : "Reactivate"}
          </button>
        </div>
      )}

      {!isNew && (
        <section style={{ marginBottom: 24, border: "1px solid var(--color-border-subtle)", padding: 16 }}>
          <h2>Execute</h2>
          {!agent!.active ? (
            <p>This agent's kill switch is engaged — it cannot execute.</p>
          ) : (
            <form onSubmit={(e) => handleExecute(e)} style={{ display: "grid", gap: 8, maxWidth: 560 }}>
              <label>
                Prompt
                <textarea
                  required
                  rows={3}
                  value={execPrompt}
                  onChange={(e) => setExecPrompt(e.target.value)}
                />
              </label>
              <label>
                Model
                <select value={execModel} onChange={(e) => setExecModel(e.target.value)}>
                  <option value="">
                    {approvedModels[0] ?? "No approved models configured"} (default)
                  </option>
                  {approvedModels.slice(1).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <button type="submit" disabled={executing || approvedModels.length === 0}>
                  {executing ? "Running…" : "Run"}
                </button>
              </div>
            </form>
          )}

          {execResult && execResult.status === "pending_approval" && (
            <div style={{ marginTop: 12 }}>
              <p>
                <strong>Awaiting approval</strong> — {execResult.reason}
              </p>
              <p>
                <Link to="/policy">Review in the approval queue</Link>, then{" "}
                <button
                  type="button"
                  onClick={(e) => handleExecute(e, execResult.approval_request_id!)}
                  disabled={executing}
                >
                  Retry now
                </button>
              </p>
            </div>
          )}

          {execResult && execResult.status === "completed" && (
            <div style={{ marginTop: 12 }}>
              <p>
                <strong>Output</strong> ({execResult.model}, {execResult.prompt_tokens}+
                {execResult.completion_tokens} tokens, ${execResult.estimated_cost_usd.toFixed(6)})
              </p>
              <pre style={{ whiteSpace: "pre-wrap", background: "var(--color-bg-muted)", padding: 12 }}>
                {execResult.output}
              </pre>
            </div>
          )}
        </section>
      )}

      <AgentCardForm
        initialValues={agent ?? undefined}
        submitLabel={isNew ? "Register agent" : "Save changes"}
        onSubmit={handleSubmit}
      />
      {!isNew && (
        <button onClick={handleDelete} style={{ marginTop: 16 }}>
          Delete agent
        </button>
      )}
    </>
  );
}
