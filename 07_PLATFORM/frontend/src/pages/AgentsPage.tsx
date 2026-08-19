import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AgentCard, bulkDeleteAgents, exportAgentsCsv, importAgentsCsv, listAgents } from "../lib/api";
import { Pagination } from "../components/Pagination";
import { ImportCsvButton } from "../components/ImportCsvButton";
import { BulkDeleteButton } from "../components/BulkDeleteButton";
import { useSelection } from "../hooks/useSelection";
import { useFocusHeadingOnMount } from "../hooks/useFocusHeadingOnMount";

const LIMIT = 20;

export function AgentsPage(): React.ReactElement {
  const headingRef = useFocusHeadingOnMount<HTMLHeadingElement>();
  const [agents, setAgents] = useState<AgentCard[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const selection = useSelection<number>();

  function refresh(): void {
    listAgents({ q: query || undefined, limit: LIMIT, offset })
      .then(({ items, total }) => {
        setAgents(items);
        setTotal(total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load agents"));
  }

  useEffect(refresh, [query, offset]);

  function handleSearchChange(value: string): void {
    setQuery(value);
    setOffset(0);
  }

  if (error) return <p role="alert">{error}</p>;

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1}>Agent Registry</h1>
      <label>
        Search:{" "}
        <input value={query} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Name" />
      </label>
      <button onClick={() => exportAgentsCsv(query || undefined)} style={{ marginLeft: 8 }}>
        Export CSV
      </button>
      <ImportCsvButton onImport={importAgentsCsv} onComplete={refresh} />
      <BulkDeleteButton
        selectedIds={[...selection.selected]}
        onBulkDelete={bulkDeleteAgents}
        onComplete={() => {
          selection.clear();
          refresh();
        }}
      />

      {!agents ? (
        <p>Loading agents…</p>
      ) : agents.length === 0 ? (
        <p>No agents registered yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
          <thead>
            <tr>
              <th style={cellStyle} scope="col">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={agents.every((agent) => selection.isSelected(agent.id))}
                  onChange={(e) =>
                    e.target.checked ? selection.selectAll(agents.map((agent) => agent.id)) : selection.clear()
                  }
                />
              </th>
              <th style={cellStyle} scope="col">Name</th>
              <th style={cellStyle} scope="col">Owner</th>
              <th style={cellStyle} scope="col">Risk tier</th>
              <th style={cellStyle} scope="col">Approval status</th>
              <th style={cellStyle} scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id}>
                <td style={cellStyle}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${agent.name}`}
                    checked={selection.isSelected(agent.id)}
                    onChange={() => selection.toggle(agent.id)}
                  />
                </td>
                <td style={cellStyle}>
                  <Link to={`/agents/${agent.id}`}>{agent.name}</Link>
                </td>
                <td style={cellStyle}>{agent.owner}</td>
                <td style={cellStyle}>{agent.risk_tier}</td>
                <td style={cellStyle}>{agent.approval_status}</td>
                <td style={cellStyle}>{agent.active ? "Active" : "Killed"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pagination offset={offset} limit={LIMIT} total={total} onOffsetChange={setOffset} />

      <Link to="/agents/new">
        <button>New Agent</button>
      </Link>
    </>
  );
}

const cellStyle: React.CSSProperties = { border: "1px solid var(--color-border-subtle)", padding: 8, textAlign: "left" };
