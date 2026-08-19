import React, { useState } from "react";
import { RaciEntryInput } from "../lib/api";

type Props = {
  initialValues?: RaciEntryInput;
  submitLabel: string;
  onSubmit: (payload: RaciEntryInput) => Promise<void>;
  onCancel?: () => void;
};

const defaults: RaciEntryInput = { activity: "", role: "", responsibility: "" };

export function RaciEntryForm({ initialValues, submitLabel, onSubmit, onCancel }: Props): React.ReactElement {
  const [values, setValues] = useState<RaciEntryInput>(initialValues ?? defaults);
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
        Activity
        <input
          required
          value={values.activity}
          onChange={(e) => setValues({ ...values, activity: e.target.value })}
        />
      </label>
      <label>
        Role
        <input
          required
          value={values.role}
          onChange={(e) => setValues({ ...values, role: e.target.value })}
        />
      </label>
      <label>
        Responsibility (A/R/C/I, or a combination like "A/R")
        <input
          required
          value={values.responsibility}
          onChange={(e) => setValues({ ...values, responsibility: e.target.value })}
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
