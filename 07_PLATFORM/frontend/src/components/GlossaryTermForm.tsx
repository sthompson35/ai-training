import React, { useState } from "react";
import { GlossaryTerm } from "../lib/api";

type Props = {
  initialValues?: GlossaryTerm;
  onSubmit: (payload: GlossaryTerm) => Promise<void>;
  onCancel?: () => void;
};

export function GlossaryTermForm({ initialValues, onSubmit, onCancel }: Props): React.ReactElement {
  const [term, setTerm] = useState(initialValues?.term ?? "");
  const [definition, setDefinition] = useState(initialValues?.definition ?? "");
  const [saving, setSaving] = useState(false);
  const editingExistingTerm = Boolean(initialValues);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ term, definition });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8, maxWidth: 480 }}>
      <label>
        Term
        <input
          required
          disabled={editingExistingTerm}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </label>
      <label>
        Definition
        <textarea required value={definition} onChange={(e) => setDefinition(e.target.value)} />
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
