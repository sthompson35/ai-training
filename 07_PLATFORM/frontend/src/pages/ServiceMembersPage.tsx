import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  LIFECYCLE_STATES,
  LifecycleState,
  MEMBER_CLASSES,
  MemberClass,
  ServiceMember,
  exportServiceMembersCsv,
  importServiceMembersCsv,
  listServiceMembers,
} from "../lib/api";
import { Pagination } from "../components/Pagination";
import { ImportCsvButton } from "../components/ImportCsvButton";
import { useFocusHeadingOnMount } from "../hooks/useFocusHeadingOnMount";

const LIMIT = 20;

export function ServiceMembersPage(): React.ReactElement {
  const headingRef = useFocusHeadingOnMount<HTMLHeadingElement>();
  const [members, setMembers] = useState<ServiceMember[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [memberClass, setMemberClass] = useState<MemberClass | "">("");
  const [lifecycleState, setLifecycleState] = useState<LifecycleState | "">("");
  const [offset, setOffset] = useState(0);

  function refresh(): void {
    listServiceMembers({
      q: query || undefined,
      memberClass: memberClass || undefined,
      lifecycleState: lifecycleState || undefined,
      limit: LIMIT,
      offset,
    })
      .then(({ items, total }) => {
        setMembers(items);
        setTotal(total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load service members"));
  }

  useEffect(refresh, [query, memberClass, lifecycleState, offset]);

  function handleSearchChange(value: string): void {
    setQuery(value);
    setOffset(0);
  }

  function handleMemberClassChange(value: MemberClass | ""): void {
    setMemberClass(value);
    setOffset(0);
  }

  function handleLifecycleStateChange(value: LifecycleState | ""): void {
    setLifecycleState(value);
    setOffset(0);
  }

  if (error) return <p role="alert">{error}</p>;

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1}>Service Members</h1>
      <p>The canonical identity registry — every human trooper and AI agent, by callsign.</p>
      <label>
        Search:{" "}
        <input value={query} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Callsign or name" />
      </label>
      <label style={{ marginLeft: 12 }}>
        Member class:{" "}
        <select value={memberClass} onChange={(e) => handleMemberClassChange(e.target.value as MemberClass | "")}>
          <option value="">All</option>
          {MEMBER_CLASSES.map((mc) => (
            <option key={mc} value={mc}>
              {mc}
            </option>
          ))}
        </select>
      </label>
      <label style={{ marginLeft: 12 }}>
        Lifecycle state:{" "}
        <select
          value={lifecycleState}
          onChange={(e) => handleLifecycleStateChange(e.target.value as LifecycleState | "")}
        >
          <option value="">All</option>
          {LIFECYCLE_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </label>
      <button
        onClick={() => exportServiceMembersCsv({ q: query || undefined, memberClass: memberClass || undefined, lifecycleState: lifecycleState || undefined })}
        style={{ marginLeft: 8 }}
      >
        Export CSV
      </button>
      <ImportCsvButton onImport={importServiceMembersCsv} onComplete={refresh} />

      {!members ? (
        <p>Loading service members…</p>
      ) : members.length === 0 ? (
        <p>No service members registered yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
          <thead>
            <tr>
              <th style={cellStyle} scope="col">Callsign</th>
              <th style={cellStyle} scope="col">Display name</th>
              <th style={cellStyle} scope="col">Current role</th>
              <th style={cellStyle} scope="col">Role version</th>
              <th style={cellStyle} scope="col">Command layer</th>
              <th style={cellStyle} scope="col">Lifecycle state</th>
              <th style={cellStyle} scope="col">Readiness state</th>
              <th style={cellStyle} scope="col">Production verification</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.service_member_id}>
                <td style={cellStyle}>
                  <Link to={`/service-members/${encodeURIComponent(member.service_member_id)}`}>
                    {member.callsign}
                  </Link>
                </td>
                <td style={cellStyle}>{member.display_name}</td>
                <td style={cellStyle}>{member.current_role}</td>
                <td style={cellStyle}>{member.role_version}</td>
                <td style={cellStyle}>{member.command_layer}</td>
                <td style={cellStyle}>{member.lifecycle_state}</td>
                <td style={cellStyle}>{member.readiness_state}</td>
                <td style={cellStyle}>{member.production_verification_state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pagination offset={offset} limit={LIMIT} total={total} onOffsetChange={setOffset} />

      <Link to="/service-members/new">
        <button>New Service Member</button>
      </Link>
    </>
  );
}

const cellStyle: React.CSSProperties = { border: "1px solid var(--color-border-subtle)", padding: 8, textAlign: "left" };
