import React, { useState } from "react";
import { ModuleInput } from "../lib/api";

type Props = {
  initialValues?: ModuleInput;
  submitLabel: string;
  onSubmit: (payload: ModuleInput) => Promise<void>;
  onCancel?: () => void;
};

const defaults: ModuleInput = {
  title: "",
  learning_outcome: "",
  estimated_hours: 4,
  assessment: "Quiz + Lab + Evidence",
};

export function ModuleForm({ initialValues, submitLabel, onSubmit, onCancel }: Props): React.ReactElement {
  const [values, setValues] = useState<ModuleInput>(initialValues ?? defaults);
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
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8, maxWidth: 480 }}>
      <label>
        Title
        <input
          required
          value={values.title}
          onChange={(e) => setValues({ ...values, title: e.target.value })}
        />
      </label>
      <label>
        Learning outcome
        <textarea
          required
          value={values.learning_outcome}
          onChange={(e) => setValues({ ...values, learning_outcome: e.target.value })}
        />
      </label>
      <label>
        Estimated hours
        <input
          type="number"
          min={0}
          required
          value={values.estimated_hours}
          onChange={(e) => setValues({ ...values, estimated_hours: Number(e.target.value) })}
        />
      </label>
      <label>
        Assessment
        <input
          required
          value={values.assessment}
          onChange={(e) => setValues({ ...values, assessment: e.target.value })}
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
