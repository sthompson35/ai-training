import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  LearnerDetail,
  bulkDeleteEnrollments,
  exportEnrollmentsCsv,
  getLearner,
  importEnrollmentsCsv,
} from "../lib/api";
import { ImportCsvButton } from "../components/ImportCsvButton";
import { BulkDeleteButton } from "../components/BulkDeleteButton";
import { useSelection } from "../hooks/useSelection";

export function LearnerDetailPage(): React.ReactElement {
  const { learnerId } = useParams<{ learnerId: string }>();
  const [learner, setLearner] = useState<LearnerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selection = useSelection<number>();

  function refresh(): void {
    if (!learnerId) return;
    getLearner(Number(learnerId))
      .then(setLearner)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load learner"));
  }

  useEffect(refresh, [learnerId]);

  if (error) return <p role="alert">{error}</p>;
  if (!learner) return <p>Loading learner…</p>;

  return (
    <>
      <p>
        <Link to="/learners">&larr; All learners</Link>
      </p>
      <h1>{learner.name}</h1>
      <p>{learner.email}</p>

      <h2>Enrollments</h2>
      <button onClick={() => exportEnrollmentsCsv({ learnerId: Number(learnerId) })}>Export CSV</button>
      <ImportCsvButton onImport={importEnrollmentsCsv} onComplete={refresh} />
      <BulkDeleteButton
        selectedIds={[...selection.selected]}
        onBulkDelete={bulkDeleteEnrollments}
        onComplete={() => {
          selection.clear();
          refresh();
        }}
      />
      {learner.enrollments.length === 0 ? (
        <p>Not enrolled in any certifications yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={cellStyle} scope="col">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={learner.enrollments.every((e) => selection.isSelected(e.id))}
                  onChange={(ev) =>
                    ev.target.checked
                      ? selection.selectAll(learner.enrollments.map((e) => e.id))
                      : selection.clear()
                  }
                />
              </th>
              <th style={cellStyle} scope="col">Certification</th>
              <th style={cellStyle} scope="col">Status</th>
              <th style={cellStyle} scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {learner.enrollments.map((enrollment) => (
              <tr key={enrollment.id}>
                <td style={cellStyle}>
                  <input
                    type="checkbox"
                    aria-label={`Select enrollment for ${enrollment.certification_code}`}
                    checked={selection.isSelected(enrollment.id)}
                    onChange={() => selection.toggle(enrollment.id)}
                  />
                </td>
                <td style={cellStyle}>
                  <Link to={`/certifications/${enrollment.certification_code}`}>
                    {enrollment.certification_code}
                  </Link>
                </td>
                <td style={cellStyle}>{enrollment.status}</td>
                <td style={cellStyle}>{enrollment.written_score ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

const cellStyle: React.CSSProperties = { border: "1px solid var(--color-border-subtle)", padding: 8, textAlign: "left" };
