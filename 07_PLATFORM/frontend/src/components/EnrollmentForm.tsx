import React, { useState } from "react";
import { EnrollmentStatus, EnrollmentUpdateInput } from "../lib/api";

type Props = {
  initialValues?: EnrollmentUpdateInput;
  onSubmit: (payload: EnrollmentUpdateInput) => Promise<void>;
  onCancel?: () => void;
};

const statuses: EnrollmentStatus[] = [
  "enrolled",
  "written_passed",
  "practical_submitted",
  "practical_passed",
  "board_review",
  "certified",
  "failed",
];

const defaults: EnrollmentUpdateInput = { status: "enrolled", written_score: null, notes: null };

export function EnrollmentForm({ initialValues, onSubmit, onCancel }: Props): React.ReactElement {
  const [values, setValues] = useState<EnrollmentUpdateInput>(initialValues ?? defaults);
  const [saving, setSaving] = useState(false);

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
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8, maxWidth: 420 }}>
      <label>
        Status
        <select
          value={values.status}
          onChange={(e) => setValues({ ...values, status: e.target.value as EnrollmentStatus })}
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label>
        Written score
        <input
          type="number"
          min={0}
          max={100}
          value={values.written_score ?? ""}
          onChange={(e) =>
            setValues({ ...values, written_score: e.target.value === "" ? null : Number(e.target.value) })
          }
        />
      </label>
      <label>
        Notes
        <textarea
          value={values.notes ?? ""}
          onChange={(e) => setValues({ ...values, notes: e.target.value || null })}
        />
      </label>
      <div>
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
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
