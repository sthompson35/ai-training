import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  LevelDetail,
  Module,
  ModuleInput,
  bulkDeleteModules,
  createModule,
  deleteModule,
  exportModulesCsv,
  getLevel,
  importModulesCsv,
  updateModule,
} from "../lib/api";
import { ModuleForm } from "../components/ModuleForm";
import { ImportCsvButton } from "../components/ImportCsvButton";
import { BulkDeleteButton } from "../components/BulkDeleteButton";
import { useSelection } from "../hooks/useSelection";
import { usePendingDeletes } from "../hooks/usePendingDeletes";
import { useToast, UNDO_WINDOW_MS } from "../components/ToastProvider";

export function LevelDetailPage(): React.ReactElement {
  const { levelId } = useParams<{ levelId: string }>();
  const [level, setLevel] = useState<LevelDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const selection = useSelection<string>();
  const pending = usePendingDeletes<string>();
  const toast = useToast();

  function refresh(): void {
    if (!levelId) return;
    getLevel(levelId)
      .then(setLevel)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load level"));
  }

  useEffect(refresh, [levelId]);

  if (error) return <p role="alert">{error}</p>;
  if (!level) return <p>Loading level…</p>;

  async function handleCreate(payload: ModuleInput): Promise<void> {
    const id = window.prompt("New module code (e.g. 00.5):");
    if (!id) return;
    try {
      await createModule(level!.id, id, payload);
      setAdding(false);
      refresh();
      toast.success("Module created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create module");
    }
  }

  async function handleUpdate(moduleId: string, payload: ModuleInput): Promise<void> {
    try {
      await updateModule(moduleId, payload);
      setEditingId(null);
      refresh();
      toast.success("Module updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update module");
    }
  }

  function handleDelete(moduleId: string): void {
    if (!window.confirm(`Delete module ${moduleId}?`)) return;
    pending.add(moduleId);
    const timeoutId = setTimeout(async () => {
      try {
        await deleteModule(moduleId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete module");
      } finally {
        pending.remove(moduleId);
      }
    }, UNDO_WINDOW_MS);
    toast.success("Module deleted.", {
      label: "Undo",
      onClick: () => {
        clearTimeout(timeoutId);
        pending.remove(moduleId);
      },
    });
  }

  const visibleModules = level.modules.filter((mod) => !pending.isPending(mod.id));

  return (
    <>
      <p>
        <Link to="/levels">&larr; All levels</Link>
      </p>
      <h1>
        Level {level.id} — {level.title}
      </h1>
      <button onClick={() => exportModulesCsv(level.id)}>Export CSV</button>
      <ImportCsvButton onImport={importModulesCsv} onComplete={refresh} />
      <BulkDeleteButton
        selectedIds={[...selection.selected]}
        onBulkDelete={bulkDeleteModules}
        onComplete={() => {
          selection.clear();
          refresh();
        }}
      />

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
        <thead>
          <tr>
            <th style={cellStyle} scope="col">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={visibleModules.length > 0 && visibleModules.every((mod) => selection.isSelected(mod.id))}
                onChange={(e) =>
                  e.target.checked ? selection.selectAll(visibleModules.map((mod) => mod.id)) : selection.clear()
                }
              />
            </th>
            <th style={cellStyle} scope="col">Code</th>
            <th style={cellStyle} scope="col">Title</th>
            <th style={cellStyle} scope="col">Hours</th>
            <th style={cellStyle} scope="col">Assessment</th>
            <th style={cellStyle} scope="col"></th>
          </tr>
        </thead>
        <tbody>
          {visibleModules.map((mod) =>
            editingId === mod.id ? (
              <tr key={mod.id}>
                <td colSpan={6} style={cellStyle}>
                  <ModuleForm
                    submitLabel="Save"
                    initialValues={toInput(mod)}
                    onSubmit={(payload) => handleUpdate(mod.id, payload)}
                    onCancel={() => setEditingId(null)}
                  />
                </td>
              </tr>
            ) : (
              <tr key={mod.id}>
                <td style={cellStyle}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${mod.title}`}
                    checked={selection.isSelected(mod.id)}
                    onChange={() => selection.toggle(mod.id)}
                  />
                </td>
                <td style={cellStyle}>{mod.id}</td>
                <td style={cellStyle}>{mod.title}</td>
                <td style={cellStyle}>{mod.estimated_hours}</td>
                <td style={cellStyle}>{mod.assessment}</td>
                <td style={cellStyle}>
                  <button onClick={() => setEditingId(mod.id)}>Edit</button>
                  <button onClick={() => handleDelete(mod.id)} style={{ marginLeft: 8 }}>
                    Delete
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      {adding ? (
        <ModuleForm submitLabel="Add module" onSubmit={handleCreate} onCancel={() => setAdding(false)} />
      ) : (
        <button onClick={() => setAdding(true)}>Add Module</button>
      )}
    </>
  );
}

function toInput(mod: Module): ModuleInput {
  return {
    title: mod.title,
    learning_outcome: mod.learning_outcome,
    estimated_hours: mod.estimated_hours,
    assessment: mod.assessment,
  };
}

const cellStyle: React.CSSProperties = { border: "1px solid var(--color-border-subtle)", padding: 8, textAlign: "left" };
