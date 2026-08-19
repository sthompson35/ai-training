import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CertificationDetail,
  ENROLLMENT_STATUSES,
  Learner,
  bulkDeleteEnrollments,
  bulkUpdateEnrollmentStatus,
  createEnrollment,
  deleteEnrollment,
  exportEnrollmentsCsv,
  getCertification,
  importEnrollmentsCsv,
  listLearners,
  updateEnrollment,
} from "../lib/api";
import { EnrollmentForm } from "../components/EnrollmentForm";
import { ImportCsvButton } from "../components/ImportCsvButton";
import { BulkDeleteButton } from "../components/BulkDeleteButton";
import { BulkEditButton } from "../components/BulkEditButton";
import { useSelection } from "../hooks/useSelection";
import { usePendingDeletes } from "../hooks/usePendingDeletes";
import { useToast, UNDO_WINDOW_MS } from "../components/ToastProvider";

const STATUS_OPTIONS = ENROLLMENT_STATUSES.map((status) => ({ value: status, label: status }));

export function CertificationDetailPage(): React.ReactElement {
  const { code } = useParams<{ code: string }>();
  const [certification, setCertification] = useState<CertificationDetail | null>(null);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selection = useSelection<number>();
  const pending = usePendingDeletes<number>();
  const toast = useToast();

  function refresh(): void {
    if (!code) return;
    getCertification(code)
      .then(setCertification)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load certification"));
  }

  useEffect(refresh, [code]);
  useEffect(() => {
    listLearners({ limit: 100 }).then(({ items }) => setLearners(items));
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!certification) return <p>Loading certification…</p>;

  async function handleEnroll(): Promise<void> {
    if (!selectedLearnerId || !code) return;
    try {
      await createEnrollment(Number(selectedLearnerId), code);
      setSelectedLearnerId("");
      refresh();
      toast.success("Learner enrolled.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to enroll learner");
    }
  }

  async function handleUpdate(enrollmentId: number, payload: Parameters<typeof updateEnrollment>[1]) {
    try {
      await updateEnrollment(enrollmentId, payload);
      setEditingId(null);
      refresh();
      toast.success("Enrollment updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update enrollment");
    }
  }

  function handleDelete(enrollmentId: number): void {
    if (!window.confirm("Remove this enrollment?")) return;
    pending.add(enrollmentId);
    const timeoutId = setTimeout(async () => {
      try {
        await deleteEnrollment(enrollmentId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to remove enrollment");
      } finally {
        pending.remove(enrollmentId);
      }
    }, UNDO_WINDOW_MS);
    toast.success("Enrollment removed.", {
      label: "Undo",
      onClick: () => {
        clearTimeout(timeoutId);
        pending.remove(enrollmentId);
      },
    });
  }

  const visibleEnrollments = certification.enrollments.filter((e) => !pending.isPending(e.id));

  return (
    <>
      <p>
        <Link to="/certifications">&larr; All certifications</Link>
      </p>
      <h1>
        {certification.code} — {certification.title}
      </h1>
      <ul>
        <li>Required levels: {certification.required_levels}</li>
        <li>Written questions: {certification.written_questions}</li>
        <li>Practical: {certification.practical}</li>
        <li>Passing score: {certification.passing_percent}%</li>
        <li>Recertification: every {certification.recert_months} months</li>
      </ul>

      <h2>Enrollments</h2>
      <button onClick={() => exportEnrollmentsCsv({ certificationCode: code })}>Export CSV</button>
      <ImportCsvButton onImport={importEnrollmentsCsv} onComplete={refresh} />
      <BulkDeleteButton
        selectedIds={[...selection.selected]}
        onBulkDelete={bulkDeleteEnrollments}
        onComplete={() => {
          selection.clear();
          refresh();
        }}
      />
      <BulkEditButton
        selectedIds={[...selection.selected]}
        options={STATUS_OPTIONS}
        fieldLabel="status"
        onBulkUpdate={bulkUpdateEnrollmentStatus}
        onComplete={() => {
          selection.clear();
          refresh();
        }}
      />
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
        <thead>
          <tr>
            <th style={cellStyle} scope="col">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={visibleEnrollments.every((e) => selection.isSelected(e.id))}
                onChange={(ev) =>
                  ev.target.checked ? selection.selectAll(visibleEnrollments.map((e) => e.id)) : selection.clear()
                }
              />
            </th>
            <th style={cellStyle} scope="col">Learner</th>
            <th style={cellStyle} scope="col">Status</th>
            <th style={cellStyle} scope="col">Score</th>
            <th style={cellStyle} scope="col">Notes</th>
            <th style={cellStyle} scope="col"></th>
          </tr>
        </thead>
        <tbody>
          {visibleEnrollments.map((enrollment) =>
            editingId === enrollment.id ? (
              <tr key={enrollment.id}>
                <td colSpan={6} style={cellStyle}>
                  <EnrollmentForm
                    initialValues={{
                      status: enrollment.status,
                      written_score: enrollment.written_score,
                      notes: enrollment.notes,
                    }}
                    onSubmit={(payload) => handleUpdate(enrollment.id, payload)}
                    onCancel={() => setEditingId(null)}
                  />
                </td>
              </tr>
            ) : (
              <tr key={enrollment.id}>
                <td style={cellStyle}>
                  <input
                    type="checkbox"
                    aria-label={`Select enrollment for learner ${enrollment.learner_id}`}
                    checked={selection.isSelected(enrollment.id)}
                    onChange={() => selection.toggle(enrollment.id)}
                  />
                </td>
                <td style={cellStyle}>
                  <Link to={`/learners/${enrollment.learner_id}`}>Learner #{enrollment.learner_id}</Link>
                </td>
                <td style={cellStyle}>{enrollment.status}</td>
                <td style={cellStyle}>{enrollment.written_score ?? "—"}</td>
                <td style={cellStyle}>{enrollment.notes ?? "—"}</td>
                <td style={cellStyle}>
                  <button onClick={() => setEditingId(enrollment.id)}>Edit</button>
                  <button onClick={() => handleDelete(enrollment.id)} style={{ marginLeft: 8 }}>
                    Remove
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      <h3>Enroll a learner</h3>
      <select
        aria-label="Learner to enroll"
        value={selectedLearnerId}
        onChange={(e) => setSelectedLearnerId(e.target.value)}
      >
        <option value="">Select a learner…</option>
        {learners.map((learner) => (
          <option key={learner.id} value={learner.id}>
            {learner.name} ({learner.email})
          </option>
        ))}
      </select>
      <button onClick={handleEnroll} disabled={!selectedLearnerId} style={{ marginLeft: 8 }}>
        Enroll
      </button>
      {learners.length === 0 && (
        <p>
          No learners yet. <Link to="/learners">Add one first</Link>.
        </p>
      )}
    </>
  );
}

const cellStyle: React.CSSProperties = { border: "1px solid var(--color-border-subtle)", padding: 8, textAlign: "left" };
