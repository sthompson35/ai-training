import React from "react";

type BarChartProps = {
  title: string;
  data: { label: string; count: number }[];
};

export function BarChart({ title, data }: BarChartProps): React.ReactElement {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 8px" }}>{title}</h3>
      {data.length === 0 ? (
        <p style={{ color: "var(--color-text-subtle)", margin: 0 }}>No data yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {data.map((d) => (
            <div
              key={d.label}
              style={{ display: "grid", gridTemplateColumns: "140px 1fr 40px", gap: 8, alignItems: "center" }}
            >
              <span style={{ fontSize: 13 }}>{d.label}</span>
              <div style={{ background: "var(--color-border-faint)", borderRadius: 4, height: 16 }}>
                <div
                  style={{
                    width: `${(d.count / max) * 100}%`,
                    background: "var(--color-accent)",
                    height: "100%",
                    borderRadius: 4,
                  }}
                />
              </div>
              <span style={{ fontSize: 13, textAlign: "right" }}>{d.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
