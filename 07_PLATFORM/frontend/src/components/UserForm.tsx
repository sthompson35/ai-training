import React, { useState } from "react";
import { USER_ROLES, UserInput } from "../lib/api";
import { IdentityPicker } from "./IdentityPicker";

type Props = {
  submitLabel: string;
  onSubmit: (payload: UserInput) => Promise<void>;
  onCancel?: () => void;
};

const defaults: UserInput = { username: "", password: "", role: "contributor", identifier: "" };

export function UserForm({ submitLabel, onSubmit, onCancel }: Props): React.ReactElement {
  const [values, setValues] = useState<UserInput>(defaults);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit(values);
      setValues(defaults);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8, maxWidth: 320 }}>
      <label>
        Username
        <input
          required
          value={values.username}
          onChange={(e) => setValues({ ...values, username: e.target.value })}
        />
      </label>
      <label>
        Password
        <input
          required
          type="password"
          value={values.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })}
        />
      </label>
      <label>
        Role
        <select aria-label="Role" value={values.role} onChange={(e) => setValues({ ...values, role: e.target.value as UserInput["role"] })}>
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>
      <IdentityPicker
        label="Link to service member (optional)"
        value={values.identifier ?? ""}
        onChange={(v) => setValues({ ...values, identifier: v })}
      />
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
