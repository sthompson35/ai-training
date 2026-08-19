import React, { useEffect, useState } from "react";
import {
  Lab,
  LabInput,
  bulkDeleteLabs,
  createLab,
  deleteLab,
  exportLabsCsv,
  importLabsCsv,
  listLabs,
  updateLab,
} from "../lib/api";
import { LabForm } from "../components/LabForm";
import { ImportCsvButton } from "../components/ImportCsvButton";
import { BulkDeleteButton } from "../components/BulkDeleteButton";
import { useSelection } from "../hooks/useSelection";
import { usePendingDeletes } from "../hooks/usePendingDeletes";
import { useToast, UNDO_WINDOW_MS } from "../components/ToastProvider";

export function LabsPage(): React.ReactElement {
  const [labs, setLabs] = useState<Lab[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const selection = useSelection<string>();
  const pending = usePendingDeletes<string>();
  const toast = useToast();

  function refresh(): void {
    listLabs(domainFilter || undefined)
      .then(setLabs)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load labs"));
  }

  useEffect(refresh, [domainFilter]);

  async function handleCreate(payload: LabInput): Promise<void> {
    const id = window.prompt("New lab ID (e.g. LAB-013):");
    if (!id) return;
    try {
      await createLab(id, payload);
      setAdding(false);
      refresh();
      toast.success("Lab created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create lab");
    }
  }

  async function handleUpdate(labId: string, payload: LabInput): Promise<void> {
    try {
      await updateLab(labId, payload);
      setEditingId(null);
      refresh();
      toast.success("Lab updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update lab");
    }
  }

  function handleDelete(labId: string): void {
    if (!window.confirm(`Delete lab ${labId}?`)) return;
    pending.add(labId);
    const timeoutId = setTimeout(async () => {
      try {
        await deleteLab(labId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete lab");
      } finally {
        pending.remove(labId);
      }
    }, UNDO_WINDOW_MS);
    toast.success("Lab deleted.", {
      label: "Undo",
      onClick: () => {
        clearTimeout(timeoutId);
        pending.remove(labId);
      },
    });
  }

  const visibleLabs = (labs ?? []).filter((lab) => !pending.isPending(lab.id));

  return (
    <>
      <h1>Labs</h1>
      <label>
        Filter by domain:{" "}
        <input value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} placeholder="e.g. Agents" />
      </label>
      <button onClick={() => exportLabsCsv(domainFilter || undefined)} style={{ marginLeft: 8 }}>
        Export CSV
      </button>
      <ImportCsvButton onImport={importLabsCsv} onComplete={refresh} />
      <BulkDeleteButton
        selectedIds={[...selection.selected]}
        onBulkDelete={bulkDeleteLabs}
        onComplete={() => {
          selection.clear();
          refresh();
        }}
      />

      {error && <p role="alert">{error}</p>}
      {!labs ? (
        <p>Loading labs…</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", margin: "16px 0" }}>
          <thead>
            <tr>
              <th style={cellStyle} scope="col">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={visibleLabs.length > 0 && visibleLabs.every((lab) => selection.isSelected(lab.id))}
                  onChange={(e) =>
                    e.target.checked ? selection.selectAll(visibleLabs.map((lab) => lab.id)) : selection.clear()
                  }
                />
              </th>
              <th style={cellStyle} scope="col">ID</th>
              <th style={cellStyle} scope="col">Title</th>
              <th style={cellStyle} scope="col">Domain</th>
              <th style={cellStyle} scope="col">Deliverable</th>
              <th style={cellStyle} scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {visibleLabs.map((lab) =>
              editingId === lab.id ? (
                <tr key={lab.id}>
                  <td colSpan={6} style={cellStyle}>
                    <LabForm
                      submitLabel="Save"
                      initialValues={{ title: lab.title, domain: lab.domain, deliverable: lab.deliverable }}
                      onSubmit={(payload) => handleUpdate(lab.id, payload)}
                      onCancel={() => setEditingId(null)}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={lab.id}>
                  <td style={cellStyle}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${lab.title}`}
                      checked={selection.isSelected(lab.id)}
                      onChange={() => selection.toggle(lab.id)}
                    />
                  </td>
                  <td style={cellStyle}>{lab.id}</td>
                  <td style={cellStyle}>{lab.title}</td>
                  <td style={cellStyle}>{lab.domain}</td>
                  <td style={cellStyle}>{lab.deliverable}</td>
                  <td style={cellStyle}>
                    <button onClick={() => setEditingId(lab.id)}>Edit</button>
                    <button onClick={() => handleDelete(lab.id)} style={{ marginLeft: 8 }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}

      {adding ? (
        <LabForm submitLabel="Add lab" onSubmit={handleCreate} onCancel={() => setAdding(false)} />
      ) : (
        <button onClick={() => setAdding(true)}>Add Lab</button>
      )}
    </>
  );
}

const cellStyle: React.CSSProperties = { border: "1px solid var(--color-border-subtle)", padding: 8, textAlign: "left" };
