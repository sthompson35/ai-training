import React, { useState } from "react";
import { BulkDeleteResult } from "../lib/api";
import { useToast } from "./ToastProvider";

type Props<T> = {
  selectedIds: T[];
  onBulkDelete: (ids: T[]) => Promise<BulkDeleteResult>;
  onComplete: () => void;
};

export function BulkDeleteButton<T>({ selectedIds, onBulkDelete, onComplete }: Props<T>): React.ReactElement {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function handleClick(): Promise<void> {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected item(s)?`)) return;
    setLoading(true);
    try {
      const result = await onBulkDelete(selectedIds);
      onComplete();
      toast.success(`Deleted ${result.deleted}, skipped ${result.skipped.length}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk delete failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span style={{ marginLeft: 8 }}>
      <button type="button" onClick={handleClick} disabled={selectedIds.length === 0 || loading}>
        {loading ? "Deleting…" : `Delete selected (${selectedIds.length})`}
      </button>
    </span>
  );
}
