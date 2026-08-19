import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  RELEASE_STATUSES,
  Release,
  bulkDeleteReleases,
  bulkUpdateReleaseStatus,
  exportReleasesCsv,
  importReleasesCsv,
  listReleases,
} from "../lib/api";
import { Pagination } from "../components/Pagination";
import { ImportCsvButton } from "../components/ImportCsvButton";
import { BulkDeleteButton } from "../components/BulkDeleteButton";
import { BulkEditButton } from "../components/BulkEditButton";
import { useSelection } from "../hooks/useSelection";
import { useFocusHeadingOnMount } from "../hooks/useFocusHeadingOnMount";

const STATUS_OPTIONS = RELEASE_STATUSES.map((status) => ({ value: status, label: status }));

const LIMIT = 20;

export function ReleasesPage(): React.ReactElement {
  const headingRef = useFocusHeadingOnMount<HTMLHeadingElement>();
  const [releases, setReleases] = useState<Release[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const selection = useSelection<number>();

  function refresh(): void {
    listReleases({ status: statusFilter || undefined, q: query || undefined, limit: LIMIT, offset })
      .then(({ items, total }) => {
        setReleases(items);
        setTotal(total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load releases"));
  }

  useEffect(refresh, [statusFilter, query, offset]);

  function updateFilter(setter: (value: string) => void, value: string): void {
    setter(value);
    setOffset(0);
  }

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1}>Release / Change Log</h1>
      <label>
        Search title:{" "}
        <input value={query} onChange={(e) => updateFilter(setQuery, e.target.value)} />
      </label>
      <label style={{ marginLeft: 16 }}>
        Status:{" "}
        <select value={statusFilter} onChange={(e) => updateFilter(setStatusFilter, e.target.value)}>
          <option value="">All</option>
          {RELEASE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <button
        onClick={() => exportReleasesCsv({ status: statusFilter || undefined, q: query || undefined })}
        style={{ marginLeft: 16 }}
      >
        Export CSV
      </button>
      <ImportCsvButton onImport={importReleasesCsv} onComplete={refresh} />
      <BulkDeleteButton
        selectedIds={[...selection.selected]}
        onBulkDelete={bulkDeleteReleases}
        onComplete={() => {
          selection.clear();
          refresh();
        }}
      />
      <BulkEditButton
        selectedIds={[...selection.selected]}
        options={STATUS_OPTIONS}
        fieldLabel="status"
        onBulkUpdate={bulkUpdateReleaseStatus}
        onComplete={() => {
          selection.clear();
          refresh();
        }}
      />

      {error && <p role="alert">{error}</p>}
      {!releases ? (
        <p>Loading releases…</p>
      ) : releases.length === 0 ? (
        <p>No releases logged yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {releases.map((release) => (
            <li
              key={release.id}
              style={{ border: "1px solid var(--color-border-subtle)", borderRadius: 8, padding: 12, marginBottom: 8 }}
            >
              <input
                type="checkbox"
                aria-label={`Select ${release.title}`}
                checked={selection.isSelected(release.id)}
                onChange={() => selection.toggle(release.id)}
                style={{ marginRight: 8 }}
              />
              <Link to={`/releases/${release.id}`}>
                {release.title} ({release.version})
              </Link>
              <div>
                {release.status} · tier {release.risk_tier} · approver: {release.approver} · {release.release_date}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination offset={offset} limit={LIMIT} total={total} onOffsetChange={setOffset} />

      <Link to="/releases/new">
        <button>New Release</button>
      </Link>
    </>
  );
}
