import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Incident,
  Release,
  ReleaseInput,
  createRelease,
  deleteRelease,
  getRelease,
  listIncidents,
  updateRelease,
} from "../lib/api";
import { ReleaseForm } from "../components/ReleaseForm";
import { useToast, UNDO_WINDOW_MS } from "../components/ToastProvider";

export function ReleaseDetailPage(): React.ReactElement {
  const { releaseId } = useParams<{ releaseId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = releaseId === undefined;
  const [release, setRelease] = useState<Release | null>(null);
  const [linkedIncidents, setLinkedIncidents] = useState<Incident[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh(): void {
    if (isNew) return;
    getRelease(Number(releaseId))
      .then(setRelease)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load release"));
  }

  useEffect(refresh, [releaseId, isNew]);

  useEffect(() => {
    if (isNew) return;
    listIncidents({ releaseId: Number(releaseId), limit: 100 }).then(({ items }) => setLinkedIncidents(items));
  }, [releaseId, isNew]);

  async function handleSubmit(payload: ReleaseInput): Promise<void> {
    try {
      if (isNew) {
        const created = await createRelease(payload);
        toast.success("Release created.");
        navigate(`/releases/${created.id}`);
      } else {
        await updateRelease(Number(releaseId), payload);
        refresh();
        toast.success("Release updated.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save release");
    }
  }

  function handleDelete(): void {
    if (!release || !window.confirm(`Delete release "${release.title}"?`)) return;
    const { id, title } = release;
    navigate("/releases");
    const timeoutId = setTimeout(async () => {
      try {
        await deleteRelease(id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete release");
      }
    }, UNDO_WINDOW_MS);
    toast.success(`"${title}" deleted.`, { label: "Undo", onClick: () => clearTimeout(timeoutId) });
  }

  if (error) return <p role="alert">{error}</p>;
  if (!isNew && !release) return <p>Loading release…</p>;

  return (
    <>
      <p>
        <Link to="/releases">&larr; All releases</Link>
      </p>
      <h1>{isNew ? "New Release" : release!.title}</h1>

      <ReleaseForm
        initialValues={release ?? undefined}
        submitLabel={isNew ? "Log release" : "Save changes"}
        onSubmit={handleSubmit}
      />
      {!isNew && (
        <button onClick={handleDelete} style={{ marginTop: 16 }}>
          Delete release
        </button>
      )}

      {!isNew && (
        <section style={{ marginTop: 24 }}>
          <h2>Linked incidents</h2>
          {!linkedIncidents ? (
            <p>Loading linked incidents…</p>
          ) : linkedIncidents.length === 0 ? (
            <p>No incidents linked to this release.</p>
          ) : (
            <ul>
              {linkedIncidents.map((incident) => (
                <li key={incident.id}>
                  <Link to={`/incidents/${incident.id}`}>{incident.title}</Link> — {incident.status}
                  {incident.capa_status && <> · CAPA: {incident.capa_status}</>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
