import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Certification, exportCertificationsCsv, listCertifications } from "../lib/api";

export function CertificationsPage(): React.ReactElement {
  const [certifications, setCertifications] = useState<Certification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCertifications()
      .then(setCertifications)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load certifications"));
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!certifications) return <p>Loading certifications…</p>;

  return (
    <>
      <h1>Certifications</h1>
      <button onClick={() => exportCertificationsCsv()}>Export CSV</button>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {certifications.map((cert) => (
          <li
            key={cert.code}
            style={{ border: "1px solid var(--color-border-subtle)", borderRadius: 8, padding: 12, marginBottom: 8 }}
          >
            <Link to={`/certifications/${cert.code}`}>
              {cert.code} — {cert.title}
            </Link>
            <div>
              Levels {cert.required_levels} · Passing score {cert.passing_percent}% · Recert every{" "}
              {cert.recert_months} months
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
