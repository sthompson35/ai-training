import React, { useState } from "react";
import { RELEASE_STATUSES, ReleaseInput, ReleaseStatus } from "../lib/api";
import { IdentityPicker } from "./IdentityPicker";

type Props = {
  initialValues?: ReleaseInput;
  submitLabel: string;
  onSubmit: (payload: ReleaseInput) => Promise<void>;
  onCancel?: () => void;
};

const defaults: ReleaseInput = {
  title: "",
  version: "",
  rationale: "",
  expected_impact: "",
  test_evidence: "",
  approver: "",
  risk_tier: 1,
  release_date: "",
  rollback_target: "",
  status: "proposed",
};

export function ReleaseForm({ initialValues, submitLabel, onSubmit, onCancel }: Props): React.ReactElement {
  const [values, setValues] = useState<ReleaseInput>(initialValues ?? defaults);
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof ReleaseInput>(field: K, value: ReleaseInput[K]): void {
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
        Version
        <input required value={values.version} onChange={(e) => setField("version", e.target.value)} />
      </label>
      <label>
        Risk tier
        <select value={values.risk_tier} onChange={(e) => setField("risk_tier", Number(e.target.value))}>
          {[0, 1, 2, 3, 4].map((tier) => (
            <option key={tier} value={tier}>
              Tier {tier}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select value={values.status} onChange={(e) => setField("status", e.target.value as ReleaseStatus)}>
          {RELEASE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <IdentityPicker label="Approver" required value={values.approver} onChange={(v) => setField("approver", v)} />
      <label>
        Release date
        <input
          type="date"
          required
          value={values.release_date}
          onChange={(e) => setField("release_date", e.target.value)}
        />
      </label>
      <label>
        Rationale
        <textarea
          required
          value={values.rationale}
          onChange={(e) => setField("rationale", e.target.value)}
        />
      </label>
      <label>
        Expected impact
        <textarea
          required
          value={values.expected_impact}
          onChange={(e) => setField("expected_impact", e.target.value)}
        />
      </label>
      <label>
        Test evidence
        <textarea
          required
          value={values.test_evidence}
          onChange={(e) => setField("test_evidence", e.target.value)}
        />
      </label>
      <label>
        Rollback target
        <textarea
          required
          value={values.rollback_target}
          onChange={(e) => setField("rollback_target", e.target.value)}
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
