import React, { useEffect, useState } from "react";
import {
  AgentCard,
  CAPA_STATUSES,
  CapaStatus,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  IncidentInput,
  IncidentSeverity,
  IncidentStatus,
  Release,
  listAgents,
  listReleases,
} from "../lib/api";
import { IdentityPicker } from "./IdentityPicker";

type Props = {
  initialValues?: IncidentInput;
  submitLabel: string;
  onSubmit: (payload: IncidentInput) => Promise<void>;
  onCancel?: () => void;
};

const defaults: IncidentInput = {
  title: "",
  severity: "medium",
  status: "detected",
  description: "",
  impact: "",
  root_cause: null,
  corrective_action: null,
  owner: "",
  agent_id: null,
  release_id: null,
  capa_status: null,
  resolved_at: null,
};

export function IncidentForm({ initialValues, submitLabel, onSubmit, onCancel }: Props): React.ReactElement {
  const [values, setValues] = useState<IncidentInput>(initialValues ?? defaults);
  const [agents, setAgents] = useState<AgentCard[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listAgents({ limit: 100 }).then(({ items }) => setAgents(items));
    listReleases({ limit: 100 }).then(({ items }) => setReleases(items));
  }, []);

  function setField<K extends keyof IncidentInput>(field: K, value: IncidentInput[K]): void {
    setValues({ ...values, [field]: value });
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8, maxWidth: 560 }}>
      <label>
        Title
        <input required value={values.title} onChange={(e) => setField("title", e.target.value)} />
      </label>
      <label>
        Severity
        <select
          value={values.severity}
          onChange={(e) => setField("severity", e.target.value as IncidentSeverity)}
        >
          {INCIDENT_SEVERITIES.map((severity) => (
            <option key={severity} value={severity}>
              {severity}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select value={values.status} onChange={(e) => setField("status", e.target.value as IncidentStatus)}>
          {INCIDENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <IdentityPicker label="Owner" required value={values.owner} onChange={(v) => setField("owner", v)} />
      <label>
        Linked agent (optional)
        <select
          value={values.agent_id ?? ""}
          onChange={(e) => setField("agent_id", e.target.value === "" ? null : Number(e.target.value))}
        >
          <option value="">None</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Linked release (optional)
        <select
          value={values.release_id ?? ""}
          onChange={(e) => setField("release_id", e.target.value === "" ? null : Number(e.target.value))}
        >
          <option value="">None</option>
          {releases.map((release) => (
            <option key={release.id} value={release.id}>
              {release.title} ({release.version})
            </option>
          ))}
        </select>
      </label>
      <label>
        Description
        <textarea
          required
          value={values.description}
          onChange={(e) => setField("description", e.target.value)}
        />
      </label>
      <label>
        Impact
        <textarea required value={values.impact} onChange={(e) => setField("impact", e.target.value)} />
      </label>
      <label>
        Root cause
        <textarea
          value={values.root_cause ?? ""}
          onChange={(e) => setField("root_cause", e.target.value || null)}
        />
      </label>
      <label>
        Corrective action
        <textarea
          value={values.corrective_action ?? ""}
          onChange={(e) => setField("corrective_action", e.target.value || null)}
        />
      </label>
      <label>
        CAPA status (optional)
        <select
          value={values.capa_status ?? ""}
          onChange={(e) => setField("capa_status", e.target.value === "" ? null : (e.target.value as CapaStatus))}
        >
          <option value="">None</option>
          {CAPA_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label>
        Resolved date
        <input
          type="date"
          value={values.resolved_at ?? ""}
          onChange={(e) => setField("resolved_at", e.target.value || null)}
        />
      </label>
      <div>
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} style={{ marginLeft: 8 }}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
