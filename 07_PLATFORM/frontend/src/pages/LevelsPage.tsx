import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Level, exportLevelsCsv, listLevels } from "../lib/api";

export function LevelsPage(): React.ReactElement {
  const [levels, setLevels] = useState<Level[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listLevels()
      .then(setLevels)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load levels"));
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!levels) return <p>Loading levels…</p>;

  return (
    <>
      <h1>Curriculum Levels</h1>
      <button onClick={() => exportLevelsCsv()}>Export CSV</button>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {levels.map((level) => (
          <li
            key={level.id}
            style={{ border: "1px solid var(--color-border-subtle)", borderRadius: 8, padding: 12, marginBottom: 8 }}
          >
            <Link to={`/levels/${level.id}`}>
              Level {level.id} — {level.title}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
