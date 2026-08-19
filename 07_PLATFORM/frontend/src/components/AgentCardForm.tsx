import React, { useState } from "react";
import { AgentCardInput, ApprovalStatus, APPROVAL_STATUSES } from "../lib/api";
import { IdentityPicker } from "./IdentityPicker";

type Props = {
  initialValues?: AgentCardInput;
  submitLabel: string;
  onSubmit: (payload: AgentCardInput) => Promise<void>;
  onCancel?: () => void;
};

const defaults: AgentCardInput = {
  name: "",
  owner: "",
  service_member_id: null,
  version: "1.0",
  purpose: "",
  non_goals: "",
  risk_tier: 1,
  approved_models: "",
  approved_tools: "",
  data_access: "",
  action_permissions: "",
  approval_requirements: "",
  budgets: "",
  fallback: "",
  monitoring: "",
  kill_switch: "",
  active: true,
  approval_status: "draft",
  evaluation_set: "",
  last_review: "",
};

const textFields: Array<[keyof AgentCardInput, string]> = [
  ["purpose", "Purpose"],
  ["non_goals", "Non-goals"],
  ["approved_models", "Approved models"],
  ["approved_tools", "Approved tools"],
  ["data_access", "Data access"],
  ["action_permissions", "Action permissions"],
  ["approval_requirements", "Approval requirements"],
  ["budgets", "Budgets"],
  ["fallback", "Fallback"],
  ["monitoring", "Monitoring"],
  ["kill_switch", "Kill switch (mechanism description)"],
  ["evaluation_set", "Evaluation set"],
];

export function AgentCardForm({ initialValues, submitLabel, onSubmit, onCancel }: Props): React.ReactElement {
  const [values, setValues] = useState<AgentCardInput>(initialValues ?? defaults);
  const [saving, setSaving] = useState(false);
  const editingExisting = Boolean(initialValues);

  function setField<K extends keyof AgentCardInput>(field: K, value: AgentCardInput[K]): void {
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
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8, maxWidth: 640 }}>
      <label>
        Name
        <input
          required
          disabled={editingExisting}
          value={values.name}
          onChange={(e) => setField("name", e.target.value)}
        />
      </label>
      <IdentityPicker label="Owner" required value={values.owner} onChange={(v) => setField("owner", v)} />
      <IdentityPicker
        label="Link to registry identity (optional, for AI-agent cards)"
        value={values.service_member_id ?? ""}
        onChange={(v) => setField("service_member_id", v || null)}
      />
      <label>
        Version
        <input required value={values.version} onChange={(e) => setField("version", e.target.value)} />
      </label>
      <label>
        Risk tier
        <select
          value={values.risk_tier}
          onChange={(e) => setField("risk_tier", Number(e.target.value))}
        >
          {[0, 1, 2, 3, 4].map((tier) => (
            <option key={tier} value={tier}>
              Tier {tier}
            </option>
          ))}
        </select>
      </label>
      <label>
        Approval status
        <select
          value={values.approval_status}
          onChange={(e) => setField("approval_status", e.target.value as ApprovalStatus)}
        >
          {APPROVAL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={values.active}
          onChange={(e) => setField("active", e.target.checked)}
        />{" "}
        Active (unchecking pulls the kill switch)
      </label>
      <label>
        Last review
        <input
          type="date"
          required
          value={values.last_review}
          onChange={(e) => setField("last_review", e.target.value)}
        />
      </label>
      {textFields.map(([field, label]) => (
        <label key={field}>
          {label}
          <textarea
            required
            value={values[field] as string}
            onChange={(e) => setField(field, e.target.value)}
          />
        </label>
      ))}
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
