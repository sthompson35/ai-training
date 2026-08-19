import React, { useEffect, useState } from "react";
import { KB_CONTENT_TYPES, KB_STATUSES, KBArticleInput, Level, listLevels } from "../lib/api";

type Props = {
  initialValues?: KBArticleInput;
  submitLabel: string;
  onSubmit: (payload: KBArticleInput) => Promise<void>;
  onCancel?: () => void;
};

const defaults: KBArticleInput = {
  title: "",
  domain: "",
  content_type: KB_CONTENT_TYPES[0],
  status: KB_STATUSES[0],
  owner: "",
  review_date: "",
  version: "1.0",
  definition: "",
  why_it_matters: "",
  when_to_use: "",
  when_not_to_use: "",
  architecture: "",
  inputs_and_outputs: "",
  risks_and_controls: "",
  examples: "",
  evaluation_criteria: "",
  sources: "",
};

const textFields: Array<[keyof KBArticleInput, string]> = [
  ["definition", "Definition"],
  ["why_it_matters", "Why it matters"],
  ["when_to_use", "When to use"],
  ["when_not_to_use", "When not to use"],
  ["architecture", "Architecture"],
  ["inputs_and_outputs", "Inputs and outputs"],
  ["risks_and_controls", "Risks and controls"],
  ["examples", "Examples"],
  ["evaluation_criteria", "Evaluation criteria"],
  ["sources", "Sources"],
];

export function KBArticleForm({ initialValues, submitLabel, onSubmit, onCancel }: Props): React.ReactElement {
  const [values, setValues] = useState<KBArticleInput>(initialValues ?? defaults);
  const [levels, setLevels] = useState<Level[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listLevels().then(setLevels);
  }, []);

  function setField(field: keyof KBArticleInput, value: string): void {
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
        Title
        <input required value={values.title} onChange={(e) => setField("title", e.target.value)} />
      </label>
      <label>
        Domain
        <select required value={values.domain} onChange={(e) => setField("domain", e.target.value)}>
          <option value="">Select a domain…</option>
          {levels.map((level) => (
            <option key={level.id} value={level.title}>
              {level.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Content type
        <select value={values.content_type} onChange={(e) => setField("content_type", e.target.value)}>
          {KB_CONTENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select value={values.status} onChange={(e) => setField("status", e.target.value)}>
          {KB_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label>
        Owner
        <input required value={values.owner} onChange={(e) => setField("owner", e.target.value)} />
      </label>
      <label>
        Review date
        <input
          type="date"
          required
          value={values.review_date}
          onChange={(e) => setField("review_date", e.target.value)}
        />
      </label>
      <label>
        Version
        <input required value={values.version} onChange={(e) => setField("version", e.target.value)} />
      </label>
      {textFields.map(([field, label]) => (
        <label key={field}>
          {label}
          <textarea required value={values[field]} onChange={(e) => setField(field, e.target.value)} />
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
