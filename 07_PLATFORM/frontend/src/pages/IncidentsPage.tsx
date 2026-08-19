import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AgentCard,
  CAPA_STATUSES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  Incident,
  Release,
  bulkDeleteIncidents,
  bulkUpdateIncidentCapaStatus,
  bulkUpdateIncidentStatus,
  exportIncidentsCsv,
  importIncidentsCsv,
  listAgents,
  listIncidents,
  listReleases,
} from "../lib/api";
import { Pagination } from "../components/Pagination";
import { ImportCsvButton } from "../components/ImportCsvButton";
import { BulkDeleteButton } from "../components/BulkDeleteButton";
import { BulkEditButton } from "../components/BulkEditButton";
import { useSelection } from "../hooks/useSelection";
import { useFocusHeadingOnMount } from "../hooks/useFocusHeadingOnMount";

const STATUS_OPTIONS = INCIDENT_STATUSES.map((status) => ({ value: status, label: status }));
const CAPA_STATUS_OPTIONS = CAPA_STATUSES.map((status) => ({ value: status, label: status }));

const LIMIT = 20;

export function IncidentsPage(): React.ReactElement {
  const headingRef = useFocusHeadingOnMount<HTMLHeadingElement>();
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [total, setTotal] = useState(0);
  const [agents, setAgents] = useState<AgentCard[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [releaseFilter, setReleaseFilter] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const selection = useSelection<number>();

  useEffect(() => {
    listAgents({ limit: 100 }).then(({ items }) => setAgents(items));
    listReleases({ limit: 100 }).then(({ items }) => setReleases(items));
  }, []);

  function refresh(): void {
    listIncidents({
      status: statusFilter || undefined,
      severity: severityFilter || undefined,
      releaseId: releaseFilter ? Number(releaseFilter) : undefined,
      q: query || undefined,
      limit: LIMIT,
      offset,
    })
      .then(({ items, total }) => {
        setIncidents(items);
        setTotal(total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load incidents"));
  }

  useEffect(refresh, [statusFilter, severityFilter, releaseFilter, query, offset]);

  function agentName(agentId: number | null): string | null {
    if (agentId === null) return null;
    return agents.find((a) => a.id === agentId)?.name ?? `Agent #${agentId}`;
  }

  function releaseName(releaseId: number | null): string | null {
    if (releaseId === null) return null;
    const release = releases.find((r) => r.id === releaseId);
    return release ? `${release.title} (${release.version})` : `Release #${releaseId}`;
  }

  function updateFilter(setter: (value: string) => void, value: string): void {
    setter(value);
    setOffset(0);
  }

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1}>Incident Log</h1>
      <div style={{ marginBottom: 16 }}>
        <label>
          Search title:{" "}
          <input value={query} onChange={(e) => updateFilter(setQuery, e.target.value)} />
        </label>
        <label style={{ marginLeft: 16 }}>
          Status:{" "}
          <select value={statusFilter} onChange={(e) => updateFilter(setStatusFilter, e.target.value)}>
            <option value="">All</option>
            {INCIDENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label style={{ marginLeft: 16 }}>
          Severity:{" "}
          <select value={severityFilter} onChange={(e) => updateFilter(setSeverityFilter, e.target.value)}>
            <option value="">All</option>
            {INCIDENT_SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </select>
        </label>
        <label style={{ marginLeft: 16 }}>
          Release:{" "}
          <select value={releaseFilter} onChange={(e) => updateFilter(setReleaseFilter, e.target.value)}>
            <option value="">All</option>
            {releases.map((release) => (
              <option key={release.id} value={release.id}>
                {release.title} ({release.version})
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() =>
            exportIncidentsCsv({
              status: statusFilter || undefined,
              severity: severityFilter || undefined,
              releaseId: releaseFilter ? Number(releaseFilter) : undefined,
              q: query || undefined,
            })
          }
          style={{ marginLeft: 16 }}
        >
          Export CSV
        </button>
        <ImportCsvButton onImport={importIncidentsCsv} onComplete={refresh} />
        <BulkDeleteButton
          selectedIds={[...selection.selected]}
          onBulkDelete={bulkDeleteIncidents}
          onComplete={() => {
            selection.clear();
            refresh();
          }}
        />
        <BulkEditButton
          selectedIds={[...selection.selected]}
          options={STATUS_OPTIONS}
          fieldLabel="status"
          onBulkUpdate={bulkUpdateIncidentStatus}
          onComplete={() => {
            selection.clear();
            refresh();
          }}
        />
        <BulkEditButton
          selectedIds={[...selection.selected]}
          options={CAPA_STATUS_OPTIONS}
          fieldLabel="CAPA status"
          onBulkUpdate={bulkUpdateIncidentCapaStatus}
          onComplete={() => {
            selection.clear();
            refresh();
          }}
        />
      </div>

      {error && <p role="alert">{error}</p>}
      {!incidents ? (
        <p>Loading incidents…</p>
      ) : incidents.length === 0 ? (
        <p>No incidents logged yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {incidents.map((incident) => (
            <li
              key={incident.id}
              style={{ border: "1px solid var(--color-border-subtle)", borderRadius: 8, padding: 12, marginBottom: 8 }}
            >
              <input
                type="checkbox"
                aria-label={`Select ${incident.title}`}
                checked={selection.isSelected(incident.id)}
                onChange={() => selection.toggle(incident.id)}
                style={{ marginRight: 8 }}
              />
              <Link to={`/incidents/${incident.id}`}>{incident.title}</Link>
              <div>
                {incident.severity} · {incident.status} · owner: {incident.owner}
                {agentName(incident.agent_id) && <> · agent: {agentName(incident.agent_id)}</>}
                {releaseName(incident.release_id) && <> · release: {releaseName(incident.release_id)}</>}
                {incident.capa_status && <> · CAPA: {incident.capa_status}</>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination offset={offset} limit={LIMIT} total={total} onOffsetChange={setOffset} />

      <Link to="/incidents/new">
        <button>New Incident</button>
      </Link>
    </>
  );
}
