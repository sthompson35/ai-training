import React, { useEffect, useState } from "react";
import {
  GlossaryTerm,
  bulkDeleteGlossary,
  createGlossaryTerm,
  deleteGlossaryTerm,
  exportGlossaryCsv,
  importGlossaryCsv,
  listGlossary,
  updateGlossaryTerm,
} from "../lib/api";
import { GlossaryTermForm } from "../components/GlossaryTermForm";
import { ImportCsvButton } from "../components/ImportCsvButton";
import { BulkDeleteButton } from "../components/BulkDeleteButton";
import { useSelection } from "../hooks/useSelection";
import { usePendingDeletes } from "../hooks/usePendingDeletes";
import { useToast, UNDO_WINDOW_MS } from "../components/ToastProvider";

export function GlossaryPage(): React.ReactElement {
  const [terms, setTerms] = useState<GlossaryTerm[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingTerm, setEditingTerm] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const selection = useSelection<string>();
  const pending = usePendingDeletes<string>();
  const toast = useToast();

  function refresh(): void {
    listGlossary()
      .then(setTerms)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load glossary"));
  }

  useEffect(refresh, []);

  async function handleCreate(payload: GlossaryTerm): Promise<void> {
    try {
      await createGlossaryTerm(payload);
      setAdding(false);
      refresh();
      toast.success("Term created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create term");
    }
  }

  async function handleUpdate(term: string, payload: GlossaryTerm): Promise<void> {
    try {
      await updateGlossaryTerm(term, payload.definition);
      setEditingTerm(null);
      refresh();
      toast.success("Term updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update term");
    }
  }

  function handleDelete(term: string): void {
    if (!window.confirm(`Delete term "${term}"?`)) return;
    pending.add(term);
    const timeoutId = setTimeout(async () => {
      try {
        await deleteGlossaryTerm(term);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete term");
      } finally {
        pending.remove(term);
      }
    }, UNDO_WINDOW_MS);
    toast.success("Term deleted.", {
      label: "Undo",
      onClick: () => {
        clearTimeout(timeoutId);
        pending.remove(term);
      },
    });
  }

  const visibleTerms = (terms ?? []).filter((t) => !pending.isPending(t.term));

  return (
    <>
      <h1>Glossary</h1>
      <button onClick={() => exportGlossaryCsv()}>Export CSV</button>
      <ImportCsvButton onImport={importGlossaryCsv} onComplete={refresh} />
      <BulkDeleteButton
        selectedIds={[...selection.selected]}
        onBulkDelete={bulkDeleteGlossary}
        onComplete={() => {
          selection.clear();
          refresh();
        }}
      />
      {error && <p role="alert">{error}</p>}
      {!terms ? (
        <p>Loading glossary…</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {visibleTerms.map((t) =>
            editingTerm === t.term ? (
              <li key={t.term} style={{ border: "1px solid var(--color-border-subtle)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <GlossaryTermForm
                  initialValues={t}
                  onSubmit={(payload) => handleUpdate(t.term, payload)}
                  onCancel={() => setEditingTerm(null)}
                />
              </li>
            ) : (
              <li key={t.term} style={{ border: "1px solid var(--color-border-subtle)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <input
                  type="checkbox"
                  aria-label={`Select ${t.term}`}
                  checked={selection.isSelected(t.term)}
                  onChange={() => selection.toggle(t.term)}
                  style={{ marginRight: 8 }}
                />
                <strong>{t.term}</strong> — {t.definition}
                <div>
                  <button onClick={() => setEditingTerm(t.term)}>Edit</button>
                  <button onClick={() => handleDelete(t.term)} style={{ marginLeft: 8 }}>
                    Delete
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {adding ? (
        <GlossaryTermForm onSubmit={handleCreate} onCancel={() => setAdding(false)} />
      ) : (
        <button onClick={() => setAdding(true)}>Add term</button>
      )}
    </>
  );
}
