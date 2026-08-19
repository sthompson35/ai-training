import React, { useEffect, useState } from "react";
import { AuditLogEntry, exportAuditLogCsv, listAuditLog } from "../lib/api";
import { Pagination } from "../components/Pagination";

const LIMIT = 20;

export function AuditLogPage(): React.ReactElement {
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [username, setUsername] = useState("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    listAuditLog({ q: query || undefined, username: username || undefined, limit: LIMIT, offset })
      .then(({ items, total }) => {
        setEntries(items);
        setTotal(total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load audit log"));
  }, [query, username, offset]);

  function updateFilter(setter: (value: string) => void, value: string): void {
    setter(value);
    setOffset(0);
  }

  return (
    <>
      <h1>Audit Log</h1>
      <p>Every authenticated create, update, and delete across the academy, in one place.</p>
      <label>
        Search path:{" "}
        <input value={query} onChange={(e) => updateFilter(setQuery, e.target.value)} />
      </label>
      <label style={{ marginLeft: 16 }}>
        Username:{" "}
        <input value={username} onChange={(e) => updateFilter(setUsername, e.target.value)} />
      </label>
      <button
        onClick={() => exportAuditLogCsv({ q: query || undefined, username: username || undefined })}
        style={{ marginLeft: 16 }}
      >
        Export CSV
      </button>

      {error && <p role="alert">{error}</p>}
      {!entries ? (
        <p>Loading audit log…</p>
      ) : entries.length === 0 ? (
        <p>No audit log entries yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--color-border)" }}>
              <th scope="col">Timestamp</th>
              <th scope="col">Username</th>
              <th scope="col">Method</th>
              <th scope="col">Path</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} style={{ borderBottom: "1px solid var(--color-border-faint)" }}>
                <td>{new Date(entry.timestamp).toLocaleString()}</td>
                <td>{entry.username}</td>
                <td>{entry.method}</td>
                <td>{entry.path}</td>
                <td>{entry.status_code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pagination offset={offset} limit={LIMIT} total={total} onOffsetChange={setOffset} />
    </>
  );
}
