import React, { useRef, useState } from "react";
import { ImportResult } from "../lib/api";
import { useToast } from "./ToastProvider";

type Props = {
  onImport: (file: File) => Promise<ImportResult>;
  onComplete: () => void;
};

export function ImportCsvButton({ onImport, onComplete }: Props): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    setSummary(null);
    setLoading(true);
    try {
      const result = await onImport(file);
      setSummary(result);
      onComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <span style={{ marginLeft: 8 }}>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={handleChange}
        disabled={loading}
        style={{ display: "none" }}
      />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={loading}>
        {loading ? "Importing…" : "Import CSV"}
      </button>
      {summary && (
        <span style={{ marginLeft: 8 }}>
          Imported {summary.created}, skipped {summary.skipped.length}.
          {summary.skipped.length > 0 && (
            <ul>
              {summary.skipped.map((s) => (
                <li key={s.row}>
                  Row {s.row}: {s.reason}
                </li>
              ))}
            </ul>
          )}
        </span>
      )}
    </span>
  );
}
