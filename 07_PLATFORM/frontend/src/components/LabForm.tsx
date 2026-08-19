import React, { useState } from "react";
import { LabInput } from "../lib/api";

type Props = {
  initialValues?: LabInput;
  submitLabel: string;
  onSubmit: (payload: LabInput) => Promise<void>;
  onCancel?: () => void;
};

const defaults: LabInput = { title: "", domain: "", deliverable: "" };

export function LabForm({ initialValues, submitLabel, onSubmit, onCancel }: Props): React.ReactElement {
  const [values, setValues] = useState<LabInput>(initialValues ?? defaults);
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
        Domain
        <input
          required
          value={values.domain}
          onChange={(e) => setValues({ ...values, domain: e.target.value })}
        />
      </label>
      <label>
        Deliverable
        <textarea
          required
          value={values.deliverable}
          onChange={(e) => setValues({ ...values, deliverable: e.target.value })}
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
