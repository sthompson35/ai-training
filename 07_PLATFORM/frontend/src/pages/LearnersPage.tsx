import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Learner,
  bulkDeleteLearners,
  createLearner,
  deleteLearner,
  exportLearnersCsv,
  importLearnersCsv,
  listLearners,
} from "../lib/api";
import { Pagination } from "../components/Pagination";
import { ImportCsvButton } from "../components/ImportCsvButton";
import { BulkDeleteButton } from "../components/BulkDeleteButton";
import { useSelection } from "../hooks/useSelection";
import { usePendingDeletes } from "../hooks/usePendingDeletes";
import { useToast, UNDO_WINDOW_MS } from "../components/ToastProvider";

const LIMIT = 20;

export function LearnersPage(): React.ReactElement {
  const [learners, setLearners] = useState<Learner[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const selection = useSelection<number>();
  const pending = usePendingDeletes<number>();
  const toast = useToast();

  function refresh(): void {
    listLearners({ q: query || undefined, limit: LIMIT, offset })
      .then(({ items, total }) => {
        setLearners(items);
        setTotal(total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load learners"));
  }

  useEffect(refresh, [query, offset]);

  function handleSearchChange(value: string): void {
    setQuery(value);
    setOffset(0);
  }

  async function handleCreate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    try {
      await createLearner({ name, email });
      setName("");
      setEmail("");
      refresh();
      toast.success("Learner created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create learner");
    }
  }

  function handleDelete(id: number): void {
    if (!window.confirm("Remove this learner and all their enrollments?")) return;
    pending.add(id);
    const timeoutId = setTimeout(async () => {
      try {
        await deleteLearner(id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete learner");
      } finally {
        pending.remove(id);
      }
    }, UNDO_WINDOW_MS);
    toast.success("Learner deleted.", {
      label: "Undo",
      onClick: () => {
        clearTimeout(timeoutId);
        pending.remove(id);
      },
    });
  }

  const visibleLearners = (learners ?? []).filter((learner) => !pending.isPending(learner.id));

  return (
    <>
      <h1>Learners</h1>
      <label>
        Search:{" "}
        <input value={query} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Name" />
      </label>
      <button onClick={() => exportLearnersCsv(query || undefined)} style={{ marginLeft: 8 }}>
        Export CSV
      </button>
      <ImportCsvButton onImport={importLearnersCsv} onComplete={refresh} />
      <BulkDeleteButton
        selectedIds={[...selection.selected]}
        onBulkDelete={bulkDeleteLearners}
        onComplete={() => {
          selection.clear();
          refresh();
        }}
      />
      {visibleLearners.length > 0 && (
        <label style={{ marginLeft: 8 }}>
          <input
            type="checkbox"
            checked={visibleLearners.every((learner) => selection.isSelected(learner.id))}
            onChange={(e) =>
              e.target.checked
                ? selection.selectAll(visibleLearners.map((learner) => learner.id))
                : selection.clear()
            }
          />{" "}
          Select all
        </label>
      )}

      {error && <p role="alert">{error}</p>}
      {!learners ? (
        <p>Loading learners…</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {visibleLearners.map((learner) => (
            <li
              key={learner.id}
              style={{ border: "1px solid var(--color-border-subtle)", borderRadius: 8, padding: 12, marginBottom: 8 }}
            >
              <input
                type="checkbox"
                aria-label={`Select ${learner.name}`}
                checked={selection.isSelected(learner.id)}
                onChange={() => selection.toggle(learner.id)}
                style={{ marginRight: 8 }}
              />
              <Link to={`/learners/${learner.id}`}>{learner.name}</Link> — {learner.email}
              <button onClick={() => handleDelete(learner.id)} style={{ marginLeft: 8 }}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      <Pagination offset={offset} limit={LIMIT} total={total} onOffsetChange={setOffset} />

      <h2>Add learner</h2>
      <form onSubmit={handleCreate} style={{ display: "grid", gap: 8, maxWidth: 360 }}>
        <label>
          Name
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Email
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button type="submit">Add learner</button>
      </form>
    </>
  );
}
