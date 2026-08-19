import React, { useState } from "react";
import { BulkUpdateResult } from "../lib/api";
import { useToast } from "./ToastProvider";

type Props<T> = {
  selectedIds: T[];
  options: { value: string; label: string }[];
  fieldLabel: string;
  onBulkUpdate: (ids: T[], value: string) => Promise<BulkUpdateResult>;
  onComplete: () => void;
};

export function BulkEditButton<T>({
  selectedIds,
  options,
  fieldLabel,
  onBulkUpdate,
  onComplete,
}: Props<T>): React.ReactElement {
  const [value, setValue] = useState(options[0]?.value ?? "");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function handleClick(): Promise<void> {
    if (selectedIds.length === 0 || !value) return;
    if (!window.confirm(`Set ${fieldLabel} to "${value}" for ${selectedIds.length} selected item(s)?`)) return;
    setLoading(true);
    try {
      const result = await onBulkUpdate(selectedIds, value);
      onComplete();
      toast.success(`Updated ${result.updated}, skipped ${result.skipped.length}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span style={{ marginLeft: 8 }}>
      <select value={value} onChange={(e) => setValue(e.target.value)} aria-label={`Bulk set ${fieldLabel}`}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleClick}
        disabled={selectedIds.length === 0 || loading}
        style={{ marginLeft: 4 }}
      >
        {loading ? "Updating…" : `Set ${fieldLabel} (${selectedIds.length})`}
      </button>
    </span>
  );
}
