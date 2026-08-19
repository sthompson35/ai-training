import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Incident,
  IncidentInput,
  createIncident,
  deleteIncident,
  getIncident,
  updateIncident,
} from "../lib/api";
import { IncidentForm } from "../components/IncidentForm";
import { useToast, UNDO_WINDOW_MS } from "../components/ToastProvider";

export function IncidentDetailPage(): React.ReactElement {
  const { incidentId } = useParams<{ incidentId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = incidentId === undefined;
  const [incident, setIncident] = useState<Incident | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh(): void {
    if (isNew) return;
    getIncident(Number(incidentId))
      .then(setIncident)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load incident"));
  }

  useEffect(refresh, [incidentId, isNew]);

  async function handleSubmit(payload: IncidentInput): Promise<void> {
    try {
      if (isNew) {
        const created = await createIncident(payload);
        toast.success("Incident created.");
        navigate(`/incidents/${created.id}`);
      } else {
        await updateIncident(Number(incidentId), payload);
        refresh();
        toast.success("Incident updated.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save incident");
    }
  }

  function handleDelete(): void {
    if (!incident || !window.confirm(`Delete incident "${incident.title}"?`)) return;
    const { id, title } = incident;
    navigate("/incidents");
    const timeoutId = setTimeout(async () => {
      try {
        await deleteIncident(id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete incident");
      }
    }, UNDO_WINDOW_MS);
    toast.success(`"${title}" deleted.`, { label: "Undo", onClick: () => clearTimeout(timeoutId) });
  }

  if (error) return <p role="alert">{error}</p>;
  if (!isNew && !incident) return <p>Loading incident…</p>;

  return (
    <>
      <p>
        <Link to="/incidents">&larr; All incidents</Link>
      </p>
      <h1>{isNew ? "New Incident" : incident!.title}</h1>

      <IncidentForm
        initialValues={incident ?? undefined}
        submitLabel={isNew ? "Log incident" : "Save changes"}
        onSubmit={handleSubmit}
      />
      {!isNew && (
        <button onClick={handleDelete} style={{ marginTop: 16 }}>
          Delete incident
        </button>
      )}
    </>
  );
}
