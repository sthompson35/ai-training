import React, { useEffect, useState } from "react";
import {
  RaciEntry,
  RaciEntryInput,
  bulkDeleteRaciEntries,
  createRaciEntry,
  deleteRaciEntry,
  exportRaciEntriesCsv,
  importRaciEntriesCsv,
  listRaciEntries,
  updateRaciEntry,
} from "../lib/api";
import { RaciEntryForm } from "../components/RaciEntryForm";
import { ImportCsvButton } from "../components/ImportCsvButton";
import { BulkDeleteButton } from "../components/BulkDeleteButton";
import { useSelection } from "../hooks/useSelection";
import { usePendingDeletes } from "../hooks/usePendingDeletes";
import { useToast, UNDO_WINDOW_MS } from "../components/ToastProvider";

export function GovernancePage(): React.ReactElement {
  const [entries, setEntries] = useState<RaciEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const selection = useSelection<number>();
  const pending = usePendingDeletes<number>();
  const toast = useToast();

  function refresh(): void {
    listRaciEntries()
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load governance data"));
  }

  useEffect(refresh, []);

  async function handleCreate(payload: RaciEntryInput): Promise<void> {
    try {
      await createRaciEntry(payload);
      setAdding(false);
      refresh();
      toast.success("RACI entry created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create RACI entry");
    }
  }

  async function handleUpdate(id: number, payload: RaciEntryInput): Promise<void> {
    try {
      await updateRaciEntry(id, payload);
      setEditingId(null);
      refresh();
      toast.success("RACI entry updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update RACI entry");
    }
  }

  function handleDelete(id: number): void {
    if (!window.confirm("Remove this RACI entry?")) return;
    pending.add(id);
    const timeoutId = setTimeout(async () => {
      try {
        await deleteRaciEntry(id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete RACI entry");
      } finally {
        pending.remove(id);
      }
    }, UNDO_WINDOW_MS);
    toast.success("RACI entry deleted.", {
      label: "Undo",
      onClick: () => {
        clearTimeout(timeoutId);
        pending.remove(id);
      },
    });
  }

  if (error) return <p role="alert">{error}</p>;
  if (!entries) return <p>Loading governance data…</p>;

  const byActivity = entries.filter((entry) => !pending.isPending(entry.id)).reduce<Record<string, RaciEntry[]>>((groups, entry) => {
    (groups[entry.activity] ??= []).push(entry);
    return groups;
  }, {});

  return (
    <>
      <h1>Governance RACI</h1>
      <p>Who's Accountable, Responsible, Consulted, or Informed for each governance activity.</p>
      <button onClick={() => exportRaciEntriesCsv()}>Export CSV</button>
      <ImportCsvButton onImport={importRaciEntriesCsv} onComplete={refresh} />
      <BulkDeleteButton
        selectedIds={[...selection.selected]}
        onBulkDelete={bulkDeleteRaciEntries}
        onComplete={() => {
          selection.clear();
          refresh();
        }}
      />

      {Object.entries(byActivity).map(([activity, activityEntries]) => (
        <section key={activity} style={{ marginBottom: 24 }}>
          <h2>{activity}</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={cellStyle} scope="col"></th>
                <th style={cellStyle} scope="col">Role</th>
                <th style={cellStyle} scope="col">Responsibility</th>
                <th style={cellStyle} scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {activityEntries.map((entry) =>
                editingId === entry.id ? (
                  <tr key={entry.id}>
                    <td colSpan={4} style={cellStyle}>
                      <RaciEntryForm
                        submitLabel="Save"
                        initialValues={entry}
                        onSubmit={(payload) => handleUpdate(entry.id, payload)}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={entry.id}>
                    <td style={cellStyle}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${entry.role}`}
                        checked={selection.isSelected(entry.id)}
                        onChange={() => selection.toggle(entry.id)}
                      />
                    </td>
                    <td style={cellStyle}>{entry.role}</td>
                    <td style={cellStyle}>{entry.responsibility}</td>
                    <td style={cellStyle}>
                      <button onClick={() => setEditingId(entry.id)}>Edit</button>
                      <button onClick={() => handleDelete(entry.id)} style={{ marginLeft: 8 }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </section>
      ))}

      {adding ? (
        <RaciEntryForm submitLabel="Add entry" onSubmit={handleCreate} onCancel={() => setAdding(false)} />
      ) : (
        <button onClick={() => setAdding(true)}>Add Entry</button>
      )}
    </>
  );
}

const cellStyle: React.CSSProperties = { border: "1px solid var(--color-border-subtle)", padding: 8, textAlign: "left" };
